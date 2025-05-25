import { EventMap, TypedEventEmitter } from './EventEmitter';
import { Device } from 'mediasoup-client';
import {
  Transport,
  Producer,
  Consumer,
  MediaKind,
  RtpCapabilities,
  TransportOptions,
} from 'mediasoup-client/lib/types';
import { AsyncEventQueue } from './AsyncEventQueue';
import { SignalingChannel, SignalingMessage } from './SignallingChannel';

export interface VideoCallClientOptions {
  signalingUrl: string;
  iceServers?: RTCIceServer[];
}

export class VideoCallClient extends TypedEventEmitter<EventMap> {
  private signaling: SignalingChannel;
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private recvTransport: Transport | null = null;
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();
  private eventQueue = new AsyncEventQueue();
  private roomId: string | null = null;
  private userId: string | null = null;
  private localStream: MediaStream | null = null;
  private iceServers: RTCIceServer[];
  private pendingProducers: { producerId: string; userId: string }[] = [];
  private pendingProduceCallbacks = new Map<
    string, // transportId
    { callback: Function; errback: Function }
  >();

  constructor(options: VideoCallClientOptions) {
    super();
    this.signaling = new SignalingChannel(options.signalingUrl);
    this.iceServers = options.iceServers || [
      { urls: 'stun:stun.l.google.com:19302' },
    ];
    this.setupSignalingListeners();
  }

  private setupSignalingListeners(): void {
    this.signaling.on('message', message => {
      console.log('signallingmessage', message);
      this.eventQueue.enqueue(async () => {
        this.handleSignalingMessage(message);
      });
    });
  }

  private async handleSignalingMessage(
    message: SignalingMessage
  ): Promise<void> {
    console.log('handlemessage', message);
    switch (message.type) {
      case 'welcome':
        this.emit('connected');
        break;

      case 'routerRtpCapabilities':
        await this.loadDevice(message.routerRtpCapabilities);
        break;

      case 'newProducer':
        if (!this.device || !this.recvTransport) {
          console.log(
            `Received newProducer but not ready yet, queueing: ${message.producerId}`
          );
          // Queue this message to handle later when transport is ready
          this.pendingProducers = this.pendingProducers || [];
          this.pendingProducers.push({
            producerId: message.producerId,
            userId: message.userId,
          });
        } else {
          await this.subscribeToProducer(message.producerId, message.userId);
        }
        break;

      case 'transportCreated':
        if (message.direction === 'send') {
          await this.connectSendTransport(message.transportOptions);
        } else if (message.direction === 'recv') {
          await this.connectRecvTransport(message.transportOptions);

          // Process any pending producers after receive transport is ready
          if (this.pendingProducers && this.pendingProducers.length > 0) {
            console.log(
              `Processing ${this.pendingProducers.length} pending producers`
            );
            for (const producer of this.pendingProducers) {
              await this.subscribeToProducer(
                producer.producerId,
                producer.userId
              );
            }
            this.pendingProducers = [];
          }
        }
        break;

      case 'producerCreated': {
        const { id, requestId } = message;
        const pending = this.pendingProduceCallbacks.get(requestId);
        console.log('pendingCallback', pending);
        if (pending) {
          pending.callback({ id });
          console.log('callback worked with id', id);
          this.pendingProduceCallbacks.delete(requestId);
        } else {
          console.warn('No pending produce callback for', requestId);
        }
        break;
      }

      case 'consumerCreated':
        await this.handleConsumerCreated(message);
        break;

      case 'participantJoined':
        this.emit('newParticipant', { userId: message.userId });
        break;

      case 'participantLeft':
        this.emit('participantLeft', { userId: message.userId });
        break;

      case 'error':
        this.emit('error', new Error(message.error || 'Unknown error'));
        break;
    }
  }

  async joinCall(roomId: string, userId: string): Promise<void> {
    this.roomId = roomId;
    this.userId = userId;

    await this.signaling.connect();

    this.signaling.send({
      type: 'join',
      roomId,
      userId,
    });
  }

  private async loadDevice(
    routerRtpCapabilities: RtpCapabilities
  ): Promise<void> {
    this.device = new Device();
    await this.device.load({ routerRtpCapabilities });

    // Request creation of send and receive transports
    this.signaling.send({
      type: 'createTransports',
      roomId: this.roomId,
      userId: this.userId,
    });
  }

  private async connectSendTransport(
    transportOptions: TransportOptions
  ): Promise<void> {
    if (!this.device) {
      throw new Error('Device not loaded');
    }

    this.sendTransport = this.device.createSendTransport(transportOptions);

    this.sendTransport.on(
      'connect',
      ({ dtlsParameters }, callback, errback) => {
        this.signaling.send({
          type: 'connectTransport',
          transportId: this.sendTransport!.id,
          dtlsParameters,
          direction: 'send',
        });
        callback();
      }
    );

    this.sendTransport.on(
      'produce',
      async ({ kind, rtpParameters, appData }, callback, errback) => {
        const requestId = `${this.sendTransport!.id}-${Date.now()}`;
        try {
          this.pendingProduceCallbacks.set(requestId, {
            callback,
            errback,
          });

          this.signaling.send({
            type: 'produce',
            transportId: this.sendTransport!.id,
            kind,
            rtpParameters,
            appData,
            requestId,
          });
        } catch (error) {
          errback(error as Error);
        }
      }
    );

    // Once the send transport is ready, get local media and produce
    await this.produceLocalMedia();
  }

  private async connectRecvTransport(transportOptions: any): Promise<void> {
    if (!this.device) {
      throw new Error('Device not loaded');
    }

    this.recvTransport = this.device.createRecvTransport(transportOptions);

    this.recvTransport.on(
      'connect',
      ({ dtlsParameters }, callback, errback) => {
        this.signaling.send({
          type: 'connectTransport',
          transportId: this.recvTransport!.id,
          dtlsParameters,
          direction: 'recv',
        });
        callback();
      }
    );
  }

  private async produceLocalMedia(): Promise<void> {
    try {
      console.log('Getting user media...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log(
        'Got local stream with tracks:',
        this.localStream.getTracks().map(t => `${t.kind}:${t.id}:${t.enabled}`)
      );
      // Emit local stream immediately for preview before production
      if (this.localStream) {
        console.log('Emitting local stream for preview');
        this.emit('newStream', {
          userId: this.userId || 'local',
          stream: this.localStream,
          kind: 'video',
        });
      }

      // Continue with mediasoup production...
      if (this.sendTransport) {
        console.log('Proceeding to produce tracks via mediasoup');
      } else {
        console.error('Send transport not created yet!');
      }

      // Produce video
      if (this.localStream.getVideoTracks().length > 0 && this.sendTransport) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        const videoProducer = await this.sendTransport.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 100000 },
            { maxBitrate: 300000 },
            { maxBitrate: 900000 },
          ],
          codecOptions: {
            videoGoogleStartBitrate: 1000,
          },
        });

        this.producers.set('video', videoProducer);
      }

      // Produce audio
      if (this.localStream.getAudioTracks().length > 0 && this.sendTransport) {
        const audioTrack = this.localStream.getAudioTracks()[0];
        const audioProducer = await this.sendTransport.produce({
          track: audioTrack,
        });

        this.producers.set('audio', audioProducer);
      }
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  private async subscribeToProducer(
    producerId: string,
    userId: string
  ): Promise<void> {
    if (!this.device || !this.recvTransport) {
      throw new Error('Device or receive transport not ready');
    }

    console.log('Subscribing', producerId);

    this.signaling.send({
      type: 'consume',
      transportId: this.recvTransport.id,
      producerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });
  }

  private async handleConsumerCreated(
    message: SignalingMessage
  ): Promise<void> {
    if (!this.recvTransport) {
      throw new Error('Receive transport not ready');
    }

    const { id, producerId, kind, rtpParameters, userId } = message;

    const consumer = await this.recvTransport.consume({
      id,
      producerId,
      kind,
      rtpParameters,
    });

    this.consumers.set(id, consumer);

    // Create a new MediaStream with this consumer's track
    const stream = new MediaStream([consumer.track]);

    // Emit the new stream event
    this.emit('newStream', {
      userId,
      stream,
      kind,
    });

    // Resume the consumer
    this.signaling.send({
      type: 'resumeConsumer',
      consumerId: id,
    });
  }

  leaveCall(): void {
    if (this.roomId && this.userId) {
      this.signaling.send({
        type: 'leave',
        roomId: this.roomId,
        userId: this.userId,
      });
    }

    // Close all producers
    this.producers.forEach(producer => producer.close());
    this.producers.clear();

    // Close all consumers
    this.consumers.forEach(consumer => consumer.close());
    this.consumers.clear();

    // Close transports
    this.sendTransport?.close();
    this.sendTransport = null;

    this.recvTransport?.close();
    this.recvTransport = null;

    // Stop local stream tracks
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;

    // Close signaling connection
    this.signaling.close();

    this.emit('disconnected');
  }

  getSignalingReadyState(): number {
    // Return WebSocket.CONNECTING (0), WebSocket.OPEN (1),
    // WebSocket.CLOSING (2), or WebSocket.CLOSED (3)
    return this.signaling.getReadyState();
  }
}

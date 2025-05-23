import { makeAutoObservable, runInAction } from 'mobx';
import { Device } from 'mediasoup-client';
import { v4 as uuidv4 } from 'uuid';
import { MediasoupApi } from './api';
import type {
  Transport,
  Producer,
  Consumer,
  TransportOptions,
} from 'mediasoup-client/lib/types';
import type { RoomState } from '../types/types';

export class MediasoupStore {
  private socket: WebSocket | null = null;
  private api: MediasoupApi;
  private device: Device | null = null;
  private sendTransport: Transport | null = null;
  private receiveTransport: Transport | null = null;
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();

  state: RoomState = {
    roomId: null,
    peerId: null,
    isConnected: false,
    localStream: null,
    remoteStreams: new Map(),
    error: null,
  };

  constructor() {
    makeAutoObservable(this);
    this.api = new MediasoupApi();
  }

  async initializeWebSocket() {
    this.socket = new WebSocket('ws://localhost:3001'); // Используйте ваш URL

    this.socket.onmessage = async event => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'newProducer':
          await this.handleNewProducer(message);
          break;
        case 'producerClosed':
          this.handleProducerClosed(message.peerId);
          break;
      }
    };
  }

  private setupWebSocketListeners() {
    if (!this.socket) return;

    this.socket.onmessage = event => {
      const message = JSON.parse(event.data);
      console.log('WebSocket message received:', message);

      switch (message.type) {
        case 'newProducer':
          this.handleNewProducer(message);
          break;

        case 'producerClosed':
          this.handleProducerClosed(message);
          break;
      }
    };
  }

  private async handleNewProducer(message: any) {
    const { producerId, peerId, kind } = message;

    console.log('message', message);

    console.log(`New producer detected: ${producerId} from peer ${peerId}`);

    if (!this.state.remoteStreams.has(peerId)) {
      // Создаем новый MediaStream для этого пира
      const stream = new MediaStream();
      runInAction(() => {
        this.state.remoteStreams.set(peerId, stream);
      });
    }

    if (!this.device?.loaded) {
      // Получите routerRtpCapabilities с сервера, если еще не получили
      const routerRtpCapabilities = await this.api.getRtpCapabilities(
        this.state.roomId!
      );
      await this.device?.load({ routerRtpCapabilities });
    }

    // Получаем RTP-возможности для потребления
    const rtpCapabilities = this.device?.rtpCapabilities;
    if (!rtpCapabilities) return;

    try {
      // Создаем потребителя для этого продюсера
      const { consumerParameters } = await this.api.consume({
        roomId: this.state.roomId,
        peerId: this.state.peerId,
        producerId,
        rtpCapabilities,
      });

      // Создаем потребителя с полученными параметрами
      const consumer = await this.receiveTransport?.consume({
        id: consumerParameters.id,
        producerId,
        kind,
        rtpParameters: consumerParameters.rtpParameters,
      });

      // Добавляем трек в существующий стрим для этого пира
      const stream = this.state.remoteStreams.get(peerId);
      if (stream && consumer) {
        stream.addTrack(consumer.track);
      }

      // Возобновляем потребителя
      await this.api.resumeConsumer({
        roomId: this.state.roomId,
        peerId: this.state.peerId,
        consumerId: consumer?.id ?? null,
      });
    } catch (error) {
      console.error('Error consuming producer:', error);
    }
  }

  private handleProducerClosed(message: any) {
    const { peerId } = message;

    runInAction(() => {
      // Удаляем пира и его стрим
      this.state.remoteStreams.delete(peerId);
    });
  }

  async createRoom() {
    try {
      const roomId = await this.api.createRoom();
      runInAction(() => {
        this.state.roomId = roomId;
      });
      return roomId;
    } catch (error) {
      this.handleError('Failed to create room', error);
    }
  }

  async joinRoom(roomId: string) {
    try {
      const peerId = uuidv4();
      this.device = new Device();

      runInAction(() => {
        this.state.roomId = roomId;
        this.state.peerId = peerId;
      });

      await this.initializeWebSocket();
      this.setupWebSocketListeners();

      // Отправляем сообщение о присоединении через WebSocket
      if (this.socket) {
        this.socket.onopen = () =>
          this.socket?.send(
            JSON.stringify({
              type: 'join',
              roomId,
              peerId,
            })
          );
      }

      const { routerRtpCapabilities, transportOptions } =
        await this.api.joinRoom(roomId, peerId);
      await this.device?.load({ routerRtpCapabilities });

      if (!transportOptions) {
        throw new Error('Transport options are required');
      }

      await this.createSendTransport(transportOptions);
      await this.createReceiveTransport(transportOptions);

      runInAction(() => {
        this.state.isConnected = true;
      });

      await this.initializeLocalMedia();
    } catch (error) {
      this.handleError('Failed to join room', error);
    }
  }

  private async createSendTransport(transportOptions: TransportOptions) {
    if (!this.device) return;

    this.sendTransport = this.device.createSendTransport(transportOptions);

    this.sendTransport.on(
      'connect',
      async ({ dtlsParameters }, callback, errback) => {
        try {
          await this.api.connectTransport(
            this.state.roomId!,
            this.state.peerId!,
            dtlsParameters
          );
          callback();
        } catch (error) {
          errback(error as Error);
        }
      }
    );

    this.sendTransport.on(
      'produce',
      async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const { id } = await this.api.produce(
            this.state.roomId!,
            this.state.peerId!,
            kind,
            rtpParameters
          );

          if (!id) {
            throw new Error('id is required');
          }
          callback({ id });
        } catch (error) {
          errback(error as Error);
        }
      }
    );
  }

  private async createReceiveTransport(transportOptions: TransportOptions) {
    if (!this.device) return;

    this.receiveTransport = this.device.createRecvTransport(transportOptions);

    this.receiveTransport.on(
      'connect',
      async ({ dtlsParameters }, callback, errback) => {
        try {
          await this.api.connectTransport(
            this.state.roomId!,
            this.state.peerId!,
            dtlsParameters
          );
          callback();
        } catch (error) {
          errback(error as Error);
        }
      }
    );
  }

  async initializeLocalMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      runInAction(() => {
        this.state.localStream = stream;
      });

      await this.publishStream(stream);
    } catch (error) {
      this.handleError('Failed to initialize local media', error);
    }
  }

  async publishStream(stream: MediaStream) {
    if (!this.sendTransport) return;

    try {
      // Публикация видео
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
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

        // Оповещаем других участников о новом продюсере
        this.socket?.send(
          JSON.stringify({
            type: 'newProducer',
            producerId: videoProducer.id,
            kind: 'video',
            roomId: this.state.roomId,
            peerId: this.state.peerId,
          })
        );
      }

      // Публикация аудио
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const audioProducer = await this.sendTransport.produce({
          track: audioTrack,
        });
        this.producers.set('audio', audioProducer);

        // Оповещаем других участников о новом продюсере
        this.socket?.send(
          JSON.stringify({
            type: 'newProducer',
            producerId: audioProducer.id,
            kind: 'audio',
            roomId: this.state.roomId,
            peerId: this.state.peerId,
          })
        );
      }
    } catch (error) {
      this.handleError('Failed to publish stream', error);
    }
  }

  async stopLocalStream() {
    if (this.state.localStream) {
      this.state.localStream.getTracks().forEach(track => track.stop());
      runInAction(() => {
        this.state.localStream = null;
      });
    }

    this.producers.forEach(producer => producer.close());
    this.producers.clear();
  }

  async leaveRoom() {
    this.stopLocalStream();
    this.consumers.forEach(consumer => consumer.close());
    this.consumers.clear();

    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }

    if (this.receiveTransport) {
      this.receiveTransport.close();
      this.receiveTransport = null;
    }

    if (this.socket) {
      this.socket.send(
        JSON.stringify({
          type: 'leave',
          roomId: this.state.roomId,
          peerId: this.state.peerId,
        })
      );
      this.socket.close();
      this.socket = null;
    }

    runInAction(() => {
      this.state.roomId = null;
      this.state.peerId = null;
      this.state.isConnected = false;
      this.state.remoteStreams.clear();
    });
  }

  private handleError(message: string, error: any) {
    console.error(message, error);
    runInAction(() => {
      this.state.error = `${message}: ${error.message}`;
    });
    throw error;
  }
}

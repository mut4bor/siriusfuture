import * as WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { roomManager } from '../models/Room';
import { Producer, Consumer } from 'mediasoup/node/lib/types';

interface SignalingMessage {
  type: string;
  [key: string]: any;
}

export class SignalingServer {
  private clients: Map<string, WebSocket> = new Map();

  constructor(private wss: WebSocket.Server) {
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      // We'll assign an ID when they join a room
      let userId: string | null = null;
      let roomId: string | null = null;

      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message) as SignalingMessage;
          await this.handleMessage(data, ws, userId, roomId);

          // Update userId and roomId if they were set during handling
          if (data.type === 'join') {
            userId = data.userId;
            roomId = data.roomId;
            if (userId) {
              this.clients.set(userId, ws);
            }
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
          this.sendTo(ws, {
            type: 'error',
            error: (error as Error).message,
          });
        }
      });

      ws.on('close', () => {
        if (userId && roomId) {
          this.handleLeave(userId, roomId);
          this.clients.delete(userId);
        }
      });

      // Send welcome message
      this.sendTo(ws, { type: 'welcome' });
    });
  }

  private async handleMessage(
    message: SignalingMessage,
    ws: WebSocket,
    userId: string | null,
    roomId: string | null
  ): Promise<void> {
    switch (message.type) {
      case 'join':
        await this.handleJoin(message, ws);
        break;

      case 'createTransports':
        await this.handleCreateTransports(message, ws);
        break;

      case 'connectTransport':
        await this.handleConnectTransport(message, ws);
        break;

      case 'produce':
        await this.handleProduce(message, ws);
        break;

      case 'consume':
        await this.handleConsume(message, ws);
        break;

      case 'resumeConsumer':
        await this.handleResumeConsumer(message);
        break;

      case 'leave':
        if (userId && message.roomId) {
          this.handleLeave(userId, message.roomId);
        }
        break;

      default:
        console.warn(`Unhandled message type: ${message.type}`);
    }
  }

  private async handleJoin(
    message: SignalingMessage,
    ws: WebSocket
  ): Promise<void> {
    const { roomId, userId } = message;

    // Create or get the room
    const room = await roomManager.createRoom(roomId);

    // First, send info about all existing participants
    for (const peerId of room.peers.keys()) {
      if (peerId !== userId) {
        this.sendTo(ws, {
          type: 'participantJoined',
          userId: peerId,
        });
      }
    }

    // Then add the new peer to the room
    const peer = room.addPeer(userId);

    // Notify other peers about the new participant
    this.broadcastToRoom(roomId, userId, {
      type: 'participantJoined',
      userId,
    });

    // Send router RTP capabilities to the client
    this.sendTo(ws, {
      type: 'routerRtpCapabilities',
      routerRtpCapabilities: room.router!.rtpCapabilities,
    });

    // DON'T notify about existing producers here - move this to after transport creation!
  }

  private async handleCreateTransports(
    message: SignalingMessage,
    ws: WebSocket
  ): Promise<void> {
    const { roomId, userId } = message;

    const room = roomManager.getRoom(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    const producerIds = room.getProducerIds();
    for (const producerId of producerIds) {
      const producerPeer = room.getPeerForProducer(producerId);
      if (producerPeer && producerPeer.id !== userId) {
        this.sendTo(ws, {
          type: 'newProducer',
          producerId: producerId,
          userId: producerPeer.id,
        });
      }
    }

    // Create send transport
    const { params: sendTransportOptions } = await room.createWebRtcTransport(
      userId,
      'send'
    );
    this.sendTo(ws, {
      type: 'transportCreated',
      transportOptions: sendTransportOptions,
      direction: 'send',
    });

    // Create receive transport
    const { params: recvTransportOptions } = await room.createWebRtcTransport(
      userId,
      'recv'
    );
    this.sendTo(ws, {
      type: 'transportCreated',
      transportOptions: recvTransportOptions,
      direction: 'recv',
    });
  }

  private async handleConnectTransport(
    message: SignalingMessage,
    ws: WebSocket
  ): Promise<void> {
    const { transportId, dtlsParameters, direction } = message;

    // Find the peer that owns this transport
    let peer;
    let room;

    for (const r of Array.from(roomManager.getAllRooms().values())) {
      for (const p of r.peers.values()) {
        const transport = p.getTransport(transportId);
        if (transport) {
          peer = p;
          room = r;
          break;
        }
      }
      if (peer) break;
    }

    if (!peer || !room) throw new Error(`Transport ${transportId} not found`);

    const transport = peer.getTransport(transportId);
    if (!transport)
      throw new Error(`Transport ${transportId} not found for peer ${peer.id}`);

    await transport.connect({ dtlsParameters });
  }

  private async handleProduce(
    message: SignalingMessage,
    ws: WebSocket
  ): Promise<void> {
    console.log('Handling produce request:', message);
    const { transportId, kind, rtpParameters, appData } = message;

    try {
      // Find the peer and room
      let peer;
      let room;

      for (const r of roomManager.getAllRooms().values()) {
        for (const p of r.peers.values()) {
          const transport = p.getTransport(transportId);
          if (transport) {
            peer = p;
            room = r;
            break;
          }
        }
        if (peer) break;
      }

      if (!peer || !room) {
        console.error(`Transport ${transportId} not found for produce request`);
        this.sendTo(ws, {
          type: 'error',
          error: `Transport ${transportId} not found`,
        });
        return;
      }

      console.log(`Found transport ${transportId} for peer ${peer.id}`);

      const transport = peer.getTransport(transportId);
      if (!transport) {
        console.error(`Transport ${transportId} not found for peer ${peer.id}`);
        this.sendTo(ws, {
          type: 'error',
          error: `Transport ${transportId} not found for peer ${peer.id}`,
        });
        return;
      }

      // Create the producer
      console.log(`Creating ${kind} producer on transport ${transportId}`);
      const producer = await transport.produce({
        kind,
        rtpParameters,
        appData,
      });

      console.log(`Producer created: ${producer.id} (${kind})`);

      // Store the producer in the peer object
      peer.addProducer(producer);

      // IMMEDIATELY send the producer ID back to the client
      this.sendTo(ws, {
        type: 'producerCreated',
        id: producer.id,
        kind,
        requestId: message.requestId,
      });
      console.log(`Sent producerCreated message for ${producer.id} (${kind})`);

      // Notify all other peers in the room about the new producer
      this.broadcastToRoom(room.id, peer.id, {
        type: 'newProducer',
        producerId: producer.id,
        userId: peer.id,
      });
      console.log(
        `Broadcast newProducer message for ${producer.id} to room ${room.id}`
      );
    } catch (error) {
      console.error(`Error creating producer:`, error);
      this.sendTo(ws, {
        type: 'error',
        error: `Failed to create producer: ${(error as Error).message}`,
      });
    }
  }

  private async handleConsume(
    message: SignalingMessage,
    ws: WebSocket
  ): Promise<void> {
    const { transportId, producerId, rtpCapabilities } = message;

    // Find the peer that owns this transport
    let peer;
    let room;

    for (const r of roomManager.getAllRooms().values()) {
      for (const p of r.peers.values()) {
        const transport = p.getTransport(transportId);
        if (transport) {
          peer = p;
          room = r;
          break;
        }
      }
      if (peer) break;
    }

    if (!peer || !room) throw new Error(`Transport ${transportId} not found`);

    // Get the transport
    const transport = peer.getTransport(transportId);
    if (!transport)
      throw new Error(`Transport ${transportId} not found for peer ${peer.id}`);

    // Check if we can consume this producer
    try {
      if (!room.router!.canConsume({ producerId, rtpCapabilities })) {
        console.error(`Router cannot consume producer ${producerId}`, {
          routerRtpCapabilities: room.router!.rtpCapabilities,
          clientRtpCapabilities: rtpCapabilities,
        });
        this.sendTo(ws, {
          type: 'error',
          error: `Cannot consume producer ${producerId}`,
        });
        return;
      }
    } catch (error) {
      console.error(`Error in canConsume check:`, error);
      this.sendTo(ws, {
        type: 'error',
        error: `Error checking if can consume: ${(error as Error).message}`,
      });
      return;
    }

    try {
      // Create the consumer with appropriate error handling
      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: false, // Start paused and resume after client confirms
      });

      console.log(
        `Consumer created: ${consumer.id} for producer ${producerId} (${consumer.kind})`
      );

      // Store the consumer in the peer object
      peer.addConsumer(consumer);

      // Make sure we find the producer owner
      let producerOwner = null;
      for (const p of room.peers.values()) {
        if (p.producers.has(producerId)) {
          producerOwner = p;
          break;
        }
      }

      if (!producerOwner) {
        console.error(`Producer ${producerId} owner not found`);
        throw new Error(`Producer ${producerId} not found`);
      }

      console.log(
        `Producer ${producerId} is owned by peer ${producerOwner.id}`
      );

      // Send the consumer parameters to the client
      this.sendTo(ws, {
        type: 'consumerCreated',
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        userId: producerOwner.id,
      });
    } catch (error) {
      console.error(`Error creating consumer:`, error);
      this.sendTo(ws, {
        type: 'error',
        error: `Failed to create consumer: ${(error as Error).message}`,
      });
    }
  }

  private async handleResumeConsumer(message: SignalingMessage): Promise<void> {
    const { consumerId } = message;
    console.log(`Resume consumer request for consumer ${consumerId}`);

    // Find the peer that owns this consumer
    let peer;
    let room;

    for (const r of roomManager.getAllRooms().values()) {
      for (const p of r.peers.values()) {
        if (p.consumers.has(consumerId)) {
          peer = p;
          room = r;
          break;
        }
      }
      if (peer) break;
    }

    if (!peer) {
      console.error(`Consumer ${consumerId} not found for resume`);
      throw new Error(`Consumer ${consumerId} not found`);
    }

    console.log(`Found consumer ${consumerId} owned by peer ${peer.id}`);

    const consumer = peer.getConsumer(consumerId);
    if (!consumer) {
      console.error(`Consumer ${consumerId} not found in peer ${peer.id}`);
      throw new Error(`Consumer ${consumerId} not found for peer ${peer.id}`);
    }

    console.log(`Resuming consumer ${consumerId}`);
    try {
      await consumer.resume();
      console.log(`Consumer ${consumerId} resumed successfully`);
    } catch (error) {
      console.error(`Error resuming consumer ${consumerId}:`, error);
      throw error;
    }
  }

  private handleLeave(userId: string, roomId: string): void {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    // Remove the peer from the room
    room.removePeer(userId);

    // Notify all other peers about the participant leaving
    this.broadcastToRoom(roomId, userId, {
      type: 'participantLeft',
      userId,
    });

    // If the room is empty, remove it
    if (room.peers.size === 0) {
      roomManager.removeRoom(roomId);
    }
  }

  private sendTo(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcastToRoom(
    roomId: string,
    senderId: string,
    message: any
  ): void {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    for (const peerId of room.peers.keys()) {
      if (peerId !== senderId) {
        const ws = this.clients.get(peerId);
        if (ws) {
          this.sendTo(ws, message);
        }
      }
    }
  }
}

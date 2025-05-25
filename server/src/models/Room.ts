import { Producer, Router } from 'mediasoup/node/lib/types';
import { workerManager } from '../lib/Worker';
import { config } from '../config/mediasoup';
import { Peer } from './Peer';

export class Room {
  id: string;
  router?: Router;
  peers: Map<string, Peer> = new Map();

  constructor(id: string) {
    this.id = id;
  }

  async init(): Promise<void> {
    const worker = workerManager.getWorker();
    this.router = await worker.createRouter({
      mediaCodecs: config.router.mediaCodecs,
    });
  }

  addPeer(peerId: string): Peer {
    const peer = new Peer(peerId);
    this.peers.set(peerId, peer);
    return peer;
  }

  getPeer(peerId: string): Peer | undefined {
    return this.peers.get(peerId);
  }

  removePeer(peerId: string): void {
    const peer = this.getPeer(peerId);
    if (peer) {
      peer.close();
      this.peers.delete(peerId);
    }
  }

  getProducerIds(): string[] {
    const producerIds: string[] = [];
    for (const peer of this.peers.values()) {
      for (const producer of peer.producers.values()) {
        producerIds.push(producer.id);
      }
    }
    return producerIds;
  }

  async createWebRtcTransport(
    peerId: string,
    direction: 'send' | 'recv'
  ): Promise<{
    transport: any;
    params: any;
  }> {
    if (!this.router) throw new Error('Router not initialized');

    const transport = await this.router.createWebRtcTransport(
      config.webRtcTransport
    );

    // Store the transport in the peer object
    const peer = this.getPeer(peerId);
    if (!peer) throw new Error(`Peer with id ${peerId} not found`);

    peer.addTransport(transport);

    return {
      transport,
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        direction,
      },
    };
  }

  getPeerForProducer(producerId: string): Peer | undefined {
    for (const peer of this.peers.values()) {
      if (peer.producers.has(producerId)) {
        return peer;
      }
    }
    return undefined;
  }

  getAllProducers(): { producerId: string; peerId: string }[] {
    const producers: { producerId: string; peerId: string }[] = [];

    for (const [peerId, peer] of this.peers.entries()) {
      for (const [producerId] of peer.producers.entries()) {
        producers.push({
          producerId,
          peerId,
        });
      }
    }

    return producers;
  }

  close(): void {
    this.peers.forEach(peer => peer.close());
    this.peers.clear();
    this.router?.close();
  }
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  async createRoom(roomId: string): Promise<Room> {
    if (this.rooms.has(roomId)) {
      return this.getRoom(roomId)!;
    }

    const room = new Room(roomId);
    await room.init();
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getAllRooms(): Map<string, Room> {
    return this.rooms;
  }

  removeRoom(roomId: string): void {
    const room = this.getRoom(roomId);
    if (room) {
      room.close();
      this.rooms.delete(roomId);
    }
  }
}

export const roomManager = new RoomManager();

import {
  Producer,
  Consumer,
  Transport,
  WebRtcTransport,
} from 'mediasoup/node/lib/types';

export class Peer {
  id: string;
  transports: Map<string, Transport> = new Map();
  producers: Map<string, Producer> = new Map();
  consumers: Map<string, Consumer> = new Map();
  rtpCapabilities?: any;

  constructor(id: string) {
    this.id = id;
  }

  addTransport(transport: Transport): void {
    this.transports.set(transport.id, transport);
  }

  getTransport(transportId: string): Transport | undefined {
    return this.transports.get(transportId);
  }

  addProducer(producer: Producer): void {
    this.producers.set(producer.id, producer);
  }

  getProducer(producerId: string): Producer | undefined {
    return this.producers.get(producerId);
  }

  addConsumer(consumer: Consumer): void {
    this.consumers.set(consumer.id, consumer);
  }

  getConsumer(consumerId: string): Consumer | undefined {
    return this.consumers.get(consumerId);
  }

  // Close all transports, producers, and consumers for this peer
  close(): void {
    for (const transport of this.transports.values()) {
      transport.close();
    }
    this.transports.clear();
    this.producers.clear();
    this.consumers.clear();
  }
}

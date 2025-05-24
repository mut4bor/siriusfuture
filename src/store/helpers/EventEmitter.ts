import { MediaKind } from 'mediasoup-client/lib/types';

export type EventMap = {
  connected: [];
  disconnected: [];
  newParticipant: [{ userId: string }];
  participantLeft: [{ userId: string }];
  newStream: [{ userId: string; stream: MediaStream; kind: MediaKind }];
  error: [Error];
};

export class TypedEventEmitter<T extends Record<string, any[]>> {
  private listeners: { [K in keyof T]?: ((...args: T[K]) => void)[] } = {};

  on<K extends keyof T>(
    event: K,
    listener: (...args: T[K]) => void
  ): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);

    return () => {
      this.off(event, listener);
    };
  }

  off<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event]!.filter(l => l !== listener);
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    if (!this.listeners[event]) return;
    this.listeners[event]!.forEach(listener => {
      listener(...args);
    });
  }
}

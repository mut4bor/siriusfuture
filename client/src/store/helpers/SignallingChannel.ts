import { TypedEventEmitter } from './EventEmitter';

export interface SignalingMessage {
  type: string;
  [key: string]: any;
}

export class SignalingChannel {
  private socket: WebSocket | null = null;
  private eventEmitter = new TypedEventEmitter<{
    message: [SignalingMessage];
    open: [];
    close: [];
    error: [Event];
  }>();
  private messageQueue: SignalingMessage[] = [];

  constructor(private url: string) {}

  getReadyState(): number {
    return this.socket ? this.socket.readyState : WebSocket.CLOSED;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Connecting to WebSocket server...');
      this.socket = new WebSocket(this.url);

      // Add timeout for connection
      const connectionTimeout = setTimeout(() => {
        console.error('Connection timeout');
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      this.socket.addEventListener('open', () => {
        console.log('WebSocket connection opened');
        clearTimeout(connectionTimeout);
        this.eventEmitter.emit('open');
        // Отправляем все сообщения из очереди
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          if (msg) this.send(msg);
        }
        resolve();
      });

      this.socket.addEventListener('close', () => {
        this.eventEmitter.emit('close');
      });

      this.socket.addEventListener('error', event => {
        this.eventEmitter.emit('error', event);
        reject(new Error('WebSocket connection failed'));
      });

      this.socket.addEventListener('message', event => {
        try {
          const message: SignalingMessage = JSON.parse(event.data);
          console.log('socketmessage', message);
          this.eventEmitter.emit('message', message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });
    });
  }

  send(message: SignalingMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('Sent message');
      this.socket.send(JSON.stringify(message));
    } else {
      // Кладём в очередь, если сокет не готов
      this.messageQueue.push(message);

      console.log('Put message to queue');
    }
  }

  on<K extends 'message' | 'open' | 'close' | 'error'>(
    event: K,
    listener: K extends 'message'
      ? (message: SignalingMessage) => void
      : K extends 'error'
        ? (event: Event) => void
        : () => void
  ): () => void {
    return this.eventEmitter.on(event, listener as any);
  }

  close(): void {
    this.socket?.close();
  }
}

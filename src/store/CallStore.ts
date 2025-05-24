import {
  VideoCallClient,
  VideoCallClientOptions,
} from '@/store/helpers/VideoCallClient';
import { makeAutoObservable, observable, runInAction } from 'mobx';

interface Participant {
  userId: string;
  videoStream?: MediaStream;
  audioStream?: MediaStream;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
}

enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export class CallStore {
  videoCallClient: VideoCallClient | null = null;
  participants = observable.map<string, Participant>();
  connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  error: Error | null = null;
  localParticipantId: string | null = null;

  constructor() {
    makeAutoObservable(this, {
      videoCallClient: false, // Don't make the client observable
    });
  }

  isConnected(): boolean {
    return this.videoCallClient
      ? this.videoCallClient.getSignalingReadyState() === WebSocket.OPEN
      : false;
  }

  initialize(options: VideoCallClientOptions) {
    this.videoCallClient = new VideoCallClient(options);
    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.videoCallClient) return;

    this.videoCallClient.on('connected', () => {
      runInAction(() => {
        this.connectionState = ConnectionState.CONNECTED;
      });
    });

    this.videoCallClient.on('disconnected', () => {
      runInAction(() => {
        this.connectionState = ConnectionState.DISCONNECTED;
      });
    });

    this.videoCallClient.on('newParticipant', ({ userId }) => {
      this.addParticipant(userId);
    });

    this.videoCallClient.on('participantLeft', ({ userId }) => {
      this.removeParticipant(userId);
    });

    this.videoCallClient.on('newStream', ({ userId, stream, kind }) => {
      this.updateParticipantStream(userId, stream, kind);
    });

    this.videoCallClient.on('error', error => {
      runInAction(() => {
        this.connectionState = ConnectionState.ERROR;
        this.error = error;
      });
    });
  }

  async joinCall(roomId: string, userId: string) {
    if (!this.videoCallClient) {
      throw new Error('VideoCallClient not initialized');
    }

    runInAction(() => {
      this.connectionState = ConnectionState.CONNECTING;
      this.localParticipantId = userId;
      this.addParticipant(userId);
    });

    try {
      await this.videoCallClient.joinCall(roomId, userId);
    } catch (error) {
      runInAction(() => {
        this.connectionState = ConnectionState.ERROR;
        this.error = error as Error;
      });
    }
  }

  leaveCall() {
    this.videoCallClient?.leaveCall();
    runInAction(() => {
      this.participants.clear();
      this.localParticipantId = null;
    });
  }

  private addParticipant(userId: string) {
    if (!this.participants.has(userId)) {
      this.participants.set(userId, {
        userId,
        isVideoEnabled: false,
        isAudioEnabled: false,
      });
    }
  }

  private removeParticipant(userId: string) {
    this.participants.delete(userId);
  }

  private updateParticipantStream(
    userId: string,
    stream: MediaStream,
    kind: 'video' | 'audio'
  ) {
    runInAction(() => {
      const participant = this.participants.get(userId);

      if (participant) {
        const updatedParticipant = { ...participant };

        if (kind === 'video') {
          updatedParticipant.videoStream = stream;
          updatedParticipant.isVideoEnabled = true;
        } else if (kind === 'audio') {
          updatedParticipant.audioStream = stream;
          updatedParticipant.isAudioEnabled = true;
        }

        this.participants.set(userId, updatedParticipant);
      }
    });
  }

  get localParticipant(): Participant | undefined {
    return this.localParticipantId
      ? this.participants.get(this.localParticipantId)
      : undefined;
  }

  get remoteParticipants(): Participant[] {
    return Array.from(this.participants.values()).filter(
      p => p.userId !== this.localParticipantId
    );
  }
}

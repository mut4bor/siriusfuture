import {
  RtpCodecParameters,
  RtpHeaderExtensionParameters,
  RtpEncodingParameters,
  RtcpParameters,
} from 'mediasoup-client/lib/RtpParameters';

export interface RoomState {
  roomId: string | null;
  peerId: string | null;
  isConnected: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  error: string | null;
}

export interface TransportOptions {
  id: string;
  iceParameters: any;
  iceCandidates: any;
  dtlsParameters: any;
}

export interface RtpParameters {
  codecs: RtpCodecParameters[];
  headerExtensions: RtpHeaderExtensionParameters[];
  encodings: RtpEncodingParameters[];
  rtcp: RtcpParameters;
}

export interface ConsumerResponse {
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: RtpParameters;
}

export interface ApiResponse {
  roomId?: string;
  routerRtpCapabilities?: any;
  transportOptions?: TransportOptions;
  id?: string;
  success?: boolean;
  error?: string;
  producerId?: string;
  kind?: 'audio' | 'video';
  rtpParameters?: RtpParameters;
}

import * as os from 'os';
import {
  WorkerSettings,
  RouterOptions,
  WebRtcTransportOptions,
  WorkerLogLevel,
} from 'mediasoup/node/lib/types';

export const config = {
  // Mediasoup worker settings
  worker: {
    rtcMinPort: Number(process.env.MEDIASOUP_MIN_PORT) || 40000,
    rtcMaxPort: Number(process.env.MEDIASOUP_MAX_PORT) || 49999,
    logLevel: 'warn' as WorkerLogLevel,
    logTags: [
      'info',
      'ice',
      'dtls',
      'rtp',
      'srtp',
      'rtcp',
      'rtx',
      'bwe',
      'score',
      'simulcast',
      'svc',
      'sctp',
    ] as WorkerSettings['logTags'],
    numWorkers: Number(process.env.MEDIASOUP_WORKER_NUM) || os.cpus().length,
  },

  // Mediasoup router settings
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
    ] as RouterOptions['mediaCodecs'],
  },

  // WebRTC transport settings
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
      },
    ],
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
    maxIncomingBitrate: 1500000,
  } as WebRtcTransportOptions,
};

import axios from 'axios';
import { ApiResponse } from '@/types/types';

const BASE_URL = 'http://localhost:3001';

export class MediasoupApi {
  async createRoom(): Promise<string> {
    const { data } = await axios.post<ApiResponse>(`${BASE_URL}/create-room`);
    return data.roomId!;
  }

  async getRtpCapabilities(roomId: string) {
    const { data } = await axios.get(
      `${BASE_URL}/rooms/${roomId}/rtpCapabilities`
    );
    return data;
  }

  async joinRoom(roomId: string, peerId: string) {
    const { data } = await axios.post<ApiResponse>(`${BASE_URL}/join-room`, {
      roomId,
      peerId,
    });
    return data;
  }

  async connectTransport(roomId: string, peerId: string, dtlsParameters: any) {
    const { data } = await axios.post<ApiResponse>(
      `${BASE_URL}/connect-transport`,
      {
        roomId,
        peerId,
        dtlsParameters,
      }
    );
    return data;
  }

  async produce(
    roomId: string,
    peerId: string,
    kind: string,
    rtpParameters: any
  ) {
    const { data } = await axios.post<ApiResponse>(`${BASE_URL}/produce`, {
      roomId,
      peerId,
      kind,
      rtpParameters,
    });
    return data;
  }

  // В классе, где вы реализуете API
  async consume({
    roomId,
    peerId,
    producerId,
    rtpCapabilities,
  }: {
    roomId: string | null;
    peerId: string | null;
    producerId: string | null;
    rtpCapabilities: any;
  }) {
    const response = await axios.post(`${BASE_URL}/consume`, {
      roomId,
      peerId,
      producerId,
      rtpCapabilities,
    });
    return response.data;
  }

  async resumeConsumer({
    roomId,
    peerId,
    consumerId,
  }: {
    roomId: string | null;
    peerId: string | null;
    consumerId: string | null;
  }) {
    const response = await axios.post(`${BASE_URL}/resume-consumer`, {
      roomId,
      peerId,
      consumerId,
    });
    return response.data;
  }
}

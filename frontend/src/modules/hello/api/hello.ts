import { apiClient, parseApiResponse } from '../../../api/client';

export interface HelloPayload {
  message: string;
  server_time: number;
}

export const getHello = () => parseApiResponse<HelloPayload>(apiClient.get('/api/hello'));

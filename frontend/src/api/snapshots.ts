import { apiClient, parseApiResponse } from './client';
import type { ApiResponse, DailySnapshot, DateString } from '../types';

export async function listSnapshots(params?: {
  from?: DateString;
  to?: DateString;
}): Promise<ApiResponse<DailySnapshot[]>> {
  return parseApiResponse<DailySnapshot[]>(apiClient.get('/api/snapshots', { params }));
}

export async function getSnapshot(date: DateString): Promise<ApiResponse<DailySnapshot>> {
  return parseApiResponse<DailySnapshot>(apiClient.get(`/api/snapshots/${date}`));
}

export async function buildSnapshot(body: { date: DateString }): Promise<ApiResponse<DailySnapshot>> {
  return parseApiResponse<DailySnapshot>(apiClient.post('/api/snapshots/build', body));
}

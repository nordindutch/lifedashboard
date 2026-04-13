import { apiClient, parseApiResponse } from './client';
import type { ApiResponse, DiaryLog, LogType } from '../types';

export async function listDiaryLogs(params?: {
  date?: string;
  project_id?: number;
  task_id?: number;
  log_type?: LogType;
  page?: number;
}): Promise<ApiResponse<DiaryLog[]>> {
  return parseApiResponse<DiaryLog[]>(apiClient.get('/api/diary', { params }));
}

export async function createDiaryLog(
  body: Partial<DiaryLog> & { body: string },
): Promise<ApiResponse<DiaryLog>> {
  return parseApiResponse<DiaryLog>(apiClient.post('/api/diary', body));
}

export async function updateDiaryLog(id: number, body: Partial<DiaryLog>): Promise<ApiResponse<DiaryLog>> {
  return parseApiResponse<DiaryLog>(apiClient.put(`/api/diary/${id}`, body));
}

export async function deleteDiaryLog(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  return parseApiResponse<{ deleted: boolean }>(apiClient.delete(`/api/diary/${id}`));
}

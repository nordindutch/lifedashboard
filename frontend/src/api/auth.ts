import { apiClient, parseApiResponse } from './client';
import type { ApiResponse } from '../types';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  avatar_url: string | null;
}

export async function getMe(): Promise<ApiResponse<AuthUser>> {
  return parseApiResponse(apiClient.get('/api/auth/me'));
}

export async function logout(): Promise<ApiResponse<{ logged_out: boolean }>> {
  return parseApiResponse(apiClient.post('/api/auth/logout', {}));
}

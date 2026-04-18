import { apiClient, parseApiResponse } from './client';
import type { ApiResponse } from '../types';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  avatar_url: string | null;
}

export interface AuthBootstrap {
  needs_setup: boolean;
}

export async function getBootstrap(): Promise<ApiResponse<AuthBootstrap>> {
  return parseApiResponse(apiClient.get('/api/auth/bootstrap'));
}

export async function getMe(): Promise<ApiResponse<AuthUser>> {
  return parseApiResponse(apiClient.get('/api/auth/me'));
}

export async function login(body: {
  email: string;
  password: string;
}): Promise<ApiResponse<{ user: AuthUser; token: string; expires_at: number }>> {
  return parseApiResponse(apiClient.post('/api/auth/login', body));
}

export async function setupAccount(body: {
  email: string;
  name: string;
  password: string;
}): Promise<ApiResponse<{ user: AuthUser; token: string; expires_at: number }>> {
  return parseApiResponse(apiClient.post('/api/auth/setup', body));
}

export async function logout(): Promise<ApiResponse<{ logged_out: boolean }>> {
  return parseApiResponse(apiClient.post('/api/auth/logout', {}));
}

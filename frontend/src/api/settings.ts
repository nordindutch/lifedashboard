import { apiClient, parseApiResponse } from './client';
import type { ApiResponse, AppSettings } from '../types';

export async function getSettings(): Promise<ApiResponse<AppSettings>> {
  return parseApiResponse<AppSettings>(apiClient.get('/api/settings'));
}

export async function updateSettings(
  body: Partial<AppSettings>,
): Promise<ApiResponse<AppSettings>> {
  return parseApiResponse<AppSettings>(apiClient.put('/api/settings', body));
}

export async function getGoogleAuth(): Promise<void> {
  window.location.href = '/api/auth/google';
}

export async function revokeGoogle(): Promise<ApiResponse<{ revoked: boolean }>> {
  return parseApiResponse<{ revoked: boolean }>(apiClient.delete('/api/auth/google'));
}

export async function getIntegrationStatus(): Promise<
  ApiResponse<{ google: boolean; openweather: boolean }>
> {
  return parseApiResponse<{ google: boolean; openweather: boolean }>(
    apiClient.get('/api/integrations/status'),
  );
}

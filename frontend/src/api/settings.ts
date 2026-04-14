import { apiClient, parseApiResponse } from './client';
import type { ApiResponse, AppSettings } from '../types';

export async function getSettings(): Promise<ApiResponse<AppSettings>> {
  return parseApiResponse(apiClient.get('/api/settings'));
}

export async function updateSettings(
  patch: Partial<AppSettings>,
): Promise<ApiResponse<AppSettings>> {
  return parseApiResponse(apiClient.put('/api/settings', patch));
}

export async function testWeather(): Promise<ApiResponse<import('../types').WeatherData>> {
  return parseApiResponse(apiClient.get('/api/settings/weather-test'));
}

export function getGoogleAuth(): void {
  const redirectUri = `${window.location.origin}/api/auth/google/callback`;
  window.location.href = `/api/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export async function revokeGoogle(): Promise<ApiResponse<{ revoked: boolean }>> {
  return parseApiResponse(apiClient.delete('/api/auth/google'));
}

export async function syncCalendar(): Promise<ApiResponse<{ synced: boolean; events: number }>> {
  return parseApiResponse(apiClient.post('/api/calendar/sync', {}));
}

export async function getIntegrationStatus(): Promise<ApiResponse<{ google: boolean; openweather: boolean }>> {
  return parseApiResponse(apiClient.get('/api/integrations/status'));
}

import { apiClient, parseApiResponse } from './client';
import type { ApiResponse, AppSettings } from '../types';

const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').trim();

function apiPublicOrigin(): string {
  if (API_BASE !== '') {
    return API_BASE.replace(/\/$/, '');
  }
  return typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '';
}

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

/** Google OAuth for Calendar/Gmail sync only — requires an active session. */
export async function getGoogleOAuthUrl(): Promise<ApiResponse<{ url: string }>> {
  const origin = apiPublicOrigin();
  const redirectUri = `${origin}/api/auth/google/callback`;
  return parseApiResponse(
    apiClient.get('/api/integrations/google/oauth-url', {
      params: { redirect_uri: redirectUri },
    }),
  );
}

export async function revokeGoogle(): Promise<ApiResponse<{ revoked: boolean }>> {
  return parseApiResponse(apiClient.delete('/api/auth/google'));
}

export async function syncCalendar(): Promise<ApiResponse<{ synced: boolean; events: number }>> {
  return parseApiResponse(apiClient.post('/api/calendar/sync', {}));
}

export async function syncGmail(): Promise<ApiResponse<{ synced: boolean; emails: number }>> {
  return parseApiResponse(apiClient.post('/api/gmail/sync', {}));
}

export async function getIntegrationStatus(): Promise<ApiResponse<{ google: boolean; openweather: boolean }>> {
  return parseApiResponse(apiClient.get('/api/integrations/status'));
}

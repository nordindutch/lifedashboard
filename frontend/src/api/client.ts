import axios, { type AxiosError } from 'axios';
import type { ApiError, ApiResponse } from '../types';

// For Tauri production builds, set VITE_API_BASE_URL=http://localhost:8180
// (or wherever the PHP backend is hosted) in your .env file.
// In dev mode (cargo tauri dev), the Vite proxy handles /api → PHP.
const baseURL =
  import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.length > 0
    ? import.meta.env.VITE_API_BASE_URL
    : '';

export const apiClient = axios.create({
  baseURL,
  /** Envelope-style API: read `success` + error body on 4xx without throwing */
  validateStatus: () => true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const key = import.meta.env.VITE_CODEX_API_KEY;
  if (key && key.length > 0) {
    config.headers['X-Codex-Key'] = key;
  }
  return config;
});

export function unwrapApiError(err: unknown): ApiError['error'] {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<ApiError>;
    const data = ax.response?.data;
    if (data && data.success === false && data.error) {
      return data.error;
    }
  }
  return { code: 'unknown', message: err instanceof Error ? err.message : 'Request failed' };
}

export async function parseApiResponse<T>(promise: Promise<{ data: unknown }>): Promise<ApiResponse<T>> {
  try {
    const { data } = await promise;
    if (data && typeof data === 'object' && 'success' in data) {
      return data as ApiResponse<T>;
    }
    return { success: false, error: { code: 'invalid_response', message: 'Invalid API response' } };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Request failed';
    return { success: false, error: { code: 'network_error', message } };
  }
}

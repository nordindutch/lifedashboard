import { apiClient, parseApiResponse } from './client';

export interface VersionPayload {
  version: string;
  build: string | null;
  android: { version: string; version_code: number; download_url: string | null; release_url: string | null };
  desktop: { version: string; latest_json_url: string | null; release_url: string | null };
}

export const getServerVersion = () => parseApiResponse<VersionPayload>(apiClient.get('/api/version'));

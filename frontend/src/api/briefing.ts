import { apiClient, parseApiResponse } from './client';
import type { ApiResponse, DailyBriefing } from '../types';

export async function getBriefing(date?: string): Promise<ApiResponse<DailyBriefing>> {
  return parseApiResponse<DailyBriefing>(apiClient.get('/api/briefing', { params: date ? { date } : {} }));
}

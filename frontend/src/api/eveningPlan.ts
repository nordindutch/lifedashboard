import { apiClient, parseApiResponse } from './client';
import type { AIPlan, ApiResponse, DateString } from '../types';

export interface EveningPlanPayload {
  date: DateString;
  evening_plan: AIPlan | null;
}

export async function getEveningPlan(date: string, force = false): Promise<ApiResponse<EveningPlanPayload>> {
  return parseApiResponse<EveningPlanPayload>(
    apiClient.get('/api/evening-plan', { params: { date, ...(force ? { force: '1' } : {}) } }),
  );
}

import { apiClient, parseApiResponse } from './client';
import type { AIPlan, ApiResponse, PlanType } from '../types';

export async function getAiPlan(params?: {
  date?: string;
  type?: 'morning' | 'evening';
}): Promise<ApiResponse<AIPlan | null>> {
  return parseApiResponse<AIPlan | null>(apiClient.get('/api/ai/plan', { params }));
}

export async function generateAiPlan(body: {
  plan_type: PlanType;
  plan_date?: string;
  include_task_ids?: number[];
  force_regenerate?: boolean;
  end_time?: string;
}): Promise<ApiResponse<AIPlan>> {
  return parseApiResponse<AIPlan>(apiClient.post('/api/ai/plan/generate', body));
}

export async function listAiHistory(params?: {
  page?: number;
  per_page?: number;
}): Promise<ApiResponse<AIPlan[]>> {
  return parseApiResponse<AIPlan[]>(apiClient.get('/api/ai/history', { params }));
}

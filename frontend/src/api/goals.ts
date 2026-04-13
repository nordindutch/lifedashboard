import { apiClient, parseApiResponse } from './client';
import type { ApiResponse, Goal, GoalWithRelations } from '../types';

export async function listGoals(): Promise<ApiResponse<Goal[]>> {
  return parseApiResponse<Goal[]>(apiClient.get('/api/goals'));
}

export async function getGoal(id: number): Promise<ApiResponse<GoalWithRelations>> {
  return parseApiResponse<GoalWithRelations>(apiClient.get(`/api/goals/${id}`));
}

export async function createGoal(
  body: Partial<Pick<Goal, 'title' | 'description' | 'color' | 'icon' | 'status' | 'target_date' | 'completed_at'>> & {
    title: string;
  },
): Promise<ApiResponse<Goal>> {
  return parseApiResponse<Goal>(apiClient.post('/api/goals', body));
}

export async function updateGoal(
  id: number,
  body: Partial<
    Pick<Goal, 'title' | 'description' | 'color' | 'icon' | 'status' | 'target_date' | 'completed_at'>
  >,
): Promise<ApiResponse<Goal>> {
  return parseApiResponse<Goal>(apiClient.put(`/api/goals/${id}`, body));
}

export async function deleteGoal(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  return parseApiResponse<{ deleted: boolean }>(apiClient.delete(`/api/goals/${id}`));
}

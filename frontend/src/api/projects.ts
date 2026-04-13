import { apiClient, parseApiResponse } from './client';
import type { ApiResponse, Project, ProjectWithRelations } from '../types';

export async function listProjects(params?: {
  goal_id?: number;
  status?: string;
}): Promise<ApiResponse<Project[]>> {
  return parseApiResponse<Project[]>(apiClient.get('/api/projects', { params }));
}

export async function getProject(id: number): Promise<ApiResponse<ProjectWithRelations>> {
  return parseApiResponse<ProjectWithRelations>(apiClient.get(`/api/projects/${id}`));
}

export async function createProject(
  body: Partial<Project> & { title: string },
): Promise<ApiResponse<Project>> {
  return parseApiResponse<Project>(apiClient.post('/api/projects', body));
}

export async function updateProject(id: number, body: Partial<Project>): Promise<ApiResponse<Project>> {
  return parseApiResponse<Project>(apiClient.put(`/api/projects/${id}`, body));
}

export async function deleteProject(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  return parseApiResponse<{ deleted: boolean }>(apiClient.delete(`/api/projects/${id}`));
}

import { apiClient, parseApiResponse } from './client';
import type { ApiResponse, Task, TaskStatus, TaskWithRelations } from '../types';

export async function listTasks(params?: {
  project_id?: number;
  goal_id?: number;
  status?: TaskStatus;
  due_before?: number;
  due_after?: number;
  page?: number;
  per_page?: number;
}): Promise<ApiResponse<Task[]>> {
  return parseApiResponse<Task[]>(apiClient.get('/api/tasks', { params }));
}

export async function getTask(id: number): Promise<ApiResponse<TaskWithRelations>> {
  return parseApiResponse<TaskWithRelations>(apiClient.get(`/api/tasks/${id}`));
}

export async function createTask(body: Partial<Task> & { title: string }): Promise<ApiResponse<Task>> {
  return parseApiResponse<Task>(apiClient.post('/api/tasks', body));
}

export async function updateTask(id: number, body: Partial<Task>): Promise<ApiResponse<Task>> {
  return parseApiResponse<Task>(apiClient.put(`/api/tasks/${id}`, body));
}

export async function deleteTask(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  return parseApiResponse<{ deleted: boolean }>(apiClient.delete(`/api/tasks/${id}`));
}

export async function reorderTasks(
  moves: { task_id: number; new_status: TaskStatus; new_display_order: number }[],
): Promise<ApiResponse<{ ok: boolean }>> {
  return parseApiResponse<{ ok: boolean }>(apiClient.patch('/api/tasks/reorder', { moves }));
}

export async function patchTaskCanvas(
  id: number,
  body: {
    canvas_x: number;
    canvas_y: number;
    canvas_width: number;
    canvas_color: string;
    canvas_pinned: boolean;
  },
): Promise<ApiResponse<Task>> {
  return parseApiResponse<Task>(apiClient.patch(`/api/tasks/${id}/canvas`, body));
}

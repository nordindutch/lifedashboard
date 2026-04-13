import { apiClient, parseApiResponse } from './client';
import type { ApiResponse, Note } from '../types';

export async function listNotes(params?: {
  task_id?: number;
  project_id?: number;
  goal_id?: number;
  canvas_only?: boolean | string;
}): Promise<ApiResponse<Note[]>> {
  return parseApiResponse<Note[]>(apiClient.get('/api/notes', { params }));
}

export async function createNote(body: Partial<Note> & { body: string }): Promise<ApiResponse<Note>> {
  return parseApiResponse<Note>(apiClient.post('/api/notes', body));
}

export async function updateNote(id: number, body: Partial<Note>): Promise<ApiResponse<Note>> {
  return parseApiResponse<Note>(apiClient.put(`/api/notes/${id}`, body));
}

export async function deleteNote(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  return parseApiResponse<{ deleted: boolean }>(apiClient.delete(`/api/notes/${id}`));
}

export async function patchNoteCanvas(
  id: number,
  body: {
    canvas_x: number;
    canvas_y: number;
    canvas_z_index: number;
    canvas_pinned: boolean;
  },
): Promise<ApiResponse<Note>> {
  return parseApiResponse<Note>(apiClient.patch(`/api/notes/${id}/canvas`, body));
}

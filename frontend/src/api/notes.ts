import { apiClient, parseApiResponse } from './client';
import type { Note } from '../types';

export interface NoteFilters {
  project_id?: number;
  task_id?: number;
  goal_id?: number;
  label_id?: number;
  search?: string;
  is_pinned?: boolean;
  page?: number;
  per_page?: number;
}

export interface NoteListResponse {
  items: Note[];
  total: number;
  page: number;
  per_page: number;
}

export interface NoteBody {
  title?: string | null;
  body?: string;
  body_format?: 'html' | 'markdown' | 'plain';
  project_id?: number | null;
  task_id?: number | null;
  goal_id?: number | null;
  is_pinned?: boolean;
  label_ids?: number[];
  label_names?: string[];
}

export const listNotes = (params?: NoteFilters) =>
  parseApiResponse<NoteListResponse>(apiClient.get('/api/notes', { params }));

export const getNote = (id: number) => parseApiResponse<Note>(apiClient.get(`/api/notes/${id}`));

export const createNote = (body: NoteBody) => parseApiResponse<Note>(apiClient.post('/api/notes', body));

export const updateNote = (id: number, body: NoteBody) =>
  parseApiResponse<Note>(apiClient.put(`/api/notes/${id}`, body));

export const deleteNote = (id: number) =>
  parseApiResponse<{ deleted: boolean }>(apiClient.delete(`/api/notes/${id}`));

import { apiClient, parseApiResponse } from './client';
import type { ApiResponse, CalendarEvent } from '../types';

export interface CreateCalendarEventDTO {
  title: string;
  start_at: number;
  end_at: number;
  is_all_day?: boolean;
  description?: string;
  location?: string;
}

export interface CalendarEventCreated extends CalendarEvent {
  pushed_to_google: boolean;
}

export async function createCalendarEvent(
  body: CreateCalendarEventDTO,
): Promise<ApiResponse<CalendarEventCreated>> {
  return parseApiResponse<CalendarEventCreated>(apiClient.post('/api/calendar/events', body));
}

export async function deleteCalendarEvent(
  id: number,
): Promise<ApiResponse<{ deleted: boolean; google_deleted: boolean }>> {
  return parseApiResponse<{ deleted: boolean; google_deleted: boolean }>(
    apiClient.delete(`/api/calendar/events/${id}`),
  );
}

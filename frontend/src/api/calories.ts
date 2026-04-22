import { apiClient, parseApiResponse } from './client';
import type { ApiResponse } from '../types';

export interface CalorieLog {
  id: number;
  log_date: string;
  food_name: string;
  food_brand: string | null;
  amount_g: number;
  kcal_per_100g: number;
  kcal_total: number;
  created_at: number;
}

export interface CalorieDayData {
  logs: CalorieLog[];
  total_kcal: number;
}

export async function getCalories(date: string): Promise<ApiResponse<CalorieDayData>> {
  return parseApiResponse<CalorieDayData>(apiClient.get('/api/calories', { params: { date } }));
}

export async function addCalorieLog(body: {
  log_date: string;
  food_name: string;
  food_brand?: string;
  amount_g: number;
  kcal_per_100g: number;
}): Promise<ApiResponse<CalorieLog>> {
  return parseApiResponse<CalorieLog>(apiClient.post('/api/calories', body));
}

export async function deleteCalorieLog(id: number): Promise<ApiResponse<null>> {
  return parseApiResponse<null>(apiClient.delete(`/api/calories/${id}`));
}

export interface OffProduct {
  product_name: string;
  brands: string;
  kcal_per_100g: number;
}

export async function searchFood(query: string): Promise<OffProduct[]> {
  const res = await parseApiResponse<OffProduct[]>(
    apiClient.get('/api/calories/search', { params: { q: query } }),
  );
  return res.success ? res.data : [];
}

import { apiClient, parseApiResponse } from './client';
import type { ApiResponse, BudgetCategory, BudgetMonthPayload } from '../types';

export const getBudgetMonth = (month: string) =>
  parseApiResponse<BudgetMonthPayload>(apiClient.get(`/api/budget/${month}`));

export const updateBudgetMonth = (
  month: string,
  body: {
    current_balance?: number;
    minimum_balance?: number;
    notes?: string | null;
  },
) => parseApiResponse<BudgetMonthPayload>(apiClient.put(`/api/budget/${month}`, body));

export const upsertIncome = (
  month: string,
  body: {
    id?: number;
    name: string;
    amount: number;
    received: boolean;
    sort_order?: number;
  },
) => parseApiResponse<BudgetMonthPayload>(apiClient.post(`/api/budget/${month}/income`, body));

export const upsertExpense = (
  month: string,
  body: {
    id?: number;
    name: string;
    amount: number;
    category: BudgetCategory;
    paid: boolean;
    sort_order?: number;
  },
) => parseApiResponse<BudgetMonthPayload>(apiClient.post(`/api/budget/${month}/expenses`, body));

export const deleteIncome = (month: string, id: number): Promise<ApiResponse<BudgetMonthPayload>> =>
  parseApiResponse<BudgetMonthPayload>(apiClient.delete(`/api/budget/${month}/income/${id}`));

export const deleteExpense = (month: string, id: number): Promise<ApiResponse<BudgetMonthPayload>> =>
  parseApiResponse<BudgetMonthPayload>(apiClient.delete(`/api/budget/${month}/expenses/${id}`));

export const copyFromPrevious = (month: string): Promise<ApiResponse<BudgetMonthPayload>> =>
  parseApiResponse<BudgetMonthPayload>(apiClient.post(`/api/budget/${month}/copy-previous`, {}));

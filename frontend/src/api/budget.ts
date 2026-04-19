import { apiClient, parseApiResponse } from './client';
import type {
  AccountKind,
  AccountsPayload,
  ApiResponse,
  BudgetAnalyticsPayload,
  BudgetCategory,
  BudgetInsightsPayload,
  BudgetMonthPayload,
  DebtsPayload,
} from '../types';

export const getBudgetMonth = (month: string) =>
  parseApiResponse<BudgetMonthPayload>(apiClient.get(`/api/budget/${month}`));

export const getBudgetAnalytics = () =>
  parseApiResponse<BudgetAnalyticsPayload>(apiClient.get('/api/budget/analytics'));

export const getBudgetInsights = () =>
  parseApiResponse<BudgetInsightsPayload>(apiClient.get('/api/budget/insights'));

export const updateBudgetMonth = (
  month: string,
  body: {
    current_balance?: number;
    minimum_balance?: number;
    notes?: string | null;
    current_balance_account_id?: number | null;
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

export const getAccounts = () =>
  parseApiResponse<AccountsPayload>(apiClient.get('/api/budget/accounts'));

export const upsertAccount = (body: {
  id?: number;
  name: string;
  kind: AccountKind;
  balance: number;
  sort_order?: number;
}) => parseApiResponse<AccountsPayload>(apiClient.post('/api/budget/accounts', body));

export const deleteAccount = (id: number) =>
  parseApiResponse<AccountsPayload>(apiClient.delete(`/api/budget/accounts/${id}`));

export const getDebts = () => parseApiResponse<DebtsPayload>(apiClient.get('/api/budget/debts'));

export const upsertDebt = (body: {
  id?: number;
  name: string;
  amount: number;
  paid_amount?: number;
  deadline: number | null;
  paid: boolean;
  notes?: string | null;
  sort_order?: number;
}) => parseApiResponse<DebtsPayload>(apiClient.post('/api/budget/debts', body));

export const deleteDebt = (id: number) =>
  parseApiResponse<DebtsPayload>(apiClient.delete(`/api/budget/debts/${id}`));

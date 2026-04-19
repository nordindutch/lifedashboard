import { useQuery } from '@tanstack/react-query';
import * as budgetApi from '../api/budget';
import type { AccountsPayload, BudgetMonthPayload, DebtsPayload } from '../types';
import { useResourceMutation } from './useResourceMutation';

export function useBudget(month: string) {
  return useQuery({
    queryKey: ['budget', month],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await budgetApi.getBudgetMonth(month);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

export function useUpsertIncome(month: string) {
  return useResourceMutation<Parameters<typeof budgetApi.upsertIncome>[1], BudgetMonthPayload>(
    ['budget', month],
    (body) => budgetApi.upsertIncome(month, body),
  );
}

export function useUpsertExpense(month: string) {
  return useResourceMutation<Parameters<typeof budgetApi.upsertExpense>[1], BudgetMonthPayload>(
    ['budget', month],
    (body) => budgetApi.upsertExpense(month, body),
  );
}

export function useDeleteIncome(month: string) {
  return useResourceMutation<number, BudgetMonthPayload>(
    ['budget', month],
    (id) => budgetApi.deleteIncome(month, id),
  );
}

export function useDeleteExpense(month: string) {
  return useResourceMutation<number, BudgetMonthPayload>(
    ['budget', month],
    (id) => budgetApi.deleteExpense(month, id),
  );
}

export function useCopyFromPrevious(month: string) {
  return useResourceMutation<undefined, BudgetMonthPayload>(
    ['budget', month],
    (_?: undefined) => budgetApi.copyFromPrevious(month),
  );
}

export function useUpdateBudgetMonth(month: string) {
  return useResourceMutation<Parameters<typeof budgetApi.updateBudgetMonth>[1], BudgetMonthPayload>(
    ['budget', month],
    (body) => budgetApi.updateBudgetMonth(month, body),
  );
}

export function useAccounts() {
  return useQuery({
    queryKey: ['budget-accounts'],
    queryFn: async () => {
      const res = await budgetApi.getAccounts();
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

export const useUpsertAccount = () =>
  useResourceMutation<Parameters<typeof budgetApi.upsertAccount>[0], AccountsPayload>(
    ['budget-accounts'],
    budgetApi.upsertAccount,
    [['budget']],
  );

export const useDeleteAccount = () =>
  useResourceMutation<number, AccountsPayload>(['budget-accounts'], budgetApi.deleteAccount, [['budget']]);

export function useDebts() {
  return useQuery({
    queryKey: ['budget-debts'],
    queryFn: async () => {
      const res = await budgetApi.getDebts();
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

export const useUpsertDebt = () =>
  useResourceMutation<Parameters<typeof budgetApi.upsertDebt>[0], DebtsPayload>(['budget-debts'], budgetApi.upsertDebt);

export const useDeleteDebt = () =>
  useResourceMutation<number, DebtsPayload>(['budget-debts'], budgetApi.deleteDebt);

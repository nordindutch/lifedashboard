import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import * as budgetApi from '../api/budget';
import type {
  AccountsPayload,
  BudgetExpenseRow,
  BudgetIncomeRow,
  BudgetMonthPayload,
  DebtDetail,
  DebtsPayload,
} from '../../../types';
import { useResourceMutation } from '../../../hooks/useResourceMutation';
import { recomputeSummary } from '../lib/budgetMath';

const invalidateBudgetAnalytics: QueryKey[] = [['budget-analytics'], ['budget-insights']];

export const budgetMonthKey = (month: string): QueryKey => ['budget', month];

export function useBudget(month: string) {
  return useQuery({
    queryKey: budgetMonthKey(month),
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

export function useBudgetAnalytics() {
  return useQuery({
    queryKey: ['budget-analytics'],
    staleTime: 120_000,
    queryFn: async () => {
      const res = await budgetApi.getBudgetAnalytics();
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

export function useBudgetInsights(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['budget-insights'],
    staleTime: 300_000,
    enabled: options?.enabled ?? false,
    queryFn: async () => {
      const res = await budgetApi.getBudgetInsights();
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    retry: false,
  });
}

export function useUpsertIncome(month: string) {
  return useResourceMutation<Parameters<typeof budgetApi.upsertIncome>[1], BudgetMonthPayload>(
    budgetMonthKey(month),
    (body) => budgetApi.upsertIncome(month, body),
    invalidateBudgetAnalytics,
  );
}

export function useUpsertExpense(month: string) {
  return useResourceMutation<Parameters<typeof budgetApi.upsertExpense>[1], BudgetMonthPayload>(
    budgetMonthKey(month),
    (body) => budgetApi.upsertExpense(month, body),
    invalidateBudgetAnalytics,
  );
}

export function useDeleteIncome(month: string) {
  return useResourceMutation<number, BudgetMonthPayload>(
    budgetMonthKey(month),
    (id) => budgetApi.deleteIncome(month, id),
    invalidateBudgetAnalytics,
  );
}

export function useDeleteExpense(month: string) {
  return useResourceMutation<number, BudgetMonthPayload>(
    budgetMonthKey(month),
    (id) => budgetApi.deleteExpense(month, id),
    invalidateBudgetAnalytics,
  );
}

export function useCopyFromPrevious(month: string) {
  return useResourceMutation<undefined, BudgetMonthPayload>(
    budgetMonthKey(month),
    (_?: undefined) => budgetApi.copyFromPrevious(month),
    invalidateBudgetAnalytics,
  );
}

export function useUpdateBudgetMonth(month: string) {
  return useResourceMutation<Parameters<typeof budgetApi.updateBudgetMonth>[1], BudgetMonthPayload>(
    budgetMonthKey(month),
    (body) => budgetApi.updateBudgetMonth(month, body),
    invalidateBudgetAnalytics,
  );
}

/**
 * Afvinken van een uitgave (betaald) of inkomen (ontvangen), optimistisch:
 * de cache wordt direct bijgewerkt en de totalen herberekend; bij een fout rolt hij terug.
 */
export function useToggleRow(month: string) {
  const qc = useQueryClient();
  const key = budgetMonthKey(month);

  return useMutation({
    mutationFn: async (input: { kind: 'expense'; row: BudgetExpenseRow } | { kind: 'income'; row: BudgetIncomeRow }) => {
      const res =
        input.kind === 'expense'
          ? await budgetApi.upsertExpense(month, {
              id: input.row.id,
              name: input.row.name,
              amount: input.row.amount,
              category: input.row.category,
              paid: !input.row.paid,
              sort_order: input.row.sort_order,
            })
          : await budgetApi.upsertIncome(month, {
              id: input.row.id,
              name: input.row.name,
              amount: input.row.amount,
              received: !input.row.received,
              sort_order: input.row.sort_order,
            });
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<BudgetMonthPayload>(key);
      if (previous) {
        const income =
          input.kind === 'income'
            ? previous.income.map((r) => (r.id === input.row.id ? { ...r, received: !r.received } : r))
            : previous.income;
        const expenses =
          input.kind === 'expense'
            ? previous.expenses.map((r) => (r.id === input.row.id ? { ...r, paid: !r.paid } : r))
            : previous.expenses;
        qc.setQueryData<BudgetMonthPayload>(key, {
          ...previous,
          income,
          expenses,
          summary: recomputeSummary(previous.summary, previous.month.current_balance, income, expenses),
        });
      }
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(key, ctx.previous);
      }
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      for (const k of invalidateBudgetAnalytics) {
        void qc.invalidateQueries({ queryKey: k });
      }
    },
  });
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
    [['budget'], ...invalidateBudgetAnalytics],
  );

export const useDeleteAccount = () =>
  useResourceMutation<number, AccountsPayload>(['budget-accounts'], budgetApi.deleteAccount, [
    ['budget'],
    ...invalidateBudgetAnalytics,
  ]);

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

export function useDebt(id: number | null) {
  return useQuery({
    queryKey: ['budget-debt', id],
    enabled: id !== null,
    queryFn: async () => {
      const res = await budgetApi.getDebt(id ?? 0);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data as DebtDetail;
    },
  });
}

/** Schulden beïnvloeden het maandbudget (rente), dus ook de maandcache verversen. */
const debtInvalidates: QueryKey[] = [['budget'], ['budget-debt'], ...invalidateBudgetAnalytics];

export const useUpsertDebt = () =>
  useResourceMutation<budgetApi.UpsertDebtBody, DebtsPayload>(['budget-debts'], budgetApi.upsertDebt, debtInvalidates);

export const useDeleteDebt = () =>
  useResourceMutation<number, DebtsPayload>(['budget-debts'], budgetApi.deleteDebt, debtInvalidates);

export const useRegisterDebtPayment = (id: number) =>
  useResourceMutation<{ amount: number; note?: string | null }, DebtsPayload>(
    ['budget-debts'],
    (body) => budgetApi.registerDebtPayment(id, body),
    debtInvalidates,
  );

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as budgetApi from '../api/budget';

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

function useSetBudget(month: string) {
  const qc = useQueryClient();
  return (data: Awaited<ReturnType<typeof budgetApi.getBudgetMonth>>) => {
    if (data.success) {
      qc.setQueryData(['budget', month], data.data);
    }
  };
}

export function useUpsertIncome(month: string) {
  const set = useSetBudget(month);
  return useMutation({
    mutationFn: (body: Parameters<typeof budgetApi.upsertIncome>[1]) => budgetApi.upsertIncome(month, body),
    onSuccess: set,
  });
}

export function useUpsertExpense(month: string) {
  const set = useSetBudget(month);
  return useMutation({
    mutationFn: (body: Parameters<typeof budgetApi.upsertExpense>[1]) => budgetApi.upsertExpense(month, body),
    onSuccess: set,
  });
}

export function useDeleteIncome(month: string) {
  const set = useSetBudget(month);
  return useMutation({
    mutationFn: (id: number) => budgetApi.deleteIncome(month, id),
    onSuccess: set,
  });
}

export function useDeleteExpense(month: string) {
  const set = useSetBudget(month);
  return useMutation({
    mutationFn: (id: number) => budgetApi.deleteExpense(month, id),
    onSuccess: set,
  });
}

export function useCopyFromPrevious(month: string) {
  const set = useSetBudget(month);
  return useMutation({
    mutationFn: () => budgetApi.copyFromPrevious(month),
    onSuccess: set,
  });
}

export function useUpdateBudgetMonth(month: string) {
  const set = useSetBudget(month);
  return useMutation({
    mutationFn: (body: Parameters<typeof budgetApi.updateBudgetMonth>[1]) => budgetApi.updateBudgetMonth(month, body),
    onSuccess: set,
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

export function useUpsertAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof budgetApi.upsertAccount>[0]) => budgetApi.upsertAccount(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-accounts'] }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => budgetApi.deleteAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-accounts'] }),
  });
}

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

export function useUpsertDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof budgetApi.upsertDebt>[0]) => budgetApi.upsertDebt(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-debts'] }),
  });
}

export function useDeleteDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => budgetApi.deleteDebt(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-debts'] }),
  });
}

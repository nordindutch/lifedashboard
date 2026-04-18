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
    mutationFn: async (body: Parameters<typeof budgetApi.upsertAccount>[0]) => {
      const res = await budgetApi.upsertAccount(body);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['budget-accounts'], data);
      void qc.invalidateQueries({ queryKey: ['budget'] });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await budgetApi.deleteAccount(id);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['budget-accounts'], data);
      void qc.invalidateQueries({ queryKey: ['budget'] });
    },
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
    mutationFn: async (body: Parameters<typeof budgetApi.upsertDebt>[0]) => {
      const res = await budgetApi.upsertDebt(body);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['budget-debts'], data);
    },
  });
}

export function useDeleteDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await budgetApi.deleteDebt(id);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['budget-debts'], data);
    },
  });
}

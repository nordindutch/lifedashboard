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

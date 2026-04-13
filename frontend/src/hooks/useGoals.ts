import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as goalsApi from '../api/goals';
import type { Goal } from '../types';

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await goalsApi.listGoals();
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

export function useGoal(id: number | null) {
  return useQuery({
    queryKey: ['goals', id],
    enabled: id != null && id > 0,
    queryFn: async () => {
      if (id == null) {
        throw new Error('No id');
      }
      const res = await goalsApi.getGoal(id);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: goalsApi.createGoal,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Goal> }) => goalsApi.updateGoal(id, body),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['goals'] });
      void qc.invalidateQueries({ queryKey: ['goals', v.id] });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as caloriesApi from '../api/calories';

export function useCalories(date: string) {
  return useQuery({
    queryKey: ['calories', date],
    queryFn: async () => {
      const res = await caloriesApi.getCalories(date);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
}

export function useAddCalorieLog(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Parameters<typeof caloriesApi.addCalorieLog>[0]) => {
      const res = await caloriesApi.addCalorieLog(body);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calories', date] }),
  });
}

export function useDeleteCalorieLog(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await caloriesApi.deleteCalorieLog(id);
      if (!res.success) throw new Error(res.error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calories', date] }),
  });
}

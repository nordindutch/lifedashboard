import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as aiApi from '../api/ai';
import type { PlanType } from '../types';

export function useAiPlan(date?: string, type?: 'morning' | 'evening') {
  return useQuery({
    queryKey: ['ai', 'plan', { date, type }],
    queryFn: async () => {
      const res = await aiApi.getAiPlan({ date, type });
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

export function useGenerateAiPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      plan_type: PlanType;
      plan_date?: string;
      include_task_ids?: number[];
      force_regenerate?: boolean;
      end_time?: string;
    }) => {
      const res = await aiApi.generateAiPlan(body);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['briefing'] });
    },
  });
}

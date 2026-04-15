import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import * as eveningPlanApi from '../api/eveningPlan';

function isSelectedToday(date: string): boolean {
  return date === format(new Date(), 'yyyy-MM-dd');
}

/**
 * Per-date evening summaries (DB-backed). React Query caches by date; past days stay fresh longer.
 */
export function useEveningPlan(date: string) {
  return useQuery({
    queryKey: ['evening-plan', date],
    staleTime: isSelectedToday(date) ? 2 * 60 * 1000 : 24 * 60 * 60 * 1000,
    gcTime: 14 * 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const res = await eveningPlanApi.getEveningPlan(date);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

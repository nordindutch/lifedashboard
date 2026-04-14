import { useQuery } from '@tanstack/react-query';
import * as briefingApi from '../api/briefing';

export function useBriefing(date?: string) {
  return useQuery({
    queryKey: ['briefing', date ?? 'today'],
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await briefingApi.getBriefing(date);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import * as aiApi from '../api/ai';

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

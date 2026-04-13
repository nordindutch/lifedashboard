import { useQuery } from '@tanstack/react-query';
import * as diaryApi from '../api/diary';

export function useDiaryLogs(params?: { date?: string; project_id?: number; task_id?: number }) {
  return useQuery({
    queryKey: ['diary', params ?? {}],
    queryFn: async () => {
      const res = await diaryApi.listDiaryLogs(params);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import * as tasksApi from '../api/tasks';
import type { TaskStatus } from '../types';

export function useTasks(filters?: {
  project_id?: number;
  goal_id?: number;
  status?: TaskStatus;
}) {
  return useQuery({
    queryKey: ['tasks', filters ?? {}],
    queryFn: async () => {
      const res = await tasksApi.listTasks(filters);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

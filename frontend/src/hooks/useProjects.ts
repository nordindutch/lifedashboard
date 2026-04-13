import { useQuery } from '@tanstack/react-query';
import * as projectsApi from '../api/projects';

export function useProjects(filters?: { goal_id?: number; status?: string }) {
  return useQuery({
    queryKey: ['projects', filters ?? {}],
    queryFn: async () => {
      const res = await projectsApi.listProjects(filters);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

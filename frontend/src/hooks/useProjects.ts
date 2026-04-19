import { useQuery } from '@tanstack/react-query';
import * as projectsApi from '../api/projects';
import type { Project } from '../types';
import { useResourceMutation } from './useResourceMutation';

export function useProjects(filters?: { goal_id?: number; status?: string }) {
  return useQuery({
    queryKey: ['projects', filters ?? {}],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await projectsApi.listProjects(filters);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

export function useCreateProject() {
  return useResourceMutation<Parameters<typeof projectsApi.createProject>[0], Project>(
    ['projects'],
    (body) => projectsApi.createProject(body),
  );
}

export function useUpdateProject() {
  return useResourceMutation<{ id: number; body: Partial<Project> }, Project>(
    ['projects'],
    ({ id, body }) => projectsApi.updateProject(id, body),
    [['tasks']],
  );
}

export function useDeleteProject() {
  return useResourceMutation<number, { deleted: boolean }>(
    ['projects'],
    (id) => projectsApi.deleteProject(id),
    [['tasks']],
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as tasksApi from '../api/tasks';
import type { Task, TaskStatus } from '../types';

export function useTasks(filters?: {
  project_id?: number;
  goal_id?: number;
  status?: TaskStatus;
}) {
  return useQuery({
    queryKey: ['tasks', filters ?? {}],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const res = await tasksApi.listTasks({ ...filters, per_page: 200 });
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Parameters<typeof tasksApi.createTask>[0]) => tasksApi.createTask(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['briefing'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<Task> }) => tasksApi.updateTask(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['briefing'] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tasksApi.deleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['briefing'] });
    },
  });
}

export function useReorderTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tasksApi.reorderTasks,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['briefing'] });
    },
  });
}

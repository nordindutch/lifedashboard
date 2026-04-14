import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as settingsApi from '../api/settings';
import type { AppSettings } from '../types';

export function useSettings() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await settingsApi.getSettings();
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<AppSettings>) => {
      const res = await settingsApi.updateSettings(patch);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['briefing'] });
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    updateSettings: updateMutation.mutateAsync,
    isPending: updateMutation.isPending,
  };
}

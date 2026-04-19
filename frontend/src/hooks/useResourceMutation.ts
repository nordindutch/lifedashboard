import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { ApiResponse } from '../types';

/**
 * Wraps a mutation API call in a useMutation that auto-invalidates
 * the resource's query on success.
 */
export function useResourceMutation<TInput, TOutput>(
  queryKey: QueryKey,
  apiFn: (input: TInput) => Promise<ApiResponse<TOutput>>,
  invalidateAlso?: QueryKey[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TInput) => {
      const res = await apiFn(input);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
      if (invalidateAlso) {
        for (const key of invalidateAlso) {
          void qc.invalidateQueries({ queryKey: key });
        }
      }
    },
  });
}

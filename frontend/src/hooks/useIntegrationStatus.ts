import { useQuery } from '@tanstack/react-query';
import { getIntegrationStatus } from '../api/settings';

export function useIntegrationStatus() {
  return useQuery({
    queryKey: ['integrations', 'status'],
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await getIntegrationStatus();
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

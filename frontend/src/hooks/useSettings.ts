import { useQuery } from '@tanstack/react-query';
import * as settingsApi from '../api/settings';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await settingsApi.getSettings();
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMe, logout } from '../api/auth';

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await getMe();
      if (!res.success) {
        return null;
      }
      return res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      qc.clear();
      window.location.href = '/login';
    },
  });
}

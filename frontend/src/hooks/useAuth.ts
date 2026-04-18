import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBootstrap, getMe, logout } from '../api/auth';

export function useBootstrap() {
  return useQuery({
    queryKey: ['auth', 'bootstrap'],
    queryFn: async () => {
      const res = await getBootstrap();
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
    retry: 2,
    staleTime: 60_000,
  });
}

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
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('codex_session');
      }
      qc.clear();
      window.location.href = '/login';
    },
  });
}

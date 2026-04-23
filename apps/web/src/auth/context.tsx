import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/endpoints';
import type { Me } from '../api/types';

interface AuthContextValue {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then((r) => r.user),
    staleTime: 60_000,
    retry: false,
  });
  const value: AuthContextValue = {
    me: q.data ?? null,
    loading: q.isPending,
    refresh: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth used outside AuthProvider');
  return ctx;
}

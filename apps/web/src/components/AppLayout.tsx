import { Link, Outlet, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/endpoints';
import { useAuth } from '../auth/context';
import { Button } from './ui';

export function AppLayout() {
  const { me } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  async function logout() {
    await authApi.logout();
    await qc.invalidateQueries();
    router.navigate({ to: '/login' });
  }

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            mew
          </Link>
          <div className="flex items-center gap-1 text-sm">
            <NavLink to="/">Entry</NavLink>
            <NavLink to="/expenses">Expenses</NavLink>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-neutral-500 sm:inline">{me?.username}</span>
            <Button variant="ghost" onClick={logout}>
              Log out
            </Button>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({ to, children }: { to: '/' | '/expenses' | '/dashboard' | '/settings'; children: string }) {
  return (
    <Link
      to={to}
      className="rounded-md px-2 py-1 text-neutral-600 hover:bg-neutral-100"
      activeProps={{ className: 'rounded-md px-2 py-1 bg-neutral-900 text-white' }}
    >
      {children}
    </Link>
  );
}

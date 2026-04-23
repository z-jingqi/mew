import { useState } from 'react';
import { Link, Outlet, useRouter, useRouterState } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Settings,
  Wallet,
} from 'lucide-react';
import { authApi } from '../api/endpoints';
import { useAuth } from '../auth/context';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/entry', label: 'New entry', icon: PlusCircle },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

export function AppLayout() {
  const { me } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  async function logout() {
    await authApi.logout();
    await qc.invalidateQueries();
    router.navigate({ to: '/login' });
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex min-h-dvh bg-background text-foreground">
        <aside
          className={cn(
            'sticky top-0 flex h-dvh shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out',
            collapsed ? 'w-16' : 'w-60',
          )}
        >
          <div
            className={cn(
              'flex h-14 items-center border-b px-3',
              collapsed ? 'justify-center' : 'justify-between',
            )}
          >
            {!collapsed && (
              <Link to="/" className="text-lg font-semibold tracking-tight">
                mew
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft
                className={cn('transition-transform duration-200', collapsed && 'rotate-180')}
              />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 p-2">
            {NAV.map((item) => {
              const active =
                item.to === '/'
                  ? currentPath === '/'
                  : currentPath.startsWith(item.to);
              const Icon = item.icon;
              const link = (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              );
            })}
          </nav>

          <Separator />

          <div
            className={cn(
              'flex items-center gap-2 p-3',
              collapsed && 'flex-col gap-3 p-2',
            )}
          >
            <div
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground',
              )}
            >
              {(me?.username ?? '?').charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{me?.username}</div>
                <div className="truncate text-xs text-muted-foreground">{me?.role}</div>
              </div>
            )}
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={logout}
                    aria-label="Log out"
                  >
                    <LogOut />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Log out</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={logout}
                aria-label="Log out"
              >
                <LogOut />
              </Button>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-6">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

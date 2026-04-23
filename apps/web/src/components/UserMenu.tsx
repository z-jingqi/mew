import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { authApi } from '../api/endpoints';
import { useAuth } from '../auth/context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function UserMenu() {
  const { me } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  async function logout() {
    await authApi.logout();
    await qc.invalidateQueries();
    router.navigate({ to: '/login' });
  }

  const initial = (me?.username ?? '?').charAt(0).toUpperCase();

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="grid size-11 place-items-center rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-lg ring-offset-background transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {initial}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="min-w-40">
          <DropdownMenuLabel>{me?.username}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={logout}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

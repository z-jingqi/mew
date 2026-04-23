import { Outlet } from '@tanstack/react-router';

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Outlet />
    </div>
  );
}

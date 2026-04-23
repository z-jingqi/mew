import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { HomePage } from './pages/Home';
import { ExpensesPage } from './pages/Expenses';
import { DashboardPage } from './pages/Dashboard';
import { SettingsPage } from './pages/Settings';
import { authApi } from './api/endpoints';

const rootRoute = createRootRoute({ component: () => <Outlet /> });

/**
 * Called from each protected route's `beforeLoad`. Throws a redirect if the
 * user isn't signed in, otherwise returns the user.
 */
async function requireUser() {
  try {
    const { user } = await authApi.me();
    if (!user) throw redirect({ to: '/login' });
    return { user };
  } catch {
    throw redirect({ to: '/login' });
  }
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: requireUser,
  component: AppLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: DashboardPage,
});

const entryRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/entry',
  component: HomePage,
});

const expensesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/expenses',
  component: ExpensesPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  appRoute.addChildren([dashboardRoute, entryRoute, expensesRoute, settingsRoute]),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

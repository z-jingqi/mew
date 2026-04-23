import { useState, type FormEvent } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/endpoints';
import { Button, Field, Input } from '../components/ui';
import { errorMessage } from '../lib/errors';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await authApi.login(username, password);
      await qc.invalidateQueries({ queryKey: ['me'] });
      router.navigate({ to: '/' });
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">mew</h1>
          <p className="mt-1 text-sm text-neutral-500">Sign in to keep tabs on your spending.</p>
        </header>
        <Field label="Username">
          <Input
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="text-center text-xs text-neutral-500">
          Need an account?{' '}
          <Link to="/register" className="underline">
            Register with an invite code
          </Link>
        </p>
      </form>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/endpoints';
import { Button, Field, Input } from '../components/ui';
import { errorMessage } from '../lib/errors';

export function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await authApi.register(username, password, inviteCode.trim());
      await qc.invalidateQueries({ queryKey: ['me'] });
      router.navigate({ to: '/' });
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Create account</h1>
          <p className="mt-1 text-sm text-neutral-500">Registration is invite-only.</p>
        </header>
        <Field label="Username (3–20 letters/numbers/underscore)">
          <Input
            autoFocus
            pattern="[a-zA-Z0-9_]{3,20}"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </Field>
        <Field label="Password (min 6 chars)">
          <Input
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Field label="Invite code">
          <Input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            required
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Creating…' : 'Create account'}
        </Button>
        <p className="text-center text-xs text-neutral-500">
          Already have an account?{' '}
          <Link to="/login" className="underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

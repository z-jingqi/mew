import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SUPPORTED_CURRENCIES, type Currency } from '@mew/shared';
import { authApi, categoriesApi, peopleApi } from '../api/endpoints';
import { useAuth } from '../auth/context';
import { Button, Card, Field, Input } from '../components/ui';
import { errorMessage } from '../lib/errors';

export function SettingsPage() {
  const { me, refresh } = useAuth();
  const qc = useQueryClient();

  const updateProfile = useMutation({
    mutationFn: (currency: Currency) => authApi.updateProfile({ defaultCurrency: currency }),
    onSuccess: () => refresh(),
  });

  const categories = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const people = useQuery({ queryKey: ['people'], queryFn: peopleApi.list });

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="text-sm">
          <div>
            <span className="text-neutral-500">Username:</span> {me?.username}
          </div>
          <div>
            <span className="text-neutral-500">Role:</span> {me?.role}
          </div>
        </div>
        <Field label="Default currency">
          <select
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            value={me?.defaultCurrency ?? 'USD'}
            onChange={(e) => updateProfile.mutate(e.target.value as Currency)}
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </Card>

      <CategoryManager
        title="Categories"
        items={categories.data ?? []}
        onCreate={(name) =>
          categoriesApi.create({ name }).then(() => qc.invalidateQueries({ queryKey: ['categories'] }))
        }
        onRename={(id, name) =>
          categoriesApi.update(id, { name }).then(() => qc.invalidateQueries({ queryKey: ['categories'] }))
        }
        onDelete={(id) =>
          categoriesApi.remove(id).then(() => qc.invalidateQueries({ queryKey: ['categories'] }))
        }
        renderExtra={(c) => (c.icon ? <span className="text-xs">{c.icon}</span> : null)}
      />

      <CategoryManager
        title="People"
        items={people.data ?? []}
        onCreate={(name) =>
          peopleApi.create(name).then(() => qc.invalidateQueries({ queryKey: ['people'] }))
        }
        onRename={(id, name) =>
          peopleApi.update(id, { name }).then(() => qc.invalidateQueries({ queryKey: ['people'] }))
        }
        onDelete={(id) =>
          peopleApi.remove(id).then(() => qc.invalidateQueries({ queryKey: ['people'] }))
        }
      />

      <Card className="space-y-2 border-red-200">
        <h2 className="text-lg font-semibold text-red-700">Danger zone</h2>
        <p className="text-sm text-neutral-600">
          Deleting your account removes all expenses, people, categories, and insights. There is no
          undo.
        </p>
        <DeleteAccountForm />
      </Card>
    </div>
  );
}

interface ManagerItem {
  id: string;
  name: string;
  icon?: string | null;
}

function CategoryManager({
  title,
  items,
  onCreate,
  onRename,
  onDelete,
  renderExtra,
}: {
  title: string;
  items: ManagerItem[];
  onCreate: (name: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  renderExtra?: (item: ManagerItem) => React.ReactNode;
}) {
  const [newName, setNewName] = useState('');
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          onCreate(newName.trim()).then(() => setNewName(''));
        }}
      >
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New…" />
        <Button type="submit" disabled={!newName.trim()}>
          Add
        </Button>
      </form>
      <ul className="divide-y divide-neutral-100">
        {items.map((it) => (
          <ManagerRow
            key={it.id}
            item={it}
            onRename={onRename}
            onDelete={onDelete}
            renderExtra={renderExtra}
          />
        ))}
      </ul>
    </Card>
  );
}

function ManagerRow({
  item,
  onRename,
  onDelete,
  renderExtra,
}: {
  item: ManagerItem;
  onRename: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  renderExtra?: (item: ManagerItem) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);
  return (
    <li className="flex items-center gap-2 py-2">
      {renderExtra?.(item)}
      {editing ? (
        <>
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Button
            variant="secondary"
            onClick={() => {
              onRename(item.id, draft.trim()).then(() => setEditing(false));
            }}
          >
            Save
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm">{item.name}</span>
          <button
            className="text-xs text-neutral-500 hover:underline"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button
            className="text-xs text-red-600 hover:underline"
            onClick={() => {
              if (confirm(`Delete "${item.name}"?`)) onDelete(item.id);
            }}
          >
            Delete
          </button>
        </>
      )}
    </li>
  );
}

function DeleteAccountForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const del = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'delete_failed');
    },
    onSuccess: () => {
      window.location.href = '/login';
    },
    onError: (e) => setError(errorMessage(e, 'Could not delete the account.')),
  });
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm('Really delete your account?')) return;
        del.mutate();
      }}
    >
      <Input
        type="password"
        placeholder="Re-enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button variant="danger" type="submit" disabled={!password || del.isPending}>
        Delete account
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}

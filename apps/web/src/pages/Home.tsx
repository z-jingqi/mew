import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ParsedExpense } from '@mew/shared';
import { categoriesApi, expensesApi, peopleApi } from '../api/endpoints';
import { useAuth } from '../auth/context';
import { Button, Card, Field, Input } from '../components/ui';
import { errorMessage } from '../lib/errors';
import { formatMoney, todayLocalIso } from '../lib/format';

export function HomePage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<ParsedExpense | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const people = useQuery({ queryKey: ['people'], queryFn: peopleApi.list });

  const parseMut = useMutation({
    mutationFn: (input: string) => expensesApi.parse(input, todayLocalIso()),
    onSuccess: (res) => {
      setDraft(res.expense);
      setError(null);
    },
    onError: (err) => setError(errorMessage(err, 'Could not understand that entry.')),
  });

  const saveMut = useMutation({
    mutationFn: async (expense: ParsedExpense) => {
      const matchCategoryId = expense.category
        ? categories.data?.find(
            (c) => c.name.toLowerCase() === expense.category!.toLowerCase(),
          )?.id ?? null
        : null;
      const matchPersonId = expense.person
        ? people.data?.find((p) => p.name.toLowerCase() === expense.person!.toLowerCase())?.id ??
          null
        : null;
      return expensesApi.create({
        amount_cents: expense.amount_cents,
        currency: expense.currency,
        category_id: matchCategoryId,
        category_name: matchCategoryId ? null : expense.category,
        person_id: matchPersonId,
        person_name: matchPersonId ? null : expense.person,
        merchant: expense.merchant,
        note: expense.note,
        spent_at: expense.spent_at,
        source: 'ai',
        items: expense.items.map((it) => ({ name: it.name, amount_cents: it.amount_cents })),
      });
    },
    onSuccess: () => {
      setDraft(null);
      setText('');
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['people'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err) => setError(errorMessage(err, 'Could not save this expense.')),
  });

  return (
    <div className="space-y-4">
      <section>
        <h1 className="mb-2 text-xl font-semibold">What did you spend?</h1>
        <p className="text-sm text-neutral-500">
          Just type — e.g. <em>"lunch w/ alex 28 today"</em>. Default currency:{' '}
          {me?.defaultCurrency}.
        </p>
      </section>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          parseMut.mutate(text.trim());
        }}
      >
        <Input
          autoFocus
          placeholder="lunch w/ alex 28 today"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" disabled={parseMut.isPending || !text.trim()}>
          {parseMut.isPending ? 'Parsing…' : 'Parse'}
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {draft && (
        <ConfirmChip
          draft={draft}
          knownCategory={categories.data?.some(
            (c) => c.name.toLowerCase() === draft.category?.toLowerCase(),
          )}
          knownPerson={people.data?.some(
            (p) => p.name.toLowerCase() === draft.person?.toLowerCase(),
          )}
          onEdit={setDraft}
          onSave={() => saveMut.mutate(draft)}
          onDiscard={() => setDraft(null)}
          saving={saveMut.isPending}
        />
      )}
    </div>
  );
}

function ConfirmChip({
  draft,
  knownCategory,
  knownPerson,
  onEdit,
  onSave,
  onDiscard,
  saving,
}: {
  draft: ParsedExpense;
  knownCategory: boolean | undefined;
  knownPerson: boolean | undefined;
  onEdit: (next: ParsedExpense) => void;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-semibold">
          {formatMoney(draft.amount_cents, draft.currency)}
        </div>
        <div className="text-xs text-neutral-500">{draft.spent_at}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <Input
            type="number"
            step="0.01"
            value={(draft.amount_cents / 100).toFixed(2)}
            onChange={(e) =>
              onEdit({
                ...draft,
                amount_cents: Math.round(Number(e.target.value || '0') * 100),
              })
            }
          />
        </Field>
        <Field label="Date">
          <Input
            type="date"
            value={draft.spent_at}
            onChange={(e) => onEdit({ ...draft, spent_at: e.target.value })}
          />
        </Field>
        <Field label="Merchant">
          <Input
            value={draft.merchant ?? ''}
            onChange={(e) => onEdit({ ...draft, merchant: e.target.value || null })}
          />
        </Field>
        <Field label="Category">
          <Input
            value={draft.category ?? ''}
            onChange={(e) => onEdit({ ...draft, category: e.target.value || null })}
          />
        </Field>
        <Field label="Person">
          <Input
            value={draft.person ?? ''}
            onChange={(e) => onEdit({ ...draft, person: e.target.value || null })}
          />
        </Field>
        <Field label="Note">
          <Input
            value={draft.note ?? ''}
            onChange={(e) => onEdit({ ...draft, note: e.target.value || null })}
          />
        </Field>
      </div>

      {(draft.category && knownCategory === false) || (draft.person && knownPerson === false) ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Saving will add{' '}
          {draft.category && knownCategory === false && <strong>{draft.category}</strong>}
          {draft.category && knownCategory === false && draft.person && knownPerson === false
            ? ' and '
            : ''}
          {draft.person && knownPerson === false && <strong>{draft.person}</strong>}
          {' '}to your list.
        </p>
      ) : null}

      {draft.items.length > 0 && (
        <ul className="space-y-1 border-t border-neutral-100 pt-3 text-sm">
          {draft.items.map((it, i) => (
            <li key={i} className="flex justify-between text-neutral-600">
              <span>{it.name}</span>
              <span>{formatMoney(it.amount_cents, draft.currency)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving} className="flex-1">
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="ghost" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
      </div>
    </Card>
  );
}

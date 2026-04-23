import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, expensesApi, peopleApi } from '../api/endpoints';
import type { Expense } from '../api/types';
import { Button, Card, Field, Input } from '../components/ui';
import { formatMoney } from '../lib/format';

export function ExpensesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Expense | null>(null);
  const list = useQuery({ queryKey: ['expenses'], queryFn: () => expensesApi.list() });
  const categories = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const people = useQuery({ queryKey: ['people'], queryFn: peopleApi.list });

  const catMap = useMemo(
    () => new Map(categories.data?.map((c) => [c.id, c]) ?? []),
    [categories.data],
  );
  const peopleMap = useMemo(
    () => new Map(people.data?.map((p) => [p.id, p]) ?? []),
    [people.data],
  );

  const remove = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  if (list.isPending) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (list.isError) return <p className="text-sm text-red-600">Failed to load expenses.</p>;
  if (!list.data?.length)
    return (
      <Card className="text-center text-sm text-neutral-500">
        No expenses yet. Go to Entry and add one.
      </Card>
    );

  return (
    <div className="space-y-2">
      {list.data.map((e) => {
        const cat = e.categoryId ? catMap.get(e.categoryId) : null;
        const person = e.personId ? peopleMap.get(e.personId) : null;
        return (
          <Card key={e.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <span>{e.spentAt}</span>
                {cat && (
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
                    {cat.icon ? `${cat.icon} ` : ''}
                    {cat.name}
                  </span>
                )}
                {person && (
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{person.name}</span>
                )}
              </div>
              <div className="truncate text-base">
                {e.merchant || e.note || <span className="text-neutral-400">—</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{formatMoney(e.amountCents, e.currency)}</div>
              <div className="flex justify-end gap-1 text-xs">
                <button className="text-neutral-500 hover:underline" onClick={() => setEditing(e)}>
                  Edit
                </button>
                <button
                  className="text-red-600 hover:underline"
                  onClick={() => {
                    if (confirm('Delete this expense?')) remove.mutate(e.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </Card>
        );
      })}

      {editing && <EditModal expense={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditModal({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(expense.amountCents / 100);
  const [currency, setCurrency] = useState(expense.currency);
  const [spentAt, setSpentAt] = useState(expense.spentAt);
  const [merchant, setMerchant] = useState(expense.merchant ?? '');
  const [note, setNote] = useState(expense.note ?? '');
  const [categoryName, setCategoryName] = useState('');
  const [personName, setPersonName] = useState('');
  const categories = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const people = useQuery({ queryKey: ['people'], queryFn: peopleApi.list });
  const [categoryId, setCategoryId] = useState(expense.categoryId);
  const [personId, setPersonId] = useState(expense.personId);

  const save = useMutation({
    mutationFn: () =>
      expensesApi.update(expense.id, {
        amount_cents: Math.round(amount * 100),
        currency: currency as never,
        spent_at: spentAt,
        merchant: merchant || null,
        note: note || null,
        category_id: categoryId,
        category_name: categoryId ? null : categoryName || null,
        person_id: personId,
        person_name: personId ? null : personName || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['people'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4">
      <Card className="w-full max-w-md space-y-3">
        <h2 className="text-lg font-semibold">Edit expense</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </Field>
          <Field label="Currency">
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </Field>
          <Field label="Date">
            <Input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
          </Field>
          <Field label="Merchant">
            <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          </Field>
          <Field label="Category">
            <select
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={categoryId ?? ''}
              onChange={(e) => {
                setCategoryId(e.target.value || null);
                setCategoryName('');
              }}
            >
              <option value="">— none —</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {!categoryId && (
              <Input
                className="mt-2"
                placeholder="…or type a new name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
            )}
          </Field>
          <Field label="Person">
            <select
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={personId ?? ''}
              onChange={(e) => {
                setPersonId(e.target.value || null);
                setPersonName('');
              }}
            >
              <option value="">— none —</option>
              {people.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {!personId && (
              <Input
                className="mt-2"
                placeholder="…or type a new name"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

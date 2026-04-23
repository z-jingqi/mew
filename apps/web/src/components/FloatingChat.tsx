import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronUp, Send, Sparkles, X } from 'lucide-react';
import type { ParsedExpense } from '@mew/shared';
import { categoriesApi, expensesApi, peopleApi } from '../api/endpoints';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { errorMessage } from '../lib/errors';
import { formatMoney, todayLocalIso } from '../lib/format';
import { cn } from '@/lib/utils';

type Message =
  | { id: string; role: 'user'; text: string; ts: number }
  | {
      id: string;
      role: 'assistant';
      status: 'parsing' | 'error' | 'draft' | 'saved' | 'discarded';
      draft: ParsedExpense | null;
      error: string | null;
      ts: number;
    };

export function FloatingChat({ onSaved }: { onSaved: (iso: string) => void }) {
  const qc = useQueryClient();
  const categories = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const people = useQuery({ queryKey: ['people'], queryFn: peopleApi.list });

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const parseMut = useMutation({
    mutationFn: (args: { input: string; msgId: string }) =>
      expensesApi.parse(args.input, todayLocalIso()).then((res) => ({ ...args, res })),
    onSuccess: ({ msgId, res }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.role === 'assistant'
            ? { ...m, status: 'draft', draft: res.expense, error: null }
            : m,
        ),
      );
    },
    onError: (err, args) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === args.msgId && m.role === 'assistant'
            ? {
                ...m,
                status: 'error',
                draft: null,
                error: errorMessage(err, 'Could not understand that entry.'),
              }
            : m,
        ),
      );
    },
  });

  const saveMut = useMutation({
    mutationFn: async (args: { msgId: string; expense: ParsedExpense }) => {
      const { expense } = args;
      const matchCategoryId = expense.category
        ? categories.data?.find(
            (c) => c.name.toLowerCase() === expense.category!.toLowerCase(),
          )?.id ?? null
        : null;
      const matchPersonId = expense.person
        ? people.data?.find((p) => p.name.toLowerCase() === expense.person!.toLowerCase())?.id ??
          null
        : null;
      await expensesApi.create({
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
      return args;
    },
    onSuccess: ({ msgId, expense }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.role === 'assistant'
            ? { ...m, status: 'saved', draft: expense }
            : m,
        ),
      );
      onSaved(expense.spent_at);
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['people'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err, args) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === args.msgId && m.role === 'assistant'
            ? { ...m, status: 'error', error: errorMessage(err, 'Could not save this expense.') }
            : m,
        ),
      );
    },
  });

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const input = text.trim();
    if (!input || parseMut.isPending) return;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: input,
      ts: Date.now(),
    };
    const asstMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      status: 'parsing',
      draft: null,
      error: null,
      ts: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setText('');
    setExpanded(true);
    parseMut.mutate({ input, msgId: asstMsg.id });
  }

  function updateDraft(msgId: string, next: ParsedExpense) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.role === 'assistant' ? { ...m, draft: next } : m,
      ),
    );
  }

  function discard(msgId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.role === 'assistant' ? { ...m, status: 'discarded' } : m,
      ),
    );
  }

  useEffect(() => {
    if (!expanded) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, expanded]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && expanded) setExpanded(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const hasMessages = messages.length > 0;
  const showPanel = expanded && hasMessages;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 sm:bottom-6">
      <div
        className={cn(
          'pointer-events-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-background/95 shadow-xl backdrop-blur transition-all',
          showPanel ? 'h-[min(70vh,640px)]' : 'h-auto',
        )}
      >
        {showPanel && (
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                categories={categories.data ?? []}
                people={people.data ?? []}
                onEdit={updateDraft}
                onSave={(expense) => saveMut.mutate({ msgId: m.id, expense })}
                onDiscard={() => discard(m.id)}
                saving={saveMut.isPending && saveMut.variables?.msgId === m.id}
              />
            ))}
          </div>
        )}

        <form
          onSubmit={submit}
          className={cn(
            'flex items-center gap-2 px-3 py-3',
            showPanel && 'border-t',
          )}
        >
          <Sparkles className="size-4 shrink-0 text-primary" />
          <Input
            placeholder="lunch w/ alex 28 today"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => hasMessages && setExpanded(true)}
            className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          {hasMessages && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? 'Collapse history' : 'Expand history'}
            >
              {expanded ? <ChevronDown /> : <ChevronUp />}
            </Button>
          )}
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={!text.trim() || parseMut.isPending}
            aria-label="Send"
          >
            <Send />
          </Button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  categories,
  people,
  onEdit,
  onSave,
  onDiscard,
  saving,
}: {
  message: Message;
  categories: Array<{ id: string; name: string }>;
  people: Array<{ id: string; name: string }>;
  onEdit: (msgId: string, next: ParsedExpense) => void;
  onSave: (expense: ParsedExpense) => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[92%]">
        {message.status === 'parsing' && (
          <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
            <span className="inline-block size-2 animate-pulse rounded-full bg-muted-foreground/60" />
            Parsing…
          </div>
        )}
        {message.status === 'error' && (
          <div className="rounded-2xl rounded-bl-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {message.error}
          </div>
        )}
        {message.status === 'draft' && message.draft && (
          <DraftCard
            draft={message.draft}
            categories={categories}
            people={people}
            onEdit={(next) => onEdit(message.id, next)}
            onSave={() => onSave(message.draft!)}
            onDiscard={onDiscard}
            saving={saving}
          />
        )}
        {message.status === 'saved' && message.draft && (
          <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            <Check className="size-4" />
            Saved{' '}
            <strong className="tabular-nums">
              {formatMoney(message.draft.amount_cents, message.draft.currency)}
            </strong>
            <span className="text-muted-foreground">· {message.draft.spent_at}</span>
          </div>
        )}
        {message.status === 'discarded' && (
          <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-xs text-muted-foreground">
            <X className="size-3" />
            Discarded
          </div>
        )}
      </div>
    </div>
  );
}

function DraftCard({
  draft,
  categories,
  people,
  onEdit,
  onSave,
  onDiscard,
  saving,
}: {
  draft: ParsedExpense;
  categories: Array<{ id: string; name: string }>;
  people: Array<{ id: string; name: string }>;
  onEdit: (next: ParsedExpense) => void;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
}) {
  const knownCategory = useMemo(
    () =>
      draft.category
        ? categories.some((c) => c.name.toLowerCase() === draft.category!.toLowerCase())
        : undefined,
    [draft.category, categories],
  );
  const knownPerson = useMemo(
    () =>
      draft.person
        ? people.some((p) => p.name.toLowerCase() === draft.person!.toLowerCase())
        : undefined,
    [draft.person, people],
  );

  return (
    <div className="space-y-3 rounded-2xl rounded-bl-sm border bg-muted/40 p-3">
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-semibold tabular-nums">
          {formatMoney(draft.amount_cents, draft.currency)}
        </div>
        <div className="text-xs text-muted-foreground">{draft.spent_at}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Amount">
          <Input
            type="number"
            step="0.01"
            value={(draft.amount_cents / 100).toFixed(2)}
            onChange={(e) =>
              onEdit({ ...draft, amount_cents: Math.round(Number(e.target.value || '0') * 100) })
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

      {((draft.category && knownCategory === false) ||
        (draft.person && knownPerson === false)) && (
        <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          Will add{' '}
          {draft.category && knownCategory === false && <strong>{draft.category}</strong>}
          {draft.category &&
          knownCategory === false &&
          draft.person &&
          knownPerson === false
            ? ' and '
            : ''}
          {draft.person && knownPerson === false && <strong>{draft.person}</strong>} to your list.
        </p>
      )}

      {draft.items.length > 0 && (
        <ul className="space-y-1 border-t pt-2 text-xs">
          {draft.items.map((it, i) => (
            <li key={i} className="flex justify-between text-muted-foreground">
              <span>{it.name}</span>
              <span className="tabular-nums">
                {formatMoney(it.amount_cents, draft.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving} className="flex-1" size="sm">
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

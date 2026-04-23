import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/endpoints';
import { Card } from '../components/ui';
import { formatMoney, monthRange } from '../lib/format';

export function DashboardPage() {
  const range = useMemo(monthRange, []);
  const q = useQuery({
    queryKey: ['dashboard', range.from, range.to],
    queryFn: () => dashboardApi.summary(range.from, range.to),
  });

  if (q.isPending) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (q.isError) return <p className="text-sm text-red-600">Failed to load dashboard.</p>;
  const data = q.data!;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold">
          {new Date(range.from).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h1>
        <p className="text-sm text-neutral-500">
          {range.from} → {range.to}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {data.byCurrency.length === 0 && (
          <Card className="text-sm text-neutral-500">No spending this month yet.</Card>
        )}
        {data.byCurrency.map((row) => (
          <Card key={row.currency}>
            <div className="text-xs uppercase tracking-wide text-neutral-500">{row.currency}</div>
            <div className="text-2xl font-semibold">{formatMoney(row.total, row.currency)}</div>
            <div className="text-xs text-neutral-500">{row.count} entries</div>
          </Card>
        ))}
      </section>

      {data.insight && (
        <Card className="space-y-2 border-amber-200 bg-amber-50">
          <div className="text-xs uppercase tracking-wide text-amber-800">
            Last week ({data.insight.weekStart} → {data.insight.weekEnd})
          </div>
          <p className="text-sm text-amber-950">{data.insight.summary}</p>
          {data.insight.highlights.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-950">
              {data.insight.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
          {data.insight.suggestion && (
            <p className="text-sm italic text-amber-950">💡 {data.insight.suggestion}</p>
          )}
        </Card>
      )}

      <BarSection title="By category" data={data.byCategory.map(toCatRow)} />
      <BarSection title="By person" data={data.byPerson.map(toPersonRow)} />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Recent
        </h2>
        <div className="space-y-1">
          {data.recent.map((r) => (
            <Card key={r.id} className="flex items-center justify-between py-2">
              <div className="min-w-0">
                <div className="text-xs text-neutral-500">{r.spentAt}</div>
                <div className="truncate text-sm">
                  {r.merchant || r.note || r.categoryName || '—'}
                </div>
              </div>
              <div className="text-sm font-medium">{formatMoney(r.amountCents, r.currency)}</div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

interface BarRow {
  label: string;
  currency: string;
  total: number;
  count: number;
}

function toCatRow(row: {
  currency: string;
  categoryName: string | null;
  categoryIcon: string | null;
  total: number;
  count: number;
}): BarRow {
  return {
    label: `${row.categoryIcon ?? ''}${row.categoryIcon ? ' ' : ''}${row.categoryName ?? 'Uncategorized'}`,
    currency: row.currency,
    total: row.total,
    count: row.count,
  };
}

function toPersonRow(row: {
  currency: string;
  personName: string | null;
  total: number;
  count: number;
}): BarRow {
  return {
    label: row.personName ?? '(solo)',
    currency: row.currency,
    total: row.total,
    count: row.count,
  };
}

function BarSection({ title, data }: { title: string; data: BarRow[] }) {
  if (!data.length) return null;
  const byCurrency = new Map<string, BarRow[]>();
  for (const r of data) {
    const arr = byCurrency.get(r.currency) ?? [];
    arr.push(r);
    byCurrency.set(r.currency, arr);
  }
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      <div className="space-y-4">
        {Array.from(byCurrency.entries()).map(([currency, rows]) => {
          const max = Math.max(...rows.map((r) => r.total));
          return (
            <Card key={currency}>
              <div className="mb-2 text-xs text-neutral-500">{currency}</div>
              <div className="space-y-2">
                {rows
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map((r) => (
                    <div key={`${currency}:${r.label}`}>
                      <div className="flex justify-between text-sm">
                        <span>{r.label}</span>
                        <span>{formatMoney(r.total, currency)}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full bg-neutral-900"
                          style={{ width: `${max ? (r.total / max) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, ChevronLeft, ChevronRight, PieChart as PieIcon } from 'lucide-react';
import { categoriesApi, expensesApi, peopleApi } from '../api/endpoints';
import type { Category, Expense, ExpenseItem, Person } from '../api/types';
import { useAuth } from '../auth/context';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { FloatingChat } from '../components/FloatingChat';
import { UserMenu } from '../components/UserMenu';
import { formatMoney } from '../lib/format';
import { cn } from '@/lib/utils';

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
];

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function monthBounds(ref: Date): { from: string; to: string; first: Date; last: Date } {
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { from: isoDate(first), to: isoDate(last), first, last };
}

export function DashboardPage() {
  const today = useMemo(() => new Date(), []);
  const [monthRef, setMonthRef] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(isoDate(today));
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [detailId, setDetailId] = useState<string | null>(null);

  const { me } = useAuth();
  const primaryCurrency = me?.defaultCurrency ?? 'USD';

  const bounds = useMemo(() => monthBounds(monthRef), [monthRef]);

  const expenses = useQuery({
    queryKey: ['expenses', bounds.from, bounds.to],
    queryFn: () => expensesApi.list(bounds.from, bounds.to),
  });
  const categories = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });
  const people = useQuery({ queryKey: ['people'], queryFn: peopleApi.list });

  const catMap = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  );
  const peopleMap = useMemo(
    () => new Map((people.data ?? []).map((p) => [p.id, p])),
    [people.data],
  );

  const monthExpenses = expenses.data ?? [];
  const selectedExpenses = monthExpenses.filter((e) => e.spentAt === selected);

  const dayTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of monthExpenses) {
      if (e.currency !== primaryCurrency) continue;
      map.set(e.spentAt, (map.get(e.spentAt) ?? 0) + e.amountCents);
    }
    return map;
  }, [monthExpenses, primaryCurrency]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    for (const e of selectedExpenses) {
      if (e.currency !== primaryCurrency) continue;
      const cat = e.categoryId ? catMap.get(e.categoryId) : null;
      const key = cat?.id ?? '__uncat';
      const name = cat ? `${cat.icon ? cat.icon + ' ' : ''}${cat.name}` : 'Uncategorized';
      const existing = map.get(key);
      if (existing) existing.total += e.amountCents;
      else map.set(key, { name, total: e.amountCents });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [selectedExpenses, catMap, primaryCurrency]);

  return (
    <>
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 pb-48 sm:px-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Daily spending ({primaryCurrency})</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMonthRef((d) => addMonths(d, -1))}
                aria-label="Previous month"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const t = new Date();
                  setMonthRef(new Date(t.getFullYear(), t.getMonth(), 1));
                  setSelected(isoDate(t));
                }}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setMonthRef((d) => addMonths(d, 1))}
                aria-label="Next month"
              >
                <ChevronRight />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <MonthCalendar
              first={bounds.first}
              last={bounds.last}
              dayTotals={dayTotals}
              currency={primaryCurrency}
              selected={selected}
              todayIso={isoDate(today)}
              onSelect={setSelected}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">By category</CardTitle>
              <p className="text-xs text-muted-foreground">
                {new Date(selected).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
                {' · '}
                {primaryCurrency}
              </p>
            </div>
            <div className="flex rounded-md border">
              <Button
                variant={chartType === 'bar' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-r-none"
                onClick={() => setChartType('bar')}
              >
                <BarChart3 />
                Bar
              </Button>
              <Button
                variant={chartType === 'pie' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-l-none"
                onClick={() => setChartType('pie')}
              >
                <PieIcon />
                Pie
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No {primaryCurrency} spending on this day.
              </p>
            ) : chartType === 'bar' ? (
              <CategoryBarChart data={categoryBreakdown} currency={primaryCurrency} />
            ) : (
              <CategoryPieChart data={categoryBreakdown} currency={primaryCurrency} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Expenses</CardTitle>
            <p className="text-xs text-muted-foreground">
              {selectedExpenses.length} {selectedExpenses.length === 1 ? 'entry' : 'entries'} on{' '}
              {selected}
            </p>
          </CardHeader>
          <CardContent>
            <DayExpensesTable
              expenses={selectedExpenses}
              catMap={catMap}
              peopleMap={peopleMap}
              onOpenDetails={setDetailId}
            />
          </CardContent>
        </Card>
      </div>

      <FloatingChat
        onSaved={(iso) => {
          setSelected(iso);
          const d = new Date(iso);
          setMonthRef(new Date(d.getFullYear(), d.getMonth(), 1));
        }}
      />
      <UserMenu />

      <ExpenseDetailDialog
        expenseId={detailId}
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
      />
    </>
  );
}

function MonthCalendar({
  first,
  last,
  dayTotals,
  currency,
  selected,
  todayIso,
  onSelect,
}: {
  first: Date;
  last: Date;
  dayTotals: Map<string, number>;
  currency: string;
  selected: string;
  todayIso: string;
  onSelect: (iso: string) => void;
}) {
  const firstWeekday = first.getDay();
  const daysInMonth = last.getDate();

  const cells: Array<{ iso?: string; day?: number; total?: number }> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({});
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(first.getFullYear(), first.getMonth(), d);
    const iso = isoDate(dt);
    cells.push({ iso, day: d, total: dayTotals.get(iso) });
  }
  while (cells.length % 7 !== 0) cells.push({});

  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {weekdayLabels.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell.iso) return <div key={i} className="h-20" />;
          const isSelected = cell.iso === selected;
          const isToday = cell.iso === todayIso;
          const hasSpend = typeof cell.total === 'number' && cell.total > 0;
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelect(cell.iso!)}
              className={cn(
                'group flex h-20 flex-col items-stretch rounded-md border p-1.5 text-left transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:bg-accent',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    isToday && 'bg-primary text-primary-foreground',
                  )}
                >
                  {cell.day}
                </span>
              </div>
              <div className="mt-auto">
                {hasSpend ? (
                  <div className="truncate text-xs font-medium tabular-nums">
                    {formatMoney(cell.total!, currency)}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground/50">—</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryBarChart({
  data,
  currency,
}: {
  data: Array<{ name: string; total: number }>;
  currency: string;
}) {
  const chartData = data.map((d) => ({ name: d.name, value: d.total / 100 }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
          />
          <YAxis hide />
          <RechartsTooltip
            cursor={{ fill: 'var(--color-accent)' }}
            contentStyle={{
              background: 'var(--color-popover)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(v) => formatMoney(Math.round(Number(v) * 100), currency)}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v) => formatMoney(Math.round(Number(v) * 100), currency)}
              style={{ fontSize: 11, fill: 'var(--color-foreground)' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryPieChart({
  data,
  currency,
}: {
  data: Array<{ name: string; total: number }>;
  currency: string;
}) {
  const chartData = data.map((d) => ({ name: d.name, value: d.total / 100 }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <RechartsTooltip
            contentStyle={{
              background: 'var(--color-popover)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(v) => formatMoney(Math.round(Number(v) * 100), currency)}
          />
          <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="45%"
            outerRadius={90}
            innerRadius={40}
            paddingAngle={2}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function DayExpensesTable({
  expenses,
  catMap,
  peopleMap,
  onOpenDetails,
}: {
  expenses: Expense[];
  catMap: Map<string, Category>;
  peopleMap: Map<string, Person>;
  onOpenDetails: (id: string) => void;
}) {
  if (expenses.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No expenses.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Merchant / note</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Person</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((e) => {
          const hasDetails = (e.itemCount ?? 0) > 0;
          const cat = e.categoryId ? catMap.get(e.categoryId) : null;
          const person = e.personId ? peopleMap.get(e.personId) : null;
          return (
            <TableRow
              key={e.id}
              className={cn(hasDetails && 'cursor-pointer')}
              onClick={hasDetails ? () => onOpenDetails(e.id) : undefined}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span>{e.merchant || e.note || '—'}</span>
                  {hasDetails && (
                    <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                      {e.itemCount} items
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {cat ? `${cat.icon ? cat.icon + ' ' : ''}${cat.name}` : '—'}
              </TableCell>
              <TableCell className="text-muted-foreground">{person?.name ?? '—'}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatMoney(e.amountCents, e.currency)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ExpenseDetailDialog({
  expenseId,
  open,
  onOpenChange,
}: {
  expenseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const q = useQuery({
    queryKey: ['expense', expenseId],
    queryFn: () => expensesApi.get(expenseId!),
    enabled: !!expenseId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Expense details</DialogTitle>
        </DialogHeader>
        {q.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-semibold tabular-nums">
                {formatMoney(q.data.expense.amountCents, q.data.expense.currency)}
              </div>
              <div className="text-xs text-muted-foreground">{q.data.expense.spentAt}</div>
            </div>
            {(q.data.expense.merchant || q.data.expense.note) && (
              <div className="text-sm">
                {q.data.expense.merchant && (
                  <div className="font-medium">{q.data.expense.merchant}</div>
                )}
                {q.data.expense.note && (
                  <div className="text-muted-foreground">{q.data.expense.note}</div>
                )}
              </div>
            )}
            {q.data.items.length > 0 && (
              <div className="border-t pt-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Items
                </div>
                <ul className="space-y-1 text-sm">
                  {q.data.items.map((it: ExpenseItem) => (
                    <li key={it.id} className="flex justify-between">
                      <span>{it.name}</span>
                      <span className="tabular-nums">
                        {formatMoney(it.amountCents, q.data.expense.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

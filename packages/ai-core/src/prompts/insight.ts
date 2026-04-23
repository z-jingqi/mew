/**
 * System + user prompt for the weekly insight generator.
 */

export interface InsightExpense {
  spent_at: string;
  amount_cents: number;
  currency: string;
  category: string | null;
  person: string | null;
  merchant: string | null;
  note: string | null;
}

export interface InsightContext {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  defaultCurrency: string;
  expenses: InsightExpense[];
}

export const INSIGHT_SYSTEM_PROMPT = `You are a friendly personal-finance companion.
Given a week of someone's spending, write a short, specific, non-judgmental recap.
Never give generic advice. Ground every sentence in the data you were given.
If data is sparse or missing, say so briefly instead of speculating.`;

export function buildInsightUserPrompt(ctx: InsightContext): string {
  const lines = ctx.expenses.map((e) => {
    const parts = [
      e.spent_at,
      `${(e.amount_cents / 100).toFixed(2)} ${e.currency}`,
      e.category ?? 'uncategorized',
    ];
    if (e.merchant) parts.push(`@ ${e.merchant}`);
    if (e.person) parts.push(`with ${e.person}`);
    if (e.note) parts.push(`(${e.note})`);
    return `- ${parts.join(' · ')}`;
  });

  return `Week: ${ctx.weekStart} to ${ctx.weekEnd}
Default currency: ${ctx.defaultCurrency}
Entries (${ctx.expenses.length}):
${lines.join('\n') || '- (no entries this week)'}

Return:
- summary: 2–3 sentences, specific and concrete.
- highlights: up to 3 bullets on notable patterns (biggest category, unusual spend, repeat merchant, etc.).
- suggestion: one actionable idea for next week, or null if nothing stands out.`;
}

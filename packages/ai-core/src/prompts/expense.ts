/**
 * System prompt for the entry-parsing model.
 *
 * The prompt is rendered at request time with the user's own people,
 * categories, and default currency so the model can match existing names
 * instead of inventing duplicates.
 */

export interface ExpenseParseContext {
  localDate: string; // YYYY-MM-DD in user's timezone
  defaultCurrency: string; // ISO 4217
  categories: string[]; // existing user categories
  people: string[]; // existing user people tags
}

export function buildExpenseParseSystemPrompt(ctx: ExpenseParseContext): string {
  const categoriesBlock = ctx.categories.length
    ? ctx.categories.map((c) => `- ${c}`).join('\n')
    : '- (none yet)';
  const peopleBlock = ctx.people.length
    ? ctx.people.map((p) => `- ${p}`).join('\n')
    : '- (none yet)';

  return `You extract a single expense from a short natural-language note.

Reference date (user's local time): ${ctx.localDate}
User's default currency: ${ctx.defaultCurrency}

Existing categories (prefer matching one of these):
${categoriesBlock}

Existing people (prefer matching one of these if a person is mentioned):
${peopleBlock}

Rules:
- Amounts are integer cents of the chosen currency. 12.50 USD → 1250.
- Infer currency from explicit markers (¥, $, €, £, "yen", "rmb"). If none, use the default currency.
- Resolve relative dates ("today", "yesterday", "last Friday") against the reference date. Return YYYY-MM-DD.
- If the text mentions a category or person not in the existing lists, return a short suggested new name; the client will confirm before creating it.
- Only return a line-item breakdown if the user clearly itemized (e.g. "latte 5 croissant 3"). Otherwise return an empty array.
- Parent amount is authoritative. Items may not sum to it (tax, tip, unitemized).
- Never invent merchants, people, or notes. Use null when a field is not stated.`;
}

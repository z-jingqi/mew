import { z } from 'zod';
import { CurrencySchema } from './currency';

export const ParsedExpenseItemSchema = z.object({
  name: z.string().min(1).describe('Line-item name, e.g. "latte" or "tip".'),
  amount_cents: z
    .number()
    .int()
    .nonnegative()
    .describe('Line-item amount in integer cents of the parent currency.'),
});
export type ParsedExpenseItem = z.infer<typeof ParsedExpenseItemSchema>;

export const ParsedExpenseSchema = z.object({
  amount_cents: z
    .number()
    .int()
    .nonnegative()
    .describe('Total spent, in integer cents. Authoritative even if items do not sum to it.'),
  currency: CurrencySchema.describe(
    'ISO 4217 currency code. Infer from text or fall back to the user default.',
  ),
  merchant: z
    .string()
    .nullable()
    .describe('Where the money was spent. Null if not stated.'),
  category: z
    .string()
    .nullable()
    .describe(
      'One of the user\'s existing categories if a good match, otherwise a short suggested new category name. Null if ambiguous.',
    ),
  person: z
    .string()
    .nullable()
    .describe(
      'One of the user\'s existing people if a good match, otherwise a short suggested name. Null if not mentioned.',
    ),
  spent_at: z
    .string()
    .describe('ISO 8601 date (YYYY-MM-DD) in the user\'s local timezone. Use the reference date for relative phrases like "yesterday".'),
  note: z.string().nullable().describe('Any extra context worth keeping. Null if nothing to add.'),
  items: z
    .array(ParsedExpenseItemSchema)
    .describe('Optional line-item breakdown. Empty array if not given.'),
});
export type ParsedExpense = z.infer<typeof ParsedExpenseSchema>;

/**
 * Request body for POST /api/expenses/parse.
 */
export const ParseExpenseRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  localDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe('The user\'s current local date (YYYY-MM-DD), used to resolve "today", "yesterday", etc.'),
});
export type ParseExpenseRequest = z.infer<typeof ParseExpenseRequestSchema>;

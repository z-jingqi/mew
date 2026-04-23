/**
 * Expense extractor: natural-language text → ParsedExpense (structured JSON).
 */

import { generateText, Output } from 'ai';
import { ParsedExpenseSchema, type ParsedExpense } from '@mew/shared';

import type { AIEnvironment } from '../config';
import { getParseModel, resolveModelSelection, type ResolveModelOptions } from '../registry';
import {
  buildExpenseParseSystemPrompt,
  type ExpenseParseContext,
} from '../prompts/expense';

export interface ParseExpenseInput extends ExpenseParseContext {
  text: string;
}

export interface ParseExpenseResult {
  expense: ParsedExpense;
  model: { provider: string; modelId: string };
}

export async function parseExpense(
  env: AIEnvironment,
  input: ParseExpenseInput,
  options: ResolveModelOptions = {},
): Promise<ParseExpenseResult> {
  const model = getParseModel(env, options);
  const selection = resolveModelSelection(env, 'parse', options);

  const { output } = await generateText({
    model,
    system: buildExpenseParseSystemPrompt(input),
    prompt: input.text,
    output: Output.object({ schema: ParsedExpenseSchema }),
  });

  return { expense: output, model: selection };
}

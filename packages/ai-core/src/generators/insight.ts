/**
 * Weekly insight generator: list of expenses → WeeklyInsight (structured JSON).
 */

import { generateText, Output } from 'ai';
import { WeeklyInsightSchema, type WeeklyInsight } from '@mew/shared';

import type { AIEnvironment } from '../config';
import { getInsightModel, resolveModelSelection, type ResolveModelOptions } from '../registry';
import {
  INSIGHT_SYSTEM_PROMPT,
  buildInsightUserPrompt,
  type InsightContext,
} from '../prompts/insight';

export interface GenerateInsightResult {
  insight: WeeklyInsight;
  model: { provider: string; modelId: string };
}

export async function generateWeeklyInsight(
  env: AIEnvironment,
  ctx: InsightContext,
  options: ResolveModelOptions = {},
): Promise<GenerateInsightResult> {
  const model = getInsightModel(env, options);
  const selection = resolveModelSelection(env, 'insight', options);

  const { output } = await generateText({
    model,
    system: INSIGHT_SYSTEM_PROMPT,
    prompt: buildInsightUserPrompt(ctx),
    output: Output.object({ schema: WeeklyInsightSchema }),
  });

  return { insight: output, model: selection };
}

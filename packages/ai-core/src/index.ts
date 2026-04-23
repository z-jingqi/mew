/**
 * @mew/ai-core
 * Vercel AI SDK wrappers with multi-provider support.
 * Default provider: Cloudflare Workers AI (via binding).
 */

export const aiCoreVersion = '0.0.1';

// Config
export { getAIConfig, isProviderConfigured, SUPPORTED_PROVIDERS } from './config';
export type { AIConfig, AIEnvironment, ModelProvider } from './config';

// Registry
export {
  getModelInstance,
  getModelForTask,
  getParseModel,
  getInsightModel,
  resolveModelSelection,
} from './registry';
export type { ModelTask, ResolveModelOptions } from './registry';

// Extractors / generators
export { parseExpense } from './extractors/expense';
export type { ParseExpenseInput, ParseExpenseResult } from './extractors/expense';

export { generateWeeklyInsight } from './generators/insight';
export type { GenerateInsightResult } from './generators/insight';

// Prompts (exported so callers can inspect or override)
export { buildExpenseParseSystemPrompt } from './prompts/expense';
export type { ExpenseParseContext } from './prompts/expense';

export { INSIGHT_SYSTEM_PROMPT, buildInsightUserPrompt } from './prompts/insight';
export type { InsightContext, InsightExpense } from './prompts/insight';

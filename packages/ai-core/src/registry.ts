/**
 * Model registry — task-based selection with per-provider defaults.
 *
 * Two tasks for Mew:
 *   - `parse`   Cheap + fast. Expense-entry extraction.
 *   - `insight` Higher quality. Weekly summaries.
 *
 * Any call can override the provider and/or model explicitly.
 */

import type { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createWorkersAI, type WorkersAI, type WorkersAISettings } from 'workers-ai-provider';

import { getAIConfig, type AIEnvironment, type ModelProvider } from './config';

export type ModelTask = 'parse' | 'insight';

const DEFAULT_MODELS: Record<ModelProvider, Record<ModelTask, string>> = {
  cloudflare: {
    parse: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    insight: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  },
  openrouter: {
    parse: 'google/gemini-2.5-flash',
    insight: 'anthropic/claude-sonnet-4.5',
  },
  anthropic: {
    parse: 'claude-haiku-4-5-20251001',
    insight: 'claude-sonnet-4-6',
  },
};

export interface ResolveModelOptions {
  /** Override the configured default provider. */
  provider?: ModelProvider;
  /** Override the provider's default model id for this task. */
  modelId?: string;
}

/**
 * Build a concrete `LanguageModel` for a provider + model id.
 *
 * `env.AI` (the Worker binding) is read for the `cloudflare` provider.
 * For other providers the API key comes from env vars.
 */
export function getModelInstance(
  provider: ModelProvider,
  modelId: string,
  env: AIEnvironment,
): LanguageModel {
  const config = getAIConfig(env);

  switch (provider) {
    case 'cloudflare': {
      if (!config.cloudflare.binding) {
        throw new Error(
          'Cloudflare Workers AI binding is not available. Add `[ai] binding = "AI"` to wrangler.toml.',
        );
      }
      const workersai = createWorkersAI({
        binding: config.cloudflare.binding,
      } as WorkersAISettings);
      return workersai(modelId as Parameters<WorkersAI>[0]);
    }

    case 'openrouter': {
      if (!config.openrouter.apiKey) throw new Error('OPENROUTER_API_KEY is not set.');
      const openrouter = createOpenRouter({ apiKey: config.openrouter.apiKey });
      return openrouter(modelId);
    }

    case 'anthropic': {
      if (!config.anthropic.apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');
      const anthropic = createAnthropic({ apiKey: config.anthropic.apiKey });
      return anthropic(modelId);
    }
  }
}

/**
 * Resolve `{ provider, modelId }` for a task without instantiating the model.
 * Useful for logging / storing which model was used.
 */
export function resolveModelSelection(
  env: AIEnvironment,
  task: ModelTask,
  options: ResolveModelOptions = {},
): { provider: ModelProvider; modelId: string } {
  const config = getAIConfig(env);
  const provider = options.provider ?? config.defaultProvider;
  const modelId = options.modelId ?? DEFAULT_MODELS[provider][task];
  return { provider, modelId };
}

/**
 * Shortcut: resolve + instantiate the model for a task.
 */
export function getModelForTask(
  env: AIEnvironment,
  task: ModelTask,
  options: ResolveModelOptions = {},
): LanguageModel {
  const { provider, modelId } = resolveModelSelection(env, task, options);
  return getModelInstance(provider, modelId, env);
}

/** Convenience wrappers — mirrors AI-chart's getVisionModel/getReasoningModel pattern. */
export function getParseModel(env: AIEnvironment, options?: ResolveModelOptions): LanguageModel {
  return getModelForTask(env, 'parse', options);
}

export function getInsightModel(env: AIEnvironment, options?: ResolveModelOptions): LanguageModel {
  return getModelForTask(env, 'insight', options);
}

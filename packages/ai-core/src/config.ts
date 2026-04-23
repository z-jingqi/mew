/**
 * Provider config resolved from Worker env.
 *
 * Default provider is Cloudflare Workers AI (binding-based). The other
 * providers are opt-in fallbacks: set DEFAULT_PROVIDER + the relevant API key.
 */

export type ModelProvider = 'cloudflare' | 'openrouter' | 'anthropic';

export const SUPPORTED_PROVIDERS: readonly ModelProvider[] = [
  'cloudflare',
  'openrouter',
  'anthropic',
] as const;

export interface AIEnvironment {
  DEFAULT_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  /** Cloudflare Workers AI binding. Populated automatically on Workers. */
  AI?: unknown;
}

export interface AIConfig {
  defaultProvider: ModelProvider;
  anthropic: { apiKey: string };
  openrouter: { apiKey: string };
  cloudflare: { binding: unknown | null };
}

export function getAIConfig(env: AIEnvironment): AIConfig {
  const defaultProvider = resolveDefaultProvider(env);
  return {
    defaultProvider,
    anthropic: { apiKey: env.ANTHROPIC_API_KEY ?? '' },
    openrouter: { apiKey: env.OPENROUTER_API_KEY ?? '' },
    cloudflare: { binding: env.AI ?? null },
  };
}

export function isProviderConfigured(provider: ModelProvider, env: AIEnvironment): boolean {
  switch (provider) {
    case 'cloudflare':
      return !!env.AI;
    case 'anthropic':
      return !!env.ANTHROPIC_API_KEY;
    case 'openrouter':
      return !!env.OPENROUTER_API_KEY;
  }
}

function resolveDefaultProvider(env: AIEnvironment): ModelProvider {
  if (env.DEFAULT_PROVIDER && isValidProvider(env.DEFAULT_PROVIDER)) {
    return env.DEFAULT_PROVIDER;
  }
  // Auto-detect — Cloudflare binding first, then paid APIs.
  if (env.AI) return 'cloudflare';
  if (env.OPENROUTER_API_KEY) return 'openrouter';
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'cloudflare';
}

function isValidProvider(value: string): value is ModelProvider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(value);
}

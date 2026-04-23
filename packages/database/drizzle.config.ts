import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  casing: 'snake_case',
} satisfies Config;

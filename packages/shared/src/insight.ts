import { z } from 'zod';

/**
 * AI-generated weekly summary shown on the dashboard.
 */
export const WeeklyInsightSchema = z.object({
  summary: z
    .string()
    .describe('Two or three short sentences. Friendly, concrete, no generic advice.'),
  highlights: z
    .array(z.string())
    .describe('Up to 3 bullets calling out specific patterns (biggest category, unusual spend, etc.).'),
  suggestion: z
    .string()
    .nullable()
    .describe('One optional, actionable suggestion for next week. Null if nothing stands out.'),
});
export type WeeklyInsight = z.infer<typeof WeeklyInsightSchema>;

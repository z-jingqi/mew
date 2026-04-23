import { z } from 'zod';

export const SUPPORTED_CURRENCIES = ['USD', 'CNY', 'EUR', 'JPY', 'GBP'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const CurrencySchema = z.enum(SUPPORTED_CURRENCIES);

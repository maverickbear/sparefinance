/**
 * Domain constants for accounts
 */

export const ACCOUNT_TYPES = {
  CASH: 'cash',
  CHECKING: 'checking',
  SAVINGS: 'savings',
  CREDIT: 'credit',
  INVESTMENT: 'investment',
  OTHER: 'other',
} as const;

export const CURRENCY_CODES = {
  USD: 'USD',
  CAD: 'CAD',
  EUR: 'EUR',
  GBP: 'GBP',
  MXN: 'MXN',
  AUD: 'AUD',
  JPY: 'JPY',
  CHF: 'CHF',
  NZD: 'NZD',
  BRL: 'BRL',
} as const;

export const DEFAULT_CURRENCY = 'USD';

export const ACCOUNT_CACHE_TTL = 2000; // 2 seconds - accounts change frequently


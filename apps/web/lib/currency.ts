// Display-currency formatting. Mirrors apps/api/app/core/currency.py — amounts
// are stored as minor units (cents); currency only changes the symbol and the
// number of decimals shown. No conversion. Zero-decimal currencies (PKR) render
// "Rs 630", not "Rs 630.00".

interface CurrencyDef {
  symbol: string;
  decimals: number;
  label: string;
}

export const CURRENCIES: Record<string, CurrencyDef> = {
  USD: { symbol: '$', decimals: 2, label: 'US Dollar' },
  PKR: { symbol: 'Rs', decimals: 0, label: 'Pakistani Rupee' },
  AED: { symbol: 'AED', decimals: 2, label: 'UAE Dirham' },
  SAR: { symbol: 'SAR', decimals: 2, label: 'Saudi Riyal' },
  GBP: { symbol: '£', decimals: 2, label: 'British Pound' },
  EUR: { symbol: '€', decimals: 2, label: 'Euro' },
  INR: { symbol: '₹', decimals: 2, label: 'Indian Rupee' },
};

export const DEFAULT_CURRENCY = 'USD';

export const CURRENCY_OPTIONS = Object.entries(CURRENCIES).map(([code, def]) => ({
  code,
  label: `${code} — ${def.label} (${def.symbol})`,
}));

function cfg(currency: string | null | undefined): CurrencyDef {
  return CURRENCIES[(currency ?? DEFAULT_CURRENCY).toUpperCase()] ?? CURRENCIES[DEFAULT_CURRENCY]!;
}

/** e.g. formatMoney(63000, 'PKR') -> 'Rs 630'; formatMoney(1450, 'USD') -> '$14.50' */
export function formatMoney(cents: number, currency: string | null | undefined): string {
  const c = cfg(currency);
  const sep = c.symbol.length > 1 ? ' ' : '';
  const amount = (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  });
  return `${c.symbol}${sep}${amount}`;
}

'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_CURRENCY, formatMoney } from '@/lib/currency';

const CurrencyContext = createContext<string>(DEFAULT_CURRENCY);

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: string;
  children: React.ReactNode;
}) {
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

/** The active workspace's currency code (e.g. "PKR"). */
export function useCurrency(): string {
  return useContext(CurrencyContext);
}

/** Format cents in the active workspace currency, from a client component. */
export function useMoney(): (cents: number) => string {
  const currency = useCurrency();
  return (cents: number) => formatMoney(cents, currency);
}

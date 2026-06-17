'use client';

import { useEffect } from 'react';

/**
 * Opens the browser print dialog automatically once on mount.
 * Used on the receipt page so opening it in a new tab triggers print without
 * an extra click. User can dismiss the dialog and stay on the page to reprint.
 */
export function PrintOnMount() {
  useEffect(() => {
    // Small delay so the page paint is settled before the dialog opens.
    // Without this, Chrome occasionally prints a half-rendered receipt.
    const t = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}

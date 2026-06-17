'use client';

import { Printer, X } from 'lucide-react';

export function ReceiptActions() {
  return (
    <div className="mx-auto mb-8 flex max-w-md justify-center gap-2 px-6 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
      >
        <Printer className="h-4 w-4" />
        Print again
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
      >
        <X className="h-4 w-4" />
        Close
      </button>
    </div>
  );
}

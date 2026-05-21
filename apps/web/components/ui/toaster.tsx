'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast: 'rounded-lg shadow-sm border bg-card text-card-foreground',
        },
      }}
    />
  );
}

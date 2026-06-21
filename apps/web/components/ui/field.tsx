'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  help?: React.ReactNode;
}

export function Field({ label, htmlFor, error, hint, required, className, children, help }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {help ? (
        <div className="flex items-center gap-1.5">
          <Label htmlFor={htmlFor}>
            {label}
            {required && <span className="ml-0.5 text-error">*</span>}
          </Label>
          {help}
        </div>
      ) : (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

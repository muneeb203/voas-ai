'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OrderStatusBadge } from '@/components/dashboard/order-badges';
import { updateOrderStatusAction } from '@/app/actions/orders-action';
import type { OrderStatus } from '@/lib/types';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

interface OrderStatusSelectorProps {
  orderId: string;
  current: OrderStatus;
  disabled?: boolean;
}

export function OrderStatusSelector({
  orderId,
  current,
  disabled,
}: OrderStatusSelectorProps) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<OrderStatus>(current);

  function handleSelect(next: OrderStatus) {
    if (next === optimistic || pending) return;
    const previous = optimistic;
    setOptimistic(next);
    startTransition(async () => {
      const { error } = await updateOrderStatusAction(orderId, next);
      if (error) {
        setOptimistic(previous);
        toast.error(error);
      } else {
        toast.success(`Order moved to ${next}.`);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled || pending}>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          <OrderStatusBadge status={optimistic} />
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {STATUS_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => handleSelect(opt.value)}
            className="flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <OrderStatusBadge status={opt.value} />
            </span>
            {opt.value === optimistic && (
              <Check className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

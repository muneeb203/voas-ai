'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createOrderAction } from '@/app/actions/order-action';

export interface MenuItemLite {
  id: string;
  name: string;
  price_cents: number;
}

export function NewOrderButton({ menuItems }: { menuItems: MenuItemLite[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const total = menuItems.reduce((sum, m) => sum + (qty[m.id] || 0) * m.price_cents, 0);
  const count = Object.values(qty).reduce((a, b) => a + b, 0);

  function bump(id: string, delta: number) {
    setQty((p) => ({ ...p, [id]: Math.max(0, (p[id] || 0) + delta) }));
  }

  function close() {
    setQty({});
    setCustomerName('');
    setCustomerPhone('');
    setOpen(false);
  }

  async function submit() {
    const items = menuItems
      .filter((m) => (qty[m.id] || 0) > 0)
      .map((m) => ({ name: m.name, quantity: qty[m.id]! }));
    if (items.length === 0) return toast.error('Add at least one item');
    setSaving(true);
    const res = await createOrderAction({
      items,
      customer_name: customerName.trim() || null,
      customer_phone: customerPhone.trim() || null,
    });
    setSaving(false);
    if (res.error) return toast.error(res.error);
    toast.success('Order created');
    close();
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={menuItems.length === 0}>
        <Plus className="h-4 w-4" /> New order
      </Button>
      <Dialog open={open} onOpenChange={(v) => !saving && (v ? setOpen(true) : close())}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              {menuItems.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ${(m.price_cents / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => bump(m.id, -1)}
                      disabled={!((qty[m.id] || 0) > 0)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">{qty[m.id] || 0}</span>
                    <Button variant="outline" size="icon" onClick={() => bump(m.id, 1)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="o-name">Customer name (optional)</Label>
                <Input
                  id="o-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-phone">Phone (optional)</Label>
                <Input
                  id="o-phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <div className="mr-auto self-center text-sm text-muted-foreground">
              {count} item{count !== 1 ? 's' : ''} · ${(total / 100).toFixed(2)} est.
            </div>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving || count === 0}>
              {saving ? 'Creating…' : 'Create order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

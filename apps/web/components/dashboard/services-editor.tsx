'use client';

import { useState, useTransition } from 'react';
import { useMoney } from '@/components/dashboard/currency-provider';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createServiceAction,
  updateServiceAction,
  deleteServiceAction,
} from '@/app/actions/salon-action';
import type { SalonService } from '@/lib/api/salon';

interface Props {
  initialServices: SalonService[];
  canEdit: boolean;
}

interface FormState {
  name: string;
  description: string;
  price: string; // dollars
  duration: string; // minutes
  buffer: string; // minutes
  active: boolean;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  price: '',
  duration: '30',
  buffer: '0',
  active: true,
};

function toForm(s: SalonService): FormState {
  return {
    name: s.name,
    description: s.description ?? '',
    price: (s.price_cents / 100).toFixed(2),
    duration: String(s.duration_minutes),
    buffer: String(s.buffer_after_minutes),
    active: s.is_active,
  };
}

export function ServicesEditor({ initialServices, canEdit }: Props) {
  const money = useMoney();
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalonService | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }
  function openEdit(s: SalonService) {
    setEditing(s);
    setForm(toForm(s));
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name is required');
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_cents: Math.round((parseFloat(form.price) || 0) * 100),
      duration_minutes: Math.max(1, parseInt(form.duration, 10) || 30),
      buffer_after_minutes: Math.max(0, parseInt(form.buffer, 10) || 0),
      is_active: form.active,
    };
    setSaving(true);
    const res = editing
      ? await updateServiceAction(editing.id, body)
      : await createServiceAction(body);
    setSaving(false);
    if (res.error) return toast.error(res.error);
    toast.success(editing ? 'Service updated' : 'Service added');
    setOpen(false);
    router.refresh();
  }

  async function handleDelete(s: SalonService) {
    if (!confirm(`Delete "${s.name}"? This can't be undone.`)) return;
    const res = await deleteServiceAction(s.id);
    if (res.error) return toast.error(res.error);
    toast.success('Service deleted');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={refreshing}
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Refresh
        </Button>
        {canEdit && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add service
          </Button>
        )}
      </div>

      {initialServices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No services yet. {canEdit ? 'Add your first treatment to start taking bookings.' : ''}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {initialServices.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{s.name}</p>
                    {!s.is_active && <Badge variant="secondary">Hidden</Badge>}
                  </div>
                  {s.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {s.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <span className="font-semibold tabular-nums">
                      {money(s.price_cents)}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {s.duration_minutes} min
                      {s.buffer_after_minutes > 0 && ` (+${s.buffer_after_minutes} buffer)`}
                    </span>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex flex-shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit service' : 'Add service'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="svc-name">Name</Label>
              <Input
                id="svc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Women's Haircut"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-desc">Description (optional)</Label>
              <Textarea
                id="svc-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="svc-price">Price ($)</Label>
                <Input
                  id="svc-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-dur">Duration (min)</Label>
                <Input
                  id="svc-dur"
                  type="number"
                  min={1}
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-buf">Buffer (min)</Label>
                <Input
                  id="svc-buf"
                  type="number"
                  min={0}
                  value={form.buffer}
                  onChange={(e) => setForm({ ...form, buffer: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Customers can book this service.</p>
              </div>
              <Switch
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

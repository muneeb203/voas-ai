'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  createStaffAction,
  updateStaffAction,
  deleteStaffAction,
} from '@/app/actions/salon-action';
import type { SalonService, SalonStaff, StaffHours } from '@/lib/api/salon';

interface Props {
  initialStaff: SalonStaff[];
  services: SalonService[];
  canEdit: boolean;
}

// Display order Mon→Sun; weekday numbers match the backend (0=Sun..6=Sat).
const DAYS: { wd: number; label: string }[] = [
  { wd: 1, label: 'Mon' },
  { wd: 2, label: 'Tue' },
  { wd: 3, label: 'Wed' },
  { wd: 4, label: 'Thu' },
  { wd: 5, label: 'Fri' },
  { wd: 6, label: 'Sat' },
  { wd: 0, label: 'Sun' },
];

interface DayState {
  on: boolean;
  start: string;
  end: string;
}

function defaultDays(): Record<number, DayState> {
  const out: Record<number, DayState> = {};
  for (const d of DAYS) {
    out[d.wd] = { on: d.wd !== 0, start: '10:00', end: '19:00' }; // Mon–Sat on
  }
  return out;
}

function daysFromHours(hours: StaffHours[]): Record<number, DayState> {
  const out = defaultDays();
  for (const d of DAYS) out[d.wd] = { on: false, start: '10:00', end: '19:00' };
  for (const h of hours) {
    out[h.weekday] = { on: true, start: h.start_time.slice(0, 5), end: h.end_time.slice(0, 5) };
  }
  return out;
}

export function StaffEditor({ initialStaff, services, canEdit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalonStaff | null>(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [active, setActive] = useState(true);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [days, setDays] = useState<Record<number, DayState>>(defaultDays());
  const [saving, setSaving] = useState(false);

  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? id;

  function openAdd() {
    setEditing(null);
    setName('');
    setTitle('');
    setActive(true);
    setServiceIds(services.map((s) => s.id)); // default: can do everything
    setDays(defaultDays());
    setOpen(true);
  }
  function openEdit(m: SalonStaff) {
    setEditing(m);
    setName(m.name);
    setTitle(m.title ?? '');
    setActive(m.is_active);
    setServiceIds(m.service_ids);
    setDays(daysFromHours(m.hours));
    setOpen(true);
  }

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Name is required');
    const hours: StaffHours[] = DAYS.filter((d) => days[d.wd]?.on).map((d) => ({
      weekday: d.wd,
      start_time: days[d.wd]!.start,
      end_time: days[d.wd]!.end,
    }));
    for (const h of hours) {
      if (h.end_time <= h.start_time) {
        return toast.error('End time must be after start time');
      }
    }
    const body = {
      name: name.trim(),
      title: title.trim() || null,
      is_active: active,
      service_ids: serviceIds,
      hours,
    };
    setSaving(true);
    const res = editing ? await updateStaffAction(editing.id, body) : await createStaffAction(body);
    setSaving(false);
    if (res.error) return toast.error(res.error);
    toast.success(editing ? 'Staff updated' : 'Staff added');
    setOpen(false);
    router.refresh();
  }

  async function handleDelete(m: SalonStaff) {
    if (!confirm(`Remove ${m.name}? Existing appointments are kept.`)) return;
    const res = await deleteStaffAction(m.id);
    if (res.error) return toast.error(res.error);
    toast.success('Staff removed');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={openAdd} disabled={services.length === 0}>
            <Plus className="h-4 w-4" /> Add staff
          </Button>
        </div>
      )}
      {services.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add at least one service first — staff are matched to the services they can perform.
        </p>
      )}

      {initialStaff.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No staff yet. {canEdit ? 'Add your team so the AI can book against their hours.' : ''}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {initialStaff.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{m.name}</p>
                      {!m.is_active && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    {m.title && <p className="text-xs text-muted-foreground">{m.title}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex flex-shrink-0 gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(m)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {m.service_ids.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No services assigned</span>
                  ) : (
                    m.service_ids.map((id) => (
                      <Badge key={id} variant="outline">
                        {serviceName(id)}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {DAYS.filter((d) => m.hours.some((h) => h.weekday === d.wd)).map((d) => (
                    <span key={d.wd} className="rounded bg-secondary px-1.5 py-0.5">
                      {d.label}
                    </span>
                  ))}
                  {m.hours.length === 0 && <span>No hours set</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit staff' : 'Add staff'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="st-name">Name</Label>
                <Input id="st-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-title">Title (optional)</Label>
                <Input
                  id="st-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Senior Stylist"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Services they can perform</p>
              <div className="flex flex-wrap gap-2">
                {services.map((s) => {
                  const on = serviceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleService(s.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        on
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Weekly hours</p>
              <div className="space-y-1.5">
                {DAYS.map((d) => {
                  const st = days[d.wd]!;
                  return (
                    <div key={d.wd} className="flex items-center gap-3">
                      <div className="flex w-20 items-center gap-2">
                        <Switch
                          checked={st.on}
                          onChange={(e) =>
                            setDays({ ...days, [d.wd]: { ...st, on: e.target.checked } })
                          }
                        />
                        <span className="text-sm">{d.label}</span>
                      </div>
                      {st.on ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={st.start}
                            onChange={(e) =>
                              setDays({ ...days, [d.wd]: { ...st, start: e.target.value } })
                            }
                            className="w-28"
                          />
                          <span className="text-muted-foreground">–</span>
                          <Input
                            type="time"
                            value={st.end}
                            onChange={(e) =>
                              setDays({ ...days, [d.wd]: { ...st, end: e.target.value } })
                            }
                            className="w-28"
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Off</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Available for new bookings.</p>
              </div>
              <Switch checked={active} onChange={(e) => setActive(e.target.checked)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add staff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

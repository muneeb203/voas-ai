'use client';

import { useState } from 'react';
import { useMoney } from '@/components/dashboard/currency-provider';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
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
import {
  getAvailabilityAction,
  bookAppointmentAction,
  rescheduleAppointmentAction,
} from '@/app/actions/salon-action';
import type { AvailabilitySlot, SalonService } from '@/lib/api/salon';

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function todayStr(): string {
  return fmtDate(new Date());
}

// Bookings are capped to one month ahead (enforced by the backend too).
function maxDateStr(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return fmtDate(d);
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: 'new' | 'reschedule';
  services: SalonService[];
  appointmentId?: string;
  fixedServiceId?: string;
  fixedServiceName?: string;
}

export function AppointmentDialog({
  open,
  onClose,
  mode,
  services,
  appointmentId,
  fixedServiceId,
  fixedServiceName,
}: Props) {
  const money = useMoney();
  const router = useRouter();
  const [serviceId, setServiceId] = useState(fixedServiceId ?? services[0]?.id ?? '');
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const activeServiceId = mode === 'reschedule' ? (fixedServiceId ?? '') : serviceId;

  function close() {
    setSlots([]);
    setSelected(null);
    setSearched(false);
    setCustomerName('');
    setCustomerPhone('');
    setDate(todayStr());
    if (mode === 'new') setServiceId(services[0]?.id ?? '');
    onClose();
  }

  async function findTimes() {
    if (!activeServiceId) return toast.error('Pick a service first');
    setLoading(true);
    setSelected(null);
    const res = await getAvailabilityAction(activeServiceId, date);
    setLoading(false);
    setSearched(true);
    if (res.error) return toast.error(res.error);
    setSlots(res.slots);
  }

  async function submit() {
    if (!selected) return toast.error('Pick a time');
    if (mode === 'new' && !customerName.trim()) return toast.error('Customer name is required');
    setSaving(true);
    const res =
      mode === 'reschedule' && appointmentId
        ? await rescheduleAppointmentAction(appointmentId, {
            starts_at: selected.starts_at,
            staff_id: selected.staff_id,
          })
        : await bookAppointmentAction({
            service_id: activeServiceId,
            starts_at: selected.starts_at,
            staff_id: selected.staff_id,
            customer_name: customerName.trim(),
            customer_phone: customerPhone.trim() || null,
          });
    setSaving(false);
    if (res.error) return toast.error(res.error);
    toast.success(mode === 'reschedule' ? 'Appointment rescheduled' : 'Appointment booked');
    close();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && !v && close()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'reschedule'
              ? `Reschedule — ${fixedServiceName ?? 'appointment'}`
              : 'New appointment'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {mode === 'new' && (
            <div className="space-y-2">
              <Label htmlFor="appt-service">Service</Label>
              <select
                id="appt-service"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setSearched(false);
                  setSlots([]);
                  setSelected(null);
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.duration_minutes} min · {money(s.price_cents)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="appt-date">Date</Label>
              <Input
                id="appt-date"
                type="date"
                min={todayStr()}
                max={maxDateStr()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSearched(false);
                  setSelected(null);
                }}
              />
            </div>
            <Button variant="outline" onClick={findTimes} disabled={loading}>
              {loading ? 'Finding…' : 'Find times'}
            </Button>
          </div>

          {searched &&
            (slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open times that day — try another date.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s, i) => {
                  const on =
                    selected?.starts_at === s.starts_at && selected?.staff_id === s.staff_id;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelected(s)}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                        on
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-foreground hover:border-muted-foreground/50'
                      }`}
                    >
                      {format(parseISO(s.starts_at), 'h:mm a')} · {s.staff_name}
                    </button>
                  );
                })}
              </div>
            ))}

          {mode === 'new' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="appt-cust">Customer name</Label>
                <Input
                  id="appt-cust"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appt-phone">Phone (for confirmation)</Label>
                <Input
                  id="appt-phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+1…"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !selected}>
            {saving ? 'Saving…' : mode === 'reschedule' ? 'Reschedule' : 'Book appointment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

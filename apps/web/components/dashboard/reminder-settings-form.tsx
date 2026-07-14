'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { updateReminderSettingsAction } from '@/app/actions/salon-action';
import type { ReminderSettings } from '@/lib/api/salon';

interface Props {
  initial: ReminderSettings;
  canEdit: boolean;
}

// Presets a salon can mix and match; each maps to minutes-before.
const LEAD_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 60, label: '1 hour before' },
  { minutes: 120, label: '2 hours before' },
  { minutes: 240, label: '4 hours before' },
  { minutes: 1440, label: '1 day before' },
  { minutes: 2880, label: '2 days before' },
];

const MAX_LEADS = 4;

export function ReminderSettingsForm({ initial, canEdit }: Props) {
  const router = useRouter();
  const [confirmations, setConfirmations] = useState(initial.send_appointment_confirmations);
  const [reminders, setReminders] = useState(initial.send_appointment_reminders);
  const [leads, setLeads] = useState<number[]>(initial.reminder_lead_minutes ?? [1440]);
  const [saving, setSaving] = useState(false);

  function toggleLead(minutes: number) {
    setLeads((prev) => {
      if (prev.includes(minutes)) return prev.filter((m) => m !== minutes);
      if (prev.length >= MAX_LEADS) {
        toast.error(`Up to ${MAX_LEADS} reminder times.`);
        return prev;
      }
      return [...prev, minutes].sort((a, b) => b - a);
    });
  }

  async function handleSave() {
    if (reminders && leads.length === 0) {
      return toast.error('Pick at least one reminder time, or turn reminders off.');
    }
    setSaving(true);
    const res = await updateReminderSettingsAction({
      send_appointment_confirmations: confirmations,
      send_appointment_reminders: reminders,
      reminder_lead_minutes: leads,
    });
    setSaving(false);
    if (res.error) return toast.error(res.error);
    toast.success('Reminder settings saved');
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Booking confirmations</p>
          <p className="text-xs text-muted-foreground">
            Text the customer a confirmation the moment an appointment is booked.
          </p>
        </div>
        <Switch
          checked={confirmations}
          disabled={!canEdit}
          onChange={(e) => setConfirmations(e.target.checked)}
        />
      </div>

      <div className="flex items-start justify-between gap-4 border-t pt-5">
        <div>
          <p className="text-sm font-medium">Appointment reminders</p>
          <p className="text-xs text-muted-foreground">
            Automatically remind customers before their appointment to cut no-shows.
          </p>
        </div>
        <Switch
          checked={reminders}
          disabled={!canEdit}
          onChange={(e) => setReminders(e.target.checked)}
        />
      </div>

      {reminders && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Send reminders (pick up to {MAX_LEADS}):
          </p>
          <div className="flex flex-wrap gap-2">
            {LEAD_PRESETS.map((p) => {
              const on = leads.includes(p.minutes);
              return (
                <button
                  key={p.minutes}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggleLead(p.minutes)}
                  className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-50 ${
                    on
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Confirmations and reminders send over WhatsApp when connected, otherwise SMS. They only go
        to customers whose phone number is on the booking, and require your messaging channel to be
        set up under Integrations.
      </p>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      )}
    </div>
  );
}

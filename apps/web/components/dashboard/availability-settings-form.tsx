'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type DayHours = { enabled: boolean; start: string; end: string };

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

const DEFAULT_HOURS: Record<DayKey, DayHours> = {
  mon: { enabled: true, start: '09:00', end: '17:00' },
  tue: { enabled: true, start: '09:00', end: '17:00' },
  wed: { enabled: true, start: '09:00', end: '17:00' },
  thu: { enabled: true, start: '09:00', end: '17:00' },
  fri: { enabled: true, start: '09:00', end: '17:00' },
  sat: { enabled: false, start: '10:00', end: '14:00' },
  sun: { enabled: false, start: '10:00', end: '14:00' },
};

export function AvailabilitySettingsForm() {
  const [hours, setHours] = useState<Record<DayKey, DayHours>>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);

  function toggleDay(day: DayKey) {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  }

  function updateTime(day: DayKey, field: 'start' | 'end', value: string) {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      // TODO: Save to backend via API
      // For now just show success message
      toast.success('Consultation hours saved');
    } catch (error) {
      toast.error('Failed to save consultation hours');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {DAYS.map((day) => {
          const dayHours = hours[day.key];
          return (
            <Card key={day.key}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-24">
                    <Label className="text-base font-medium">{day.label}</Label>
                  </div>

                  <div className="flex flex-1 items-center gap-3">
                    <Switch
                      checked={dayHours.enabled}
                      onChange={() => toggleDay(day.key)}
                    />

                    {dayHours.enabled && (
                      <>
                        <div className="flex-1">
                          <Input
                            type="time"
                            value={dayHours.start}
                            onChange={(e) => updateTime(day.key, 'start', e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <span className="text-muted-foreground">to</span>
                        <div className="flex-1">
                          <Input
                            type="time"
                            value={dayHours.end}
                            onChange={(e) => updateTime(day.key, 'end', e.target.value)}
                            className="h-9"
                          />
                        </div>
                      </>
                    )}

                    {!dayHours.enabled && (
                      <span className="text-sm text-muted-foreground">Closed</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save consultation hours'}
      </Button>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">ℹ️ Tip:</span> Toggle days on/off, then set your available consultation times. The AI will offer these times to clients when they call.
        </p>
      </div>
    </div>
  );
}

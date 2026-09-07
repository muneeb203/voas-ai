'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistance } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Search, AlertCircle } from 'lucide-react';
import { apiCall } from '@/lib/api/client';
import type { SalonAppointment } from '@/lib/api/salon';
import type { DentalAppointment } from '@/lib/api/dental';

type Appointment = SalonAppointment | DentalAppointment;

interface Props {
  workspaceId: string;
  vertical: string;
}

export function KioskCheckin({ workspaceId, vertical }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<'lookup' | 'confirm' | 'success'>('lookup');
  const [phone, setPhone] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch() {
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const endpoint = vertical === 'dental'
        ? `/v1/workspaces/${workspaceId}/dental/appointments`
        : `/v1/workspaces/${workspaceId}/salon/appointments`;

      const res = await apiCall<Appointment[]>(endpoint, { cache: 'no-store' });

      if ('error' in res) {
        setError('Could not load appointments');
        setAppointments([]);
        setLoading(false);
        return;
      }

      // Filter by phone number
      const filtered = (res.data || []).filter((a) =>
        a.customer_phone?.replace(/\D/g, '').endsWith(phone.replace(/\D/g, ''))
      );

      if (filtered.length === 0) {
        setError('No appointments found for this phone number');
        setAppointments([]);
      } else {
        setAppointments(filtered);
        setStep('confirm');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmCheckin(appointment: Appointment) {
    setLoading(true);
    setError('');

    try {
      const endpoint = vertical === 'dental'
        ? `/v1/workspaces/${workspaceId}/dental/appointments/${appointment.id}/status`
        : `/v1/workspaces/${workspaceId}/salon/appointments/${appointment.id}/status`;

      const method = vertical === 'dental' ? 'PUT' : 'PATCH';

      const res = await apiCall<Appointment>(endpoint, {
        method,
        body: { status: 'confirmed' },
      });

      if ('error' in res) {
        setError('Check-in failed. Please try again.');
        setLoading(false);
        return;
      }

      setSelected(appointment);
      setStep('success');
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  }

  if (step === 'success' && selected) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <CardTitle className="mt-4">Check-in Complete</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Thank you,</p>
            <p className="text-lg font-semibold">{selected.customer_name || 'Guest'}</p>
          </div>
          <div className="rounded-lg bg-secondary p-4">
            <p className="text-xs text-muted-foreground">Appointment at</p>
            <p className="text-sm font-medium">
              {new Date(selected.starts_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              setStep('lookup');
              setPhone('');
              setAppointments([]);
              setSelected(null);
            }}
          >
            Check In Another Patient
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'confirm' && appointments.length > 0) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Confirm Appointment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className="cursor-pointer rounded-lg border border-border p-4 transition-colors hover:bg-secondary"
              onClick={() => handleConfirmCheckin(apt)}
            >
              <p className="font-medium">{apt.customer_name || 'Guest'}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(apt.starts_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                — {apt.service_name || 'Service'}
              </p>
              <Badge className="mt-2" variant="outline">
                {apt.staff_name || 'Staff'}
              </Badge>
            </div>
          ))}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setStep('lookup');
              setAppointments([]);
            }}
          >
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">Welcome</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Please check in using your phone number</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="(555) 123-4567"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError('');
            }}
            disabled={loading}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            className="text-lg"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          className="w-full"
          size="lg"
          onClick={handleSearch}
          disabled={loading || !phone.trim()}
        >
          <Search className="h-4 w-4" />
          {loading ? 'Searching...' : 'Find Appointment'}
        </Button>
      </CardContent>
    </Card>
  );
}

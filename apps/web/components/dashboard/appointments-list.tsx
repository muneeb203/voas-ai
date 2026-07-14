'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format, isToday, isTomorrow } from 'date-fns';
import { ChevronDown, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppointmentDialog } from '@/components/dashboard/appointment-dialog';
import type { SalonService } from '@/lib/api/salon';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { updateAppointmentStatusAction } from '@/app/actions/salon-action';
import type { AppointmentStatus, SalonAppointment } from '@/lib/api/salon';

const STATUS_META: Record<
  AppointmentStatus,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'destructive' | 'warning' }
> = {
  pending: { label: 'Pending', variant: 'secondary' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  completed: { label: 'Completed', variant: 'default' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  no_show: { label: 'No-show', variant: 'warning' },
};

const NEXT_STATUSES: AppointmentStatus[] = [
  'confirmed',
  'completed',
  'no_show',
  'cancelled',
];

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const time = format(d, 'h:mm a');
  if (isToday(d)) return `Today · ${time}`;
  if (isTomorrow(d)) return `Tomorrow · ${time}`;
  return `${format(d, 'EEE d MMM')} · ${time}`;
}

export function AppointmentsList({
  initialAppointments,
  services,
}: {
  initialAppointments: SalonAppointment[];
  services: SalonService[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [rescheduleAppt, setRescheduleAppt] = useState<SalonAppointment | null>(null);

  async function setStatus(a: SalonAppointment, status: AppointmentStatus) {
    setBusyId(a.id);
    const res = await updateAppointmentStatusAction(a.id, status);
    setBusyId(null);
    if (res.error) return toast.error(res.error);
    toast.success(`Marked ${STATUS_META[status].label.toLowerCase()}`);
    router.refresh();
  }

  const canBook = services.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        {!canBook && (
          <p className="text-xs text-muted-foreground">Add a service + staff to take bookings.</p>
        )}
        <Button onClick={() => setNewOpen(true)} disabled={!canBook}>
          <Plus className="h-4 w-4" /> New appointment
        </Button>
      </div>

      {initialAppointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No appointments yet. Bookings made by the AI or your team will appear here.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialAppointments.map((a) => {
              const meta = STATUS_META[a.status];
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{whenLabel(a.starts_at)}</TableCell>
                  <TableCell>{a.service_name}</TableCell>
                  <TableCell className="text-muted-foreground">{a.staff_name ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.customer_name ?? a.customer_phone ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={busyId === a.id}>
                          Set status <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {a.service_id && (
                          <DropdownMenuItem onClick={() => setRescheduleAppt(a)}>
                            Reschedule…
                          </DropdownMenuItem>
                        )}
                        {NEXT_STATUSES.filter((s) => s !== a.status).map((s) => (
                          <DropdownMenuItem key={s} onClick={() => setStatus(a, s)}>
                            {STATUS_META[s].label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
          </CardContent>
        </Card>
      )}

      <AppointmentDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        mode="new"
        services={services}
      />
      {rescheduleAppt && (
        <AppointmentDialog
          key={rescheduleAppt.id}
          open
          onClose={() => setRescheduleAppt(null)}
          mode="reschedule"
          services={services}
          appointmentId={rescheduleAppt.id}
          fixedServiceId={rescheduleAppt.service_id ?? undefined}
          fixedServiceName={rescheduleAppt.service_name}
        />
      )}
    </div>
  );
}

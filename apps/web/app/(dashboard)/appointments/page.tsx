import type { Metadata } from 'next';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listAppointments, listServices } from '@/lib/api/salon';
import { isApiError } from '@/lib/types';
import { PageHeader } from '@/components/dashboard/page-header';
import { AppointmentsList } from '@/components/dashboard/appointments-list';

export const metadata: Metadata = { title: 'Appointments' };

export default async function AppointmentsPage() {
  const session = await requireDashboardSession('/appointments');
  const [res, servicesRes] = await Promise.all([
    listAppointments(session.active.workspace_id),
    listServices(session.active.workspace_id, true),
  ]);
  const appointments = !isApiError(res) ? res.data : [];
  const services = !isApiError(servicesRes) ? servicesRes.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Salon"
        title="Appointments"
        description="Every booking taken by the AI and your team — mark them confirmed, completed, or no-show."
      />
      <AppointmentsList initialAppointments={appointments} services={services} />
    </div>
  );
}

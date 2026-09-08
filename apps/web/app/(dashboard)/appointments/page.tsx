import type { Metadata } from 'next';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listAppointments, listServices } from '@/lib/api/salon';
import { listLawAppointments } from '@/lib/api/law';
import { isApiError } from '@/lib/types';
import { PageHeader } from '@/components/dashboard/page-header';
import { AppointmentsList } from '@/components/dashboard/appointments-list';
import { RefreshButton } from '@/components/dashboard/refresh-button';

export const metadata: Metadata = { title: 'Appointments' };

export default async function AppointmentsPage() {
  const session = await requireDashboardSession('/appointments');
  const vertical = session.active.workspace.vertical;
  const isLaw = vertical === 'law';

  const [appointmentsRes, servicesRes] = await Promise.all([
    isLaw
      ? listLawAppointments(session.active.workspace_id)
      : listAppointments(session.active.workspace_id),
    listServices(session.active.workspace_id, true),
  ]);

  const appointments = !isApiError(appointmentsRes) ? appointmentsRes.data : [];
  const services = !isApiError(servicesRes) ? servicesRes.data : [];

  const eyebrow = isLaw ? 'Case Management' : 'Salon';
  const description = isLaw
    ? 'Every consultation and client meeting taken by the AI and your team.'
    : 'Every booking taken by the AI and your team — mark them confirmed, completed, or no-show.';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          eyebrow={eyebrow}
          title="Appointments"
          description={description}
        />
        <RefreshButton />
      </div>
      <AppointmentsList initialAppointments={appointments} services={services} vertical={session.active.workspace.vertical} />
    </div>
  );
}

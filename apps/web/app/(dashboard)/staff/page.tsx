import type { Metadata } from 'next';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listStaff, listServices } from '@/lib/api/salon';
import { isApiError } from '@/lib/types';
import { PageHeader } from '@/components/dashboard/page-header';
import { StaffEditor } from '@/components/dashboard/staff-editor';

export const metadata: Metadata = { title: 'Staff' };

export default async function StaffPage() {
  const session = await requireDashboardSession('/staff');
  const [staffRes, servicesRes] = await Promise.all([
    listStaff(session.active.workspace_id),
    listServices(session.active.workspace_id),
  ]);
  const staff = !isApiError(staffRes) ? staffRes.data : [];
  const services = !isApiError(servicesRes) ? servicesRes.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Salon"
        title="Staff"
        description="Your team, the services each can perform, and their weekly hours. The AI only offers slots inside these."
      />
      <StaffEditor
        initialStaff={staff}
        services={services}
        canEdit={session.active.role === 'owner'}
      />
    </div>
  );
}

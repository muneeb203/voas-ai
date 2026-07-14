import type { Metadata } from 'next';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listServices } from '@/lib/api/salon';
import { isApiError } from '@/lib/types';
import { PageHeader } from '@/components/dashboard/page-header';
import { ServicesEditor } from '@/components/dashboard/services-editor';

export const metadata: Metadata = { title: 'Services' };

export default async function ServicesPage() {
  const session = await requireDashboardSession('/services');
  const res = await listServices(session.active.workspace_id);
  const services = !isApiError(res) ? res.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Salon"
        title="Services"
        description="The treatments customers can book — each with a duration and price. The AI books against these."
      />
      <ServicesEditor initialServices={services} canEdit={session.active.role === 'owner'} />
    </div>
  );
}

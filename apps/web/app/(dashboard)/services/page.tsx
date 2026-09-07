import type { Metadata } from 'next';
import Link from 'next/link';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listServices as listSalonServices } from '@/lib/api/salon';
import { listServices as listDentalServices } from '@/lib/api/dental';
import { isApiError } from '@/lib/types';
import { PageHeader } from '@/components/dashboard/page-header';
import { ServicesEditor } from '@/components/dashboard/services-editor';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

export const metadata: Metadata = { title: 'Services' };

export default async function ServicesPage() {
  const session = await requireDashboardSession('/services');
  const vertical = session.active.workspace.vertical;
  const isDefault = vertical === 'default';
  const isDental = vertical === 'dental';

  if (isDefault) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Services"
          title="Services"
          description="Services will be available once you select a vertical for your business."
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div>
              <p className="text-sm font-medium text-foreground">
                For this to be listed, select a vertical from settings
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a business type that matches your operation (Restaurant, Salon, Dental, etc.)
              </p>
            </div>
            <Link href="/settings">
              <Button className="gap-2">
                <Settings className="h-4 w-4" />
                Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const res = isDental
    ? await listDentalServices(session.active.workspace_id)
    : await listSalonServices(session.active.workspace_id);
  const services = !isApiError(res) ? res.data : [];

  const eyebrow = isDental ? 'Dental' : 'Salon';
  const description = isDental
    ? 'Dental procedures customers can book — each with duration and price. The AI books against these.'
    : 'The treatments customers can book — each with a duration and price. The AI books against these.';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow={eyebrow}
          title="Services"
          description={description}
        />
        {isDental && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Beta
          </div>
        )}
      </div>
      <ServicesEditor initialServices={services} canEdit={session.active.role === 'owner'} vertical={vertical} />
    </div>
  );
}

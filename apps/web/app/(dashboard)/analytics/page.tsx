import type { Metadata } from 'next';
import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { ComingSoon } from '@/components/dashboard/coming-soon';

export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader eyebrow="Insights" title="Analytics" />
      <ComingSoon
        icon={BarChart3}
        title="The data nobody else gives you"
        blurb="Calls over time, top intents, sentiment trends, items asked for but not on your menu. Lands in V2 with conversations; deepens in V3."
        arrivesIn="V2"
      />
    </div>
  );
}

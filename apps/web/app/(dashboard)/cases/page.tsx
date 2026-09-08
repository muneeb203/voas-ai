import type { Metadata } from 'next';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/dashboard/page-header';
import { FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cases',
};

export default async function CasesPage() {
  const session = await requireDashboardSession('/cases');

  return (
    <div>
      <PageHeader
        eyebrow="Case Management"
        title="Cases"
        description="Track and manage all client cases and matters."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cases
          </CardTitle>
          <CardDescription>
            Case management system coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <FileText className="h-5 w-5 text-accent" />
          </div>
          <h2 className="text-lg font-semibold">Cases management</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Track client cases, matters, and their status. You'll be able to manage case details, timelines, and client communications here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

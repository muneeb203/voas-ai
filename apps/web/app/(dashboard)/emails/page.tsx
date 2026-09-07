import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { Badge } from '@/components/ui/badge';
import { EmailSettingsToggle } from '@/components/dashboard/email-settings-toggle';

export const metadata: Metadata = {
  title: 'Email Notifications',
};

export default async function EmailsPage() {
  const session = await requireDashboardSession('/emails');
  const workspaceId = session.active.workspace_id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Mail className="h-8 w-8" />
          Email Notifications
        </h1>
        <p className="text-muted-foreground mt-1">Receive call summaries via email</p>
      </div>

      <EmailSettingsToggle workspaceId={workspaceId} />
    </div>
  );
}

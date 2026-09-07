import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { AdminEmailDashboard } from '@/components/admin/admin-email-dashboard';

export const metadata: Metadata = {
  title: 'Email Notifications - Admin',
};

export default async function AdminEmailsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email Notifications</h1>
        <p className="text-muted-foreground mt-1">Monitor email delivery across all workspaces</p>
      </div>

      <AdminEmailDashboard />
    </div>
  );
}

import type { Metadata } from 'next';
import { requireAdminSession } from '@/lib/auth/admin';
import { Card, CardContent } from '@/components/ui/card';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = {
  title: 'Admin · Settings',
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  const session = await requireAdminSession('/admin/settings');

  return (
    <div>
      <AdminPageHeader
        eyebrow="Operations"
        title="Admin settings"
        description="Provisioning + 2FA management lands in Sprint 6."
      />
      <Card>
        <CardContent className="p-6 space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Signed in as
            </p>
            <p className="mt-1 font-medium">{session.user.full_name ?? session.user.email}</p>
            <p className="text-xs text-muted-foreground">{session.user.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Provisioning new admins
            </p>
            <p className="mt-1">
              Run the provisioning script from{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">apps/api</code>:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
              python -m scripts.create_admin --email you@convosol.com --name &quot;Your Name&quot;
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { HelpBot } from '@/components/dashboard/help-bot';
import { ImpersonationBanner } from '@/components/admin/impersonation-banner';
import { requireDashboardSession } from '@/lib/auth/workspace';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireDashboardSession('/dashboard');

  return (
    <div className="flex min-h-screen flex-col bg-secondary/20">
      {session.impersonation && (
        <ImpersonationBanner workspaceName={session.impersonation.workspace_name} />
      )}
      <div className="flex flex-1">
        <Sidebar className="hidden w-60 shrink-0 lg:flex" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            workspaceName={session.active.workspace.name}
            workspacePlan={session.active.workspace.plan}
            userEmail={session.user.email}
            userName={session.user.full_name}
            role={session.active.role}
          />
          <main className="flex-1">
            <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">{children}</div>
          </main>
          <HelpBot />
        </div>
      </div>
    </div>
  );
}

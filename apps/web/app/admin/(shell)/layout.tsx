import { requireAdminSession } from '@/lib/auth/admin';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminTopbar } from '@/components/admin/admin-topbar';

export default async function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession('/admin/workspaces');

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar className="hidden w-60 shrink-0 lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          userName={session.user.full_name}
          userEmail={session.user.email}
        />
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

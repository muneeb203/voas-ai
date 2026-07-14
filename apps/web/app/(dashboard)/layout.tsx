import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { HelpBot } from '@/components/dashboard/help-bot';
import { ProductTour } from '@/components/dashboard/product-tour';
import { ImpersonationBanner } from '@/components/admin/impersonation-banner';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, messages, locale] = await Promise.all([
    requireDashboardSession('/dashboard'),
    getMessages(),
    getLocale(),
  ]);

  const { data: onboarding } = await createSupabaseServerClient()
    .from('user_onboarding')
    .select('tour_completed_at')
    .eq('user_id', session.user.id)
    .maybeSingle();
  const tourCompleted = Boolean(onboarding?.tour_completed_at);

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <div className="flex min-h-screen flex-col bg-secondary/20">
        {session.impersonation && (
          <ImpersonationBanner workspaceName={session.impersonation.workspace_name} />
        )}
        <div className="flex flex-1">
          <Sidebar className="hidden w-60 shrink-0 lg:flex" vertical={session.active.workspace.vertical} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              workspaceName={session.active.workspace.name}
              workspacePlan={session.active.workspace.plan}
              userEmail={session.user.email}
              userName={session.user.full_name}
              role={session.active.role}
              vertical={session.active.workspace.vertical}
            />
            <main className="flex-1">
              <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">{children}</div>
            </main>
            <HelpBot />
          </div>
        </div>
      </div>
      <ProductTour
        userId={session.user.id}
        tourCompleted={tourCompleted}
        vertical={session.active.workspace.vertical}
      />
    </NextIntlClientProvider>
  );
}

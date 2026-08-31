import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { KioskCheckin } from '@/components/kiosk/checkin';

export const metadata = { title: 'Check In' };

export default async function KioskPage({ params }: { params: { workspace_id: string } }) {
  const db = createSupabaseServerClient();

  // Verify workspace exists and get its vertical
  const { data: workspace } = await db
    .from('workspaces')
    .select('vertical')
    .eq('id', params.workspace_id)
    .single();

  if (!workspace) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <KioskCheckin workspaceId={params.workspace_id} vertical={workspace.vertical} />
    </div>
  );
}

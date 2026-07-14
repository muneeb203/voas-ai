import { getKioskInfo } from '@/lib/api/kiosk';
import { isApiError } from '@/lib/types';
import { KioskClient } from './kiosk-client';

interface KioskPageProps {
  params: { token: string };
}

export default async function KioskPage({ params }: KioskPageProps) {
  const res = await getKioskInfo(params.token);

  if (isApiError(res)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A2540] px-6 text-center">
        <p className="text-5xl">😔</p>
        <h1 className="mt-6 text-2xl font-semibold text-white">Kiosk unavailable</h1>
        <p className="mt-3 max-w-sm text-sm text-white/60">
          This kiosk link is no longer active or has been revoked. Please ask a staff member for
          assistance.
        </p>
        <p className="mt-12 text-xs text-white/30">Powered by Convosol · VOAS.AI</p>
      </div>
    );
  }

  const { location_name, workspace_name, theme, session_lock_enabled, vertical } = res.data;

  return (
    <KioskClient
      token={params.token}
      locationName={location_name}
      workspaceName={workspace_name}
      theme={theme}
      sessionLockEnabled={session_lock_enabled}
      vertical={vertical}
    />
  );
}

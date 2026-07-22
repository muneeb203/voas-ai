'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getPhoneOrderInfo } from '@/lib/api/kiosk-public';
import { KioskManualOrder } from '@/app/kiosk/[token]/kiosk-manual-order';

const ACCENT = '#00C2A8';

export default function PhoneOrderPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [info, setInfo] = useState<{ workspace_name: string; location_name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getPhoneOrderInfo(token).then((res) => {
      if (!active) return;
      if ('error' in res) setError(res.error.message);
      else setInfo(res.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafaf8]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafaf8] px-6 text-center">
        <p className="text-lg font-semibold text-[#0A2540]">Ordering unavailable</p>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          {error ?? 'This ordering link is not active. Please ask a staff member.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fafaf8]">
      <header className="flex flex-col items-center border-b border-[#0A2540]/10 py-5 text-center">
        <p className="text-xl font-black tracking-tight text-[#0A2540]">{info.workspace_name}</p>
        <p className="mt-0.5 text-xs text-slate-500">{info.location_name} · Order from your phone</p>
      </header>
      <KioskManualOrder
        token={token}
        accentColor={ACCENT}
        isLight
        canExit={false}
        channel="phone"
        onExit={() => {}}
      />
    </div>
  );
}

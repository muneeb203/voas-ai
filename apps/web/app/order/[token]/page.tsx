'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { getPhoneOrderInfo, type PhoneOrderInfo } from '@/lib/api/kiosk-public';
import { KioskManualOrder } from '@/app/kiosk/[token]/kiosk-manual-order';

const ACCENT = '#00C2A8';

interface LockRecord {
  orderNumber: string | null;
  at: number; // epoch ms when the order was placed
}

function lockKey(token: string) {
  return `voas_qr_order_${token}`;
}

function readLock(token: string): LockRecord | null {
  try {
    const raw = localStorage.getItem(lockKey(token));
    return raw ? (JSON.parse(raw) as LockRecord) : null;
  } catch {
    return null;
  }
}

export default function PhoneOrderPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [info, setInfo] = useState<PhoneOrderInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Set when the device is inside its post-order lock window.
  const [locked, setLocked] = useState<LockRecord | null>(null);

  useEffect(() => {
    let active = true;
    getPhoneOrderInfo(token).then((res) => {
      if (!active) return;
      if ('error' in res) {
        setError(res.error.message);
      } else {
        setInfo(res.data);
        // Apply an existing device lock if it hasn't expired yet.
        if (res.data.order_lock_enabled) {
          const rec = readLock(token);
          if (rec && Date.now() - rec.at < res.data.order_lock_minutes * 60_000) {
            setLocked(rec);
          }
        }
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [token]);

  function handleOrderPlaced(orderNumber: string | null) {
    if (!info?.order_lock_enabled) return;
    const rec: LockRecord = { orderNumber, at: Date.now() };
    try {
      localStorage.setItem(lockKey(token), JSON.stringify(rec));
    } catch {
      /* storage blocked — the lock just won't persist */
    }
    setLocked(rec);
  }

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

  // Already ordered on this device, within the lock window.
  if (locked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafaf8] px-6 text-center">
        <div
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: `${ACCENT}22` }}
        >
          <CheckCircle2 className="h-11 w-11" style={{ color: ACCENT }} />
        </div>
        <h1 className="text-3xl font-black text-[#0A2540]">You&apos;ve already ordered</h1>
        {locked.orderNumber && (
          <p className="mt-3 text-xl font-bold text-[#0A2540]">Order {locked.orderNumber}</p>
        )}
        <p className="mt-3 max-w-sm text-sm text-slate-500">
          Your order is being prepared. To place another, please ask a staff member.
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
        lockAfterOrder={info.order_lock_enabled}
        onOrderPlaced={handleOrderPlaced}
        onExit={() => {}}
      />
    </div>
  );
}

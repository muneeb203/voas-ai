'use client';

import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface TestCallButtonProps {
  publicKey: string | null;
  assistantId: string | null;
  disabled?: boolean;
}

type CallState = 'idle' | 'connecting' | 'active' | 'ending';

export function TestCallButton({ publicKey, assistantId, disabled }: TestCallButtonProps) {
  const [state, setState] = useState<CallState>('idle');
  const [muted, setMuted] = useState(false);
  const vapiRef = useRef<unknown>(null);

  useEffect(() => {
    // Tear down on unmount
    return () => {
      const v = vapiRef.current as { stop?: () => void } | null;
      v?.stop?.();
    };
  }, []);

  async function startCall() {
    if (!publicKey || !assistantId) {
      toast.error('Voice not configured yet. Save settings first.');
      return;
    }
    setState('connecting');
    try {
      const { default: Vapi } = await import('@vapi-ai/web');
      // @ts-expect-error — Vapi is imported dynamically with a stub type
      const vapi = new Vapi(publicKey);
      vapiRef.current = vapi;

      vapi.on('call-start', () => setState('active'));
      vapi.on('call-end', () => {
        setState('idle');
        setMuted(false);
      });
      vapi.on('error', (err: unknown) => {
        toast.error(`Call error: ${String(err)}`);
        setState('idle');
      });

      await vapi.start(assistantId);
    } catch (err) {
      toast.error(`Could not start test call: ${String(err)}`);
      setState('idle');
    }
  }

  function endCall() {
    setState('ending');
    const v = vapiRef.current as { stop?: () => void } | null;
    v?.stop?.();
    setTimeout(() => setState('idle'), 500);
  }

  function toggleMute() {
    const v = vapiRef.current as { setMuted?: (m: boolean) => void; isMuted?: () => boolean } | null;
    if (!v) return;
    const next = !muted;
    v.setMuted?.(next);
    setMuted(next);
  }

  if (!publicKey) {
    return (
      <p className="text-xs text-muted-foreground">
        Add <code className="font-mono">VAPI_PUBLIC_KEY</code> to the backend env to enable test calls.
      </p>
    );
  }
  if (!assistantId) {
    return (
      <p className="text-xs text-muted-foreground">
        Save voice settings first to provision the assistant.
      </p>
    );
  }

  if (state === 'active') {
    return (
      <div className="flex items-center gap-2">
        <Button variant="destructive" onClick={endCall}>
          <PhoneOff className="h-4 w-4" /> End call
        </Button>
        <Button variant="outline" onClick={toggleMute}>
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {muted ? 'Unmute' : 'Mute'}
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={startCall} disabled={disabled || state !== 'idle'}>
      <Phone className="h-4 w-4" />
      {state === 'connecting' ? 'Connecting…' : 'Test call in browser'}
    </Button>
  );
}

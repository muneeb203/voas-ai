'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { acceptInvitationAction } from '@/app/actions/team-action';

export function AcceptInviteForm({ token, disabled }: { token: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onAccept() {
    setPending(true);
    const res = await acceptInvitationAction(token);
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('You are in!');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <Button onClick={onAccept} disabled={pending || disabled} size="lg" className="w-full">
      {pending ? 'Joining…' : 'Accept and continue'}
    </Button>
  );
}

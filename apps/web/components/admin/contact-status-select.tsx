'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { adminUpdateContactStatusAction } from '@/app/actions/admin-action';
import type { AdminContactSubmission } from '@/lib/api/admin';

interface ContactStatusSelectProps {
  submissionId: string;
  current: AdminContactSubmission['status'];
}

export function ContactStatusSelect({ submissionId, current }: ContactStatusSelectProps) {
  const [value, setValue] = useState(current);
  const [pending, setPending] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as AdminContactSubmission['status'];
    setValue(next);
    setPending(true);
    const res = await adminUpdateContactStatusAction(submissionId, next);
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      setValue(current);
    } else {
      toast.success(`Marked ${next}`);
    }
  }

  return (
    <select
      value={value}
      onChange={onChange}
      disabled={pending}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
    >
      <option value="new">New</option>
      <option value="contacted">Contacted</option>
      <option value="qualified">Qualified</option>
      <option value="closed">Closed</option>
    </select>
  );
}

'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import {
  publishAnnouncementAction,
  type AnnouncementFormState,
} from '@/app/actions/admin-announcements-action';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const INITIAL: AnnouncementFormState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Sending…' : 'Publish to all workspaces'}
    </Button>
  );
}

export function AnnouncementForm() {
  const [state, action] = useFormState(publishAnnouncementAction, INITIAL);

  useEffect(() => {
    if (state.status === 'success') {
      toast.success(state.message ?? 'Published');
    } else if (state.status === 'error' && state.message && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <Field label="Title" htmlFor="title" required error={state.fieldErrors?.title}>
        <Input
          id="title"
          name="title"
          placeholder="WhatsApp is now live"
          maxLength={200}
          required
        />
      </Field>

      <Field label="Message" htmlFor="body" required error={state.fieldErrors?.body}>
        <Textarea
          id="body"
          name="body"
          rows={5}
          placeholder="Tell customers what's new and how to use it…"
          maxLength={4000}
          required
        />
      </Field>

      <Field
        label="Optional link"
        htmlFor="link"
        hint="Dashboard path or full URL — opens when they tap the notification."
      >
        <Input id="link" name="link" placeholder="/integrations/whatsapp" maxLength={500} />
      </Field>

      <SubmitButton />
    </form>
  );
}

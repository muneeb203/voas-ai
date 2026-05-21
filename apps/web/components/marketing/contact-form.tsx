'use client';

import { useEffect } from 'react';
import { useActionState } from '@/lib/use-action-state';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { submitContact, type ContactFormState } from '@/app/actions/contact-action';

interface ContactFormProps {
  defaultPlan?: string;
}

const INITIAL: ContactFormState = { status: 'idle' };

export function ContactForm({ defaultPlan }: ContactFormProps) {
  const [state, formAction, pending] = useActionState(submitContact, INITIAL);

  useEffect(() => {
    if (state.status === 'success') {
      toast.success('Thanks — we’ll be in touch within one business day.');
    } else if (state.status === 'error' && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]);

  if (state.status === 'success') {
    return (
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-6 text-center">
        <h2 className="text-lg font-semibold">Message received.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We typically reply within one business day. In the meantime, you can{' '}
          <a href="/signup" className="text-accent-700 underline-offset-2 hover:underline">
            create an account
          </a>{' '}
          and start exploring.
        </p>
      </div>
    );
  }

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;
  const defaultMessage =
    defaultPlan === 'enterprise'
      ? 'Hi — interested in enterprise pricing. We operate [X] locations.'
      : '';

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="source" value={`/contact${defaultPlan ? `?plan=${defaultPlan}` : ''}`} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="name" required error={fieldErrors?.name}>
          <Input id="name" name="name" autoComplete="name" required disabled={pending} />
        </Field>
        <Field label="Work email" htmlFor="email" required error={fieldErrors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Company" htmlFor="company" error={fieldErrors?.company}>
          <Input
            id="company"
            name="company"
            autoComplete="organization"
            disabled={pending}
          />
        </Field>
        <Field label="Phone" htmlFor="phone" error={fieldErrors?.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            disabled={pending}
          />
        </Field>
      </div>

      <Field label="What are you looking to solve?" htmlFor="message" required error={fieldErrors?.message}>
        <Textarea
          id="message"
          name="message"
          rows={5}
          required
          disabled={pending}
          defaultValue={defaultMessage}
          placeholder="A sentence or two about your business and what you'd like VOAS to do."
        />
      </Field>

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? 'Sending…' : 'Send message'}
      </Button>

      {state.status === 'error' && !state.fieldErrors && (
        <p className="text-sm text-error" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useActionState } from '@/lib/use-action-state';
import { ArrowRight, Building2, MapPin, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { VERTICALS } from '@/lib/constants';
import { completeOnboarding, type OnboardingFormState } from '@/app/actions/onboarding-action';

const INITIAL: OnboardingFormState = { status: 'idle' };

const STEPS = [
  { id: 'workspace', title: 'Workspace', icon: Building2 },
  { id: 'vertical', title: 'Business type', icon: Briefcase },
  { id: 'location', title: 'First location', icon: MapPin },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export function OnboardingWizard({ defaultName }: { defaultName?: string }) {
  const [step, setStep] = useState<StepId>('workspace');
  const [workspaceName, setWorkspaceName] = useState(defaultName ?? '');
  const [vertical, setVertical] = useState<string>('restaurant');
  const [state, formAction, pending] = useActionState(completeOnboarding, INITIAL);

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
      <ol className="mb-8 flex items-center justify-between">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === currentStepIndex;
          const done = i < currentStepIndex;
          return (
            <li key={s.id} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <div
                  className={
                    done
                      ? 'flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white'
                      : active
                        ? 'flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent text-accent'
                        : 'flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground'
                  }
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={
                    active || done
                      ? 'hidden text-sm font-medium sm:inline'
                      : 'hidden text-sm font-medium text-muted-foreground sm:inline'
                  }
                >
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={
                    done ? 'mx-3 h-px flex-1 bg-accent' : 'mx-3 h-px flex-1 bg-border'
                  }
                />
              )}
            </li>
          );
        })}
      </ol>

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="workspaceName" value={workspaceName} />
        <input type="hidden" name="vertical" value={vertical} />

        {step === 'workspace' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                What’s your business called?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We’ll use this everywhere — on calls, messages, and your dashboard.
              </p>
            </div>

            <Field
              label="Business name"
              htmlFor="workspaceNameInput"
              required
              error={fieldErrors?.workspaceName}
            >
              <Input
                id="workspaceNameInput"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Pino’s Pizza"
                autoFocus
              />
            </Field>

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={workspaceName.trim().length < 2}
              onClick={() => setStep('vertical')}
            >
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 'vertical' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                What kind of business is {workspaceName}?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We tune the agent and integrations to your industry.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {VERTICALS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setVertical(v.value)}
                  className={
                    vertical === v.value
                      ? 'rounded-lg border-2 border-accent bg-accent/5 p-4 text-left text-sm font-medium'
                      : 'rounded-lg border border-border bg-background p-4 text-left text-sm font-medium hover:border-accent/50'
                  }
                >
                  {v.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => setStep('workspace')}
              >
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                className="flex-1"
                onClick={() => setStep('location')}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 'location' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Add your first location</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You can add more locations later from Settings.
              </p>
            </div>

            <Field
              label="Location name"
              htmlFor="locationName"
              required
              error={fieldErrors?.locationName}
              hint="E.g. “Downtown” or “Main Street”."
            >
              <Input
                id="locationName"
                name="locationName"
                placeholder="Downtown"
                disabled={pending}
                required
              />
            </Field>

            <Field label="Street address" htmlFor="address" error={fieldErrors?.address}>
              <Input
                id="address"
                name="address"
                autoComplete="street-address"
                disabled={pending}
              />
            </Field>

            <Field label="Phone" htmlFor="phone" error={fieldErrors?.phone}>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" disabled={pending} />
            </Field>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => setStep('vertical')}
                disabled={pending}
              >
                Back
              </Button>
              <Button type="submit" size="lg" className="flex-1" disabled={pending}>
                {pending ? 'Setting up…' : 'Finish setup'}
              </Button>
            </div>

            {state.status === 'error' && !state.fieldErrors && (
              <p className="text-sm text-error" role="alert">
                {state.message}
              </p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

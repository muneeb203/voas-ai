'use client';

import { useState } from 'react';
import { useActionState } from '@/lib/use-action-state';
import { ArrowRight, Building2, MapPin, Briefcase, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { VERTICALS } from '@/lib/constants';
import {
  completeOnboarding,
  skipOnboarding,
  type OnboardingFormState,
} from '@/app/actions/onboarding-action';

const INITIAL: OnboardingFormState = { status: 'idle' };

const STEPS = [
  { id: 'workspace', title: 'Business', icon: Building2 },
  { id: 'vertical', title: 'Type', icon: Briefcase },
  { id: 'location', title: 'Location', icon: MapPin },
  { id: 'hours', title: 'Hours', icon: Clock },
] as const;

type StepId = (typeof STEPS)[number]['id'];

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
type DayHours = { open: string; close: string } | null;

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

const DEFAULT_HOURS: Record<DayKey, DayHours> = {
  mon: { open: '11:00', close: '22:00' },
  tue: { open: '11:00', close: '22:00' },
  wed: { open: '11:00', close: '22:00' },
  thu: { open: '11:00', close: '22:00' },
  fri: { open: '11:00', close: '23:00' },
  sat: { open: '11:00', close: '23:00' },
  sun: { open: '12:00', close: '21:00' },
};

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European (CET)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Karachi', label: 'Pakistan (PKT)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

export function OnboardingWizard({ defaultName }: { defaultName?: string }) {
  const [step, setStep] = useState<StepId>('workspace');
  const [workspaceName, setWorkspaceName] = useState(defaultName ?? '');
  const [vertical, setVertical] = useState<string>('restaurant');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [hours, setHours] = useState<Record<DayKey, DayHours>>(DEFAULT_HOURS);
  const [skippingLocation, setSkippingLocation] = useState(false);

  const [state, formAction, pending] = useActionState(completeOnboarding, INITIAL);

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  async function handleSkipLocation() {
    setSkippingLocation(true);
    await skipOnboarding(workspaceName, vertical);
  }

  function toggleDay(day: DayKey) {
    setHours((prev) => ({
      ...prev,
      [day]: prev[day] === null ? { open: '11:00', close: '22:00' } : null,
    }));
  }

  function updateDayTime(day: DayKey, field: 'open' | 'close', value: string) {
    setHours((prev) => {
      const existing = prev[day];
      return {
        ...prev,
        [day]: existing ? { ...existing, [field]: value } : { open: '11:00', close: '22:00' },
      };
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
      {/* Step progress */}
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
                  className={done ? 'mx-3 h-px flex-1 bg-accent' : 'mx-3 h-px flex-1 bg-border'}
                />
              )}
            </li>
          );
        })}
      </ol>

      <form action={formAction} className="space-y-6">
        {/* Always-present hidden fields so they're in form data on submission */}
        <input type="hidden" name="workspaceName" value={workspaceName} />
        <input type="hidden" name="vertical" value={vertical} />
        <input type="hidden" name="locationName" value={locationName} />
        <input type="hidden" name="address" value={address} />
        <input type="hidden" name="city" value={city} />
        <input type="hidden" name="state" value={stateName} />
        <input type="hidden" name="zip" value={zip} />
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="timezone" value={timezone} />
        <input type="hidden" name="hours" value={JSON.stringify(hours)} />

        {/* Step 1 — Business name */}
        {step === 'workspace' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                What&apos;s your business called?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ll use this on calls, messages, and your dashboard.
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
                placeholder="Pino's Pizza"
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

        {/* Step 2 — Vertical */}
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
                  disabled={!v.available}
                  onClick={() => setVertical(v.value)}
                  className={
                    !v.available
                      ? 'cursor-not-allowed rounded-lg border border-border bg-muted/40 p-4 text-left text-sm font-medium text-muted-foreground'
                      : vertical === v.value
                        ? 'rounded-lg border-2 border-accent bg-accent/5 p-4 text-left text-sm font-medium'
                        : 'rounded-lg border border-border bg-background p-4 text-left text-sm font-medium hover:border-accent/50'
                  }
                >
                  {v.label}
                  {!v.available && (
                    <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                      Coming soon
                    </span>
                  )}
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

        {/* Step 3 — Location */}
        {step === 'location' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Add your first location</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You can update this anytime in{' '}
                <a href="/locations" className="underline hover:text-foreground">
                  Settings → Locations
                </a>
                .
              </p>
            </div>

            <Field
              label="Location name"
              htmlFor="locationNameInput"
              required
              error={fieldErrors?.locationName}
              hint={'E.g. “Downtown” or “Main Street”.'}
            >
              <Input
                id="locationNameInput"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Downtown"
                autoFocus
                disabled={pending || skippingLocation}
              />
            </Field>

            <Field label="Street address" htmlFor="addressInput">
              <Input
                id="addressInput"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St"
                disabled={pending || skippingLocation}
              />
            </Field>

            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-3">
                <Field label="City" htmlFor="cityInput">
                  <Input
                    id="cityInput"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="New York"
                    disabled={pending || skippingLocation}
                  />
                </Field>
              </div>
              <div className="col-span-1">
                <Field label="State" htmlFor="stateInput">
                  <Input
                    id="stateInput"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    placeholder="NY"
                    disabled={pending || skippingLocation}
                  />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="ZIP" htmlFor="zipInput">
                  <Input
                    id="zipInput"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="10001"
                    disabled={pending || skippingLocation}
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" htmlFor="phoneInput">
                <Input
                  id="phoneInput"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (212) 555-0100"
                  disabled={pending || skippingLocation}
                />
              </Field>
              <Field label="Timezone" htmlFor="timezoneInput">
                <select
                  id="timezoneInput"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={pending || skippingLocation}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => setStep('vertical')}
                disabled={pending || skippingLocation}
              >
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                className="flex-1"
                disabled={locationName.trim().length < 2 || pending || skippingLocation}
                onClick={() => setStep('hours')}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <button
              type="button"
              onClick={handleSkipLocation}
              disabled={pending || skippingLocation}
              className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {skippingLocation ? 'Saving…' : 'Skip for later'}
            </button>
          </div>
        )}

        {/* Step 4 — Hours */}
        {step === 'hours' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">When are you open?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The AI uses this to tell customers when you&apos;re available. You can update this
                in{' '}
                <a href="/locations" className="underline hover:text-foreground">
                  Settings → Locations
                </a>
                .
              </p>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-4">
              {DAYS.map(({ key, label }) => {
                const dayHours = hours[key];
                const isOpen = dayHours !== null;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleDay(key)}
                      disabled={pending}
                      className={`w-16 flex-shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                        isOpen
                          ? 'bg-accent/10 text-accent hover:bg-accent/20'
                          : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {isOpen ? 'Open' : 'Closed'}
                    </button>
                    <p className="w-24 flex-shrink-0 text-sm text-foreground">{label}</p>
                    {isOpen ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={dayHours.open}
                          onChange={(e) => updateDayTime(key, 'open', e.target.value)}
                          disabled={pending}
                          className="rounded border border-input bg-background px-2 py-1 text-sm disabled:opacity-50"
                        />
                        <span className="text-muted-foreground">–</span>
                        <input
                          type="time"
                          value={dayHours.close}
                          onChange={(e) => updateDayTime(key, 'close', e.target.value)}
                          disabled={pending}
                          className="rounded border border-input bg-background px-2 py-1 text-sm disabled:opacity-50"
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Closed all day</p>
                    )}
                  </div>
                );
              })}
            </div>

            {state.status === 'error' && !state.fieldErrors && (
              <p className="text-sm text-error" role="alert">
                {state.message}
              </p>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => setStep('location')}
                disabled={pending}
              >
                Back
              </Button>
              <Button type="submit" size="lg" className="flex-1" disabled={pending}>
                {pending ? 'Setting up…' : 'Finish setup'}
              </Button>
            </div>

            <button
              type="submit"
              name="skipHours"
              value="1"
              disabled={pending}
              className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Skip for later
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useActionState } from '@/lib/use-action-state';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { HoursEditor } from './hours-editor';
import {
  createLocationAction,
  type LocationFormState,
} from '@/app/actions/locations-action';

const INITIAL: LocationFormState = { status: 'idle' };

export function CreateLocationButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createLocationAction, INITIAL);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.status === 'success') {
      toast.success('Location added');
      setOpen(false);
    } else if (state.status === 'error' && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Add location
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a location</DialogTitle>
          <DialogDescription>
            Locations are the routing unit for voice and WhatsApp. Add as many as you need.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Name"
              htmlFor="name"
              required
              error={fieldErrors?.name}
              className="sm:col-span-2"
            >
              <Input
                id="name"
                name="name"
                placeholder="Downtown"
                required
                disabled={pending}
                autoFocus
              />
            </Field>

            <Field label="Address" htmlFor="address" error={fieldErrors?.address}>
              <Input id="address" name="address" disabled={pending} />
            </Field>

            <Field label="Phone" htmlFor="phone" error={fieldErrors?.phone}>
              <Input id="phone" name="phone" type="tel" disabled={pending} />
            </Field>

            <Field label="City" htmlFor="city" error={fieldErrors?.city}>
              <Input id="city" name="city" disabled={pending} />
            </Field>

            <Field label="State" htmlFor="state" error={fieldErrors?.state}>
              <Input id="state" name="state" disabled={pending} />
            </Field>

            <Field
              label="Postal code"
              htmlFor="postal_code"
              error={fieldErrors?.postal_code}
              className="sm:col-span-2"
            >
              <Input id="postal_code" name="postal_code" disabled={pending} />
            </Field>
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium">Business hours</p>
            <p className="text-xs text-muted-foreground">
              Uncheck "Open" for days the location is closed.
            </p>
            <HoursEditor />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

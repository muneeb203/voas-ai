'use client';

import { useState } from 'react';
import { MoreHorizontal, Pencil, Phone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { HoursEditor } from './hours-editor';
import { useEffect } from 'react';
import { useActionState } from '@/lib/use-action-state';
import {
  deleteLocationAction,
  updateLocationAction,
  type LocationFormState,
} from '@/app/actions/locations-action';
import type { Location, LocationVoiceConfigSafe } from '@/lib/types';
import { LocationVoiceModal } from './location-voice-modal';

const INITIAL: LocationFormState = { status: 'idle' };

interface LocationRowActionsProps {
  location: Location;
  voiceConfig: LocationVoiceConfigSafe | null;
}

export function LocationRowActions({ location, voiceConfig }: LocationRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  async function onConfirmDelete() {
    const res = await deleteLocationAction(location.id);
    if (res.error) toast.error(res.error);
    else toast.success('Location deleted');
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Location actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setVoiceOpen(true)}>
            <Phone className="h-4 w-4" />
            {voiceConfig ? 'Voice settings' : 'Set up voice'}
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditLocationDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        location={location}
      />

      <LocationVoiceModal
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        locationId={location.id}
        locationName={location.name}
        existing={voiceConfig}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete "${location.name}"?`}
        description="This permanently removes the location."
        confirmLabel="Delete"
        destructive
        onConfirm={onConfirmDelete}
      />
    </>
  );
}

function EditLocationDialog({
  open,
  onOpenChange,
  location,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  location: Location;
}) {
  const [state, formAction, pending] = useActionState(updateLocationAction, INITIAL);
  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  useEffect(() => {
    if (state.status === 'success') {
      toast.success('Location updated');
      onOpenChange(false);
    } else if (state.status === 'error' && !state.fieldErrors) {
      toast.error(state.message);
    }
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit location</DialogTitle>
          <DialogDescription>{location.name}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={location.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Name"
              htmlFor="name-edit"
              required
              error={fieldErrors?.name}
              className="sm:col-span-2"
            >
              <Input
                id="name-edit"
                name="name"
                defaultValue={location.name}
                required
                disabled={pending}
              />
            </Field>

            <Field label="Address" htmlFor="address-edit">
              <Input
                id="address-edit"
                name="address"
                defaultValue={location.address ?? ''}
                disabled={pending}
              />
            </Field>

            <Field label="Phone" htmlFor="phone-edit">
              <Input
                id="phone-edit"
                name="phone"
                type="tel"
                defaultValue={location.phone ?? ''}
                disabled={pending}
              />
            </Field>

            <Field label="City" htmlFor="city-edit">
              <Input
                id="city-edit"
                name="city"
                defaultValue={location.city ?? ''}
                disabled={pending}
              />
            </Field>

            <Field label="State" htmlFor="state-edit">
              <Input
                id="state-edit"
                name="state"
                defaultValue={location.state ?? ''}
                disabled={pending}
              />
            </Field>

            <Field
              label="Postal code"
              htmlFor="postal_code-edit"
              className="sm:col-span-2"
            >
              <Input
                id="postal_code-edit"
                name="postal_code"
                defaultValue={location.postal_code ?? ''}
                disabled={pending}
              />
            </Field>
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium">Business hours</p>
            <HoursEditor defaultValue={location.hours} />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

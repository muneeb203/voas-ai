'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { updateCustomerAction } from '@/app/actions/customer-action';
import type { Customer } from '@/lib/types';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

interface CustomerInfoCardProps {
  customer: Customer;
  canEdit: boolean;
}

export function CustomerInfoCard({ customer, canEdit }: CustomerInfoCardProps) {
  const [name, setName] = useState(customer.name ?? '');
  const [email, setEmail] = useState(customer.email ?? '');
  const [tags, setTags] = useState<string[]>(customer.tags ?? []);
  const [pending, startTransition] = useTransition();

  function save(
    field: 'name' | 'email' | 'tags',
    payload: { name?: string; email?: string; tags?: string[] },
    onError: () => void,
  ) {
    startTransition(async () => {
      const res = await updateCustomerAction(customer.id, payload);
      if (res.error) {
        toast.error(res.error);
        onError();
      } else {
        toast.success('Customer updated');
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Customer
        </p>

        <EditableText
          label="Name"
          value={name}
          placeholder="Add a name"
          canEdit={canEdit}
          pending={pending}
          onSave={(next, onError) => {
            setName(next);
            save('name', { name: next }, () => {
              setName(customer.name ?? '');
              onError();
            });
          }}
        />

        <EditableText
          label="Email"
          value={email}
          placeholder="Add an email"
          type="email"
          canEdit={canEdit}
          pending={pending}
          onSave={(next, onError) => {
            setEmail(next);
            save('email', { email: next }, () => {
              setEmail(customer.email ?? '');
              onError();
            });
          }}
        />

        <TagsEditor
          tags={tags}
          canEdit={canEdit}
          pending={pending}
          onSave={(next, onError) => {
            setTags(next);
            save('tags', { tags: next }, () => {
              setTags(customer.tags ?? []);
              onError();
            });
          }}
        />

        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
          <Field label="Phone">{customer.phone ?? '—'}</Field>
          <Field label="Total orders">{customer.total_orders}</Field>
          <Field label="Lifetime value">{formatCurrency(customer.total_spent_cents)}</Field>
          <Field label="First seen">{format(new Date(customer.first_seen), 'MMM d, yyyy')}</Field>
          <Field label="Last seen">{format(new Date(customer.last_seen), 'MMM d, yyyy')}</Field>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}

interface EditableTextProps {
  label: string;
  value: string;
  placeholder: string;
  type?: 'text' | 'email';
  canEdit: boolean;
  pending: boolean;
  onSave: (next: string, onError: () => void) => void;
}

function EditableText({
  label,
  value,
  placeholder,
  type = 'text',
  canEdit,
  pending,
  onSave,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    setEditing(false);
    if (draft.trim() === value.trim()) return;
    onSave(draft.trim(), () => setDraft(value));
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            type={type}
            value={draft}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            onBlur={commit}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => canEdit && setEditing(true)}
        className="group flex items-center gap-2 text-left text-sm disabled:cursor-default"
      >
        <span className={value ? '' : 'text-muted-foreground'}>{value || placeholder}</span>
        {canEdit && (
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </button>
    </div>
  );
}

interface TagsEditorProps {
  tags: string[];
  canEdit: boolean;
  pending: boolean;
  onSave: (next: string[], onError: () => void) => void;
}

function TagsEditor({ tags, canEdit, pending, onSave }: TagsEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tags.join(', '));

  function commit() {
    setEditing(false);
    const next = draft
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (next.join('|') === tags.join('|')) return;
    onSave(next, () => setDraft(tags.join(', ')));
  }

  function cancel() {
    setDraft(tags.join(', '));
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">Tags</span>
      {editing ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={draft}
            disabled={pending}
            placeholder="vip, regular, allergy"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
          />
          <button type="button" onClick={commit} disabled={pending} aria-label="Save tags">
            <Check className="h-4 w-4 text-success" />
          </button>
          <button type="button" onClick={cancel} disabled={pending} aria-label="Cancel">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => canEdit && setEditing(true)}
          className="group flex flex-wrap items-center gap-1 text-left disabled:cursor-default"
        >
          {tags.length > 0 ? (
            tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Add tags</span>
          )}
          {canEdit && (
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </button>
      )}
    </div>
  );
}

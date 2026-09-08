'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const VERTICALS = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'dental', label: 'Dental' },
  { value: 'salon', label: 'Salon' },
  { value: 'auto', label: 'Auto Repair' },
  { value: 'law', label: 'Law' },
  { value: 'other', label: 'Other' },
  { value: 'default', label: 'Default' },
];

interface WorkspaceVerticalSelectProps {
  workspaceId: string;
  currentVertical: string;
  onUpdate?: () => void;
}

export function WorkspaceVerticalSelect({
  workspaceId,
  currentVertical,
  onUpdate,
}: WorkspaceVerticalSelectProps) {
  const [loading, setLoading] = useState(false);

  async function handleChange(vertical: string) {
    if (vertical === currentVertical) return;

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(
        `${apiUrl}/v1/admin/workspaces/${workspaceId}/vertical`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ vertical }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error?.message || 'Failed to update vertical');
        return;
      }

      toast.success('Vertical updated');
      onUpdate?.();
    } catch (err) {
      console.error('Failed to update vertical:', err);
      toast.error('Failed to update vertical');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Business Type</label>
      <Select value={currentVertical} onValueChange={handleChange} disabled={loading}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a vertical" />
        </SelectTrigger>
        <SelectContent>
          {VERTICALS.map((v) => (
            <SelectItem key={v.value} value={v.value}>
              {v.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

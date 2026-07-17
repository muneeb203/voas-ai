'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setWorkspaceVoiceModelAction } from '@/app/actions/admin-action';

// Kept in sync with AVAILABLE_MODELS in apps/api/app/models/voice.py — the
// backend validates against that list, so ids must match.
const VOICE_MODEL_OPTIONS = [
  { id: 'gpt-4o-mini', label: 'GPT-4o mini (fast, cheap, default)' },
  { id: 'gpt-4o', label: 'GPT-4o (smarter, slower)' },
] as const;

export function AdminVoiceModelCard({
  workspaceId,
  currentModel,
}: {
  workspaceId: string;
  currentModel: string | null;
}) {
  const [model, setModel] = useState(currentModel ?? 'gpt-4o-mini');
  const [pending, startTransition] = useTransition();

  const dirty = model !== (currentModel ?? 'gpt-4o-mini');

  function onSave() {
    startTransition(async () => {
      const res = await setWorkspaceVoiceModelAction(workspaceId, model);
      if (res?.error) toast.error(res.error);
      else toast.success('Model updated — re-syncing the voice agent');
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div>
          <p className="text-sm font-semibold">Voice model (admin only)</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Owners can&apos;t change this — it&apos;s fixed to the default. Set a different LLM here
            if a workspace needs one. Saving re-syncs the Vapi assistant.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={model} onValueChange={setModel} disabled={pending}>
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICE_MODEL_OPTIONS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={onSave} disabled={!dirty || pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
        {currentModel === null && (
          <p className="text-xs text-muted-foreground">
            This workspace has no voice settings yet — saving will create them.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

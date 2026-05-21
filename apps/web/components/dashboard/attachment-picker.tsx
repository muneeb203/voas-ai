'use client';

import { useRef, useState } from 'react';
import { Paperclip, X, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { requestAttachmentUploadAction } from '@/app/actions/tickets-action';
import type { AttachmentRef } from '@/lib/api/tickets';
import { cn } from '@/lib/utils';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
];

interface AttachmentPickerProps {
  ticketId: string;
  attachments: AttachmentRef[];
  onChange: (next: AttachmentRef[]) => void;
  disabled?: boolean;
}

interface UploadingFile {
  id: string;
  filename: string;
  progress: 'uploading' | 'done' | 'error';
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentPicker({ ticketId, attachments, onChange, disabled }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);

  async function uploadOne(file: File): Promise<AttachmentRef | null> {
    if (!ALLOWED.includes(file.type)) {
      toast.error(`Unsupported file type: ${file.type || 'unknown'}`);
      return null;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`${file.name} is too large (10 MB max)`);
      return null;
    }

    const tempId = `${file.name}-${file.size}-${Date.now()}`;
    setUploading((u) => [...u, { id: tempId, filename: file.name, progress: 'uploading' }]);

    try {
      const signed = await requestAttachmentUploadAction(ticketId, {
        filename: file.name,
        content_type: file.type,
        size: file.size,
      });
      if (signed.error || !signed.data) {
        throw new Error(signed.error ?? 'Could not start upload');
      }

      const putRes = await fetch(signed.data.signed_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`);
      }

      setUploading((u) => u.map((x) => (x.id === tempId ? { ...x, progress: 'done' } : x)));
      // Drop the entry after a moment
      setTimeout(() => setUploading((u) => u.filter((x) => x.id !== tempId)), 800);

      return {
        path: signed.data.path,
        filename: signed.data.filename,
        content_type: signed.data.content_type,
        size: signed.data.size,
      };
    } catch (err) {
      setUploading((u) => u.map((x) => (x.id === tempId ? { ...x, progress: 'error' } : x)));
      toast.error(`${file.name}: ${(err as Error).message}`);
      return null;
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const results = await Promise.all(Array.from(files).map(uploadOne));
    const next = [...attachments, ...results.filter((r): r is AttachmentRef => r !== null)];
    onChange(next);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeAt(index: number) {
    onChange(attachments.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept={ALLOWED.join(',')}
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="inline-flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-accent hover:text-foreground disabled:opacity-50"
      >
        <Paperclip className="h-3.5 w-3.5" />
        Attach files
      </button>

      {(attachments.length > 0 || uploading.length > 0) && (
        <ul className="space-y-1">
          {attachments.map((a, i) => (
            <li
              key={`${a.path}-${i}`}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs"
            >
              <span className="flex items-center gap-2 truncate">
                <FileText className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
                <span className="truncate">{a.filename}</span>
                <span className="flex-shrink-0 text-muted-foreground">({humanSize(a.size)})</span>
              </span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${a.filename}`}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
          {uploading.map((u) => (
            <li
              key={u.id}
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs',
                u.progress === 'error'
                  ? 'border-error/40 bg-error/5 text-error'
                  : 'border-border bg-muted/30 text-muted-foreground',
              )}
            >
              {u.progress === 'error' ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              <span className="truncate">{u.filename}</span>
              <span>· {u.progress === 'error' ? 'failed' : u.progress === 'done' ? 'done' : 'uploading…'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

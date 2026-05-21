import { FileText } from 'lucide-react';
import type { SupportMessage } from '@/lib/types';

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface AttachmentListProps {
  attachments: NonNullable<SupportMessage['attachments']> | null | undefined;
  storageBase: string;
}

/**
 * Show attachment chips. We expose the public Storage URL (Supabase Storage
 * needs RLS to enforce access, which we set up in 00003_ticket_attachments_storage.sql).
 * The link opens the file; the browser handles inline preview for images/PDFs.
 */
export function AttachmentList({ attachments, storageBase }: AttachmentListProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a, i) => {
        const url = `${storageBase}/object/authenticated/ticket-attachments/${a.path}`;
        return (
          <li key={`${a.path}-${i}`}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-accent"
            >
              <FileText className="h-3.5 w-3.5 text-accent" />
              <span className="max-w-[200px] truncate">{a.filename}</span>
              <span className="text-muted-foreground">({humanSize(a.size)})</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

-- Update email_logs status constraint to include queued and skipped statuses
ALTER TABLE public.email_logs
DROP CONSTRAINT IF EXISTS email_logs_status_check;

ALTER TABLE public.email_logs
ADD CONSTRAINT email_logs_status_check CHECK (status in ('success', 'failed', 'queued', 'skipped'));

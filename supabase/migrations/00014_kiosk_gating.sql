-- Add admin-controlled kiosk gating fields to workspace_kiosk_settings
ALTER TABLE workspace_kiosk_settings
  ADD COLUMN kiosk_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN max_kiosk_urls integer NOT NULL DEFAULT 1
    CHECK (max_kiosk_urls >= 1 AND max_kiosk_urls <= 10);

-- Ensure token strings are globally unique forever (no reuse across workspaces)
ALTER TABLE kiosk_tokens
  ADD CONSTRAINT kiosk_tokens_token_unique UNIQUE (token);

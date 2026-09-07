'use client';

import { useState } from 'react';
import { Loader2, Globe, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface WebsiteExtractorModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (systemPrompt: string) => void;
  workspaceId: string;
}

export function WebsiteExtractorModal({
  open,
  onClose,
  onSuccess,
  workspaceId,
}: WebsiteExtractorModalProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    if (!url.trim()) {
      setError('Please enter a website URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
      const response = await fetch(`${apiUrl}/v1/workspaces/${workspaceId}/voice/extract-website`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to extract website details');
      }

      const data = await response.json();
      const extracted = data.data;

      // Generate a business-specific system prompt from extracted data
      const systemPrompt = generateSystemPrompt(extracted);

      // Close modal and pass the generated prompt to parent
      onSuccess(systemPrompt);
      setUrl('');
      setError(null);
      onClose();

      toast.success('System prompt auto-generated from your website!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to extract website details';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Extract & Generate Prompt
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="website-url" className="text-sm font-medium">
              Website URL
            </Label>
            <div className="flex gap-2">
              <Input
                id="website-url"
                placeholder="e.g., https://example.com or example.com"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handleExtract();
                  }
                }}
              />
              <Button
                onClick={handleExtract}
                disabled={loading || !url.trim()}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  'Extract'
                )}
              </Button>
            </div>
            {error && (
              <div className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground rounded-lg bg-muted/50 p-3">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="space-y-1 list-disc pl-4">
              <li>Enter your website URL</li>
              <li>We extract your business details</li>
              <li>Auto-generate a custom system prompt</li>
              <li>The prompt is filled in your settings</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function generateSystemPrompt(extracted: {
  name: string;
  description: string;
  services: string[];
  location: string;
  phone: string;
  email: string;
}): string {
  const servicesList = extracted.services.length > 0
    ? extracted.services.join(', ')
    : 'various services';

  const prompt = `You are the friendly front-desk agent for ${extracted.name}.

About the business:
${extracted.description ? `- Description: ${extracted.description}` : ''}
${extracted.location ? `- Location: ${extracted.location}` : ''}
${extracted.phone ? `- Phone: ${extracted.phone}` : ''}
${extracted.email ? `- Email: ${extracted.email}` : ''}
- Services: ${servicesList}

Your job:
- Greet warmly and professionally
- Answer questions about our services, hours, and location
- Handle inquiries and booking requests
- Be helpful, knowledgeable, and courteous
- If uncertain, offer to connect the customer with a team member

Tone: Professional, friendly, and helpful. Be confident about what you know about the business.`;

  return prompt;
}

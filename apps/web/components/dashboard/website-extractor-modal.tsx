'use client';

import { useState } from 'react';
import { Loader2, Globe, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
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

interface ExtractedWebsiteData {
  name: string;
  description: string;
  services: string[];
  location: string;
  phone: string;
  email: string;
}

interface WebsiteExtractorModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (data: ExtractedWebsiteData) => void;
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
  const [extracted, setExtracted] = useState<ExtractedWebsiteData | null>(null);

  async function handleExtract() {
    if (!url.trim()) {
      setError('Please enter a website URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/voice/extract-website`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to extract website details');
      }

      const data = await response.json();
      setExtracted(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to extract website details';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (extracted) {
      onSuccess(extracted);
      onClose();
      setUrl('');
      setExtracted(null);
      setError(null);
    }
  }

  function handleReset() {
    setUrl('');
    setExtracted(null);
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Extract Business Details from Website
          </DialogTitle>
        </DialogHeader>

        {!extracted ? (
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
                <li>Enter your business website URL</li>
                <li>We'll extract your business name, description, services, and contact info</li>
                <li>Review the extracted data before confirming</li>
                <li>Your system prompt will be auto-populated with this information</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
              Review and edit the extracted details below:
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              <div>
                <Label className="text-xs font-semibold text-foreground">Business Name</Label>
                <Input
                  value={extracted.name}
                  onChange={(e) =>
                    setExtracted({ ...extracted, name: e.target.value })
                  }
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground">Description</Label>
                <Input
                  value={extracted.description}
                  onChange={(e) =>
                    setExtracted({ ...extracted, description: e.target.value })
                  }
                  className="mt-1"
                  placeholder="Brief description of your business"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground">Services</Label>
                <div className="mt-2 space-y-2">
                  {extracted.services.map((service, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={service}
                        onChange={(e) => {
                          const newServices = [...extracted.services];
                          newServices[idx] = e.target.value;
                          setExtracted({ ...extracted, services: newServices });
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newServices = extracted.services.filter((_, i) => i !== idx);
                          setExtracted({ ...extracted, services: newServices });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setExtracted({
                        ...extracted,
                        services: [...extracted.services, ''],
                      });
                    }}
                  >
                    + Add Service
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-foreground">Location</Label>
                <Input
                  value={extracted.location}
                  onChange={(e) =>
                    setExtracted({ ...extracted, location: e.target.value })
                  }
                  className="mt-1"
                  placeholder="Street address or location"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-foreground">Phone</Label>
                  <Input
                    value={extracted.phone}
                    onChange={(e) =>
                      setExtracted({ ...extracted, phone: e.target.value })
                    }
                    className="mt-1"
                    placeholder="Contact phone"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">Email</Label>
                  <Input
                    value={extracted.email}
                    onChange={(e) =>
                      setExtracted({ ...extracted, email: e.target.value })
                    }
                    className="mt-1"
                    placeholder="Contact email"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {extracted ? (
            <>
              <Button variant="outline" onClick={handleReset}>
                Extract Another
              </Button>
              <Button onClick={handleConfirm}>Use This Data</Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

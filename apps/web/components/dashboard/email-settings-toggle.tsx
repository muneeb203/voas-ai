'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface EmailLog {
  id: string;
  recipient_email: string;
  call_data: {
    caller_name: string;
    duration_seconds: number;
  };
  sent_at: string;
  status: 'success' | 'failed';
}

interface Settings {
  enabled: boolean;
  recipient_email: string;
}

export function EmailSettingsToggle({ workspaceId }: { workspaceId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, [workspaceId]);

  async function fetchSettings() {
    try {
      const res = await fetch(`/v1/workspaces/${workspaceId}/email-settings`);
      const data = await res.json();
      if (data.data) {
        setEnabled(data.data.enabled);
        setEmail(data.data.recipient_email);
      }
      await fetchLogs();
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }

  async function fetchLogs() {
    try {
      const res = await fetch(`/v1/workspaces/${workspaceId}/email-logs?limit=50`);
      const data = await res.json();
      setLogs(data.data || []);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleNotifications() {
    const newEnabled = !enabled;
    try {
      const res = await fetch(`/v1/workspaces/${workspaceId}/email-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });
      if (res.ok) {
        setEnabled(newEnabled);
      }
    } catch (err) {
      console.error('Failed to toggle notifications:', err);
    }
  }

  return (
    <>
      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Call Notifications</p>
            <p className="text-sm text-muted-foreground">{email}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Rate limit: 10 calls/hour. Queued calls sent after 15-30 minutes.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={toggleNotifications} />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Email History</h2>
        <div className="border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No emails sent yet</div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium">Caller</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Duration</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Sent</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-muted/50">
                    <td className="px-6 py-3 text-sm">{log.call_data.caller_name}</td>
                    <td className="px-6 py-3 text-sm">
                      {Math.floor(log.call_data.duration_seconds / 60)}m{' '}
                      {log.call_data.duration_seconds % 60}s
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {new Date(log.sent_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={log.status === 'success' ? 'default' : 'destructive'}
                      >
                        {log.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

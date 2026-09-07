'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { EmailLog } from '@/lib/api/email';

export function EmailSettingsToggle({ workspaceId }: { workspaceId: string }) {
  const [email, setEmail] = useState('');
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [workspaceId]);

  async function fetchLogs() {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiUrl}/v1/workspaces/${workspaceId}/email-logs?limit=50`, {
        credentials: 'include',
      });
      const data = await res.json();
      setLogs(data.data || []);
      if (data.data && data.data.length > 0) {
        setEmail(data.data[0].recipient_email);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="bg-card border rounded-lg p-6">
        <div>
          <p className="font-medium">Call Notifications</p>
          <p className="text-sm text-muted-foreground">{email || 'Loading...'}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Email notifications are <span className="font-semibold text-green-600">enabled by default</span>. Rate limit: 10 calls/hour. Excess emails queued for 15-30 minutes.
          </p>
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

'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, Clock } from 'lucide-react';

interface EmailStats {
  workspace_id: string;
  workspace_name: string;
  emails_sent_today: number;
  emails_queued: number;
  total_sent: number;
}

interface EmailLog {
  workspace_id: string;
  workspace_name: string;
  recipient_email: string;
  caller_name: string;
  duration_seconds: number;
  sent_at: string;
  status: string;
}

export function AdminEmailDashboard() {
  const [stats, setStats] = useState<EmailStats[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // Fetch stats
      const statsRes = await fetch(`${apiUrl}/v1/admin/emails/stats`, {
        credentials: 'include',
      });
      const statsData = await statsRes.json();
      setStats(statsData.data || []);

      // Fetch logs
      const logsRes = await fetch(`${apiUrl}/v1/admin/emails/logs?limit=50`, {
        credentials: 'include',
      });
      const logsData = await logsRes.json();
      setLogs(logsData.data || []);
    } catch (err) {
      console.error('Failed to fetch email data:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center text-muted-foreground py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.workspace_id} className="bg-card border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-4">{stat.workspace_name}</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Sent Today</span>
                </div>
                <span className="font-semibold">{stat.emails_sent_today}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-muted-foreground">Queued</span>
                </div>
                <span className="font-semibold">{stat.emails_queued}</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-muted-foreground">Total Sent</span>
                </div>
                <span className="font-semibold">{stat.total_sent}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Email Logs */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Emails</h2>
        <div className="border rounded-lg overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No emails sent yet</div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium">Workspace</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Email</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Caller</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Duration</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Sent</th>
                  <th className="px-6 py-3 text-left text-sm font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={`${log.workspace_id}-${log.sent_at}`} className="border-b hover:bg-muted/50">
                    <td className="px-6 py-3 text-sm font-medium">{log.workspace_name}</td>
                    <td className="px-6 py-3 text-sm text-muted-foreground">{log.recipient_email}</td>
                    <td className="px-6 py-3 text-sm">{log.caller_name}</td>
                    <td className="px-6 py-3 text-sm">
                      {Math.floor(log.duration_seconds / 60)}m {log.duration_seconds % 60}s
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {new Date(log.sent_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={
                          log.status === 'success' ? 'default' :
                          log.status === 'queued' ? 'secondary' :
                          log.status === 'skipped' ? 'outline' :
                          'destructive'
                        }
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
    </div>
  );
}

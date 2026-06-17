import type { Metadata } from 'next';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { requireAdminSession } from '@/lib/auth/admin';
import { listAdminUsage } from '@/lib/api/admin';
import { isApiError, type AdminWorkspaceUsageRow } from '@/lib/types';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const metadata: Metadata = {
  title: 'Admin · Usage & billing',
  robots: { index: false, follow: false },
};

function pct(used: number, limit: number | null): string {
  if (limit === null || limit === 0) return '—';
  return `${Math.min(999, Math.round((used / limit) * 100))}%`;
}

function formatEnd(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d');
  } catch {
    return iso;
  }
}

export default async function AdminUsagePage() {
  await requireAdminSession('/admin/usage');
  const res = await listAdminUsage();
  const rows: AdminWorkspaceUsageRow[] = !isApiError(res) ? res.data : [];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Billing"
        title="Usage & billing"
        description="Per-workspace usage for the current rolling 30-day period. Grant credits or change plans from each workspace."
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Voice</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Help bot</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Period ends</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No workspaces yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.workspace_id}>
                    <TableCell>
                      <div className="font-medium">{row.workspace_name}</div>
                      <div className="text-xs capitalize text-muted-foreground">{row.status}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {row.plan}
                      </Badge>
                      {row.usage_enforcement_disabled && (
                        <Badge variant="secondary" className="ml-1">
                          Limits off
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {row.voice_used}
                      {row.voice_limit != null ? ` / ${row.voice_limit}` : ''}{' '}
                      <span className="text-muted-foreground">({pct(row.voice_used, row.voice_limit)})</span>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {row.whatsapp_used}
                      {row.whatsapp_limit != null ? ` / ${row.whatsapp_limit}` : ''}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {row.help_used}
                      {row.help_limit != null ? ` / ${row.help_limit}` : ''}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {row.total_tokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatEnd(row.period_end)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/workspaces/${row.workspace_id}?tab=billing`}
                        className="text-sm text-accent hover:underline"
                      >
                        Manage
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

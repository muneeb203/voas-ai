import type { Metadata } from 'next';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { requireAdminSession } from '@/lib/auth/admin';
import { listAdminAuditLogs } from '@/lib/api/admin';
import { isApiError } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminPageHeader } from '@/components/admin/admin-page-header';

export const metadata: Metadata = {
  title: 'Admin · Audit log',
  robots: { index: false, follow: false },
};

function actorBadge(t: 'user' | 'admin' | 'system') {
  if (t === 'admin') return <Badge variant="destructive">Admin</Badge>;
  if (t === 'system') return <Badge variant="secondary">System</Badge>;
  return <Badge variant="outline">User</Badge>;
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: { actor_type?: string; action?: string };
}) {
  await requireAdminSession('/admin/audit-log');

  const res = await listAdminAuditLogs({
    actor_type: searchParams.actor_type,
    action: searchParams.action,
  });
  const entries = !isApiError(res) ? res.data : [];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Operations"
        title="Audit log"
        description={`Last ${entries.length} entries`}
      />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <select
          name="actor_type"
          defaultValue={searchParams.actor_type ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All actors</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="system">System</option>
        </select>
        <input
          name="action"
          placeholder="Action filter (e.g. ticket.* or admin.workspace.suspended)"
          defaultValue={searchParams.action ?? ''}
          className="h-10 min-w-[280px] rounded-md border border-input bg-background px-3 text-sm"
        />
        <button
          type="submit"
          className="h-10 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-600"
        >
          Filter
        </button>
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Resource</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {actorBadge(e.actor_type)}
                      <span className="text-sm">
                        {e.actor_name ?? e.actor_email ?? e.actor_id.slice(0, 8)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.action}</TableCell>
                  <TableCell className="text-sm">
                    {e.workspace_id ? (
                      <Link
                        href={`/admin/workspaces/${e.workspace_id}`}
                        className="hover:text-accent-700"
                      >
                        {e.workspace_name ?? e.workspace_id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.resource_type ? `${e.resource_type} · ${(e.resource_id ?? '').slice(0, 8)}` : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

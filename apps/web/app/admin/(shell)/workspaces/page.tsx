import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { requireAdminSession } from '@/lib/auth/admin';
import { listAdminWorkspaces } from '@/lib/api/admin';
import { isApiError } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { RefreshButton } from '@/components/admin/refresh-button';

export const metadata: Metadata = {
  title: 'Admin · Workspaces',
  robots: { index: false, follow: false },
};

function statusBadge(status: 'active' | 'suspended' | 'deleted') {
  if (status === 'active') return <Badge variant="success">Active</Badge>;
  if (status === 'suspended') return <Badge variant="warning">Suspended</Badge>;
  return <Badge variant="destructive">Deleted</Badge>;
}

// Which engine the business runs on: booking (salon) vs ordering (restaurant).
const VERTICAL_LABELS: Record<string, string> = {
  restaurant: '🍽 Restaurant',
  salon: '✂️ Salon',
  dental: '🦷 Dental',
  auto: '🔧 Auto',
  other: 'Other',
};

function verticalBadge(vertical: string) {
  return <Badge variant="secondary">{VERTICAL_LABELS[vertical] ?? vertical}</Badge>;
}

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; plan?: string };
}) {
  await requireAdminSession('/admin/workspaces');

  const res = await listAdminWorkspaces({
    search: searchParams.search,
    status: searchParams.status,
    plan: searchParams.plan,
  });
  const workspaces = !isApiError(res) ? res.data : [];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Operations"
        title="Workspaces"
        description={`${workspaces.length} workspace${workspaces.length === 1 ? '' : 's'}`}
        action={<RefreshButton />}
      />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          name="search"
          placeholder="Search by name or slug…"
          defaultValue={searchParams.search ?? ''}
          className="max-w-xs"
        />
        <select
          name="status"
          defaultValue={searchParams.status ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deleted">Deleted</option>
        </select>
        <select
          name="plan"
          defaultValue={searchParams.plan ?? ''}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All plans</option>
          <option value="essentials">Essentials</option>
          <option value="professional">Professional</option>
          <option value="business">Business</option>
          <option value="enterprise">Enterprise</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-600"
        >
          Filter
        </button>
      </form>

      <Card>
        <CardContent className="p-0">
          {workspaces.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No workspaces match your filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Vertical</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Voice</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Locations</TableHead>
                  <TableHead>Open tickets</TableHead>
                  <TableHead>Errors 30d</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <Link
                        href={`/admin/workspaces/${w.id}`}
                        className="font-medium hover:text-accent-700"
                      >
                        {w.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{w.slug}</p>
                    </TableCell>
                    <TableCell>{verticalBadge(w.vertical)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{w.plan}</Badge>
                    </TableCell>
                    <TableCell>{statusBadge(w.status)}</TableCell>
                    <TableCell>
                      {w.voice_enabled ? (
                        <Badge variant="success">On</Badge>
                      ) : (
                        <Badge variant="secondary">Off</Badge>
                      )}
                    </TableCell>
                    <TableCell>{w.member_count}</TableCell>
                    <TableCell>{w.location_count}</TableCell>
                    <TableCell>{w.open_ticket_count}</TableCell>
                    <TableCell>
                      {w.error_count > 0 ? (
                        <span className="font-medium text-error">{w.error_count}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {w.last_activity_at
                        ? formatDistanceToNow(new Date(w.last_activity_at), { addSuffix: true })
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

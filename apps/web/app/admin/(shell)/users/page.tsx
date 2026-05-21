import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { requireAdminSession } from '@/lib/auth/admin';
import { listAdminUsers } from '@/lib/api/admin';
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
  title: 'Admin · Users',
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage() {
  await requireAdminSession('/admin/users');

  const res = await listAdminUsers();
  const users = !isApiError(res) ? res.data : [];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Operations"
        title="Users"
        description={`${users.length} user${users.length === 1 ? '' : 's'} across all workspaces`}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Workspaces</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="font-medium">{u.full_name ?? u.email ?? u.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.email}
                      {u.is_admin && <Badge variant="destructive" className="ml-2">Admin</Badge>}
                    </p>
                  </TableCell>
                  <TableCell>
                    {u.workspaces.length === 0 ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <ul className="space-y-1">
                        {u.workspaces.map((w) => (
                          <li key={w.workspace_id} className="text-sm">
                            <Link
                              href={`/admin/workspaces/${w.workspace_id}`}
                              className="hover:text-accent-700"
                            >
                              {w.workspace_name ?? w.workspace_slug ?? w.workspace_id.slice(0, 8)}
                            </Link>
                            <span className="ml-2 text-xs text-muted-foreground">{w.role}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.last_sign_in_at
                      ? formatDistanceToNow(new Date(u.last_sign_in_at), { addSuffix: true })
                      : 'never'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
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

import type { Metadata } from 'next';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { requireAdminSession } from '@/lib/auth/admin';
import { listAdminGlobalLog, listAdminWorkspaces } from '@/lib/api/admin';
import type { AdminLogCategory } from '@/lib/api/admin';
import { isApiError } from '@/lib/types';
import { cn } from '@/lib/utils';
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
import { RefreshButton } from '@/components/admin/refresh-button';
import { PageErrorCard } from '@/components/dashboard/page-error-card';

export const metadata: Metadata = {
  title: 'Admin · Logs',
  robots: { index: false, follow: false },
};

const FILTERS: { id: 'all' | AdminLogCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'operation', label: 'Operations' },
  { id: 'config', label: 'Config changes' },
  { id: 'error', label: 'Errors' },
];

function categoryBadge(category: AdminLogCategory) {
  if (category === 'error') return <Badge variant="destructive">error</Badge>;
  if (category === 'config') return <Badge variant="outline">config</Badge>;
  return <Badge variant="secondary">activity</Badge>;
}

function isCategory(v: string | undefined): v is AdminLogCategory {
  return v === 'config' || v === 'operation' || v === 'error';
}

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: { category?: string; workspace_id?: string };
}) {
  await requireAdminSession('/admin/logs');

  const category = isCategory(searchParams.category) ? searchParams.category : 'all';
  const workspaceId = searchParams.workspace_id || undefined;

  const [logRes, workspacesRes] = await Promise.all([
    listAdminGlobalLog({ workspace_id: workspaceId, limit: 300 }),
    listAdminWorkspaces({}),
  ]);

  const loadError = isApiError(logRes) ? logRes.error.message : null;
  const rows = !isApiError(logRes) ? logRes.data : [];
  const workspaces = !isApiError(workspacesRes) ? workspacesRes.data : [];

  const visible = category === 'all' ? rows : rows.filter((r) => r.category === category);

  const qs = (next: { category?: string; workspace_id?: string }) => {
    const p = new URLSearchParams();
    const c = next.category ?? category;
    const w = next.workspace_id ?? workspaceId;
    if (c && c !== 'all') p.set('category', c);
    if (w) p.set('workspace_id', w);
    return p.toString() ? `/admin/logs?${p}` : '/admin/logs';
  };

  const scopeLabel = workspaceId
    ? (workspaces.find((w) => w.id === workspaceId)?.name ?? 'this workspace')
    : 'all businesses';

  return (
    <div>
      <AdminPageHeader
        eyebrow="Operations"
        title="Logs"
        description={`${visible.length} recent event${visible.length === 1 ? '' : 's'} across ${scopeLabel}`}
        action={<RefreshButton />}
      />

      {loadError ? (
        <PageErrorCard title="Couldn't load logs" message={loadError} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <Link
                  key={f.id}
                  href={qs({ category: f.id })}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    category === f.id
                      ? 'border-brand bg-brand text-white'
                      : 'border-border text-muted-foreground hover:bg-secondary',
                  )}
                >
                  {f.label}
                </Link>
              ))}
            </div>

            <form className="ml-auto flex items-center gap-2">
              {category !== 'all' && <input type="hidden" name="category" value={category} />}
              <select
                name="workspace_id"
                defaultValue={workspaceId ?? ''}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">All businesses</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-9 rounded-md bg-brand px-4 text-sm font-medium text-white hover:bg-brand-600"
              >
                Apply
              </button>
              {workspaceId && (
                <Link
                  href={qs({ workspace_id: '' })}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Clear
                </Link>
              )}
            </form>
          </div>

          <Card>
            <CardContent className="p-0">
              {visible.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm font-medium">Nothing logged yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {category === 'all'
                      ? 'Calls, orders, bookings, config changes and errors will appear here as they happen.'
                      : 'No events in this category. Try a different filter.'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">When</TableHead>
                      <TableHead className="w-[110px]">Type</TableHead>
                      <TableHead className="w-[180px]">Business</TableHead>
                      <TableHead>Event</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((r, i) => (
                      <TableRow key={`${r.at}-${r.category}-${i}`}>
                        <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(r.at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="align-top">{categoryBadge(r.category)}</TableCell>
                        <TableCell className="align-top">
                          {r.workspace_id ? (
                            <Link
                              href={`/admin/workspaces/${r.workspace_id}?tab=log`}
                              className="text-sm font-medium text-brand hover:underline"
                            >
                              {r.workspace_name}
                            </Link>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {r.workspace_name}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-sm font-medium">{r.title}</span>
                            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                              {r.label}
                            </code>
                          </div>
                          {r.subtitle && (
                            <p className="mt-0.5 break-words text-xs text-muted-foreground">
                              {r.subtitle}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

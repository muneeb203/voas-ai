import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { requireAdminSession } from '@/lib/auth/admin';
import { listAdminTickets } from '@/lib/api/admin';
import { isApiError, type TicketStatus } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  StatusBadge,
  PriorityBadge,
  categoryLabel,
} from '@/components/dashboard/ticket-badges';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin · Support inbox',
  robots: { index: false, follow: false },
};

type FilterTab = 'all' | 'open' | 'in_progress' | 'waiting_user' | 'resolved';

const TABS: { id: FilterTab; label: string; statusFilter?: TicketStatus }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open', statusFilter: 'open' },
  { id: 'in_progress', label: 'In progress', statusFilter: 'in_progress' },
  { id: 'waiting_user', label: 'Waiting on user', statusFilter: 'waiting_user' },
  { id: 'resolved', label: 'Resolved', statusFilter: 'resolved' },
];

export default async function AdminSupportInboxPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  await requireAdminSession('/admin/support');

  const filter: FilterTab =
    (TABS.find((t) => t.id === searchParams.filter)?.id as FilterTab) ?? 'all';
  const activeTab = TABS.find((t) => t.id === filter)!;
  const res = await listAdminTickets({ status: activeTab.statusFilter });
  const tickets = !isApiError(res) ? res.data : [];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Operations"
        title="Support inbox"
        description="All tickets across every workspace"
      />

      <div className="mb-6 flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === 'all' ? '/admin/support' : `/admin/support?filter=${tab.id}`}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab.id === filter
                ? 'border-error text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {tickets.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No tickets in this view.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/support/${t.id}`}
                        className="hover:text-accent-700"
                      >
                        {t.subject}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {t.message_count} message{t.message_count === 1 ? '' : 's'}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.creator_name ?? t.creator_email ?? '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={t.priority} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {categoryLabel(t.category)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
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

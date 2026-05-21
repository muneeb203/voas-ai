import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { LifeBuoy } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listTickets } from '@/lib/api/tickets';
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
import { PageHeader } from '@/components/dashboard/page-header';
import { NewTicketButton } from '@/components/dashboard/new-ticket-modal';
import {
  StatusBadge,
  PriorityBadge,
  categoryLabel,
} from '@/components/dashboard/ticket-badges';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Support',
};

type FilterTab = 'all' | 'open' | 'resolved';

const TABS: { id: FilterTab; label: string; statusFilter?: TicketStatus }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open', statusFilter: 'open' },
  { id: 'resolved', label: 'Resolved', statusFilter: 'resolved' },
];

export default async function SupportPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const session = await requireDashboardSession('/support');

  const filter: FilterTab =
    searchParams.filter === 'open' || searchParams.filter === 'resolved'
      ? searchParams.filter
      : 'all';

  const activeTab = TABS.find((t) => t.id === filter)!;
  const res = await listTickets(session.active.workspace_id, activeTab.statusFilter);
  const tickets = !isApiError(res) ? res.data : [];

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Support"
        description="File tickets and track replies from the VOAS team."
        action={<NewTicketButton />}
      />

      <div className="mb-6 flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === 'all' ? '/support' : `/support?filter=${tab.id}`}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab.id === filter
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <LifeBuoy className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-lg font-semibold">
              {filter === 'all' ? 'No tickets yet' : `No ${filter} tickets`}
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {filter === 'all'
                ? 'Have a question or hit a problem? Open a ticket and we’ll get back within one business day.'
                : 'Nothing here. Switch tabs to see other tickets.'}
            </p>
            {filter === 'all' && (
              <div className="mt-2">
                <NewTicketButton />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Last update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        href={`/support/${t.id}`}
                        className="block hover:text-accent-700"
                      >
                        {t.subject}
                        <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                          {t.message_count} message{t.message_count === 1 ? '' : 's'}
                        </p>
                      </Link>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

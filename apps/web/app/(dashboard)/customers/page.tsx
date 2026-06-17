import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Users2, ChevronRight } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listCustomers } from '@/lib/api/customers';
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
import { PageHeader } from '@/components/dashboard/page-header';
import { CustomerFilters } from '@/components/dashboard/customer-filters';

export const metadata: Metadata = { title: 'Customers' };

const SORT_OPTIONS = ['last_seen', 'total_orders', 'total_spent_cents'];

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { search?: string; sort_by?: string };
}) {
  const session = await requireDashboardSession('/customers');

  const search = searchParams.search?.trim() ?? '';
  const sortBy = SORT_OPTIONS.includes(searchParams.sort_by ?? '')
    ? (searchParams.sort_by as string)
    : 'last_seen';

  const res = await listCustomers(session.active.workspace_id, {
    search: search || undefined,
    sort_by: sortBy,
  });

  return (
    <div>
      <PageHeader
        eyebrow="CRM"
        title="Customers"
        description="Everyone who has called or messaged — created automatically from every conversation."
      />

      <CustomerFilters initialSearch={search} initialSortBy={sortBy} />

      {isApiError(res) ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-error">Couldn&apos;t load customers: {res.error.message}</p>
          </CardContent>
        </Card>
      ) : res.data.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <Users2 className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-lg font-semibold">
              {search ? 'No customers match your search' : 'No customers yet'}
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {search
                ? 'Try a different name or phone number.'
                : 'Once voice or WhatsApp calls come in, customers are automatically created.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Lifetime value</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {res.data.map((c) => {
                  const tags = c.tags ?? [];
                  const shown = tags.slice(0, 3);
                  const overflow = tags.length - shown.length;
                  return (
                    <TableRow key={c.id} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <Link href={`/customers/${c.id}`} className="hover:text-accent-700">
                          {c.name ?? c.phone ?? 'Unknown'}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.phone ?? '—'}
                      </TableCell>
                      <TableCell className="tabular-nums">{c.total_orders}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatCurrency(c.total_spent_cents)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(c.last_seen), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {shown.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {shown.map((t) => (
                              <Badge key={t} variant="secondary">
                                {t}
                              </Badge>
                            ))}
                            {overflow > 0 && (
                              <span className="text-xs text-muted-foreground">
                                +{overflow} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/customers/${c.id}`}>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

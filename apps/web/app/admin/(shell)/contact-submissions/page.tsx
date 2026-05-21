import type { Metadata } from 'next';
import { formatDistanceToNow } from 'date-fns';
import { requireAdminSession } from '@/lib/auth/admin';
import { listContactSubmissions } from '@/lib/api/admin';
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
import { ContactStatusSelect } from '@/components/admin/contact-status-select';

export const metadata: Metadata = {
  title: 'Admin · Contact submissions',
  robots: { index: false, follow: false },
};

function statusBadge(status: string) {
  switch (status) {
    case 'new':
      return <Badge variant="accent">New</Badge>;
    case 'contacted':
      return <Badge variant="warning">Contacted</Badge>;
    case 'qualified':
      return <Badge variant="success">Qualified</Badge>;
    default:
      return <Badge variant="secondary">Closed</Badge>;
  }
}

export default async function AdminContactSubmissionsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requireAdminSession('/admin/contact-submissions');

  const res = await listContactSubmissions(searchParams.status);
  const submissions = !isApiError(res) ? res.data : [];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Inbound"
        title="Contact submissions"
        description={`${submissions.length} submission${submissions.length === 1 ? '' : 's'}`}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mark as</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                    {s.phone && (
                      <p className="text-xs text-muted-foreground">{s.phone}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{s.company ?? '—'}</TableCell>
                  <TableCell>
                    <p className="max-w-md whitespace-pre-wrap text-sm">{s.message}</p>
                    {s.source && (
                      <p className="mt-1 text-xs text-muted-foreground">From: {s.source}</p>
                    )}
                  </TableCell>
                  <TableCell>{statusBadge(s.status)}</TableCell>
                  <TableCell>
                    <ContactStatusSelect submissionId={s.id} current={s.status} />
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

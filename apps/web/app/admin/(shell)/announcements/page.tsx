import type { Metadata } from 'next';
import { formatDistanceToNow } from 'date-fns';
import { requireAdminSession } from '@/lib/auth/admin';
import { listAnnouncements } from '@/lib/api/admin';
import { isApiError } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AnnouncementForm } from '@/components/admin/announcement-form';

export const metadata: Metadata = {
  title: 'Admin · Announcements',
  robots: { index: false, follow: false },
};

export default async function AdminAnnouncementsPage() {
  await requireAdminSession('/admin/announcements');

  const res = await listAnnouncements();
  const announcements = !isApiError(res) ? res.data : [];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Broadcast"
        title="Product updates"
        description="Send an in-app notification to every business user. It appears under the bell in their dashboard."
      />

      <Card>
        <CardHeader>
          <CardTitle>Compose update</CardTitle>
          <CardDescription>
            Published immediately to all workspace members (owners, managers, and staff).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AnnouncementForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past announcements</CardTitle>
          <CardDescription>{announcements.length} sent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing published yet.</p>
          ) : (
            announcements.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {a.body}
                    </p>
                    {a.link && (
                      <p className="mt-2 font-mono text-xs text-muted-foreground">{a.link}</p>
                    )}
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.published_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

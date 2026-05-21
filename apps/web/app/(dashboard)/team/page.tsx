import type { Metadata } from 'next';
import { formatDistanceToNow } from 'date-fns';
import { Users } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listInvitations, listMembers } from '@/lib/api/members';
import { isApiError } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/dashboard/page-header';
import { InviteMemberButton } from '@/components/dashboard/invite-modal';
import { MemberRowActions } from '@/components/dashboard/member-row-actions';
import { InvitationRowActions } from '@/components/dashboard/invitation-row-actions';

export const metadata: Metadata = {
  title: 'Team',
};

function initials(name: string | null, email: string | null) {
  const src = (name ?? email ?? '?').trim();
  if (!src) return '?';
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function roleBadge(role: 'owner' | 'manager' | 'staff') {
  if (role === 'owner') return <Badge variant="default">Owner</Badge>;
  if (role === 'manager') return <Badge variant="accent">Manager</Badge>;
  return <Badge variant="secondary">Staff</Badge>;
}

export default async function TeamPage() {
  const session = await requireDashboardSession('/team');
  const isOwner = session.active.role === 'owner';
  const workspaceId = session.active.workspace_id;

  const [membersRes, invitesRes] = await Promise.all([
    listMembers(workspaceId),
    listInvitations(workspaceId),
  ]);

  const members = !isApiError(membersRes) ? membersRes.data : [];
  const invitations = !isApiError(invitesRes) ? invitesRes.data : [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Team"
        description="Manage who has access to this workspace."
        action={isOwner ? <InviteMemberButton /> : null}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Members ({members.length})
        </h2>

        {members.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <p className="text-sm text-muted-foreground">
                You're the only one here. Invite someone to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const isSelf = m.user_id === session.user.id;
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback>{initials(m.full_name, m.email)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {m.full_name ?? m.email ?? 'Unknown'}
                                {isSelf && (
                                  <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                                )}
                              </p>
                              {m.full_name && m.email && (
                                <p className="text-xs text-muted-foreground">{m.email}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{roleBadge(m.role)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.joined_at
                            ? formatDistanceToNow(new Date(m.joined_at), { addSuffix: true })
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {isOwner && <MemberRowActions member={m} isSelf={isSelf} />}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      {invitations.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pending invitations ({invitations.length})
          </h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell>{roleBadge(inv.role)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {isOwner && (
                          <InvitationRowActions invitationId={inv.id} email={inv.email} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

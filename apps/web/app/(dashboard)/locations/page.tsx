import type { Metadata } from 'next';
import { MapPin, Phone } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listLocations } from '@/lib/api/locations';
import { getLocationVoice } from '@/lib/api/voice';
import { isApiError, type LocationVoiceConfigSafe } from '@/lib/types';
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
import { CreateLocationButton } from '@/components/dashboard/location-modal';
import { LocationRowActions } from '@/components/dashboard/location-row-actions';

export const metadata: Metadata = {
  title: 'Locations',
};

function summarizeHours(hours: Record<string, { open: string; close: string } | null> | null) {
  if (!hours) return '—';
  const openDays = Object.values(hours).filter((h) => h !== null).length;
  return openDays === 7 ? 'Open daily' : `Open ${openDays}/7 days`;
}

export default async function LocationsPage() {
  const session = await requireDashboardSession('/locations');
  const isOwner = session.active.role === 'owner';

  const res = await listLocations(session.active.workspace_id);
  const locations = !isApiError(res) ? res.data : [];

  // Fetch voice config for each location in parallel. Each call is cached
  // 'no-store' so no stale data, but they all run in parallel.
  const voiceConfigs = await Promise.all(
    locations.map((loc) => getLocationVoice(session.active.workspace_id, loc.id)),
  );
  const voiceByLocation: Record<string, LocationVoiceConfigSafe | null> = {};
  locations.forEach((loc, i) => {
    const r = voiceConfigs[i];
    voiceByLocation[loc.id] = r && !isApiError(r) ? r.data : null;
  });

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Locations"
        description="Add every physical location of your business. Calls and messages route per location."
        action={isOwner ? <CreateLocationButton /> : null}
      />

      {locations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <MapPin className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-lg font-semibold">No locations yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add your first location to start routing calls and WhatsApp messages. You can add
              more any time.
            </p>
            {isOwner && (
              <div className="mt-2">
                <CreateLocationButton />
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
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Voice</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((loc) => {
                  const voice = voiceByLocation[loc.id];
                  return (
                    <TableRow key={loc.id}>
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[loc.address, loc.city, loc.state].filter(Boolean).join(', ') || '—'}
                      </TableCell>
                      <TableCell>
                        {voice ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-accent" />
                            <span className="font-mono text-xs">
                              {voice.twilio_phone_number}
                            </span>
                            {voice.enabled ? (
                              <Badge variant="success">On</Badge>
                            ) : (
                              <Badge variant="secondary">Off</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not configured</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {summarizeHours(loc.hours)}
                      </TableCell>
                      <TableCell>
                        {loc.is_active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Paused</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isOwner && (
                          <LocationRowActions
                            location={loc}
                            voiceConfig={voice ?? null}
                          />
                        )}
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

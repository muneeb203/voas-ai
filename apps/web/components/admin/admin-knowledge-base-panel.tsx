import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AdminKnowledgeBase } from '@/lib/api/admin';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Read-only view of everything a business's AI works from.
 *
 * Deliberately not editable: this is for support to see what the agent sees
 * when explaining its behaviour — changes belong to the owner in their own
 * dashboard, not to an admin reaching in.
 */
export function AdminKnowledgeBasePanel({ kb }: { kb: AdminKnowledgeBase }) {
  const isSalon = kb.vertical === 'salon';
  const serviceName = (id: string) => kb.services.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      {kb.voice && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI agent instructions</CardTitle>
            <CardDescription>
              What the agent is told to do. This drives how it behaves on calls.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={kb.voice.enabled ? 'success' : 'secondary'}>
                {kb.voice.enabled ? 'Voice enabled' : 'Voice off'}
              </Badge>
              <Badge variant="outline">voice: {kb.voice.voice}</Badge>
              <Badge variant="outline">model: {kb.voice.model}</Badge>
              <Badge variant="outline">lang: {kb.voice.language}</Badge>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Greeting</p>
              <p className="mt-1 text-sm">{kb.voice.greeting}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">System prompt</p>
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 font-mono text-xs">
                {kb.voice.system_prompt}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {isSalon ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Services ({kb.services.length})</CardTitle>
              <CardDescription>What the AI can offer and book.</CardDescription>
            </CardHeader>
            <CardContent>
              {kb.services.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No services configured — the AI has nothing to book.
                </p>
              ) : (
                <div className="space-y-2">
                  {kb.services.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start justify-between gap-4 rounded-md border p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {s.name}{' '}
                          {!s.is_active && <Badge variant="secondary">Inactive</Badge>}
                        </p>
                        {s.description && (
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                        )}
                      </div>
                      <p className="whitespace-nowrap text-xs text-muted-foreground">
                        {money(s.price_cents)} · {s.duration_minutes}m
                        {s.buffer_after_minutes ? ` (+${s.buffer_after_minutes}m buffer)` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Staff ({kb.staff.length})</CardTitle>
              <CardDescription>
                Who performs what, and the hours that drive availability.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {kb.staff.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No staff — nothing can be booked.
                </p>
              ) : (
                <div className="space-y-3">
                  {kb.staff.map((m) => (
                    <div key={m.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{m.name}</p>
                        {m.title && (
                          <span className="text-xs text-muted-foreground">{m.title}</span>
                        )}
                        {!m.is_active && <Badge variant="secondary">Inactive</Badge>}
                        {m.google_connected && (
                          <Badge variant="outline">📅 {m.google_email ?? 'Google linked'}</Badge>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.service_ids.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            No services assigned — can&apos;t be booked
                          </span>
                        ) : (
                          m.service_ids.map((id) => (
                            <Badge key={id} variant="secondary">
                              {serviceName(id)}
                            </Badge>
                          ))
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {m.hours.length === 0 ? (
                          <span>No hours set — no availability</span>
                        ) : (
                          m.hours.map((h, i) => (
                            <span key={i} className="rounded bg-secondary px-1.5 py-0.5">
                              {DAYS[h.weekday]} {h.start_time.slice(0, 5)}–{h.end_time.slice(0, 5)}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Menu ({kb.items.length} items)</CardTitle>
            <CardDescription>
              Categories, pricing and modifiers — exactly what gets fed to the AI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kb.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No menu configured — the AI has nothing to sell.
              </p>
            ) : (
              <div className="space-y-5">
                {kb.categories.map((cat) => {
                  const items = kb.items.filter((i) => i.category_id === cat.id);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      <p className="mb-2 text-sm font-semibold">
                        {cat.name}{' '}
                        {!cat.is_active && <Badge variant="secondary">Inactive</Badge>}
                      </p>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div key={item.id} className="rounded-md border p-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">
                                  {item.name}{' '}
                                  {!item.is_active && <Badge variant="secondary">Inactive</Badge>}
                                </p>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                              <p className="whitespace-nowrap text-sm">{money(item.price_cents)}</p>
                            </div>
                            {item.modifier_groups.map((g) => (
                              <div key={g.id} className="mt-2 border-t pt-2">
                                <p className="text-xs font-medium">
                                  {g.name}{' '}
                                  <span className="font-normal text-muted-foreground">
                                    ({g.required ? 'required' : 'optional'}, pick {g.min_select}–
                                    {g.max_select})
                                  </span>
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {g.options.map((o) => (
                                    <Badge key={o.id} variant="outline">
                                      {o.name}
                                      {o.price_delta_cents
                                        ? ` +${money(o.price_delta_cents)}`
                                        : ''}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

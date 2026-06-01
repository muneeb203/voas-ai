import 'server-only';
import type { NextRequest } from 'next/server';

/**
 * Resolve the public origin (proto + host) for the incoming request.
 *
 * Behind a reverse proxy (DigitalOcean App Platform, Vercel, etc.) the
 * Next.js process listens on something like localhost:3001, so the
 * `request.url` and bare `host` header reflect that internal address.
 * Build redirects from the forwarded headers the proxy actually sets,
 * falling back to the parsed URL only for plain local dev.
 */
export function getPublicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const fallbackUrl = new URL(request.url);

  const host = forwardedHost ?? request.headers.get('host') ?? fallbackUrl.host;
  const proto = forwardedProto ?? fallbackUrl.protocol.replace(':', '');
  return `${proto}://${host}`;
}

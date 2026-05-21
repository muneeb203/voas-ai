import 'server-only';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'voas_impersonating';

export interface ImpersonationState {
  workspace_id: string;
  workspace_name: string;
  admin_id: string;
  started_at: string;
}

export function readImpersonation(): ImpersonationState | null {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ImpersonationState;
    if (parsed.workspace_id && parsed.workspace_name && parsed.admin_id) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setImpersonation(state: ImpersonationState): void {
  cookies().set({
    name: COOKIE_NAME,
    value: JSON.stringify(state),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours, matches admin session
  });
}

export function clearImpersonation(): void {
  cookies().set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

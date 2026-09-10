import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface AlreadySignedInProps {
  email: string;
}

export function AlreadySignedIn({ email }: AlreadySignedInProps) {
  // User is already signed in. Redirect to dashboard.
  // Dashboard will handle workspace creation if needed.
  redirect('/dashboard');
}

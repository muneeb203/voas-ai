import Link from 'next/link';
import { Logo } from '@/components/shared/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <header className="container flex h-16 items-center">
        <Logo />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="container flex h-12 items-center justify-between text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Convosol</p>
        <div className="flex gap-4">
          <Link href="/legal/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}

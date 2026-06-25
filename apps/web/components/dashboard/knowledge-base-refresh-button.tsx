'use client';

import { useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function KnowledgeBaseRefreshButton() {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();

  return (
    <Button
      variant="outline"
      size="icon"
      disabled={refreshing}
      title="Refresh menu"
      onClick={() => startRefresh(() => { router.refresh(); })}
    >
      <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
    </Button>
  );
}

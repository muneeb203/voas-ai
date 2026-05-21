import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </header>

      <Card>
        <CardContent className="p-0">
          <SkeletonRows count={6} columns={5} />
        </CardContent>
      </Card>
    </div>
  );
}

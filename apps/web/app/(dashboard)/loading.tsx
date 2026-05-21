import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <header>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-96" />
      </header>

      <Card>
        <CardContent className="p-0">
          <SkeletonRows count={4} columns={4} />
        </CardContent>
      </Card>
    </div>
  );
}

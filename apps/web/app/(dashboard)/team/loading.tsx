import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';

export default function TeamLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <Card>
        <CardContent className="p-0">
          <SkeletonRows count={3} columns={4} />
        </CardContent>
      </Card>
    </div>
  );
}

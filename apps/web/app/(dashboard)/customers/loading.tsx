import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';

export default function CustomersLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Card>
        <CardContent className="p-0">
          <SkeletonRows count={6} columns={4} />
        </CardContent>
      </Card>
    </div>
  );
}

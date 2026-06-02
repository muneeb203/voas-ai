'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SORT_OPTIONS = [
  { value: 'last_seen', label: 'Last seen' },
  { value: 'total_orders', label: 'Most orders' },
  { value: 'total_spent_cents', label: 'Most spent' },
];

interface CustomerFiltersProps {
  initialSearch: string;
  initialSortBy: string;
}

export function CustomerFilters({ initialSearch, initialSortBy }: CustomerFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const firstRender = useRef(true);

  function pushParams(next: { search?: string; sort_by?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const searchValue = next.search ?? search;
    const sortValue = next.sort_by ?? params.get('sort_by') ?? initialSortBy;

    if (searchValue) params.set('search', searchValue);
    else params.delete('search');

    if (sortValue && sortValue !== 'last_seen') params.set('sort_by', sortValue);
    else params.delete('sort_by');

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  // Debounce the search input 300ms before pushing to the URL.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const handle = setTimeout(() => pushParams({ search }), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="pl-9"
          aria-label="Search customers"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Sort by</span>
        <Select
          defaultValue={initialSortBy}
          onValueChange={(value) => pushParams({ sort_by: value })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

'use client';

import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { START_TOUR_EVENT } from '@/components/dashboard/product-tour';

export function RestartTourButton() {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.dispatchEvent(new Event(START_TOUR_EVENT))}
    >
      <Compass className="mr-2 h-4 w-4" />
      Restart tour
    </Button>
  );
}

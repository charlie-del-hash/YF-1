'use client';

import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';

/** Inside the authed shell, so the nav survives the error. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-3">
      <h1 className="font-display text-2xl font-bold">{copy.boundary.errorTitle}</h1>
      <p className="text-tinta-60">{copy.boundary.errorBody}</p>
      <Button className="w-fit" onClick={reset}>
        {copy.common.retry}
      </Button>
    </div>
  );
}

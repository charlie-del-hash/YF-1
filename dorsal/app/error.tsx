'use client';

import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';

/**
 * The last line of defence. Errors explain what happened and what to do; they
 * do not apologise and they are not vague (03-DESIGN-BRIEF).
 */
export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-5">
      <h1 className="font-display text-3xl font-bold">{copy.boundary.errorTitle}</h1>
      <p className="text-tinta-60">{copy.boundary.errorBody}</p>
      <Button className="w-fit" onClick={reset}>
        {copy.common.retry}
      </Button>
    </main>
  );
}

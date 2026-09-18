'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { copy } from '@/lib/copy/es-ES';

/**
 * Sharing a plan.
 *
 * The link is built from the browser's own origin for the same reason the
 * magic link is: an address assembled from environment variables is right
 * until the day it is not, and a share link that points at the wrong host is
 * indistinguishable from a broken plan.
 *
 * Native share where the phone has it — that is how a link actually reaches a
 * WhatsApp group — and the clipboard everywhere else.
 */
export function ShareButton({ planId }: { planId: string }) {
  const [said, setSaid] = useState<string>();

  async function share() {
    const url = `${window.location.origin}/p/${planId}`;
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setSaid(copy.plan.shareCopied);
    } catch {
      // A cancelled native share throws too, and telling someone their own
      // cancellation failed would be a lie. Only say something when there is
      // nothing on the clipboard either.
      if (!navigator.share) setSaid(copy.plan.shareFailed);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="secondary" className="w-full" onClick={share}>
        {copy.plan.share}
      </Button>
      <p role="status" className="text-[15px] text-tinta-60">
        {said ?? copy.plan.shareHelp}
      </p>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';
import { attempt } from '@/lib/actions';
import { copy } from '@/lib/copy/es-ES';
import { deleteMyAccount, exportMyData } from './actions';

/** Download my data, and delete my account. Both in the app. 05-RGPD §5. */
export function AccountPanel() {
  const router = useRouter();
  const [confirmWord, setConfirmWord] = useState('');
  const [error, setError] = useState<string>();
  const [busy, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <section className="painted p-4">
        <h2 className="font-display text-xl font-bold">{copy.account.exportTitle}</h2>
        <p className="mt-1 text-tinta-60">{copy.account.exportHelp}</p>
        <Button
          className="mt-3"
          disabled={busy}
          onClick={() =>
            startTransition(async () => {
              setError(undefined);
              const result = await attempt(() => exportMyData());
              if (!result.ok) return setError(result.error);
              if (!('data' in result)) return setError(copy.errors.load);

              const blob = new Blob([JSON.stringify(result.data, null, 2)], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'dorsal-mis-datos.json';
              link.click();
              URL.revokeObjectURL(url);
            })
          }
        >
          {busy ? copy.account.exportPreparing : copy.account.exportButton}
        </Button>
      </section>

      <section className="border-l-4 border-aviso bg-linea p-4">
        <h2 className="font-display text-xl font-bold">{copy.account.deleteTitle}</h2>
        {/* What happens to other people's copies of your words, said plainly and
            before the button, because it is the part that cannot be undone. */}
        <p className="mt-1 text-tinta-60">{copy.account.deleteHelp}</p>

        <div className="mt-3">
          <Field label={copy.account.deleteConfirmLabel} error={error}>
            {(props) => (
              <input
                {...props}
                className={inputClass}
                value={confirmWord}
                onChange={(e) => setConfirmWord(e.target.value)}
                autoComplete="off"
              />
            )}
          </Field>
        </div>

        <Button
          variant="destructive"
          className="mt-3"
          disabled={busy || confirmWord.trim() !== copy.account.deleteConfirmWord}
          onClick={() =>
            startTransition(async () => {
              setError(undefined);
              const result = await attempt(() => deleteMyAccount());
              if (!result.ok) return setError(result.error);
              router.replace('/entrar');
              router.refresh();
            })
          }
        >
          {busy ? copy.account.deleting : copy.account.deleteButton}
        </Button>
      </section>
    </div>
  );
}

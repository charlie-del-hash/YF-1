import type { Metadata } from 'next';
import Link from 'next/link';
import { copy } from '@/lib/copy/es-ES';
import { LEGAL_PAGES } from '@/lib/copy/legal-es';

export const metadata: Metadata = { title: copy.legal.title };

export default function LegalIndex() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 py-8">
      <h1 className="font-display text-3xl font-bold">{copy.legal.title}</h1>
      <ul className="flex flex-col gap-2">
        {Object.values(LEGAL_PAGES).map((page) => (
          <li key={page.slug}>
            <Link
              href={`/legal/${page.slug}`}
              className="text-pista underline underline-offset-4"
            >
              {page.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

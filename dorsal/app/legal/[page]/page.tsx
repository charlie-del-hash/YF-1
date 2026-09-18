import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { copy } from '@/lib/copy/es-ES';
import { LEGAL_PAGES, type LegalPage } from '@/lib/copy/legal-es';

export function generateStaticParams() {
  return Object.keys(LEGAL_PAGES).map((page) => ({ page }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const page = LEGAL_PAGES[(await params).page as LegalPage['slug']];
  return { title: page?.title ?? copy.legal.title };
}

export default async function LegalPageView({ params }: { params: Promise<{ page: string }> }) {
  const page = LEGAL_PAGES[(await params).page as LegalPage['slug']];
  if (!page) notFound();

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 py-8">
      <header>
        <Link href="/legal" className="text-[15px] text-pista underline underline-offset-4">
          {copy.legal.title}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">{page.title}</h1>
        <p className="mt-1 text-[15px] text-tinta-60">{page.updated}</p>
      </header>

      {/* Visible on the page, not only in a code comment: these are drafts and
          the reader deserves to know before relying on one. */}
      <p className="border-l-4 border-aviso bg-linea p-3 text-[15px]">{copy.legal.draftWarning}</p>

      {page.sections.map((section) => (
        <section key={section.heading}>
          <h2 className="font-display text-xl font-bold">{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="mt-2">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}

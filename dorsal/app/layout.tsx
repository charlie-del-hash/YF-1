import type { Metadata, Viewport } from 'next';
import { Archivo, Barlow_Condensed } from 'next/font/google';
import { copy } from '@/lib/copy/es-ES';
import './globals.css';

/* Two families, clearly distinct in width and personality. Barlow Condensed is
   bib and jersey lettering and is only ever used on numerals, times, paces and
   single words — never on a sentence. Archivo does the talking.
   next/font self-hosts both, so no request reaches Google at runtime: one
   fewer third party touching a user's IP address (05-RGPD §1). */
const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

const body = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-archivo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: copy.app.name, template: `%s · ${copy.app.name}` },
  description: copy.app.tagline,
  applicationName: copy.app.name,
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0e5c8c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={copy.app.lang} className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-linea focus:px-3 focus:py-2"
        >
          {copy.app.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}

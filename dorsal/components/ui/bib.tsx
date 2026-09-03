import { copy } from '@/lib/copy/es-ES';

/**
 * The dorsal number. The one loud object on a screen — see
 * docs/DESIGN-TOKENS.md principle 2. Never render two of these at one size on
 * the same screen, and never use --dorsal for anything else.
 */
export function Bib({
  number,
  size = 'md',
  className = '',
}: {
  number: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    sm: 'text-base px-1.5',
    md: 'text-2xl px-2',
    lg: 'text-5xl px-3 py-1',
  } as const;

  return (
    <span
      className={`bib ${sizes[size]} ${className}`}
      aria-label={`${copy.profile.dorsalNumber} ${number}`}
    >
      {number}
    </span>
  );
}

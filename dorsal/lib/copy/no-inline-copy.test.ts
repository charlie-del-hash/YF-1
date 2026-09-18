import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CLAUDE.md rule 1, enforced rather than remembered: every user-facing string
 * lives in lib/copy. A Spanish string inline in a component is a bug, and the
 * bug it causes is not cosmetic — it is the one that makes a second locale a
 * refactor instead of a file.
 *
 * The check is deliberately crude. It strips comments (which are English but
 * quote Spanish copy freely), then looks for Spanish-specific characters and
 * words in what is left. Crude is fine: it has no false negatives that matter,
 * and a false positive is fixed by moving the string where it belongs.
 */
const ROOT = new URL('../../', import.meta.url).pathname;
const SCANNED = ['app', 'components', 'features'];

/* app/kit is the component reference. Its Spanish is sample *data* standing in
   for rows from the database — plan titles, venue names, host names — not
   interface copy, so it does not belong in the dictionary. */
const EXEMPT = ['app/kit/'];
const SPANISH_CHARS = /[áéíóúñüÁÉÍÓÚÑÜ¿¡]/;

/* Only words that are Spanish prose and never code. `plan`, `planes` and
   `dorsal` are excluded on purpose: they are route segments and identifiers
   throughout this codebase, and flagging them would train people to ignore
   this test — which is worse than the leak it would catch. */
const SPANISH_WORDS =
  /\b(quedada|quedadas|apunto|apuntas|apuntarse|plazas|anfitrion|anfitriona|mujeres|gracias|pachanga|palabra|tercer tiempo|vuelve|elige|escribe|marca|nadie|alguien|siempre|nunca)\b/i;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (
      ['.ts', '.tsx'].includes(extname(full)) &&
      !full.endsWith('.test.ts') &&
      !EXEMPT.some((prefix) => relative(ROOT, full).startsWith(prefix))
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Remove // and /* *\/ comments so English prose quoting Spanish doesn't trip. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** String and template literals, plus JSX text nodes. */
function candidateStrings(source: string): string[] {
  const found: string[] = [];
  const literals = source.match(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g) ?? [];
  found.push(...literals.map((s) => s.slice(1, -1)));
  const jsxText = source.match(/>[^<>{}\n]{3,}</g) ?? [];
  found.push(...jsxText.map((s) => s.slice(1, -1).trim()));
  return found;
}

describe('no user-facing Spanish outside lib/copy', () => {
  const files = SCANNED.flatMap((dir) => walk(join(ROOT, dir)));

  it('scans a plausible number of files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => relative(ROOT, f)))('%s', (relativePath) => {
    const source = stripComments(readFileSync(join(ROOT, relativePath), 'utf8'));
    const offenders = candidateStrings(source).filter((value) => {
      if (SPANISH_CHARS.test(value)) return true;
      // Word matching needs a phrase, not a token: a bare token is a route
      // segment, an import specifier or a class name.
      return value.includes(' ') && SPANISH_WORDS.test(value);
    });
    expect(offenders).toEqual([]);
  });
});

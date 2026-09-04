/**
 * Generates the app icons from the design tokens, rather than checking in
 * binaries nobody can regenerate. `pnpm icons:gen`.
 *
 * The motif is a race bib: the `dorsal` field on a `pista` ground, with the
 * four pin holes that make it a bib rather than a rectangle. No text, because
 * a number is unreadable at 48px and the word "Dorsal" is under the icon
 * anyway — see docs/DESIGN-TOKENS.md principle 2 on where the loud object goes.
 *
 * PNG is written by hand: zlib is in Node, and a dependency that talks to
 * nothing still has to be justified (CLAUDE.md, stack table).
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const PISTA = [0x0e, 0x5c, 0x8c];
const DORSAL = [0xe4, 0xff, 0x3f];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function png(size, pixel) {
  // 4× supersampling: the alternative is a rounded corner that looks chewed.
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / 4) / size, (y + (sy + 0.5) / 4) / size);
          r += pr; g += pg; b += pb; a += pa;
        }
      }
      const at = 1 + x * 4;
      row[at] = Math.round(r / 16);
      row[at + 1] = Math.round(g / 16);
      row[at + 2] = Math.round(b / 16);
      row[at + 3] = Math.round(a / 16);
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const inRoundedRect = (x, y, left, top, right, bottom, radius) => {
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
};

/**
 * @param inset how much of the canvas the bib leaves free. Maskable icons get
 *   a bigger one: anything outside the middle 80% can be cropped to a circle,
 *   and a bib with its corners shaved off is a rectangle.
 */
function bib(inset) {
  const l = inset, t = inset + 0.03, r = 1 - inset, b = 1 - inset - 0.03;
  const hole = 0.028;
  const holes = [
    [l + 0.08, t + 0.09], [r - 0.08, t + 0.09],
    [l + 0.08, b - 0.09], [r - 0.08, b - 0.09],
  ];
  return (x, y) => {
    if (inRoundedRect(x, y, l, t, r, b, 0.06)) {
      for (const [hx, hy] of holes) {
        if ((x - hx) ** 2 + (y - hy) ** 2 <= hole ** 2) return [...PISTA, 255];
      }
      return [...DORSAL, 255];
    }
    return [...PISTA, 255];
  };
}

mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-192.png', 192, bib(0.14)],
  ['icon-512.png', 512, bib(0.14)],
  ['icon-maskable-512.png', 512, bib(0.22)],
  // iOS ignores the manifest for the home-screen icon and crops nothing, so
  // this one is the tighter drawing.
  ['apple-touch-icon.png', 180, bib(0.14)],
];
for (const [name, size, pixel] of files) {
  writeFileSync(join(OUT, name), png(size, pixel));
  console.log(`icons/${name}  ${size}×${size}`);
}

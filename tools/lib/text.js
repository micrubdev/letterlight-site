// Text helpers shared by the content checks and the quote verifier.

/** Lowercase, plain quotes and dashes, no zero-width characters, single spaces. */
export function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/[​-‍﻿­]/g, '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/\s*[‐-―−-]+\s*/g, (m) => (/\s/.test(m) ? ' - ' : '-'))
    .replace(/\s+/g, ' ')
    .trim();
}

const tokens = (s) => normalize(s).match(/[\p{L}\p{N}']+/gu) ?? [];

/** Words in a Markdown body, ignoring Markdown syntax. */
export const wordCount = (md) => tokens(md.replace(/[#*_>`~[\]()]/g, ' ')).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;

export function shingles(text, k = 5) {
  const t = tokens(text);
  const out = new Set();
  for (let i = 0; i + k <= t.length; i++) out.add(t.slice(i, i + k).join(' '));
  return out;
}

export function jaccard(a, b) {
  if (!a.size && !b.size) return 0;
  let both = 0;
  for (const x of a) if (b.has(x)) both++;
  return both / (a.size + b.size - both);
}

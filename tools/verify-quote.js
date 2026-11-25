#!/usr/bin/env node
// Usage: node tools/verify-quote.js <quote-id>
// Fetches the quote's public-domain source_url and exits 0 only if the quote is in it word for word.
import fs from 'node:fs';
import yaml from 'js-yaml';
import { normalize } from './lib/text.js';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** True if the quote appears word for word, not starting or ending inside a word. Typography and spacing are ignored. */
export const quoteInText = (quote, text) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${esc(normalize(quote))}(?![\\p{L}\\p{N}])`, 'u').test(normalize(text));

const htmlToText = (html) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** The plain text of a public-domain source page. */
export async function sourceText(sourceUrl) {
  // Wikisource pages transclude their text; ?action=render returns it as plain HTML.
  const url = sourceUrl.includes('wikisource.org/wiki/') ? `${sourceUrl}?action=render` : sourceUrl;
  const res = await fetch(url, { headers: { 'User-Agent': 'letterlight-quote-check/1.0' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return htmlToText(await res.text());
}

async function main(id) {
  const q = (yaml.load(fs.readFileSync('content/quotes.yaml', 'utf8')) ?? []).find((x) => x.id === id);
  if (!q) throw new Error(`no quote with id ${id} in content/quotes.yaml`);
  if (!quoteInText(q.text, await sourceText(q.source_url))) {
    console.error(`${id}: NOT found word for word in ${q.source_url}`);
    process.exit(1);
  }
  console.log(`${id}: found in ${q.source_url}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv[2]).catch((e) => { console.error(e.message); process.exit(1); });
}

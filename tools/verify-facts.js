#!/usr/bin/env node
// Usage: node tools/verify-facts.js src/facts/<mentor>.md
// Exits 0 only if every fact's evidence is in its public-domain source word for word.
// It proves the passage exists. Whether the retelling matches the passage still needs a reader.
import fs from 'node:fs';
import matter from 'gray-matter';
import { quoteInText, sourceText } from './verify-quote.js';

const { data } = matter(fs.readFileSync(process.argv[2], 'utf8'));
const cache = new Map();
let failed = 0;
for (const f of data.facts ?? []) {
  try {
    if (!cache.has(f.source_url)) cache.set(f.source_url, await sourceText(f.source_url));
    const ok = quoteInText(f.evidence, cache.get(f.source_url));
    console.log(`${ok ? 'found' : 'NOT FOUND'}: ${f.title}`);
    if (!ok) failed++;
  } catch (e) { console.log(`ERROR: ${f.title}: ${e.message}`); failed++; }
}
if (!data.facts?.length) { console.log('no facts'); failed++; }
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
// Usage: npm run check [-- <page.md> ...]
// Checks letters and guides before they are published. Prints "path: error" lines and exits 1 on any error.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { normalize, wordCount, shingles, jaccard, paragraphs } from './lib/text.js';

export { normalize, wordCount, shingles, jaccard };

export const LIMITS = { titleMax: 60, descMin: 120, descMax: 160, wordsMin: 600, wordsMax: 1100, guideMin: 15, guideMax: 30, similarMax: 0.35, perDay: 10, signoffMax: 40, signatureMax: 30, salutationMax: 15, closingMin: 6 };

const isLetter = (p) => p.split(path.sep).join('/').includes('/letters/');
const slugOf = (p) => (isLetter(p.path) ? `letters/${p.data.mentor}-on-${p.data.problem}` : `journaling-prompts/${p.data.problem}`);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Prompts in a guide: list items, except those under a "How to use" heading. */
function guidePrompts(body) {
  let skip = false;
  let n = 0;
  for (const line of body.split('\n')) {
    if (/^#{1,6}\s/.test(line)) skip = /how to use/i.test(line);
    else if (!skip && /^\s*[-*]\s+\S/.test(line)) n++;
  }
  return n;
}

export function checkPage(file, ctx) {
  const { data, body } = file;
  const errors = [];
  const L = LIMITS;
  const problem = ctx.problems.find((p) => p.id === data.problem);

  if (!data.title) errors.push('title: missing');
  else if (data.title.length > L.titleMax) errors.push(`title: ${data.title.length} characters, max ${L.titleMax}`);
  const dl = (data.description ?? '').length;
  if (dl < L.descMin || dl > L.descMax) errors.push(`description: ${dl} characters, want ${L.descMin}-${L.descMax}`);
  if (!data.date) errors.push('date: missing');
  if (!problem) errors.push(`problem: unknown "${data.problem}" (add it to src/_data/problems.json)`);
  else if (problem.sensitive && data.sensitive !== true) errors.push(`sensitive: "${problem.id}" is a sensitive problem, set sensitive: true`);

  if (isLetter(file.path)) {
    const mentor = ctx.mentors.find((m) => m.id === data.mentor);
    if (!mentor) errors.push(`mentor: unknown "${data.mentor}"`);
    const words = wordCount(body);
    if (words < L.wordsMin || words > L.wordsMax) errors.push(`words: ${words}, want ${L.wordsMin}-${L.wordsMax}`);
    if (!Array.isArray(data.prompts) || data.prompts.length !== 3) errors.push('prompts: a letter needs exactly 3');
    if (!data.signoff) errors.push('signoff: missing');
    else if (String(data.signoff).length > L.signoffMax) errors.push(`signoff: ${String(data.signoff).length} characters, max ${L.signoffMax}`);
    if (data.signature && String(data.signature).length > L.signatureMax) errors.push(`signature: ${String(data.signature).length} characters, max ${L.signatureMax}`);
    const paras = paragraphs(body);
    const first = wordCount(paras[0]);
    if (first > L.salutationMax) errors.push(`body: first paragraph is ${first} words; start with a short salutation (max ${L.salutationMax})`);
    const last = paras[paras.length - 1].trim();
    if (paras.length > 1 && wordCount(last) < L.closingMin) errors.push(`body: ends with a short line ("${last}"); move it to signoff`);
    if (mentor && !mentor.publicDomain && data.quote) errors.push(`quote: ${mentor.name}'s works are in copyright, remove the quote`);
    if (mentor && mentor.publicDomain) {
      const q = data.quote && ctx.quotes.find((x) => x.id === data.quote.id);
      if (!data.quote) errors.push('quote: missing (public-domain mentors need one from content/quotes.yaml)');
      else if (!q) errors.push(`quote: "${data.quote.id}" is not in content/quotes.yaml`);
      else if (q.mentor !== mentor.id) errors.push(`quote: "${q.id}" belongs to ${q.mentor}, not ${mentor.id}`);
    }
  } else {
    const n = guidePrompts(body);
    if (n < L.guideMin || n > L.guideMax) errors.push(`prompts: ${n}, a guide needs ${L.guideMin}-${L.guideMax}`);
  }

  const mine = shingles(body);
  for (const other of ctx.others) {
    if (other.path === file.path) continue;
    if (other.data && slugOf(other) === slugOf(file)) errors.push(`slug: same URL as ${other.path}`);
    const j = jaccard(mine, shingles(other.body));
    if (j > L.similarMax) errors.push(`similar: ${Math.round(j * 100)}% overlap with ${other.path}`);
  }

  const text = normalize(body);
  for (const phrase of ctx.banned) {
    if (new RegExp(`(^|[^\\p{L}])${esc(normalize(phrase))}(?![\\p{L}])`, 'u').test(text)) errors.push(`banned: "${phrase}"`);
  }
  return errors;
}

const readPage = (p) => {
  const { data, content } = matter(fs.readFileSync(p, 'utf8'));
  return { path: p, data, body: content };
};
const pagesIn = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f)) : []);

function main(args) {
  const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const all = [...pagesIn('src/letters'), ...pagesIn('src/journaling-prompts')].map(readPage);
  const ctx = {
    mentors: json('src/_data/mentors.json'),
    problems: json('src/_data/problems.json'),
    quotes: yaml.load(fs.readFileSync('content/quotes.yaml', 'utf8')) ?? [],
    banned: fs.readFileSync('tools/banned-phrases.txt', 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#')),
    others: all,
  };
  const targets = args.length ? args.map((a) => all.find((p) => path.resolve(p.path) === path.resolve(a)) ?? readPage(a)) : all;
  let failed = 0;
  for (const page of targets) {
    for (const e of checkPage(page, ctx)) { console.log(`${page.path}: ${e}`); failed++; }
  }
  const today = new Date().toISOString().slice(0, 10);
  const dayOf = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));
  const todayCount = all.filter((p) => dayOf(p.data.date) === today).length;
  if (todayCount > LIMITS.perDay) { console.log(`pace: ${todayCount} pages dated ${today}, max ${LIMITS.perDay} a day`); failed++; }
  console.log(failed ? `${failed} problem(s) in ${targets.length} page(s)` : `ok: ${targets.length} page(s) pass`);
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));

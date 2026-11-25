#!/usr/bin/env node
// Usage: npm run check [-- <page.md> ...]
// Checks letters, guides and facts pages before they are published. Prints "path: error" lines and exits 1 on any error.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { normalize, wordCount, shingles, jaccard, paragraphs } from './lib/text.js';

export { normalize, wordCount, shingles, jaccard };

export const LIMITS = { titleMax: 60, descMin: 120, descMax: 160, wordsMin: 600, wordsMax: 1100, guideMin: 15, guideMax: 30, factsMin: 5, factsMax: 8, factWordsMin: 20, factWordsMax: 130, similarMax: 0.35, perDay: 10, signoffMax: 40, signatureMax: 30, salutationMax: 15, closingMin: 6 };

// One-day exceptions to perDay, each approved by the user for that date only.
const PER_DAY_EXCEPTIONS = { '2026-11-25': 15 }; // 5 app feature pages, "publish now"

const isLetter = (p) => p.split(path.sep).join('/').includes('/letters/');
const isFacts = (p) => p.split(path.sep).join('/').includes('/facts/');
const isFeature = (p) => p.split(path.sep).join('/').includes('/features/');
const factsOf = (data) => (Array.isArray(data?.facts) ? data.facts : []);
const shotsOf = (data) => (Array.isArray(data?.shots) ? data.shots : []);
/** The text a reader sees: the body, plus the facts or screenshots kept in front matter. */
const prose = (p) => [p.body, ...factsOf(p.data).flatMap((f) => [f.title, f.text]), ...shotsOf(p.data).flatMap((s) => [s.title, s.text])].join('\n\n');
const slugOf = (p) => (isFeature(p.path) ? `features/${path.basename(p.path, '.md')}` : isFacts(p.path) ? `facts/${p.data.mentor}` : isLetter(p.path) ? `letters/${p.data.mentor}-on-${p.data.problem}` : `journaling-prompts/${p.data.problem}`);
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
  else if (data.updated && new Date(data.updated) < new Date(data.date)) errors.push('updated: before the publish date');
  if (isFacts(file.path) || isFeature(file.path)) { /* these pages don't belong to a problem */ }
  else if (!problem) errors.push(`problem: unknown "${data.problem}" (add it to src/_data/problems.json)`);
  else if (problem.sensitive && data.sensitive !== true) errors.push(`sensitive: "${problem.id}" is a sensitive problem, set sensitive: true`);

  if (isFeature(file.path)) {
    for (const k of ['name', 'summary', 'order']) if (!data[k]) errors.push(`${k}: missing`);
    if (!shotsOf(data).length) errors.push('shots: a feature page needs at least one screenshot');
    shotsOf(data).forEach((s, i) => {
      for (const k of ['img', 'title', 'text', 'alt']) if (!s[k]) errors.push(`shots[${i + 1}]: ${k} missing`);
      if (s.img && !fs.existsSync(`src/assets/app/${s.img}.webp`)) errors.push(`shots[${i + 1}]: src/assets/app/${s.img}.webp not found`);
    });
  } else if (isFacts(file.path)) {
    if (!ctx.mentors.some((m) => m.id === data.mentor)) errors.push(`mentor: unknown "${data.mentor}"`);
    const facts = factsOf(data);
    if (facts.length < L.factsMin || facts.length > L.factsMax) errors.push(`facts: ${facts.length}, want ${L.factsMin}-${L.factsMax}`);
    const promised = String(data.title ?? '').match(/^(\d+)\s/);
    // A legend is not a true story, so it doesn't count towards a number in the title.
    const real = facts.filter((f) => f.status !== 'legend').length;
    if (promised && Number(promised[1]) !== real) errors.push(`title: promises ${promised[1]} facts, the page has ${real} (legends not counted)`);
    facts.forEach((f, i) => {
      const at = `facts[${i + 1}]`;
      for (const k of ['title', 'text', 'source', 'source_url', 'evidence']) if (!f[k]) errors.push(`${at}: ${k} missing`);
      if (f.source_url && !/^https:\/\//.test(f.source_url)) errors.push(`${at}: source_url must start with https://`);
      const w = wordCount(String(f.text ?? ''));
      if (f.text && (w < L.factWordsMin || w > L.factWordsMax)) errors.push(`${at}: ${w} words, want ${L.factWordsMin}-${L.factWordsMax}`);
      if (f.status && f.status !== 'legend') errors.push(`${at}: status "${f.status}", only "legend" is allowed`);
    });
  } else if (isLetter(file.path)) {
    const mentor = ctx.mentors.find((m) => m.id === data.mentor);
    if (!mentor) errors.push(`mentor: unknown "${data.mentor}"`);
    const words = wordCount(body);
    if (words < L.wordsMin || words > L.wordsMax) errors.push(`words: ${words}, want ${L.wordsMin}-${L.wordsMax}`);
    if (!Array.isArray(data.prompts) || data.prompts.length !== 3) errors.push('prompts: a letter needs exactly 3');
    if (!data.signoff) errors.push('signoff: missing');
    else if (String(data.signoff).length > L.signoffMax) errors.push(`signoff: ${String(data.signoff).length} characters, max ${L.signoffMax}`);
    if (data.signature && String(data.signature).length > L.signatureMax) errors.push(`signature: ${String(data.signature).length} characters, max ${L.signatureMax}`);
    if (mentor && !data.signature && mentor.name[0] !== mentor.name[0].toUpperCase()) errors.push(`signature: "${mentor.name}" starts lowercase; set signature`);
    const paras = paragraphs(body);
    const first = wordCount(paras[0]);
    if (first > L.salutationMax) errors.push(`body: first paragraph is ${first} words; start with a short salutation (max ${L.salutationMax})`);
    const last = paras[paras.length - 1].trim();
    if (paras.length > 1 && wordCount(last) < L.closingMin) errors.push(`body: ends with a short line ("${last}"); move it to signoff`);
    else if (paras.length > 1) {
      // A sign-off or signature copied into the body would show twice: once in the text, once below it.
      const bare = (s) => normalize(s).replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
      const end = bare(last);
      const names = [data.signature, mentor?.name].filter(Boolean).map(bare).filter(Boolean);
      const so = data.signoff ? bare(data.signoff) : '';
      if ((so && end.startsWith(so)) || names.some((n) => end === n || end.endsWith(` ${n}`))) errors.push('body: last paragraph repeats the sign-off or signature; remove it');
    }
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
    const promised = String(data.title ?? '').match(/^(\d+)\s/);
    if (promised && Number(promised[1]) !== n) errors.push(`title: promises ${promised[1]} prompts, the page has ${n}`);
  }

  const mine = shingles(prose(file));
  for (const other of ctx.others) {
    if (other.path === file.path) continue;
    if (other.data && slugOf(other) === slugOf(file)) errors.push(`slug: same URL as ${other.path}`);
    const j = jaccard(mine, shingles(prose(other)));
    if (j > L.similarMax) errors.push(`similar: ${Math.round(j * 100)}% overlap with ${other.path}`);
  }

  const text = normalize(prose(file));
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
  const all = [...pagesIn('src/letters'), ...pagesIn('src/journaling-prompts'), ...pagesIn('src/facts'), ...pagesIn('src/features')].map(readPage);
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
  const max = PER_DAY_EXCEPTIONS[today] ?? LIMITS.perDay;
  if (todayCount > max) { console.log(`pace: ${todayCount} pages dated ${today}, max ${max} a day`); failed++; }
  console.log(failed ? `${failed} problem(s) in ${targets.length} page(s)` : `ok: ${targets.length} page(s) pass`);
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));

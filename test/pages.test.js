import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from './_build.js';

before(build);
const read = (p) => fs.readFileSync(`_site/${p}`, 'utf8');
const letter = () => read('letters/seneca-on-losing-your-job/index.html');

test('letter carries AI label, real quote with source, three prompts', () => {
  const h = letter();
  assert.match(h, /An imagined letter, written with AI in the voice of Seneca\. Not his own words\./);
  assert.match(h, /<blockquote[^>]*class="quote"/);
  assert.match(h, /<cite>/);
  assert.equal((h.match(/class="prompt"/g) || []).length, 3);
});
test('letter has Article and BreadcrumbList JSON-LD', () => {
  const ld = [...letter().matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
  assert.deepEqual(ld.map((x) => x['@type']).sort(), ['Article', 'BreadcrumbList']);
});
test('same-problem and same-mentor links, never to itself', () => {
  const h = letter();
  assert.match(h, /href="\/letters\/marcus-aurelius-on-losing-your-job\/"/);
  assert.doesNotMatch(h, /href="\/letters\/seneca-on-losing-your-job\/"/);
});
test('hub with one letter has no empty sections', () => {
  const h = read('mentors/seneca/index.html');
  assert.match(h, /href="\/letters\/seneca-on-losing-your-job\/"/);
  assert.doesNotMatch(h, /<section[^>]*>\s*<h2[^>]*>[^<]*<\/h2>\s*<\/section>/);
  assert.doesNotMatch(h, /<ul[^>]*>\s*<\/ul>/);
});
test('sensitive pages always show the crisis box; others do not', () => {
  assert.match(read('journaling-prompts/grief/index.html'), /class="crisis"/);
  assert.doesNotMatch(letter(), /class="crisis"/);
});
test('problem hub lists both mentors', () => {
  const h = read('problems/losing-your-job/index.html');
  assert.match(h, /Seneca/);
  assert.match(h, /Marcus Aurelius/);
});
test('hubs exist only for mentors and problems that have letters', () => {
  // Pick a mentor and a problem that have no letter yet, so new content never breaks this test.
  const used = fs.readdirSync('src/letters').filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
  const mentors = JSON.parse(fs.readFileSync('src/_data/mentors.json', 'utf8')).map((m) => m.id);
  const problems = JSON.parse(fs.readFileSync('src/_data/problems.json', 'utf8')).map((p) => p.id);
  const idleMentor = mentors.find((m) => !used.some((u) => u.startsWith(`${m}-on-`)));
  const idleProblem = problems.find((p) => !used.some((u) => u.endsWith(`-on-${p}`)));
  assert.ok(idleMentor && idleProblem);
  assert.ok(!fs.existsSync(`_site/mentors/${idleMentor}/index.html`), idleMentor);
  assert.ok(!fs.existsSync(`_site/problems/${idleProblem}/index.html`), idleProblem);
});
test('guide has breadcrumb and links to letters on its problem only when they exist', () => {
  const h = read('journaling-prompts/grief/index.html');
  assert.match(h, /href="\/journaling-prompts\/"/);
  assert.doesNotMatch(h, /<ul[^>]*>\s*<\/ul>/);
});
test('home page links into the content', () => {
  const h = read('index.html');
  assert.match(h, /href="\/letters\/"/);
  assert.match(h, /href="\/facts\/"/);
  assert.doesNotMatch(h, /journaling-prompts/);
  // The home page shows the newest letters, so count letter links instead of expecting one fixed page.
  assert.equal(new Set(h.match(/href="\/letters\/[a-z-]+\/"/g)).size, 6);
});
test('letters index lists every letter grouped by problem, linking each problem hub', () => {
  const h = read('letters/index.html');
  assert.match(h, /href="\/letters\/epictetus-on-losing-your-job\/"/);
  assert.match(h, /href="\/problems\/losing-your-job\/"/);
});
test('every content page footer links the letters and true stories indexes', () => {
  for (const p of ['letters/seneca-on-losing-your-job/index.html', 'mentors/seneca/index.html', 'journaling-prompts/grief/index.html'])
    assert.match(read(p), /<nav class="site-nav"[\s\S]*href="\/letters\/"[\s\S]*href="\/facts\/"/, p);
});
test('a letter always links its problem hub, even when it is the only letter on it', () => {
  assert.match(letter(), /href="\/problems\/losing-your-job\/"/);
});
test('a quote that starts mid-sentence is shown with a leading ellipsis', () => {
  assert.match(read('letters/marcus-aurelius-on-losing-your-job/index.html'), /<blockquote class="quote"><p>…the mind converts/);
});
test('letter sheet has dateline, signoff and signature, quote after the sheet', () => {
  const h = letter();
  assert.match(h, /<div class="letter-body sheet">\s*<p class="dateline"><time datetime="2026-11-19">19 November 2026<\/time><\/p>/);
  assert.match(h, /<p class="signoff">Farewell\.<\/p>\s*<p class="signature">Seneca<\/p>\s*<\/div>/);
  assert.doesNotMatch(h, /<p>Farewell\.<\/p>/);
  assert.ok(h.indexOf('class="real-quote"') > h.indexOf('class="signature"'));
  assert.match(h, /<article class="letter-page">/);
});
test('signature falls back to mentor name, or uses front matter signature', () => {
  assert.match(read('letters/seneca-on-grief/index.html'), /<p class="signature">Seneca<\/p>/);
  assert.match(read('letters/tolstoy-on-grief/index.html'), /<p class="signature">L\. T\.<\/p>/);
});
test('home sample letter uses the sheet and an ink signature', () => {
  const h = read('index.html');
  assert.match(h, /<article class="letter sheet">/);
  assert.match(h, /<p class="signoff">Yours,<\/p>\s*<p class="signature">Seneca<\/p>/);
});
test('Caveat 500 is loaded with the other fonts', () => {
  assert.match(letter(), /fonts\.googleapis\.com\/css2\?[^"]*family=Caveat:wght@500/);
});
test('contrast and ink tokens exist in light, dark and forced-dark themes', () => {
  const css = read('assets/site.css');
  for (const t of ['--muted-strong', '--ink-blue', '--rule-line']) {
    assert.equal((css.match(new RegExp(`${t}:`, 'g')) || []).length, 3, t);
  }
});
test('quote label colour passes AA contrast on the quote background (light theme)', () => {
  const css = read('assets/site.css');
  const tok = (n) => css.match(new RegExp(`${n}:\\s*(#[0-9A-Fa-f]{6})`))[1];
  const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const [a, b] = [lum(tok('--amber-strong')), lum(tok('--amber-wash'))].sort((x, y) => y - x);
  assert.ok((a + 0.05) / (b + 0.05) >= 4.5);
  assert.match(css, /\.real-quote figcaption \{[^}]*color: var\(--amber-strong\)/);
});
test('css and js links carry a content hash so browsers fetch new versions', async () => {
  const { createHash } = await import('node:crypto');
  const hash = (f) => createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 8);
  const h = read('letters/seneca-on-losing-your-job/index.html');
  assert.match(h, new RegExp(`href="/assets/site\\.css\\?v=${hash('src/assets/site.css')}"`));
  assert.match(h, new RegExp(`src="/assets/waitlist\\.js\\?v=${hash('src/assets/waitlist.js')}"`));
});
test('letters, problem pages and mentor pages no longer link to the old guides', () => {
  for (const p of ['letters/seneca-on-burnout/index.html', 'problems/burnout/index.html', 'mentors/seneca/index.html'])
    assert.doesNotMatch(read(p), /href="\/journaling-prompts\//, p);
});

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
  assert.match(h, /href="\/journaling-prompts\/"/);
  assert.match(h, /href="\/letters\/seneca-on-losing-your-job\/"/);
});
test('letters index lists every letter grouped by problem, linking each problem hub', () => {
  const h = read('letters/index.html');
  assert.match(h, /href="\/letters\/epictetus-on-losing-your-job\/"/);
  assert.match(h, /href="\/problems\/losing-your-job\/"/);
});
test('every content page footer links the letters and prompts indexes', () => {
  for (const p of ['letters/seneca-on-losing-your-job/index.html', 'mentors/seneca/index.html', 'journaling-prompts/grief/index.html'])
    assert.match(read(p), /<nav class="site-nav"[\s\S]*href="\/letters\/"[\s\S]*href="\/journaling-prompts\/"/, p);
});
test('a letter always links its problem hub, even when it is the only letter on it', () => {
  assert.match(letter(), /href="\/problems\/losing-your-job\/"/);
});
test('a quote that starts mid-sentence is shown with a leading ellipsis', () => {
  assert.match(read('letters/marcus-aurelius-on-losing-your-job/index.html'), /<blockquote class="quote"><p>…the mind converts/);
});

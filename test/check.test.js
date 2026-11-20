import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalize, wordCount, shingles, jaccard, checkPage } from '../tools/check.js';
import { quoteInText } from '../tools/verify-quote.js';

const mentors = [
  { id: 'seneca', name: 'Seneca', publicDomain: true },
  { id: 'carl-jung', name: 'Carl Jung', publicDomain: false },
  { id: 'buddha', name: 'the Buddha', publicDomain: false },
];
const problems = [
  { id: 'losing-your-job', name: 'Losing your job', sensitive: false },
  { id: 'grief', name: 'Grief', sensitive: true },
];
const quotes = [{ id: 'seneca-imagination', mentor: 'seneca', text: 'We suffer more often in imagination than in reality.' }];
const words = (n, w = 'word') => Array.from({ length: n }, (_, i) => `${w}${i}`).join(' ');
const hi = (b) => `Dear friend,\n\n${b}`;
const letter = (data = {}, body = hi(words(700))) => ({
  path: 'src/letters/seneca-on-losing-your-job.md',
  data: {
    mentor: 'seneca', problem: 'losing-your-job',
    title: 'Seneca on losing your job: a letter for the first week',
    description: 'x'.repeat(140),
    quote: { id: 'seneca-imagination' },
    prompts: ['a?', 'b?', 'c?'],
    signoff: 'Farewell.',
    sensitive: false, date: new Date('2026-11-19'),
    ...data,
  },
  body,
});
const guideBody = (n) => `Intro.\n\n## How to use these prompts\n\n- one\n- two\n\n## Prompts\n\n${Array.from({ length: n }, (_, i) => `- prompt ${i}?`).join('\n')}\n`;
const guide = (n, data = {}) => ({
  path: 'src/journaling-prompts/grief.md',
  data: { problem: 'grief', title: 'Journaling prompts for grief', description: 'y'.repeat(140), sensitive: true, date: new Date('2026-11-19'), ...data },
  body: guideBody(n),
});
const ctx = (others = []) => ({ mentors, problems, quotes, others, banned: ['delve', "in today's fast-paced world"] });
const has = (errors, key) => errors.some((e) => e.startsWith(key));

test('a good letter passes', () => assert.deepEqual(checkPage(letter(), ctx()), []));
test('a good guide passes', () => assert.deepEqual(checkPage(guide(20), ctx()), []));
test('letter length must be 600 to 1100 words', () => {
  assert.ok(has(checkPage(letter({}, words(599)), ctx()), 'words'));
  assert.ok(has(checkPage(letter({}, words(1101)), ctx()), 'words'));
  assert.deepEqual(checkPage(letter({}, hi(words(598))), ctx()), []);
});
test('title at most 60 characters, description 120 to 160', () => {
  assert.ok(has(checkPage(letter({ title: 't'.repeat(61) }), ctx()), 'title'));
  assert.ok(has(checkPage(letter({ description: 'd'.repeat(119) }), ctx()), 'description'));
  assert.ok(has(checkPage(letter({ description: 'd'.repeat(161) }), ctx()), 'description'));
});
test('quote must be in the bank and belong to the mentor', () => {
  assert.ok(has(checkPage(letter({ quote: { id: 'made-up' } }), ctx()), 'quote'));
  assert.ok(has(checkPage(letter({ quote: undefined }), ctx()), 'quote'));
});
test('copyrighted mentor may not carry a quote, and needs none', () => {
  const p = { path: 'src/letters/carl-jung-on-losing-your-job.md', mentor: 'carl-jung' };
  assert.ok(has(checkPage({ ...letter({ mentor: 'carl-jung' }), path: p.path }, ctx()), 'quote'));
  assert.deepEqual(checkPage({ ...letter({ mentor: 'carl-jung', quote: undefined }), path: p.path }, ctx()), []);
});
test('unknown mentor or problem fails', () => {
  assert.ok(has(checkPage(letter({ mentor: 'yoda' }), ctx()), 'mentor'));
  assert.ok(has(checkPage(letter({ problem: 'boredom' }), ctx()), 'problem'));
});
test('a sensitive problem needs sensitive: true', () => {
  const g = letter({ problem: 'grief', sensitive: false });
  g.path = 'src/letters/seneca-on-grief.md';
  assert.ok(has(checkPage(g, ctx()), 'sensitive'));
  assert.ok(has(checkPage(guide(20, { sensitive: false }), ctx()), 'sensitive'));
});
test('near-copy of another page fails as similar', () => {
  const body = words(700);
  const copy = body.split(' ');
  for (const i of [10, 200, 350, 500, 650]) copy[i] = 'changed';
  const other = { path: 'src/letters/other.md', body: copy.join(' '), data: { mentor: 'seneca', problem: 'grief' } };
  assert.ok(has(checkPage(letter({}, body), ctx([other])), 'similar'));
  const different = { path: 'src/letters/other.md', body: words(700, 'other'), data: { mentor: 'seneca', problem: 'grief' } };
  assert.deepEqual(checkPage(letter({}, hi(body)), ctx([different])), []);
});
test('banned phrases fail, whatever the case or apostrophe', () => {
  assert.ok(has(checkPage(letter({}, words(700) + ' Let us Delve into it.'), ctx()), 'banned'));
  assert.ok(has(checkPage(letter({}, words(700) + ' In today’s fast-paced world.'), ctx()), 'banned'));
  assert.deepEqual(checkPage(letter({}, hi(words(700) + ' delved')), ctx()), [], 'whole words only');
});
test('letters need exactly three prompts', () => {
  assert.ok(has(checkPage(letter({ prompts: ['a', 'b'] }), ctx()), 'prompts'));
  assert.ok(has(checkPage(letter({ prompts: ['a', 'b', 'c', 'd'] }), ctx()), 'prompts'));
});
test('guides need 15 to 30 prompts, not counting the how-to section', () => {
  assert.ok(has(checkPage(guide(14), ctx()), 'prompts'));
  assert.ok(has(checkPage(guide(31), ctx()), 'prompts'));
  assert.deepEqual(checkPage(guide(15), ctx()), []);
});
test('two pages with the same URL fail', () => {
  const twin = { path: 'src/letters/seneca-job-2.md', body: words(700, 'twin'), data: { mentor: 'seneca', problem: 'losing-your-job' } };
  assert.ok(has(checkPage(letter(), ctx([twin])), 'slug'));
});
test('normalize ignores typography and spacing but not words', () => {
  assert.equal(normalize('“Hello”  —  world'), normalize('"hello" - world'));
  assert.notEqual(normalize('hello world'), normalize('hello word'));
  assert.equal(wordCount('## Heading\n\nOne *two* three.'), 4);
  assert.ok(jaccard(shingles(words(50)), shingles(words(50))) === 1);
});
test('quoteInText matches a real source with curly apostrophes and odd spaces', () => {
  const src = fs.readFileSync('test/fixtures/source.txt', 'utf8');
  assert.ok(quoteInText("his opponent's fist, who has been tripped", src));
  assert.ok(quoteInText('There are more things,  Lucilius,\nlikely to frighten us', src));
  assert.ok(!quoteInText("his opponent's hand, who has been tripped", src));
});
test('quoteInText rejects a quote cut or changed at a word edge', () => {
  assert.ok(!quoteInText('happy indeed.', 'he is unhappy indeed.'));
  assert.ok(!quoteInText('ever say of anything', 'Never say of anything'));
  assert.ok(quoteInText('say of anything', 'Never say of anything, ok'));
});
test('letter without signoff fails', () => {
  assert.ok(checkPage(letter({ signoff: undefined }), ctx()).includes('signoff: missing'));
});
test('signoff over 40 characters fails', () => {
  assert.ok(checkPage(letter({ signoff: 'x'.repeat(41) }), ctx()).includes('signoff: 41 characters, max 40'));
});
test('signature over 30 characters fails', () => {
  assert.ok(checkPage(letter({ signature: 'x'.repeat(31) }), ctx()).includes('signature: 31 characters, max 30'));
});
test('long first paragraph fails', () => {
  const errs = checkPage(letter({}, `${words(16, 'open')}\n\n${words(700)}`), ctx());
  assert.ok(errs.includes('body: first paragraph is 16 words; start with a short salutation (max 15)'));
});
test('last paragraph that is a sign-off fails', () => {
  const errs = checkPage(letter({}, `Dear friend,\n\n${words(700)}\n\nFarewell.`), ctx());
  assert.ok(errs.includes('body: ends with a short line ("Farewell."); move it to signoff'));
});
test('two-line sign-off with initials left in the body fails', () => {
  const body = `Dear friend,\n\n${words(700)}\n\nYour friend in the woods,\nH. D. T.`;
  const errs = checkPage(letter({ signoff: 'Your friend in the woods,', signature: 'H. D. T.' }, body), ctx());
  assert.ok(errs.includes('body: last paragraph repeats the sign-off or signature; remove it'), errs.join());
});
test('body ending with the mentor name fails', () => {
  const errs = checkPage(letter({}, `Dear friend,\n\n${words(700)}\n\nWrite to me soon, and be steady in all of it. Seneca`), ctx());
  assert.ok(errs.includes('body: last paragraph repeats the sign-off or signature; remove it'), errs.join());
});
test('a lowercase mentor name needs a capitalised signature', () => {
  const l = letter({ mentor: 'buddha', quote: undefined });
  l.path = 'src/letters/buddha-on-losing-your-job.md';
  assert.ok(checkPage(l, ctx()).includes('signature: "the Buddha" starts lowercase; set signature'));
  assert.ok(!checkPage({ ...l, data: { ...l.data, signature: 'The Buddha' } }, ctx()).some((e) => e.startsWith('signature')));
});
test('a number in a guide title must match the real prompt count', () => {
  assert.ok(has(checkPage(guide(20, { title: '25 journaling prompts for anxiety' }), ctx()), 'title'));
  assert.deepEqual(checkPage(guide(20, { title: '20 journaling prompts for anxiety' }), ctx()), []);
  assert.deepEqual(checkPage(guide(20, { title: 'Journaling prompts for anxiety' }), ctx()), []);
});

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from './_build.js';
import { submitWaitlist } from '../src/assets/waitlist.js';

before(build);
const htmlFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? htmlFiles(path.join(dir, e.name)) : e.name.endsWith('.html') ? [path.join(dir, e.name)] : []);
const urlOf = (file) => '/' + path.relative('_site', file).replace(/index\.html$/, '');

test('every page but privacy has exactly one waitlist form posting to the API', () => {
  for (const f of htmlFiles('_site')) {
    const h = fs.readFileSync(f, 'utf8');
    const n = (h.match(/<form class="waitlist"/g) || []).length;
    if (f.endsWith('privacy.html')) { assert.equal(n, 0, f); continue; }
    assert.equal(n, 1, f);
    assert.match(h, /<form class="waitlist" method="post" action="https:\/\/[^"]+\/v1\/waitlist"/, f);
    assert.match(h, new RegExp(`<input type="hidden" name="page" value="${urlOf(f)}">`), f);
    assert.match(h, /<input[^>]*name="website"[^>]*tabindex="-1"/, f);
    assert.match(h, /<input[^>]*type="email"[^>]*maxlength="254"[^>]*required/, f);
    assert.match(h, /<script type="module" src="\/assets\/waitlist.js" defer><\/script>/, f);
  }
});

const form = { action: 'https://api.test/v1/waitlist', elements: { email: { value: ' a@b.io ' }, page: { value: '/x/' }, website: { value: '' } } };
test('submitWaitlist sends JSON and reports done on 200', async () => {
  let sent;
  const r = await submitWaitlist(form, async (url, init) => { sent = { url, init }; return { ok: true, status: 200 }; });
  assert.equal(r, 'done');
  assert.equal(sent.url, 'https://api.test/v1/waitlist');
  assert.equal(sent.init.method, 'POST');
  assert.equal(sent.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(sent.init.body), { email: 'a@b.io', page: '/x/', website: '' });
});
test('submitWaitlist reports error on network failure', async () => {
  assert.equal(await submitWaitlist(form, async () => { throw new TypeError('offline'); }), 'error');
});
test('submitWaitlist reports error on 500 and 503', async () => {
  assert.equal(await submitWaitlist(form, async () => ({ ok: false, status: 500 })), 'error');
  assert.equal(await submitWaitlist(form, async () => ({ ok: false, status: 503 })), 'error');
});
test('submitWaitlist tells a bad email and rate limit apart from a network failure', async () => {
  assert.equal(await submitWaitlist(form, async () => ({ ok: false, status: 400 })), 'email');
  assert.equal(await submitWaitlist(form, async () => ({ ok: false, status: 429 })), 'rate');
  assert.equal(await submitWaitlist(form, async () => ({ ok: false, status: 500 })), 'error');
});
test('apiBase is a real deployed Worker, not the placeholder', () => {
  const { apiBase } = JSON.parse(fs.readFileSync('src/_data/site.json', 'utf8'));
  assert.notEqual(apiBase, 'https://letterlight-api.workers.dev');
  assert.match(apiBase, /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/);
});

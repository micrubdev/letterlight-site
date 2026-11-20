import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { build } from './_build.js';
import { needsConsent, CHOICE_KEY } from '../src/assets/consent.js';
import { reportSignup } from '../src/assets/waitlist.js';

// Google Analytics is off until site.json has a gaId; a copy of src/ with a test id checks the tag itself.
const TMP = 'tmp-test-analytics';
before(() => {
  build();
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.cpSync('src', `${TMP}/src`, { recursive: true });
  const site = JSON.parse(fs.readFileSync(`${TMP}/src/_data/site.json`, 'utf8'));
  fs.writeFileSync(`${TMP}/src/_data/site.json`, JSON.stringify({ ...site, gaId: 'G-TEST123' }));
  execSync('npx @11ty/eleventy --quiet', { stdio: 'pipe', env: { ...process.env, NODE_NO_WARNINGS: '1', LL_INPUT: `${TMP}/src`, LL_OUTPUT: `${TMP}/out` } });
});
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

test('no Google Analytics tag while gaId is empty', (t) => {
  if (JSON.parse(fs.readFileSync('src/_data/site.json', 'utf8')).gaId) return t.skip('gaId is set');
  assert.doesNotMatch(fs.readFileSync('_site/index.html', 'utf8'), /googletagmanager/);
});
test('with a gaId, every page loads gtag with ads off and analytics denied in Europe by default', () => {
  for (const p of ['index.html', 'letters/seneca-on-grief/index.html', 'journaling-prompts/grief/index.html', 'privacy.html']) {
    const h = fs.readFileSync(`${TMP}/out/${p}`, 'utf8');
    assert.match(h, /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-TEST123"><\/script>/, p);
    assert.match(h, /gtag\('config', 'G-TEST123'\)/, p);
    assert.match(h, /ad_storage: 'denied'/, p);
    assert.match(h, /analytics_storage: 'denied', region: \[[^\]]*'DE'[^\]]*'GB'[^\]]*'CH'/, p);
    assert.match(h, /src="\/assets\/consent\.js\?v=[0-9a-f]{8}"/, p);
  }
});
test('consent bar is only needed for European time zones', () => {
  assert.equal(needsConsent('Europe/Berlin'), true);
  assert.equal(needsConsent('Europe/London'), true);
  assert.equal(needsConsent('Atlantic/Canary'), true);
  assert.equal(needsConsent('America/New_York'), false);
  assert.equal(needsConsent('Asia/Jerusalem'), false);
  assert.equal(typeof CHOICE_KEY, 'string');
});
test('a waitlist signup is reported to analytics when gtag exists, and is harmless without it', () => {
  const calls = [];
  reportSignup({ gtag: (...a) => calls.push(a) });
  assert.deepEqual(calls, [['event', 'sign_up', { method: 'waitlist' }]]);
  assert.doesNotThrow(() => reportSignup({}));
});
test('privacy policy describes Google Analytics on the website', () => {
  const h = fs.readFileSync('_site/privacy.html', 'utf8');
  assert.match(h, /Google Analytics/);
  assert.match(h, /No analytics, advertising or tracking libraries in the app/);
});

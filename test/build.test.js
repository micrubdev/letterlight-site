import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from './_build.js';

before(build);

test('ported pages and passthrough files exist', () => {
  for (const f of ['index.html', 'privacy.html', 'CNAME', 'icon.png', '.nojekyll', 'assets/site.css'])
    assert.ok(fs.existsSync(`_site/${f}`), f);
});
test('private folders are not published', () => {
  for (const d of ['docs', 'content', 'tools', 'test', '.claude', 'node_modules']) assert.ok(!fs.existsSync(`_site/${d}`), d);
});
test('privacy page keeps its text and canonical url', () => {
  const html = fs.readFileSync('_site/privacy.html', 'utf8');
  assert.match(html, /<link rel="canonical" href="https:\/\/letterlight.app\/privacy.html">/);
  assert.match(html, /Privacy policy/);
});
test('home page keeps its tagline and canonical url', () => {
  const html = fs.readFileSync('_site/index.html', 'utf8');
  assert.match(html, /<link rel="canonical" href="https:\/\/letterlight.app\/">/);
  assert.match(html, /Great minds write back/);
});
test('privacy policy covers the waitlist at #waitlist', () => {
  const html = fs.readFileSync('_site/privacy.html', 'utf8');
  assert.match(html, /<h2 id="waitlist">Beta waitlist<\/h2>/);
  assert.match(html, /never sold/);
  assert.match(html, /scrambled form of your IP address/);
  assert.match(html, /Last updated 19 November 2026/);
});

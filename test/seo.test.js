import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from './_build.js';

before(build);
const read = (p) => fs.readFileSync(`_site/${p}`, 'utf8');

test('sitemap lists every public page with lastmod', () => {
  const xml = read('sitemap.xml');
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  for (const p of ['/', '/privacy.html', '/letters/seneca-on-losing-your-job/', '/letters/marcus-aurelius-on-losing-your-job/',
    '/mentors/seneca/', '/problems/losing-your-job/', '/journaling-prompts/grief/', '/journaling-prompts/'])
    assert.ok(locs.includes(`https://letterlight.app${p}`), p);
  assert.equal((xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length, locs.length);
  assert.ok(!locs.some((l) => /sitemap|robots|feed|assets/.test(l)), 'no machine files in sitemap');
});
test('robots allows all and points to the sitemap', () => {
  assert.equal(read('robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://letterlight.app/sitemap.xml\n');
});
test('feed has one entry per letter and guide', () => {
  const xml = read('feed.xml');
  assert.match(xml, /^<\?xml/);
  const n = fs.readdirSync('src/letters').filter((f) => f.endsWith('.md')).length + fs.readdirSync('src/journaling-prompts').filter((f) => f.endsWith('.md')).length;
  assert.equal((xml.match(/<entry>/g) || []).length, n);
});

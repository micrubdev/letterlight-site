import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from './_build.js';
build();
const read = (p) => fs.readFileSync(`_site/${p}`, 'utf8');
for (const id of ['epictetus', 'seneca']) {
  test(`${id} facts page shows each fact with its source, and links to the letters`, () => {
    const html = read(`facts/${id}/index.html`);
    const n = (html.match(/class="fact"/g) ?? []).length + (html.match(/class="fact fact-legend"/g) ?? []).length;
    assert.ok(n >= 5 && n <= 8, `facts: ${n}`);
    assert.equal((html.match(/class="source"/g) ?? []).length, n);
    assert.match(html, /class="fact fact-legend"/);
    assert.match(html, /Retold with AI/);
    assert.match(html, new RegExp(`href="/mentors/${id}/"`));
    assert.match(html, new RegExp(`href="/letters/${id}-on-`));
    assert.match(html, /"@type":"Article"/);
  });
  test(`${id} letters and hub link to the facts page`, () => {
    assert.match(read(`mentors/${id}/index.html`), new RegExp(`href="/facts/${id}/"`));
    assert.match(read(`letters/${id}-on-losing-your-job/index.html`), new RegExp(`href="/facts/${id}/"`));
  });
}
test('mentors without a facts page get no facts link', () => assert.doesNotMatch(read('mentors/confucius/index.html'), /href="\/facts\/confucius\//));
test('facts index, sitemap and feed list the facts pages', () => {
  for (const f of ['facts/index.html', 'sitemap.xml', 'feed.xml']) for (const id of ['epictetus', 'seneca']) assert.ok(read(f).includes(`/facts/${id}/`), `${f} ${id}`);
});

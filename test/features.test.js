import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from './_build.js';
build();
const read = (p) => fs.readFileSync(`_site/${p}`, 'utf8');
const ids = fs.readdirSync('src/features').filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
for (const id of ids) {
  test(`features/${id} shows screenshots that exist, with alt text and the sample label`, () => {
    const html = read(`features/${id}/index.html`);
    const imgs = [...html.matchAll(/<img src="(\/assets\/app\/[^"?]+)\?v=[0-9a-f]+" alt="([^"]*)"/g)];
    assert.ok(imgs.length >= 1);
    for (const [, src, alt] of imgs) {
      assert.ok(fs.existsSync(`_site${src}`), src);
      assert.ok(alt.length > 20, src);
    }
    assert.match(html, /are samples written for this page/);
    assert.match(read('features/index.html'), new RegExp(`href="/features/${id}/"`));
    assert.match(read('sitemap.xml'), new RegExp(`/features/${id}/</loc>`));
  });
}
test('home page and content footers link to the features index', () => {
  for (const p of ['index.html', 'letters/seneca-on-burnout/index.html', 'facts/seneca/index.html'])
    assert.match(read(p), /href="\/features\/"/, p);
});

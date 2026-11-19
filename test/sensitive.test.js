import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

// A sensitive-problem letter whose front matter forgot sensitive: true still renders the crisis box.
// Built from a copy of src/ so the other test files' builds are not affected.
// Inside the repo (Eleventy globs need a relative input) and not git-ignored (Eleventy skips ignored folders).
const TMP = 'tmp-test-sensitive';
const IN = path.join(TMP, 'src');
const OUT = path.join(TMP, 'out');
before(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.cpSync('src', IN, { recursive: true });
  fs.writeFileSync(`${IN}/letters/seneca-on-abuse.md`, '---\nmentor: seneca\nproblem: abuse\ntitle: T\ndescription: D\nprompts: [a, b, c]\nsensitive: false\ndate: 2026-01-01\n---\nBody.\n');
  execSync('npx @11ty/eleventy --quiet', { stdio: 'pipe', env: { ...process.env, NODE_NO_WARNINGS: '1', LL_INPUT: IN, LL_OUTPUT: OUT } });
});
after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('crisis box follows the problem data, with abuse lines first', () => {
  const h = fs.readFileSync(`${OUT}/letters/seneca-on-abuse/index.html`, 'utf8');
  assert.match(h, /class="crisis"/);
  assert.match(h, /href="\/problems\/abuse\/"/, 'only letter on its problem still links the hub');
  assert.ok(h.indexOf('National Domestic Violence Hotline') < h.indexOf('988 Suicide'));
});

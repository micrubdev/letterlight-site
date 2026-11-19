# Letterlight Content Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn letterlight.app into an Eleventy site of AI-written mentor letters and journaling guides. Every page has a beta-waitlist form, and a project skill publishes new pages when the user asks in a Claude Code session.

**Architecture:**
- **Site** (`~/letterlight-site`): Eleventy 3 builds it from `src/`. A GitHub Action builds and deploys it to Pages on every push to `main`.
- **Content checks:** a Node check script (`tools/check.js`) gates every page before it's committed.
- **Waitlist:** signups go to a new route on the existing Cloudflare Worker (`~/mentora/server`).
- **Publishing:** the `letterlight-publish` skill drives a run. Claude writes the pages in-session, so there is no generation code.

**Tech Stack:**
- Site: Eleventy `@11ty/eleventy@3.1.2`, `@11ty/eleventy-plugin-rss@2.0.4`, `gray-matter@4.0.3`, `js-yaml@4.1.0`; tests with `node:test`.
- Worker: TypeScript and vitest, as already used there.

**Spec:** `docs/superpowers/specs/2026-11-19-seo-content-engine-design.md`

## Global Constraints

- **English only.** Brand colours and fonts come from the current `index.html` (Lora + Inter; parchment `#F6F1E7`, ink `#1F2A44`, amber `#B07330`, with its dark-mode tokens).
- **Fixed URLs:**
  - `privacy.html` keeps its exact URL;
  - letters at `/letters/<mentor>-on-<problem>/`;
  - mentor hubs at `/mentors/<mentor>/`;
  - problem hubs at `/problems/<problem>/`;
  - guides at `/journaling-prompts/<topic>/`.
- **AI label**, word for word, on every letter: `An imagined letter, written with AI in the voice of {name}. Not {possessive} own words.`
- **Letter length:** 600–1,100 words. Guides have 15–30 prompts.
- **Quotes:** each must appear word for word in `content/quotes.yaml`. Only public-domain mentors at launch: marcus-aurelius, seneca, epictetus, socrates, confucius, lao-tzu, buddha, rumi, maimonides, hillel, tolstoy, dostoevsky, chekhov, emerson, thoreau.
- **Similarity:** a page fails if its 5-word-shingle Jaccard overlap with any existing page is above 0.35.
- **Pace:** 3 pages per run by default, at most 10 published per calendar day.
- **Heavy topics:** sensitive problems (grief, depression, self-harm, abuse, addiction) must have `sensitive: true`, which renders the crisis box. Sensitive and flagged pages are pushed only after the user approves.
- **The only JavaScript** on the site is the waitlist form script.
- `docs/`, `.claude/`, `content/`, `tools/` and `test/` are never published.
- **Outward-facing steps need the user's OK at that moment:**
  - deploying the Worker;
  - switching the Pages build type;
  - every push of sensitive or flagged pages.

## Review Focus

1. **Waitlist abuse and odd input:** an empty, malformed or 300-character email, the same email twice, a filled honeypot, or a burst from one IP. The site must still say "You're on the list" for duplicates and the honeypot, and must never store junk. → tests in Task 5.
2. **A quote that is close but not exact:** curly vs straight quotes, extra spaces, a changed word. Typography and spacing are ignored when matching, but a changed word fails. → tests in Task 6.
3. **A page about a sensitive problem written with `sensitive: false`** fails the check, and the rendered page always shows the crisis box. → tests in Tasks 2 and 6.
4. **Hub pages with only one letter** must not show empty "other mentors" sections or links to themselves. → test in Task 2.
5. **A form submitted with JavaScript off or a network error** still shows a readable message. Without JavaScript the form posts nowhere harmful: `action` is the API URL, and the Worker answers a non-JSON post with a plain thank-you page. → tests in Tasks 4 and 5.

---

### Task 1: Eleventy scaffold and ported pages

**Files:**
- Create:
  - `package.json`
  - `eleventy.config.js`
  - `src/_includes/base.njk`
  - `src/_includes/head.njk`
  - `src/assets/site.css`
  - `src/index.njk`
  - `src/privacy.njk`
  - `src/_data/site.json`
  - `test/build.test.js`
  - `.gitignore` (`node_modules/`, `_site/`)
- Move: `icon.png` and `CNAME` → `src/` (copied as they are). Delete `.nojekyll` at the root and recreate it under `src/`.

**Interfaces:**
- Produces:
  - `site.json`: `{ "url": "https://letterlight.app", "name": "Letterlight", "apiBase": "<Worker URL from ~/mentora/lib/llm>" }`
  - layout `base.njk`, which takes `title`, `description`, an optional `jsonld` (object), and `content`
  - `npm run build` builds `src` into `_site`
  - `npm test` runs `node --test test/`

- [ ] **Step 1: Write the failing test** `test/build.test.js`. It runs `npx @11ty/eleventy` once in a `before()` hook, then asserts:

```js
test('ported pages and passthrough files exist', () => {
  for (const f of ['index.html', 'privacy.html', 'CNAME', 'icon.png', '.nojekyll', 'assets/site.css'])
    assert.ok(fs.existsSync(`_site/${f}`), f);
});
test('private folders are not published', () => {
  for (const d of ['docs', 'content', 'tools', 'test', '.claude']) assert.ok(!fs.existsSync(`_site/${d}`), d);
});
test('privacy page keeps its text and canonical url', () => {
  const html = fs.readFileSync('_site/privacy.html', 'utf8');
  assert.match(html, /<link rel="canonical" href="https:\/\/letterlight.app\/privacy.html">/);
  assert.match(html, /Privacy policy/);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL, because there's no Eleventy config or build yet.
- [ ] **Step 3: Implement.**
  - `eleventy.config.js` sets input `src`, output `_site` and includes `_includes`, and passes through `src/assets`, `src/icon.png`, `src/CNAME` and `src/.nojekyll`.
  - `head.njk` holds the meta, canonical (`site.url + page.url`), Open Graph and fonts tags, and outputs `jsonld` as `<script type="application/ld+json">` when given.
  - Move the CSS from `index.html` into `site.css` unchanged.
  - `privacy.njk` uses `permalink: privacy.html`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS. Then open `_site/index.html` and `_site/privacy.html` and compare them with the live site: the text must be the same.
- [ ] **Step 5: Commit** with `feat: move site to Eleventy`.

### Task 2: Letter and guide pages, hubs, structured data

**Files:**
- Create:
  - `src/_data/mentors.json`
  - `src/_data/problems.json`
  - `src/_data/helplines.json`
  - `src/_includes/letter.njk`
  - `src/_includes/guide.njk`
  - `src/_includes/crisis.njk`
  - `src/_includes/related.njk`
  - `src/mentors.njk` (paginated)
  - `src/problems.njk` (paginated)
  - `src/letters/letters.11tydata.json`
  - `src/journaling-prompts/journaling-prompts.11tydata.json`
- Create two real launch letters:
  - `src/letters/seneca-on-losing-your-job.md`
  - `src/letters/marcus-aurelius-on-losing-your-job.md`
- Create one guide: `src/journaling-prompts/grief.md` (sensitive).
- Create `test/pages.test.js`. Modify `eleventy.config.js`.

**Interfaces:**
- Consumes: `base.njk` and `site.json` from Task 1.
- Produces:
  - `mentors.json`: `[{ id, name, possessive, role, voice, publicDomain: boolean }]`. Copy `voice` from `~/mentora/lib/mentors.dart`. Skip `future-you`.
  - `problems.json`: `[{ id, name, query, sensitive: boolean, abuse: boolean }]`.
  - `helplines.json`: `{ general: [{ region, name, phone }], abuse: [...] }`, copied from `~/mentora/lib/helplines.dart`, keeping its check date.
  - Letter front matter: `{ mentor, problem, title, description, quote: { id }, prompts: [3 strings], sensitive, date }`.
  - Guide front matter: `{ problem, title, description, sensitive, date }`. The body holds the prompt groups as `##` sections with `-` list items.
  - Collections:
    - `letters` and `guides`, sorted by date;
    - `lettersByMentor` and `lettersByProblem` (keyed by id);
    - `mentorsWithLetters` and `problemsWithLetters`, which hubs paginate over so empty hubs never build.
  - Includes: `waitlist.njk` from Task 4. Until then, `letter.njk` includes it with `ignore missing`.

- [ ] **Step 1: Write the failing tests** in `test/pages.test.js`, using the same build-once `before()` hook:

```js
const letter = () => fs.readFileSync('_site/letters/seneca-on-losing-your-job/index.html', 'utf8');
test('letter carries AI label, real quote with source, three prompts', () => {
  const h = letter();
  assert.match(h, /An imagined letter, written with AI in the voice of Seneca\. Not his own words\./);
  assert.match(h, /<blockquote[^>]*class="quote"/);  assert.match(h, /<cite>/);
  assert.equal((h.match(/class="prompt"/g) || []).length, 3);
});
test('letter has Article and BreadcrumbList JSON-LD', () => {
  const ld = [...letter().matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
  assert.deepEqual(ld.map(x => x['@type']).sort(), ['Article', 'BreadcrumbList']);
});
test('same-problem and same-mentor links, never to itself', () => {
  const h = letter();
  assert.match(h, /href="\/letters\/marcus-aurelius-on-losing-your-job\/"/);
  assert.doesNotMatch(h, /href="\/letters\/seneca-on-losing-your-job\/"/);
});
test('hub with one letter has no empty sections', () => {
  const h = fs.readFileSync('_site/mentors/seneca/index.html', 'utf8');
  assert.doesNotMatch(h, /<section[^>]*>\s*<h2[^>]*>[^<]*<\/h2>\s*<\/section>/);
});
test('sensitive pages always show the crisis box; others do not', () => {
  assert.match(fs.readFileSync('_site/journaling-prompts/grief/index.html', 'utf8'), /class="crisis"/);
  assert.doesNotMatch(letter(), /class="crisis"/);
});
test('problem hub lists both mentors', () => {
  const h = fs.readFileSync('_site/problems/losing-your-job/index.html', 'utf8');
  assert.match(h, /Seneca/); assert.match(h, /Marcus Aurelius/);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL, because the pages don't exist yet.
- [ ] **Step 3: Write the data files and layouts.**
  - Build the permalinks from front matter in the directory data files: letters `/letters/{{mentor}}-on-{{problem}}/`, guides `/journaling-prompts/{{problem}}/`.
  - Breadcrumbs are Home › Mentor › Letter for letters, and Home › Journaling prompts › Topic for guides.
  - Write the two letters and the guide by hand in the app's voices. Add their quotes to `content/quotes.yaml` (format in Task 6) so they pass later checks.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: letter, guide and hub pages`.

### Task 3: Sitemap, robots, feed

**Files:**
- Create: `src/sitemap.njk` (→ `/sitemap.xml`), `src/robots.njk` (→ `/robots.txt`), `src/feed.njk` (→ `/feed.xml`), `test/seo.test.js`.
- Modify: `eleventy.config.js` (add the RSS plugin).

- [ ] **Step 1: Write the failing tests.**
  - The sitemap contains `<loc>` entries for `/`, `/privacy.html`, both letters, `/mentors/seneca/`, `/problems/losing-your-job/` and `/journaling-prompts/grief/`, and each has a `<lastmod>`.
  - `robots.txt` equals `User-agent: *\nAllow: /\nSitemap: https://letterlight.app/sitemap.xml\n`.
  - `feed.xml` parses, and its `<entry>` count equals the number of letters plus guides.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.** The sitemap iterates `collections.all`, skipping pages with `eleventyExcludeFromCollections`. The feed uses the plugin's `atom` template over letters and guides.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: sitemap, robots and feed`.

### Task 4: Waitlist form

**Files:**
- Create: `src/_includes/waitlist.njk`, `src/assets/waitlist.js`, `test/waitlist-form.test.js`.
- Modify:
  - `base.njk`, which includes the form in the footer of every page except `privacy.html`;
  - `src/index.njk`, which gets a prominent form under the hero.

**Interfaces:**
- Produces: a `<form class="waitlist" method="post" action="{{ site.apiBase }}/v1/waitlist">` with these fields:
  - `email` (type email, required, maxlength 254);
  - `page` (hidden, set to `page.url`);
  - `website` (honeypot, hidden from view and from screen readers, `tabindex="-1"`, `autocomplete="off"`).
- `waitlist.js` sends JSON `{ email, page, website }` with `fetch`.
  - On `ok` it replaces the form with `<p class="waitlist-done">You're on the list. We'll write when the beta opens.</p>`.
  - On any failure it shows `Couldn't reach the server. Try again in a minute.` in `.waitlist-error`.

- [ ] **Step 1: Write the failing tests.**
  - Every built HTML file except `privacy.html` contains exactly one `form.waitlist`, whose `action` ends with `/v1/waitlist`.
  - Its `page` input equals the page's own URL path.
  - The honeypot input has `tabindex="-1"`.
  - The script tag is `defer`.
  - A unit test runs `waitlist.js`'s exported `submitWaitlist(form, fetchImpl)` with a fake `fetchImpl`:
    - a 200 response → `done`;
    - a rejected promise → `error`;
    - a 429 → `error`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `export async function submitWaitlist(form, fetchImpl = fetch): Promise<'done' | 'error'>`. Attach it on `DOMContentLoaded`. Keep it a plain ES module that `node:test` can import.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat: waitlist form on every page`.

### Task 5: Worker waitlist route (repo `~/mentora/server`)

**Files:**
- Create: `src/waitlist.ts`, `test/waitlist.test.ts`.
- Modify: `src/index.ts`, adding `LedgerObject.waitlistAdd`, `waitlistRows` and `waitlistRate`, plus the routes.

**Interfaces:**
- Produces:
  - `type JsonStore = { get<T>(k: string): Promise<T | undefined>; put<T>(k: string, v: T): Promise<void>; list<T>(prefix: string): Promise<Map<string, T>> }`
  - `class Waitlist { constructor(store: JsonStore, now: () => Date) }` with three methods:
    - `add(email: string, page: string): Promise<'added' | 'exists'>`: the key is `wl:` plus the lowercased, trimmed email, and the value is `{ email, page, at: ISO }`.
    - `rows(): Promise<{ email: string; page: string; at: string }[]>`, oldest first.
    - `hit(ip: string): Promise<boolean>`: true while that IP is under 5 signups in the current UTC hour, with key `wlrate:<ip>:<yyyy-mm-ddThh>`.
  - `handleWaitlistSignup(req: Request, deps: { waitlist: Pick<Waitlist, 'add' | 'hit'> }): Promise<Response>`
  - `handleWaitlistExport(req: Request, deps: { adminToken: string; waitlist: Pick<Waitlist, 'rows'> }): Promise<Response>`, which returns `{ total, byPage: Record<string, number>, rows }`. Auth works exactly like `handleStudyExport`: 404 without a token, 401 with the wrong one.
  - Routes:
    - `OPTIONS /v1/waitlist` → 204 with CORS headers;
    - `POST /v1/waitlist`;
    - `GET /v1/admin/waitlist`.
  - CORS header: `Access-Control-Allow-Origin: https://letterlight.app` only.

- [ ] **Step 1: Write the failing tests**, with an in-memory `JsonStore` added to `test/helpers.ts` as `memoryJsonStore()`:
  - A valid JSON post → 200 `{ ok: true }` with the CORS header, and `rows()` has 1 entry.
  - The same email with different case → 200, and still 1 row.
  - A non-empty `website` → 200 `{ ok: true }`, and 0 rows.
  - `email` values `''`, `'nope'`, `'a@b'`, and 255 characters ending in `@x.io` → 400 `{ ok: false, error: 'email' }`.
  - `page` longer than 200 characters → it is stored cut to 200.
  - A 6th signup from one IP within an hour → 429, and a signup the next hour → 200. Use `CF-Connecting-IP`.
  - A form-encoded post (JavaScript off) → 200 `text/html` containing `You're on the list`.
  - Admin export: 404 with no token, 401 with the wrong one, 200 with `total` and `byPage` counts.
- [ ] **Step 2: Run** `npm test -- waitlist`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/waitlist.ts`.
  - The email check is `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/` and length ≤ 254.
  - Wire the methods into `LedgerObject`, backed by `this.ctx.storage`, and add the routes in `index.ts`.
- [ ] **Step 4: Run** `npm test && npm run check`. Expected: all pass, no type errors.
- [ ] **Step 5: Commit** in `~/mentora` with `feat(server): waitlist signups and admin export`.
- [ ] **Step 6: Ask the user before deploying.** Then:
  - run `npm run deploy`;
  - make sure `ADMIN_TOKEN` is set (`wrangler secret list`);
  - save it to `~/.config/letterlight/admin_token` (mode 600) for the stats command;
  - check by running `curl -s -X OPTIONS -H 'Origin: https://letterlight.app' -i <apiBase>/v1/waitlist`. Expected: 204 with the allow-origin header.

### Task 6: Content checks

**Files:**
- Create:
  - `tools/check.js` (command-line program plus exported functions)
  - `tools/lib/text.js`
  - `tools/banned-phrases.txt`
  - `tools/verify-quote.js`
  - `content/quotes.yaml`
  - `content/topics.yaml`
  - `test/check.test.js`
  - `test/fixtures/source.txt`
- Modify: `package.json` (add `"check": "node tools/check.js"`).

**Interfaces:**
- Consumes: front matter from Task 2, and `mentors.json` and `problems.json`.
- Produces:
  - `quotes.yaml` entries: `{ id, mentor, text, work, location, translation, source_url, verified: YYYY-MM-DD }`.
  - `topics.yaml` entries: `{ slug, type: letter|guide, mentor?, problem, query, status: queued|published|flagged, note? }`.
  - `normalize(s: string): string`: lowercase, curly quotes and dashes made plain, whitespace collapsed.
  - `wordCount(markdownBody: string): number`
  - `shingles(text: string, k = 5): Set<string>`
  - `jaccard(a: Set<string>, b: Set<string>): number`
  - `checkPage(file: { path, data, body }, ctx: { mentors, problems, quotes, others: { path, body }[], banned: string[] }): string[]`, which returns readable errors (an empty array means pass).
  - The command-line program checks every page under `src/letters` and `src/journaling-prompts`, or the paths given as arguments. It prints `path: error` lines and exits 1 on any error. It also exits 1 if more than 10 pages share today's `date`.
  - `verify-quote.js <id>` fetches `source_url` and exits 0 only if `normalize(text)` is contained in `normalize(fetched text)`.

- [ ] **Step 1: Write the failing tests** of `checkPage`, built on a good letter fixture made in the test:
  - The good letter → `[]`.
  - 599 words → an error containing `words`. 1,101 words → the same.
  - A title over 60 characters → `title`. A description outside 120–160 characters → `description`.
  - A quote id missing from the bank → `quote`.
  - A mentor with `publicDomain: false` but a quote → `quote`.
  - A mentor not in `mentors.json` → `mentor`. An unknown problem → `problem`.
  - The problem `grief` (sensitive) with `sensitive: false` → `sensitive`.
  - The body copied from another page with 5 words changed → `similar` (Jaccard > 0.35).
  - A body containing a banned phrase → `banned`.
  - `prompts` with a length other than 3 → `prompts`.
  - A guide with 14 or 31 list items → `prompts`.
  - `normalize('“Hello”  —  world')` equals `normalize('"hello" - world')`, but `normalize` of a changed word does not match.
  - `verify-quote`'s matching function, run against `test/fixtures/source.txt`, passes a quote with curly quotes and fails one with a changed word.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Seed `banned-phrases.txt` with common AI tells, such as "delve", "tapestry", "in today's fast-paced world", "it's important to note", "navigate the complexities", "embark on a journey", "testament to" and "a reminder that".
  - Seed `topics.yaml` with 30 queued topics:
    - launch problems: losing-your-job, grief, anxiety, loneliness;
    - three mentors each, picked to fit each problem;
    - guides for anxiety, grief, gratitude and burnout;
    - then wider problems: burnout, breakup, procrastination, envy, fear-of-death, anger, starting-over, caring-for-a-parent.
  - Each topic gets a `query` written the way a person would search.
- [ ] **Step 4: Run** `npm test && npm run check`. Expected: PASS, and the three Task 2 pages pass the check.
- [ ] **Step 5: Commit** with `feat: content checks, quote bank and topic queue`.

### Task 7: Deploy workflow and Pages switch

**Files:**
- Create: `.github/workflows/deploy.yml`.

- [ ] **Step 1: Write the workflow.**
  - It runs on push to `main` and on manual trigger, with permissions `pages: write`, `id-token: write` and `contents: read`.
  - Steps: checkout → `actions/setup-node@v4` (Node 22, npm cache) → `npm ci` → `npm test` → `npm run check` → `npm run build` → `actions/upload-pages-artifact@v3` (path `_site`) → `actions/deploy-pages@v4`.
- [ ] **Step 2: Check locally** with `npm ci && npm test && npm run check && npm run build`. Expected: all pass.
- [ ] **Step 3: Ask the user**, then switch Pages with `gh api -X PUT repos/micrubdev/letterlight-site/pages -f build_type=workflow`, push `main`, and watch with `gh run watch`.
- [ ] **Step 4: Check the live site:**
  - `curl -sI https://letterlight.app/privacy.html` → 200;
  - `curl -s https://letterlight.app/sitemap.xml | grep -c '<loc>'` → the expected count;
  - `curl -sI https://letterlight.app/docs/` → 404.

  If HTTPS breaks, remove and re-add the custom domain through the API, as recorded in memory.
- [ ] **Step 5: Commit** the workflow in the same push as Step 3.

### Task 8: Privacy policy update

**Files:** modify `src/privacy.njk`.

- [ ] **Step 1: Add a "Beta waitlist" section.** It says:
  - we store your email, the page you signed up on, and the time;
  - we use it only to invite you to the beta;
  - the data is kept on Letterlight's Cloudflare server until the beta opens, or until you ask to be removed (contact address as elsewhere in the policy);
  - it is never sold or shared.

  Update the policy's "last updated" date.
- [ ] **Step 2: Run** `npm test`. Expected: PASS, and Task 1's privacy test still holds.
- [ ] **Step 3: Commit** with `docs: privacy policy covers the waitlist`. It is pushed with Task 7 or the next push.

### Task 9: `letterlight-publish` skill

**Files:** create `.claude/skills/letterlight-publish/SKILL.md`.

**Interfaces:**
- Consumes:
  - `npm run check` and `npm run build`;
  - `topics.yaml` and `quotes.yaml` (Task 6), and `verify-quote.js`;
  - `mentors.json` and `problems.json` (Task 2);
  - the admin export (Task 5).

- [ ] **Step 1: Write the skill.**
  - Front matter: name `letterlight-publish`. Description triggers: "publish letterlight pages", "new letterlight pages", "letterlight stats".
  - Body: the run from the spec, steps 1–6, with:
    - the default N=3, and refusing to go past 10 pages on today's date;
    - picking the next `queued` topics. If fewer than 10 remain, append new ones and list them in the report;
    - for each page, picking or adding a quote. A new quote is added only after `node tools/verify-quote.js <id>` exits 0;
    - writing the page in the mentor's `voice`, then a pass with the `avoid-ai-writing` skill;
    - running `npm run check -- <paths>`; a failing page gets one rewrite, then `status: flagged` with the errors in `note`;
    - running `npm run build`;
    - committing and pushing the passing pages that aren't sensitive;
    - showing sensitive and flagged pages in the channel the request came from (Telegram reply or terminal) and pushing them only after a yes;
    - setting `status: published` in `topics.yaml` in the same commit;
    - a report listing the URLs, flagged items, queue size and waitlist total.
  - "letterlight stats": curl `<apiBase>/v1/admin/waitlist` with the token from `~/.config/letterlight/admin_token`, count the pages under `src/letters` and `src/journaling-prompts`, and remind the user that Google clicks are in Search Console.
- [ ] **Step 2: Dry run.** The skill supports "dry run" in the request, meaning do everything except commit and push. Run "publish 1 letterlight page, dry run" on a non-sensitive topic. Expected: one new page file, `npm run check` and `npm run build` both pass, and `git status` shows uncommitted changes only.
- [ ] **Step 3: Commit** with `feat: letterlight-publish skill`.

### Task 10: Launch batch and Search Console

- [ ] **Step 1: Run** `letterlight-publish` for the launch batch: 12 letters (4 launch problems × 3 mentors, counting the two from Task 2) plus guides for anxiety, grief and gratitude, about 15 pages in all. Spread them across two days so no day has more than 10.
- [ ] **Step 2: Show the user the sensitive pages** (grief) and push them after approval.
- [ ] **Step 3: Check live:** every new URL returns 200, the sitemap lists them, and a test signup from the live site shows up in the admin export. Then remove the test row by deleting its `wl:` key, using a one-off admin call or `wrangler`.
- [ ] **Step 4: Hand over the Search Console steps** for the user to do once:
  - add the domain property `letterlight.app`;
  - add the TXT record at Porkbun;
  - verify;
  - submit `https://letterlight.app/sitemap.xml`.
- [ ] **Step 5: Save a memory** for the project: how to trigger a run, where the topic queue lives, and the admin token path.

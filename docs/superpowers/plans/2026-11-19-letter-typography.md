# Letter Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Letter pages look like a letter on paper: a cream ruled sheet, a dateline, a drop cap, an italic sign-off and the mentor's name in ink handwriting.

**Architecture:**
- `letter.njk` draws the dateline, the sign-off and the signature from front matter (`date`, `signoff`, optional `signature`). The sign-off lines leave the Markdown bodies.
- One shared `.sheet` class styles both the letter body and the home page sample letter.
- `tools/check.js` enforces the new front-matter fields and the body shape.

**Tech Stack:** Eleventy 3.1.2 (Nunjucks), plain CSS, `node:test`, gray-matter.

**Spec:** `docs/superpowers/specs/2026-11-19-letter-typography-design.md`

## Global Constraints

- **Dateline:** shows the publish date only, written like "19 November 2026" (en-GB, UTC). It never shows a place.
- **AI label:** wording unchanged, and it stays above the sheet.
- **Fonts:** stay on Google Fonts. Add only `Caveat:wght@500`.
- **Caveat** is used for the signature only.
- **Token values:**
  - `--muted-strong`: `#4A5163` light, `#BFC4D2` dark.
  - `--ink-blue`: `#2B3A67` light, `#AFC3F0` dark.
  - The dark sheet is the existing `--sheet` (`#1D2539`).
- **Ruled lines:**
  - 32px lines for 17.5px Lora below 40rem; 34px lines for 19px from 40rem up.
  - Paragraph spacing is one line.
  - Rule opacity is about 9% in light mode and about 6% in dark mode.
- **Letter h1:** `clamp(1.7rem, 5vw, 2.2rem)`.
- **Small text:** grey text under 14px (labels, sources, crumbs, the AI label) uses `--muted-strong`.
- **Phone first:** a 16px side gutter, and no horizontal scroll at 320px.
- **Commits and pushes:** commit locally after each task. Push nothing; going live needs the user's go-ahead.
- **Pending letters:** the 4 letters waiting to publish (buddha, thoreau, emerson and chekhov) are migrated too but stay uncommitted, along with `content/quotes.yaml` and `src/journaling-prompts/gratitude.md`. The next "publish letterlight pages" run commits them.

## Review Focus

1. **A sign-off left in the body,** which would show it twice (the body says "Farewell." and so does the sign-off line). Expected: `npm run check` fails it. Pinned by `last paragraph that is a sign-off fails` (Task 2).
2. **A letter that opens without a salutation,** like `epictetus-on-losing-your-job` today, so a 19-word first paragraph would be set in italic. Expected: check fails it, and the migration adds a short salutation. Pinned by `long first paragraph fails` (Task 2).
3. **A letter without `signature`** must fall back to the mentor's name. Pinned by `signature falls back to mentor name` (Task 1).
4. **The longest signature at 320px** ("Marcus Aurelius" or "L. T." in 31px Caveat) must wrap right-aligned, with no overflow. Pinned by the 320px visual check (Task 3).
5. **Dark mode:** rules must stay faint and the ink-blue signature must stay readable on `#1D2539`. Pinned by the dark-mode visual check (Task 3).

---

### Task 1: Template draws dateline, sign-off and signature; migrate 12 letters

**Files:**
- Modify: `eleventy.config.js`, to add the `longDate` filter next to `isoDate` (line 36)
- Modify: `src/_includes/letter.njk`
- Modify: all 12 files in `src/letters/*.md`
- Test: `test/pages.test.js`

**Interfaces:**
- Produces:
  - **Filter:** `longDate(d) -> string`, e.g. `"19 November 2026"`. Uses `toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })`.
  - **Front matter:** `signoff` (string, required on letters); `signature` (string, optional).
  - **Markup inside `.letter-body`:**
    - `<p class="dateline"><time datetime="{{ date | isoDate }}">{{ date | longDate }}</time></p>` comes first.
    - The Markdown body follows.
    - Then `<p class="signoff">{{ signoff }}</p>` and `<p class="signature">{{ signature or mentorData.name }}</p>`.
  - **Classes:** `<article>` gets `class="letter-page"`. `.letter-body` also gets `sheet`, giving `class="letter-body sheet"`.

- [ ] **Step 1: Write the failing tests** in `test/pages.test.js`:

```js
test('letter sheet has dateline, signoff and signature, quote after the sheet', () => {
  const h = letter();
  assert.match(h, /<div class="letter-body sheet">\s*<p class="dateline"><time datetime="2026-11-19">19 November 2026<\/time><\/p>/);
  assert.match(h, /<p class="signoff">Farewell\.<\/p>\s*<p class="signature">Seneca<\/p>\s*<\/div>/);
  assert.doesNotMatch(h, /<p>Farewell\.<\/p>/);
  assert.ok(h.indexOf('class="real-quote"') > h.indexOf('class="signature"'));
  assert.match(h, /<article class="letter-page">/);
});
test('signature falls back to mentor name, or uses front matter signature', () => {
  assert.match(read('letters/seneca-on-grief/index.html'), /<p class="signature">Seneca<\/p>/);
  assert.match(read('letters/tolstoy-on-grief/index.html'), /<p class="signature">L\. T\.<\/p>/);
});
```

- [ ] **Step 2: Run the tests and see them fail.** Run `node --test test/pages.test.js`. Expected: the 2 new tests FAIL (no `dateline`).

- [ ] **Step 3: Add the `longDate` filter and update `letter.njk`** as the Interfaces block says.

- [ ] **Step 4: Migrate the 12 letters.**
  - For each letter, move the trailing sign-off paragraph out of the body. The 9 letters that end with one:
    - "Farewell." (seneca ×2);
    - "Softly, / Lao Tzu";
    - "With you in the quiet, / Rumi";
    - "With affection, / L. T.";
    - "Your friend in the woods, / H. D. T.";
    - "With warm regard, / R. W. E.";
    - "Your devoted / A. Chekhov";
    - "Be well." (marcus-aurelius-on-anxiety).
  - Put the first line in `signoff`. Put the second line in `signature` only when it differs from the mentor's `name`. "Rumi" and "Lao Tzu" match, so they get no `signature`.
  - Give a fitting `signoff` in the mentor's voice to the letters that end on a closing sentence: buddha, epictetus and marcus-aurelius-on-losing-your-job.
  - For marcus-aurelius-on-losing-your-job, move "Be well." from the start of its last paragraph into `signoff`.
  - Wording on the sensitive grief letters (seneca, rumi, tolstoy) moves but is not rewritten. seneca-on-grief keeps "Farewell." as its `signoff`.
  - Insert `signoff:` right after `prompts:` in each file's front matter.

- [ ] **Step 5: Run the tests and see them pass.** Run `npm test`. Expected: all pass, 47 tests.

- [ ] **Step 6: Commit** the 8 live letters only:

```bash
git add eleventy.config.js src/_includes/letter.njk test/pages.test.js \
  src/letters/{seneca-on-losing-your-job,seneca-on-grief,marcus-aurelius-on-losing-your-job,marcus-aurelius-on-anxiety,epictetus-on-losing-your-job,lao-tzu-on-anxiety,rumi-on-grief,tolstoy-on-grief}.md
git commit -m "feat: letters render dateline, sign-off and signature from front matter"
```

---

### Task 2: Check rules for sign-off and body shape; update the publish skill

**Files:**
- Modify: `tools/lib/text.js`, to add `paragraphs`
- Modify: `tools/check.js:12` (`LIMITS`) and the `isLetter` branch (lines 43–56)
- Modify: `.claude/skills/letterlight-publish/SKILL.md`, step 4 "Letter"
- Modify: `src/letters/epictetus-on-losing-your-job.md`, to add a salutation
- Test: `test/check.test.js`

**Interfaces:**
- Consumes: the `signoff` and `signature` front matter from Task 1.
- Produces:
  - `paragraphs(body: string) -> string[]`: the body trimmed and split on blank lines (`/\n\s*\n/`).
  - New `LIMITS` keys: `signoffMax: 40`, `signatureMax: 30`, `salutationMax: 15`, `closingMin: 6`.

- [ ] **Step 1: Update the test helper and write the failing tests** in `test/check.test.js`.
  - Change the `letter()` helper defaults to body `` `Dear friend,\n\n${words(700)}` `` and `signoff: 'Farewell.'`.
  - Add these tests:

```js
test('letter without signoff fails', () => {
  assert.ok(checkPage(letter({ signoff: undefined }), ctx).includes('signoff: missing'));
});
test('signoff over 40 characters fails', () => {
  assert.ok(checkPage(letter({ signoff: 'x'.repeat(41) }), ctx).includes('signoff: 41 characters, max 40'));
});
test('signature over 30 characters fails', () => {
  assert.ok(checkPage(letter({ signature: 'x'.repeat(31) }), ctx).includes('signature: 31 characters, max 30'));
});
test('long first paragraph fails', () => {
  const errs = checkPage(letter({}, `${words(16, 'open')}\n\n${words(700)}`), ctx);
  assert.ok(errs.includes('body: first paragraph is 16 words; start with a short salutation (max 15)'));
});
test('last paragraph that is a sign-off fails', () => {
  const errs = checkPage(letter({}, `Dear friend,\n\n${words(700)}\n\nFarewell.`), ctx);
  assert.ok(errs.includes('body: ends with a short line ("Farewell."); move it to signoff'));
});
```

  - The existing `ctx` in that file is reused; the name is whatever the file already uses for the context object.

- [ ] **Step 2: Run the tests and see them fail.** Run `node --test test/check.test.js`. Expected: the 5 new tests FAIL.

- [ ] **Step 3: Add `paragraphs` and the five letter rules** to `checkPage`, using the exact error strings from the tests.
  - The closing rule fires when the last paragraph has fewer than `closingMin` words.
  - The quoted text in that message is the last paragraph, trimmed.

- [ ] **Step 4: Fix any letter that fails the new rules,** then rerun the check.
  - Add a short salutation to `epictetus-on-losing-your-job.md` in Epictetus's voice, at most 15 words, e.g. "Epictetus to a student who has lost his post."
  - Run `npm run check`. Expected: `ok: 15 page(s) pass` (12 letters and 3 guides). If another letter fails, fix its opening or closing in the same way.

- [ ] **Step 5: Update the publish skill.** In `.claude/skills/letterlight-publish/SKILL.md` step 4:
  - Add `signoff` (and optional `signature`) to the letter front-matter list.
  - Replace the line "Open and close the way that mentor would (Seneca: … "Farewell.")." with: "Open with a short salutation in the mentor's voice (max 15 words). Do not end the body with a sign-off or the mentor's name; put the sign-off in `signoff` (Seneca: "Farewell.") and initials, if the mentor signs that way, in `signature`."

- [ ] **Step 6: Run everything.** Run `npm test && npm run check && npm run build`. Expected: all pass.

- [ ] **Step 7: Commit.**

```bash
git add tools/ test/check.test.js .claude/skills/letterlight-publish/SKILL.md src/letters/epictetus-on-losing-your-job.md
git commit -m "feat: check requires signoff, a short salutation and no sign-off left in the body"
```

---

### Task 3: Sheet styles, home sample, fonts and contrast

**Files:**
- Modify: `src/assets/site.css`:
  - the theme blocks (lines 2–29);
  - the `.letter` sample block (about lines 84–103);
  - the letter-page rules (about lines 151–160);
  - remove `.letter-body p:last-child { font-style: italic; }`.
- Modify: `src/_includes/head.njk:16` (Google Fonts URL)
- Modify: `src/index.njk:31-43` (sample letter)
- Test: `test/pages.test.js`

**Interfaces:**
- Consumes: the classes from Task 1 (`sheet`, `dateline`, `signoff`, `signature`, `letter-page`).
- Produces:
  - CSS tokens `--muted-strong`, `--ink-blue` and `--rule-line` in all three theme blocks.
  - A `.sheet` component with a `--line` custom property: 32px by default, 34px at `min-width: 40rem`.

- [ ] **Step 1: Write the failing tests** in `test/pages.test.js`:

```js
test('home sample letter uses the sheet and an ink signature', () => {
  const h = read('index.html');
  assert.match(h, /<article class="letter sheet">/);
  assert.match(h, /<p class="signoff">Yours,<\/p>\s*<p class="signature">Seneca<\/p>/);
});
test('Caveat 500 is loaded with the other fonts', () => {
  assert.match(letter(), /fonts\.googleapis\.com\/css2\?[^"]*family=Caveat:wght@500/);
});
test('contrast and ink tokens exist in light, dark and forced-dark themes', () => {
  const css = read('assets/site.css');
  for (const t of ['--muted-strong', '--ink-blue', '--rule-line']) {
    assert.equal((css.match(new RegExp(`${t}:`, 'g')) || []).length, 3, t);
  }
});
```

- [ ] **Step 2: Run the tests and see them fail.** Run `node --test test/pages.test.js`. Expected: the 3 new tests FAIL.

- [ ] **Step 3: Update the markup.**
  - In `head.njk`, append `&family=Caveat:wght@500` to the fonts URL.
  - In `index.njk`:
    - set `class="letter sheet"`;
    - give "My friend," `class="salute"`;
    - give the next paragraph `class="drop"`;
    - replace `<p class="sign">Yours, Seneca</p>` with `<p class="signoff">Yours,</p>` followed by `<p class="signature">Seneca</p>`.

- [ ] **Step 4: Write the CSS,** using the Global Constraints values. Use the approved mockup `.superpowers/brainstorm/14386-1795113118/content/letter-page-v2.html` as the visual reference.
  - **Tokens:** add the three tokens to `:root`, the dark media block and `[data-theme="dark"]`. `--rule-line` is `rgba(176,115,48,.09)` light and `rgba(217,155,82,.06)` dark.
  - **`.sheet`:**
    - background `var(--sheet)`, padding, a two-layer soft shadow, 3px radius;
    - Lora at 17.5px with `line-height: var(--line)`, rising to 19px from 40rem;
    - a repeating-gradient rule every `var(--line)`, aligned to the text lines;
    - `p { margin: 0 0 var(--line) }`.
  - **Text styles:**
    - `.dateline`: right-aligned, italic, `--muted-strong`, about 0.85em.
    - Salutation: `.letter-body > .dateline + p` and `.sheet .salute` are italic.
    - Drop cap: `.letter-body > .dateline + p + p::first-letter` and `.sheet .drop::first-letter` are Lora 600, about 3 lines tall, `var(--amber)`, floated left.
    - `.signoff`: right-aligned, italic, `margin-bottom: 0`.
    - `.signature`: `font: 500 31px/1.1 "Caveat", "Segoe Script", "Bradley Hand", cursive`, `color: var(--ink-blue)`, right-aligned, `overflow-wrap: anywhere`.
  - **Letter-page rules:**
    - `.letter-page h1 { font-size: clamp(1.7rem, 5vw, 2.2rem); }`.
    - The quote box gets an amber left border and a light `--amber-wash` background, replacing the full border.
    - `.ai-label`, `.crumbs`, `.real-quote .source`, `.letter time` and `.waitlist-note` use `--muted-strong`.
  - **Home sample:** remove the old `.letter` sample rules that `.sheet` now covers (background, border, font and line-height).

- [ ] **Step 5: Run the tests and see them pass.** Run `npm test`. Expected: all pass.

- [ ] **Step 6: Visual check on the phone.**
  - Run `npx @11ty/eleventy --serve --port 8080` in the background.
  - Ask the user to open these pages in Chrome, in light mode and then with the phone in dark mode:
    - `http://localhost:8080/letters/seneca-on-losing-your-job/`
    - `http://localhost:8080/letters/tolstoy-on-grief/`
    - `http://localhost:8080/`
  - Expected:
    - the ruled lines sit under the text all the way down;
    - the drop cap spans about 3 lines;
    - the signature is readable and doesn't overflow;
    - the dark-mode rules are faint;
    - no horizontal scroll.
  - Fix anything the user reports, then stop the server.

- [ ] **Step 7: Commit.**

```bash
git add src/assets/site.css src/_includes/head.njk src/index.njk test/pages.test.js
git commit -m "feat: paper-sheet letter typography with ink signature and stronger small text"
```

---

### Task 4: Final verification and handoff

- [ ] **Step 1: Run everything.** Run `npm test && npm run check && npm run build`. Expected: all pass. `check` should report 15 pages.
- [ ] **Step 2: Report the sensitive-letter changes.**
  - Show the user the before and after endings for seneca-on-grief, rumi-on-grief and tolstoy-on-grief.
  - These letters were approved, so their endings changed shape but not wording.
- [ ] **Step 3: Ask before pushing.**
  - Ask the user for the go-ahead to push `main`.
  - On yes: `git push`, `gh run watch`, then check that `https://letterlight.app/letters/seneca-on-losing-your-job/` returns 200 and contains `class="signature"`.

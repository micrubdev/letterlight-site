---
name: letterlight-publish
description: Write, check and publish new SEO pages (mentor letters and journaling guides) for letterlight.app, or report site stats. Use when the user says "publish letterlight pages", "new letterlight pages", "publish N letterlight pages", "letterlight dry run", or "letterlight stats".
---

# letterlight-publish

Runs one publishing cycle for letterlight.app in this session. Claude writes the pages itself. Design: `docs/superpowers/specs/2026-11-19-seo-content-engine-design.md`.

Work in `~/letterlight-site` on branch `main`. A push to `main` deploys through `.github/workflows/deploy.yml`.

## Rules that never bend

- At most **10 pages dated the same day**. `npm run check` enforces this; never get around it.
- Every letter says it is an imagined AI letter (the layout adds the label). Never present AI text as the mentor's real words.
- A quote goes into `content/quotes.yaml` only after `node tools/verify-quote.js <id>` exits 0 against a public-domain source. Never invent or paraphrase a quote.
- Mentors with `publicDomain: false` in `src/_data/mentors.json` get no quote.
- **Sensitive** problems (`sensitive: true` in `src/_data/problems.json`) and **flagged** pages are never pushed without the user's explicit yes in this conversation.

## "publish [N] letterlight pages" (default N = 3)

1. **Sync.** `git checkout main && git pull --ff-only`. Count pages already dated today: `grep -l "^date: $(date -u +%F)" src/letters/*.md src/journaling-prompts/*.md | wc -l`. Lower N so the total stays ≤ 10. If that leaves 0, say so and stop.
2. **Pick topics.** Take the first N rows with `status: queued` from `content/topics.yaml`. Keep about 4 letters for every guide. If fewer than 10 rows are still queued after this run, append new ones, each with a realistic search `query`. Use existing problems where you can; a new problem needs a row in `problems.json` (set `sensitive` honestly). List the added topics in the report.
3. **Quote** (public-domain letters only). Pick a short passage by that mentor that fits the problem, from a public-domain translation on Wikisource (or another public-domain URL). Add it to `content/quotes.yaml` (`id, mentor, text, work, location, translation, source_url, verified`), then run `node tools/verify-quote.js <id>`. If it fails, fix the text to match the source exactly, or pick another passage.
4. **Write** each page by following the existing pages' front matter exactly:
   - **Letter:** `src/letters/<mentor>-on-<problem>.md` with `mentor, problem, title (≤60), description (120–160), quote: {id}, prompts (exactly 3), signoff (≤40), signature (optional, ≤30), sensitive, date (today)`.
     - Body: 600–1,100 words in the mentor's `voice` from `mentors.json`, addressed to one reader with this problem, concrete and practical.
     - Open with a short salutation in the mentor's voice (max 15 words). Do not end the body with a sign-off or the mentor's name; put the sign-off in `signoff` (Seneca: "Farewell.") and initials, if the mentor signs that way, in `signature`.
     - Do not quote the mentor inside the body; the verified quote shows separately.
   - **Guide:** `src/journaling-prompts/<problem>.md` with `problem, title, description, sensitive, date`.
     - Body: a short intro, a "## How to use these prompts" section, then 15–30 prompts as `-` items under `##` groups. If the title starts with a number, it must equal the prompt count (the check enforces this).
   - Titles and descriptions use the words people type into search (the topic's `query`).
   - Then run the `avoid-ai-writing` skill on each body, editing in place.
5. **Check.** Run `npm run check -- <new paths>`.
   - If a page fails, rewrite it once and check again.
   - If it still fails, delete the page file, set its topic to `status: flagged` with the errors in `note`, and go on.
6. **Build.** `npm test && npm run build` must pass.
7. **Publish.**
   - Pages that passed and are not sensitive: set their topics to `status: published`, then `git add` the pages, `content/` and any data changes. Commit `content: <n> new pages (<slugs>)` with the Co-Authored-By line, and `git push`. Watch the deploy with `gh run watch` and check each new URL returns 200 (`curl -sI https://letterlight.app/<slug>/`).
   - Sensitive pages: show the user the title, description and full body in this conversation. Push them only after a yes. On a no, keep the file uncommitted or apply their edits.
8. **Report** in under 10 lines:
   - the new live URLs;
   - pages waiting for approval or flagged, and why;
   - topics left in the queue, and any topics added;
   - the waitlist total (see stats).

### Dry run

If the request says "dry run", do steps 1–6 and stop: no commit, no push, no change to `topics.yaml` statuses. Report the files written and the check results.

## "letterlight stats"

1. Count pages: `ls src/letters/*.md | wc -l` and `ls src/journaling-prompts/*.md | wc -l`.
2. Get the waitlist:

   ```bash
   curl -s -H "Authorization: Bearer $(cat ~/.config/letterlight/admin_token)" "$(node -p "require('./src/_data/site.json').apiBase")/v1/admin/waitlist"
   ```

   Show `total`, and the top 5 pages from `byPage`. Never print the email rows unless the user asks.
3. Remind the user that Google clicks and positions are in Search Console (search.google.com/search-console, property letterlight.app).

# Letterlight content engine: design

Date: 2026-11-19 · Status: draft for approval

## Intent

Bring people to letterlight.app from Google search and turn them into beta waitlist
signups. The Play Store listing is not live yet. Pages are written with generative AI,
the site is built with Eleventy, and the process is semi-automatic: it runs in a Claude
Code session when the user asks, and asks the user only when it really needs them.

## Goals

- Pages that can reach Google's first page for long-tail searches about life problems,
  mentors and journaling.
- Every page leads to the beta waitlist.
- One request ("publish letterlight pages", in the terminal or from Telegram) runs the whole
  cycle: pick topics, write, check, publish, report.

## Non-goals

- No timer or cron job. A run starts only when the user asks (user's decision).
- English only. The site dropped Russian and Hebrew on 2026-10-26.
- No comparison or "best AI journal" pages for now (user chose mentor letters plus guides).
- No ads, no email campaigns, no Play Store work.

## Anti-goals (failure even if it technically works)

- Thin, near-duplicate or mass-produced pages. Google's "scaled content abuse" policy
  demotes or de-indexes them, which would hurt the whole domain.
- Made-up quotes, or real quotes credited to the wrong person.
- AI letters that could be mistaken for real historical writing.
- Content that reads like medical or crisis advice without pointing to real help.
- Publishing dozens of pages at once.

## Approaches considered

| | Approach | Trade-off | Outcome |
|---|---|---|---|
| A | Scripted pipeline: Claude writes the pages, scripts check them, push to deploy | Predictable, cheap, reuses GitHub Pages and Telegram | **Chosen** |
| B | A scheduled cloud Claude agent that picks topics and opens pull requests | Smarter topic choice, but costs more, varies more and is harder to check | Rejected; may come back later as a topic-picking step |
| — | Running the pipeline from the phone on a timer | Only works while the phone is on | Dropped |

The user picked A, then changed where it runs: **inside this Claude Code session, on
request**, not on a GitHub Actions timer. So Claude in the session writes the pages
directly: no generation script and no API key in CI. GitHub Actions only builds and
deploys after a push.

## Content (user's decisions)

- **About 80% mentor letters.** One mentor writes to one real problem, e.g. "Marcus
  Aurelius on a job you hate" or "Rumi on grief after a breakup".
- **Changed 2026-11-25:** new pages are about 80% letters and 20% facts pages (`/facts/<mentor>/`,
  true stories with checked sources). No new journaling guides; the live ones stay.
- **About 20% journaling guides.** Prompt lists for searched topics (anxiety, grief,
  gratitude, burnout), each linking to the matching letters.
- **Call to action:** beta waitlist signup on every page.

### What each letter page contains (my call)

1. A title and meta description written the way people phrase the problem in a search.
2. A letter of 600–1,100 words in the mentor's voice, using the voice notes from the
   app's `lib/mentors.dart` so the site sounds like the app.
3. A visible label: *"An imagined letter, written with AI in the voice of Seneca. Not
   his own words."* Real quotes are marked separately.
4. One real quote with its source (work, chapter or letter number). It must come from
   the vetted quote bank (below).
5. Three journaling questions about the problem.
6. Links to the same problem answered by other mentors, to other letters from this
   mentor, and to the related guide.
7. A waitlist form, plus a line on what the app does.
8. For heavy topics (grief, depression, self-harm, abuse, addiction), a crisis-help box
   built from the app's `lib/helplines.dart` data.

Guides contain an intro, 15–30 prompts in groups, a short "how to use these" section,
links to related letters, and the waitlist form.

### Mentors (my call)

- **Launch with public-domain mentors only:** Marcus Aurelius, Seneca, Epictetus,
  Socrates, Confucius, Lao Tzu, the Buddha, Rumi, Maimonides, Hillel, Tolstoy,
  Dostoevsky, Chekhov, Emerson, Thoreau. Their quotes come from public-domain translations.
- **Later:** mentors whose works are still in copyright (Jung, Akhmatova, Leah Goldberg,
  some Rabbi Nachman translations) get letters without a quote block. "Future You" is not
  used on the site.

## Site (my calls)

- **Build:** Eleventy 3. Source goes in `src/`, output in `_site/`. The existing
  `index.html` and `privacy.html` are ported into one shared layout and stylesheet with
  the current brand colours. `privacy.html` keeps its exact URL because the Play Store
  listing will point to it.
- **URLs:**
  - `/letters/<mentor>-on-<problem>/`, e.g. `/letters/seneca-on-losing-your-job/`
  - mentor hubs at `/mentors/<mentor>/`
  - problem hubs at `/problems/<problem>/`, showing every mentor on one problem
  - guides at `/journaling-prompts/<topic>/`
- **SEO basics:**
  - canonical URLs;
  - `sitemap.xml` and `robots.txt`;
  - an RSS feed;
  - JSON-LD (`Article` and `BreadcrumbList`);
  - Open Graph tags;
  - breadcrumbs;
  - fast pages: no JavaScript except the form, and fonts as today.
- **Deploy:** a push to `main` runs a GitHub Action that builds Eleventy and deploys it to
  GitHub Pages ("GitHub Actions" source instead of "branch"). `CNAME` and the HTTPS
  setting stay as they are.
- **Hidden files:** `docs/` and `.claude/` are outside `src/`, so they are never published.

## Waitlist (my calls)

- **Endpoint:** a new `POST /v1/waitlist` route on the existing `letterlight-api`
  Cloudflare Worker (`~/mentora/server`).
- **Storage:** email, page path, timestamp, stored in a new SQLite table on the existing
  Durable Object. Duplicates are ignored.
- **Protection:**
  - CORS limited to `https://letterlight.app`;
  - a hidden honeypot field;
  - a simple email format check;
  - a per-IP rate limit.
- **Reading the list:** `GET /v1/admin/waitlist` behind the existing `ADMIN_TOKEN` returns
  the list and counts per page.
- **No confirmation email** for now, since there is no mail service.
- **Privacy policy:** `privacy.html` gets a section saying what the waitlist stores, why,
  and how to be removed.

## The run (on request)

A project skill, `.claude/skills/letterlight-publish/`, in the site repo defines the run.
The user says "publish letterlight pages" (optionally a number), in the terminal or over
Telegram:

1. **Pick topics.** Take the next N items from `content/topics.yaml`. The default is 3
   pages per run, and at most 10 pages a day. If fewer than 10 are queued, add new
   topics, each with the search phrasing it targets, and say which were added.
2. **Write.** Each page is a Markdown file with front matter: `type`, `mentor`,
   `problem`, `title`, `description`, `quote`, `prompts`, `sensitive`, `date`. Then a
   pass with the `avoid-ai-writing` skill.
3. **Check** with `npm run check`, a Node script that fails on:
   - missing or invalid front matter, or a title or description length outside the limits;
   - word count outside the range;
   - a quote that is not word-for-word in `content/quotes.yaml`;
   - more than 35% shingle overlap with any existing page (Jaccard);
   - phrases on a banned-phrase list;
   - a duplicate slug;
   - a page with `sensitive: true` and no crisis box.

   A failing page gets one rewrite. If it fails again, it is flagged.
4. **Build** with `npm run build` on the phone to make sure Eleventy builds and the links
   resolve.
5. **Publish.** Pages that pass and are not sensitive are committed and pushed to `main`.
   Sensitive or flagged pages are shown to the user in the same channel the request came
   from, and are pushed only after approval.
6. **Report:** the new URLs, anything flagged, the topics left in the queue, and the
   waitlist count from the admin endpoint.

**Quote bank (`content/quotes.yaml`):** each quote has its text, author, work,
location, translation and a public-domain source URL (e.g. Project Gutenberg or Sefaria).
A quote goes in only after its text is found word for word in the fetched source. The
bank is built once at setup for the launch mentors and grows as runs need it.

**Launch batch:** about 15 pages: 12 letters over 4 problems × 3 mentors, plus 3 guides.
That's enough for the hubs and cross-links to work. After that, 3–5 pages per run.

## Where the user is needed

- **Once:**
  - approve the plan;
  - approve deploying the Worker change;
  - switch Pages to deploy from GitHub Actions (or let Claude do it with `gh`);
  - verify letterlight.app in Google Search Console with a DNS TXT record at Porkbun,
    then submit `sitemap.xml`.
- **Per run:** only sensitive or flagged pages.
- **As wanted:** ask "letterlight stats" for page count and waitlist signups. Google
  clicks are viewed in Search Console. Pulling them in automatically is a later step.

## Left to the builder

- Eleventy config, layouts and CSS details, keeping the current look.
- Exact check thresholds and the banned-phrase list. Tune them on the launch batch.
- The seed topic list and which 4 launch problems to start with. Prefer problems with
  clear search demand: job loss, grief, anxiety, loneliness.
- Rate-limit numbers and the waitlist table schema.

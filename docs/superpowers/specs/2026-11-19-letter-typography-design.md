# Letter typography: design

Date: 2026-11-19 · Status: draft for approval · Size: small change

## Intent

The site looks plain. Letters should feel like real letters on paper. The user picked
look A from the mockups (a cream paper sheet) with look C's handwritten signature. The
approved mockup is `.superpowers/brainstorm/*/content/letter-page-v2.html` (not committed).

## Goals

- Letter pages read like a letter on paper: a sheet, a dateline, a drop cap, an italic
  sign-off and the mentor's name in ink handwriting.
- AI text and real quotes stay visibly separate.
- Comfortable reading on a phone in both light and dark mode.

## Non-goals

- New wording, layout or navigation.
- Self-hosting fonts. They stay on Google Fonts, as today.
- Restyling guides, hubs or the privacy page beyond shared fixes (small-text colour,
  heading sizes).

## Anti-goals

- Anything that makes an AI letter look like a genuine historical document. That means
  no invented place names, no fake postmarks, and the AI label stays above the sheet.
- A handwriting font used for anything longer than the signature.
- Ruled lines that drift out of step with the text or show through in dark mode as
  heavy stripes.

## Approaches

| | Approach | Trade-off | Outcome |
|---|---|---|---|
| A | The layout renders the dateline, sign-off and signature from front matter (`signoff`, optional `signature`). Sign-off lines are removed from the letter bodies. | Every letter ends the same way, and the check can enforce it. Needs a one-time edit to 13 letters. | **Chosen (my call; the user handed over the how)** |
| B | CSS only: style the last one or two paragraphs of each body as the sign-off. | No content edits. But the letters end in different shapes (some with "Farewell.", some with initials, some with nothing), so the result breaks unpredictably. | Rejected |
| C | Markers inside the Markdown (an attributes plugin) for the sign-off paragraphs. | Precise, but adds a dependency, and every writer and every run must remember the syntax. | Rejected |

## Design

**Sheet (letter pages and the home page sample letter).**
- `.letter-body` becomes a cream sheet (`--sheet`): padding, a soft two-layer shadow,
  3px corner radius.
- Faint ruled lines come from a repeating gradient that matches a fixed line height:
  - 32px lines for 17.5px Lora on phones;
  - 34px lines for 19px from 40rem up.
- Paragraph spacing is one line, so the text stays on the rules.
- Dark mode: the sheet is `#1D2539`, with rules at about 6% opacity.

**Dateline.** Right-aligned italic text in the muted colour at the top of the sheet,
showing the page's `date` as "19 November 2026". It is the publish date only, never a
place.

**Drop cap.** The first letter of the first body paragraph after the salutation: Lora
600, about 3 lines tall, in amber. The salutation is the first paragraph, set in italic.

**Sign-off and signature.**
- A new required front-matter field `signoff` (e.g. "Farewell,", "With affection,",
  "Be well.") is rendered right-aligned in italic.
- Below it comes the signature: the mentor's name, or front matter `signature` if given
  (e.g. "L. T."), in Caveat 500 at about 31px, in an ink blue: `#2B3A67` in light mode,
  `#AFC3F0` in dark mode.
- Caveat is added to the existing Google Fonts link, weight 500 only.

**Real quote.** It moves after the sheet into its own box: amber left border, a light
wash, an "In his/her own words" label, the quote in italic Lora, and the source line in
Inter. The ellipsis rule for quotes that start mid-sentence stays.

**AI label.** Same wording and place, above the sheet. Its colour goes from `--muted` to
a darker token, `--muted-strong` (`#4A5163` light, `#BFC4D2` dark), so it passes WCAG AA
contrast at 12.5–14px.

**Shared fixes.**
- The letter-page h1 goes up to `clamp(1.7rem, 5vw, 2.2rem)`.
- Small grey text (labels, sources, crumbs) uses `--muted-strong` where it is under 14px.

## Content migration (one time)

For each of the 13 letters:
- remove the trailing sign-off lines from the body ("Farewell.", "With affection, / L. T.",
  and so on);
- move them into `signoff` and, where it differs from the mentor's name, `signature`;
- leave letters that end on a closing sentence unchanged and add a fitting `signoff`.

`tools/check.js` gets a new rule: letters need a `signoff` of at most 40 characters.

The `letterlight-publish` skill's writing step adds `signoff` to the front matter and
says the body must not end with a sign-off.

## Tests (for the plan)

- A built letter has `.dateline` showing its date and `.signoff`, and `.signature` shows
  the mentor's name, or `signature` when given.
- The quote box sits outside `.letter-body`.
- `checkPage` fails a letter with no `signoff`.
- The home page sample letter uses the same sheet classes.
- Visual check on the phone in light and dark mode before pushing.

## Left to the builder

- Exact shadow values, padding and wash colour.
- Whether the rules use `background-attachment: local` or the gradient offset, as long
  as they line up with the text.
- Which `signoff` fits each letter, in the mentor's voice.

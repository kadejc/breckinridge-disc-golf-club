# Breckinridge DGC — Club Site

A full club website for a disc golf league ("Breckinridge DGC Weekly Mini"), deployed to GitHub
Pages at: https://kadejc.github.io/breckinridge-disc-golf-club/

The site started as a single stats dashboard built iteratively in Anthropic's Cowork mode
(dozens of small feature/bugfix requests over one long session), then grew into a multi-page
site (About, Resources, Stats, Gallery, Contact, Events, Membership, Rules & Etiquette, News) in
Claude Code. This file exists so a fresh Claude Code session in this repo has full context
without the user having to re-explain everything.

## Site structure

Multi-page static site, shared header/footer, **one page per dropdown nav item** (not one page
per top-level section — the user explicitly asked for each dropdown option to be its own page):

- `index.html` — home/landing page.
- `stats.html` — the original stats dashboard (see "Stats dashboard build system" below). Its
  own internal tab strip (Top Winners, Player Lookup, Hole Stats, Player Table, Head-to-Head,
  Course Records, Past Results) sits below the shared global header. The Stats dropdown items
  and Events → Past Results deep-link into this page's tabs (`stats.html#playertable` etc.)
  rather than getting their own page — they're views into one shared data app, not separate
  content, so splitting them into files would mean duplicating the embedded dataset per page.
- `about/`, `resources/`, `gallery/`, `contact/`, `events/`, `membership/`, `rules-etiquette/`,
  `news/` — one subdirectory per top-level nav item, one `.html` file per dropdown sub-item
  inside it (e.g. `about/who-we-are.html`, `about/course-info.html`, ...). Dropdown items that
  are pure external redirects (Book the course, Local Rules, PDGA Rules, Apply to help, Social
  Media, Tournament Schedule) have no page — the nav link goes straight to the external URL.
- `shared/site.css` — single source of truth for CSS: color variables, base styles, the
  dropdown nav, footer, and generic page components (`.hero`, `.page-section`, `.card`,
  `.placeholder-note`, `.data-table`, `.photo-grid`, etc). Marketing pages link it externally;
  `stats.html`/`breckinridge_artifact.html` inline it (see below) since those must stay
  self-contained.
- `shared/site-header.html` / `shared/site-footer.html` — the global header (brand + 9-item
  dropdown nav) and footer, shared by every page including the stats dashboard. Internal links
  use a `{{ROOT}}` placeholder (e.g. `{{ROOT}}about/who-we-are.html`) since the same partial is
  used at two different depths: root-level pages (`index.html`, `stats.html`) need `''`,
  one-level-deep content pages (`about/*.html` etc.) need `'../'`. `scripts/build-site.js`
  computes the right prefix per output page from its path depth; `scripts/build.js` always
  substitutes `''` since stats.html/breckinridge_artifact.html are root-level. **If you add a
  new internal link to the header/footer, it needs the `{{ROOT}}` prefix too, or it'll 404 on
  every content page (which are all one level deep).**
- `site/**/*.html` — content-source fragments, one per dropdown sub-item, mirroring the output
  layout (`site/about/who-we-are.html` → `about/who-we-are.html`). Each file starts with a
  `<!-- title: Page Title -->` comment (parsed by the build script). `site/home.html` builds to
  `index.html`. Cross-page links between content fragments are written directly as `../other-
  section/page.html` (fixed depth-1 sibling paths — safe since every content page is exactly
  one level deep).
- `scripts/build-site.js` (run via `npm run build:site`) — walks `site/` recursively, wraps
  each fragment with the shared header/footer (with `{{ROOT}}` resolved for that page's depth),
  and writes it to the mirrored path at the repo root.
- **Always edit `site/**/*.html` + `shared/*`, then run `npm run build:site` (or `npm run build`
  for everything).** Never hand-edit the generated root/subdirectory HTML pages.

**Placeholder content:** many dropdown sub-items were stood up with a `.placeholder-note`
("... coming soon") since the user hadn't supplied content yet as of this writing — e.g. Admins,
Sponsors, FAQ, Club Bylaws, payout tables, Newsletter Signup, Calendar, Membership Tiers/Dues,
Renew, Member Perks, Course Etiquette, Announcements, Tournament Recaps, and the Course Records
stats tab. Check with the user before assuming any of these still need content — search for
`placeholder-note` across `site/**/*.html` and `src/body.html` to find them all.

## Stats dashboard build system (added in Claude Code, post-handoff)

The single-file-with-embedded-JSON-blob approach below was a Cowork constraint, not a real
requirement. The source has since been split into `src/` and is reassembled by a build script:

- `src/head.html`, `src/tail.html`, `src/head-scripts.html` — HTML shell fragments (everything
  outside the `<style>`/main `<script>` blocks).
- `src/style.css` — base CSS. Contains a `/*__CHAT_CSS__*/` marker at the point where chat-tab
  CSS gets spliced in for the Cowork build.
- `src/chat.css` — chat-tab-only CSS rules.
- `src/body.html` — main HTML body (nav + tab panels), with `<!--__CHAT_NAV__-->`,
  `<!--__CHAT_PANEL__-->`, and `__CHAT_FILTER_NOTE__` markers for the chat-only bits.
- `src/chat-panel.html` — the "Ask the Data" tab panel markup.
- `src/app.js` — the main JS logic, with a `/*__CHAT_JS_HOOK__*/` marker at the point where the
  chat JS gets spliced in.
- `src/chat.js` — the chat-tab-only JS (the `window.cowork.askClaude(...)` call and its DOM
  wiring). Cowork-only; never gets included in the public build.
- `scripts/build.js` (run via `npm run build:stats`) — reads `src/*` + `shared/site.css` +
  `shared/site-header.html` + `shared/site-footer.html` + `artifact_data.json` and writes both
  `breckinridge_artifact.html` (Cowork build, chat included) and `breckinridge_public.html` +
  `stats.html` (public build, chat stripped, identical content to each other). The shared
  header/footer/CSS get inlined (not linked) into both, since the Cowork build must stay a
  single self-contained file.

**Always edit `src/*` and `artifact_data.json`, then run `npm run build:stats`.** Never
hand-edit the three generated HTML files — they get overwritten.

**Gotcha if you touch `scripts/build.js`:** don't pass a string containing `$&`, `` $` ``, `$'`,
or `$<n>` as the second argument to `String.prototype.replace()` — JS treats those as special
replacement patterns even when the *search* argument is a plain string, and `src/chat.js`
contains literal `$'` substrings (e.g. `'totalWinnings:$'+Math.round(...)`) that will silently
corrupt the output if passed as a raw replacement string. Always wrap injected content in a
function: `str.replace(marker, () => injectedContent)`.

## Files in this handoff

- `breckinridge_artifact.html` — **generated**, do not hand-edit. Cowork-compatible build.
  Includes an "Ask the Data" chat tab that calls `window.cowork.askClaude(...)`, a Cowork-only
  API. **This tab only works inside Cowork** and must stay stripped out of anything deployed
  publicly.
- `breckinridge_public.html` / `stats.html` — **generated**, do not hand-edit. The public
  deploy build: identical to the master except the chat tab (button, panel, JS, CSS) is
  removed. `stats.html` is what's linked from the rest of the site and pushed to GitHub Pages.
- `artifact_data.json` — the full dataset, source of truth, embedded verbatim into both HTML
  builds as `const RAW = {...};`. Compact array format (see "Data format" below).
- `breckinridge_mini.db` — SQLite database with the same data in normalized relational form.
  Was the intermediate store during data cleaning; not read by the build.
- `breckinridge_mini_export.json` — a flat export of the DB, kept in sync as a secondary
  backup/debugging copy. Also not read by the build.

All three data stores (`artifact_data.json`, `.db`, `_export.json`) were kept in sync by hand
during the Cowork session. **`artifact_data.json` is the one that actually matters** since it's
what the build embeds — the other two are historical/convenience copies and can be considered
secondary or retired if that's simpler.

## Data format (`artifact_data.json`)

Top-level shape: `{"course": [...], "events": [...]}`

- `course`: 18 entries, one per hole: `[hole_number, distance_ft, par]`
- `events`: one entry per logged event:
  `[slug, title, date, card_count, cards]`
  - `cards`: one entry per card/group: `[card_number, start_hole, start_time, players]`
    - `players`: one entry per player's round on that card:
      `[position, name, division, to_par, hole_scores(18 ints or null), total_strokes, rating, career_rounds, pay]`
      - `rating` is frequently `null` (only populated for some events/players).
      - **Known historical bug (already fixed):** 999 rows across 24 events from
        2024-03-12 to 2024-10-01 had `rating` incorrectly duplicating `total_strokes`.
        These were nulled out. If new scraped data ever shows `rating === total_strokes`
        for every player in an event, that's this same bug recurring — null it out again.

The HTML's JS re-derives every stat (wins, win %, averages, Mini Rating, etc.) from this raw
array on page load / filter change. There is no server — everything is client-side.

## How the site is built (no scraper script currently exists)

Data was collected by manually driving a Chrome browser session against UDisc's event
leaderboard pages (`udisc.com/events/.../manage/leaderboard`) and scraping the DOM per event.
**There is no reusable scraper script** — this was done ad hoc, event by event, inside Cowork.
This is the single biggest thing worth fixing in Claude Code: write a proper Playwright script
that logs into UDisc (or hits whatever API/pages are accessible) and pulls new events
automatically, appending them to `artifact_data.json` in the format above.

## Known quirks / deliberate design decisions (don't "fix" these by accident)

- **Player Table horizontal scrollbar is rendered at the top** via a pure-CSS trick: the
  scroll container (`#playerTableWrap`) is flipped with `transform: scaleY(-1)`, and the
  `<table>` inside it is flipped back the same way. This moves the browser's native
  scrollbar to the top edge with zero JavaScript. Do not "simplify" this back to a JS-measured
  scrollbar — an earlier JS-based approach was tried and failed silently in production
  (passed automated tests but didn't visually work — jsdom/headless testing can't catch
  real-browser scrollbar rendering bugs).
- **Player Table sort UI** (click header → arrow indicator → click again to reverse) is a
  hand-rolled pattern, intentionally *not* using Grid.js or any table library. Grid.js was
  used originally and caused a long chain of bugs (header truncation, sort clicks being
  intercepted, sort breaking after re-render) — it was fully removed. Hole Stats uses the
  same hand-rolled sort pattern; treat it as the reference implementation.
- **Mini Rating** (Player Table column) = average of the best 8 rounds among a player's most
  recent 20 *rated* rounds (rounds where `rating` is non-null), sorted by date descending to
  pick the 20, then by rating descending to pick the top 8. This is separate from the older,
  simpler "Avg rating" stat box on the Player Lookup tab — don't merge them.
- **Season classification**: a round counts as "In Season" if its event had ≥25 players
  logged (`SEASON_THRESHOLD = 25`), with a manual override map (`SEASON_OVERRIDES`) for edge
  cases — e.g. the 2025-09-30 event is forced to "Off Season" despite having 38 players
  (explicit call from the league organizer).
- **Division merges already applied** in the data: MMPO→MPO, FA1→FA3, MA40/AM→MP40/MA1 (see
  git history / prior conversation for exact mapping), "free"→"Free". Player identity merges
  applied: "Spaceballz"→"Ace Wall", "Hayden and Jara"→"Hayden Frederiksen". "George Sheaff" and
  "Caleb Roberts" were removed entirely (bad/duplicate data).
- **Global filters** (Year multi-select, Season single-select, Division multi-select) apply
  across every tab and are computed fresh on every change via `refreshAllScopedTabs()`.
- **Stats page has two nav bars stacked**: the shared global site header (sticky, brand +
  9-item dropdown nav, from `shared/site-header.html`) sits on top, and the dashboard's own
  tab strip (`.stats-subheader` in `src/body.html`/`src/style.css`) — Top Winners, Player
  Lookup, Hole Stats, Player Table, Head-to-Head, Course Records, Past Results — sits below it,
  not sticky. The original single-header design (brand + tabs combined, styled after
  ridgeviewgc.com) is gone; tabs still scroll horizontally on narrow/mobile screens instead of
  wrapping.
- **Deep-linking into stats tabs**: `stats.html#playertable` (etc.) activates that tab on load
  via `activateTab()` in `src/app.js`; a `hashchange` listener also re-activates the tab if
  you're already on the page and click a Stats/Past Results dropdown link. The "Events" tab's
  `data-tab` is still `events` (unchanged) even though its label was renamed to "Past Results" —
  don't break that link contract, `shared/site-header.html` and `site/events.html` both point
  at `stats.html#events`.

## Deployment

Repo: the user's existing GitHub repo behind `kadejc.github.io/breckinridge-disc-golf-club/`.
GitHub Pages is configured to deploy from a branch, serving whatever is at `index.html` in the
repo root — that's now the home page (built by `build-site.js`), with the stats dashboard at
`stats.html`. Deploys are still manual: run `npm run build`, commit the generated root HTML
files, push. A good next Claude Code task: wire up a real `git` workflow (commit + push) and/or
a GitHub Action that runs the build automatically on push, rather than committing generated
files by hand each time.

## Suggested next steps in Claude Code

1. ~~Split `breckinridge_artifact.html` into separate source files.~~ Done — see "Build system"
   above (`src/*` + `scripts/build.js`).
2. ~~Keep a build step that produces both deployment targets from split source.~~ Done —
   `npm run build`.
3. ~~Install Playwright and add smoke tests.~~ Done — `tests/smoke.spec.js` (run via
   `npm test`), covers: home page loads clean, every nav dropdown opens and every internal link
   resolves 200, stats.html tabs render + hash deep-linking, course-info video embeds, course
   map image loads, mobile hamburger nav. Uses `scripts/serve.js` (a tiny dependency-free static
   server) instead of `python -m http.server` so it works the same in CI as locally. This was
   impossible in the Cowork sandbox (no headless browser available, network-restricted) and is
   exactly the kind of gap that caused at least one shipped bug to go unnoticed until the user
   reported it.
4. UDisc scraper: see `scripts/scrape-udisc.js` if it exists — check its header comment for
   status, since it needs the user's real UDisc login to fully verify and may still be
   unverified/best-effort.
5. Wire up a real `git` workflow (commit + push) for deploys — see "Deployment" above; still
   manual as of this writing.
6. Fill in the many `.placeholder-note` content sections (see "Site structure" above) as the
   user supplies content.
7. Gallery/Ace Gallery photos: user decided (2026-07-17) **not** to import UDisc's 35 course
   photos — they're community-submitted via UDisc's "Add photos" feature with no visible
   attribution/license, so republishing them carries copyright risk. `gallery.html` stays a
   placeholder until the user supplies photos they actually have rights to.

# Breckinridge DGC — Weekly Mini Stats

A stats dashboard for a disc golf league ("Breckinridge DGC Weekly Mini"), built as a single
self-contained HTML file and deployed to GitHub Pages at:
https://kadejc.github.io/breckinridge-disc-golf-club/

This project was built iteratively in Anthropic's Cowork mode (dozens of small feature/bugfix
requests over one long session). This file exists so a fresh Claude Code session in this repo
has full context without the user having to re-explain everything.

## Files in this handoff

- `breckinridge_artifact.html` — the master/source file. Includes an "Ask the Data" chat tab
  that calls `window.cowork.askClaude(...)`, a Cowork-only API. **This tab only works inside
  Cowork** and must stay stripped out of anything deployed publicly.
- `breckinridge_public.html` — the deployed derivative. Identical to the master except the
  chat tab (button, panel, JS, CSS) is removed. **This is the file that gets renamed to
  `index.html` and pushed to GitHub Pages.**
- `artifact_data.json` — the full dataset, embedded verbatim into both HTML files as
  `const RAW = {...};`. Compact array format (see "Data format" below).
- `breckinridge_mini.db` — SQLite database with the same data in normalized relational form.
  Was the intermediate store during data cleaning; not read by the HTML files directly.
- `breckinridge_mini_export.json` — a flat export of the DB, kept in sync as a secondary
  backup/debugging copy. Also not read directly by the HTML files.

All three data stores (`artifact_data.json`, `.db`, `_export.json`) were kept in sync by hand
during the Cowork session. **Going forward, `artifact_data.json` is the one that actually
matters** since it's what's embedded in the shipped HTML — the other two are historical/
convenience copies and can be considered secondary or retired if that's simpler.

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
- **Header/nav**: styled after ridgeviewgc.com's site — sticky top header, brand on the left,
  uppercase tab nav on the right, tabs scroll horizontally on narrow/mobile screens instead of
  wrapping to multiple lines.

## Deployment

Repo: the user's existing GitHub repo behind `kadejc.github.io/breckinridge-disc-golf-club/`.
GitHub Pages is configured to deploy from a branch, serving whatever is at `index.html` in the
repo root. Until now, deploys have been manual: regenerate `breckinridge_public.html` → rename
to `index.html` → upload via the GitHub web UI. A good early Claude Code task: wire up a real
`git` workflow (commit + push) and consider a GitHub Action that rebuilds `index.html` from
`artifact_data.json` + a template automatically, rather than committing one giant generated
file by hand each time.

## Suggested first steps in Claude Code

1. Read this file (you're doing that now).
2. Split `breckinridge_artifact.html` into separate `index.html` / `style.css` / `app.js` /
   `data.json` files (or similar) — the current single-file-with-embedded-JSON-blob approach
   was a Cowork constraint (self-contained artifact requirement), not a real requirement, and
   makes every edit a fragile string-replace against a 370KB blob.
2b. Keep a build step (even a trivial one) that produces the Cowork-compatible single-file
   `breckinridge_artifact.html` *and* the public `breckinridge_public.html` (chat tab stripped)
   from the split source, so both deployment targets stay in sync automatically instead of by
   hand.
3. Install Playwright and add a basic visual-regression/smoke test (load the page, check each
   tab renders, screenshot at a mobile viewport width) — this was impossible in the Cowork
   sandbox (no headless browser available, network-restricted) and is exactly the kind of gap
   that caused at least one shipped bug to go unnoticed until the user reported it.
4. Consider building the UDisc scraper described above so new events don't require manual
   Cowork sessions to add.

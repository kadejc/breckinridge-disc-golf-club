# Breckinridge DGC — Club Site

A full club website for a disc golf league ("Breckinridge DGC Weekly Mini"), deployed to GitHub
Pages at: https://kadejc.github.io/breckinridge-disc-golf-club/

The site started as a single stats dashboard built iteratively in Anthropic's Cowork mode
(dozens of small feature/bugfix requests over one long session), then grew into a multi-page
site (About, Resources, Stats, Gallery, Contact, Events, Rules & Etiquette, News — **no
Membership**, see below) in Claude Code. This file exists so a fresh Claude Code session in this
repo has full context without the user having to re-explain everything.

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
- `about/`, `resources/`, `gallery/`, `contact/`, `events/`, `rules-etiquette/`, `news/` — one
  subdirectory per top-level nav item, one `.html` file per dropdown sub-item inside it (e.g.
  `about/who-we-are.html`, `resources/course-info.html`, ...). Dropdown items that are pure
  external redirects (Book the course, Local Rules, PDGA Rules, Apply to help, Social Media,
  Tournament Schedule) have no page — the nav link goes straight to the external URL. **There is
  no Membership section** — the user had it removed 2026-07-17 (dropdown item, all 3 sub-pages,
  and `membership/`/`site/membership/` deleted). Rules & Etiquette also lost its Course
  Etiquette sub-item the same day (removed by request) — that dropdown now only has the two
  external links (Local Rules, PDGA Rules), so `rules-etiquette/` has no internal page of its
  own either. `resources/strike-tracker.html` was added the same day (Resources dropdown) —
  structure only, no strike rules or data supplied yet.
  **Two page merges (also 2026-07-17, by request):** About's old `course-info.html` was merged
  into Resources' old `course-map.html`, becoming a single `resources/course-info.html` (hole
  table + flyover videos + course map image + scorecard button, all one page) — the About
  dropdown lost its "Course Info" item entirely, and Resources' "Course Map/Scorecard" item was
  relabeled "Course Info" pointing at the merged page. Separately, About's old `admins.html` was
  merged into `about/who-we-are.html` (Admins content now sits in its own `<h2>Admins</h2>`
  section below the club description on the same page) — the About dropdown lost its standalone
  "Admins" item. If you're looking for either of those old files, they don't exist anymore;
  don't recreate them as separate pages without checking with the user first.
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

**Placeholder content still outstanding** (as of 2026-07-17): FAQ, Club Bylaws, Newsletter
Signup, Announcements, the strike *rules* (what earns one, what happens after N of them — the
Strike Tracker's actual strike data is real, see below), the bio text for each Admin (headshots
are placeholders too — real photos need to be supplied), the description/logo for each Sponsor,
and the photo for each Ace Gallery entry (its "Playing with" field is real now, see below).
Search for `placeholder-note` across `site/**/*.html` and `src/body.html` to find them all; that
search should return exactly these. **News no longer has a Tournament Recaps item** — removed by
request 2026-07-17, News now only has Announcements.

**No longer placeholders**: Admins (Kade Capps, Sean Temple, Ace Wall — now a section on
`about/who-we-are.html`, see the page-merge note above; headshot + bio *slots* exist, but only
names are real, bios/photos still pending), Sponsors (Replay Sports Gear, Hooligan Discs — same:
slots exist, logos/descriptions pending; "Become a Sponsor" copy about donating a weekly
closest-to-the-pin prize is real), Our Payout Tables (pulled from
`Breck_Payout_Calculator_Advanced.xlsx`, see below, now also has an interactive calculator), the
Course Records stats tab (real computation, see "Course Records manual exclusions" below), Ace
Gallery (all 17 known aces populated with hole/name/date/amount/playing-with — only the per-ace
photo is still a placeholder; see "Ace Gallery playing-with data" below for how that was
derived), Calendar (real month-grid, see "Events Calendar" below), and Strike Tracker (real 2026
strike data, see "Strike Tracker data" below — the strike *rules* are still undocumented).

## Player name shortening (privacy)

Every player name shown anywhere on the stats dashboard (Top Winners, Player Lookup incl.
autocomplete, Hole Stats, Player Table, Head-to-Head, Past Results, Course Records) and on the
Ace Gallery is displayed as **"First L."** — first name plus last initial — never a full last
name. This was an explicit user request (2026-07-17), for player privacy.

- **Stats dashboard**: `computeDisplayNames()` in `src/app.js` builds a `DISPLAY_NAME_MAP`
  (full name → short form) once from `PLAYER_NAMES` at load. `dn(fullName)` looks it up. Full
  names stay the canonical key for every filter/lookup/sort — only rendered *text* goes through
  `dn()`. If you add a new place that prints a player's name, wrap it in `dn(...)` or it'll leak
  the full name; grep `dn(` in `src/app.js` for every existing call site as a checklist.
- **Collision handling**: if two different players would both shorten to the same "First L."
  (e.g. two "Kevin B."s), both get progressively more letters of their last name (2, 3, ...)
  until they're distinguishable, via `parsePlayerName()` + the `len` loop in
  `computeDisplayNames()`. Verified against the real ~508-player roster (2026-07-17) — resolves
  every case except one: `"John Stammreich"` and `'John "Stamm I Am" Stammreich"'` share an
  identical last name and can never be disambiguated by this scheme. That pair is almost
  certainly the same real person recorded twice under slightly different scraped name strings —
  it's a data-quality issue (like the documented `career_rounds` bug and the identity merges
  below), not a bug in the shortening logic. Worth merging in `artifact_data.json` at some point,
  the same way `"Spaceballz"`→`"Ace Wall"` was merged.
- **Ace Gallery** (`site/gallery/ace-gallery.html`) is a static page, not driven by
  `src/app.js`, so its names were shortened by hand to match the same "First L." convention —
  they're not run through `dn()` since there's no shared JS between the two. If you add a new
  ace, shorten the name the same way by hand (and watch for first-name collisions among the ace
  list specifically, not just the full roster).
- **Autocomplete** (Player Lookup, Head-to-Head inputs): suggestions display the short name, but
  matching is lenient — typing either the full name or the short form's text will find a player
  (`wireAutocomplete()` in `src/app.js` checks both). Picking a suggestion sets the visible input
  text to the short name but still passes the *full* name to the lookup callback.
- **Admins are exempt** — `about/admins.html` shows full names (Kade Capps, Sean Temple, Ace
  Wall) since they're intentionally public figures with their own bio section, not anonymized
  attendees. If the "shorten everyone" rule was meant to include Admins too, that's a scope call
  the user should confirm — it wasn't asked about explicitly.

## Total money paid out counter

`renderMoneyPaidOut()` in `src/app.js` renders a banner (`#moneyPaidOutBanner` in
`src/body.html`) near the top of `stats.html`, above the tab strip, visible regardless of which
tab is active. **Not** filtered by the year/season/division toggles — it's always the
all-time grand total. Two parts, added together:

1. **Event payouts, excluding 2024** — summed live from `ROUNDS[].pay` via the existing
   `parsePay()`. 2024 is excluded because the user said that year's payout data isn't reliably
   tracked (disclaimer text says so on the banner); they may estimate/backfill it later.
2. **Ace payouts, all years** — a hardcoded constant, `ACE_TOTAL_PAID = 6621` (17 aces,
   `ACE_COUNT = 17`), *not* computed from any data file, since aces aren't in `ROUNDS` at all
   (they're a separate pot, unrelated to event placement). **This must be updated by hand in
   `src/app.js` every time a new ace is added to `site/gallery/ace-gallery.html`** — the two
   have no shared source of truth. Search `ACE_TOTAL_PAID` and `ACE_COUNT` when updating.

**Also duplicated on the homepage** (`site/home.html`, 2026-07-17, user request: "put the payout
total under the hero section"): since `home.html` is a standalone static page with no access to
`src/app.js`'s bundle, it has its **own** copy of the same computation (`parsePay`,
`ACE_TOTAL_PAID`, `ACE_COUNT`) in an inline `<script>`, fetching `artifact_data.json` client-side
instead of having it embedded. **Three places now need updating in sync whenever a new ace is
added**: `src/app.js`, `site/home.html`, and `site/gallery/ace-gallery.html`'s own tally banner
(`.tally-figure` text + the aces-count figure) — there's still no shared source of truth between
them, same caveat as above just one file wider.

## Payout Calculator + Tuesday live-count automation

`resources/payout-tables.html` has two parts now: an interactive calculator (added first) and
the original static reference tables (unchanged, still pulled from
`Breck_Payout_Calculator_Advanced.xlsx`'s `MPO_Pay`/`MP40_Pay`/`MA1_Pay`/`MA3-FA3_Pay`/`Side_Pay`
sheets).

- **Calculator**: `PAYOUT_CALC_DATA` (embedded JSON, same 5 sheets, keyed `mpo`/`mp40`/`ma1`/
  `ma3fa3`/`side`) plus a division `<select>` + player-count `<select>` that look up and render
  the payout-by-position table for that exact combo. Regenerate `PAYOUT_CALC_DATA` the same way
  as the static tables (openpyxl over the 5 `*_Pay` sheets) if the spreadsheet changes.
  **Gotcha that already bit this once**: don't build this page's JS via a Python f-string/
  heredoc without checking the output — an escaped apostrophe in copy text (`tonight's`)
  produced *unescaped* JS and silently broke the whole script (page loaded fine, dropdowns just
  did nothing, no console error visible without checking `new Function(scriptText)` directly).
  Always validate generated `<script>` blocks parse (`node -e "new Function(...)"` or just load
  the page and check the dropdowns actually populate) before trusting a codegen pass.
- **Tuesday live-count auto-populate**: the user asked for the calculator to auto-fill from
  that week's actual turnout. Pipeline:
  - `scripts/scrape-live-count.js` (`npm run scrape:live-count`) — finds the Weekly Mini event
    whose date matches *today* (`America/Chicago`) on the public league schedule, counts players
    per division on its `?view=cards` leaderboard (no login needed, same as
    `scripts/scrape-udisc.js`), maps UDisc division codes to the calculator's slugs
    (`MPO`→`mpo`, `MP40`→`mp40`, `MA1`→`ma1`, `MA3`/`FA3`→`ma3fa3` combined; `Free` and `Side`
    are intentionally not mapped — Side has no UDisc division label and Free isn't in the
    payout tables), and writes `data/live-event-count.json`.
  - `.github/workflows/tuesday-live-count.yml` — **a real scheduled GitHub Action**, runs every
    Tuesday at 23:30 UTC (6:30 PM Central during CDT; drifts to 5:30 PM during CST since cron
    doesn't handle DST — accepted, not a bug), and **auto-commits + pushes**
    `data/live-event-count.json` to `main` if it changed. This is standing automation with
    unattended write access to the repo — the user asked for this exact behavior explicitly
    (2026-07-17), but be aware of it before adding more scheduled workflows. Also has
    `workflow_dispatch` for manual test runs from the Actions tab.
  - The calculator page `fetch()`es `../data/live-event-count.json` on load; if it has data for
    the currently-selected division, it auto-fills the player-count dropdown and shows a note
    (`#calcAutoNote`). Switching divisions re-checks and re-fills if that division has live data
    too. Manually changing the player-count dropdown is treated as a deliberate override and
    hides the note. A placeholder `data/live-event-count.json` (all-null/empty) ships so the
    fetch always succeeds even before the Action has ever run.
  - **Known limitation**: if the check runs before anyone's started entering scores for the
    night (e.g. right at 6:00 PM), the Cards view has zero rows and this writes zero counts.
    There's no reliable earlier signal for a drop-in league like this — UDisc's
    "Participants/Registered" count (visible even pre-event, verified 2026-07-17) reflects
    app RSVPs, not actual turnout for a league where people just show up and get added to
    cards, so it wasn't used.

## Course Records manual exclusions (2026-07-17)

`src/app.js` has two hardcoded exclusion mechanisms in `renderCourseRecords()`, both by
explicit user request, both scoped to the *records board only* — excluded rounds still count
everywhere else (Top Winners, Player Table, Past Results, etc.):

- `COURSE_RECORD_EXCLUSIONS` — an array of `{name, date, div}` matched exactly against a round
  before it's eligible for the records list. Currently excludes Jaxon E's 2025-08-19 MA3 round
  and Sam Persons' 2026-05-05 MA3 round ("didn't count for other reasons" — not specified further
  by the user). Match on all three fields, not just name, so only that one round is excluded if
  the same player has other qualifying rounds.
- `COURSE_RECORD_HIDDEN_DIVISIONS` — a `Set` of division names never shown on the records board
  at all. Currently just `Free`.

If more exclusions come up, add to these two constants rather than filtering ad hoc inside the
render function.

## Events Calendar (2026-07-17)

`events/calendar.html` — real month-grid calendar (Sun-start, 6 rows), replacing what was a
placeholder. Prev/Next buttons cycle by month (`view.setMonth(±1)` + re-render); no server, all
client-side.

- **Data sources**, both fetched client-side on page load (not embedded, unlike `stats.html`):
  - `../artifact_data.json` — every past event (`slug`/`title`/`date` pulled straight out of the
    same array the stats dashboard uses; the rest of that ~380KB file, i.e. all the per-round
    score data, is ignored here). Rendered as `.calendar-event-chip.past`.
  - `../data/upcoming-events.json` — events found on UDisc's schedule with no scores yet.
    Rendered as `.calendar-event-chip.upcoming`. Produced by `scripts/scrape-udisc.js`, which now
    writes this file as a side effect on *every* run (dry-run included — it's a transient cache,
    not the historical record) alongside its existing artifact_data.json-updating behavior:
    whichever new-to-us events it finds with zero recorded players get collected into this file
    instead of being silently skipped like before. Run `npm run scrape` (or the `--write`
    variant) to refresh it; nothing currently does this on a schedule (unlike the Tuesday
    live-count check) — could be added to the same GitHub Action if the user wants the calendar
    to self-update instead of requiring a manual scrape.
- Both fetches degrade gracefully if missing/unreachable (calendar just renders with fewer/no
  chips; only the `artifact_data.json` failure shows a `#calStatus` note, since that one's the
  primary data source).
- **Timezone gotcha already fixed once**: don't compute the calendar grid's day keys or "is this
  today" check with `date.toISOString().slice(0,10)` on a locally-constructed `Date` — that
  converts through UTC and shifts the date by one for any visitor browsing from a timezone ahead
  of UTC (local midnight is still "yesterday" in UTC there). Use the local `toIso()` helper
  already in the file (built from `getFullYear()`/`getMonth()`/`getDate()`) instead.

## "Next upcoming event" widget (2026-07-17)

`site/home.html` and `site/contact/join-us.html` each have their own copy of the same small
inline script: fetch `data/upcoming-events.json` (the same file the Calendar reads, produced by
`scripts/scrape-udisc.js`), find the earliest entry whose date is today or later, and replace a
paragraph's placeholder text (`#nextEventText`) with "Next Weekly Mini: `<Weekday, Month Day>` at
6:00 PM at Breckinridge Park...". User request: "just put our upcoming event with information"
on both pages, replacing the old generic "we meet every Tuesday" copy. If the fetch fails or
there's no future event in the file, the original static fallback text stays in place (the
`<p>`'s initial content) — no error state, it just doesn't get replaced. Note the relative fetch
path differs by page depth: `data/upcoming-events.json` from root-level `home.html`,
`../data/upcoming-events.json` from one-level-deep `contact/join-us.html` — same
`{{ROOT}}`-style depth gotcha as the shared header, just not templated since there are only two
copies. If a third page needs this, consider extracting it instead of copy-pasting a third time.

## Ace Gallery playing-with data (2026-07-17)

Each ace's "Playing with" list was derived by searching `artifact_data.json` for a round
matching that player's name and date, then reading who else was on the same card. Two of the 17
didn't match on an exact name+date search and needed manual digging (documented here in case a
future ace needs the same treatment):
- **Hector Gonzalez, 2025-03-11** — stored in the data as just `"Hector G"` (already
  abbreviated at the source, unrelated to this site's own name-shortening feature) — matching
  needs to tolerate that, not just full "Gonzalez".
- **Andrew Fred Harris, 2024-08-12** — no event exists on that exact date; the nearest Weekly
  Mini was 2024-08-13, and an "Andrew Harris" (unique in the whole roster) played that day. Used
  that round on the assumption the user's date was off by one — flagged here in case that
  assumption turns out wrong and needs correcting.

Names in the "Playing with" lists were shortened by hand to match the site's "First L."
convention (see "Player name shortening" above) using the *actual* `computeDisplayNames()`
output for collision-correctness (e.g. `Jonathan Johnson` → `Jonathan Jo.`, not the naive
`Jonathan J.`, because there are multiple Jonathans in the roster) — not eyeballed. If more aces
get added, recompute with the same algorithm rather than guessing at the right number of
letters; see `computeDisplayNames()` in `src/app.js` for the reference implementation.

## Strike Tracker data (2026-07-17)

`resources/strike-tracker.html` has real 2026 strike data (user-supplied, verbatim): MA1 (Erik
H., Jacob G., 1 strike each), MA3 (Ryne B., Wayne C., Sean G., Ethan V., Dawson B., JP S., Sam
P., 1 strike each). Rendered as one `❌` per strike (per the user: "Each x is a strike"), no
divisions currently have more than one. **The strike *rules* are not documented anywhere** —
what earns a strike, how many before a consequence, etc. — don't invent them if asked what a
strike means; that's still an open question for the user. Names are shortened by hand the same
way as the Ace Gallery (see above), not run through `dn()` since this is a static page with no
access to `src/app.js`.

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
      - **`career_rounds` data quality note (found 2026-07-17, not fixed):** 87.6% of the
        rows with a non-null `career_rounds` have `career_rounds === total_strokes` — almost
        certainly the original manual scraping process mistakenly duplicated the same "Round"
        column value into both fields, rather than pulling an actual lifetime-rounds stat from
        wherever that was supposed to come from. Harmless in practice since `career_rounds` is
        never read anywhere in `src/app.js` (verified via `grep -n '\.career\b' src/app.js` —
        no matches), but don't trust it as real data, and don't "fix" it by inventing a
        replacement source without asking the user first.

The HTML's JS re-derives every stat (wins, win %, averages, Mini Rating, etc.) from this raw
array on page load / filter change. There is no server — everything is client-side.

## How the site is built

New events used to require a manual Cowork browser session, scraping each event's leaderboard
DOM by hand. As of 2026-07-17 there's a real scraper:

- `scripts/scrape-udisc.js` (run via `npm run scrape`, or `npm run scrape -- --write` to
  actually persist changes — plain `npm run scrape` is a dry run that only prints what it
  would add). Fetches `udisc.com/leagues/breckinridge-dgc-kwxbSd/schedule` (**public, no login
  needed** — verified live; despite the CLAUDE.md history below mentioning "manage/leaderboard"
  URLs, the `?view=cards` leaderboard view and the league schedule are both publicly viewable),
  diffs against `artifact_data.json`'s existing event slugs, and scrapes each new one's
  `?round=1&view=cards` page into the documented format.
- Filters out events that shouldn't be in the dataset, mirroring
  `breckinridge_events_worklist.json`'s `exclusion_reasons`: substitute-course events (title
  matches `shawnee|b.b. owen|moved to`), doubles/dubs format, and canceled events. Also skips
  events with zero recorded players (upcoming/unplayed) and non-event links picked up by the
  schedule-page selector (e.g. `/events/add`, `/events/report`).
- **Limitations, read before trusting its output:**
  - Only handles single-round events (`round=1`). This league has always been single-round so
    far — a multi-round event needs round=2, round=3, ... handling added.
  - `career_rounds` is always written as `null` for newly-scraped rows — it isn't available on
    the Cards leaderboard view. See the data-quality note above for why that's arguably more
    correct than what's already in the file, not less.
  - Division merges: only applies the unambiguous ones (`MMPO`→`MPO`, `FA1`→`FA3`,
    `free`→`Free`). Logs a warning and leaves `MA40`/`AM` as-is, since CLAUDE.md's own
    division-merge note says the exact `MA40/AM`→`MP40/MA1` mapping needs checking against git
    history — don't have the scraper guess at it.
  - Player identity merges (e.g. `Spaceballz`→`Ace Wall`) are **not** applied automatically —
    those still need a human/Claude Code pass over new names before merging duplicates.
  - Verified 2026-07-17 by scraping a known event (`...-yslfQL`, already in the dataset) and
    diffing the result field-by-field against the stored copy — matched exactly aside from the
    known `career_rounds` gap above. Re-verify similarly after any UDisc DOM changes break it.

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
  don't break that link contract, `shared/site-header.html` and `site/events/calendar.html`
  both point at `stats.html#events`.
- **Past Results (Events tab) groups by division, not by card**: clicking an event expands its
  results grouped into one table per division (sorted `MPO, MA1, MA3, MA40, MP40, FA1, FA3, AM,
  free/Free/FREE`, via `compareDivisions()` in `src/app.js`), each sorted by to-par. It used to
  group by physical card/tee-time group instead, which mixed divisions together and made it
  impossible to see a clean per-division leaderboard — changed 2026-07-17 by request. Reuse
  `compareDivisions()` for any other division-ordering need instead of re-declaring the order
  array (`DIVISIONS` itself is now just `[...unique divisions].sort(compareDivisions)`).
- **Course Records tab** (`renderCourseRecords()` in `src/app.js`) shows the top 5 best rounds
  by to-par, per division, respecting the same global year/season/division filters as every
  other tab. **For every division except MPO, each player's chronologically-first round ever
  played in that specific division is excluded** from record consideration — a debut round
  isn't representative, and this was an explicit user rule (2026-07-17). That "first round"
  lookup always scans the *full, unfiltered* `ROUNDS` array (a player's real debut doesn't
  depend on which year/season filter happens to be active), even though the records list itself
  respects the filters. Don't apply this exclusion to MPO.
- **Our Payout Tables** (`resources/payout-tables.html`) data was pulled from
  `C:\Users\kadec\OneDrive\Documents\Breck_Payout_Calculator_Advanced.xlsx` (outside this repo,
  on the user's machine — not a URL, not committed) on 2026-07-17: the `MPO_Pay`, `MP40_Pay`,
  `MA1_Pay`, `MA3-FA3_Pay`, and `Side_Pay` sheets, each a lookup table of payout-by-position for
  2-50 (2-30 for Side) players. Baked into the page as static HTML (client-pays-by-count doesn't
  change often); if the user updates the spreadsheet, regenerate by re-reading those 5 sheets
  with openpyxl and rebuilding the same `payout-tabs`/`payout-panel` structure — don't hand-edit
  the generated table rows. "Side" is an optional side-pot division; its exact rules weren't in
  the spreadsheet and weren't asked about, so the page doesn't explain it beyond the label.
- **Course Info hole videos are click-to-play in a modal**, not always-embedded. Originally all
  18 flyover videos were embedded inline in a grid (heavy — 18 iframes on page load); changed
  2026-07-17 to a single shared modal (`#holeVideoOverlay` in `site/about/course-info.html`)
  triggered by clicking a hole number in the hole table (`.hole-video-btn`, carries
  `data-video-id`/`data-hole`). Closing the modal clears the iframe's `innerHTML` (not just
  hides it) specifically so playback actually stops instead of continuing off-screen.
- **Person/logo placeholder pattern** (`.headshot-placeholder`, `.logo-placeholder` in
  `shared/site.css`): a dashed-border box with "Photo/Logo coming soon" text, used on
  `about/admins.html` and `about/sponsors.html`. Real images replace these divs with an `<img>`
  when the user supplies them — don't invent placeholder image files.

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
   resolves 200, stats.html tabs render + hash deep-linking, division-grouped Past Results,
   Course Records renders, course-info hole-video modal opens/closes and stops playback, course
   map image loads, mobile hamburger nav. Uses `scripts/serve.js` (a tiny dependency-free static
   server) instead of `python -m http.server` so it works the same in CI as locally. This was
   impossible in the Cowork sandbox (no headless browser available, network-restricted) and is
   exactly the kind of gap that caused at least one shipped bug to go unnoticed until the user
   reported it.
4. ~~Build the UDisc scraper.~~ Done — `scripts/scrape-udisc.js` (`npm run scrape`), see "How
   the site is built" above for what it handles and its limitations. No login turned out to be
   needed; verified against real data 2026-07-17.
5. ~~Wire up a real `git` workflow (commit + push) for deploys.~~ Done — repo is on GitHub
   Pages (main branch, root), first full-site push was 2026-07-17. Still no CI: `npm run build`
   + commit + push is manual. A GitHub Action that runs the build (and ideally `npm test`) on
   push would close that gap.
6. Fill in the many `.placeholder-note` content sections (see "Site structure" above) as the
   user supplies content.
7. Gallery/Ace Gallery photos: user decided (2026-07-17) **not** to import UDisc's 35 course
   photos — they're community-submitted via UDisc's "Add photos" feature with no visible
   attribution/license, so republishing them carries copyright risk. `gallery/photos.html` and
   `gallery/ace-gallery.html` stay placeholders until the user supplies photos they actually
   have rights to.
8. Run `npm run scrape -- --write` periodically (or wire it into a scheduled GitHub Action) to
   pick up new Weekly Mini events automatically instead of running it by hand.

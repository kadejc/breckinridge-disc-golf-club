// Scrapes new Breckinridge DGC Weekly Mini events from UDisc and appends them to
// artifact_data.json in the documented format (see CLAUDE.md "Data format"). Also refreshes
// data/upcoming-events.json (events found with no scores yet), used by the "next upcoming
// event" widgets on home.html and contact/join-us.html -- that part runs even in dry-run mode,
// since it's a transient cache, not the historical record.
//
// No login/credentials needed: this league's schedule and per-event "Cards" leaderboard view
// (?view=cards) are both public. If a future league ever needs auth, read credentials from
// UDISC_EMAIL / UDISC_PASSWORD env vars -- never hardcode or ask the user to paste them in chat.
//
// Usage:
//   node scripts/scrape-udisc.js            # dry run: prints what would be added, writes nothing
//   node scripts/scrape-udisc.js --write    # actually appends to artifact_data.json
//
// Known limitations (see CLAUDE.md for more):
//   - Only handles single-round events (round=1). This league has always been single-round so
//     far; a multi-round event would need round=2, round=3, ... handling added.
//   - `career_rounds` (9th field per player) is not available on the Cards leaderboard view and
//     is always written as null for newly-scraped rows. It's already null for ~19% of existing
//     rows and isn't read anywhere in src/app.js, so this doesn't break anything -- it's just
//     data the original manual Cowork scraping session apparently pulled from somewhere else
//     that this script doesn't replicate.
//   - Division merges: only the unambiguous ones from CLAUDE.md are applied automatically
//     (MMPO->MPO, FA1->FA3, "free"->"Free" casing). MA40/AM->MP40/MA1 is left as-is with a
//     warning, since CLAUDE.md itself says the exact mapping needs checking against git history
//     -- don't guess at it here.
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const LEAGUE_SLUG = 'breckinridge-dgc-kwxbSd';
const DATA_PATH = path.join(__dirname, '..', 'artifact_data.json');
const UPCOMING_PATH = path.join(__dirname, '..', 'data', 'upcoming-events.json');
const WRITE = process.argv.includes('--write');

const DIVISION_MERGES = { MMPO: 'MPO', FA1: 'FA3', free: 'Free' };
const AMBIGUOUS_DIVISIONS = new Set(['MA40', 'AM']);

// Matches breckinridge_events_worklist.json's exclusion_reasons: substitute-course events,
// doubles/dubs format, and canceled events don't belong in the Weekly Mini singles dataset.
const EXCLUDE_TITLE_PATTERNS = [
  { re: /shawnee|b\.?b\.?\s*owen|moved to/i, reason: 'location (substitute course)' },
  { re: /dubs|doubles/i, reason: 'doubles format' },
  { re: /cancel/i, reason: 'canceled' },
];
// UDisc event slugs always end in a short mixed-case id, e.g. "...-yslfQL". Filters out
// non-event links picked up by the a[href^="/events/"] selector (e.g. "/events/add",
// "/events/report").
const EVENT_SLUG_RE = /-[a-zA-Z0-9]{6}$/;

function parseToPar(text) {
  const t = text.trim();
  if (t === 'E') return 0;
  if (t === '' || t === '-') return null;
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
}

function parseIntOrNull(text) {
  const t = text.trim();
  if (t === '' || t === '-') return null;
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
}

function parseEventDate(text) {
  // "Jul 14, 2026" -> "2026-07-14"
  const d = new Date(text + ' UTC');
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

async function scrapeEvent(page, slug) {
  await page.goto(`https://udisc.com/events/${slug}/leaderboard?round=1&view=cards`, { waitUntil: 'networkidle' });

  const title = (await page.locator('h1').first().textContent()).trim();
  const dateText = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('main *'))
      .filter((el) => el.children.length === 0 && /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test((el.textContent || '').trim()));
    return els.length ? els[0].textContent.trim() : null;
  });
  const date = dateText ? parseEventDate(dateText) : null;

  const cardData = await page.evaluate(() => {
    const els = document.querySelectorAll('h1,h2,h3,h4,h5,h6,table');
    const cards = [];
    let currentHeading = null;
    els.forEach((el) => {
      if (/^H[1-6]$/.test(el.tagName)) {
        if (/Hole \d+/.test(el.textContent)) currentHeading = el.textContent.trim();
      } else if (el.tagName === 'TABLE') {
        const rows = Array.from(el.querySelectorAll('tbody tr')).map((tr) =>
          Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim())
        );
        cards.push({ heading: currentHeading, rows });
      }
    });
    return cards;
  });

  const unknownDivisions = new Set();
  const cards = cardData.map((card, i) => {
    const m = card.heading && card.heading.match(/Hole (\d+) - (.+)/);
    const startHole = m ? parseInt(m[1], 10) : null;
    const startTime = m ? m[2].trim() : null;
    const players = card.rows.map((cells) => {
      // [Pos, Name, Div, ToPar, H1..H18, Rating, TotalStrokes, Pay]
      const [pos, name, div, toPar, ...rest] = cells;
      const holeScores = rest.slice(0, 18).map(parseIntOrNull);
      const [ratingText, totalText, payText] = rest.slice(18, 21);
      let division = div.trim();
      if (DIVISION_MERGES[division]) division = DIVISION_MERGES[division];
      else if (AMBIGUOUS_DIVISIONS.has(division)) unknownDivisions.add(division);
      return [
        pos.trim(),
        name.trim(),
        division,
        parseToPar(toPar),
        holeScores,
        parseIntOrNull(totalText),
        parseIntOrNull(ratingText),
        null, // career_rounds: not available from this view, see file header comment
        payText && payText.trim() !== '' ? payText.trim() : null,
      ];
    });
    return [i + 1, startHole, startTime, players];
  });

  if (unknownDivisions.size) {
    console.warn(`  ! ${slug}: ambiguous division code(s) found, left as-is: ${[...unknownDivisions].join(', ')} -- check CLAUDE.md's division-merge note before trusting these rows`);
  }

  return [slug, title, date, cards.length, cards];
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const existingSlugs = new Set(data.events.map((ev) => ev[0]));

  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log(`Fetching schedule for league ${LEAGUE_SLUG}...`);
  await page.goto(`https://udisc.com/leagues/${LEAGUE_SLUG}/schedule`, { waitUntil: 'networkidle' });
  const scheduleSlugs = await page.evaluate(() =>
    Array.from(new Set(
      Array.from(document.querySelectorAll('a[href^="/events/"]'))
        .map((a) => a.getAttribute('href').replace(/^\/events\//, '').split('/')[0])
    ))
  );

  const newSlugs = scheduleSlugs.filter((slug) => EVENT_SLUG_RE.test(slug) && !existingSlugs.has(slug));
  console.log(`Schedule has ${scheduleSlugs.length} link(s); ${newSlugs.length} look like new events.`);

  const newEvents = [];
  const upcomingEvents = []; // {slug, title, date} -- for data/upcoming-events.json
  for (const slug of newSlugs) {
    console.log(`Scraping ${slug}...`);
    try {
      const event = await scrapeEvent(page, slug);
      const [, title, date, cardCount] = event;
      const totalPlayers = event[4].reduce((sum, c) => sum + c[3].length, 0);

      const excluded = EXCLUDE_TITLE_PATTERNS.find(({ re }) => re.test(title));
      if (excluded) {
        console.log(`  x skipped "${title}" (${date}): ${excluded.reason}`);
        continue;
      }
      if (totalPlayers === 0) {
        console.log(`  x skipped "${title}" (${date}): no scores yet (upcoming or unplayed)`);
        if (date) upcomingEvents.push({ slug, title, date });
        continue;
      }

      console.log(`  -> "${title}" (${date}), ${cardCount} card(s), ${totalPlayers} player(s)`);
      newEvents.push(event);
    } catch (err) {
      console.warn(`  ! failed to scrape ${slug}: ${err.message}`);
    }
  }

  await browser.close();

  // Always refresh the upcoming-events cache (used by the home/join-us widgets) regardless of
  // --write, same as scripts/scrape-live-count.js does for data/live-event-count.json -- it's a
  // transient cache, not the canonical historical record artifact_data.json is.
  upcomingEvents.sort((a, b) => a.date.localeCompare(b.date));
  fs.mkdirSync(path.dirname(UPCOMING_PATH), { recursive: true });
  fs.writeFileSync(UPCOMING_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), events: upcomingEvents }, null, 2) + '\n');
  console.log(`Wrote ${upcomingEvents.length} upcoming event(s) to ${UPCOMING_PATH}.`);

  if (!newEvents.length) {
    console.log('Nothing new to add to artifact_data.json.');
    return;
  }

  if (WRITE) {
    data.events = [...newEvents, ...data.events]; // newest first, matching existing order
    fs.writeFileSync(DATA_PATH, JSON.stringify(data));
    console.log(`Wrote ${newEvents.length} new event(s) to ${DATA_PATH}. Run "npm run build" to regenerate the site.`);
  } else {
    console.log(`Dry run: would add ${newEvents.length} new event(s). Re-run with --write to actually update artifact_data.json.`);
  }
}

module.exports = { scrapeEvent, parseToPar, parseIntOrNull, parseEventDate };

if (require.main === module) main();

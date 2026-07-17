// Checks this week's Weekly Mini event and writes the current per-division player count to
// data/live-event-count.json, so the payout calculator (resources/payout-tables.html) can
// auto-populate itself instead of the user having to count and enter it by hand.
//
// Run by .github/workflows/tuesday-live-count.yml every Tuesday evening. No login needed --
// same public league schedule + Cards leaderboard view as scripts/scrape-udisc.js.
//
// Usage: node scripts/scrape-live-count.js
//
// Known limitation: if nobody has started entering scores yet (e.g. the check runs too soon
// after the 6:00 PM start), the event's Cards view has zero rows and this writes zero counts --
// there's no separate "how many showed up" signal to fall back on for a drop-in league like this
// one (see CLAUDE.md for why the UDisc "Participants/Registered" count isn't a reliable stand-in).
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const LEAGUE_SLUG = 'breckinridge-dgc-kwxbSd';
const OUT_PATH = path.join(__dirname, '..', 'data', 'live-event-count.json');
const EVENT_SLUG_RE = /-[a-zA-Z0-9]{6}$/;

// Maps UDisc division codes to the payout calculator's division slugs (see
// scripts/scrape-udisc.js's DIVISION_MERGES for the same unambiguous merges this repo already
// applies). Side and Free are intentionally absent: Side is a separate buy-in with no UDisc
// division label of its own, and Free isn't in the payout tables at all.
const DIVISION_TO_CALC_SLUG = {
  MPO: 'mpo', MMPO: 'mpo',
  MP40: 'mp40',
  MA1: 'ma1',
  MA3: 'ma3fa3', FA3: 'ma3fa3', FA1: 'ma3fa3',
};

function todayCentral(){
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }); // YYYY-MM-DD
}

async function findTodaysEventSlug(page, today){
  await page.goto(`https://udisc.com/leagues/${LEAGUE_SLUG}/schedule`, { waitUntil: 'networkidle' });
  const scheduleSlugs = await page.evaluate(() =>
    Array.from(new Set(
      Array.from(document.querySelectorAll('a[href^="/events/"]'))
        .map((a) => a.getAttribute('href').replace(/^\/events\//, '').split('/')[0])
    ))
  );

  for(const slug of scheduleSlugs){
    if(!EVENT_SLUG_RE.test(slug)) continue;
    await page.goto(`https://udisc.com/events/${slug}/about`, { waitUntil: 'networkidle' });
    const dateText = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('main *'))
        .filter((el) => el.children.length === 0 && /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test((el.textContent || '').trim()));
      return els.length ? els[0].textContent.trim() : null;
    });
    if(!dateText) continue;
    const iso = new Date(dateText + ' UTC').toISOString().slice(0, 10);
    if(iso === today) return slug;
  }
  return null;
}

async function countByDivision(page, slug){
  await page.goto(`https://udisc.com/events/${slug}/leaderboard?round=1&view=cards`, { waitUntil: 'networkidle' });
  return page.evaluate(() => {
    const counts = {};
    for(const tr of document.querySelectorAll('table tbody tr')){
      const tds = tr.querySelectorAll('td');
      if(tds.length < 3) continue;
      const div = tds[2].textContent.trim();
      if(!div) continue;
      counts[div] = (counts[div] || 0) + 1;
    }
    return counts;
  });
}

async function main(){
  const today = todayCentral();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('Looking for a Weekly Mini event on', today, '(America/Chicago)...');
  const slug = await findTodaysEventSlug(page, today);

  if(!slug){
    console.log('No event found for today; leaving existing live-event-count.json untouched.');
    await browser.close();
    return;
  }
  console.log('Found today’s event:', slug);

  const byDivision = await countByDivision(page, slug);
  await browser.close();

  const counts = {};
  let total = 0;
  for(const [div, n] of Object.entries(byDivision)){
    total += n;
    const calcSlug = DIVISION_TO_CALC_SLUG[div];
    if(calcSlug) counts[calcSlug] = (counts[calcSlug] || 0) + n;
  }

  const out = { date: today, slug, updatedAt: new Date().toISOString(), total, counts, byDivision };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log('Wrote', OUT_PATH);
  console.log(JSON.stringify(out, null, 2));
}

main();

// Fills in missing (null) 2024 `pay` values using the payout scale from
// Breck_Payout_Calculator_Advanced.xlsx, replicating that workbook's own tie-splitting formula
// (see its "Payouts" sheet: Est per sequential rank -> sum per tie label -> floor-divide by tie
// count). Never touches already-recorded pay values (some late-2024 events do have real data)
// or divisions with no payout table (Free).
//
// Usage:
//   node scripts/estimate-2024-payouts.js            # dry run: prints what would change
//   node scripts/estimate-2024-payouts.js --write    # writes to artifact_data.json
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'artifact_data.json');
const SCALE_PATH = path.join(__dirname, '..', 'data', 'payout-scale.json'); // {DIV: {counts:[...], positions:[[pos1..posN], ...]}}
const WRITE = process.argv.includes('--write');

const scale = JSON.parse(fs.readFileSync(SCALE_PATH, 'utf8'));

function estBaseAmounts(div, n) {
  const table = scale[div];
  if (!table) return null;
  const colIdx = table.counts.indexOf(n);
  if (colIdx === -1) return null;
  // table.positions[i] is the payout row for sequential place i+1 across all counts; pull this
  // count's column, one entry per sequential place 1..N (may be null for unpaid places).
  return table.positions.map((row) => row[colIdx]);
}

function parseRank(pos) {
  if (!pos) return null;
  const n = parseInt(String(pos).replace(/^T/i, ''), 10);
  return Number.isNaN(n) ? null : n;
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  let filledCount = 0;
  let touchedEvents = 0;
  const samples = [];

  for (const ev of data.events) {
    const [slug, title, date, , cards] = ev;
    if (!date || !date.startsWith('2024')) continue;

    // Group every player (with a back-reference so we can mutate in place) by division, across
    // every card in the event -- payout purses are computed per division per event, not per
    // card (cards are just physical tee-time groupings, same reasoning as Past Results/records).
    const byDiv = {};
    for (const card of cards) {
      for (const p of card[3]) {
        if (!p[1] || !p[2]) continue;
        (byDiv[p[2]] = byDiv[p[2]] || []).push(p);
      }
    }

    let eventTouched = false;
    for (const div of Object.keys(byDiv)) {
      const players = byDiv[div];
      const n = players.length;
      const baseAmounts = estBaseAmounts(div, n);
      if (!baseAmounts) continue; // no table for this division/count (incl. Free entirely)

      // Sort by existing scraped rank; unparseable ranks sort last and are excluded from payout
      // assignment below (still counted in `n` for purse sizing, since they did occupy a slot).
      const ranked = players
        .map((p) => ({ p, rank: parseRank(p[0]) }))
        .sort((a, b) => (a.rank === null ? Infinity : a.rank) - (b.rank === null ? Infinity : b.rank));

      // Walk in sequential-place order (1..n), grouping consecutive rows that share the same
      // original position label (e.g. "T5"), summing their base per-place amounts, and
      // floor-dividing evenly across the group -- exactly what the spreadsheet's
      // Est/Total Purse/Avg Payout columns do.
      let i = 0;
      while (i < ranked.length) {
        if (ranked[i].rank === null) break; // rest are unranked; stop assigning payouts
        const label = ranked[i].p[0];
        let j = i;
        let totalPurse = 0;
        while (j < ranked.length && ranked[j].p[0] === label) {
          totalPurse += baseAmounts[j] || 0;
          j++;
        }
        const tieCount = j - i;
        const avgPayout = Math.floor(totalPurse / tieCount);
        if (avgPayout > 0) {
          for (let k = i; k < j; k++) {
            const player = ranked[k].p;
            if (player[8] === null || player[8] === undefined) {
              player[8] = String(avgPayout);
              filledCount++;
              eventTouched = true;
              if (samples.length < 15) samples.push(`${date} ${div} n=${n} ${player[1]} (${label}) -> $${avgPayout}`);
            }
          }
        }
        i = j;
      }
    }
    if (eventTouched) touchedEvents++;
  }

  console.log(`${WRITE ? 'Filled' : 'Would fill'} ${filledCount} null 2024 pay value(s) across ${touchedEvents} event(s).`);
  console.log('Sample:');
  samples.forEach((s) => console.log('  ' + s));

  if (WRITE) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data));
    console.log(`Wrote ${DATA_PATH}. Run "npm run build" to regenerate the site.`);
  } else {
    console.log('Dry run only -- re-run with --write to persist.');
  }
}

main();

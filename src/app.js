
// RAW.course = [[holeNum,dist,par],...]
// RAW.events = [[slug,title,date,cardCount,cards],...]
// cards = [[cardNum,startHole,startTime,players],...]
// players = [[pos,name,div,toParNum,holeScores[18],total,rating,career,pay],...]

const EVENTS = RAW.events;
const COURSE = RAW.course;

// ---------- helpers ----------
function fmtToPar(n){
  if(n === null || n === undefined) return '–';
  if(n === 0) return 'E';
  return (n>0?'+':'') + n;
}
function toParPillHtml(n){
  if(n === null || n === undefined) return '<span class="pill">–</span>';
  const cls = n < 0 ? 'pos' : (n > 0 ? 'neg' : '');
  return '<span class="pill '+cls+'">'+fmtToPar(n)+'</span>';
}

// Season: events with 25+ logged players are "In Season" (roughly March-October in practice), else "Off Season"
const SEASON_THRESHOLD = 25;
// Manual overrides for events that don't fit the attendance rule (e.g. an early-fall event that
// drew a one-time crowd after the season had effectively wound down).
const SEASON_OVERRIDES = {
  'breckinridge-dgc-weekly-mini-all-welcome-Ua1H3H': 'Off Season' // 2025-09-30, 38 players but past season end
};
const EVENT_SEASON = {};
const EVENT_ATTENDANCE = {};
for(const ev of EVENTS){
  const [slug, title, date, cardCount, cards] = ev;
  const totalPlayers = cards.reduce((sum,c)=>sum+c[3].length,0);
  EVENT_ATTENDANCE[slug] = totalPlayers;
  EVENT_SEASON[slug] = SEASON_OVERRIDES[slug] || (totalPlayers >= SEASON_THRESHOLD ? 'In Season' : 'Off Season');
}

// Build a flat index of every round: {name, date, slug, title, div, toPar, total, rating, holeScores, cardNumber, season}
const ROUNDS = [];
for(const ev of EVENTS){
  const [slug, title, date, cardCount, cards] = ev;
  for(const card of cards){
    const [cardNum, startHole, startTime, players] = card;
    for(const p of players){
      const [pos, name, div, toPar, holeScores, total, rating, career, pay] = p;
      if(!name) continue;
      ROUNDS.push({name, date, slug, title, div, toPar, total, rating, holeScores, cardNum, pos, career, pay, season: EVENT_SEASON[slug]});
    }
  }
}

// unique player names (case-sensitive as scraped)
const PLAYER_NAMES = Array.from(new Set(ROUNDS.map(r=>r.name))).sort((a,b)=>a.localeCompare(b));

// ---------- global season + year + division filters (apply across every tab) ----------
const ALL_YEARS = Array.from(new Set(EVENTS.map(ev=>ev[2] && ev[2].slice(0,4)).filter(Boolean))).sort((a,b)=>b.localeCompare(a));
function compareDivisions(a, b){
  const order = ['MPO','MA1','MA3','MA40','MP40','FA1','FA3','AM','free','Free','FREE'];
  const ia = order.indexOf(a), ib = order.indexOf(b);
  if(ia!==-1 && ib!==-1) return ia-ib;
  if(ia!==-1) return -1;
  if(ib!==-1) return 1;
  return a.localeCompare(b);
}
const DIVISIONS = Array.from(new Set(ROUNDS.map(r=>r.div).filter(d=>d && /^[A-Za-z]/.test(d)))).sort(compareDivisions);

let selectedYears = new Set(ALL_YEARS);
let selectedDivisions = new Set(DIVISIONS);

function getSeasonFilter(){
  return document.getElementById('globalSeasonFilter').value;
}
function getYearFilters(){
  return selectedYears;
}
function getDivisionFilters(){
  return selectedDivisions;
}
function matchesYear(dateStr){
  if(selectedYears.size === ALL_YEARS.length) return true;
  return !!dateStr && selectedYears.has(dateStr.slice(0,4));
}
function matchesDivision(div){
  if(selectedDivisions.size === DIVISIONS.length) return true;
  return !!div && selectedDivisions.has(div);
}
function yearsLabel(){
  if(selectedYears.size === ALL_YEARS.length) return 'All Years';
  if(selectedYears.size === 0) return 'No Years';
  return Array.from(selectedYears).sort((a,b)=>b.localeCompare(a)).join('+');
}
function divisionsLabel(){
  if(selectedDivisions.size === DIVISIONS.length) return 'All Divisions';
  if(selectedDivisions.size === 0) return 'No Divisions';
  return selectedDivisions.size + '/' + DIVISIONS.length + ' Divisions';
}
function seasonLabel(){
  const s = getSeasonFilter();
  return [yearsLabel(), s || 'All Rounds', divisionsLabel()].join(' \u00b7 ');
}

function buildToggleGroup(containerId, items, selectedSet, onChange){
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  items.forEach(item=>{
    const label = document.createElement('label');
    label.className = 'toggle-pill' + (selectedSet.has(item) ? ' checked' : '');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = selectedSet.has(item);
    cb.addEventListener('change', ()=>{
      if(cb.checked){ selectedSet.add(item); } else { selectedSet.delete(item); }
      label.classList.toggle('checked', cb.checked);
      onChange();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(item));
    container.appendChild(label);
  });
}

(function initYearFilter(){
  buildToggleGroup('globalYearToggle', ALL_YEARS, selectedYears, ()=>refreshAllScopedTabs());
})();

(function initDivisionFilter(){
  buildToggleGroup('globalDivToggle', DIVISIONS, selectedDivisions, ()=>refreshAllScopedTabs());
  document.getElementById('divToggleAll').addEventListener('click', (e)=>{
    e.preventDefault();
    selectedDivisions = new Set(DIVISIONS);
    buildToggleGroup('globalDivToggle', DIVISIONS, selectedDivisions, ()=>refreshAllScopedTabs());
    refreshAllScopedTabs();
  });
  document.getElementById('divToggleNone').addEventListener('click', (e)=>{
    e.preventDefault();
    selectedDivisions = new Set();
    buildToggleGroup('globalDivToggle', DIVISIONS, selectedDivisions, ()=>refreshAllScopedTabs());
    refreshAllScopedTabs();
  });
})();

// ---------- tabs ----------
function activateTab(tabName){
  const t = document.querySelector('.tab[data-tab="'+tabName+'"]');
  if(!t) return false;
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById('panel-'+tabName).classList.add('active');
  return true;
}
document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click', ()=>{
    activateTab(t.dataset.tab);
    history.replaceState(null, '', '#'+t.dataset.tab);
  });
});
// Deep-link support: /stats.html#playertable activates that tab on load, and clicking a
// Stats/Past Results nav link while already on this page (same-document hash change) too.
if(location.hash){ activateTab(location.hash.slice(1)); }
window.addEventListener('hashchange', ()=>{ activateTab(location.hash.slice(1)); });

// ---------- autocomplete ----------
function wireAutocomplete(inputId, suggestId, onPick){
  const input = document.getElementById(inputId);
  const box = document.getElementById(suggestId);
  input.addEventListener('input', ()=>{
    const q = input.value.trim().toLowerCase();
    if(q.length < 1){ box.style.display='none'; return; }
    const matches = PLAYER_NAMES.filter(n=>n.toLowerCase().includes(q)).slice(0,8);
    if(matches.length===0){ box.style.display='none'; return; }
    box.innerHTML = matches.map(n=>'<div data-name="'+n.replace(/"/g,'&quot;')+'">'+n+'</div>').join('');
    box.style.display='block';
    box.querySelectorAll('div').forEach(d=>{
      d.addEventListener('click', ()=>{
        input.value = d.dataset.name;
        box.style.display='none';
        onPick(d.dataset.name);
      });
    });
  });
  document.addEventListener('click', (e)=>{ if(e.target!==input) box.style.display='none'; });
  input.addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){
      const exact = PLAYER_NAMES.find(n=>n.toLowerCase()===input.value.trim().toLowerCase());
      if(exact){ onPick(exact); box.style.display='none'; }
    }
  });
}

// ---------- Player Lookup ----------
let scoreChart = null;
let currentPlayerName = null;
function renderPlayer(name){
  currentPlayerName = name;
  const season = getSeasonFilter();
  const rounds = ROUNDS.filter(r=>r.name===name && (!season || r.season===season) && matchesYear(r.date) && matchesDivision(r.div)).sort((a,b)=>a.date.localeCompare(b.date));
  const el = document.getElementById('playerResult');
  if(rounds.length===0){ el.innerHTML = '<p class="muted">No rounds found for '+name+' during '+seasonLabel()+'.</p>'; return; }
  const toParVals = rounds.map(r=>r.toPar).filter(v=>v!==null && v!==undefined);
  const avg = toParVals.length ? (toParVals.reduce((a,b)=>a+b,0)/toParVals.length) : null;
  const best = toParVals.length ? Math.min(...toParVals) : null;
  const worst = toParVals.length ? Math.max(...toParVals) : null;
  const ratings = rounds.map(r=>r.rating).filter(v=>v!==null && v!==undefined);
  const avgRating = ratings.length ? Math.round(ratings.reduce((a,b)=>a+b,0)/ratings.length) : null;

  let html = '<div class="card">';
  html += '<h3 style="margin-top:0">'+name+'</h3>';
  html += '<div class="stat-grid">';
  html += '<div class="stat-box"><div class="label">Scope</div><div class="value" style="font-size:15px">'+seasonLabel()+'</div></div>';
  html += '<div class="stat-box"><div class="label">Rounds</div><div class="value">'+rounds.length+'</div></div>';
  html += '<div class="stat-box"><div class="label">Avg to par</div><div class="value">'+(avg!==null?fmtToPar(Math.round(avg*10)/10):'–')+'</div></div>';
  html += '<div class="stat-box"><div class="label">Best round</div><div class="value">'+(best!==null?fmtToPar(best):'–')+'</div></div>';
  html += '<div class="stat-box"><div class="label">Worst round</div><div class="value">'+(worst!==null?fmtToPar(worst):'–')+'</div></div>';
  html += '<div class="stat-box"><div class="label">Avg rating</div><div class="value">'+(avgRating!==null?avgRating:'–')+'</div></div>';
  html += '</div>';
  html += '<div class="chart-wrap"><canvas id="playerChart"></canvas></div>';
  html += '</div>';

  html += '<div class="card"><table><thead><tr><th>Date</th><th>Event</th><th>Div</th><th>To Par</th><th>Rating</th></tr></thead><tbody>';
  for(const r of [...rounds].reverse()){
    html += '<tr><td>'+r.date+'</td><td>'+r.title+'</td><td>'+(r.div||'')+'</td><td>'+toParPillHtml(r.toPar)+'</td><td>'+(r.rating||'')+'</td></tr>';
  }
  html += '</tbody></table></div>';
  el.innerHTML = html;

  if(scoreChart){ scoreChart.destroy(); }
  const ctx = document.getElementById('playerChart');
  scoreChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: rounds.map(r=>r.date),
      datasets: [{
        label: 'To Par',
        data: rounds.map(r=>r.toPar),
        borderColor: '#c0392b',
        backgroundColor: 'rgba(192,57,43,0.08)',
        fill: true,
        tension: 0.25,
        pointRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { reverse: false, title: { display:true, text:'Strokes to par (lower=better)'} } }
    }
  });
}
wireAutocomplete('playerSearch','playerSuggest', renderPlayer);

// ---------- Events ----------
function renderEvents(filter){
  filter = (filter||'').toLowerCase();
  const seasonFilter = getSeasonFilter();
  const el = document.getElementById('eventList');
  const filtered = [...EVENTS].reverse().filter(ev=>{
    if(seasonFilter && EVENT_SEASON[ev[0]] !== seasonFilter) return false;
    if(!matchesYear(ev[2])) return false;
    if(!filter) return true;
    return ev[0].toLowerCase().includes(filter) || ev[1].toLowerCase().includes(filter) || ev[2].includes(filter);
  });
  let html = '';
  for(const ev of filtered){
    const [slug, title, date, cardCount, cards] = ev;
    const totalPlayers = EVENT_ATTENDANCE[slug];
    const season = EVENT_SEASON[slug];
    const seasonPillClass = season === 'In Season' ? 'pos' : '';
    html += '<div class="event-block" data-slug="'+slug+'">';
    html += '<strong>'+date+'</strong> — '+title+' <span class="pill '+seasonPillClass+'">'+season+'</span> <span class="muted">('+(cardCount>0? totalPlayers+' players, '+cardCount+' cards' : 'no scores logged')+')</span>';
    html += '<div class="event-detail" id="detail-'+slug+'"></div>';
    html += '</div>';
  }
  el.innerHTML = html || '<p class="muted">No matching events.</p>';

  el.querySelectorAll('.event-block').forEach(block=>{
    block.addEventListener('click', (e)=>{
      const slug = block.dataset.slug;
      const detail = document.getElementById('detail-'+slug);
      if(detail.classList.contains('open')){ detail.classList.remove('open'); return; }
      document.querySelectorAll('.event-detail.open').forEach(d=>d.classList.remove('open'));
      if(!detail.dataset.rendered){
        const ev = EVENTS.find(x=>x[0]===slug);
        const cards = ev[4];
        let dh = '';
        // Group by division rather than by card: cards are just physical tee-time groupings
        // (often mixed-division), not useful for seeing who won each division that week.
        const byDiv = {};
        for(const card of cards){
          for(const p of card[3]){
            if(!p[1]) continue;
            const div = p[2] || 'Unlisted';
            (byDiv[div] = byDiv[div] || []).push(p);
          }
        }
        const divsPresent = Object.keys(byDiv).sort(compareDivisions);
        if(divsPresent.length===0){ dh = '<p class="muted">No scores logged for this event.</p>'; }
        for(const div of divsPresent){
          dh += '<div class="card-group"><h4>'+div+'</h4>';
          dh += '<table><thead><tr><th>Pos</th><th>Name</th><th>To Par</th><th>Rating</th></tr></thead><tbody>';
          const sorted = [...byDiv[div]].sort((a,b)=>(a[3]===null?999:a[3])-(b[3]===null?999:b[3]));
          for(const p of sorted){
            dh += '<tr><td>'+(p[0]||'')+'</td><td>'+p[1]+'</td><td>'+toParPillHtml(p[3])+'</td><td>'+(p[6]||'')+'</td></tr>';
          }
          dh += '</tbody></table></div>';
        }
        detail.innerHTML = dh;
        detail.dataset.rendered = '1';
      }
      detail.classList.add('open');
    });
  });
}
function refreshEvents(){
  renderEvents(document.getElementById('eventSearch').value);
}
document.getElementById('eventSearch').addEventListener('input', refreshEvents);
renderEvents('');

// ---------- Head to Head ----------
wireAutocomplete('h2hA','h2hASuggest', ()=>{});
wireAutocomplete('h2hB','h2hBSuggest', ()=>{});
function runH2H(){
  const a = document.getElementById('h2hA').value.trim();
  const b = document.getElementById('h2hB').value.trim();
  const el = document.getElementById('h2hResult');
  if(!a || !b){ el.innerHTML = '<p class="muted">Pick two players.</p>'; return; }
  const season = getSeasonFilter();
  const aRounds = ROUNDS.filter(r=>r.name===a && (!season || r.season===season) && matchesYear(r.date) && matchesDivision(r.div));
  const bRounds = ROUNDS.filter(r=>r.name===b && (!season || r.season===season) && matchesYear(r.date) && matchesDivision(r.div));
  const aBySlug = {}; aRounds.forEach(r=>aBySlug[r.slug]=r);
  const bBySlug = {}; bRounds.forEach(r=>bBySlug[r.slug]=r);
  const shared = Object.keys(aBySlug).filter(s=>bBySlug[s]).sort();
  if(shared.length===0){ el.innerHTML = '<p class="muted">'+a+' and '+b+' have never logged the same event during '+seasonLabel()+'.</p>'; return; }
  let aWins=0,bWins=0,ties=0;
  let rows = '';
  for(const slug of shared){
    const ra = aBySlug[slug], rb = bBySlug[slug];
    let result = 'tie';
    if(ra.toPar!==null && rb.toPar!==null){
      if(ra.toPar < rb.toPar){ aWins++; result='a'; }
      else if(rb.toPar < ra.toPar){ bWins++; result='b'; }
      else { ties++; }
    }
    rows += '<tr><td>'+ra.date+'</td><td>'+ra.title+'</td><td>'+toParPillHtml(ra.toPar)+'</td><td>'+toParPillHtml(rb.toPar)+'</td><td>'+(result==='a'?a+' won':result==='b'?b+' won':'tie')+'</td></tr>';
  }
  let html = '<div class="card"><div class="stat-grid">';
  html += '<div class="stat-box"><div class="label">Scope</div><div class="value" style="font-size:15px">'+seasonLabel()+'</div></div>';
  html += '<div class="stat-box"><div class="label">Shared events</div><div class="value">'+shared.length+'</div></div>';
  html += '<div class="stat-box"><div class="label">'+a+' wins</div><div class="value">'+aWins+'</div></div>';
  html += '<div class="stat-box"><div class="label">'+b+' wins</div><div class="value">'+bWins+'</div></div>';
  html += '<div class="stat-box"><div class="label">Ties</div><div class="value">'+ties+'</div></div>';
  html += '</div></div>';
  html += '<div class="card"><table><thead><tr><th>Date</th><th>Event</th><th>'+a+'</th><th>'+b+'</th><th>Result</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  el.innerHTML = html;
}
document.getElementById('h2hGo').addEventListener('click', runH2H);

// ---------- Hole Stats ----------
let holeSortState = { key: 'num', dir: 1 };
let lastHoleAgg = null;

const HOLE_TABLE_COLS = [
  {key:'num', label:'Hole'},
  {key:'dist', label:'Distance'},
  {key:'par', label:'Par'},
  {key:'avg', label:'Avg Score'},
  {key:'avgVsPar', label:'Avg vs Par'},
  {key:'aces', label:'Aces'},
  {key:'birdieOrBetter', label:'Birdie+'},
  {key:'bogeyOrWorse', label:'Bogey+'}
];

function holeSortValue(h, key){
  switch(key){
    case 'num': return h.num;
    case 'dist': return h.dist;
    case 'par': return h.par;
    case 'avg': return h.count ? h.total/h.count : -Infinity;
    case 'avgVsPar': return h.count ? (h.total/h.count - h.par) : -Infinity;
    case 'aces': return h.aces;
    case 'birdieOrBetter': return h.birdieOrBetter;
    case 'bogeyOrWorse': return h.bogeyOrWorse;
    default: return h.num;
  }
}

function buildHoleTableHtml(holeAgg){
  let html = '<table><thead><tr>';
  for(const c of HOLE_TABLE_COLS){
    const arrow = holeSortState.key === c.key ? (holeSortState.dir === 1 ? ' \u25B2' : ' \u25BC') : '';
    html += '<th class="sortable-th" data-key="'+c.key+'">'+c.label+arrow+'</th>';
  }
  html += '</tr></thead><tbody>';
  const sorted = [...holeAgg].sort((a,b)=>(holeSortValue(a,holeSortState.key) - holeSortValue(b,holeSortState.key)) * holeSortState.dir);
  for(const h of sorted){
    const avg = h.count ? h.total/h.count : null;
    html += '<tr><td>'+h.num+'</td><td>'+h.dist+'ft</td><td>'+h.par+'</td><td>'+(avg!==null?avg.toFixed(2):'–')+'</td><td>'+(avg!==null?toParPillHtml(Math.round((avg-h.par)*100)/100):'–')+'</td><td>'+h.aces+'</td><td>'+h.birdieOrBetter+'</td><td>'+h.bogeyOrWorse+'</td></tr>';
  }
  html += '</tbody></table>';
  return html;
}

function wireHoleTableSort(){
  document.querySelectorAll('#holeStatsTableWrap th.sortable-th').forEach(th=>{
    th.addEventListener('click', ()=>{
      const key = th.dataset.key;
      if(holeSortState.key === key){ holeSortState.dir *= -1; }
      else{ holeSortState.key = key; holeSortState.dir = 1; }
      const wrap = document.getElementById('holeStatsTableWrap');
      if(wrap && lastHoleAgg){ wrap.innerHTML = buildHoleTableHtml(lastHoleAgg); wireHoleTableSort(); }
    });
  });
}

function renderHoleStats(){
  const seasonFilter = getSeasonFilter();
  const el = document.getElementById('holeStats');
  let rounds = ROUNDS;
  if(seasonFilter) rounds = rounds.filter(r=>r.season===seasonFilter);
  rounds = rounds.filter(r=>matchesYear(r.date) && matchesDivision(r.div));
  const holeAgg = COURSE.map(([num,dist,par])=>({num,dist,par,total:0,count:0,aces:0,birdieOrBetter:0,bogeyOrWorse:0,best:null,worst:null}));
  for(const r of rounds){
    if(!r.holeScores) continue;
    r.holeScores.forEach((s,i)=>{
      if(s===null || s===undefined) return;
      const h = holeAgg[i];
      if(!h) return;
      h.total += s; h.count++;
      if(s===1) h.aces++;
      if(s <= h.par-1) h.birdieOrBetter++;
      if(s >= h.par+1) h.bogeyOrWorse++;
      if(h.best===null || s<h.best) h.best = s;
      if(h.worst===null || s>h.worst) h.worst = s;
    });
  }
  lastHoleAgg = holeAgg;

  const withData = holeAgg.filter(h=>h.count);
  if(withData.length === 0){
    el.innerHTML = '<p class="muted">No rounds logged for '+seasonLabel()+'.</p>';
    return;
  }
  const sorted = [...withData].sort((a,b)=>(b.total/b.count-b.par)-(a.total/a.count-a.par));
  const hardest = sorted[0], easiest = sorted[sorted.length-1];
  const html = '<div class="card"><div class="stat-grid">'
    + '<div class="stat-box"><div class="label">Scope</div><div class="value" style="font-size:15px">'+seasonLabel()+'</div></div>'
    + '<div class="stat-box"><div class="label">Rounds counted</div><div class="value">'+rounds.length+'</div></div>'
    + '<div class="stat-box"><div class="label">Hardest hole</div><div class="value">#'+hardest.num+'</div></div>'
    + '<div class="stat-box"><div class="label">Easiest hole</div><div class="value">#'+easiest.num+'</div></div>'
    + '<div class="stat-box"><div class="label">Total aces logged</div><div class="value">'+holeAgg.reduce((s,h)=>s+h.aces,0)+'</div></div>'
    + '</div></div>'
    + '<div class="card" id="holeStatsTableWrap">' + buildHoleTableHtml(holeAgg) + '</div>';
  el.innerHTML = html;
  wireHoleTableSort();
}
renderHoleStats();

// ---------- Top Winners ----------
function parsePay(pay){
  if(!pay) return 0;
  return String(pay).split('+').reduce((sum,part)=>{
    const n = parseFloat(part);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
}
function isWin(pos){
  return pos === '1' || pos === 'T1';
}
function renderTopWinners(){
  const season = getSeasonFilter();
  let rounds = ROUNDS;
  if(season) rounds = rounds.filter(r=>r.season===season);
  rounds = rounds.filter(r=>matchesYear(r.date) && matchesDivision(r.div));
  const el = document.getElementById('winnersOut');

  const byDiv = {};
  for(const r of rounds){
    if(!r.div) continue;
    if(!byDiv[r.div]) byDiv[r.div] = {};
    if(!byDiv[r.div][r.name]) byDiv[r.div][r.name] = {wins:0, winnings:0, rounds:0};
    const p = byDiv[r.div][r.name];
    p.rounds++;
    p.winnings += parsePay(r.pay);
    if(isWin(r.pos)) p.wins++;
  }

  const divsToShow = DIVISIONS.filter(d=>byDiv[d]);
  if(divsToShow.length === 0){
    el.innerHTML = '<p class="muted">No rounds logged for '+seasonLabel()+'.</p>';
    return;
  }

  const MIN_ROUNDS_FOR_PCT = 5;
  let html = '<div class="row muted" style="margin-bottom:10px">Scope: '+seasonLabel()+' &nbsp;·&nbsp; "Wins" = outright or tied for 1st. "Total Winnings" is money won across all logged rounds in scope. "Win %" only shown for players with '+MIN_ROUNDS_FOR_PCT+'+ rounds played.</div>';
  for(const div of divsToShow){
    const entries = Object.entries(byDiv[div])
      .map(([name,stats])=>({name, ...stats}))
      .filter(e=>e.wins > 0)
      .sort((a,b)=> b.wins - a.wins || b.winnings - a.winnings || a.name.localeCompare(b.name))
      .slice(0,10);
    if(entries.length === 0) continue;
    html += '<div class="card"><h3 style="margin-top:0">'+div+'</h3><table><thead><tr><th>#</th><th>Player</th><th>Wins</th><th>Rounds</th><th>Win %</th><th>Total Winnings</th></tr></thead><tbody>';
    entries.forEach((e,i)=>{
      const winPct = e.rounds >= MIN_ROUNDS_FOR_PCT ? (e.wins / e.rounds * 100).toFixed(1) + '%' : '–';
      html += '<tr><td>'+(i+1)+'</td><td>'+e.name+'</td><td>'+e.wins+'</td><td>'+e.rounds+'</td><td>'+winPct+'</td><td>'+(e.winnings>0 ? '$'+Math.round(e.winnings) : '–')+'</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  el.innerHTML = html;
}
renderTopWinners();

// ---------- Course Records ----------
function renderCourseRecords(){
  const season = getSeasonFilter();
  let rounds = ROUNDS;
  if(season) rounds = rounds.filter(r=>r.season===season);
  rounds = rounds.filter(r=>matchesYear(r.date) && matchesDivision(r.div) && r.toPar!==null && r.toPar!==undefined);
  const el = document.getElementById('courseRecordsOut');

  const byDiv = {};
  for(const r of rounds){
    if(!r.div) continue;
    (byDiv[r.div] = byDiv[r.div] || []).push(r);
  }
  const divsToShow = DIVISIONS.filter(d=>byDiv[d]);
  if(divsToShow.length === 0){
    el.innerHTML = '<p class="muted">No rounds logged for '+seasonLabel()+'.</p>';
    return;
  }

  // For every division except MPO, each player's chronologically-first round in that division
  // (across the whole dataset, not just the current filter scope) is excluded from record
  // consideration -- a debut round in a division isn't a representative best.
  let html = '<div class="row muted" style="margin-bottom:10px">Scope: '+seasonLabel()+'. Best rounds by to-par, per division. For every division except MPO, each player\'s first round ever played in that division is excluded.</div>';
  for(const div of divsToShow){
    let entries = byDiv[div];
    if(div !== 'MPO'){
      const firstRoundByPlayer = {};
      for(const r of ROUNDS){
        if(r.div !== div || !r.name) continue;
        if(!firstRoundByPlayer[r.name] || r.date < firstRoundByPlayer[r.name].date) firstRoundByPlayer[r.name] = r;
      }
      entries = entries.filter(r => firstRoundByPlayer[r.name] !== r);
    }
    entries = entries.slice().sort((a,b)=> a.toPar - b.toPar || a.date.localeCompare(b.date)).slice(0,5);
    if(entries.length === 0) continue;
    html += '<div class="card"><h3 style="margin-top:0">'+div+'</h3><table><thead><tr><th>#</th><th>Player</th><th>To Par</th><th>Date</th><th>Event</th></tr></thead><tbody>';
    entries.forEach((e,i)=>{
      html += '<tr><td>'+(i+1)+'</td><td>'+e.name+'</td><td>'+toParPillHtml(e.toPar)+'</td><td>'+e.date+'</td><td>'+e.title+'</td></tr>';
    });
    html += '</tbody></table></div>';
  }
  el.innerHTML = html || '<p class="muted">No qualifying rounds for '+seasonLabel()+'.</p>';
}
renderCourseRecords();

// ---------- Player Table (full stats grid) ----------
function computeHoleAgg(rounds){
  const agg = Array.from({length:18}, ()=>({sum:0, count:0, best:null, worst:null}));
  for(const r of rounds){
    if(!r.holeScores) continue;
    r.holeScores.forEach((s,i)=>{
      if(s===null || s===undefined) return;
      const a = agg[i];
      a.sum += s; a.count++;
      if(a.best===null || s<a.best) a.best = s;
      if(a.worst===null || s>a.worst) a.worst = s;
    });
  }
  return agg;
}
function placementNum(pos){
  if(!pos) return null;
  const s = String(pos).replace(/^T/i,'');
  const n = parseInt(s,10);
  return isNaN(n) ? null : n;
}

// Column definitions: 14 single columns + 3 groups of 18 hole columns each (54), same click-to-sort
// pattern as Hole Stats — plain HTML table, no external grid library.
const PT_SINGLE_COLS = [
  {key:'name', label:'Player'},
  {key:'div', label:'Division'},
  {key:'rounds', label:'Rounds'},
  {key:'events', label:'Events'},
  {key:'wins', label:'Wins'},
  {key:'winPct', label:'Win %'},
  {key:'avgPlacement', label:'Avg Placement'},
  {key:'avgScore', label:'Avg Score'},
  {key:'avgToPar', label:'Avg To Par'},
  {key:'miniRating', label:'Mini Rating'},
  {key:'bestRound', label:'Best Round (to par)'},
  {key:'worstRound', label:'Worst Round (to par)'},
  {key:'totalWinnings', label:'Total Winnings ($)'},
  {key:'highestPayout', label:'Highest Payout ($)'},
  {key:'aces', label:'Aces'}
];
const PT_HOLE_GROUPS = [
  {group:'Avg Score / Hole', prefix:'holeAvg'},
  {group:'Best Score / Hole', prefix:'holeBest'},
  {group:'Worst Score / Hole', prefix:'holeWorst'}
];
const PT_TEXT_KEYS = new Set(['name','div']);

let ptSortState = { key: 'wins', dir: -1 };
let lastPtRows = [];

function ptValue(row, key){
  const us = key.indexOf('_');
  if(us !== -1){
    const prefix = key.slice(0, us);
    const idx = parseInt(key.slice(us+1), 10);
    return row[prefix][idx];
  }
  return row[key];
}

function ptCompare(a, b, key, dir){
  const va = ptValue(a, key), vb = ptValue(b, key);
  if(PT_TEXT_KEYS.has(key)){
    return (va||'').localeCompare(vb||'') * dir;
  }
  const na = (va === null || va === undefined) ? -Infinity : va;
  const nb = (vb === null || vb === undefined) ? -Infinity : vb;
  return (na - nb) * dir;
}

function ptDisplay(row, key){
  const v = ptValue(row, key);
  if(key === 'name') return row.name;
  if(key === 'div') return v || '–';
  if(key === 'totalWinnings' || key === 'highestPayout') return (v && v > 0) ? '$'+v : '–';
  if(key === 'winPct') return (v!==null && v!==undefined) ? v+'%' : '–';
  return (v===null || v===undefined) ? '–' : v;
}

function ptHeaderCell(key, label, extraClass){
  const arrow = ptSortState.key === key ? (ptSortState.dir===1?' ▲':' ▼') : '';
  return '<th class="sortable-th pt-rotate'+(extraClass?' '+extraClass:'')+'" data-key="'+key+'"'+(extraClass==='pt-single'?' rowspan="2"':'')+'>'+label+arrow+'</th>';
}

function buildPlayerTableHtml(rows){
  let row1 = '<tr>';
  for(const c of PT_SINGLE_COLS){ row1 += ptHeaderCell(c.key, c.label, 'pt-single'); }
  for(const g of PT_HOLE_GROUPS){ row1 += '<th colspan="18" class="pt-group-th">'+g.group+'</th>'; }
  row1 += '</tr>';

  let row2 = '<tr>';
  for(const g of PT_HOLE_GROUPS){
    for(let i=0;i<18;i++){ row2 += ptHeaderCell(g.prefix+'_'+i, 'H'+(i+1)); }
  }
  row2 += '</tr>';

  const sorted = [...rows].sort((a,b)=>ptCompare(a,b,ptSortState.key,ptSortState.dir));
  let body = '';
  for(const r of sorted){
    body += '<tr>';
    for(const c of PT_SINGLE_COLS){ body += '<td>'+ptDisplay(r, c.key)+'</td>'; }
    for(const g of PT_HOLE_GROUPS){
      for(let i=0;i<18;i++){ body += '<td>'+ptDisplay(r, g.prefix+'_'+i)+'</td>'; }
    }
    body += '</tr>';
  }
  return '<table><thead>'+row1+row2+'</thead><tbody>'+body+'</tbody></table>';
}

function wirePlayerTableSort(){
  document.querySelectorAll('#playerTableWrap th.sortable-th').forEach(th=>{
    th.addEventListener('click', ()=>{
      const key = th.dataset.key;
      if(ptSortState.key === key){ ptSortState.dir *= -1; }
      else{ ptSortState.key = key; ptSortState.dir = 1; }
      renderPlayerTableRows();
    });
  });
}

function renderPlayerTableRows(){
  const wrap = document.getElementById('playerTableWrap');
  const q = (document.getElementById('ptSearch').value || '').trim().toLowerCase();
  const rows = q ? lastPtRows.filter(r=>r.name.toLowerCase().includes(q)) : lastPtRows;
  document.getElementById('ptScopeLabel').textContent =
    'Scope: ' + seasonLabel() + ' · min ' + document.getElementById('ptMinRounds').value + ' rounds · ' + rows.length + ' players' + (q ? ' (filtered)' : '');
  wrap.innerHTML = rows.length ? buildPlayerTableHtml(rows) : '<p class="muted">No players match the current filters.</p>';
  wirePlayerTableSort();
}

function renderPlayerTable(){
  const season = getSeasonFilter();
  let rounds = ROUNDS;
  if(season) rounds = rounds.filter(r=>r.season===season);
  rounds = rounds.filter(r=>matchesYear(r.date) && matchesDivision(r.div));

  const minRoundsInput = document.getElementById('ptMinRounds');
  const minRounds = Math.max(0, parseInt(minRoundsInput.value, 10) || 0);

  const byPlayer = {};
  for(const r of rounds){
    if(!byPlayer[r.name]) byPlayer[r.name] = {div: r.div, rows: []};
    byPlayer[r.name].rows.push(r);
    if(r.div) byPlayer[r.name].div = r.div;
  }

  const eligibleNames = Object.keys(byPlayer).filter(name => byPlayer[name].rows.length >= minRounds);

  const rows = [];
  for(const name of eligibleNames){
    const rs = byPlayer[name].rows;
    const div = byPlayer[name].div;
    const holeAgg = computeHoleAgg(rs);

    const totalStrokes = rs.map(r=>r.total).filter(v=>v!==null && v!==undefined);
    const toPars = rs.map(r=>r.toPar).filter(v=>v!==null && v!==undefined);
    const placements = rs.map(r=>placementNum(r.pos)).filter(v=>v!==null);
    const wins = rs.filter(r=>isWin(r.pos)).length;
    const winnings = rs.reduce((s,r)=>s+parsePay(r.pay),0);
    const payouts = rs.map(r=>parsePay(r.pay)).filter(v=>v>0);
    const events = new Set(rs.map(r=>r.slug)).size;
    const aces = rs.reduce((s,r)=> s + (r.holeScores ? r.holeScores.filter(x=>x===1).length : 0), 0);

    // Mini rating: average of the best 8 rated rounds among the player's last 20 rated rounds
    // (most recent by date), same idea as a PDGA-style rolling rating.
    const ratedByDateDesc = rs.filter(r=>r.rating!==null && r.rating!==undefined).sort((a,b)=>b.date.localeCompare(a.date));
    const last20Rated = ratedByDateDesc.slice(0,20);
    const best8OfLast20 = [...last20Rated].sort((a,b)=>b.rating-a.rating).slice(0,8);
    const miniRating = best8OfLast20.length ? (best8OfLast20.reduce((s,r)=>s+r.rating,0)/best8OfLast20.length) : null;
    const avgScore = totalStrokes.length ? (totalStrokes.reduce((a,b)=>a+b,0)/totalStrokes.length) : null;
    const avgToPar = toPars.length ? (toPars.reduce((a,b)=>a+b,0)/toPars.length) : null;
    const bestRound = toPars.length ? Math.min(...toPars) : null;
    const worstRound = toPars.length ? Math.max(...toPars) : null;
    const avgPlacement = placements.length ? (placements.reduce((a,b)=>a+b,0)/placements.length) : null;
    const winPct = rs.length ? (wins/rs.length*100) : 0;
    const highestPayout = payouts.length ? Math.max(...payouts) : 0;

    rows.push({
      name,
      div: div || null,
      rounds: rs.length,
      events,
      wins,
      winPct: Number(winPct.toFixed(1)),
      avgPlacement: avgPlacement !== null ? Number(avgPlacement.toFixed(1)) : null,
      avgScore: avgScore !== null ? Number(avgScore.toFixed(1)) : null,
      avgToPar: avgToPar !== null ? Number(avgToPar.toFixed(1)) : null,
      miniRating: miniRating !== null ? Math.round(miniRating) : null,
      bestRound,
      worstRound,
      totalWinnings: Math.round(winnings),
      highestPayout: Math.round(highestPayout),
      aces,
      holeAvg: holeAgg.map(h => h.count ? Number((h.sum/h.count).toFixed(2)) : null),
      holeBest: holeAgg.map(h => h.best),
      holeWorst: holeAgg.map(h => h.worst)
    });
  }

  lastPtRows = rows;
  renderPlayerTableRows();
}

try{
  (function initPtControls(){
    const minRoundsEl = document.getElementById('ptMinRounds');
    minRoundsEl.addEventListener('input', ()=>renderPlayerTable());
    minRoundsEl.addEventListener('change', ()=>renderPlayerTable());
    document.getElementById('ptSearch').addEventListener('input', ()=>renderPlayerTableRows());
  })();
  renderPlayerTable();
}catch(err){
  console.error('Player table init failed:', err);
}

/*__CHAT_JS_HOOK__*/

// ---------- global season + year + division filter wiring ----------
function refreshAllScopedTabs(){
  refreshEvents();
  renderHoleStats();
  renderTopWinners();
  renderCourseRecords();
  renderPlayerTable();
  if(currentPlayerName){ renderPlayer(currentPlayerName); }
  const a = document.getElementById('h2hA').value.trim();
  const b = document.getElementById('h2hB').value.trim();
  if(a && b){ runH2H(); }
}
document.getElementById('globalSeasonFilter').addEventListener('change', refreshAllScopedTabs);

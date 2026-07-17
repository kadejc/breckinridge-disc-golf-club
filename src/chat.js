// ---------- Ask the Data (chat) ----------
let chatHistory = []; // [{role:'user'|'assistant', text}]

function buildChatDataContext(){
  const season = getSeasonFilter();
  let rounds = ROUNDS;
  if(season) rounds = rounds.filter(r=>r.season===season);
  rounds = rounds.filter(r=>matchesYear(r.date) && matchesDivision(r.div));
  const scopedSlugs = new Set(rounds.map(r=>r.slug));
  const scopedEvents = EVENTS.filter(ev=>scopedSlugs.has(ev[0]));

  const courseLine = 'COURSE (18 holes, hole:distance/par): ' + COURSE.map(([num,dist,par])=>num+':'+dist+'ft/par'+par).join(', ');

  const eventLines = scopedEvents.map(ev=>{
    const [slug,title,date,cardCount,cards] = ev;
    const all = [];
    cards.forEach(c=>c[3].forEach(p=>all.push(p)));
    all.sort((a,b)=>(a[3]===null?999:a[3])-(b[3]===null?999:b[3]));
    const top3 = all.slice(0,3).map(p=>p[1]+'('+fmtToPar(p[3])+')').join(', ');
    return date+' | '+title+' | '+all.length+' players | '+(EVENT_SEASON[slug]||'')+' | top finishers: '+top3;
  });

  const byPlayer = {};
  for(const r of rounds){
    if(!byPlayer[r.name]) byPlayer[r.name] = {div:r.div, rounds:0, wins:0, winnings:0, toPars:[]};
    const p = byPlayer[r.name];
    p.rounds++;
    p.winnings += parsePay(r.pay);
    if(isWin(r.pos)) p.wins++;
    if(r.toPar !== null && r.toPar !== undefined) p.toPars.push(r.toPar);
    if(r.div) p.div = r.div;
  }
  const playerLines = Object.entries(byPlayer).map(([name,p])=>{
    const avg = p.toPars.length ? (p.toPars.reduce((a,b)=>a+b,0)/p.toPars.length).toFixed(1) : 'n/a';
    const best = p.toPars.length ? fmtToPar(Math.min(...p.toPars)) : 'n/a';
    const winPct = p.rounds ? (p.wins/p.rounds*100).toFixed(1) : '0';
    return name+' | div:'+(p.div||'?')+' | rounds:'+p.rounds+' | wins:'+p.wins+' | winPct:'+winPct+'% | avgToPar:'+avg+' | bestToPar:'+best+' | totalWinnings:$'+Math.round(p.winnings);
  });

  const roundLines = rounds.map(r=>r.date+' | '+(r.div||'?')+' | '+r.name+' | pos:'+(r.pos||'?')+' | toPar:'+fmtToPar(r.toPar)+' | total:'+(r.total===null||r.total===undefined?'?':r.total)+(r.pay?' | pay:$'+r.pay:''));

  return [
    courseLine,
    'EVENTS IN SCOPE ('+seasonLabel()+', '+scopedEvents.length+' events):\n' + eventLines.join('\n'),
    'PLAYER CAREER STATS IN SCOPE ('+playerLines.length+' players):\n' + playerLines.join('\n'),
    'FULL ROUND-BY-ROUND LOG IN SCOPE ('+roundLines.length+' rounds):\n' + roundLines.join('\n')
  ];
}

function appendChatBubble(role, text){
  const list = document.getElementById('chatMessages');
  const empty = list.querySelector('.chat-empty');
  if(empty) empty.remove();
  const div = document.createElement('div');
  div.className = 'chat-bubble ' + role;
  div.textContent = text;
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
  return div;
}

async function sendChatMessage(){
  const input = document.getElementById('chatInput');
  const q = input.value.trim();
  if(!q) return;
  const sendBtn = document.getElementById('chatSend');
  input.value = '';
  input.disabled = true;
  sendBtn.disabled = true;

  appendChatBubble('user', q);
  const thinking = appendChatBubble('assistant loading', 'Thinking…');

  const dataContext = buildChatDataContext();
  const historyText = chatHistory.slice(-6).map(m=>(m.role==='user'?'Q: ':'A: ')+m.text).join('\n');

  const prompt = 'You are a helpful assistant answering questions about a disc golf league\'s stats (Breckinridge DGC Weekly Mini), using the data provided below. '
    + 'Answer using ONLY that data. If the data doesn\'t contain what\'s needed to answer, say so honestly instead of guessing. '
    + 'Be specific with names and numbers. Keep answers concise and conversational. '
    + 'Current filter scope: ' + seasonLabel() + '. '
    + (historyText ? ('Recent conversation for context:\n' + historyText + '\n\n') : '')
    + 'New question: ' + q;

  try{
    const result = await window.cowork.askClaude(prompt, dataContext);
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
    thinking.textContent = text;
    thinking.className = 'chat-bubble assistant';
    chatHistory.push({role:'user', text:q});
    chatHistory.push({role:'assistant', text});
  }catch(err){
    thinking.textContent = 'Sorry, something went wrong: ' + (err && err.message ? err.message : String(err));
    thinking.className = 'chat-bubble assistant error';
  }finally{
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

document.getElementById('chatSend').addEventListener('click', sendChatMessage);
document.getElementById('chatInput').addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendChatMessage(); }
});
document.getElementById('chatClear').addEventListener('click', ()=>{
  chatHistory = [];
  document.getElementById('chatMessages').innerHTML = '<div class="chat-empty">Ask anything about the league — standings, head-to-heads, hole difficulty, streaks, winnings, whatever. Answers are generated from the data currently in scope (the season filter above applies here too).</div>';
});
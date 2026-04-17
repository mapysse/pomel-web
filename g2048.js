/* ═══════════════════════════════════════════════════════════════════════════
   G2048.JS — Jeu 2048 pour Pomel (extrait de index.html)
   ═══════════════════════════════════════════════════════════════════════════
   Dépend de : state, dbGet, dbSet, dbDelete, addBalanceTransaction,
               migrateAccount, refreshUI, escapeHTML, showWinToast,
               getAccBannerClass, getAccColorClass, getAccount,
               renderAvatarInEl, distributeReliably
   ═══════════════════════════════════════════════════════════════════════════ */

// ── CSS (injecté au chargement) ──────────────────
(function() {
  const style = document.createElement('style');
  style.id = 'g2048-styles';
  style.textContent = `
    .g2048-wrap { display: flex; flex-direction: column; gap: 20px; }
    .g2048-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .g2048-score-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 20px; text-align: center; min-width: 110px; flex-shrink: 0; }
    .g2048-score-label { font-size: .65rem; font-weight: 700; color: var(--muted); letter-spacing: .1em; text-transform: uppercase; }
    .g2048-score-val { font-family: 'Space Mono', monospace; font-size: 1.5rem; font-weight: 700; color: var(--primary); }
    .g2048-board-outer { position: relative; width: 400px; max-width: 100%; margin: 0 auto; border-radius: 10px; overflow: hidden; border: 2px solid var(--border); box-shadow: 0 0 30px var(--primary-glow); }
    .g2048-board { background: #2a2a35; padding: 10px; display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(4, 1fr); gap: 10px; aspect-ratio: 1; }
    .g2048-tile { border-radius: 6px; display: flex; align-items: center; justify-content: center; font-family: 'Space Mono', monospace; font-weight: 700; font-size: 1.8rem; transition: background .1s; animation: g2048-tile-appear .12s ease; }
    @keyframes g2048-tile-appear { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .g2048-tile.merged { animation: g2048-tile-merge .18s ease; }
    @keyframes g2048-tile-merge { 0%{transform:scale(1)} 50%{transform:scale(1.18)} 100%{transform:scale(1)} }
    .g2048-tile.empty { background: rgba(255,255,255,0.07); }
    .t2    { background:#eee4da; color:#776e65; }
    .t4    { background:#ede0c8; color:#776e65; }
    .t8    { background:#f2b179; color:#f9f6f2; }
    .t16   { background:#f59563; color:#f9f6f2; }
    .t32   { background:#f67c5f; color:#f9f6f2; }
    .t64   { background:#f65e3b; color:#f9f6f2; }
    .t128  { background:#edcf72; color:#f9f6f2; font-size:1.5rem; }
    .t256  { background:#edcc61; color:#f9f6f2; font-size:1.5rem; }
    .t512  { background:#edc850; color:#f9f6f2; font-size:1.5rem; }
    .t1024 { background:#edc53f; color:#f9f6f2; font-size:1.1rem; }
    .t2048 { background:#edc22e; color:#f9f6f2; font-size:1.1rem; box-shadow:inset 0 0 20px rgba(255,220,80,0.3); }
    .t4096 { background:#EB5846; color:#f9f6f2; font-size:1rem; }
    .t8192 { background:#c03c2c; color:#f9f6f2; font-size:.9rem; }
    .g2048-overlay { position: absolute; inset: 0; background: rgba(13,13,15,0.88); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; backdrop-filter: blur(4px); }
    .g2048-overlay.hidden { display: none; }
    .g2048-overlay-title { font-size: 1.8rem; font-weight: 800; color: var(--primary); letter-spacing: -1px; }
    .g2048-overlay-sub { font-size: .88rem; color: var(--muted); text-align: center; padding: 0 24px; line-height: 1.5; }
    .g2048-controls-hint { display: flex; justify-content: center; gap: 24px; font-size: .78rem; color: var(--muted); flex-wrap: wrap; }
    @media (max-width: 600px) {
      .g2048-board-outer { border-radius: 10px; touch-action: none; }
      .g2048-board { padding: 6px; gap: 6px; }
      .g2048-tile { font-size: 1.3rem; border-radius: 4px; }
      .t128, .t256, .t512 { font-size: 1.1rem; }
      .t1024, .t2048 { font-size: .9rem; }
      .t4096, .t8192 { font-size: .75rem; }
      .g2048-header .section-title { font-size: 1.1rem; }
      .g2048-score-box { min-width: 90px; padding: 10px 14px; }
      .g2048-score-val { font-size: 1.2rem; }
    }
  `;
  document.head.appendChild(style);
})();


// ── 2048 GAME ENGINE ─────────────────────────────
let g2048Grid = [];
let g2048Score = 0;
let g2048Running = false;
let g2048Won = false;
let g2048TouchStart = null;
const G2048_POMEL_RATE = 10; // 1 Pomel par 7 points

function g2048NewGrid() {
  return Array.from({ length: 4 }, () => [0, 0, 0, 0]);
}

function g2048AddTile() {
  const empties = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (g2048Grid[r][c] === 0) empties.push([r, c]);
  if (!empties.length) return;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  g2048Grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}

// Slide + merge a single row left; returns { row, gained }
function g2048SlideRow(row) {
  let arr = row.filter(v => v !== 0);
  let gained = 0;
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] === arr[i + 1]) {
      arr[i] *= 2;
      gained += arr[i];
      arr.splice(i + 1, 1);
    }
  }
  while (arr.length < 4) arr.push(0);
  return { row: arr, gained };
}

// Rotate grid 90° clockwise
function g2048Rotate(grid) {
  const n = 4;
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => grid[n - 1 - c][r])
  );
}

// Move in direction; returns true if board changed
function g2048Move(dir) {
  const rotations = { left: 0, up: 3, right: 2, down: 1 };
  let rots = rotations[dir];
  let grid = JSON.parse(JSON.stringify(g2048Grid));
  for (let i = 0; i < rots; i++) grid = g2048Rotate(grid);

  let changed = false;
  let gained = 0;
  for (let r = 0; r < 4; r++) {
    const res = g2048SlideRow(grid[r]);
    if (res.row.some((v, i) => v !== grid[r][i])) changed = true;
    grid[r] = res.row;
    gained += res.gained;
  }

  let back = (4 - rots) % 4;
  for (let i = 0; i < back; i++) grid = g2048Rotate(grid);

  if (changed) {
    g2048Grid = grid;
    g2048Score += gained;
    g2048AddTile();
    g2048Render();
    g2048UpdateUI();
  }
  return changed;
}

function g2048Render() {
  const board = document.getElementById('g2048Board');
  if (!board) return;
  board.innerHTML = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = g2048Grid[r][c];
      const cell = document.createElement('div');
      if (val === 0) {
        cell.className = 'g2048-tile empty';
      } else {
        const cls = val <= 8192 ? 't' + val : 't8192';
        cell.className = 'g2048-tile ' + cls;
        cell.textContent = val.toLocaleString('fr-FR');
      }
      board.appendChild(cell);
    }
  }
}

function g2048UpdateUI() {
  const scoreEl = document.getElementById('g2048Score');
  const earnedEl = document.getElementById('g2048Earned');
  if (scoreEl) scoreEl.textContent = g2048Score.toLocaleString('fr-FR');
  if (earnedEl) earnedEl.textContent = '+' + Math.floor(g2048Score / G2048_POMEL_RATE).toLocaleString('fr-FR') + ' 🪙';
}

function g2048IsOver() {
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      if (g2048Grid[r][c] === 0) return false;
      if (c < 3 && g2048Grid[r][c] === g2048Grid[r][c + 1]) return false;
      if (r < 3 && g2048Grid[r][c] === g2048Grid[r + 1][c]) return false;
    }
  return true;
}

function g2048Has2048() {
  return g2048Grid.some(row => row.some(v => v >= 2048));
}

const G2048_DAILY_LIMIT = 20;

function g2048TodayPlays() {
  // Utiliser state pour la limite (synchronisé avec Firebase)
  const today = getTodayKey();
  if (!state._g2048PlaysDate || state._g2048PlaysDate !== today) return 0;
  return state._g2048PlaysCount || 0;
}
function g2048IncrPlays() {
  const today = getTodayKey();
  if (!state._g2048PlaysDate || state._g2048PlaysDate !== today) {
    state._g2048PlaysDate = today;
    state._g2048PlaysCount = 1;
  } else {
    state._g2048PlaysCount = (state._g2048PlaysCount || 0) + 1;
  }
  saveAccount(state);
}

function start2048() {
  const plays = g2048TodayPlays();
  if (plays >= G2048_DAILY_LIMIT) {
    document.getElementById('g2048OverlayTitle').textContent = '🚫 Limite atteinte';
    document.getElementById('g2048OverlaySub').textContent = `Tu as joué ${G2048_DAILY_LIMIT} parties aujourd'hui. Reviens demain !`;
    document.getElementById('g2048StartBtn').textContent = 'Demain…';
    document.getElementById('g2048StartBtn').disabled = true;
    return;
  }
  g2048IncrPlays();
  g2048Grid = g2048NewGrid();
  g2048Score = 0;
  g2048Won = false;
  g2048Running = true;
  document.getElementById('g2048StartBtn').disabled = false;
  document.getElementById('g2048Overlay').classList.add('hidden');
  g2048AddTile();
  g2048AddTile();
  g2048Render();
  g2048UpdateUI();
}

async function g2048GameOver() {
  g2048Running = false;
  const finalScore = g2048Score;
  const pomels = Math.floor(finalScore / G2048_POMEL_RATE);

  if (pomels > 0) {
    const g2048Upd = await addBalanceTransaction(state.code, pomels, {
      type: '2048', desc: `🔢 2048 — ${finalScore.toLocaleString('fr-FR')} pts`, amount: pomels, date: new Date().toISOString()
    });
    if (g2048Upd) { state = migrateAccount(g2048Upd); }
    else { state.balance += pomels; } // fallback local
    refreshUI();
  }

  await g2048SaveScore(finalScore);
  await g2048SaveWeeklyScore(finalScore);

  const overlay = document.getElementById('g2048Overlay');
  document.getElementById('g2048OverlayTitle').textContent = g2048Won ? '🎉 Bravo !' : '💀 Game Over !';
  const remaining = Math.max(0, G2048_DAILY_LIMIT - g2048TodayPlays());
  document.getElementById('g2048OverlaySub').innerHTML =
    `Score : <strong>${finalScore.toLocaleString('fr-FR')}</strong><br>` +
    `Tu gagnes <strong style="color:var(--green)">+${pomels.toLocaleString('fr-FR')} 🪙</strong><br>` +
    `<span style="font-size:.78rem;color:var(--muted);">Parties restantes aujourd'hui : ${remaining}/${G2048_DAILY_LIMIT}</span>`;
  const startBtn = document.getElementById('g2048StartBtn');
  if (remaining === 0) {
    startBtn.textContent = 'Demain…';
    startBtn.disabled = true;
  } else {
    startBtn.textContent = '🔄 Rejouer';
    startBtn.disabled = false;
  }
  overlay.classList.remove('hidden');

  await g2048RenderLb();
  await g2048RenderWeeklyLb();
}

function render2048Page() {
  g2048Running = false;
  g2048Grid = g2048NewGrid();
  g2048Score = 0;
  document.getElementById('g2048Score').textContent = '0';
  document.getElementById('g2048Earned').textContent = '+0 🪙';
  const remaining = Math.max(0, G2048_DAILY_LIMIT - g2048TodayPlays());
  document.getElementById('g2048OverlayTitle').textContent = '🔢 2048';
  const startBtn = document.getElementById('g2048StartBtn');
  if (remaining === 0) {
    document.getElementById('g2048OverlaySub').textContent = `Limite de ${G2048_DAILY_LIMIT} parties atteinte — reviens demain !`;
    startBtn.textContent = 'Demain…';
    startBtn.disabled = true;
  } else {
    document.getElementById('g2048OverlaySub').innerHTML = `Fusionne les tuiles identiques pour atteindre 2048 !<br><span style="font-size:.78rem;color:var(--muted);">${remaining} partie${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} aujourd'hui</span>`;
    startBtn.textContent = 'Jouer !';
    startBtn.disabled = false;
  }
  document.getElementById('g2048StartBtn').textContent = 'Jouer !';
  document.getElementById('g2048Overlay').classList.remove('hidden');
  g2048Render();
  g2048RenderLb();
  g2048RenderWeeklyLb();
  checkG2048WeeklyReset().catch(() => {});
}

// ── 2048 LEADERBOARD ─────────────────────────────
async function g2048SaveScore(score) {
  if (score === 0) return;
  const path = 'g2048_lb/' + state.code;
  const existing = await dbGet(path);
  if (!existing || score > existing.score) {
    await dbSet(path, { name: state.name, code: state.code, score, date: new Date().toISOString() });
  }
}

async function g2048RenderLb() {
  const list = document.getElementById('g2048LbList');
  if (!list) return;
  list.innerHTML = '<div class="history-empty">Chargement…</div>';
  const snap = await dbGet('g2048_lb');
  if (!snap) { list.innerHTML = '<div class="history-empty">Aucun score enregistré.</div>'; return; }
  const entries = Object.values(snap).sort((a, b) => b.score - a.score);
  list.innerHTML = '';
  const medals = ['🥇','🥈','🥉'];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const rank = i + 1;
    const isMe = e.code === state.code;
    const rankClass = rank <= 3 ? `top${rank}` : '';
    const div = document.createElement('div');
    div.className = 'snake-lb-item' + (isMe ? ' me' : '');
    const bc = await getAccBannerClass(e.code);
    if (bc) div.classList.add(bc);
    const cc = await getAccColorClass(e.code);
    div.innerHTML = `
      <span class="snake-lb-rank ${rankClass}">${medals[i] || rank}</span>
      <span class="snake-lb-name ${cc}">${escapeHTML(e.name)}${isMe ? ' <span class="lb-you-badge">Moi</span>' : ''}</span>
      <span class="snake-lb-score">${e.score.toLocaleString('fr-FR')} pts</span>
      <span class="snake-lb-pomels"></span>
    `;
    // Avatar snake lb
    const snakeAvWrap = document.createElement('div');
    snakeAvWrap.style.cssText = 'width:24px;height:24px;border-radius:50%;border:1px solid var(--border);overflow:hidden;background:var(--surface2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.55rem;font-weight:700;color:var(--muted);';
    getAccount(e.code).then(acc => { if (acc) renderAvatarInEl(snakeAvWrap, acc, 24); }).catch(() => {});
    div.insertBefore(snakeAvWrap, div.querySelector('.snake-lb-name'));
    list.appendChild(div);
  }
}

// ── 2048 WEEKLY LEADERBOARD ───────────────────────
const G2048_WEEKLY_PRIZES = [2000, 1500, 1000];
const G2048_WEEKLY_CONSOLATION = 500;

async function g2048SaveWeeklyScore(score) {
  if (score === 0) return;
  const safeCode = state.code.replace(/[.#$[\]/]/g, '_');
  const path = 'g2048_weekly_lb/' + safeCode;
  const existing = await dbGet(path);
  if (!existing || score > existing.score) {
    await dbSet(path, { name: state.name, code: state.code, score, date: new Date().toISOString() });
  }
}

async function g2048RenderWeeklyLb() {
  const list = document.getElementById('g2048WeeklyLbList');
  if (!list) return;
  list.innerHTML = '<div class="history-empty">Chargement…</div>';
  const snap = await dbGet('g2048_weekly_lb');
  if (!snap) { list.innerHTML = '<div class="history-empty">Aucun score cette semaine.</div>'; return; }
  const entries = Object.values(snap).sort((a, b) => b.score - a.score);
  list.innerHTML = '';
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const rank = i + 1;
    const isMe = e.code === state.code;
    const rankClass = rank <= 3 ? `top${rank}` : '';
    const prize = i < 3 ? G2048_WEEKLY_PRIZES[i] : G2048_WEEKLY_CONSOLATION;
    const div = document.createElement('div');
    div.className = 'snake-lb-item' + (isMe ? ' me' : '');
    const bc2 = await getAccBannerClass(e.code);
    if (bc2) div.classList.add(bc2);
    const cc2 = await getAccColorClass(e.code);
    div.innerHTML = `
    <span class="snake-lb-rank ${rankClass}">${['🥇','🥈','🥉'][i] || rank}</span>
    <span class="snake-lb-name ${cc2}">${escapeHTML(e.name)}${isMe ? ' <span class="lb-you-badge">Moi</span>' : ''}</span>
    <span class="snake-lb-score">${e.score.toLocaleString('fr-FR')} pts</span>
    `;
    list.appendChild(div);
  }
}

async function checkG2048WeeklyReset() {
  const now = new Date();
  if (now.getDay() !== 1 || now.getHours() < 9) return;
  // Clé = lundi de la semaine PRÉCÉDENTE (celle qu'on récompense)
  const prevMon = new Date(now);
  prevMon.setDate(now.getDate() - 7);
  const pDay2 = prevMon.getDay();
  const pDiff2 = pDay2 === 0 ? -6 : 1 - pDay2;
  prevMon.setDate(prevMon.getDate() + pDiff2);
  const prevWeekKey2048 = `${prevMon.getFullYear()}-${String(prevMon.getMonth()+1).padStart(2,'0')}-${String(prevMon.getDate()).padStart(2,'0')}`;
  const distributed = await dbGet('g2048_weekly_distributed/' + prevWeekKey2048);
  if (distributed) return;
  await dbSet('g2048_weekly_distributed/' + prevWeekKey2048, true);
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  const recheck2048 = await dbGet('g2048_weekly_distributed/' + prevWeekKey2048);
  if (recheck2048 !== true) return;
  const snap = await dbGet('g2048_weekly_lb');
  if (!snap) return;
  const entries = Object.values(snap).sort((a, b) => b.score - a.score);
  await distributeReliably(entries.map((e, i) => ({
    code: e.code, amount: i < 3 ? G2048_WEEKLY_PRIZES[i] : G2048_WEEKLY_CONSOLATION,
    historyEntry: { type: '2048', desc: `🔢 Classement hebdo 2048 — #${i+1}`, amount: i < 3 ? G2048_WEEKLY_PRIZES[i] : G2048_WEEKLY_CONSOLATION, date: new Date().toISOString() }
  })));
  await dbDelete('g2048_weekly_lb');
}

// ── CONTRÔLES 2048 (clavier) ─────────────────────
document.addEventListener('keydown', e => {
  // 2048
  if (g2048Running) {
    const dirMap = {
      ArrowLeft:'left', KeyQ:'left',
      ArrowRight:'right', KeyD:'right',
      ArrowUp:'up', KeyZ:'up',
      ArrowDown:'down', KeyS:'down',
    };
    const dir = dirMap[e.code];
    if (!dir) return;
    e.preventDefault();
    const changed = g2048Move(dir);
    if (changed) {
      if (!g2048Won && g2048Has2048()) {
        g2048Won = true;
        showWinToast('🎉 2048 atteint ! Continue pour un meilleur score !');
      }
      if (g2048IsOver()) g2048GameOver();
    }
  }
});

// ── CONTRÔLES 2048 (tactile) ─────────────────────
document.addEventListener('touchstart', e => {
  if (typeof snakeState !== 'undefined' && snakeState) {
    g2048TouchStart = null;
    return;
  }
  if (g2048Running) g2048TouchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

document.addEventListener('touchend', e => {
  if (!g2048Running || !g2048TouchStart) return;
  const dx = e.changedTouches[0].clientX - g2048TouchStart.x;
  const dy = e.changedTouches[0].clientY - g2048TouchStart.y;
  g2048TouchStart = null;
  if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
  const dir = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? 'right' : 'left')
    : (dy > 0 ? 'down' : 'up');
  const changed = g2048Move(dir);
  if (changed) {
    if (!g2048Won && g2048Has2048()) { g2048Won = true; showWinToast('🎉 2048 atteint !'); }
    if (g2048IsOver()) g2048GameOver();
  }
}, { passive: true });


console.log('[2048] Module loaded ✓');

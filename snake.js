/* ═══════════════════════════════════════════════════════════════════════════
   SNAKE.JS — Jeu Snake pour Pomel (extrait de index.html)
   ═══════════════════════════════════════════════════════════════════════════
   Dépend de : state, dbGet, dbSet, dbDelete, addBalanceTransaction,
               migrateAccount, refreshUI, escapeHTML, getAccBannerClass,
               getAccColorClass, distributeReliably, navTo
   ═══════════════════════════════════════════════════════════════════════════ */

// ── CSS (injecté au chargement) ──────────────────
(function() {
  const style = document.createElement('style');
  style.id = 'snake-styles';
  style.textContent = `
    .snake-wrap { display: flex; flex-direction: column; gap: 20px; }
    .snake-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .snake-score-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 20px; text-align: center; min-width: 110px; flex-shrink: 0; }
    .snake-score-label { font-size: .65rem; font-weight: 700; color: var(--muted); letter-spacing: .1em; text-transform: uppercase; }
    .snake-score-val { font-family: 'Space Mono', monospace; font-size: 1.5rem; font-weight: 700; color: var(--primary); }
    .snake-canvas-wrap { position: relative; width: 400px; max-width: 100%; margin: 0 auto; border-radius: 14px; overflow: hidden; border: 2px solid var(--border); box-shadow: 0 0 30px var(--primary-glow); background: #0a0a0c; }
    .snake-canvas-wrap canvas { display: block; width: 100%; height: auto; }
    .snake-overlay { position: absolute; inset: 0; background: rgba(13,13,15,0.88); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; backdrop-filter: blur(4px); }
    .snake-overlay.hidden { display: none; }
    .snake-overlay-title { font-size: 1.8rem; font-weight: 800; color: var(--primary); letter-spacing: -1px; }
    .snake-overlay-sub { font-size: .88rem; color: var(--muted); text-align: center; padding: 0 24px; line-height: 1.5; }
    .snake-controls-hint { display: flex; justify-content: center; gap: 24px; font-size: .78rem; color: var(--muted); flex-wrap: wrap; }
    .snake-lb-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }
    .snake-lb-title { font-size: .75rem; font-weight: 700; color: var(--muted); letter-spacing: .1em; text-transform: uppercase; margin-bottom: 14px; }
    .snake-lb-list { display: flex; flex-direction: column; gap: 8px; }
    .snake-lb-item { display: flex; align-items: center; gap: 12px; background: var(--surface2); border-radius: var(--radius-sm); padding: 10px 14px; transition: all var(--transition); }
    .snake-lb-item:hover { background: var(--surface3); }
    .snake-lb-item.me { border: 1px solid rgba(235,88,70,0.3); background: var(--primary-subtle); }
    .snake-lb-rank { font-family: 'Space Mono', monospace; font-weight: 700; width: 24px; color: var(--muted); flex-shrink: 0; }
    .snake-lb-rank.top1 { color: #FFD700; }
    .snake-lb-rank.top2 { color: #C0C0C0; }
    .snake-lb-rank.top3 { color: #CD7F32; }
    .snake-lb-name { flex: 1; font-weight: 700; font-size: .9rem; }
    .snake-lb-score { font-family: 'Space Mono', monospace; font-size: .85rem; color: var(--primary); font-weight: 700; }
    .snake-lb-pomels { font-family: 'Space Mono', monospace; font-size: .78rem; color: var(--green); }
    .snake-lb-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 700px) { .snake-lb-row { grid-template-columns: 1fr; } }
    .snake-dpad {
      display: none; margin: 0 auto; width: 180px; height: 180px;
      position: relative; user-select: none; -webkit-user-select: none;
    }
    .snake-dpad-btn {
      position: absolute; width: 56px; height: 56px; border-radius: 14px;
      background: var(--surface); border: 2px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem; cursor: pointer; transition: all .1s;
      -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    }
    .snake-dpad-btn:active { background: var(--primary); border-color: var(--primary); transform: scale(.9); }
    .snake-dpad-up    { top: 0;   left: 50%; transform: translateX(-50%); }
    .snake-dpad-down  { bottom: 0;left: 50%; transform: translateX(-50%); }
    .snake-dpad-left  { left: 0;  top: 50%;  transform: translateY(-50%); }
    .snake-dpad-right { right: 0; top: 50%;  transform: translateY(-50%); }
    .snake-dpad-center {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--surface2); border: 2px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      font-size: .65rem; font-weight: 700; color: var(--muted); cursor: pointer;
    }
    .snake-dpad-center:active { background: var(--yellow); border-color: var(--yellow); color: #000; }
    @media (max-width: 600px) {
      .snake-dpad { display: block; }
      .snake-controls-hint { display: none; }
      .snake-wrap { gap: 14px; }
      .snake-header { gap: 10px; }
      .snake-header .section-title { font-size: 1.1rem; }
      .snake-header .section-sub { font-size: .78rem; }
      .snake-score-box { min-width: 90px; padding: 10px 14px; }
      .snake-score-val { font-size: 1.2rem; }
      .snake-canvas-wrap { border-radius: 10px; border-width: 2px; touch-action: none; }
      .snake-controls-hint { font-size: .72rem; gap: 12px; }
      .snake-lb-item { padding: 8px 10px; gap: 8px; }
      .snake-lb-name { font-size: .82rem; }
      .snake-lb-score { font-size: .78rem; }
      .snake-lb-pomels { font-size: .72rem; }
    }
    @media (min-width: 601px) {
      .snake-dpad { display: none; }
    }
  `;
  document.head.appendChild(style);
})();


// ── CONSTANTES ───────────────────────────────────
const SNAKE_CELL = 20;
const SNAKE_COLS = 20;
const SNAKE_ROWS = 20;
const SNAKE_POMEL_PER_FRUIT = 5;
const SNAKE_MAX_LB = Infinity;

let snakeState = null;
let snakeLoop = null;
let snakePaused = false;
let snakePomelsEarned = 0;
let snakeLastDir = null;

const SNAKE_COLORS = {
  bg:      '#0a0a0c',
  grid:    '#111116',
  head:    '#EB5846',
  body:    '#c03c2c',
  fruit:   '#3ecf6e',
  fruitGlow: 'rgba(62,207,110,0.5)',
  text:    '#eeeef0',
};


// ── HELPERS ──────────────────────────────────────
function snakeCanvas()  { return document.getElementById('snakeCanvas'); }
function snakeCtx()     { return snakeCanvas().getContext('2d'); }
function snakeOverlay() { return document.getElementById('snakeOverlay'); }

function initSnakeState() {
  return {
    snake: [
      { x: 10, y: 10 },
      { x: 9,  y: 10 },
      { x: 8,  y: 10 },
    ],
    dir:   { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    fruit: randomFruit([{ x:10,y:10},{x:9,y:10},{x:8,y:10}]),
    score: 0,
    speed: 150,
  };
}

function randomFruit(snake) {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * SNAKE_COLS), y: Math.floor(Math.random() * SNAKE_ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}


// ── GAME ENGINE ──────────────────────────────────
function startSnake() {
  snakeState = initSnakeState();
  snakePomelsEarned = 0;
  snakePaused = false;
  snakeLastDir = null;
  snakeOverlay().classList.add('hidden');
  updateSnakeScoreUI();
  scheduleSnakeTick();
  renderSnake();
}

function scheduleSnakeTick() {
  if (snakeLoop) clearTimeout(snakeLoop);
  snakeLoop = setTimeout(snakeTick, snakeState.speed);
}

function snakeTick() {
  if (!snakeState || snakePaused) return;
  snakeState.dir = snakeState.nextDir;
  const head = snakeState.snake[0];
  const newHead = {
    x: (head.x + snakeState.dir.x + SNAKE_COLS) % SNAKE_COLS,
    y: (head.y + snakeState.dir.y + SNAKE_ROWS) % SNAKE_ROWS,
  };
  if (snakeState.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
    gameOverSnake();
    return;
  }
  snakeState.snake.unshift(newHead);
  if (newHead.x === snakeState.fruit.x && newHead.y === snakeState.fruit.y) {
    snakeState.score++;
    snakePomelsEarned += SNAKE_POMEL_PER_FRUIT;
    snakeState.fruit = randomFruit(snakeState.snake);
    if (snakeState.score % 5 === 0 && snakeState.speed > 65) {
      snakeState.speed = Math.max(65, snakeState.speed - 12);
    }
    updateSnakeScoreUI();
  } else {
    snakeState.snake.pop();
  }
  renderSnake();
  scheduleSnakeTick();
}

function updateSnakeScoreUI() {
  document.getElementById('snakeScore').textContent = snakeState ? snakeState.score : 0;
  document.getElementById('snakeEarned').textContent = '+' + snakePomelsEarned.toLocaleString('fr-FR') + ' 🪙';
}


// ── RENDERING ────────────────────────────────────
function renderSnake() {
  const ctx = snakeCtx();
  const C = SNAKE_CELL;
  ctx.fillStyle = SNAKE_COLORS.bg;
  ctx.fillRect(0, 0, SNAKE_COLS * C, SNAKE_ROWS * C);
  ctx.strokeStyle = SNAKE_COLORS.grid;
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= SNAKE_COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x * C, 0); ctx.lineTo(x * C, SNAKE_ROWS * C); ctx.stroke();
  }
  for (let y = 0; y <= SNAKE_ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * C); ctx.lineTo(SNAKE_COLS * C, y * C); ctx.stroke();
  }
  if (!snakeState) return;
  const f = snakeState.fruit;
  ctx.save();
  ctx.shadowColor = SNAKE_COLORS.fruitGlow;
  ctx.shadowBlur = 14;
  ctx.fillStyle = SNAKE_COLORS.fruit;
  ctx.beginPath();
  ctx.arc(f.x * C + C/2, f.y * C + C/2, C/2 - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  snakeState.snake.forEach((seg, i) => {
    const isHead = i === 0;
    ctx.save();
    ctx.fillStyle = isHead ? SNAKE_COLORS.head : SNAKE_COLORS.body;
    if (isHead) { ctx.shadowColor = 'rgba(235,88,70,0.6)'; ctx.shadowBlur = 10; }
    const r = isHead ? 6 : 4;
    _snakeRoundRect(ctx, seg.x * C + 1, seg.y * C + 1, C - 2, C - 2, r);
    ctx.fill();
    ctx.restore();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = "bold 11px 'Space Mono', monospace";
  ctx.fillText('Score: ' + snakeState.score, 8, 16);
}

function _snakeRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}


// ── GAME OVER ────────────────────────────────────
async function gameOverSnake() {
  if (snakeLoop) clearTimeout(snakeLoop);
  const finalScore = snakeState.score;
  const finalPomels = snakePomelsEarned;
  if (finalPomels > 0) {
    const snakeUpd = await addBalanceTransaction(state.code, finalPomels, {
      type: 'snake', desc: '🐍 Serpent — score ' + finalScore, amount: finalPomels, date: new Date().toISOString()
    });
    if (snakeUpd) { state = migrateAccount(snakeUpd); }
    else { state.balance += finalPomels; }
    refreshUI();
  }
  await saveSnakeScore(finalScore);
  await saveSnakeWeeklyScore(finalScore);
  const overlay = snakeOverlay();
  overlay.classList.remove('hidden');
  document.getElementById('snakeOverlayTitle').textContent = '💀 Game Over !';
  document.getElementById('snakeOverlaySub').innerHTML =
    'Score : <strong>' + finalScore + '</strong> fruit' + (finalScore > 1 ? 's' : '') + '<br>' +
    'Tu gagnes <strong style="color:var(--green)">+' + finalPomels.toLocaleString('fr-FR') + ' 🪙</strong>';
  document.getElementById('snakeStartBtn').textContent = '🔄 Rejouer';
  snakeState = null;
  updateSnakeScoreUI();
  await renderSnakeLb();
  await renderSnakeWeeklyLb();
}


// ── LEADERBOARD ──────────────────────────────────
async function saveSnakeScore(score) {
  if (score === 0) return;
  const path = 'snake_lb/' + state.code;
  const existing = await dbGet(path);
  if (!existing || score > existing.score) {
    await dbSet(path, { name: state.name, code: state.code, score, date: new Date().toISOString() });
  }
}

async function renderSnakeLb() {
  const list = document.getElementById('snakeLbList');
  list.innerHTML = '<div class="history-empty">Chargement…</div>';
  const snap = await dbGet('snake_lb');
  if (!snap) { list.innerHTML = '<div class="history-empty">Aucun score enregistré.</div>'; return; }
  const entries = Object.values(snap).sort((a, b) => b.score - a.score).slice(0, SNAKE_MAX_LB);
  list.innerHTML = '';
  const medals = ['🥇','🥈','🥉'];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const rank = i + 1;
    const isMe = e.code === state.code;
    const rankClass = rank <= 3 ? 'top' + rank : '';
    const medal = rank <= 3 ? medals[i] : '';
    const div = document.createElement('div');
    div.className = 'snake-lb-item' + (isMe ? ' me' : '');
    const bcS = await getAccBannerClass(e.code);
    if (bcS) div.classList.add(bcS);
    const ccS = await getAccColorClass(e.code);
    div.innerHTML =
      '<span class="snake-lb-rank ' + rankClass + '">' + (medal || rank) + '</span>' +
      '<span class="snake-lb-name ' + ccS + '">' + escapeHTML(e.name) + (isMe ? ' <span class="lb-you-badge">Moi</span>' : '') + '</span>' +
      '<span class="snake-lb-score">' + e.score + ' 🍎</span>' +
      '<span class="snake-lb-pomels">+' + (e.score * SNAKE_POMEL_PER_FRUIT).toLocaleString('fr-FR') + ' 🪙</span>';
    list.appendChild(div);
  }
}


// ── WEEKLY LEADERBOARD ───────────────────────────
const SNAKE_WEEKLY_PRIZES = [2000, 1500, 1000];
const SNAKE_WEEKLY_CONSOLATION = 500;

function getSnakeWeekKey() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon.getFullYear() + '-' + String(mon.getMonth()+1).padStart(2,'0') + '-' + String(mon.getDate()).padStart(2,'0');
}

async function saveSnakeWeeklyScore(score) {
  if (score === 0) return;
  const safeCode = state.code.replace(/[.#$[\]/]/g, '_');
  const path = 'snake_weekly_lb/' + safeCode;
  const existing = await dbGet(path);
  if (!existing || score > existing.score) {
    await dbSet(path, { name: state.name, code: state.code, score, date: new Date().toISOString() });
  }
}

async function renderSnakeWeeklyLb() {
  const list = document.getElementById('snakeWeeklyLbList');
  if (!list) return;
  list.innerHTML = '<div class="history-empty">Chargement…</div>';
  const snap = await dbGet('snake_weekly_lb');
  if (!snap) { list.innerHTML = '<div class="history-empty">Aucun score cette semaine.</div>'; return; }
  const entries = Object.values(snap).sort((a, b) => b.score - a.score);
  list.innerHTML = '';
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const rank = i + 1;
    const isMe = e.code === state.code;
    const rankClass = rank <= 3 ? 'top' + rank : '';
    const medal = rank <= 3 ? ['🥇','🥈','🥉'][i] : '';
    const div = document.createElement('div');
    div.className = 'snake-lb-item' + (isMe ? ' me' : '');
    const bcSW = await getAccBannerClass(e.code);
    if (bcSW) div.classList.add(bcSW);
    const ccSW = await getAccColorClass(e.code);
    div.innerHTML =
      '<span class="snake-lb-rank ' + rankClass + '">' + (medal || rank) + '</span>' +
      '<span class="snake-lb-name ' + ccSW + '">' + escapeHTML(e.name) + (isMe ? ' <span class="lb-you-badge">Moi</span>' : '') + '</span>' +
      '<span class="snake-lb-score">' + e.score + ' 🍎</span>';
    list.appendChild(div);
  }
}

async function checkSnakeWeeklyReset() {
  const now = new Date();
  if (now.getDay() !== 1 || now.getHours() < 9) return;
  const prevMon = new Date(now);
  prevMon.setDate(now.getDate() - 7);
  const pDay = prevMon.getDay();
  const pDiff = pDay === 0 ? -6 : 1 - pDay;
  prevMon.setDate(prevMon.getDate() + pDiff);
  const prevWeekKey = prevMon.getFullYear() + '-' + String(prevMon.getMonth()+1).padStart(2,'0') + '-' + String(prevMon.getDate()).padStart(2,'0');
  const distributed = await dbGet('snake_weekly_distributed/' + prevWeekKey);
  if (distributed) return;
  await dbSet('snake_weekly_distributed/' + prevWeekKey, true);
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  const recheck = await dbGet('snake_weekly_distributed/' + prevWeekKey);
  if (recheck !== true) return;
  const snap = await dbGet('snake_weekly_lb');
  if (!snap) return;
  const entries = Object.values(snap).sort((a, b) => b.score - a.score);
  await distributeReliably(entries.map((e, i) => ({
    code: e.code, amount: i < 3 ? SNAKE_WEEKLY_PRIZES[i] : SNAKE_WEEKLY_CONSOLATION,
    historyEntry: { type: 'snake', desc: '🐍 Classement hebdo Serpent — #' + (i+1), amount: i < 3 ? SNAKE_WEEKLY_PRIZES[i] : SNAKE_WEEKLY_CONSOLATION, date: new Date().toISOString() }
  })));
  await dbDelete('snake_weekly_lb');
}


// ── PAGE RENDER ──────────────────────────────────
function renderSnakePage() {
  const ctx = snakeCtx();
  ctx.fillStyle = SNAKE_COLORS.bg;
  ctx.fillRect(0, 0, SNAKE_COLS * SNAKE_CELL, SNAKE_ROWS * SNAKE_CELL);
  ctx.strokeStyle = SNAKE_COLORS.grid;
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= SNAKE_COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x*SNAKE_CELL,0); ctx.lineTo(x*SNAKE_CELL,SNAKE_ROWS*SNAKE_CELL); ctx.stroke();
  }
  for (let y = 0; y <= SNAKE_ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0,y*SNAKE_CELL); ctx.lineTo(SNAKE_COLS*SNAKE_CELL,y*SNAKE_CELL); ctx.stroke();
  }
  document.getElementById('snakeOverlayTitle').textContent = '🐍 Serpent';
  document.getElementById('snakeOverlaySub').textContent = 'Mange des fruits pour gagner des Pomels !';
  document.getElementById('snakeStartBtn').textContent = 'Jouer !';
  snakeOverlay().classList.remove('hidden');
  document.getElementById('snakeScore').textContent = '0';
  document.getElementById('snakeEarned').textContent = '+0 🪙';
  renderSnakeLb();
  renderSnakeWeeklyLb();
  checkSnakeWeeklyReset().catch(() => {});
}


// ── MOBILE CONTROLS ──────────────────────────────
function snakeDpadDir(x, y) {
  if (!snakeState) return;
  const cur = snakeState.dir;
  if (x === -cur.x && y === -cur.y) return;
  snakeState.nextDir = { x, y };
}

function snakeTogglePause() {
  if (!snakeState) return;
  snakePaused = !snakePaused;
  if (!snakePaused) scheduleSnakeTick();
  const centerBtn = document.querySelector('.snake-dpad-center');
  if (centerBtn) centerBtn.textContent = snakePaused ? '▶' : '⏸';
}

// Swipe tactile sur le canvas
let _snakeTouchStart = null;
(function() {
  const canvasWrap = () => document.querySelector('.snake-canvas-wrap');
  document.addEventListener('touchstart', e => {
    if (!snakeState) return;
    const wrap = canvasWrap();
    if (!wrap || !wrap.contains(e.target)) return;
    _snakeTouchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!snakeState || !_snakeTouchStart) return;
    const dx = e.changedTouches[0].clientX - _snakeTouchStart.x;
    const dy = e.changedTouches[0].clientY - _snakeTouchStart.y;
    _snakeTouchStart = null;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    const dir = Math.abs(dx) > Math.abs(dy)
      ? { x: dx > 0 ? 1 : -1, y: 0 }
      : { x: 0, y: dy > 0 ? 1 : -1 };
    const cur = snakeState.dir;
    if (dir.x === -cur.x && dir.y === -cur.y) return;
    snakeState.nextDir = dir;
  }, { passive: true });
})();


// ── KEYBOARD CONTROLS ────────────────────────────
document.addEventListener('keydown', e => {
  if (!snakeState) return;
  if (e.code === 'Space') {
    e.preventDefault();
    snakePaused = !snakePaused;
    if (!snakePaused) scheduleSnakeTick();
    return;
  }
  const dirs = {
    ArrowUp: {x:0,y:-1}, KeyZ: {x:0,y:-1},
    ArrowDown: {x:0,y:1}, KeyS: {x:0,y:1},
    ArrowLeft: {x:-1,y:0}, KeyQ: {x:-1,y:0},
    ArrowRight: {x:1,y:0}, KeyD: {x:1,y:0},
  };
  const newDir = dirs[e.code];
  if (!newDir) return;
  e.preventDefault();
  const cur = snakeState.dir;
  if (newDir.x === -cur.x && newDir.y === -cur.y) return;
  snakeState.nextDir = newDir;
});

console.log('[Snake] Module loaded ✓');

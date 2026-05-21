/* ═══════════════════════════════════════════════════════════════════════════
   TETRIS.JS — Tetris pour Pomel
   ═══════════════════════════════════════════════════════════════════════════
   Dépend de : state, dbGet, dbSet, dbDelete, addBalanceTransaction,
               migrateAccount, refreshUI, escapeHTML,
               getAccBannerClass, getAccColorClass, distributeReliably
   ═══════════════════════════════════════════════════════════════════════════ */

// ── CSS ──────────────────────────────────────────
(function() {
  const style = document.createElement('style');
  style.id = 'tetris-styles';
  style.textContent = `
    .tetris-wrap { display: flex; flex-direction: column; gap: 20px; }
    .tetris-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .tetris-info-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .tetris-score-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 18px; text-align: center; min-width: 90px; flex-shrink: 0; }
    .tetris-score-label { font-size: .65rem; font-weight: 700; color: var(--muted); letter-spacing: .1em; text-transform: uppercase; }
    .tetris-score-val { font-family: 'Space Mono', monospace; font-size: 1.3rem; font-weight: 700; color: var(--primary); }
    .tetris-game-row { display: flex; gap: 20px; justify-content: center; align-items: flex-start; flex-wrap: wrap; }
    .tetris-canvas-wrap { position: relative; border-radius: 14px; overflow: hidden; border: 2px solid var(--border); box-shadow: 0 0 30px var(--primary-glow); background: #0a0a0c; flex-shrink: 0; }
    .tetris-canvas-wrap canvas { display: block; }
    .tetris-overlay { position: absolute; inset: 0; background: rgba(13,13,15,0.88); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; backdrop-filter: blur(4px); }
    .tetris-overlay.hidden { display: none; }
    .tetris-overlay-title { font-size: 1.6rem; font-weight: 800; color: var(--primary); letter-spacing: -1px; }
    .tetris-overlay-sub { font-size: .85rem; color: var(--muted); text-align: center; padding: 0 20px; line-height: 1.5; }
    .tetris-side { display: flex; flex-direction: column; gap: 14px; min-width: 120px; }
    .tetris-next-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; text-align: center; }
    .tetris-next-box canvas { display: block; margin: 8px auto 0; background: #0a0a0c; border-radius: 6px; }
    .tetris-controls-hint { display: flex; flex-direction: column; gap: 4px; font-size: .72rem; color: var(--muted); }
    .tetris-dpad { display: none; margin: 0 auto; gap: 6px; flex-wrap: wrap; justify-content: center; }
    .tetris-dpad-btn { width: 52px; height: 52px; border-radius: 12px; background: var(--surface); border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; cursor: pointer; transition: all .1s; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    .tetris-dpad-btn:active { background: var(--primary); border-color: var(--primary); transform: scale(.9); }
    @media (max-width: 600px) {
      .tetris-dpad { display: flex; }
      .tetris-controls-hint { display: none; }
      .tetris-canvas-wrap { border-radius: 10px; }
      .tetris-game-row { gap: 12px; }
      .tetris-score-box { padding: 8px 12px; min-width: 70px; }
      .tetris-score-val { font-size: 1.1rem; }
    }
  `;
  document.head.appendChild(style);
})();


// ── CONSTANTES ───────────────────────────────────
const TET_COLS = 10;
const TET_ROWS = 18;
const TET_CELL = 25;
const TET_POMEL_PER_LINE = 3;
const TET_INITIAL_SPEED = 500; // ms entre chaque descente (était 800)
const TET_MIN_SPEED = 60;
const TET_SPEED_DECREASE = 35; // ms plus rapide par 5 lignes

// Les 7 pièces classiques (I, O, T, S, Z, L, J)
const TET_PIECES = {
  I: { shape: [[1,1,1,1]], color: '#00d4ff' },
  O: { shape: [[1,1],[1,1]], color: '#f0c040' },
  T: { shape: [[0,1,0],[1,1,1]], color: '#aa44dd' },
  S: { shape: [[0,1,1],[1,1,0]], color: '#3ecf6e' },
  Z: { shape: [[1,1,0],[0,1,1]], color: '#EB5846' },
  L: { shape: [[1,0],[1,0],[1,1]], color: '#ff8844' },
  J: { shape: [[0,1],[0,1],[1,1]], color: '#3a7bd4' },
};
const TET_PIECE_KEYS = Object.keys(TET_PIECES);

// ── STATE ────────────────────────────────────────
let _tetState = null;
let _tetLoop = null;
let _tetPomels = 0;

function tetCanvas()  { return document.getElementById('tetrisCanvas'); }
function tetCtx()     { return tetCanvas().getContext('2d'); }
function tetOverlay() { return document.getElementById('tetrisOverlay'); }


// ── PIECE HELPERS ────────────────────────────────
function tetRandomPiece() {
  const key = TET_PIECE_KEYS[Math.floor(Math.random() * TET_PIECE_KEYS.length)];
  const def = TET_PIECES[key];
  return {
    shape: def.shape.map(row => [...row]),
    color: def.color,
    x: Math.floor((TET_COLS - def.shape[0].length) / 2),
    y: 0,
  };
}

function tetRotate(shape) {
  const rows = shape.length;
  const cols = shape[0].length;
  const rotated = [];
  for (let c = 0; c < cols; c++) {
    const newRow = [];
    for (let r = rows - 1; r >= 0; r--) {
      newRow.push(shape[r][c]);
    }
    rotated.push(newRow);
  }
  return rotated;
}

function tetCollides(board, piece, offsetX, offsetY) {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      const bx = piece.x + c + offsetX;
      const by = piece.y + r + offsetY;
      if (bx < 0 || bx >= TET_COLS || by >= TET_ROWS) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
  }
  return false;
}


// ── GAME ENGINE ──────────────────────────────────
function startTetris() {
  const board = [];
  for (let r = 0; r < TET_ROWS; r++) board.push(new Array(TET_COLS).fill(null));
  _tetState = {
    board,
    current: tetRandomPiece(),
    next: tetRandomPiece(),
    lines: 0,
    speed: TET_INITIAL_SPEED,
    running: true,
    lastDrop: Date.now(),
  };
  _tetPomels = 0;
  tetOverlay().classList.add('hidden');
  updateTetrisUI();
  renderTetrisNext();
  if (_tetLoop) cancelAnimationFrame(_tetLoop);
  _tetLoop = requestAnimationFrame(tetTick);
}

function tetTick() {
  if (!_tetState || !_tetState.running) return;
  const now = Date.now();
  if (now - _tetState.lastDrop >= _tetState.speed) {
    _tetState.lastDrop = now;
    tetDropOne();
  }
  renderTetris();
  _tetLoop = requestAnimationFrame(tetTick);
}

function tetDropOne() {
  const s = _tetState;
  if (!s) return;
  if (!tetCollides(s.board, s.current, 0, 1)) {
    s.current.y++;
  } else {
    // Placer la pièce
    tetPlace(s);
    // Vérifier lignes
    const cleared = tetClearLines(s);
    if (cleared > 0) {
      s.lines += cleared;
      _tetPomels += cleared * TET_POMEL_PER_LINE;
      // Accélérer tous les 5 lignes
      s.speed = Math.max(TET_MIN_SPEED, TET_INITIAL_SPEED - Math.floor(s.lines / 5) * TET_SPEED_DECREASE);
      updateTetrisUI();
    }
    // Nouvelle pièce
    s.current = s.next;
    s.next = tetRandomPiece();
    renderTetrisNext();
    // Game over ?
    if (tetCollides(s.board, s.current, 0, 0)) {
      gameOverTetris();
    }
  }
}

function tetPlace(s) {
  const p = s.current;
  for (let r = 0; r < p.shape.length; r++) {
    for (let c = 0; c < p.shape[r].length; c++) {
      if (!p.shape[r][c]) continue;
      const by = p.y + r;
      const bx = p.x + c;
      if (by >= 0 && by < TET_ROWS && bx >= 0 && bx < TET_COLS) {
        s.board[by][bx] = p.color;
      }
    }
  }
}

function tetClearLines(s) {
  let cleared = 0;
  for (let r = TET_ROWS - 1; r >= 0; r--) {
    if (s.board[r].every(cell => cell !== null)) {
      s.board.splice(r, 1);
      s.board.unshift(new Array(TET_COLS).fill(null));
      cleared++;
      r++; // re-check cette ligne (elle a changé)
    }
  }
  return cleared;
}

function tetHardDrop() {
  if (!_tetState) return;
  while (!tetCollides(_tetState.board, _tetState.current, 0, 1)) {
    _tetState.current.y++;
  }
  _tetState.lastDrop = 0; // force un tick immédiat
}

// ── INPUT ────────────────────────────────────────
function tetrisMove(dir) {
  const s = _tetState;
  if (!s || !s.running) return;
  switch (dir) {
    case 'left':
      if (!tetCollides(s.board, s.current, -1, 0)) s.current.x--;
      break;
    case 'right':
      if (!tetCollides(s.board, s.current, 1, 0)) s.current.x++;
      break;
    case 'down':
      if (!tetCollides(s.board, s.current, 0, 1)) {
        s.current.y++;
        s.lastDrop = Date.now();
      }
      break;
    case 'rotate': {
      const rotated = tetRotate(s.current.shape);
      const old = s.current.shape;
      s.current.shape = rotated;
      // Wall kick : essayer décalages si collision
      if (tetCollides(s.board, s.current, 0, 0)) {
        if (!tetCollides(s.board, s.current, -1, 0)) { s.current.x--; }
        else if (!tetCollides(s.board, s.current, 1, 0)) { s.current.x++; }
        else if (!tetCollides(s.board, s.current, -2, 0)) { s.current.x -= 2; }
        else if (!tetCollides(s.board, s.current, 2, 0)) { s.current.x += 2; }
        else { s.current.shape = old; } // Annuler rotation
      }
      break;
    }
    case 'drop':
      tetHardDrop();
      break;
  }
}


// ── RENDERING ────────────────────────────────────
function renderTetris() {
  const ctx = tetCtx();
  const s = _tetState;
  const C = TET_CELL;

  // Background
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, TET_COLS * C, TET_ROWS * C);

  // Grille
  ctx.strokeStyle = '#151520';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= TET_COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x * C, 0); ctx.lineTo(x * C, TET_ROWS * C); ctx.stroke();
  }
  for (let y = 0; y <= TET_ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * C); ctx.lineTo(TET_COLS * C, y * C); ctx.stroke();
  }

  if (!s) return;

  // Board (pièces posées)
  for (let r = 0; r < TET_ROWS; r++) {
    for (let c = 0; c < TET_COLS; c++) {
      if (s.board[r][c]) {
        ctx.fillStyle = s.board[r][c];
        _tetRoundRect(ctx, c * C + 1, r * C + 1, C - 2, C - 2, 3);
        ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(c * C + 2, r * C + 2, C - 6, 2);
      }
    }
  }

  // Ghost (prévisualisation de la position d'atterrissage)
  const ghost = { ...s.current, shape: s.current.shape, y: s.current.y };
  while (!tetCollides(s.board, ghost, 0, 1)) ghost.y++;
  ctx.globalAlpha = 0.15;
  for (let r = 0; r < ghost.shape.length; r++) {
    for (let c = 0; c < ghost.shape[r].length; c++) {
      if (!ghost.shape[r][c]) continue;
      ctx.fillStyle = s.current.color;
      ctx.fillRect((ghost.x + c) * C + 1, (ghost.y + r) * C + 1, C - 2, C - 2);
    }
  }
  ctx.globalAlpha = 1;

  // Pièce courante
  for (let r = 0; r < s.current.shape.length; r++) {
    for (let c = 0; c < s.current.shape[r].length; c++) {
      if (!s.current.shape[r][c]) continue;
      const px = (s.current.x + c) * C;
      const py = (s.current.y + r) * C;
      ctx.fillStyle = s.current.color;
      ctx.save();
      ctx.shadowColor = s.current.color;
      ctx.shadowBlur = 6;
      _tetRoundRect(ctx, px + 1, py + 1, C - 2, C - 2, 3);
      ctx.fill();
      ctx.restore();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(px + 2, py + 2, C - 6, 2);
    }
  }
}

function renderTetrisNext() {
  const canvas = document.getElementById('tetrisNextCanvas');
  if (!canvas || !_tetState) return;
  const ctx = canvas.getContext('2d');
  const C = 20;
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, 100, 100);
  const p = _tetState.next;
  const offX = Math.floor((5 - p.shape[0].length) / 2);
  const offY = Math.floor((5 - p.shape.length) / 2);
  for (let r = 0; r < p.shape.length; r++) {
    for (let c = 0; c < p.shape[r].length; c++) {
      if (!p.shape[r][c]) continue;
      ctx.fillStyle = p.color;
      _tetRoundRect(ctx, (offX + c) * C + 1, (offY + r) * C + 1, C - 2, C - 2, 2);
      ctx.fill();
    }
  }
}

function renderTetrisIdle() {
  const ctx = tetCtx();
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, TET_COLS * TET_CELL, TET_ROWS * TET_CELL);
  ctx.strokeStyle = '#151520';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= TET_COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x * TET_CELL, 0); ctx.lineTo(x * TET_CELL, TET_ROWS * TET_CELL); ctx.stroke();
  }
  for (let y = 0; y <= TET_ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * TET_CELL); ctx.lineTo(TET_COLS * TET_CELL, y * TET_CELL); ctx.stroke();
  }
}

function _tetRoundRect(ctx, x, y, w, h, r) {
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

function updateTetrisUI() {
  const el = document.getElementById('tetrisLines');
  if (el) el.textContent = _tetState ? _tetState.lines : 0;
  const earned = document.getElementById('tetrisEarned');
  if (earned) earned.textContent = '+' + _tetPomels.toLocaleString('fr-FR') + ' 🪙';
}


// ── GAME OVER ────────────────────────────────────
async function gameOverTetris() {
  if (!_tetState) return;
  _tetState.running = false;
  if (_tetLoop) { cancelAnimationFrame(_tetLoop); _tetLoop = null; }

  const finalLines = _tetState.lines;
  const finalPomels = _tetPomels;

  // Animation de remplissage
  const ctx = tetCtx();
  ctx.fillStyle = 'rgba(235,88,70,0.3)';
  ctx.fillRect(0, 0, TET_COLS * TET_CELL, TET_ROWS * TET_CELL);

  // Award Pomels
  if (finalPomels > 0 && typeof addBalanceTransaction === 'function') {
    const upd = await addBalanceTransaction(state.code, finalPomels, {
      type: 'tetris', desc: '🧱 Tetris — ' + finalLines + ' lignes', amount: finalPomels, date: new Date().toISOString()
    });
    if (upd && typeof migrateAccount === 'function') { state = migrateAccount(upd); }
    else if (state) { state.balance = (state.balance || 0) + finalPomels; }
    if (typeof refreshUI === 'function') refreshUI();
  }

  await saveTetrisScore(finalLines);
  await saveTetrisWeeklyScore(finalLines);

  // Overlay
  const overlay = tetOverlay();
  overlay.classList.remove('hidden');
  document.getElementById('tetrisOverlayTitle').textContent = '💀 Game Over !';
  document.getElementById('tetrisOverlaySub').innerHTML =
    '<strong>' + finalLines + '</strong> ligne' + (finalLines > 1 ? 's' : '') + ' complétée' + (finalLines > 1 ? 's' : '') + '<br>' +
    'Tu gagnes <strong style="color:var(--green)">+' + finalPomels.toLocaleString('fr-FR') + ' 🪙</strong>';
  document.getElementById('tetrisStartBtn').textContent = '🔄 Rejouer';

  _tetState = null;
  updateTetrisUI();

  await renderTetrisLb();
  await renderTetrisWeeklyLb();
}


// ── LEADERBOARD ──────────────────────────────────
async function saveTetrisScore(score) {
  if (score === 0 || typeof dbGet !== 'function') return;
  const path = 'tetris_lb/' + state.code;
  const existing = await dbGet(path);
  if (!existing || score > existing.score) {
    await dbSet(path, { name: state.name, code: state.code, score, date: new Date().toISOString() });
  }
}

async function renderTetrisLb() {
  const list = document.getElementById('tetrisLbList');
  if (!list || typeof dbGet !== 'function') return;
  list.innerHTML = '<div class="history-empty">Chargement…</div>';
  const snap = await dbGet('tetris_lb');
  if (!snap) { list.innerHTML = '<div class="history-empty">Aucun score enregistré.</div>'; return; }
  const entries = Object.values(snap).sort((a, b) => b.score - a.score);
  list.innerHTML = '';
  const medals = ['🥇','🥈','🥉'];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const rank = i + 1;
    const isMe = e.code === state.code;
    const rankClass = rank <= 3 ? 'top' + rank : '';
    const div = document.createElement('div');
    div.className = 'snake-lb-item' + (isMe ? ' me' : '');
    if (typeof getAccBannerClass === 'function') {
      const bc = await getAccBannerClass(e.code);
      if (bc) div.classList.add(bc);
    }
    const cc = typeof getAccColorClass === 'function' ? await getAccColorClass(e.code) : '';
    div.innerHTML =
      '<span class="snake-lb-rank ' + rankClass + '">' + (medals[i] || rank) + '</span>' +
      '<span class="snake-lb-name ' + cc + '">' + (typeof escapeHTML === 'function' ? escapeHTML(e.name) : e.name) + (isMe ? ' <span class="lb-you-badge">Moi</span>' : '') + '</span>' +
      '<span class="snake-lb-score">' + e.score + ' lignes</span>' +
      '<span class="snake-lb-pomels">+' + (e.score * TET_POMEL_PER_LINE).toLocaleString('fr-FR') + ' 🪙</span>';
    list.appendChild(div);
  }
}


// ── WEEKLY LEADERBOARD ───────────────────────────
const TET_WEEKLY_PRIZES = [2000, 1500, 1000];
const TET_WEEKLY_CONSOLATION = 500;

function getTetrisWeekKey() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon.getFullYear() + '-' + String(mon.getMonth()+1).padStart(2,'0') + '-' + String(mon.getDate()).padStart(2,'0');
}

async function saveTetrisWeeklyScore(score) {
  if (score === 0 || typeof dbGet !== 'function') return;
  const safeCode = state.code.replace(/[.#$[\]/]/g, '_');
  const path = 'tetris_weekly_lb/' + safeCode;
  const existing = await dbGet(path);
  if (!existing || score > existing.score) {
    await dbSet(path, { name: state.name, code: state.code, score, date: new Date().toISOString() });
  }
}

async function renderTetrisWeeklyLb() {
  const list = document.getElementById('tetrisWeeklyLbList');
  if (!list || typeof dbGet !== 'function') return;
  list.innerHTML = '<div class="history-empty">Chargement…</div>';
  const snap = await dbGet('tetris_weekly_lb');
  if (!snap) { list.innerHTML = '<div class="history-empty">Aucun score cette semaine.</div>'; return; }
  const entries = Object.values(snap).sort((a, b) => b.score - a.score);
  list.innerHTML = '';
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const rank = i + 1;
    const isMe = e.code === state.code;
    const rankClass = rank <= 3 ? 'top' + rank : '';
    const div = document.createElement('div');
    div.className = 'snake-lb-item' + (isMe ? ' me' : '');
    if (typeof getAccBannerClass === 'function') {
      const bc = await getAccBannerClass(e.code);
      if (bc) div.classList.add(bc);
    }
    const cc = typeof getAccColorClass === 'function' ? await getAccColorClass(e.code) : '';
    div.innerHTML =
      '<span class="snake-lb-rank ' + rankClass + '">' + (['🥇','🥈','🥉'][i] || rank) + '</span>' +
      '<span class="snake-lb-name ' + cc + '">' + (typeof escapeHTML === 'function' ? escapeHTML(e.name) : e.name) + (isMe ? ' <span class="lb-you-badge">Moi</span>' : '') + '</span>' +
      '<span class="snake-lb-score">' + e.score + ' lignes</span>';
    list.appendChild(div);
  }
}

async function checkTetrisWeeklyReset() {
  const now = new Date();
  if (now.getDay() !== 1 || now.getHours() < 9) return;
  const prevMon = new Date(now);
  prevMon.setDate(now.getDate() - 7);
  const pDay = prevMon.getDay();
  const pDiff = pDay === 0 ? -6 : 1 - pDay;
  prevMon.setDate(prevMon.getDate() + pDiff);
  const prevWeekKey = prevMon.getFullYear() + '-' + String(prevMon.getMonth()+1).padStart(2,'0') + '-' + String(prevMon.getDate()).padStart(2,'0');
  if (typeof dbGet !== 'function') return;
  const distributed = await dbGet('tetris_weekly_distributed/' + prevWeekKey);
  if (distributed) return;
  await dbSet('tetris_weekly_distributed/' + prevWeekKey, true);
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  const recheck = await dbGet('tetris_weekly_distributed/' + prevWeekKey);
  if (recheck !== true) return;
  const snap = await dbGet('tetris_weekly_lb');
  if (!snap) return;
  const entries = Object.values(snap).sort((a, b) => b.score - a.score);
  if (typeof distributeReliably === 'function') {
    await distributeReliably(entries.map((e, i) => ({
      code: e.code, amount: i < 3 ? TET_WEEKLY_PRIZES[i] : TET_WEEKLY_CONSOLATION,
      historyEntry: { type: 'tetris', desc: '🧱 Classement hebdo Tetris — #' + (i+1), amount: i < 3 ? TET_WEEKLY_PRIZES[i] : TET_WEEKLY_CONSOLATION, date: new Date().toISOString() }
    })));
  }
  await dbDelete('tetris_weekly_lb');
}


// ── PAGE RENDER ──────────────────────────────────
function renderTetrisPage() {
  renderTetrisIdle();
  document.getElementById('tetrisOverlayTitle').textContent = '🧱 Tetris';
  document.getElementById('tetrisOverlaySub').textContent = 'Empile les blocs, complète des lignes !';
  document.getElementById('tetrisStartBtn').textContent = 'Jouer !';
  tetOverlay().classList.remove('hidden');
  document.getElementById('tetrisLines').textContent = '0';
  document.getElementById('tetrisEarned').textContent = '+0 🪙';
  // Clear next preview
  const nextCtx = document.getElementById('tetrisNextCanvas');
  if (nextCtx) { const c = nextCtx.getContext('2d'); c.fillStyle = '#0a0a0c'; c.fillRect(0, 0, 100, 100); }
  renderTetrisLb();
  renderTetrisWeeklyLb();
  checkTetrisWeeklyReset().catch(() => {});
}


// ── KEYBOARD CONTROLS ────────────────────────────
document.addEventListener('keydown', e => {
  if (!_tetState || !_tetState.running) return;
  switch (e.code) {
    case 'ArrowLeft':  case 'KeyQ': e.preventDefault(); tetrisMove('left'); break;
    case 'ArrowRight': case 'KeyD': e.preventDefault(); tetrisMove('right'); break;
    case 'ArrowDown':  case 'KeyS': e.preventDefault(); tetrisMove('down'); break;
    case 'ArrowUp':    case 'KeyZ': e.preventDefault(); tetrisMove('rotate'); break;
    case 'Space': e.preventDefault(); tetrisMove('drop'); break;
  }
});

// Touch swipe sur le canvas
let _tetTouchStart = null;
document.addEventListener('touchstart', e => {
  if (!_tetState || !_tetState.running) return;
  const wrap = document.querySelector('.tetris-canvas-wrap');
  if (wrap && wrap.contains(e.target)) {
    _tetTouchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }
}, { passive: true });

document.addEventListener('touchend', e => {
  if (!_tetState || !_tetTouchStart) return;
  const dx = e.changedTouches[0].clientX - _tetTouchStart.x;
  const dy = e.changedTouches[0].clientY - _tetTouchStart.y;
  const dt = Date.now() - _tetTouchStart.t;
  _tetTouchStart = null;
  if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && dt < 300) {
    tetrisMove('rotate'); return;
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    tetrisMove(dx > 0 ? 'right' : 'left');
  } else if (dy > 30) {
    tetrisMove('drop');
  }
}, { passive: true });

// Empêcher scroll mobile
document.addEventListener('touchmove', e => {
  if (!_tetState || !_tetState.running) return;
  if (e.target.closest('.tetris-canvas-wrap')) e.preventDefault();
}, { passive: false });

console.log('[Tetris] Module loaded ✓');

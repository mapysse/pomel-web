/* ═══════════════════════════════════════════════════════════════════════════
   DINO.JS — Dino Run pour Pomel (inspiré du jeu Chrome hors-ligne)
   ═══════════════════════════════════════════════════════════════════════════
   Dépend de : state, dbGet, dbSet, dbDelete, addBalanceTransaction,
               migrateAccount, refreshUI, escapeHTML,
               getAccBannerClass, getAccColorClass, distributeReliably
   ═══════════════════════════════════════════════════════════════════════════ */

// ── CSS ──────────────────────────────────────────
(function() {
  const style = document.createElement('style');
  style.id = 'dino-styles';
  style.textContent = `
    .dino-wrap { display: flex; flex-direction: column; gap: 20px; }
    .dino-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .dino-score-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 20px; text-align: center; min-width: 110px; flex-shrink: 0; }
    .dino-score-label { font-size: .65rem; font-weight: 700; color: var(--muted); letter-spacing: .1em; text-transform: uppercase; }
    .dino-score-val { font-family: 'Space Mono', monospace; font-size: 1.5rem; font-weight: 700; color: var(--primary); }
    .dino-canvas-wrap { position: relative; width: 600px; max-width: 100%; margin: 0 auto; border-radius: 14px; overflow: hidden; border: 2px solid var(--border); box-shadow: 0 0 30px var(--primary-glow); background: #1a1a2e; }
    .dino-canvas-wrap canvas { display: block; width: 100%; height: auto; }
    .dino-overlay { position: absolute; inset: 0; background: rgba(13,13,15,0.88); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; backdrop-filter: blur(4px); }
    .dino-overlay.hidden { display: none; }
    .dino-overlay-title { font-size: 1.8rem; font-weight: 800; color: var(--primary); letter-spacing: -1px; }
    .dino-overlay-sub { font-size: .88rem; color: var(--muted); text-align: center; padding: 0 24px; line-height: 1.5; }
    .dino-controls-hint { display: flex; justify-content: center; gap: 24px; font-size: .78rem; color: var(--muted); flex-wrap: wrap; }
    @media (max-width: 600px) {
      .dino-canvas-wrap { border-radius: 10px; border-width: 2px; }
      .dino-header { gap: 10px; }
      .dino-score-box { min-width: 90px; padding: 10px 14px; }
      .dino-score-val { font-size: 1.2rem; }
      .dino-controls-hint { font-size: .72rem; gap: 12px; }
    }
  `;
  document.head.appendChild(style);
})();


// ── CONSTANTES ───────────────────────────────────
const DINO_W = 600;
const DINO_H = 200;
const DINO_GROUND = 160;
const DINO_GRAVITY = 0.63;
const DINO_JUMP_FORCE = -11.2;
const DINO_POMEL_PER_OBSTACLE = 2;
const DINO_INITIAL_SPEED = 5.5;
const DINO_MAX_SPEED = 15;
const DINO_ACCEL = 0.0025; // accélération par frame (3× plus rapide qu'avant)

const DINO_COLORS = {
  bg:     '#1a1a2e',
  ground: '#2a2a44',
  dino:   '#EB5846',
  cactus: '#3ecf6e',
  bird:   '#f0c040',
  cloud:  '#2a2a44',
  text:   '#eeeef0',
};

// ── STATE ────────────────────────────────────────
let _dinoState = null;
let _dinoLoop = null;
let _dinoPomels = 0;

function dinoCanvas() { return document.getElementById('dinoCanvas'); }
function dinoCtx()    { return dinoCanvas().getContext('2d'); }
function dinoOverlay(){ return document.getElementById('dinoOverlay'); }


// ── GAME ENGINE ──────────────────────────────────
function initDinoState() {
  return {
    dino: { x: 60, y: DINO_GROUND, w: 24, h: 30, vy: 0, ducking: false },
    obstacles: [],
    clouds: [],
    score: 0,
    speed: DINO_INITIAL_SPEED,
    elapsed: 0, // temps total en secondes
    nextObstacleTimer: 0.8, // secondes avant prochain obstacle
    running: true,
    lastTime: 0,
  };
}

const DINO_TARGET_FPS = 60;
const DINO_FRAME_TIME = 1 / DINO_TARGET_FPS; // ~0.01667s

function startDino() {
  _dinoState = initDinoState();
  _dinoPomels = 0;
  dinoOverlay().classList.add('hidden');
  updateDinoUI();
  if (_dinoLoop) cancelAnimationFrame(_dinoLoop);
  _dinoState.lastTime = performance.now();
  _dinoLoop = requestAnimationFrame(dinoTick);
}

function dinoTick(timestamp) {
  if (!_dinoState || !_dinoState.running) return;
  const s = _dinoState;
  const d = s.dino;

  // Delta time : temps écoulé depuis la dernière frame, normalisé à 60fps
  const rawDt = (timestamp - s.lastTime) / 1000; // en secondes
  s.lastTime = timestamp;
  // Clamp dt pour éviter les sauts énormes (ex: onglet en arrière-plan)
  const dtSec = Math.min(rawDt, 0.05); // max 50ms (= 20fps min)
  const dt = dtSec / DINO_FRAME_TIME; // 1.0 = une frame à 60fps, 0.5 = 120fps, 2.0 = 30fps

  s.elapsed += dtSec;
  s.speed = Math.min(DINO_MAX_SPEED, DINO_INITIAL_SPEED + s.elapsed * 0.15); // accélère avec le temps réel

  // Gravité (ajustée par dt)
  d.vy += DINO_GRAVITY * dt;
  d.y += d.vy * dt;
  if (d.y >= DINO_GROUND) {
    d.y = DINO_GROUND;
    d.vy = 0;
  }

  // Taille du dino (baissé ou debout)
  d.h = d.ducking ? 18 : 30;

  // Obstacles — timer en secondes réelles
  s.nextObstacleTimer -= dtSec;
  if (s.nextObstacleTimer <= 0) {
    const type = Math.random() < (s.speed > 8 ? 0.25 : s.speed > 6 ? 0.1 : 0) ? 'bird' : 'cactus';
    const variants = type === 'cactus'
      ? [{ w: 14, h: 30 }, { w: 20, h: 35 }, { w: 28, h: 25 }, { w: 10, h: 40 }, { w: 36, h: 28 }]
      : [{ w: 22, h: 18 }, { w: 26, h: 14 }];
    const v = variants[Math.floor(Math.random() * variants.length)];
    const oy = type === 'bird' ? DINO_GROUND - 25 - Math.floor(Math.random() * 30) : DINO_GROUND + 30 - v.h;
    s.obstacles.push({ x: DINO_W + 10, y: oy, w: v.w, h: v.h, type, passed: false });

    // Double obstacle à haute vitesse
    if (type === 'cactus' && s.speed >= 10 && Math.random() < 0.2) {
      const v2 = variants[Math.floor(Math.random() * 3)];
      const gap2 = 45 + Math.floor(Math.random() * 20);
      s.obstacles.push({ x: DINO_W + 10 + gap2, y: DINO_GROUND + 30 - v2.h, w: v2.w, h: v2.h, type: 'cactus', passed: false });
    }

    // Prochain obstacle : timer en secondes (adaptatif à la vitesse)
    const minSec = Math.max(0.3, 0.6 - s.speed * 0.02);
    const maxSec = Math.max(0.5, 1.1 - s.speed * 0.03);
    s.nextObstacleTimer = minSec + Math.random() * (maxSec - minSec);
  }

  // Bouger les obstacles (dt-based)
  for (let i = s.obstacles.length - 1; i >= 0; i--) {
    const o = s.obstacles[i];
    o.x -= s.speed * dt;
    // Score quand passé
    if (!o.passed && o.x + o.w < d.x) {
      o.passed = true;
      s.score++;
      _dinoPomels += DINO_POMEL_PER_OBSTACLE;
      updateDinoUI();
    }
    // Supprimer si sorti
    if (o.x + o.w < -20) s.obstacles.splice(i, 1);
  }

  // Nuages décoratifs (basé sur le temps réel)
  if (Math.random() < dtSec * 0.5) { // ~1 nuage toutes les 2 secondes
    s.clouds.push({ x: DINO_W + 10, y: 20 + Math.random() * 40, w: 40 + Math.random() * 30 });
  }
  for (let i = s.clouds.length - 1; i >= 0; i--) {
    s.clouds[i].x -= s.speed * 0.3 * dt;
    if (s.clouds[i].x + s.clouds[i].w < -10) s.clouds.splice(i, 1);
  }

  // Collision
  const dBox = { x: d.x + 4, y: d.y + 30 - d.h + 2, w: d.w - 8, h: d.h - 4 };
  for (const o of s.obstacles) {
    if (dBox.x < o.x + o.w && dBox.x + dBox.w > o.x &&
        dBox.y < o.y + o.h && dBox.y + dBox.h > o.y) {
      gameOverDino();
      return;
    }
  }

  renderDino();
  _dinoLoop = requestAnimationFrame(dinoTick);
}

function dinoJump() {
  if (!_dinoState) return;
  const d = _dinoState.dino;
  if (d.y >= DINO_GROUND) {
    d.vy = DINO_JUMP_FORCE;
    d.ducking = false;
  }
}

function dinoDuck(active) {
  if (!_dinoState) return;
  _dinoState.dino.ducking = active;
  // Fast fall : si en l'air et qu'on appuie sur bas, accélérer la descente
  if (active && _dinoState.dino.y < DINO_GROUND) {
    _dinoState.dino.vy = Math.max(_dinoState.dino.vy, 8);
  }
}


// ── RENDERING ────────────────────────────────────
function renderDino() {
  const ctx = dinoCtx();
  const s = _dinoState;
  if (!s) return;

  // Background
  ctx.fillStyle = DINO_COLORS.bg;
  ctx.fillRect(0, 0, DINO_W, DINO_H);

  // Nuages
  ctx.fillStyle = DINO_COLORS.cloud;
  for (const c of s.clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x + c.w / 2, c.y, c.w / 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sol
  ctx.fillStyle = DINO_COLORS.ground;
  ctx.fillRect(0, DINO_GROUND + 30, DINO_W, 2);
  // Petits traits au sol pour effet de vitesse
  const dash = (s.elapsed * s.speed * 60) % 40;
  ctx.strokeStyle = DINO_COLORS.ground;
  ctx.lineWidth = 1;
  for (let x = -dash; x < DINO_W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, DINO_GROUND + 35);
    ctx.lineTo(x + 15, DINO_GROUND + 35);
    ctx.stroke();
  }

  // Dino
  const d = s.dino;
  const dinoY = d.y + 30 - d.h;
  ctx.fillStyle = DINO_COLORS.dino;
  ctx.save();
  ctx.shadowColor = 'rgba(235,88,70,0.5)';
  ctx.shadowBlur = 10;
  // Corps
  _dinoRoundRect(ctx, d.x, dinoY, d.w, d.h, 4);
  ctx.fill();
  ctx.restore();
  // Oeil
  ctx.fillStyle = '#fff';
  ctx.fillRect(d.x + d.w - 8, dinoY + 4, 4, 4);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(d.x + d.w - 6, dinoY + 5, 2, 2);
  // Pattes (animation de course)
  if (d.y >= DINO_GROUND && !d.ducking) {
    ctx.fillStyle = DINO_COLORS.dino;
    const legPhase = Math.floor(s.elapsed * 10) % 2;
    ctx.fillRect(d.x + 4 + legPhase * 4, dinoY + d.h, 4, 6);
    ctx.fillRect(d.x + 14 - legPhase * 4, dinoY + d.h, 4, 6);
  }

  // Obstacles
  for (const o of s.obstacles) {
    if (o.type === 'cactus') {
      ctx.fillStyle = DINO_COLORS.cactus;
      _dinoRoundRect(ctx, o.x, o.y, o.w, o.h, 3);
      ctx.fill();
      // Épines
      if (o.w > 12) {
        ctx.fillRect(o.x - 3, o.y + o.h * 0.3, 4, 6);
        ctx.fillRect(o.x + o.w - 1, o.y + o.h * 0.4, 4, 5);
      }
    } else {
      // Bird
      ctx.fillStyle = DINO_COLORS.bird;
      ctx.save();
      ctx.shadowColor = 'rgba(240,192,64,0.4)';
      ctx.shadowBlur = 8;
      // Corps
      ctx.beginPath();
      ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Ailes
      const wingOff = Math.sin(s.elapsed * 18) * 6;
      ctx.fillStyle = DINO_COLORS.bird;
      ctx.beginPath();
      ctx.moveTo(o.x + 4, o.y + o.h / 2);
      ctx.lineTo(o.x + o.w / 2, o.y - 4 + wingOff);
      ctx.lineTo(o.x + o.w - 4, o.y + o.h / 2);
      ctx.fill();
      // Oeil
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(o.x + o.w - 6, o.y + 4, 3, 3);
    }
  }

  // Score sur le canvas
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = "bold 12px 'Space Mono', monospace";
  ctx.textAlign = 'right';
  ctx.fillText('Score: ' + s.score, DINO_W - 12, 20);
  ctx.textAlign = 'left';

  // Vitesse indicator
  const speedPct = Math.min(1, (s.speed - DINO_INITIAL_SPEED) / (DINO_MAX_SPEED - DINO_INITIAL_SPEED));
  ctx.fillStyle = `rgba(235,88,70,${0.15 + speedPct * 0.3})`;
  ctx.fillRect(12, DINO_H - 10, speedPct * 80, 3);
}

function renderDinoIdle() {
  const ctx = dinoCtx();
  ctx.fillStyle = DINO_COLORS.bg;
  ctx.fillRect(0, 0, DINO_W, DINO_H);
  ctx.fillStyle = DINO_COLORS.ground;
  ctx.fillRect(0, DINO_GROUND + 30, DINO_W, 2);
  // Dino idle
  ctx.fillStyle = DINO_COLORS.dino;
  _dinoRoundRect(ctx, 60, DINO_GROUND, 24, 30, 4);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(76, DINO_GROUND + 4, 4, 4);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(78, DINO_GROUND + 5, 2, 2);
}

function _dinoRoundRect(ctx, x, y, w, h, r) {
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

function updateDinoUI() {
  const el = document.getElementById('dinoScore');
  if (el) el.textContent = _dinoState ? _dinoState.score : 0;
  const earned = document.getElementById('dinoEarned');
  if (earned) earned.textContent = '+' + _dinoPomels.toLocaleString('fr-FR') + ' 🪙';
}


// ── GAME OVER ────────────────────────────────────
async function gameOverDino() {
  _dinoState.running = false;
  if (_dinoLoop) { cancelAnimationFrame(_dinoLoop); _dinoLoop = null; }

  const finalScore = _dinoState.score;
  const finalPomels = _dinoPomels;

  // Flash rouge
  const ctx = dinoCtx();
  ctx.fillStyle = 'rgba(235,88,70,0.3)';
  ctx.fillRect(0, 0, DINO_W, DINO_H);

  // Award Pomels
  if (finalPomels > 0 && typeof addBalanceTransaction === 'function') {
    const upd = await addBalanceTransaction(state.code, finalPomels, {
      type: 'dino', desc: '🦕 Dino Run — score ' + finalScore, amount: finalPomels, date: new Date().toISOString()
    });
    if (upd && typeof migrateAccount === 'function') { state = migrateAccount(upd); }
    else if (state) { state.balance = (state.balance || 0) + finalPomels; }
    if (typeof refreshUI === 'function') refreshUI();
  }

  // Save leaderboards
  await saveDinoScore(finalScore);
  await saveDinoWeeklyScore(finalScore);

  // Overlay
  const overlay = dinoOverlay();
  overlay.classList.remove('hidden');
  document.getElementById('dinoOverlayTitle').textContent = '💀 Game Over !';
  document.getElementById('dinoOverlaySub').innerHTML =
    'Score : <strong>' + finalScore + '</strong> obstacle' + (finalScore > 1 ? 's' : '') + '<br>' +
    'Tu gagnes <strong style="color:var(--green)">+' + finalPomels.toLocaleString('fr-FR') + ' 🪙</strong>';
  document.getElementById('dinoStartBtn').textContent = '🔄 Rejouer';

  _dinoState = null;
  updateDinoUI();

  await renderDinoLb();
  await renderDinoWeeklyLb();
}


// ── LEADERBOARD ──────────────────────────────────
async function saveDinoScore(score) {
  if (score === 0 || typeof dbGet !== 'function') return;
  const path = 'dino_lb/' + state.code;
  const existing = await dbGet(path);
  if (!existing || score > existing.score) {
    await dbSet(path, { name: state.name, code: state.code, score, date: new Date().toISOString() });
  }
}

async function renderDinoLb() {
  const list = document.getElementById('dinoLbList');
  if (!list || typeof dbGet !== 'function') return;
  list.innerHTML = '<div class="history-empty">Chargement…</div>';
  const snap = await dbGet('dino_lb');
  if (!snap) { list.innerHTML = '<div class="history-empty">Aucun score enregistré.</div>'; return; }
  const entries = Object.values(snap).sort((a, b) => b.score - a.score);
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
    if (typeof getAccBannerClass === 'function') {
      const bc = await getAccBannerClass(e.code);
      if (bc) div.classList.add(bc);
    }
    const cc = typeof getAccColorClass === 'function' ? await getAccColorClass(e.code) : '';
    div.innerHTML =
      '<span class="snake-lb-rank ' + rankClass + '">' + (medal || rank) + '</span>' +
      '<span class="snake-lb-name ' + cc + '">' + (typeof escapeHTML === 'function' ? escapeHTML(e.name) : e.name) + (isMe ? ' <span class="lb-you-badge">Moi</span>' : '') + '</span>' +
      '<span class="snake-lb-score">' + e.score + ' 🌵</span>' +
      '<span class="snake-lb-pomels">+' + (e.score * DINO_POMEL_PER_OBSTACLE).toLocaleString('fr-FR') + ' 🪙</span>';
    list.appendChild(div);
  }
}


// ── WEEKLY LEADERBOARD ───────────────────────────
const DINO_WEEKLY_PRIZES = [2000, 1500, 1000];
const DINO_WEEKLY_CONSOLATION = 500;

function getDinoWeekKey() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon.getFullYear() + '-' + String(mon.getMonth()+1).padStart(2,'0') + '-' + String(mon.getDate()).padStart(2,'0');
}

async function saveDinoWeeklyScore(score) {
  if (score === 0 || typeof dbGet !== 'function') return;
  const safeCode = state.code.replace(/[.#$[\]/]/g, '_');
  const path = 'dino_weekly_lb/' + safeCode;
  const existing = await dbGet(path);
  if (!existing || score > existing.score) {
    await dbSet(path, { name: state.name, code: state.code, score, date: new Date().toISOString() });
  }
}

async function renderDinoWeeklyLb() {
  const list = document.getElementById('dinoWeeklyLbList');
  if (!list || typeof dbGet !== 'function') return;
  list.innerHTML = '<div class="history-empty">Chargement…</div>';
  const snap = await dbGet('dino_weekly_lb');
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
    if (typeof getAccBannerClass === 'function') {
      const bc = await getAccBannerClass(e.code);
      if (bc) div.classList.add(bc);
    }
    const cc = typeof getAccColorClass === 'function' ? await getAccColorClass(e.code) : '';
    div.innerHTML =
      '<span class="snake-lb-rank ' + rankClass + '">' + (medal || rank) + '</span>' +
      '<span class="snake-lb-name ' + cc + '">' + (typeof escapeHTML === 'function' ? escapeHTML(e.name) : e.name) + (isMe ? ' <span class="lb-you-badge">Moi</span>' : '') + '</span>' +
      '<span class="snake-lb-score">' + e.score + ' 🌵</span>';
    list.appendChild(div);
  }
}

async function checkDinoWeeklyReset() {
  const now = new Date();
  if (now.getDay() !== 1 || now.getHours() < 9) return;
  const prevMon = new Date(now);
  prevMon.setDate(now.getDate() - 7);
  const pDay = prevMon.getDay();
  const pDiff = pDay === 0 ? -6 : 1 - pDay;
  prevMon.setDate(prevMon.getDate() + pDiff);
  const prevWeekKey = prevMon.getFullYear() + '-' + String(prevMon.getMonth()+1).padStart(2,'0') + '-' + String(prevMon.getDate()).padStart(2,'0');
  if (typeof dbGet !== 'function') return;
  const distributed = await dbGet('dino_weekly_distributed/' + prevWeekKey);
  if (distributed) return;
  await dbSet('dino_weekly_distributed/' + prevWeekKey, true);
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  const recheck = await dbGet('dino_weekly_distributed/' + prevWeekKey);
  if (recheck !== true) return;
  const snap = await dbGet('dino_weekly_lb');
  if (!snap) return;
  const entries = Object.values(snap).sort((a, b) => b.score - a.score);
  if (typeof distributeReliably === 'function') {
    await distributeReliably(entries.map((e, i) => ({
      code: e.code, amount: i < 3 ? DINO_WEEKLY_PRIZES[i] : DINO_WEEKLY_CONSOLATION,
      historyEntry: { type: 'dino', desc: '🦕 Classement hebdo Dino — #' + (i+1), amount: i < 3 ? DINO_WEEKLY_PRIZES[i] : DINO_WEEKLY_CONSOLATION, date: new Date().toISOString() }
    })));
  }
  await dbDelete('dino_weekly_lb');
}


// ── PAGE RENDER ──────────────────────────────────
function renderDinoPage() {
  renderDinoIdle();
  document.getElementById('dinoOverlayTitle').textContent = '🦕 Dino Run';
  document.getElementById('dinoOverlaySub').textContent = 'Saute par-dessus les obstacles pour survivre !';
  document.getElementById('dinoStartBtn').textContent = 'Jouer !';
  dinoOverlay().classList.remove('hidden');
  document.getElementById('dinoScore').textContent = '0';
  document.getElementById('dinoEarned').textContent = '+0 🪙';
  renderDinoLb();
  renderDinoWeeklyLb();
  checkDinoWeeklyReset().catch(() => {});
}


// ── CONTROLS ─────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!_dinoState || !_dinoState.running) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyZ') {
    e.preventDefault();
    dinoJump();
  }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    dinoDuck(true);
  }
});

document.addEventListener('keyup', e => {
  if (!_dinoState) return;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    dinoDuck(false);
  }
});

// Touch / click pour sauter
document.addEventListener('touchstart', e => {
  if (!_dinoState || !_dinoState.running) return;
  const wrap = document.querySelector('.dino-canvas-wrap');
  if (wrap && wrap.contains(e.target)) {
    e.preventDefault();
    dinoJump();
  }
}, { passive: false });

document.addEventListener('click', e => {
  if (!_dinoState || !_dinoState.running) return;
  const wrap = document.querySelector('.dino-canvas-wrap');
  if (wrap && wrap.contains(e.target)) {
    dinoJump();
  }
});

// Empêcher le scroll sur mobile pendant le jeu
document.addEventListener('touchmove', e => {
  if (!_dinoState || !_dinoState.running) return;
  if (e.target.closest('.dino-canvas-wrap')) {
    e.preventDefault();
  }
}, { passive: false });

console.log('[Dino] Module loaded ✓');

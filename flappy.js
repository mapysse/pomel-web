/* ═══════════════════════════════════════════════════════════════════════════
   FLAPPY.JS — Flappy Pomel pour Pomel (inspiré de Flappy Bird)
   ═══════════════════════════════════════════════════════════════════════════
   Dépend de : state, dbGet, dbSet, dbDelete, addBalanceTransaction,
               migrateAccount, refreshUI, escapeHTML,
               getAccBannerClass, getAccColorClass, distributeReliably
   ═══════════════════════════════════════════════════════════════════════════ */

// ── CSS ──────────────────────────────────────────
(function() {
  const style = document.createElement('style');
  style.id = 'flappy-styles';
  style.textContent = `
    .flappy-wrap { display: flex; flex-direction: column; gap: 20px; }
    .flappy-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .flappy-score-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 20px; text-align: center; min-width: 110px; flex-shrink: 0; }
    .flappy-score-label { font-size: .65rem; font-weight: 700; color: var(--muted); letter-spacing: .1em; text-transform: uppercase; }
    .flappy-score-val { font-family: 'Space Mono', monospace; font-size: 1.5rem; font-weight: 700; color: var(--primary); }
    .flappy-canvas-wrap { position: relative; width: 400px; max-width: 100%; margin: 0 auto; border-radius: 14px; overflow: hidden; border: 2px solid var(--border); box-shadow: 0 0 30px var(--primary-glow); background: #1a1a2e; }
    .flappy-canvas-wrap canvas { display: block; width: 100%; height: auto; }
    .flappy-overlay { position: absolute; inset: 0; background: rgba(13,13,15,0.88); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; backdrop-filter: blur(4px); }
    .flappy-overlay.hidden { display: none; }
    .flappy-overlay-title { font-size: 1.8rem; font-weight: 800; color: var(--primary); letter-spacing: -1px; }
    .flappy-overlay-sub { font-size: .88rem; color: var(--muted); text-align: center; padding: 0 24px; line-height: 1.5; }
    .flappy-btn { margin-top: 6px; padding: 12px 28px; border-radius: 12px; border: none; background: var(--primary-gradient, var(--primary)); color: #fff; font-family: 'Inter', sans-serif; font-size: .95rem; font-weight: 700; cursor: pointer; box-shadow: 0 6px 20px var(--primary-glow); transition: transform .15s; }
    .flappy-btn:hover { transform: translateY(-2px); }
    .flappy-btn:active { transform: translateY(0); }
    .flappy-controls-hint { display: flex; justify-content: center; gap: 24px; font-size: .78rem; color: var(--muted); flex-wrap: wrap; }
    @media (max-width: 600px) {
      .flappy-canvas-wrap { border-radius: 10px; border-width: 2px; }
      .flappy-header { gap: 10px; }
      .flappy-score-box { min-width: 90px; padding: 10px 14px; }
      .flappy-score-val { font-size: 1.2rem; }
      .flappy-controls-hint { font-size: .72rem; gap: 12px; }
    }
  `;
  document.head.appendChild(style);
})();


// ── CONSTANTES ───────────────────────────────────
const FLAPPY_W = 400;
const FLAPPY_H = 520;
const FLAPPY_GRAVITY = 0.42;       // px/frame²
const FLAPPY_FLAP_FORCE = -7.2;    // impulsion vers le haut
const FLAPPY_MAX_FALL = 10.5;      // vitesse de chute max
const FLAPPY_BIRD_X = 90;          // position horizontale fixe de l'oiseau
const FLAPPY_BIRD_R = 14;          // rayon de hitbox
const FLAPPY_PIPE_W = 60;          // largeur d'un tuyau
const FLAPPY_GAP = 165;            // hauteur du trou entre les tuyaux
const FLAPPY_GAP_MIN = 128;        // trou minimal (resserre avec le score)
const FLAPPY_PIPE_SPEED = 3.0;     // vitesse de défilement initiale
const FLAPPY_PIPE_SPEED_MAX = 6.0;
const FLAPPY_PIPE_SPACING = 210;   // distance horizontale entre 2 tuyaux
const FLAPPY_POMEL_PER_PIPE = 3;   // Pomels par tuyau franchi

const FLAPPY_COLORS = {
  bg:      '#1a1a2e',
  bgGrad:  '#221941',
  pipe:    '#3ecf6e',
  pipeDark:'#2a9e54',
  bird:    '#FF9528',
  birdBeak:'#FFD24A',
  birdWing:'#FF4E8A',
  ground:  '#2a2a44',
  text:    '#eeeef0',
};

// ── STATE ────────────────────────────────────────
let _flappyState = null;
let _flappyLoop = null;
let _flappyPomels = 0;

function flappyCanvas() { return document.getElementById('flappyCanvas'); }
function flappyCtx()    { return flappyCanvas().getContext('2d'); }
function flappyOverlay(){ return document.getElementById('flappyOverlay'); }


// ── GAME ENGINE ──────────────────────────────────
function initFlappyState() {
  return {
    bird: { y: FLAPPY_H / 2, vy: 0, wingPhase: 0 },
    pipes: [],          // { x, gapY, passed }
    score: 0,
    speed: FLAPPY_PIPE_SPEED,
    elapsed: 0,
    groundOffset: 0,    // défilement du sol, synchronisé avec les tuyaux
    started: false,     // l'oiseau ne tombe qu'après le 1er flap
    running: true,
    lastTime: 0,
  };
}

const FLAPPY_TARGET_FPS = 60;
const FLAPPY_FRAME_TIME = 1 / FLAPPY_TARGET_FPS;

function startFlappy() {
  _flappyState = initFlappyState();
  _flappyPomels = 0;
  // Rendu net (pas de lissage qui rendrait les bords flous au déplacement)
  const ctx = flappyCtx();
  ctx.imageSmoothingEnabled = false;
  // Premier tuyau placé au loin
  _flappyState.pipes.push(makeFlappyPipe(FLAPPY_W + 120));
  flappyOverlay().classList.add('hidden');
  updateFlappyUI();
  if (_flappyLoop) cancelAnimationFrame(_flappyLoop);
  _flappyState.lastTime = performance.now();
  _flappyLoop = requestAnimationFrame(flappyTick);
}

function makeFlappyPipe(x) {
  // gapY = centre du trou. Marge pour ne pas coller au bord.
  const margin = 60;
  // Taille de base : se resserre progressivement avec le score
  const baseGap = _flappyState ? Math.max(FLAPPY_GAP_MIN, FLAPPY_GAP - Math.floor(_flappyState.score / 8) * 6) : FLAPPY_GAP;
  // Variation aléatoire par tuyau : entre 80% et 100% de la taille de base
  const variation = 0.80 + Math.random() * 0.20;
  // On garde un plancher absolu pour qu'un petit trou reste jouable
  const gapHeight = Math.max(FLAPPY_GAP_MIN, Math.round(baseGap * variation));
  const minY = margin + gapHeight / 2;
  const maxY = FLAPPY_H - margin - gapHeight / 2 - 40; // -40 pour le sol
  const gapY = minY + Math.random() * (maxY - minY);
  return { x, gapY, gapHeight, passed: false };
}

function flappyFlap() {
  if (!_flappyState || !_flappyState.running) return;
  _flappyState.started = true;
  _flappyState.bird.vy = FLAPPY_FLAP_FORCE;
  _flappyState.bird.wingPhase = 1;
}

function flappyTick(timestamp) {
  const s = _flappyState;
  if (!s || !s.running) return;

  let dt = (timestamp - s.lastTime) / 1000;
  s.lastTime = timestamp;
  // Cap : si l'onglet a été en arrière-plan, on évite un saut géant
  if (dt > 0.05) dt = 0.05;

  // Facteur normalisé : 1.0 = un frame de référence 60fps.
  // Sur 120Hz → ~0.5, sur 30Hz → ~2.0. Le mouvement épouse exactement
  // le rafraîchissement réel de l'écran → fluidité parfaite.
  const f = dt * 60;

  flappyStep(s, f);

  renderFlappy();
  if (s.running) _flappyLoop = requestAnimationFrame(flappyTick);
}

function flappyStep(s, f) {
  s.elapsed += f / 60;

  // L'oiseau ne tombe pas tant qu'on n'a pas flappé une 1ère fois
  if (s.started) {
    s.bird.vy = Math.min(FLAPPY_MAX_FALL, s.bird.vy + FLAPPY_GRAVITY * f);
    s.bird.y += s.bird.vy * f;
  }
  if (s.bird.wingPhase > 0) s.bird.wingPhase = Math.max(0, s.bird.wingPhase - 0.08 * f);

  // Accélération progressive
  s.speed = Math.min(FLAPPY_PIPE_SPEED_MAX, FLAPPY_PIPE_SPEED + s.score * 0.06);

  // Déplacer les tuyaux + sol (× f pour épouser le temps réel)
  if (s.started) {
    const dx = s.speed * f;
    for (const p of s.pipes) p.x -= dx;
    s.groundOffset = (s.groundOffset + dx) % 24;
  }

  // Générer un nouveau tuyau quand le dernier a assez avancé
  const last = s.pipes[s.pipes.length - 1];
  if (last && last.x < FLAPPY_W - FLAPPY_PIPE_SPACING) {
    s.pipes.push(makeFlappyPipe(FLAPPY_W + FLAPPY_PIPE_W));
  }
  // Supprimer les tuyaux sortis
  s.pipes = s.pipes.filter(p => p.x + FLAPPY_PIPE_W > -10);

  // Score : tuyau franchi
  for (const p of s.pipes) {
    if (!p.passed && p.x + FLAPPY_PIPE_W < FLAPPY_BIRD_X) {
      p.passed = true;
      s.score++;
      _flappyPomels += FLAPPY_POMEL_PER_PIPE;
      updateFlappyUI();
    }
  }

  // Collisions
  const by = s.bird.y;
  // Sol et plafond
  if (by + FLAPPY_BIRD_R >= FLAPPY_H - 40 || by - FLAPPY_BIRD_R <= 0) {
    flappyGameOver();
    return;
  }
  // Tuyaux
  for (const p of s.pipes) {
    const withinX = (FLAPPY_BIRD_X + FLAPPY_BIRD_R > p.x) && (FLAPPY_BIRD_X - FLAPPY_BIRD_R < p.x + FLAPPY_PIPE_W);
    if (withinX) {
      const gapTop = p.gapY - p.gapHeight / 2;
      const gapBot = p.gapY + p.gapHeight / 2;
      if (by - FLAPPY_BIRD_R < gapTop || by + FLAPPY_BIRD_R > gapBot) {
        flappyGameOver();
        return;
      }
    }
  }
}


// ── RENDERING ────────────────────────────────────
function renderFlappy() {
  const ctx = flappyCtx();
  const s = _flappyState;
  if (!s) return;

  // Fond dégradé
  const grad = ctx.createLinearGradient(0, 0, 0, FLAPPY_H);
  grad.addColorStop(0, FLAPPY_COLORS.bgGrad);
  grad.addColorStop(1, FLAPPY_COLORS.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FLAPPY_W, FLAPPY_H);

  // Tuyaux — positions arrondies au pixel (évite l'anti-aliasing scintillant)
  for (const p of s.pipes) {
    const px = Math.round(p.x);
    const gapTop = Math.round(p.gapY - p.gapHeight / 2);
    const gapBot = Math.round(p.gapY + p.gapHeight / 2);
    flappyDrawPipe(ctx, px, 0, FLAPPY_PIPE_W, gapTop, true);
    flappyDrawPipe(ctx, px, gapBot, FLAPPY_PIPE_W, (FLAPPY_H - 40) - gapBot, false);
  }

  // Sol
  ctx.fillStyle = FLAPPY_COLORS.ground;
  ctx.fillRect(0, FLAPPY_H - 40, FLAPPY_W, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = -Math.round(s.groundOffset); x < FLAPPY_W; x += 24) {
    ctx.fillRect(x, FLAPPY_H - 40, 12, 4);
  }

  // Oiseau (position Y arrondie)
  flappyDrawBird(ctx, FLAPPY_BIRD_X, Math.round(s.bird.y), s.bird.vy, s.bird.wingPhase);

  // Score (gros, centré en haut) si la partie a commencé
  if (s.started) {
    ctx.fillStyle = FLAPPY_COLORS.text;
    ctx.font = 'bold 42px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(s.score), FLAPPY_W / 2, 24);
  } else {
    ctx.fillStyle = FLAPPY_COLORS.text;
    ctx.font = '600 16px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tape / clique / espace pour voler', FLAPPY_W / 2, FLAPPY_H / 2 - 80);
  }
}

function flappyDrawPipe(ctx, x, y, w, h, isTop) {
  if (h <= 0) return;
  ctx.fillStyle = FLAPPY_COLORS.pipe;
  ctx.fillRect(x, y, w, h);
  // Bordure foncée
  ctx.fillStyle = FLAPPY_COLORS.pipeDark;
  ctx.fillRect(x, y, 4, h);
  ctx.fillRect(x + w - 4, y, 4, h);
  // Embout (lip)
  const lipH = 18, lipOver = 5;
  ctx.fillStyle = FLAPPY_COLORS.pipe;
  if (isTop) {
    ctx.fillRect(x - lipOver, y + h - lipH, w + lipOver * 2, lipH);
    ctx.fillStyle = FLAPPY_COLORS.pipeDark;
    ctx.fillRect(x - lipOver, y + h - lipH, 4, lipH);
    ctx.fillRect(x + w + lipOver - 4, y + h - lipH, 4, lipH);
  } else {
    ctx.fillRect(x - lipOver, y, w + lipOver * 2, lipH);
    ctx.fillStyle = FLAPPY_COLORS.pipeDark;
    ctx.fillRect(x - lipOver, y, 4, lipH);
    ctx.fillRect(x + w + lipOver - 4, y, 4, lipH);
  }
}

function flappyDrawBird(ctx, cx, cy, vy, wingPhase) {
  ctx.save();
  ctx.translate(cx, cy);
  // Rotation selon la vitesse verticale (pique vers le bas en chute)
  const angle = Math.max(-0.4, Math.min(1.2, vy / 12));
  ctx.rotate(angle);

  // Corps
  ctx.fillStyle = FLAPPY_COLORS.bird;
  ctx.beginPath();
  ctx.arc(0, 0, FLAPPY_BIRD_R, 0, Math.PI * 2);
  ctx.fill();

  // Aile (bat selon wingPhase)
  ctx.fillStyle = FLAPPY_COLORS.birdWing;
  const wingY = wingPhase > 0.5 ? -4 : 4;
  ctx.beginPath();
  ctx.ellipse(-3, wingY, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Œil
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(6, -5, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(7, -5, 2, 0, Math.PI * 2);
  ctx.fill();

  // Bec
  ctx.fillStyle = FLAPPY_COLORS.birdBeak;
  ctx.beginPath();
  ctx.moveTo(FLAPPY_BIRD_R - 2, 0);
  ctx.lineTo(FLAPPY_BIRD_R + 8, -3);
  ctx.lineTo(FLAPPY_BIRD_R + 8, 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function renderFlappyIdle() {
  const ctx = flappyCtx();
  const grad = ctx.createLinearGradient(0, 0, 0, FLAPPY_H);
  grad.addColorStop(0, FLAPPY_COLORS.bgGrad);
  grad.addColorStop(1, FLAPPY_COLORS.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FLAPPY_W, FLAPPY_H);
  // Sol
  ctx.fillStyle = FLAPPY_COLORS.ground;
  ctx.fillRect(0, FLAPPY_H - 40, FLAPPY_W, 40);
  // Oiseau au centre
  flappyDrawBird(ctx, FLAPPY_BIRD_X, FLAPPY_H / 2, 0, 0);
}

function updateFlappyUI() {
  const scoreEl = document.getElementById('flappyScore');
  const earnedEl = document.getElementById('flappyEarned');
  if (scoreEl) scoreEl.textContent = _flappyState ? _flappyState.score : 0;
  if (earnedEl) earnedEl.textContent = '+' + _flappyPomels.toLocaleString('fr-FR') + ' 🪙';
}

async function flappyGameOver() {
  if (!_flappyState) return;
  _flappyState.running = false;
  if (_flappyLoop) { cancelAnimationFrame(_flappyLoop); _flappyLoop = null; }

  const finalScore = _flappyState.score;
  const finalPomels = _flappyPomels;

  // Flash rouge
  const ctx = flappyCtx();
  ctx.fillStyle = 'rgba(235,88,70,0.3)';
  ctx.fillRect(0, 0, FLAPPY_W, FLAPPY_H);

  // Award Pomels
  if (finalPomels > 0 && typeof addBalanceTransaction === 'function') {
    const upd = await addBalanceTransaction(state.code, finalPomels, {
      type: 'flappy', desc: '🐤 Flappy Pomel — score ' + finalScore, amount: finalPomels, date: new Date().toISOString()
    });
    if (upd && typeof migrateAccount === 'function') { state = migrateAccount(upd); }
    else if (state) { state.balance = (state.balance || 0) + finalPomels; }
    if (typeof refreshUI === 'function') refreshUI();
  }

  // Save leaderboards
  await saveFlappyScore(finalScore);
  await saveFlappyWeeklyScore(finalScore);
  if (typeof bpReportScore === 'function') { try { await bpReportScore('flappy', finalScore); } catch(e) { console.error('bp report', e); } }

  // Overlay
  const overlay = flappyOverlay();
  overlay.classList.remove('hidden');
  document.getElementById('flappyOverlayTitle').textContent = '💀 Game Over !';
  document.getElementById('flappyOverlaySub').innerHTML =
    'Score : <strong>' + finalScore + '</strong> tuyau' + (finalScore > 1 ? 'x' : '') + '<br>' +
    'Tu gagnes <strong style="color:var(--green)">+' + finalPomels.toLocaleString('fr-FR') + ' 🪙</strong>';
  document.getElementById('flappyStartBtn').textContent = '🔄 Rejouer';

  _flappyState = null;
  updateFlappyUI();

  await renderFlappyLb();
  await renderFlappyWeeklyLb();
}


// ── LEADERBOARD ──────────────────────────────────
async function saveFlappyScore(score) {
  if (score === 0 || typeof dbGet !== 'function') return;
  const path = 'flappy_lb/' + state.code;
  const existing = await dbGet(path);
  if (!existing || score > existing.score) {
    await dbSet(path, { name: state.name, code: state.code, score, date: new Date().toISOString() });
  }
}

async function renderFlappyLb() {
  const list = document.getElementById('flappyLbList');
  if (!list || typeof dbGet !== 'function') return;
  list.innerHTML = '<div class="history-empty">Chargement…</div>';
  const snap = await dbGet('flappy_lb');
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
      '<span class="snake-lb-score">' + e.score + ' 🟢</span>' +
      '<span class="snake-lb-pomels">+' + (e.score * FLAPPY_POMEL_PER_PIPE).toLocaleString('fr-FR') + ' 🪙</span>';
    list.appendChild(div);
  }
}


// ── WEEKLY LEADERBOARD ───────────────────────────
const FLAPPY_WEEKLY_PRIZES = [2000, 1500, 1000];
const FLAPPY_WEEKLY_CONSOLATION = 500;

function getFlappyWeekKey() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon.getFullYear() + '-' + String(mon.getMonth()+1).padStart(2,'0') + '-' + String(mon.getDate()).padStart(2,'0');
}

async function saveFlappyWeeklyScore(score) {
  if (score === 0 || typeof dbGet !== 'function') return;
  const safeCode = state.code.replace(/[.#$[\]/]/g, '_');
  const path = 'flappy_weekly_lb/' + safeCode;
  const existing = await dbGet(path);
  if (!existing || score > existing.score) {
    await dbSet(path, { name: state.name, code: state.code, score, date: new Date().toISOString() });
  }
}

async function renderFlappyWeeklyLb() {
  const list = document.getElementById('flappyWeeklyLbList');
  if (!list || typeof dbGet !== 'function') return;
  list.innerHTML = '<div class="history-empty">Chargement…</div>';
  const snap = await dbGet('flappy_weekly_lb');
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
      '<span class="snake-lb-score">' + e.score + ' 🟢</span>';
    list.appendChild(div);
  }
}

async function checkFlappyWeeklyReset() {
  const now = new Date();
  if (now.getDay() !== 1 || now.getHours() < 9) return;
  const prevMon = new Date(now);
  prevMon.setDate(now.getDate() - 7);
  const pDay = prevMon.getDay();
  const pDiff = pDay === 0 ? -6 : 1 - pDay;
  prevMon.setDate(prevMon.getDate() + pDiff);
  const prevWeekKey = prevMon.getFullYear() + '-' + String(prevMon.getMonth()+1).padStart(2,'0') + '-' + String(prevMon.getDate()).padStart(2,'0');
  if (typeof dbGet !== 'function') return;
  const distributed = await dbGet('flappy_weekly_distributed/' + prevWeekKey);
  if (distributed) return;
  await dbSet('flappy_weekly_distributed/' + prevWeekKey, true);
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  const recheck = await dbGet('flappy_weekly_distributed/' + prevWeekKey);
  if (recheck !== true) return;
  const snap = await dbGet('flappy_weekly_lb');
  if (!snap) return;
  const entries = Object.values(snap).sort((a, b) => b.score - a.score);
  if (typeof distributeReliably === 'function') {
    await distributeReliably(entries.map((e, i) => ({
      code: e.code, amount: i < 3 ? FLAPPY_WEEKLY_PRIZES[i] : FLAPPY_WEEKLY_CONSOLATION,
      historyEntry: { type: 'flappy', desc: '🐤 Classement hebdo Flappy — #' + (i+1), amount: i < 3 ? FLAPPY_WEEKLY_PRIZES[i] : FLAPPY_WEEKLY_CONSOLATION, date: new Date().toISOString() }
    })));
  }
  await dbDelete('flappy_weekly_lb');
}


// ── PAGE RENDER ──────────────────────────────────
function renderFlappyPage() {
  renderFlappyIdle();
  document.getElementById('flappyOverlayTitle').textContent = '🐤 Flappy Pomel';
  document.getElementById('flappyOverlaySub').textContent = 'Tape pour voler et passe entre les tuyaux !';
  document.getElementById('flappyStartBtn').textContent = 'Jouer !';
  flappyOverlay().classList.remove('hidden');
  document.getElementById('flappyScore').textContent = '0';
  document.getElementById('flappyEarned').textContent = '+0 🪙';
  renderFlappyLb();
  renderFlappyWeeklyLb();
  checkFlappyWeeklyReset().catch(() => {});
}


// ── CONTROLS ─────────────────────────────────────
// Clavier : Espace / flèche haut / W / Z = flap
document.addEventListener('keydown', e => {
  if (!_flappyState || !_flappyState.running) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyZ') {
    e.preventDefault();
    flappyFlap();
  }
});

// Touch / click sur le canvas = flap
let _flappyTouchActive = false;
document.addEventListener('touchstart', e => {
  if (!_flappyState || !_flappyState.running) return;
  const wrap = document.querySelector('.flappy-canvas-wrap');
  if (wrap && wrap.contains(e.target)) {
    e.preventDefault();
    _flappyTouchActive = true;
    flappyFlap();
  }
}, { passive: false });

document.addEventListener('click', e => {
  if (!_flappyState || !_flappyState.running) return;
  if (_flappyTouchActive) return; // éviter double-flap sur le click fantôme iOS
  const wrap = document.querySelector('.flappy-canvas-wrap');
  if (wrap && wrap.contains(e.target)) {
    flappyFlap();
  }
});

document.addEventListener('touchend', () => {
  if (_flappyTouchActive) setTimeout(() => { _flappyTouchActive = false; }, 350);
}, { passive: true });

// Empêcher le scroll quand on tape sur le jeu
document.addEventListener('touchmove', e => {
  if (!_flappyState || !_flappyState.running) return;
  if (e.target.closest('.flappy-canvas-wrap')) e.preventDefault();
}, { passive: false });

console.log('[Flappy] Module loaded ✓');

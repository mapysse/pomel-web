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
let snakeRenderLoop = null;
let snakePaused = false;
let snakePomelsEarned = 0;
let snakeLastDir = null;

const SNAKE_COLORS = {
  bg:        '#0d0a1f',
  bg2:       '#15112c',
  grid:      'rgba(220,200,255,0.045)',
  headA:     '#FFD24A',
  headB:     '#FF9528',
  bodyA:     '#FF9528',
  bodyB:     '#FF4E8A',
  bodyTail:  '#A66BFF',
  outline:   '#2a1f4d',
  fruit:     '#4ED9F0',
  fruitCore: '#aef3ff',
  fruitGlow: 'rgba(78,217,240,0.6)',
  text:      '#eeeef0',
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
    dirQueue: [],          // file d'inputs (max 2) pour ne perdre aucune touche
    fruit: randomFruit([{ x:10,y:10},{x:9,y:10},{x:8,y:10}]),
    score: 0,
    speed: 120,
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
// Architecture : la LOGIQUE avance case par case sur setTimeout (gameplay
// inchangé), mais le RENDU tourne sur requestAnimationFrame et INTERPOLE la
// position des segments entre leur ancienne et leur nouvelle case → glissement
// fluide au lieu de sauts d'une case.

function startSnake() {
  snakeState = initSnakeState();
  snakePomelsEarned = 0;
  snakePaused = false;
  snakeLastDir = null;
  // Mémoriser la position précédente de chaque segment pour l'interpolation
  snakeState.prevSnake = snakeState.snake.map(s => ({ x: s.x, y: s.y }));
  snakeState.tickStart = performance.now();
  snakeOverlay().classList.add('hidden');
  // Rendu net
  const ctx = snakeCtx();
  if (ctx) ctx.imageSmoothingEnabled = false;
  updateSnakeScoreUI();
  scheduleSnakeTick();
  startSnakeRenderLoop();
}

// ── ENGINE : tout piloté par requestAnimationFrame ──
// Plus de setTimeout (imprécis, cause d'à-coups). Une seule boucle rAF gère
// la logique (via un accumulateur de temps précis) ET le rendu interpolé.
// L'input est à réponse immédiate : voir snakeQueueDir.

function scheduleSnakeTick() {
  // Conservé pour compat (reprise de pause) : relance juste la boucle rAF
  startSnakeRenderLoop();
}

// Avance le serpent d'UNE case (logique pure). Retourne false si game over.
function snakeAdvance() {
  // Consommer la file d'inputs
  if (snakeState.dirQueue.length > 0) {
    snakeState.dir = snakeState.dirQueue.shift();
  }
  const head = snakeState.snake[0];
  const newHead = {
    x: (head.x + snakeState.dir.x + SNAKE_COLS) % SNAKE_COLS,
    y: (head.y + snakeState.dir.y + SNAKE_ROWS) % SNAKE_ROWS,
  };
  if (snakeState.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
    gameOverSnake();
    return false;
  }
  // Sauvegarder l'état précédent AVANT de bouger (interpolation)
  snakeState.prevSnake = snakeState.snake.map(s => ({ x: s.x, y: s.y }));

  snakeState.snake.unshift(newHead);
  let ate = false;
  if (newHead.x === snakeState.fruit.x && newHead.y === snakeState.fruit.y) {
    ate = true;
    snakeState.score++;
    snakePomelsEarned += SNAKE_POMEL_PER_FRUIT;
    snakeState.fruit = randomFruit(snakeState.snake);
    snakeState.fruitPop = performance.now();
    if (snakeState.score % 5 === 0 && snakeState.speed > 55) {
      snakeState.speed = Math.max(55, snakeState.speed - 10);
    }
    updateSnakeScoreUI();
  } else {
    snakeState.snake.pop();
  }
  if (ate) {
    while (snakeState.prevSnake.length < snakeState.snake.length) {
      const tail = snakeState.snake[snakeState.snake.length - 1];
      snakeState.prevSnake.push({ x: tail.x, y: tail.y });
    }
  }
  snakeState.tickStart = performance.now();
  snakeState.visT = 0;
  return true;
}

// File d'inputs avec VIRAGE ANTICIPÉ (zéro saut + réponse quasi instantanée).
// Quand on appuie, on ne téléporte PAS le serpent (ça ferait un saut). À la
// place, on "comprime" le temps restant du pas en cours : le serpent finit de
// glisser jusqu'à sa case (fluide), puis enchaîne tout de suite le pas suivant
// dans la nouvelle direction. La réponse paraît instantanée sans aucun saut.
function snakeQueueDir(nx, ny) {
  if (!snakeState || snakePaused) return;
  const q = snakeState.dirQueue;
  const ref = q.length > 0 ? q[q.length - 1] : snakeState.dir;
  if (nx === ref.x && ny === ref.y) return;       // identique
  if (nx === -ref.x && ny === -ref.y) return;     // demi-tour interdit
  if (q.length >= 2) return;                       // file limitée à 2
  q.push({ x: nx, y: ny });

  // Virage anticipé : si c'est le 1er input en attente, on raccourcit le pas
  // en cours pour qu'il s'achève quasi immédiatement (le serpent termine son
  // glissement jusqu'à la case, sans saut). On déplace tickStart dans le passé
  // pour que l'accumulateur déclenche le pas dès qu'il reste ~60ms de glisse.
  if (q.length === 1) {
    const SNAP = 60; // ms de glissement restant avant d'enchaîner
    const elapsed = performance.now() - (snakeState.tickStart || 0);
    const remaining = snakeState.speed - elapsed;
    if (remaining > SNAP) {
      // Avancer tickStart pour qu'il ne reste que SNAP ms
      snakeState.tickStart = performance.now() - (snakeState.speed - SNAP);
    }
  }
}

function startSnakeRenderLoop() {
  if (snakeRenderLoop) cancelAnimationFrame(snakeRenderLoop);
  const frame = () => {
    if (!snakeState) return;
    if (!snakePaused) {
      // Accumulateur : avance autant de pas que le temps écoulé le permet.
      // Précis car basé sur performance.now(), pas sur setTimeout.
      let elapsed = performance.now() - (snakeState.tickStart || 0);
      let guard = 0;
      while (elapsed >= snakeState.speed && guard < 4) {
        if (!snakeAdvance()) return; // game over
        elapsed = performance.now() - snakeState.tickStart;
        guard++;
      }
    }
    renderSnake();
    snakeRenderLoop = requestAnimationFrame(frame);
  };
  snakeRenderLoop = requestAnimationFrame(frame);
}

function updateSnakeScoreUI() {
  document.getElementById('snakeScore').textContent = snakeState ? snakeState.score : 0;
  document.getElementById('snakeEarned').textContent = '+' + snakePomelsEarned.toLocaleString('fr-FR') + ' 🪙';
}


// ── RENDERING (interpolé) ────────────────────────
// Interpolation linéaire d'une coordonnée de grille en gérant le wrap (quand
// le serpent traverse un bord, on ne veut pas qu'il "glisse" d'un bout à l'autre).
function _snakeLerpCoord(prev, cur, t, max) {
  let d = cur - prev;
  // Détecter un wrap : si l'écart dépasse la moitié de la grille, c'est un saut de bord
  if (d > max / 2)  d -= max;
  if (d < -max / 2) d += max;
  return prev + d * t;
}

// Canvas de fond pré-rendu (dégradé + grille) — dessiné une seule fois
let _snakeBgCanvas = null;
function _snakeBuildBg() {
  const C = SNAKE_CELL, W = SNAKE_COLS * C, H = SNAKE_ROWS * C;
  _snakeBgCanvas = document.createElement('canvas');
  _snakeBgCanvas.width = W;
  _snakeBgCanvas.height = H;
  const bx = _snakeBgCanvas.getContext('2d');
  const grad = bx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, SNAKE_COLORS.bg2);
  grad.addColorStop(1, SNAKE_COLORS.bg);
  bx.fillStyle = grad;
  bx.fillRect(0, 0, W, H);
  bx.strokeStyle = SNAKE_COLORS.grid;
  bx.lineWidth = 1;
  bx.beginPath();
  for (let x = 0; x <= SNAKE_COLS; x++) { bx.moveTo(x * C, 0); bx.lineTo(x * C, H); }
  for (let y = 0; y <= SNAKE_ROWS; y++) { bx.moveTo(0, y * C); bx.lineTo(W, y * C); }
  bx.stroke();
}

// Cache des couleurs du corps, recalculé seulement quand la longueur change
function _snakeBuildColorCache(n) {
  const cache = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i === 0) { cache[i] = SNAKE_COLORS.headB; continue; }
    const ratio = n > 1 ? i / (n - 1) : 0;
    cache[i] = ratio < 0.5
      ? _snakeMix(SNAKE_COLORS.bodyA, SNAKE_COLORS.bodyB, ratio / 0.5)
      : _snakeMix(SNAKE_COLORS.bodyB, SNAKE_COLORS.bodyTail, (ratio - 0.5) / 0.5);
  }
  return cache;
}

// Sprite de fruit pré-rendu (glow + dégradé radial), dessiné une seule fois
let _snakeFruitSprite = null;
const SNAKE_FRUIT_SPRITE_SIZE = 48; // résolution du sprite (avec marge pour le glow)
function _snakeBuildFruitSprite() {
  const S = SNAKE_FRUIT_SPRITE_SIZE;
  _snakeFruitSprite = document.createElement('canvas');
  _snakeFruitSprite.width = S;
  _snakeFruitSprite.height = S;
  const fx = _snakeFruitSprite.getContext('2d');
  const cx = S / 2, cy = S / 2;
  const radius = SNAKE_CELL / 2 - 2;
  // Glow doux
  fx.shadowColor = SNAKE_COLORS.fruitGlow;
  fx.shadowBlur = 14;
  // Dégradé radial (cœur clair → couleur)
  const g = fx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, radius);
  g.addColorStop(0, SNAKE_COLORS.fruitCore);
  g.addColorStop(1, SNAKE_COLORS.fruit);
  fx.fillStyle = g;
  fx.beginPath();
  fx.arc(cx, cy, radius, 0, Math.PI * 2);
  fx.fill();
}

function renderSnake() {
  const ctx = snakeCtx();
  const C = SNAKE_CELL;
  const W = SNAKE_COLS * C, H = SNAKE_ROWS * C;

  // Fond pré-rendu (1 seul drawImage au lieu de gradient + ~42 lignes/frame)
  if (!_snakeBgCanvas) _snakeBuildBg();
  ctx.drawImage(_snakeBgCanvas, 0, 0);

  if (!snakeState) return;

  // Facteur d'interpolation cible (basé sur le temps écoulé dans le pas)
  let tTarget = 1;
  if (!snakePaused && snakeState.tickStart) {
    tTarget = (performance.now() - snakeState.tickStart) / snakeState.speed;
    if (tTarget > 1) tTarget = 1;
    if (tTarget < 0) tTarget = 0;
  }
  // Progression visuelle lissée : t suit tTarget mais ne bondit jamais d'un
  // coup (utile quand le virage anticipé décale tickStart). Avance monotone,
  // rattrapage rapide mais doux → aucun saut perceptible.
  if (snakeState.visT === undefined) snakeState.visT = tTarget;
  const diff = tTarget - snakeState.visT;
  if (diff < 0) {
    // nouveau pas : on repart de 0 proprement
    snakeState.visT = tTarget;
  } else {
    // rattrapage limité (au plus 0.34 de case par frame ≈ très rapide mais lisse)
    snakeState.visT += Math.min(diff, 0.34);
  }
  const t = snakeState.visT;

  // ── Fruit (sprite pré-rendu : beau glow + dégradé, mais perf préservée) ──
  if (!_snakeFruitSprite) _snakeBuildFruitSprite();
  const fr = snakeState.fruit;
  const now = performance.now();
  let fruitScale = 1;
  if (snakeState.fruitPop) {
    const age = (now - snakeState.fruitPop) / 220;
    if (age < 1) fruitScale = 0.3 + 0.7 * age;
  }
  const pulse = 1 + Math.sin(now / 260) * 0.06;
  const scale = fruitScale * pulse;
  const S = SNAKE_FRUIT_SPRITE_SIZE * scale;
  const fcx = fr.x * C + C / 2, fcy = fr.y * C + C / 2;
  ctx.drawImage(_snakeFruitSprite, fcx - S / 2, fcy - S / 2, S, S);

  // ── Serpent (interpolé) ──
  const snake = snakeState.snake;
  const prev = snakeState.prevSnake || snake;
  const n = snake.length;

  // Cache de couleurs : reconstruit seulement si la longueur a changé
  if (!snakeState.colorCache || snakeState.colorCache.length !== n) {
    snakeState.colorCache = _snakeBuildColorCache(n);
  }
  const colors = snakeState.colorCache;

  // Dessiner de la queue vers la tête
  for (let i = n - 1; i >= 0; i--) {
    const cur = snake[i];
    const pv = prev[i] || cur;
    const ix = _snakeLerpCoord(pv.x, cur.x, t, SNAKE_COLS);
    const iy = _snakeLerpCoord(pv.y, cur.y, t, SNAKE_ROWS);
    const px = ix * C, py = iy * C;
    const isHead = i === 0;
    const inset = isHead ? 1 : 1.8;
    const r = isHead ? 7 : 5;

    // Contour sombre pour délimiter chaque segment (lisibilité)
    ctx.fillStyle = colors[i];
    ctx.strokeStyle = SNAKE_COLORS.outline;
    ctx.lineWidth = isHead ? 2.5 : 2;
    ctx.lineJoin = 'round';
    _snakeRoundRect(ctx, px + inset, py + inset, C - inset * 2, C - inset * 2, r);
    ctx.fill();
    ctx.stroke();

    // Wrap visuel
    if (px < 0 || px > W - C || py < 0 || py > H - C) {
      const wx = px < 0 ? px + W : (px > W - C ? px - W : px);
      const wy = py < 0 ? py + H : (py > H - C ? py - H : py);
      _snakeRoundRect(ctx, wx + inset, wy + inset, C - inset * 2, C - inset * 2, r);
      ctx.fill();
      ctx.stroke();
    }

    // Yeux sur la tête
    if (isHead) {
      const dir = snakeState.dir;
      ctx.fillStyle = '#1a0f24';
      const eyeOff = 4.5, eyeR = 2.4;
      const cx = px + C / 2, cy = py + C / 2;
      let ex1, ey1, ex2, ey2;
      if (dir.x !== 0) {
        ex1 = cx + dir.x * 3; ey1 = cy - eyeOff;
        ex2 = cx + dir.x * 3; ey2 = cy + eyeOff;
      } else {
        ex1 = cx - eyeOff; ey1 = cy + dir.y * 3;
        ex2 = cx + eyeOff; ey2 = cy + dir.y * 3;
      }
      ctx.beginPath(); ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// Mélange deux couleurs hex avec un ratio 0..1
function _snakeMix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
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
  if (snakeRenderLoop) { cancelAnimationFrame(snakeRenderLoop); snakeRenderLoop = null; }
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
  // Battle Pass : valider le défi du jour si applicable
  if (typeof bpReportScore === 'function') { try { await bpReportScore('snake', finalScore); } catch(e) { console.error('bp report', e); } }
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
  const entries = Object.values(snap).filter(e => typeof isSystemAccount !== 'function' || !isSystemAccount(e.code)).sort((a, b) => b.score - a.score).slice(0, SNAKE_MAX_LB);
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
  const weekKey = getSnakeWeekKey();
  const path = 'snake_weekly_lb/' + safeCode;
  const existing = await dbGet(path);
  if (!existing || existing.weekKey !== weekKey || score > existing.score) {
    await dbSet(path, { name: state.name, code: state.code, score, weekKey, date: new Date().toISOString() });
  }
}

async function renderSnakeWeeklyLb() {
  const list = document.getElementById('snakeWeeklyLbList');
  if (!list) return;
  list.innerHTML = '<div class="history-empty">Chargement…</div>';
  const snap = await dbGet('snake_weekly_lb');
  if (!snap) { list.innerHTML = '<div class="history-empty">Aucun score cette semaine.</div>'; return; }
  const currentWeek = getSnakeWeekKey();
  const entries = Object.values(snap)
    .filter(e => typeof isSystemAccount !== 'function' || !isSystemAccount(e.code))
    .filter(e => !e.weekKey || e.weekKey === currentWeek)
    .sort((a, b) => b.score - a.score);
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
  // Filtrer les scores de la semaine précédente (compatibilité : si pas de weekKey, inclure quand même)
  const entries = Object.values(snap)
    .filter(e => typeof isSystemAccount !== 'function' || !isSystemAccount(e.code))
    .filter(e => !e.weekKey || e.weekKey === prevWeekKey)
    .sort((a, b) => b.score - a.score);
  if (entries.length === 0) return;
  await distributeReliably(entries.map((e, i) => ({
    code: e.code, amount: i < 3 ? SNAKE_WEEKLY_PRIZES[i] : SNAKE_WEEKLY_CONSOLATION,
    historyEntry: { type: 'snake', desc: '🐍 Classement hebdo Serpent — #' + (i+1), amount: i < 3 ? SNAKE_WEEKLY_PRIZES[i] : SNAKE_WEEKLY_CONSOLATION, date: new Date().toISOString() }
  })));
  // Supprimer seulement les entrées de la semaine précédente, garder les scores de la semaine en cours
  const allKeys = Object.keys(snap);
  for (const key of allKeys) {
    const entry = snap[key];
    if (!entry.weekKey || entry.weekKey === prevWeekKey) {
      await dbDelete('snake_weekly_lb/' + key);
    }
  }
}


// ── PAGE RENDER ──────────────────────────────────
function renderSnakePage() {
  const ctx = snakeCtx();
  if (ctx) ctx.imageSmoothingEnabled = false;
  const C = SNAKE_CELL, W = SNAKE_COLS * C, H = SNAKE_ROWS * C;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, SNAKE_COLORS.bg2);
  grad.addColorStop(1, SNAKE_COLORS.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = SNAKE_COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= SNAKE_COLS; x++) { ctx.moveTo(x*C, 0); ctx.lineTo(x*C, H); }
  for (let y = 0; y <= SNAKE_ROWS; y++) { ctx.moveTo(0, y*C); ctx.lineTo(W, y*C); }
  ctx.stroke();
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
  snakeQueueDir(x, y);
}

function snakeTogglePause() {
  if (!snakeState) return;
  snakePaused = !snakePaused;
  if (!snakePaused) { snakeState.tickStart = performance.now(); scheduleSnakeTick(); }
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
    snakeQueueDir(dir.x, dir.y);
  }, { passive: true });
})();


// ── KEYBOARD CONTROLS ────────────────────────────
document.addEventListener('keydown', e => {
  if (!snakeState) return;
  if (e.code === 'Space') {
    e.preventDefault();
    snakePaused = !snakePaused;
    if (!snakePaused) { snakeState.tickStart = performance.now(); scheduleSnakeTick(); }
    const centerBtn = document.querySelector('.snake-dpad-center');
    if (centerBtn) centerBtn.textContent = snakePaused ? '▶' : '⏸';
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
  snakeQueueDir(newDir.x, newDir.y);
});

console.log('[Snake] Module loaded ✓');

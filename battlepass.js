/* ═══════════════════════════════════════════════════════════════════════════
   BATTLEPASS.JS — Pass de saison All Star (100 paliers à vie)
   ═══════════════════════════════════════════════════════════════════════════
   Concept : 100 paliers à débloquer, 1 défi aléatoire par jour, 1 palier max
   par jour (strict, pas de rattrapage). Pass UNIQUE À VIE (pas de reset).

   Récompenses :
   - Chaque palier : 1 000 Pomels
   - Tous les 5 paliers (5, 10, 15... 100) : titre exclusif (20 titres)
   - Tous les 10 paliers (10, 20... 100) : effet de profil exclusif (10 effets)

   Défis : score à atteindre dans Snake / Tetris / 2048 / Flappy.
   Courbe progressive (palier 1 facile, palier 100 = exploit).
   Re-tirage : 500 Pomels, garantit un jeu différent.

   Dépend de : state, dbGet, dbSet, addBalanceTransaction, migrateAccount,
               refreshUI, getTodayKey, escapeHTML
   ═══════════════════════════════════════════════════════════════════════════ */

// ── CSS ──────────────────────────────────────────
(function() {
  const style = document.createElement('style');
  style.id = 'battlepass-styles';
  style.textContent = `
    .bp-wrap { display: flex; flex-direction: column; gap: 22px; }
    .bp-header {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg, 22px);
      padding: 24px 28px;
      position: relative; overflow: hidden;
      box-shadow: 0 4px 30px rgba(0,0,0,0.18), var(--glass-highlight);
    }
    .bp-header::before {
      content: ''; position: absolute; top:0; left:0; right:0; height: 3px;
      background: var(--gradient-signature);
      animation: logo-signature-shift 6s ease-in-out infinite;
    }
    .bp-title {
      font-family: 'Inter', sans-serif;
      font-size: 1.7rem; font-weight: 900; letter-spacing: -1px;
      background: var(--gradient-signature);
      background-size: 200% auto;
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: logo-signature-shift 6s ease-in-out infinite;
    }
    .bp-subtitle { color: var(--text-soft); font-size: .92rem; margin-top: 6px; }

    /* Carte du défi du jour */
    .bp-today {
      background: linear-gradient(135deg, rgba(255,210,74,0.10), rgba(255,78,138,0.08) 50%, rgba(166,107,255,0.10));
      border: 1px solid rgba(255,149,40,0.32);
      border-radius: var(--radius-lg, 22px);
      padding: 22px 26px;
      display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
      box-shadow: 0 4px 24px rgba(255,149,40,0.10), var(--glass-highlight);
    }
    .bp-today-icon { font-size: 2.4rem; flex-shrink: 0; filter: drop-shadow(0 0 12px rgba(255,210,74,0.5)); }
    .bp-today-body { flex: 1; min-width: 200px; }
    .bp-today-label { font-size: .65rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: .18em; }
    .bp-today-desc { font-size: 1.05rem; font-weight: 700; margin-top: 4px; line-height: 1.35; }
    .bp-today-palier { font-size: .78rem; color: var(--text-soft); margin-top: 4px; }
    .bp-today-actions { display: flex; gap: 10px; flex-shrink: 0; flex-wrap: wrap; }
    .bp-btn-reroll {
      padding: 10px 16px; border-radius: 12px;
      background: transparent; border: 1px solid var(--border-strong);
      color: var(--text-soft); font-family: inherit; font-size: .82rem; font-weight: 700;
      cursor: pointer; transition: all .15s;
    }
    .bp-btn-reroll:hover { border-color: var(--primary); color: var(--primary); }
    .bp-btn-reroll:disabled { opacity: .5; cursor: not-allowed; }
    .bp-today.done { border-color: rgba(95,232,154,0.4); background: linear-gradient(135deg, rgba(95,232,154,0.10), rgba(78,217,240,0.08)); }
    .bp-today.done .bp-today-label { color: var(--green); }

    /* Progression globale */
    .bp-progress { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 18px; }
    .bp-progress-text { display: flex; justify-content: space-between; align-items: center; font-size: .82rem; margin-bottom: 8px; }
    .bp-progress-text .pct { font-family: 'Space Mono', monospace; font-weight: 700; color: var(--primary); }
    .bp-progress-bar { height: 8px; border-radius: 100px; background: rgba(255,255,255,0.06); overflow: hidden; }
    .bp-progress-fill { height: 100%; background: var(--gradient-signature); background-size: 200% auto; animation: logo-signature-shift 6s ease-in-out infinite; transition: width .5s ease; }

    /* Grille des 100 paliers */
    .bp-paliers {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(98px, 1fr));
      gap: 8px;
    }
    .bp-palier {
      aspect-ratio: 1 / 1;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 8px 6px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 4px;
      position: relative;
      transition: all .15s;
    }
    .bp-palier.unlocked {
      background: linear-gradient(135deg, rgba(95,232,154,0.10), rgba(95,232,154,0.04));
      border-color: rgba(95,232,154,0.3);
    }
    .bp-palier.current {
      background: linear-gradient(135deg, rgba(255,149,40,0.14), rgba(255,78,138,0.08));
      border-color: var(--primary);
      box-shadow: 0 0 0 1px rgba(255,149,40,0.4), 0 4px 16px rgba(255,149,40,0.18);
      animation: bp-pulse 2.4s ease-in-out infinite;
    }
    @keyframes bp-pulse {
      0%, 100% { box-shadow: 0 0 0 1px rgba(255,149,40,0.4), 0 4px 16px rgba(255,149,40,0.18); }
      50% { box-shadow: 0 0 0 2px rgba(255,149,40,0.6), 0 6px 24px rgba(255,149,40,0.32); }
    }
    .bp-palier-num { font-family: 'Space Mono', monospace; font-size: .68rem; font-weight: 700; color: var(--muted); }
    .bp-palier.unlocked .bp-palier-num { color: var(--green); }
    .bp-palier.current .bp-palier-num { color: var(--primary); }
    .bp-palier-reward { font-size: 1.5rem; line-height: 1; }
    .bp-palier-tag { font-size: .54rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; opacity: .8; text-align: center; line-height: 1.15; }
    .bp-palier.has-title .bp-palier-tag { color: var(--yellow); }
    .bp-palier.has-effect .bp-palier-tag { color: var(--accent); }
    .bp-palier-check {
      position: absolute; top: 4px; right: 4px;
      width: 18px; height: 18px; border-radius: 50%;
      background: var(--green); color: #0d0a1f;
      font-size: .7rem; font-weight: 900;
      display: flex; align-items: center; justify-content: center;
    }

    /* Modal récompense */
    .bp-reward-overlay {
      position: fixed; inset: 0; z-index: 600;
      background: rgba(7,5,20,0.78);
      backdrop-filter: blur(10px) saturate(150%);
      -webkit-backdrop-filter: blur(10px) saturate(150%);
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn .25s; padding: 20px;
    }
    .bp-reward-box {
      background: var(--surface-solid, #15112c);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-lg, 22px);
      padding: 36px 32px 28px;
      width: 100%; max-width: 440px;
      text-align: center;
      box-shadow: 0 28px 80px rgba(0,0,0,0.6), 0 0 80px rgba(255,149,40,0.18), 0 0 120px rgba(166,107,255,0.12);
      animation: slideUp .4s cubic-bezier(.2,.9,.3,1.2);
      position: relative; overflow: hidden;
    }
    .bp-reward-box::before {
      content: ''; position: absolute; inset: 0; border-radius: var(--radius-lg, 22px);
      padding: 2px;
      background: var(--gradient-signature);
      background-size: 200% 200%;
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor; mask-composite: exclude;
      pointer-events: none;
      animation: logo-signature-shift 6s ease-in-out infinite;
    }
    .bp-reward-emoji { font-size: 4rem; line-height: 1; filter: drop-shadow(0 0 24px rgba(255,210,74,0.6)); animation: bp-bounce 1.2s ease-in-out infinite; }
    @keyframes bp-bounce {
      0%, 100% { transform: translateY(0) rotate(0); }
      50% { transform: translateY(-8px) rotate(-3deg); }
    }
    .bp-reward-title {
      font-size: 1.5rem; font-weight: 900; letter-spacing: -.6px; margin-top: 14px;
      background: var(--gradient-signature);
      background-size: 200% auto;
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: logo-signature-shift 6s ease-in-out infinite;
    }
    .bp-reward-palier { font-size: .78rem; color: var(--muted); margin-top: 6px; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; }
    .bp-reward-items { display: flex; flex-direction: column; gap: 10px; margin-top: 22px; }
    .bp-reward-item {
      background: rgba(255,255,255,0.04); border: 1px solid var(--border);
      border-radius: 12px; padding: 12px 16px;
      display: flex; align-items: center; gap: 12px; text-align: left;
    }
    .bp-reward-item-icon { font-size: 1.8rem; flex-shrink: 0; }
    .bp-reward-item-body { flex: 1; min-width: 0; }
    .bp-reward-item-label { font-size: .68rem; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; font-weight: 700; }
    .bp-reward-item-name { font-weight: 800; font-size: 1rem; margin-top: 2px; }
    .bp-reward-close {
      margin-top: 22px; padding: 14px 32px; border-radius: 14px;
      background: var(--gradient-signature); background-size: 200% auto;
      color: #fff; border: none; font-family: 'Inter', sans-serif;
      font-size: 1rem; font-weight: 800; cursor: pointer;
      box-shadow: 0 8px 28px rgba(255,149,40,0.32);
      transition: transform .15s, background-position .4s;
    }
    .bp-reward-close:hover { transform: translateY(-2px); background-position: 100% center; }

    @media (max-width: 600px) {
      .bp-header { padding: 18px 20px; }
      .bp-title { font-size: 1.35rem; }
      .bp-today { padding: 16px 18px; gap: 12px; }
      .bp-today-icon { font-size: 1.9rem; }
      .bp-today-desc { font-size: .92rem; }
      .bp-paliers { grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 6px; }
      .bp-palier { padding: 6px 4px; }
      .bp-palier-reward { font-size: 1.2rem; }
      .bp-reward-box { padding: 28px 22px 22px; }
    }
  `;
  document.head.appendChild(style);
})();


// ── CONSTANTES ───────────────────────────────────
const BP_TOTAL_PALIERS = 100;
const BP_POMELS_PER_PALIER = 1000;
const BP_REROLL_COST = 500;

// Récompenses titres (20 titres exclusifs, tous les 5 paliers)
const BP_TITLES = [
  { palier: 5,   key: 'bp_apprenti',     name: 'Apprenti All Star' },
  { palier: 10,  key: 'bp_recrue',       name: 'Recrue All Star' },
  { palier: 15,  key: 'bp_disciple',     name: 'Disciple All Star' },
  { palier: 20,  key: 'bp_guerrier',     name: 'Guerrier All Star' },
  { palier: 25,  key: 'bp_combattant',   name: 'Combattant All Star' },
  { palier: 30,  key: 'bp_vetérain',     name: 'Vétéran All Star' },
  { palier: 35,  key: 'bp_aventurier',   name: 'Aventurier All Star' },
  { palier: 40,  key: 'bp_chasseur',     name: 'Chasseur All Star' },
  { palier: 45,  key: 'bp_chevalier',    name: 'Chevalier All Star' },
  { palier: 50,  key: 'bp_champion',     name: 'Champion All Star' },
  { palier: 55,  key: 'bp_elite',        name: 'Élite All Star' },
  { palier: 60,  key: 'bp_virtuose',     name: 'Virtuose All Star' },
  { palier: 65,  key: 'bp_maître',       name: 'Maître All Star' },
  { palier: 70,  key: 'bp_seigneur',     name: 'Seigneur All Star' },
  { palier: 75,  key: 'bp_héros',        name: 'Héros All Star' },
  { palier: 80,  key: 'bp_titan',        name: 'Titan All Star' },
  { palier: 85,  key: 'bp_legende',      name: 'Légende All Star' },
  { palier: 90,  key: 'bp_mythique',     name: 'Mythique All Star' },
  { palier: 95,  key: 'bp_immortel',     name: 'Immortel All Star' },
  { palier: 100, key: 'bp_grand_maitre', name: 'Grand Maître All Star' },
];
// Effets profil (10 effets exclusifs, tous les 10 paliers)
const BP_EFFECTS = [
  { palier: 10,  key: 'bp_effect_spark',     name: 'Étincelle ✨' },
  { palier: 20,  key: 'bp_effect_flame',     name: 'Flamme 🔥' },
  { palier: 30,  key: 'bp_effect_wave',      name: 'Vague 🌊' },
  { palier: 40,  key: 'bp_effect_thunder',   name: 'Tonnerre ⚡' },
  { palier: 50,  key: 'bp_effect_aurora',    name: 'Aurore 🌌' },
  { palier: 60,  key: 'bp_effect_prism',     name: 'Prisme 💎' },
  { palier: 70,  key: 'bp_effect_galaxy',    name: 'Galaxie 🌠' },
  { palier: 80,  key: 'bp_effect_inferno',   name: 'Inferno 🌋' },
  { palier: 90,  key: 'bp_effect_cosmos',    name: 'Cosmos 🪐' },
  { palier: 100, key: 'bp_effect_allstar',   name: 'All Star 👑' },
];

// Catalogue des défis : pour chaque jeu, on définit la courbe (palier → seuil)
// La fonction de courbe : interpolation entre paliers-clés pour souplesse.
const BP_GAMES = {
  snake:  { emoji: '🐍', label: 'Snake',  metric: 'fruits',  curve: [[1,5],[10,12],[30,25],[60,40],[85,60],[100,85]] },
  tetris: { emoji: '🧱', label: 'Tetris', metric: 'lignes',  curve: [[1,3],[10,8],[30,20],[60,35],[85,55],[100,80]] },
  g2048:  { emoji: '🔢', label: '2048',   metric: 'tuile',   curve: [[1,64],[10,256],[30,512],[60,1024],[85,2048],[100,4096]] },
  flappy: { emoji: '🐤', label: 'Flappy', metric: 'tuyaux',  curve: [[1,3],[10,8],[30,18],[60,35],[85,55],[100,80]] },
};

function bpCurveValueAt(curve, palier) {
  for (let i = 0; i < curve.length - 1; i++) {
    const [p1, v1] = curve[i];
    const [p2, v2] = curve[i+1];
    if (palier >= p1 && palier <= p2) {
      const t = (palier - p1) / (p2 - p1);
      return Math.round(v1 + (v2 - v1) * t);
    }
  }
  return curve[curve.length - 1][1];
}

// Pour 2048, on arrondit au multiple de 2 le plus proche (puisque les tuiles sont des puissances de 2)
function bp2048Round(target) {
  let p = 2;
  while (p < target) p *= 2;
  // si on est plus proche de p/2 que de p, on prend p/2
  if (p - target > target - p/2) return p/2;
  return p;
}


// ── STATE ────────────────────────────────────────
// Stocké dans state.battlepass = { palier, lastDayDone, today: { game, target, done } }
function bpGetState() {
  if (!state) return null;
  if (!state.battlepass) {
    state.battlepass = { palier: 0, lastDayDone: null, today: null };
  }
  return state.battlepass;
}

function bpEnsureTodayChallenge() {
  const bp = bpGetState();
  if (!bp) return null;
  const today = (typeof getTodayKey === 'function') ? getTodayKey() : new Date().toISOString().slice(0,10);
  // Si le pass est déjà terminé, plus de défi
  if (bp.palier >= BP_TOTAL_PALIERS) return null;
  // Si on a déjà fait le palier aujourd'hui, on n'a plus de défi pour aujourd'hui
  if (bp.lastDayDone === today) return null;
  // Si le défi du jour n'existe pas ou date d'un autre jour, en tirer un nouveau
  if (!bp.today || bp.today.date !== today) {
    bp.today = bpRollChallenge(bp.palier + 1, today, null);
  }
  return bp.today;
}

function bpRollChallenge(nextPalier, today, excludeGame) {
  const games = Object.keys(BP_GAMES).filter(g => g !== excludeGame);
  const game = games[Math.floor(Math.random() * games.length)];
  let target = bpCurveValueAt(BP_GAMES[game].curve, nextPalier);
  if (game === 'g2048') target = bp2048Round(target);
  return { date: today, game, target, done: false };
}

function bpFormatChallenge(challenge) {
  if (!challenge) return '';
  const g = BP_GAMES[challenge.game];
  if (challenge.game === 'g2048') {
    return `Atteindre la tuile ${challenge.target} à 2048`;
  }
  return `Atteindre ${challenge.target} ${g.metric} à ${g.label}`;
}


// ── VALIDATION (appelée par les jeux à leur game over) ──
// score = nombre de fruits / lignes / tuyaux ; pour 2048 → tuile max atteinte
async function bpReportScore(game, score) {
  const bp = bpGetState();
  if (!bp) return;
  const challenge = bpEnsureTodayChallenge();
  if (!challenge) return;  // pass terminé ou défi déjà fait aujourd'hui
  if (challenge.game !== game) return;
  if (score < challenge.target) return;
  // Défi rempli ! Débloquer le palier
  await bpUnlockNextPalier();
}

async function bpUnlockNextPalier() {
  const bp = bpGetState();
  if (!bp) return;
  if (bp.palier >= BP_TOTAL_PALIERS) return;
  const today = (typeof getTodayKey === 'function') ? getTodayKey() : new Date().toISOString().slice(0,10);
  if (bp.lastDayDone === today) return;  // sécurité : déjà fait aujourd'hui

  const newPalier = bp.palier + 1;
  bp.palier = newPalier;
  bp.lastDayDone = today;
  if (bp.today) bp.today.done = true;

  // Construire la liste des récompenses
  const rewards = [{ type: 'pomels', amount: BP_POMELS_PER_PALIER }];
  const title = BP_TITLES.find(t => t.palier === newPalier);
  if (title) rewards.push({ type: 'title', key: title.key, name: title.name });
  const effect = BP_EFFECTS.find(e => e.palier === newPalier);
  if (effect) rewards.push({ type: 'effect', key: effect.key, name: effect.name });

  // Crédit Pomels via addBalanceTransaction (atomique, source de vérité)
  if (typeof addBalanceTransaction === 'function') {
    const updated = await addBalanceTransaction(state.code, BP_POMELS_PER_PALIER, {
      type: 'battlepass',
      desc: `🌟 Battle Pass — palier ${newPalier}`,
      amount: BP_POMELS_PER_PALIER,
      date: new Date().toISOString()
    });
    if (updated && typeof migrateAccount === 'function') {
      state = migrateAccount(updated);
      // Re-créer le battlepass dans le nouveau state (migrateAccount peut le perdre si pas migré)
      if (!state.battlepass) state.battlepass = bp;
      else { state.battlepass.palier = newPalier; state.battlepass.lastDayDone = today; if (state.battlepass.today) state.battlepass.today.done = true; }
    }
  }

  // Débloquer titre/effet dans la collection persistée
  if (title || effect) {
    if (!state.unlockedTitles) state.unlockedTitles = [];
    if (!state.unlockedEffects) state.unlockedEffects = [];
    if (title && !state.unlockedTitles.includes(title.key)) state.unlockedTitles.push(title.key);
    if (effect && !state.unlockedEffects.includes(effect.key)) state.unlockedEffects.push(effect.key);
    if (typeof saveAccount === 'function') await saveAccount(state);
  } else if (typeof saveAccount === 'function') {
    // Persister le nouveau palier même sans titre/effet
    await saveAccount(state);
  }

  if (typeof refreshUI === 'function') refreshUI();
  bpShowRewardModal(newPalier, rewards);
}


// ── RE-TIRAGE ──
async function bpReroll() {
  const bp = bpGetState();
  if (!bp) return;
  const challenge = bpEnsureTodayChallenge();
  if (!challenge) { alert('Aucun défi à re-tirer.'); return; }
  if (challenge.done) { alert('Défi déjà accompli !'); return; }
  if (!state || (state.balance || 0) < BP_REROLL_COST) {
    alert(`Il te faut ${BP_REROLL_COST} Pomels pour re-tirer le défi.`);
    return;
  }
  if (!confirm(`Re-tirer le défi du jour pour ${BP_REROLL_COST} Pomels ?\n\nLe nouveau défi portera sur un autre jeu.`)) return;

  // Débit + nouveau tirage
  if (typeof addBalanceTransaction === 'function') {
    const updated = await addBalanceTransaction(state.code, -BP_REROLL_COST, {
      type: 'battlepass_reroll',
      desc: `🎲 Re-tirage défi Battle Pass`,
      amount: -BP_REROLL_COST,
      date: new Date().toISOString()
    });
    if (updated && typeof migrateAccount === 'function') {
      state = migrateAccount(updated);
      if (!state.battlepass) state.battlepass = bp;
    }
  }

  const today = (typeof getTodayKey === 'function') ? getTodayKey() : new Date().toISOString().slice(0,10);
  const newChallenge = bpRollChallenge(bp.palier + 1, today, challenge.game);
  // Stocker dans le state actuel (que ce soit l'ancien ou le migré)
  const sbp = state.battlepass || bp;
  sbp.today = newChallenge;
  if (typeof saveAccount === 'function') await saveAccount(state);
  if (typeof refreshUI === 'function') refreshUI();
  renderBattlepassPage();
}


// ── MODAL RÉCOMPENSE ──
function bpShowRewardModal(palier, rewards) {
  // Construire le HTML
  let itemsHtml = '';
  for (const r of rewards) {
    if (r.type === 'pomels') {
      itemsHtml += `<div class="bp-reward-item">
        <div class="bp-reward-item-icon">🪙</div>
        <div class="bp-reward-item-body">
          <div class="bp-reward-item-label">Pomels</div>
          <div class="bp-reward-item-name">+${r.amount.toLocaleString('fr-FR')}</div>
        </div>
      </div>`;
    } else if (r.type === 'title') {
      itemsHtml += `<div class="bp-reward-item">
        <div class="bp-reward-item-icon">🏷️</div>
        <div class="bp-reward-item-body">
          <div class="bp-reward-item-label">Titre exclusif</div>
          <div class="bp-reward-item-name">${escapeHTML ? escapeHTML(r.name) : r.name}</div>
        </div>
      </div>`;
    } else if (r.type === 'effect') {
      itemsHtml += `<div class="bp-reward-item">
        <div class="bp-reward-item-icon">✨</div>
        <div class="bp-reward-item-body">
          <div class="bp-reward-item-label">Effet de profil exclusif</div>
          <div class="bp-reward-item-name">${escapeHTML ? escapeHTML(r.name) : r.name}</div>
        </div>
      </div>`;
    }
  }
  const overlay = document.createElement('div');
  overlay.className = 'bp-reward-overlay';
  overlay.innerHTML = `
    <div class="bp-reward-box">
      <div class="bp-reward-emoji">🌟</div>
      <div class="bp-reward-title">Palier ${palier} débloqué !</div>
      <div class="bp-reward-palier">Battle Pass · ${palier}/100</div>
      <div class="bp-reward-items">${itemsHtml}</div>
      <button class="bp-reward-close" onclick="this.closest('.bp-reward-overlay').remove()">Continuer</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}


// ── PAGE RENDER ──
function renderBattlepassPage() {
  const page = document.getElementById('page-battlepass');
  if (!page) return;
  const bp = bpGetState();
  if (!bp) { page.innerHTML = '<div class="alert">Profil indisponible.</div>'; return; }
  const challenge = bpEnsureTodayChallenge();
  const isDone = !challenge || challenge.done || bp.palier >= BP_TOTAL_PALIERS;
  const isComplete = bp.palier >= BP_TOTAL_PALIERS;
  const pct = Math.round(bp.palier * 100 / BP_TOTAL_PALIERS);

  // Bloc défi du jour
  let todayHtml;
  if (isComplete) {
    todayHtml = `<div class="bp-today done">
      <div class="bp-today-icon">🏆</div>
      <div class="bp-today-body">
        <div class="bp-today-label">Pass terminé</div>
        <div class="bp-today-desc">Tu as débloqué les 100 paliers du Battle Pass All Star !</div>
        <div class="bp-today-palier">Bravo, tu fais partie des légendes 👑</div>
      </div>
    </div>`;
  } else if (isDone) {
    todayHtml = `<div class="bp-today done">
      <div class="bp-today-icon">✅</div>
      <div class="bp-today-body">
        <div class="bp-today-label">Défi accompli</div>
        <div class="bp-today-desc">Palier ${bp.palier} débloqué aujourd'hui — reviens demain pour le suivant !</div>
        <div class="bp-today-palier">Prochain défi : demain · palier ${bp.palier + 1}</div>
      </div>
    </div>`;
  } else {
    const canReroll = state && (state.balance || 0) >= BP_REROLL_COST;
    todayHtml = `<div class="bp-today">
      <div class="bp-today-icon">${BP_GAMES[challenge.game].emoji}</div>
      <div class="bp-today-body">
        <div class="bp-today-label">Défi du jour</div>
        <div class="bp-today-desc">${bpFormatChallenge(challenge)}</div>
        <div class="bp-today-palier">Palier ${bp.palier + 1}/100 · récompense : +${BP_POMELS_PER_PALIER.toLocaleString('fr-FR')} 🪙${BP_TITLES.find(t=>t.palier===bp.palier+1) ? ' + titre' : ''}${BP_EFFECTS.find(e=>e.palier===bp.palier+1) ? ' + effet' : ''}</div>
      </div>
      <div class="bp-today-actions">
        <button class="bp-btn-reroll" onclick="bpReroll()" ${canReroll ? '' : 'disabled'}>🎲 Re-tirer · ${BP_REROLL_COST} 🪙</button>
      </div>
    </div>`;
  }

  // Grille des paliers
  let paliersHtml = '<div class="bp-paliers">';
  for (let i = 1; i <= BP_TOTAL_PALIERS; i++) {
    const unlocked = i <= bp.palier;
    const isCurrent = !unlocked && i === bp.palier + 1 && !isDone;
    const title = BP_TITLES.find(t => t.palier === i);
    const effect = BP_EFFECTS.find(e => e.palier === i);
    const classes = ['bp-palier'];
    if (unlocked) classes.push('unlocked');
    if (isCurrent) classes.push('current');
    if (title) classes.push('has-title');
    if (effect) classes.push('has-effect');
    let icon = '🪙';
    let tag = '';
    if (effect) { icon = '✨'; tag = 'Effet'; }
    else if (title) { icon = '🏷️'; tag = 'Titre'; }
    paliersHtml += `<div class="${classes.join(' ')}" title="Palier ${i}${title ? ' · ' + title.name : ''}${effect ? ' · ' + effect.name : ''}">
      <div class="bp-palier-num">${i}</div>
      <div class="bp-palier-reward">${icon}</div>
      ${tag ? `<div class="bp-palier-tag">${tag}</div>` : ''}
      ${unlocked ? '<div class="bp-palier-check">✓</div>' : ''}
    </div>`;
  }
  paliersHtml += '</div>';

  page.innerHTML = `
    <div class="bp-wrap">
      <div class="bp-header">
        <div class="bp-title">🌟 Battle Pass All Star</div>
        <div class="bp-subtitle">100 paliers à débloquer à vie · 1 défi par jour · récompenses : Pomels, titres et effets exclusifs</div>
      </div>
      ${todayHtml}
      <div class="bp-progress">
        <div class="bp-progress-text">
          <span>Progression</span>
          <span class="pct">${bp.palier}/${BP_TOTAL_PALIERS} · ${pct}%</span>
        </div>
        <div class="bp-progress-bar"><div class="bp-progress-fill" style="width:${pct}%"></div></div>
      </div>
      ${paliersHtml}
    </div>
  `;
}

console.log('[Battlepass] Module loaded ✓');

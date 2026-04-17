/* ═══════════════════════════════════════════════════════════════════════════
   CLICKER_JARDIN.JS — Clicker à graines + Jardin de Pomel'Land
   ═══════════════════════════════════════════════════════════════════════════
   Dépend de : state, dbGet, dbSet, addBalanceTransaction, migrateAccount,
               refreshUI, saveAccount, showWinToast, escapeHTML,
               trackSeedsEarned, getGroupWeekKey, getAllAccounts,
               distributeReliably, getAccBannerClass, getAccColorClass,
               getAccount, renderAvatarInEl
   ═══════════════════════════════════════════════════════════════════════════ */

// ── CSS (injecté au chargement) ──────────────────
(function() {
  const style = document.createElement('style');
  style.id = 'clicker-jardin-styles';
  style.textContent = `
    /* JARDIN */
    .jardin-wrap { display: flex; flex-direction: column; gap: 20px; }
    .jardin-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .jardin-timer-box { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 20px; text-align: center; min-width: 130px; flex-shrink: 0; }
    .jardin-action-bar { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
    .jardin-seeds-info { display: flex; flex-direction: column; gap: 2px; }
    .jardin-seeds-label { font-size: .68rem; font-weight: 700; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; }
    .jardin-seeds-val { font-family: 'Space Mono', monospace; font-size: 1.2rem; font-weight: 700; color: var(--green); }
    .jardin-canvas-wrap { border-radius: 14px; overflow: hidden; border: 2px solid var(--border); background: #0d1a0f; box-shadow: 0 0 30px rgba(62,207,110,0.1); width: 100%; }
    .jardin-canvas-wrap canvas { display: block; width: 100%; height: auto; }

    /* CLICKER */
    .clicker-wrap { display: flex; flex-direction: column; gap: 24px; max-width: min(700px, 100%); }
    .clicker-stats-bar { display: flex; gap: 12px; flex-wrap: wrap; }
    .clicker-stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 20px; flex: 1; min-width: min(120px, 100%); }
    .clicker-stat-label { font-size: .68rem; font-weight: 700; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; margin-bottom: 4px; }
    .clicker-stat-val { font-family: 'Space Mono', monospace; font-size: 1.3rem; font-weight: 700; color: var(--primary); }
    .clicker-fruits-zone { display: flex; justify-content: center; gap: 40px; align-items: center; padding: 20px 0; flex-wrap: wrap; }
    .clicker-fruit { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; user-select: none; transition: transform .08s; }
    .clicker-fruit:active { transform: scale(.88); }
    .clicker-fruit svg { width: 110px; height: 110px; filter: drop-shadow(0 0 18px var(--primary-glow)); transition: filter .15s; }
    .clicker-fruit:hover svg { filter: drop-shadow(0 0 28px var(--primary-glow)) brightness(1.1); }
    .clicker-fruit-label { font-family: 'Space Mono', monospace; font-size: .85rem; font-weight: 700; color: var(--primary); }
    .clicker-fruit.hidden { display: none; }
    .clicker-fruit-pop { animation: fruitPop .12s ease-out; }
    @keyframes fruitPop { 0%{transform:scale(1)} 50%{transform:scale(.85)} 100%{transform:scale(1)} }
    .clicker-seed-float { position: fixed; font-family: 'Space Mono', monospace; font-size: .9rem; font-weight: 700; color: var(--green); pointer-events: none; z-index: 500; animation: seedFloat .8s ease-out forwards; }
    @keyframes seedFloat { 0%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-50px)} }
    .clicker-collect-zone { background: var(--surface); border: 2px solid var(--yellow); border-radius: var(--radius); padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; min-width: 0; overflow: hidden; }
    .clicker-collect-info { display: flex; align-items: center; gap: 10px; font-size: .9rem; color: var(--muted); }
    .clicker-collect-info strong { font-family: 'Space Mono', monospace; font-size: 1.1rem; color: var(--yellow); }
    .clicker-upgrades { display: flex; flex-direction: column; gap: 12px; }
    .clicker-upgrades-title { font-size: .75rem; font-weight: 700; color: var(--muted); letter-spacing: .1em; text-transform: uppercase; }
    .clicker-upgrade-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; transition: border-color .2s; min-width: 0; overflow: hidden; }
    .clicker-upgrade-card:hover { border-color: rgba(235,88,70,0.3); }
    .clicker-upgrade-card.owned { border-color: var(--green); opacity: .75; }
    .clicker-upgrade-info { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .clicker-upgrade-name { font-weight: 700; font-size: .95rem; }
    .clicker-upgrade-desc { font-size: .8rem; color: var(--muted); line-height: 1.4; }
    .clicker-upgrade-price { font-family: 'Space Mono', monospace; font-size: .85rem; color: var(--primary); font-weight: 700; margin-top: 4px; }

    @media (max-width: 600px) {
      .clicker-stat { min-width: 100px; padding: 10px 14px; }
      .clicker-stat-val { font-size: 1.1rem; }
      .clicker-fruit svg { width: 130px; height: 130px; }
      .clicker-fruits-zone { gap: 24px; padding: 12px 0; }
      .clicker-upgrade-card { padding: 14px; }
      .clicker-upgrade-name { font-size: .88rem; }
      .clicker-upgrade-desc { font-size: .75rem; }
      .jardin-canvas-wrap { border-radius: 10px; }
      .jardin-action-bar { gap: 12px; padding: 12px 14px; }
      .jardin-seeds-val { font-size: 1rem; }
      .jardin-header { gap: 10px; }
    }
  `;
  document.head.appendChild(style);
})();

// ── JARDIN HELPERS ────────────────────────────────
async function getJardin() { return dbGet('jardin'); }
async function saveJardin(data) { await dbSet('jardin', data); }


// ── CLICKER ──────────────────────────────────────
let clickerData = {
  seeds: 0,
  autoStock: 0,
  upgrades: { autoClicker: false, autoSpeed: false, superSpeed: false, ultraSpeed: false, stockExt: false, stockExt2: false, stockExt3: false, secondFruit: false },
  lastSaved: null,
  loaded: false,
};
let clickerAutoInterval = null;
let clickerActive = false;
let clickerSaveTimeout = null;

// Sauvegarde debounced pour éviter le spam Firebase lors des clics rapides
function debouncedSaveClicker() {
  if (clickerSaveTimeout) clearTimeout(clickerSaveTimeout);
  clickerSaveTimeout = setTimeout(() => {
    saveClickerData();
    clickerSaveTimeout = null;
  }, 2000);
}
// Force la sauvegarde immédiate si un debounce est en attente
function flushClickerSave() {
  if (clickerSaveTimeout) {
    clearTimeout(clickerSaveTimeout);
    clickerSaveTimeout = null;
    saveClickerData();
  }
}

function clickerMaxStock() {
  let max = clickerData.upgrades.autoClicker ? 1000 : 0;
  if (clickerData.upgrades.stockExt)  max = Math.max(max, 2000);
  if (clickerData.upgrades.stockExt2) max = Math.max(max, 5000);
  if (clickerData.upgrades.stockExt3) max = Math.max(max, 10000);
  if (clickerData.upgrades.secondFruit) max += 1000;
  return max;
}

function clickerAutoRate() {
  if (!clickerData.upgrades.autoClicker) return 0;
  const fruitsUnlocked = clickerData.upgrades.secondFruit ? 2 : 1;
  // Graines par tick par fruit selon la vitesse
  let ratePerFruit = 1;
  if (clickerData.upgrades.superSpeed) ratePerFruit = 2;
  if (clickerData.upgrades.ultraSpeed) ratePerFruit = 5;
  return fruitsUnlocked * ratePerFruit;
}

function clickerIntervalMs() {
  // Toutes les vitesses au-delà de l'auto de base utilisent 1 sec
  return (clickerData.upgrades.autoSpeed || clickerData.upgrades.superSpeed || clickerData.upgrades.ultraSpeed) ? 1000 : 2000;
}

async function loadClickerData() {
  const saved = await dbGet('clicker/' + state.code);
  if (saved) {
    clickerData = {
      seeds: saved.seeds || 0,
      autoStock: saved.autoStock || 0,
      upgrades: Object.assign({ autoClicker: false, autoSpeed: false, superSpeed: false, ultraSpeed: false, stockExt: false, stockExt2: false, stockExt3: false, secondFruit: false }, saved.upgrades || {}),
      lastSaved: saved.lastSaved || null,
      loaded: true,
    };

    // Calcul du stock accumulé hors-ligne
    if (clickerData.upgrades.autoClicker && clickerData.lastSaved) {
      const elapsed = (Date.now() - new Date(clickerData.lastSaved).getTime()) / 1000;
      const intervalSec = clickerIntervalMs() / 1000;
      const ticks = Math.floor(elapsed / intervalSec);
      const generated = ticks * clickerAutoRate();
      const max = clickerMaxStock();
      clickerData.autoStock = Math.min(max, clickerData.autoStock + generated);
    }
    clickerData.autoStock = Math.min(clickerData.autoStock, clickerMaxStock());
  } else {
    // Première utilisation — marquer comme chargé pour autoriser les sauvegardes
    clickerData.loaded = true;
    clickerData.lastSaved = new Date().toISOString();
  }
}

async function saveClickerData() {
  if (!clickerData.loaded) return; // données pas encore chargées depuis Firebase
  await dbSet('clicker/' + state.code, {
    seeds: Math.floor(clickerData.seeds),
    autoStock: Math.floor(clickerData.autoStock),
    upgrades: clickerData.upgrades,
    lastSaved: new Date().toISOString(),
  });
}

async function renderClickerPage() {
  clickerActive = true;
  await loadClickerData();
  updateClickerUI();
  startAutoClicker();
}

function stopClickerPage() {
  if (!clickerActive) return; // ne rien faire si le clicker n'était pas ouvert
  clickerActive = false;
  if (clickerAutoInterval) { clearInterval(clickerAutoInterval); clickerAutoInterval = null; }
  // Flush les graines pendantes pour le score de groupe
  if (clickerData._pendingSeeds > 0) {
    trackSeedsEarned(state, clickerData._pendingSeeds);
    state.history.unshift({ type: 'seeds', desc: `🌱 ${clickerData._pendingSeeds} graines récoltées (clicker)`, seeds: clickerData._pendingSeeds, amount: 0, date: new Date().toISOString() });
    clickerData._pendingSeeds = 0;
    saveAccount(state);
  }
  // Flush le debounce en attente et sauvegarder avec timestamp pour le calcul offline
  flushClickerSave();
  if (clickerData.upgrades && clickerData.upgrades.autoClicker) saveClickerData();
}

function startAutoClicker() {
  if (clickerAutoInterval) clearInterval(clickerAutoInterval);
  if (!clickerData.upgrades.autoClicker) return;

  // Sauvegarde dans Firebase toutes les 15 secondes seulement (pas à chaque tick)
  let ticksSinceLastSave = 0;
  const saveEveryNTicks = Math.ceil(15000 / clickerIntervalMs());

  clickerAutoInterval = setInterval(() => {
    if (!clickerActive) { clearInterval(clickerAutoInterval); clickerAutoInterval = null; return; }
    const max = clickerMaxStock();
    if (clickerData.autoStock < max) {
      clickerData.autoStock = Math.min(max, clickerData.autoStock + clickerAutoRate());
      updateClickerUI();
    }
    // Sauvegarder périodiquement même si le stock est plein (pour lastSaved)
    ticksSinceLastSave++;
    if (ticksSinceLastSave >= saveEveryNTicks) {
      saveClickerData();
      ticksSinceLastSave = 0;
    }
  }, clickerIntervalMs());
}

function updateClickerUI() {
  const max = clickerMaxStock();
  document.getElementById('clickerSeeds').textContent = Math.floor(clickerData.seeds).toLocaleString('fr-FR');
  document.getElementById('clickerStock').innerHTML = Math.floor(clickerData.autoStock).toLocaleString('fr-FR') +
    ` <span style="font-size:.7rem;color:var(--muted);">/ ${max.toLocaleString('fr-FR')}</span>`;
  const ratePerSec = clickerData.upgrades.autoClicker
    ? (clickerAutoRate() / (clickerIntervalMs() / 1000)).toFixed(1)
    : '0';
  document.getElementById('clickerRate').textContent = ratePerSec;

  // Fruits
  const f2 = document.getElementById('fruit2');
  if (clickerData.upgrades.secondFruit) f2.classList.remove('hidden');
  else f2.classList.add('hidden');

  // Collect zone
  const collectZone = document.getElementById('clickerCollectZone');
  const stockVal = document.getElementById('clickerStockVal');
  if (clickerData.upgrades.autoClicker) {
    collectZone.style.display = 'flex';
    stockVal.textContent = Math.floor(clickerData.autoStock).toLocaleString('fr-FR');
  } else {
    collectZone.style.display = 'none';
  }

  // Helper to set upgrade button state
  const setUpgradeBtn = (btnId, cardId, owned, canAfford) => {
    const btn  = document.getElementById(btnId);
    const card = document.getElementById(cardId);
    if (!btn || !card) return;
    if (owned) {
      // Masquer complètement les upgrades déjà achetées
      card.style.display = 'none';
    } else {
      card.style.display = '';
      btn.textContent = canAfford ? 'Acheter' : 'Pas assez';
      btn.disabled = !canAfford;
      btn.className = 'btn-buy';
    }
  };

  const u = clickerData.upgrades;
  const s = clickerData.seeds;

  setUpgradeBtn('btnAutoClicker', 'upgradeAutoClicker', u.autoClicker,   s >= 200);
  setUpgradeBtn('btnAutoSpeed',   'upgradeAutoSpeed',   u.autoSpeed,     u.autoClicker && !u.autoSpeed && s >= 1000);
  setUpgradeBtn('btnSuperSpeed',  'upgradeSuperSpeed',  u.superSpeed,    u.autoSpeed && !u.superSpeed && s >= 10000);
  setUpgradeBtn('btnUltraSpeed',  'upgradeUltraSpeed',  u.ultraSpeed,    u.superSpeed && !u.ultraSpeed && s >= 100000);
  setUpgradeBtn('btnStockExt',    'upgradeStockExt',    u.stockExt,      u.autoClicker && !u.stockExt && s >= 2000);
  setUpgradeBtn('btnStockExt2',   'upgradeStockExt2',   u.stockExt2,     u.stockExt && !u.stockExt2 && s >= 5000);
  setUpgradeBtn('btnStockExt3',   'upgradeStockExt3',   u.stockExt3,     u.stockExt2 && !u.stockExt3 && s >= 100000);
  setUpgradeBtn('btnSecondFruit', 'upgradeSecondFruit', u.secondFruit,   u.autoClicker && !u.secondFruit && s >= 10000);

  // Griser les upgrades dont le prérequis n'est pas rempli (mais pas encore achetées)
  const greyIfLocked = (cardId, locked) => {
    const card = document.getElementById(cardId);
    if (card && card.style.display !== 'none') card.style.opacity = locked ? '.4' : '';
  };
  greyIfLocked('upgradeAutoSpeed',  !u.autoClicker);
  greyIfLocked('upgradeSuperSpeed', !u.autoSpeed);
  greyIfLocked('upgradeUltraSpeed', !u.superSpeed);
  greyIfLocked('upgradeStockExt',   !u.autoClicker);
  greyIfLocked('upgradeStockExt2',  !u.stockExt);
  greyIfLocked('upgradeStockExt3',  !u.stockExt2);

  updateExchangePrice();
}

function clickFruit(fruitNum) {
  if (!clickerActive) return;
  // 2 graines par clic si les 2 fruits sont débloqués, sinon 1
  const gain = clickerData.upgrades.secondFruit ? 2 : 1;
  clickerData.seeds += gain;
  // Historique pour le score de groupe (regroupé toutes les 10 graines pour éviter le spam)
  clickerData._pendingSeeds = (clickerData._pendingSeeds || 0) + gain;
  if (clickerData._pendingSeeds >= 10) {
    trackSeedsEarned(state, clickerData._pendingSeeds);
    state.history.unshift({ type: 'seeds', desc: `🌱 ${clickerData._pendingSeeds} graines récoltées (clicker)`, seeds: clickerData._pendingSeeds, amount: 0, date: new Date().toISOString() });
    clickerData._pendingSeeds = 0;
    saveAccount(state);
  }

  const fruit = document.getElementById('fruit' + fruitNum);
  fruit.classList.remove('clicker-fruit-pop');
  void fruit.offsetWidth;
  fruit.classList.add('clicker-fruit-pop');
  setTimeout(() => fruit.classList.remove('clicker-fruit-pop'), 150);

  const rect = fruit.getBoundingClientRect();
  const span = document.createElement('span');
  span.className = 'clicker-seed-float';
  span.textContent = '+' + gain + ' 🌱';
  span.style.left = (rect.left + rect.width / 2 - 20) + 'px';
  span.style.top = (rect.top - 10) + 'px';
  document.body.appendChild(span);
  setTimeout(() => span.remove(), 850);

  updateClickerUI();
  debouncedSaveClicker();
}

function collectAutoStock() {
  if (clickerData.autoStock <= 0) return;
  const collected = Math.floor(clickerData.autoStock);
  clickerData.seeds += collected;
  clickerData.autoStock = 0;
  // Historique pour le score de groupe
  trackSeedsEarned(state, collected);
  state.history.unshift({ type: 'seeds', desc: `🌱 ${collected.toLocaleString('fr-FR')} graines récoltées (auto)`, seeds: collected, amount: 0, date: new Date().toISOString() });
  saveAccount(state);
  updateClickerUI();
  saveClickerData();
  showWinToast(`+${collected.toLocaleString('fr-FR')} 🌱 graines récupérées !`);
}

function buyUpgrade(id) {
  const costs = {
    autoClicker: 200, autoSpeed: 1000, superSpeed: 10000, ultraSpeed: 100000,
    stockExt: 2000, stockExt2: 5000, stockExt3: 100000,
    secondFruit: 10000
  };
  const cost = costs[id];
  if (!cost || clickerData.upgrades[id] || clickerData.seeds < cost) return;

  // Prérequis : tout nécessite l'auto-clicker de base
  if (id !== 'autoClicker' && !clickerData.upgrades.autoClicker) return;
  // Vitesses : ordre obligatoire
  if (id === 'superSpeed' && !clickerData.upgrades.autoSpeed) return;
  if (id === 'ultraSpeed' && !clickerData.upgrades.superSpeed) return;
  // Stocks : ordre obligatoire
  if (id === 'stockExt2' && !clickerData.upgrades.stockExt) return;
  if (id === 'stockExt3' && !clickerData.upgrades.stockExt2) return;

  clickerData.seeds -= cost;
  clickerData.upgrades[id] = true;

  // Redémarrer l'auto-clicker si la vitesse ou le taux change
  if (['autoClicker', 'autoSpeed', 'superSpeed', 'ultraSpeed', 'secondFruit'].includes(id)) {
    startAutoClicker();
  }

  updateClickerUI();
  saveClickerData();
}

function updateExchangePrice() {
  const input = document.getElementById('exchangeAmount');
  const costEl = document.getElementById('exchangeCost');
  const btn = document.getElementById('btnExchange');
  if (!input || !costEl) return;
  const pomels = Math.max(0, parseInt(input.value) || 0);
  const cost = pomels * 100;
  costEl.textContent = cost.toLocaleString('fr-FR');
  const canExchange = pomels > 0 && clickerData.seeds >= cost;
  btn.disabled = !canExchange;
  btn.textContent = canExchange ? 'Échanger' : (clickerData.seeds < cost ? 'Pas assez' : 'Échanger');
}

async function exchangeSeeds() {
  const pomels = parseInt(document.getElementById('exchangeAmount').value) || 0;
  const cost = pomels * 100;
  if (pomels <= 0 || clickerData.seeds < cost) return;
  clickerData.seeds -= cost;
  await saveClickerData();
  const exchUpd = await addBalanceTransaction(state.code, pomels, {
    type: 'clicker', desc: `🌱 Échange : ${cost} graines → ${pomels} Pomels`, amount: pomels, date: new Date().toISOString()
  });
  if (exchUpd) { state = migrateAccount(exchUpd); }
  else { state.balance += pomels; }
  refreshUI();
  updateClickerUI();
  document.getElementById('exchangeAmount').value = '';
  updateExchangePrice();
  showWinToast(`+${pomels.toLocaleString('fr-FR')} Pomels échangés ! 💱`);
}


// ── JARDIN DE POMEL'LAND ─────────────────────────
const JARDIN_FLOWER_COST = 10000;
const JARDIN_W = 600;
const JARDIN_H = 400;
const JARDIN_PRIZES = [2000, 1500, 1000];
const CONSOLATION = 500;
let jardinTimerInterval = null;

// Calcule le prochain dimanche à 12h
// Prochain dimanche 12h (reset) — si on EST dimanche avant 12h, c'est aujourd'hui
function nextJardinReset() {
  const now = new Date();
  const d = new Date(now);
  const day = d.getDay(); // 0=Sun
  if (day === 0 && (now.getHours() < 12)) {
    // Ce dimanche à 12h
    d.setHours(12, 0, 0, 0);
  } else {
    const daysUntilSun = day === 0 ? 7 : 7 - day;
    d.setDate(d.getDate() + daysUntilSun);
    d.setHours(12, 0, 0, 0);
  }
  return d;
}

// Jardin fermé : dimanche 12h00 → lundi 12h30
function isJardinClosed() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon
  const h = now.getHours(), m = now.getMinutes();
  const totalMin = h * 60 + m;
  if (day === 0 && totalMin >= 12 * 60) return true;       // dim à partir de 12h00
  if (day === 1 && totalMin < 12 * 60 + 30) return true;   // lun avant 12h30
  return false;
}

function jardinClosedUntil() {
  const now = new Date();
  const d = new Date(now);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() + 1); // dimanche → lundi
  // Si on est lundi mais après 12h30 ça ne devrait pas arriver, mais au cas où
  d.setHours(12, 30, 0, 0);
  return d;
}

// Clé de semaine stable — basée sur le dernier dimanche 12h passé
function getJardinWeekKey() {
  const now = new Date();
  const day = now.getDay();
  const h = now.getHours(), m = now.getMinutes();

  // Trouver le dernier dimanche à 12h passé
  const lastSunday = new Date(now);
  if (day === 0 && (h > 12 || (h === 12 && m >= 0))) {
    // Ce dimanche à 12h est passé — c'est lui le début de semaine
    lastSunday.setHours(12, 0, 0, 0);
  } else if (day === 0) {
    // Dimanche avant 12h — remonter au dimanche précédent
    lastSunday.setDate(lastSunday.getDate() - 7);
    lastSunday.setHours(12, 0, 0, 0);
  } else {
    // Lundi à dimanche — remonter au dernier dimanche
    lastSunday.setDate(lastSunday.getDate() - day);
    lastSunday.setHours(12, 0, 0, 0);
  }

  const y = lastSunday.getFullYear();
  const mo = String(lastSunday.getMonth() + 1).padStart(2, '0');
  const da = String(lastSunday.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function jardinTimerString() {
  const now = new Date();
  const labelEl = document.getElementById('jardinTimerLabel');
  if (isJardinClosed()) {
    const opens = jardinClosedUntil();
    const diff = opens - now;
    if (labelEl) labelEl.textContent = '🔒 Réouverture dans';
    if (diff <= 0) return 'Imminente…';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  }
  if (labelEl) labelEl.textContent = '🔄 Reset dans';
  const reset = nextJardinReset();
  const diff = reset - now;
  if (diff <= 0) return 'Bientôt !';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return days > 0 ? `${days}j ${hours}h ${mins}m` : `${hours}h ${mins}m`;
}

// Génère une fleur SVG harmonieuse et unique basée sur le code du joueur + index
function generateFlower(playerCode, flowerIndex, x, y) {
  // Seed déterministe
  let seed = 0;
  for (let i = 0; i < playerCode.length; i++) seed += playerCode.charCodeAt(i) * (i + 1);
  seed += flowerIndex * 137;
  const rng = (n) => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return Math.abs(seed % n); };

  const petalCount = 5 + rng(5); // 5-9 pétales
  const petalLen = 12 + rng(10);  // longueur pétale
  const petalW = 5 + rng(6);      // largeur pétale
  const stemH = 18 + rng(12);     // hauteur tige
  // Couleur basée sur le code joueur — palette harmonieuse
  const hues = [0, 30, 60, 120, 200, 270, 300, 330];
  const hue = hues[rng(hues.length)];
  const sat = 60 + rng(30);
  const lit = 55 + rng(20);
  const color = `hsl(${hue},${sat}%,${lit}%)`;
  const centerColor = `hsl(${(hue+40)%360},${sat}%,${lit+10}%)`;
  const centerR = 3 + rng(3);

  let petals = '';
  for (let p = 0; p < petalCount; p++) {
    const angle = (p * 360 / petalCount) - 90;
    petals += `<ellipse cx="${petalLen/2}" cy="0" rx="${petalLen/2}" ry="${petalW/2}"
      fill="${color}" opacity="0.9"
      transform="rotate(${angle}, 0, 0)" />`;
  }

  return { x, y, stemH, petals, centerR, centerColor, color, petalLen };
}

function drawJardin(flowers) {
  const canvas = document.getElementById('jardinCanvas');
  if (!canvas) return;
  canvas.width = JARDIN_W;
  canvas.height = JARDIN_H;
  const ctx = canvas.getContext('2d');

  // Background — jardin herbeux
  const grad = ctx.createLinearGradient(0, 0, 0, JARDIN_H);
  grad.addColorStop(0, '#0d1a0f');
  grad.addColorStop(1, '#132b15');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, JARDIN_W, JARDIN_H);

  // Sol herbeux
  ctx.fillStyle = '#1a3d1c';
  ctx.fillRect(0, JARDIN_H - 30, JARDIN_W, 30);

  // Herbes de fond (déco)
  ctx.strokeStyle = '#2d5c30';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const gx = (i * 61) % JARDIN_W;
    ctx.beginPath();
    ctx.moveTo(gx, JARDIN_H - 30);
    ctx.lineTo(gx - 3 + (i%3), JARDIN_H - 38 - (i%5)*2);
    ctx.stroke();
  }

  if (!flowers || flowers.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '14px Syne, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Le jardin est vide… Plante la première fleur !', JARDIN_W/2, JARDIN_H/2);
    return;
  }

  // Trier par y pour perspective (fleurs du bas par-dessus)
  const sorted = [...flowers].sort((a, b) => a.y - b.y);

  sorted.forEach(f => {
    const fl = generateFlower(f.playerCode, f.flowerIndex, f.x, f.y);

    // Tige
    ctx.strokeStyle = '#3a7d44';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.quadraticCurveTo(f.x + 3, f.y - fl.stemH * 0.6, f.x, f.y - fl.stemH);
    ctx.stroke();

    // Pétales via SVG path dessiné sur canvas
    ctx.save();
    ctx.translate(f.x, f.y - fl.stemH);
    const petalCount = 5 + (Math.abs(hashCode(f.playerCode) + f.flowerIndex * 137) % 5);
    const petalLen = fl.petalLen;
    const petalW = 5 + (Math.abs(hashCode(f.playerCode) * 3 + f.flowerIndex) % 6);
    for (let p = 0; p < petalCount; p++) {
      const angle = (p * Math.PI * 2 / petalCount) - Math.PI / 2;
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = fl.color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(petalLen / 2, 0, petalLen / 2, petalW / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Centre
    ctx.globalAlpha = 1;
    ctx.fillStyle = fl.centerColor;
    ctx.beginPath();
    ctx.arc(0, 0, fl.centerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

async function renderJardin() {
  if (jardinTimerInterval) clearInterval(jardinTimerInterval);
  const timerEl = document.getElementById('jardinTimer');
  if (timerEl) {
    timerEl.textContent = jardinTimerString();
    jardinTimerInterval = setInterval(() => {
      if (timerEl) timerEl.textContent = jardinTimerString();
    }, 30000);
  }

  // Jardin fermé (dim 12h → lun 12h30)
  const closed = isJardinClosed();
  const actionBar = document.querySelector('.jardin-action-bar');
  const alertEl = document.getElementById('jardinPlantAlert');
  const canvasWrap = document.querySelector('.jardin-canvas-wrap');

  if (closed) {
    if (actionBar) actionBar.style.display = 'none';
    if (canvasWrap) canvasWrap.style.display = 'none';
    const lbSection = document.getElementById('jardinLbSection');
    if (lbSection) lbSection.style.display = 'none';
    alertEl.textContent = '🔒 Le jardin est fermé — les résultats seront annoncés le lundi à 12h, réouverture à 12h30 !';
    alertEl.className = 'alert error visible';
    return;
  } else {
    if (actionBar) actionBar.style.display = 'flex';
    if (canvasWrap) canvasWrap.style.display = 'block';
    const lbSection = document.getElementById('jardinLbSection');
    if (lbSection) lbSection.style.display = 'block';
    alertEl.className = 'alert';
  }

  await checkJardinReset();

  const data = await getJardin() || { weekKey: getJardinWeekKey(), flowers: [] };
  const flowers = data.flowers || [];

  const savedClicker = await dbGet('clicker/' + state.code);
  const mySeeds = savedClicker ? Math.floor(savedClicker.seeds || 0) : 0;
  document.getElementById('jardinSeedsCount').textContent = mySeeds.toLocaleString('fr-FR');

  const myFlowers = flowers.filter(f => f.playerCode === state.code).length;
  document.getElementById('jardinMyFlowers').textContent = myFlowers;

  const plantBtn = document.getElementById('jardinPlantBtn');
  plantBtn.disabled = mySeeds < JARDIN_FLOWER_COST;

  drawJardin(flowers);
  renderJardinLb(flowers);
}

function renderJardinLb(flowers) {
  const list = document.getElementById('jardinLbList');
  if (!list) return;
  if (!flowers.length) { list.innerHTML = '<div class="history-empty">Aucune fleur plantée.</div>'; return; }

  // Count per player
  const counts = {};
  flowers.forEach(f => {
    if (!counts[f.playerCode]) counts[f.playerCode] = { name: f.playerName, code: f.playerCode, count: 0 };
    counts[f.playerCode].count++;
  });
  const sorted = Object.values(counts).sort((a, b) => b.count - a.count);

  const medals = ['🥇','🥈','🥉'];
  list.innerHTML = '';
  (async () => {
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const isMe = flowers.find(f => f.playerCode === state.code && f.playerName === p.name);
      const prize = i < 3 ? JARDIN_PRIZES[i] : CONSOLATION;
      const div = document.createElement('div');
      div.className = 'snake-lb-item' + (isMe ? ' me' : '');
      const bcJ = await getAccBannerClass(p.code);
      if (bcJ) div.classList.add(bcJ);
      const ccJ = await getAccColorClass(p.code);
      div.innerHTML = `
        <span class="snake-lb-rank ${i < 3 ? 'top'+(i+1) : ''}">${medals[i] || (i+1)}</span>
        <span class="snake-lb-name ${ccJ}">${escapeHTML(p.name)}${isMe ? ' <span class="lb-you-badge">Moi</span>' : ''}</span>
        <span class="snake-lb-score">${p.count} 🌸</span>
        <span class="snake-lb-pomels">→ ${prize.toLocaleString('fr-FR')} 🪙</span>
      `;
      list.appendChild(div);
    }
  })();
}

async function checkJardinReset() {
  // Ne déclencher la distribution QUE le lundi après 12h00
  // (la réouverture UI reste à 12h30 via isJardinClosed)
  const now = new Date();
  const day = now.getDay();
  const totalMin = now.getHours() * 60 + now.getMinutes();
  if (day !== 1 || totalMin < 12 * 60) return;

  const data = await getJardin();
  const currentKey = getJardinWeekKey();

  // Déjà distribué cette semaine
  if (data && data.weekKey === currentKey) return;

  // Protection race condition : un autre client est en train de distribuer
  if (data && data.resetInProgress) return;

  // Marquer le reset en cours AVANT de distribuer (flag optimiste)
  await saveJardin({ ...(data || {}), resetInProgress: true });

  // Petit délai aléatoire puis re-lecture pour "gagner la course"
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  const check = await getJardin();
  // Si entre-temps un autre client a déjà fini (weekKey == currentKey) → abandonner
  if (!check || check.weekKey === currentKey || !check.resetInProgress) return;

  // Distribution des récompenses
  let winners = [];
  if (data && data.flowers && data.flowers.length > 0) {
    winners = await distributeJardinRewards(data.flowers);
  }

  // Sauvegarder le nouveau jardin vide
  await saveJardin({
    weekKey: currentKey,
    flowers: [],
    resetInProgress: false,
    lastWinners: winners,
    lastWinnersDate: new Date().toISOString(),
  });
}

async function distributeJardinRewards(flowers) {
  const counts = {};
  flowers.forEach(f => {
    if (!counts[f.playerCode]) counts[f.playerCode] = { name: f.playerName, code: f.playerCode, count: 0 };
    counts[f.playerCode].count++;
  });
  const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
  const winners = [];

  const toDistribute = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const prize = i < 3 ? JARDIN_PRIZES[i] : CONSOLATION;
    toDistribute.push({ code: p.code, amount: prize, historyEntry: {
      type: 'jardin', desc: `🌸 Jardin de Pomel'Land — ${i < 3 ? `#${i+1}` : 'participant'}`, amount: prize, date: new Date().toISOString()
    }});
    winners.push({ rank: i + 1, name: p.name, code: p.code, count: p.count, prize });
  }
  await distributeReliably(toDistribute);
  return winners;
}

async function plantFlower() {
  if (isJardinClosed()) {
    setAlert('jardinPlantAlert', '🔒 Le jardin est fermé en ce moment !', 'error');
    return;
  }

  // Lire les graines directement depuis Firebase (source de vérité)
  const savedClicker = await dbGet('clicker/' + state.code);
  const mySeeds = savedClicker ? Math.floor(savedClicker.seeds || 0) : 0;

  if (mySeeds < JARDIN_FLOWER_COST) {
    setAlert('jardinPlantAlert', `Il te faut ${JARDIN_FLOWER_COST.toLocaleString('fr-FR')} 🌱 (tu en as ${mySeeds.toLocaleString('fr-FR')}).`, 'error');
    return;
  }

  // Déduire les graines — mettre à jour clickerData ET Firebase
  clickerData.seeds = Math.max(0, mySeeds - JARDIN_FLOWER_COST);
  clickerData.autoStock = savedClicker ? Math.floor(savedClicker.autoStock || 0) : 0;
  clickerData.upgrades = savedClicker ? (savedClicker.upgrades || {}) : {};
  clickerData.lastSaved = savedClicker ? (savedClicker.lastSaved || null) : null;
  clickerData.loaded = true;
  await saveClickerData();

  // Récupérer le jardin courant (après reset éventuel)
  await checkJardinReset();
  const freshData = await getJardin() || { weekKey: getJardinWeekKey(), flowers: [], lastWinners: [], lastWinnersDate: null };

  // S'assurer que flowers est un tableau
  if (!Array.isArray(freshData.flowers)) freshData.flowers = [];

  const myFlowers = freshData.flowers.filter(f => f.playerCode === state.code);

  // Position dans le canvas — zone herbacée visible
  const margin = 35;
  const x = margin + Math.floor(Math.random() * (JARDIN_W - margin * 2));
  const y = 60 + Math.floor(Math.random() * (JARDIN_H - 100)); // entre y=60 et y=JARDIN_H-40

  freshData.flowers.push({
    playerCode: state.code,
    playerName: state.name,
    flowerIndex: myFlowers.length,
    x, y,
    plantedAt: new Date().toISOString(),
  });

  await saveJardin(freshData);
  setAlert('jardinPlantAlert', '🌸 Fleur plantée avec succès !', 'success');
  setTimeout(() => {
    const el = document.getElementById('jardinPlantAlert');
    if (el) el.className = 'alert';
  }, 3000);
  renderJardin();
}


console.log('[Clicker+Jardin] Module loaded ✓');

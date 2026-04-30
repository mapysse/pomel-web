/* ═══════════════════════════════════════════════════════════════════════════
   BOUTIQUE_PROFIL.JS — Boutique Profil (titres, badges, bannières, couleurs)
   ═══════════════════════════════════════════════════════════════════════════
   Dépend de : state, addBalanceTransaction, migrateAccount, refreshUI,
               saveAccount, setAlert, toggleTitle, toggleColor,
               toggleBadge, toggleBanner
   ═══════════════════════════════════════════════════════════════════════════ */

// ── CSS ──────────────────────────────────────────
(function() {
  const style = document.createElement('style');
  style.id = 'boutique-profil-styles';
  style.textContent = `
    .boutique-wrap { display: flex; flex-direction: column; gap: 24px; }
    .boutique-header { display: flex; flex-direction: column; gap: 4px; }
    .shop-section-title { font-size: 1.4rem; font-weight: 800; letter-spacing: -.5px; }
    .shop-section-sub { font-size: .85rem; color: var(--muted); }
    .shop-tabs { display: flex; gap: 6px; background: var(--surface2); border-radius: 10px; padding: 4px; width: fit-content; }
    .shop-tab { background: transparent; border: none; border-radius: 8px; padding: 8px 18px; font-family: 'Syne', sans-serif; font-size: .85rem; font-weight: 600; color: var(--muted); cursor: pointer; transition: all .2s; }
    .shop-tab.active { background: var(--primary); color: #fff; }
    .shop-tab:not(.active):hover { background: var(--surface); color: var(--text); }
    .shop-cols { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; align-items: start; }
    @media (max-width: 900px) { .shop-cols { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 750px) { .shop-cols { grid-template-columns: minmax(0, 1fr); } }
    .shop-col { display: flex; flex-direction: column; gap: 8px; }
    .shop-col-title { font-size: .7rem; font-weight: 700; color: var(--muted); letter-spacing: .1em; text-transform: uppercase; padding: 10px 14px 8px; border-bottom: 1px solid var(--border); margin-bottom: 2px; }
    .shop-item { background: var(--surface); border: 1px solid var(--border-subtle); border-radius: var(--radius); padding: 14px; display: flex; flex-direction: column; gap: 8px; transition: all var(--transition); min-width: 0; overflow: hidden; }
    .shop-item:hover { border-color: rgba(235,88,70,0.3); box-shadow: 0 4px 16px var(--primary-glow); transform: translateY(-1px); }
    .shop-item.owned { border-color: var(--green); opacity: .75; }
    .shop-item-name { font-weight: 700; font-size: .92rem; line-height: 1.3; }
    .shop-item-desc { font-size: .75rem; color: var(--muted); line-height: 1.4; }
    .shop-item-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; flex-wrap: wrap; }
    .shop-item-price { font-family: 'Space Mono', monospace; font-size: .82rem; color: var(--primary); font-weight: 700; }
    .btn-buy { background: var(--primary); color: #fff; border: none; border-radius: 8px; padding: 7px 14px; font-family: 'Syne', sans-serif; font-size: .8rem; font-weight: 700; cursor: pointer; transition: all .2s; white-space: nowrap; flex-shrink: 0; }
    .btn-buy:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
    .btn-buy:disabled { opacity: .4; cursor: not-allowed; }
    .btn-buy.owned-btn { background: var(--green); }
    .title-badge { display: inline-block; font-size: .65rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: rgba(235,88,70,0.15); color: var(--primary); border: 1px solid rgba(235,88,70,0.3); margin: 2px; }
  `;
  document.head.appendChild(style);
})();

// ── ITEMS BOUTIQUE ───────────────────────────────
const SHOP_TITLES = [
  // ── SAISON 1 ──────────────────────────────────────
  { id: 'survivant_bug_30mars', name: '🐛 Survivant du bug du 30 mars', price: 0, type: 'title', hidden: true },
  { id: 'migration', name: '📡 Migration réussie. Over.', price: 0, type: 'title', hidden: true },
  { id: 'free_plstn', name: 'Free Palestine', price: 1000, type: 'title', hidden: true },
  { id: 'larry_malicieux', name: 'Larry le Malicieux', price: 1000, type: 'title', hidden: true },
  { id: 'fan_burger_lidl', name: 'Fan 2 burgers LIDL', price: 1000, type: 'title', hidden: true },
  { id: 'maitre_pokemon', name: 'Maître Pokemon', price: 10000, type: 'title', hidden: true },
  { id: 'criminel_wc', name: 'Criminel des WC', price: 10000, type: 'title', hidden: true },
  { id: 'expert_pomdoc', name: 'Expert Pomdoc', price: 100000, type: 'title', hidden: true },
  { id: 'rainbow', name: 'Effet Arc-en-ciel', price: 50000, type: 'color', desc: 'Pseudo arc-en-ciel animé !', hidden: true },
  { id: 'sparkle', name: '✨ Effet Particules Brillantes', price: 50000, type: 'color', desc: 'Pseudo entouré de particules colorées scintillantes !', hidden: true },
  { id: 'color_green', name: '🟢 Pseudo Vert', price: 1000, type: 'color', desc: 'Ton pseudo s\'affiche en vert', hidden: true },
  { id: 'color_blue', name: '🔵 Pseudo Bleu', price: 1000, type: 'color', desc: 'Ton pseudo s\'affiche en bleu', hidden: true },
  { id: 'color_orange', name: '🟠 Pseudo Orange', price: 1000, type: 'color', desc: 'Ton pseudo s\'affiche en orange', hidden: true },
  { id: 'color_red', name: '🔴 Pseudo Rouge', price: 1000, type: 'color', desc: 'Ton pseudo s\'affiche en rouge', hidden: true },
  { id: 'color_brown', name: '🟤 Pseudo Marron', price: 1000, type: 'color', desc: 'Ton pseudo s\'affiche en marron', hidden: true },
  { id: 'badge_survivant_30mars', name: 'Badge Survivant 🪲', price: 0, type: 'badge', emoji: '🪲', hidden: true },
  { id: 'badge_plstn', name: 'Badge Palestine 🇵🇸', price: 500, type: 'badge', emoji: '🇵🇸', hidden: true },
  { id: 'badge_expert', name: 'Badge Expert 🎖️', price: 1000, type: 'badge', emoji: '🎖️', hidden: true },
  { id: 'badge_toilettes', name: 'Badge Trône du criminel 🚽', price: 2500, type: 'badge', emoji: '🚽', hidden: true },
  { id: 'badge_pomelien', name: 'Badge Pomélien 🌟', price: 5000, type: 'badge', emoji: '🌟', hidden: true },
  { id: 'badge_censure', name: 'Badge Censure 🚫', price: 10000, type: 'badge', emoji: '🚫', hidden: true },
  // ── BANNIÈRES ──────────────────────────────────────
  // Couleurs unies
  { id: 'banner_red',    name: '🟥 Bannière Rouge',   price: 5000,  type: 'banner', bannerClass: 'banner-red',    desc: 'Fond rouge sur ta carte de profil', hidden: true },
  { id: 'banner_green',  name: '🟩 Bannière Verte',   price: 5000,  type: 'banner', bannerClass: 'banner-green',  desc: 'Fond vert sur ta carte de profil', hidden: true },
  { id: 'banner_blue',   name: '🟦 Bannière Bleue',   price: 5000,  type: 'banner', bannerClass: 'banner-blue',   desc: 'Fond bleu sur ta carte de profil', hidden: true },
  { id: 'banner_orange', name: '🟧 Bannière Orange',  price: 5000,  type: 'banner', bannerClass: 'banner-orange', desc: 'Fond orange sur ta carte de profil', hidden: true },
  { id: 'banner_purple', name: '🟪 Bannière Violette',price: 5000,  type: 'banner', bannerClass: 'banner-purple', desc: 'Fond violet sur ta carte de profil', hidden: true },
  // Motifs
  { id: 'banner_damier',        name: '🔲 Motif Damier',       price: 25000, type: 'banner', bannerClass: 'banner-damier',        desc: 'Fond en damier subtil', hidden: true },
  { id: 'banner_vagues',        name: '〰️ Motif Vagues',        price: 25000, type: 'banner', bannerClass: 'banner-vagues',        desc: 'Fond orné de vagues ondulées', hidden: true },
  { id: 'banner_constellation', name: '✦ Motif Constellation', price: 25000, type: 'banner', bannerClass: 'banner-constellation', desc: 'Fond étoilé comme un ciel nocturne', hidden: true },
  // Effets animés
  { id: 'banner_rainbow', name: '🌈 Effet Arc-en-ciel', price: 75000, type: 'banner', bannerClass: 'banner-rainbow', desc: 'Fond arc-en-ciel animé en boucle !', hidden: true },
  { id: 'banner_aurora',  name: '🌌 Effet Aurore',     price: 75000, type: 'banner', bannerClass: 'banner-aurora',  desc: 'Blobs de lumière qui dérivent doucement', hidden: true },
  { id: 'banner_plasma',  name: '⚡ Effet Plasma',     price: 75000, type: 'banner', bannerClass: 'banner-plasma',  desc: 'Pulsation électrique rouge intense', hidden: true },
  // ── SAISON 2 ──────────────────────────────────────
  { id: 'fan_malicieux', name: 'Fan des Malicieux', price: 10000, type: 'title' },
  { id: 'fan_foufoufdefou', name: 'Fan des Foufous de Fou', price: 10000, type: 'title' },
  { id: 'fan_etincelles', name: 'Fan des Étincelles', price: 10000, type: 'title' },
  { id: 'guerrier_saison2', name: '🥷 Guerrier/ère de la Saison 2', price: 50000, type: 'title' },
  { id: 'survivant_saison1', name: '🪖 Survivant/te de la Saison 1', price: 100000, type: 'title' },
  { id: 'badge_casquette', name: 'Badge Corpo 🧢', price: 1000, type: 'badge', emoji: '🧢' },
  { id: 'badge_pomfest', name: 'Badge PomFest 🎉', price: 5000, type: 'badge', emoji: '🎉' },
  { id: 'badge_pomies', name: 'Badge Pomies 💰', price: 10000, type: 'badge', emoji: '💰' },
  { id: 'pulse', name: '💓 Effet Pulsant', price: 35000, type: 'color', desc: 'Ton pseudo pulse doucement entre brillant et sombre' },
  { id: 'glitch', name: '👾 Effet Glitch', price: 50000, type: 'color', desc: 'Ton pseudo glitche comme un écran cassé !' },
  { id: 'neon', name: '💡 Effet Néon', price: 50000, type: 'color', desc: 'Ton pseudo brille comme une enseigne néon !' },
  // ── BANNIÈRES ──────────────────────────────────────
  // Couleurs unies
  { id: 'banner_gold',    name: '🟨 Bannière Dorée',   price: 5000,  type: 'banner', bannerClass: 'banner-gold',    desc: 'Fond dorée sur ta carte de profil' },
  { id: 'banner_black',    name: '⬛ Bannière Noire',   price: 5000,  type: 'banner', bannerClass: 'banner-black',    desc: 'Fond noir sur ta carte de profil' },
  // Motifs
  { id: 'banner_diagonales', name: '╲ Motif Diagonales', price: 25000, type: 'banner', bannerClass: 'banner-diagonales', desc: 'Lignes diagonales élégantes sur ta carte' },
  { id: 'banner_grille_pastel', name: '🎨 Motif Grille Pastel', price: 25000, type: 'banner', bannerClass: 'banner-grille-pastel', desc: 'Grille aux couleurs pastel douces' },
  // Effets animés
  { id: 'banner_flammes', name: '🔥 Effet Flammes', price: 75000, type: 'banner', bannerClass: 'banner-flammes', desc: 'Des flammes dansent au bas de ta carte !' },
  { id: 'banner_neige', name: '❄️ Effet Neige', price: 75000, type: 'banner', bannerClass: 'banner-neige', desc: 'Des flocons tombent doucement sur ta carte' },
];

// ── BOUTIQUE / SHOP ─────────────────────────────
let _shopCurrentTab = 'buy';

function switchShopTab(tab) {
  _shopCurrentTab = tab;
  document.getElementById('shopTabBuy').classList.toggle('active', tab === 'buy');
  document.getElementById('shopTabInventory').classList.toggle('active', tab === 'inventory');
  document.getElementById('shopViewBuy').style.display      = tab === 'buy'       ? '' : 'none';
  document.getElementById('shopViewInventory').style.display = tab === 'inventory' ? '' : 'none';
  if (tab === 'inventory') renderShopInventory();
  else renderShop();
}

function renderShop() {
  const grid = document.getElementById('shopGrid');
  grid.innerHTML = '';

  const sections = [
    { label: '🏷️ Titres',   types: ['title'],  emptyMsg: 'Aucun titre disponible.' },
    { label: '🎨 Couleurs', types: ['color'],  emptyMsg: 'Aucune couleur disponible.' },
    { label: '🏅 Badges',   types: ['badge'],  emptyMsg: 'Aucun badge disponible.' },
    { label: '🖼️ Bannières',types: ['banner'], emptyMsg: 'Aucune bannière disponible.' },
  ];

  const now = Date.now();

  sections.forEach(sec => {
    const items = SHOP_TITLES.filter(t => {
      if (!sec.types.includes(t.type)) return false;
      if (t.hidden) return false;
      if ((state.ownedTitles || []).includes(t.id)) return false; // masquer les achetés
      if (t.expiresAt && now > t.expiresAt) return false;
      return true;
    });

    // Colonne
    const col = document.createElement('div');
    col.className = 'shop-col';

    // Titre de colonne
    const colTitle = document.createElement('div');
    colTitle.className = 'shop-col-title';
    colTitle.textContent = sec.label;
    col.appendChild(colTitle);

    if (!items.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:.82rem;color:var(--muted);padding:10px 14px;';
      empty.textContent = 'Tout acheté dans cette catégorie !';
      col.appendChild(empty);
      grid.appendChild(col);
      return;
    }

    items.forEach(title => {
      const canAfford = state.balance >= title.price;

      const item = document.createElement('div');
      item.className = 'shop-item';

      const nameClass = getNameColorClass(title.id);

      if (title.type === 'banner' && title.bannerClass) {
        item.classList.add(title.bannerClass);
      }
      const bannerPreviewHtml = title.type === 'banner' && title.bannerClass
        ? `<div class="${title.bannerClass}" style="width:100%;height:10px;border-radius:4px;border:1px solid var(--border);margin-bottom:2px;"></div>`
        : '';

      let countdownHtml = '';
      if (title.expiresAt && now <= title.expiresAt) {
        const rem = title.expiresAt - now;
        const h = Math.floor(rem / 3600000);
        const m = Math.floor((rem % 3600000) / 60000);
        const s = Math.floor((rem % 60000) / 1000);
        const pad = n => String(n).padStart(2, '0');
        countdownHtml = `<div style="font-size:.7rem;color:var(--yellow);font-weight:700;">⏳ ${pad(h)}h${pad(m)}m${pad(s)}s</div>`;
      }

      const priceHtml = title.price === 0
        ? '<span style="color:var(--green);font-weight:700;">Gratuit !</span>'
        : title.price.toLocaleString('fr-FR') + ' 🪙';

      const descHtml = title.desc
        ? `<div class="shop-item-desc">${title.desc}</div>`
        : '';

      item.innerHTML = `
        ${bannerPreviewHtml}
        <div class="shop-item-name ${nameClass}">${title.name}</div>
        ${descHtml}
        ${countdownHtml}
        <div class="shop-item-footer">
          <div class="shop-item-price">${priceHtml}</div>
          <button class="btn-buy" ${!canAfford ? 'disabled' : ''} onclick="buyTitle('${title.id}')">${canAfford ? 'Acheter' : 'Pas assez !'}</button>
        </div>
      `;
      col.appendChild(item);
    });

    grid.appendChild(col);
  });

  startShopCountdown();
}

function renderShopInventory() {
  const container = document.getElementById('shopInventoryGrid');
  container.innerHTML = '';

  const owned = state.ownedTitles || [];

  const sections = [
    { label: '🏷️ Titres',    types: ['title'],  toggle: 'title'  },
    { label: '🎨 Couleurs',  types: ['color'],  toggle: 'color'  },
    { label: '🏅 Badges',    types: ['badge'],  toggle: 'badge'  },
    { label: '🖼️ Bannières', types: ['banner'], toggle: 'banner' },
  ];

  // Items de l'hôtel (customTitles)
  const customItems = Object.values(state.customTitles || {});

  let hasAnything = false;

  sections.forEach(sec => {
    // Items boutique possédés de cette catégorie
    const shopItems = SHOP_TITLES.filter(t =>
      sec.types.includes(t.type) && owned.includes(t.id)
    );
    // Items hôtel (type title uniquement dans la section Titres)
    const hotelItems = sec.toggle === 'title'
      ? customItems.filter(t => owned.includes(t.id))
      : [];

    const allItems = [...shopItems, ...hotelItems];
    if (!allItems.length) return;
    hasAnything = true;

    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:20px;';

    const secTitle = document.createElement('div');
    secTitle.className = 'shop-col-title';
    secTitle.style.cssText = 'font-size:.72rem;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;padding:10px 0 8px;border-bottom:1px solid var(--border);margin-bottom:10px;';
    secTitle.textContent = sec.label;
    section.appendChild(secTitle);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

    allItems.forEach(title => {
      const isHotel = !!title.id.startsWith('custom_');
      const nameClass = getNameColorClass(title.id);

      // Déterminer l'état actif selon le type
      let isActive = false;
      if (sec.toggle === 'title')  isActive = (state.activeTitles || []).includes(title.id);
      if (sec.toggle === 'color')  isActive = state.activeColor  === title.id;
      if (sec.toggle === 'badge')  isActive = state.activeBadge  === title.id;
      if (sec.toggle === 'banner') isActive = state.activeBanner === title.id;

      const onchangeFn =
        sec.toggle === 'title'  ? `toggleTitle('${title.id}', this.checked); renderShopInventory();` :
        sec.toggle === 'color'  ? `toggleColor('${title.id}', this.checked); renderShopInventory();` :
        sec.toggle === 'badge'  ? `toggleBadge('${title.id}', this.checked); renderShopInventory();` :
                                  `toggleBanner('${title.id}', this.checked); renderShopInventory();`;

      // Aperçu bannière
      const bannerPreview = title.type === 'banner' && title.bannerClass
        ? `<span class="${title.bannerClass}" style="display:inline-block;width:28px;height:16px;border-radius:3px;border:1px solid var(--border);flex-shrink:0;vertical-align:middle;"></span>`
        : '';

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--surface2);border-radius:10px;padding:10px 14px;';
      if (title.type === 'banner' && title.bannerClass) row.classList.add(title.bannerClass);

      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
          ${bannerPreview}
          <span class="shop-item-name ${nameClass}" style="font-size:.9rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title.name}${isHotel ? ' <span style="font-size:.62rem;color:var(--muted);font-weight:400;">(Hôtel)</span>' : ''}</span>
        </div>
        <label class="toggle-switch" style="flex-shrink:0;">
          <input type="checkbox" ${isActive ? 'checked' : ''} onchange="${onchangeFn}" />
          <span class="toggle-slider"></span>
        </label>
      `;
      grid.appendChild(row);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });

  if (!hasAnything) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--muted);">
        <div style="font-size:2rem;margin-bottom:12px;">🛒</div>
        <div style="font-size:.95rem;font-weight:600;">Aucun achat pour l'instant</div>
        <div style="font-size:.82rem;margin-top:6px;">Explore la boutique pour personnaliser ton profil !</div>
        <button class="btn-primary" style="margin-top:18px;width:auto;padding:10px 24px;" onclick="switchShopTab('buy')">Voir la boutique</button>
      </div>`;
  }
}

// Refresh boutique chaque seconde tant qu'un item limité est visible
let _shopCountdownTimer = null;
function startShopCountdown() {
  if (_shopCountdownTimer) return;
  const hasActive = SHOP_TITLES.some(t => t.expiresAt && Date.now() <= t.expiresAt && !(state.ownedTitles || []).includes(t.id));
  if (!hasActive) return;
  _shopCountdownTimer = setInterval(() => {
    const page = document.getElementById('page-boutique');
    if (!page || !page.classList.contains('active')) {
      clearInterval(_shopCountdownTimer); _shopCountdownTimer = null; return;
    }
    renderShop();
  }, 1000);
}

async function buyTitle(titleId) {
  const title = SHOP_TITLES.find(t => t.id === titleId);
  if (!title) return;
  if ((state.ownedTitles || []).includes(titleId)) return;
  if (state.balance < title.price) return;

  // Débiter le prix atomiquement
  if (title.price > 0) {
    const shopUpdated = await addBalanceTransaction(state.code, -title.price, {
      type: 'shop', desc: `Titre acheté : "${title.name}"`, amount: -title.price, date: new Date().toISOString()
    });
    if (shopUpdated) {
      state = migrateAccount(shopUpdated);
    } else {
      setAlert('shopAlert', 'Erreur réseau — réessaie dans quelques secondes.', 'error');
      return;
    }
  }
  if (!state.ownedTitles) state.ownedTitles = [];
  state.ownedTitles.push(titleId);
  await saveAccount(state);
  refreshUI();
  setAlert('shopAlert', `✅ "${title.name}" acheté ! Retrouve-le dans tes achats.`, 'success');
  setTimeout(() => { document.getElementById('shopAlert').className = 'alert'; }, 3500);
  switchShopTab('inventory');
}


console.log('[Boutique] Module loaded ✓');

console.log('[Boutique Profil] Module loaded ✓');

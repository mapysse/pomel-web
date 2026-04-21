/* ═══════════════════════════════════════════════════════════════════════════
   BOUTIQUE.JS — Boutique Groupe pour Pomel
   ═══════════════════════════════════════════════════════════════════════════
   Dépend de : state, dbGet, dbSet, saveAccount, saveGroup,
               escapeHTML, setAlert, getAccount, getAllGroups, getGroup,
               renderGroupsOnPage
   ═══════════════════════════════════════════════════════════════════════════ */

// ── BOUTIQUE GROUPE ─────────────────────────────

const GROUP_SHOP = [
  // Bannières couleurs unies — 2 500 PomCoins
  { id: 'gbanner_red',    cat: 'banner', name: '🟥 Bannière Rouge',    price: 2500, cls: 'group-banner-red',    preview: 'rgba(235,88,70,0.35)' },
  { id: 'gbanner_green',  cat: 'banner', name: '🟩 Bannière Verte',    price: 2500, cls: 'group-banner-green',  preview: 'rgba(62,207,110,0.3)' },
  { id: 'gbanner_blue',   cat: 'banner', name: '🟦 Bannière Bleue',    price: 2500, cls: 'group-banner-blue',   preview: 'rgba(91,141,239,0.3)' },
  { id: 'gbanner_orange', cat: 'banner', name: '🟧 Bannière Orange',   price: 2500, cls: 'group-banner-orange', preview: 'rgba(240,160,64,0.3)' },
  { id: 'gbanner_purple', cat: 'banner', name: '🟪 Bannière Violette', price: 2500, cls: 'group-banner-purple', preview: 'rgba(176,91,239,0.3)' },
  { id: 'gbanner_black',  cat: 'banner', name: '⬛ Bannière Noire',    price: 2500, cls: 'group-banner-black',  preview: 'rgba(10,10,12,0.8)' },
  { id: 'gbanner_gold',   cat: 'banner', name: '🟨 Bannière Dorée',    price: 2500, cls: 'group-banner-gold',   preview: 'rgba(240,192,64,0.3)' },
  // Bannières motifs — 5 000 PomCoins
  { id: 'gbanner_damier',      cat: 'banner', name: '🔲 Motif Damier',       price: 5000, cls: 'group-banner-damier',      preview: null },
  { id: 'gbanner_vagues',      cat: 'banner', name: '〰️ Motif Vagues',        price: 5000, cls: 'group-banner-vagues',      preview: null },
  { id: 'gbanner_constellation',cat:'banner', name: '✦ Constellation',        price: 5000, cls: 'group-banner-constellation',preview: null },
  { id: 'gbanner_grille',      cat: 'banner', name: '🔳 Motif Grille',        price: 5000, cls: 'group-banner-grille',      preview: null },
  { id: 'gbanner_diagonales',  cat: 'banner', name: '╱ Diagonales',           price: 5000, cls: 'group-banner-diagonales',  preview: null },
  // Bannières effets animés — 5 000 PomCoins
  { id: 'gbanner_rainbow', cat: 'banner', name: '🌈 Arc-en-ciel',  price: 5000, cls: 'group-banner-rainbow', preview: null },
  { id: 'gbanner_aurora',  cat: 'banner', name: '🌌 Aurore',       price: 5000, cls: 'group-banner-aurora',  preview: null },
  { id: 'gbanner_plasma',  cat: 'banner', name: '⚡ Plasma',       price: 5000, cls: 'group-banner-plasma',  preview: null },
  { id: 'gbanner_feu',     cat: 'banner', name: '🔥 Feu',          price: 5000, cls: 'group-banner-feu',    preview: null },
  { id: 'gbanner_glace',   cat: 'banner', name: '❄️ Glace',        price: 5000, cls: 'group-banner-glace',  preview: null },
  // Badges de groupe — 1 000 PomCoins
  { id: 'gbadge_sword',  cat: 'badge', name: '⚔️ Épée',       price: 1000, emoji: '⚔️' },
  { id: 'gbadge_fire',   cat: 'badge', name: '🔥 Flamme',     price: 1000, emoji: '🔥' },
  { id: 'gbadge_crown',  cat: 'badge', name: '👑 Couronne',   price: 1000, emoji: '👑' },
  { id: 'gbadge_gem',    cat: 'badge', name: '💎 Diamant',    price: 1000, emoji: '💎' },
  { id: 'gbadge_moon',   cat: 'badge', name: '🌙 Lune',       price: 1000, emoji: '🌙' },
  { id: 'gbadge_bolt',   cat: 'badge', name: '⚡ Éclair',     price: 1000, emoji: '⚡' },
  { id: 'gbadge_dragon', cat: 'badge', name: '🐉 Dragon',     price: 1000, emoji: '🐉' },
  { id: 'gbadge_wave',   cat: 'badge', name: '🌊 Vague',      price: 1000, emoji: '🌊' },
  { id: 'gbadge_target', cat: 'badge', name: '🎯 Cible',      price: 1000, emoji: '🎯' },
  { id: 'gbadge_bow',    cat: 'badge', name: '🏹 Arc',        price: 1000, emoji: '🏹' },
  { id: 'gbadge_flower', cat: 'badge', name: '🌺 Fleur',      price: 1000, emoji: '🌺' },
  { id: 'gbadge_skull',  cat: 'badge', name: '☠️ Crâne',      price: 1000, emoji: '☠️' },
  { id: 'gbadge_lion',   cat: 'badge', name: '🦁 Lion',       price: 1000, emoji: '🦁' },
  { id: 'gbadge_wolf',   cat: 'badge', name: '🐺 Loup',       price: 1000, emoji: '🐺' },
  { id: 'gbadge_star',   cat: 'badge', name: '🌟 Étoile',     price: 1000, emoji: '🌟' },
  { id: 'gbadge_apple',  cat: 'badge', name: '🍎 Pomme',      price: 1000, emoji: '🍎' },
  { id: 'gbadge_circus', cat: 'badge', name: '🎪 Cirque',     price: 1000, emoji: '🎪' },
  { id: 'gbadge_mask',   cat: 'badge', name: '🎭 Masque',     price: 1000, emoji: '🎭' },
  { id: 'gbadge_crystal',cat: 'badge', name: '🔮 Cristal',    price: 1000, emoji: '🔮' },
  { id: 'gbadge_dagger', cat: 'badge', name: '🗡️ Dague',     price: 1000, emoji: '🗡️' },
  // Effets nom de groupe — couleurs — 5 000 PomCoins
  { id: 'gname_red',    cat: 'name', name: '🔴 Nom Rouge',   price: 5000, cls: 'gname-red' },
  { id: 'gname_green',  cat: 'name', name: '🟢 Nom Vert',    price: 5000, cls: 'gname-green' },
  { id: 'gname_blue',   cat: 'name', name: '🔵 Nom Bleu',    price: 5000, cls: 'gname-blue' },
  { id: 'gname_gold',   cat: 'name', name: '🟡 Nom Doré',    price: 5000, cls: 'gname-gold' },
  { id: 'gname_purple', cat: 'name', name: '🟣 Nom Violet',  price: 5000, cls: 'gname-purple' },
  { id: 'gname_cyan',   cat: 'name', name: '🩵 Nom Cyan',    price: 5000, cls: 'gname-cyan' },
  // Effets nom de groupe — animés — 5 000 PomCoins
  { id: 'gname_rainbow',  cat: 'name', name: '🌈 Arc-en-ciel',    price: 5000, cls: 'gname-rainbow' },
  { id: 'gname_fire',     cat: 'name', name: '🔥 Feu',             price: 5000, cls: 'gname-fire' },
  { id: 'gname_neon',     cat: 'name', name: '💚 Néon',            price: 5000, cls: 'gname-neon' },
  { id: 'gname_glitch',   cat: 'name', name: '📡 Glitch',          price: 5000, cls: 'gname-glitch' },
  { id: 'gname_brillant', cat: 'name', name: '✨ Brillant',         price: 5000, cls: 'gname-brillant' },
  // Tag groupe sur profil — couleur texte — 5 000 PomCoins
  { id: 'gtag_color_red',    cat: 'tag', name: '🔴 Tag Rouge',    price: 5000, tagColor: 'gtag-color-red' },
  { id: 'gtag_color_green',  cat: 'tag', name: '🟢 Tag Vert',     price: 5000, tagColor: 'gtag-color-green' },
  { id: 'gtag_color_blue',   cat: 'tag', name: '🔵 Tag Bleu',     price: 5000, tagColor: 'gtag-color-blue' },
  { id: 'gtag_color_gold',   cat: 'tag', name: '🟡 Tag Doré',     price: 5000, tagColor: 'gtag-color-gold' },
  { id: 'gtag_color_purple', cat: 'tag', name: '🟣 Tag Violet',   price: 5000, tagColor: 'gtag-color-purple' },
  { id: 'gtag_color_cyan',   cat: 'tag', name: '🩵 Tag Cyan',     price: 5000, tagColor: 'gtag-color-cyan' },
  // Tag groupe sur profil — style — 5 000 PomCoins
  { id: 'gtag_rounded',  cat: 'tag', name: '● Tag Arrondi',       price: 5000, tagStyle: 'gtag-rounded' },
  { id: 'gtag_angular',  cat: 'tag', name: '■ Tag Angulaire',     price: 5000, tagStyle: 'gtag-angular' },
  { id: 'gtag_outline',  cat: 'tag', name: '○ Tag Outline',       price: 5000, tagStyle: 'gtag-outline' },
  { id: 'gtag_filled',   cat: 'tag', name: '◉ Tag Filled',        price: 5000, tagStyle: 'gtag-filled' },
  { id: 'gtag_glass',    cat: 'tag', name: '◈ Tag Glassmorphism', price: 5000, tagStyle: 'gtag-glass' },
  // Tag groupe sur profil — effets — 5 000 PomCoins
  { id: 'gtag_fx_rainbow', cat: 'tag', name: '🌈 Tag Arc-en-ciel',    price: 5000, tagFx: 'gtag-fx-rainbow' },
  { id: 'gtag_fx_holo',    cat: 'tag', name: '🔮 Tag Holographique',  price: 5000, tagFx: 'gtag-fx-holo' },
  { id: 'gtag_fx_pulse',   cat: 'tag', name: '💫 Tag Pulsant',        price: 5000, tagFx: 'gtag-fx-pulse' },
];

// Construire le HTML du tag groupe selon les cosmétiques actifs du groupe
function buildGroupTag(group, groupName) {
  if (!group && !groupName) return '';
  const name = groupName || (group && group.name) || '?';
  const cosm = (group && group.cosmetics) || {};
  const badge = cosm.activeBadge ? (GROUP_SHOP.find(i => i.id === cosm.activeBadge) || {}).emoji || '' : '';
  const nameClass = cosm.activeName ? (GROUP_SHOP.find(i => i.id === cosm.activeName) || {}).cls || '' : '';
  const tagStyle = cosm.activeTagStyle ? (GROUP_SHOP.find(i => i.id === cosm.activeTagStyle) || {}).tagStyle || 'gtag-default' : 'gtag-default';
  const tagColor = cosm.activeTagColor ? (GROUP_SHOP.find(i => i.id === cosm.activeTagColor) || {}).tagColor || '' : '';
  const tagFx    = cosm.activeTagFx    ? (GROUP_SHOP.find(i => i.id === cosm.activeTagFx)    || {}).tagFx    || '' : '';
  return `<span class="group-tag ${tagStyle} ${tagColor} ${tagFx}">${badge ? badge + ' ' : ''}🏅 <span class="${nameClass}">${name}</span></span>`;
}

// Appliquer la bannière de groupe à un élément lb-item
function applyGroupBanner(el, group) {
  const cosm = (group && group.cosmetics) || {};
  if (cosm.activeBanner) {
    const item = GROUP_SHOP.find(i => i.id === cosm.activeBanner);
    if (item && item.cls) el.classList.add(item.cls);
  }
}

async function openGroupShopFromTop() {
  const groups = await getGroupsCache();
  const myGroup = (groups || []).find(g => (g.members || []).includes(state.code));
  if (!myGroup) { alert('Tu n\'es dans aucun groupe !'); return; }
  openGroupShop(myGroup.id);
}

function openGroupInfoModal() {
  const existing = document.getElementById('groupInfoModal');
  if (existing) { existing.remove(); return; }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'groupInfoModal';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:520px;">
      <h2>🏅 Règles des Groupes <button class="modal-close" onclick="document.getElementById('groupInfoModal').remove()">✕</button></h2>

      <div style="display:flex;flex-direction:column;gap:14px;font-size:.88rem;line-height:1.6;">

        <div>
          <div style="font-size:.68rem;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">📋 Création & accès</div>
          <ul style="display:flex;flex-direction:column;gap:4px;padding-left:18px;color:var(--text);">
            <li>Maximum <strong>5 groupes</strong> au total · <strong>5 membres</strong> par groupe</li>
            <li>Créer un groupe : <strong style="color:var(--primary);">5 000 🪙</strong> — les 3 000 🪙 de chaque membre rejoignant te sont reversés</li>
            <li>Rejoindre un groupe : <strong style="color:var(--primary);">3 000 🪙</strong></li>
            <li>Impossible de créer un groupe <strong>deux mois de suite</strong></li>
            <li>Si le dernier membre quitte, le groupe est supprimé automatiquement</li>
          </ul>
        </div>

        <div style="height:1px;background:var(--border);"></div>

        <div>
          <div style="font-size:.68rem;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">📊 Score hebdomadaire</div>
          <ul style="display:flex;flex-direction:column;gap:4px;padding-left:18px;color:var(--text);">
            <li><strong>Pomels gagnés</strong> cette semaine par tous les membres</li>
            <li>+ <strong>Graines récoltées</strong> cette semaine (clicker & auto) <strong>÷ 5</strong></li>
            <li>Dépenser ses graines ne pénalise <strong>pas</strong> le groupe</li>
          </ul>
        </div>

        <div style="height:1px;background:var(--border);"></div>

        <div>
          <div style="font-size:.68rem;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">🏆 Récompenses — chaque lundi à 9h</div>
          <ul style="display:flex;flex-direction:column;gap:4px;padding-left:18px;color:var(--text);">
            <li>🥇 1er : <strong style="color:var(--green);">+2 000 🪙 / membre</strong> · <strong style="color:var(--yellow);">1 000 💠 fixes + 500 × membres</strong></li>
            <li>🥈 2e : <strong style="color:var(--green);">+2 000 🪙 / membre</strong> · <strong style="color:var(--yellow);">750 💠 fixes + 500 × membres</strong></li>
            <li>🥉 3e : <strong style="color:var(--green);">+2 000 🪙 / membre</strong> · <strong style="color:var(--yellow);">500 💠 fixes + 500 × membres</strong></li>
            <li style="color:var(--red);">💥 4e et 5e : groupe <strong>dissous</strong>, tous les membres expulsés</li>
          </ul>
        </div>

        <div style="height:1px;background:var(--border);"></div>

        <div>
          <div style="font-size:.68rem;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">🔄 Remise à zéro mensuelle</div>
          <ul style="display:flex;flex-direction:column;gap:4px;padding-left:18px;color:var(--text);">
            <li>Tous les groupes sont <strong>dissous chaque mois</strong> — les PomCoins du groupe disparaissent</li>
            <li>Tes achats cosmétiques restent sur ton compte et sont <strong>réappliqués gratuitement</strong> dans ton prochain groupe</li>
          </ul>
        </div>

        <div style="height:1px;background:var(--border);"></div>

        <div>
          <div style="font-size:.68rem;font-weight:700;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">💠 PomCoins & boutique</div>
          <ul style="display:flex;flex-direction:column;gap:4px;padding-left:18px;color:var(--text);">
            <li>Les PomCoins appartiennent au groupe — ils servent à acheter des <strong>cosmétiques</strong> (bannières, badges, effets de nom, style du tag affiché sur les profils)</li>
            <li>Seul le <strong>créateur</strong> peut acheter des améliorations, via le bouton <strong>🛍️ Boutique</strong> sur la carte du groupe</li>
            <li>Tous les membres bénéficient des cosmétiques achetés</li>
          </ul>
        </div>

      </div>
    </div>`;
  document.body.appendChild(overlay);
}

// Ouvrir la pop-up boutique du groupe
async function openGroupShop(groupId) {
  const [group, allGroups] = await Promise.all([getGroup(groupId), getAllGroups()]);
  if (!group) return;
  const isCreator = group.creatorCode === state.code;
  const isMember  = (group.members || []).includes(state.code);
  if (!isMember) return;

  const cosm     = group.cosmetics || {};
  const owned    = state.groupOwnedItems || [];
  const pomcoins = group.pomcoins || 0;

  // Sections du catalogue
  const sections = [
    { label: '🖼️ Bannières — Couleurs unies', items: GROUP_SHOP.filter(i => i.cat === 'banner' && i.price === 2500) },
    { label: '🔲 Bannières — Motifs',         items: GROUP_SHOP.filter(i => i.cat === 'banner' && i.price === 5000 && !i.cls.includes('rainbow') && !i.cls.includes('aurora') && !i.cls.includes('plasma') && !i.cls.includes('feu') && !i.cls.includes('glace')) },
    { label: '✨ Bannières — Effets animés',  items: GROUP_SHOP.filter(i => i.cat === 'banner' && i.price === 5000 && (i.cls.includes('rainbow') || i.cls.includes('aurora') || i.cls.includes('plasma') || i.cls.includes('feu') || i.cls.includes('glace'))) },
    { label: '🏅 Badges de groupe',           items: GROUP_SHOP.filter(i => i.cat === 'badge') },
    { label: '✍️ Effets nom — Couleurs',      items: GROUP_SHOP.filter(i => i.cat === 'name' && i.price === 5000 && !i.cls.includes('rainbow') && !i.cls.includes('fire') && !i.cls.includes('neon') && !i.cls.includes('glitch') && !i.cls.includes('brillant')) },
    { label: '🎨 Effets nom — Animés',        items: GROUP_SHOP.filter(i => i.cat === 'name' && (i.cls.includes('rainbow') || i.cls.includes('fire') || i.cls.includes('neon') || i.cls.includes('glitch') || i.cls.includes('brillant'))) },
    { label: '🏷️ Tag profil — Couleur',       items: GROUP_SHOP.filter(i => i.cat === 'tag' && i.tagColor) },
    { label: '🏷️ Tag profil — Style',         items: GROUP_SHOP.filter(i => i.cat === 'tag' && i.tagStyle) },
    { label: '🏷️ Tag profil — Effets',        items: GROUP_SHOP.filter(i => i.cat === 'tag' && i.tagFx) },
  ];

  function getActiveId(item) {
    if (item.cat === 'banner') return cosm.activeBanner;
    if (item.cat === 'badge')  return cosm.activeBadge;
    if (item.cat === 'name')   return cosm.activeName;
    if (item.cat === 'tag' && item.tagColor) return cosm.activeTagColor;
    if (item.cat === 'tag' && item.tagStyle) return cosm.activeTagStyle;
    if (item.cat === 'tag' && item.tagFx)    return cosm.activeTagFx;
    return null;
  }

  function buildPreview(item) {
    if (item.cat === 'badge') return `<div class="group-shop-item-preview" style="background:var(--surface2);font-size:1.2rem;">${item.emoji}</div>`;
    if (item.cat === 'banner' && item.preview) return `<div class="group-shop-item-preview ${item.cls}" style="background:${item.preview};"></div>`;
    if (item.cat === 'banner') return `<div class="group-shop-item-preview ${item.cls}" style="background:var(--surface2);border:1px solid var(--border);"></div>`;
    if (item.cat === 'name') return `<div class="group-shop-item-preview" style="background:var(--surface2);"><span class="${item.cls}" style="-webkit-text-fill-color:unset;">${escapeHTML(group.name)}</span></div>`;
    if (item.cat === 'tag' && item.tagStyle) return `<div class="group-shop-item-preview" style="background:var(--surface2);"><span class="group-tag ${item.tagStyle}">🏅 ${escapeHTML(group.name)}</span></div>`;
    if (item.cat === 'tag' && item.tagColor) return `<div class="group-shop-item-preview" style="background:var(--surface2);"><span class="group-tag gtag-default ${item.tagColor}">🏅 ${escapeHTML(group.name)}</span></div>`;
    if (item.cat === 'tag' && item.tagFx)    return `<div class="group-shop-item-preview" style="background:var(--surface2);"><span class="group-tag gtag-default ${item.tagFx}">🏅 ${escapeHTML(group.name)}</span></div>`;
    return '';
  }

  let sectionsHTML = sections.map(sec => {
    const itemsHTML = sec.items.map(item => {
      const isOwned    = owned.includes(item.id);
      const isEquipped = getActiveId(item) === item.id;
      let btnHTML = '';
      if (isCreator) {
        if (!isOwned) {
          btnHTML = `<button class="btn-gshop buy" onclick="buyGroupItem('${groupId}','${item.id}')" ${pomcoins < item.price ? 'disabled' : ''}>Acheter</button>`;
        } else if (isEquipped) {
          btnHTML = `<button class="btn-gshop equipped" disabled>✓ Équipé</button>`;
        } else {
          btnHTML = `<button class="btn-gshop equip" onclick="equipGroupItem('${groupId}','${item.id}')">Équiper</button>`;
        }
      } else {
        btnHTML = isOwned ? `<span style="font-size:.72rem;color:var(--green);font-weight:700;">${isEquipped ? '✓ Équipé' : 'Possédé'}</span>` : '';
      }
      return `
        <div class="group-shop-item ${isOwned ? 'owned' : ''} ${isEquipped ? 'active-item' : ''}">
          <div class="group-shop-item-name">${item.name}</div>
          ${buildPreview(item)}
          <div class="group-shop-item-footer">
            <span class="group-shop-item-price">${item.price.toLocaleString('fr-FR')} 💠</span>
            ${btnHTML}
          </div>
        </div>`;
    }).join('');
    return `<div class="group-shop-section"><div class="group-shop-section-title">${sec.label}</div><div class="group-shop-grid">${itemsHTML}</div></div>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'groupShopModal';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div class="modal-box group-shop-modal">
      <div class="group-shop-header">
        <h2 style="margin:0;">🛍️ Boutique — ${escapeHTML(group.name)}</h2>
        <button class="modal-close" onclick="document.getElementById('groupShopModal').remove()">✕</button>
      </div>
      <div class="group-shop-coins">
        <span style="font-size:.8rem;color:var(--muted);font-weight:600;">PomCoins du groupe</span>
        <span class="group-shop-coins-val">${pomcoins.toLocaleString('fr-FR')} 💠</span>
      </div>
      ${!isCreator ? '<div style="font-size:.78rem;color:var(--muted);background:var(--surface2);border-radius:8px;padding:8px 14px;">Seul le créateur du groupe peut acheter des améliorations.</div>' : ''}
      ${sectionsHTML}
    </div>`;
  document.body.appendChild(overlay);
}

async function buyGroupItem(groupId, itemId) {
  const item = GROUP_SHOP.find(i => i.id === itemId);
  if (!item) return;
  const group = await getGroup(groupId);
  if (!group || group.creatorCode !== state.code) return;
  if ((group.pomcoins || 0) < item.price) { alert('Pas assez de PomCoins !'); return; }

  group.pomcoins = (group.pomcoins || 0) - item.price;
  group.cosmetics = group.cosmetics || {};

  // Sauvegarder l'achat sur le compte du créateur (persistant)
  state.groupOwnedItems = state.groupOwnedItems || [];
  if (!state.groupOwnedItems.includes(itemId)) state.groupOwnedItems.push(itemId);

  // Équiper automatiquement
  equipCosmetic(group.cosmetics, item);

  await saveGroup(group);
  await saveAccount(state);
  _groupCache = null;
  document.getElementById('groupShopModal')?.remove();
  openGroupShop(groupId);
}

async function equipGroupItem(groupId, itemId) {
  const item = GROUP_SHOP.find(i => i.id === itemId);
  if (!item) return;
  const group = await getGroup(groupId);
  if (!group) return;
  group.cosmetics = group.cosmetics || {};
  equipCosmetic(group.cosmetics, item);
  await saveGroup(group);
  _groupCache = null;
  document.getElementById('groupShopModal')?.remove();
  openGroupShop(groupId);
}

function equipCosmetic(cosm, item) {
  if (item.cat === 'banner') cosm.activeBanner   = item.id;
  if (item.cat === 'badge')  cosm.activeBadge    = item.id;
  if (item.cat === 'name')   cosm.activeName     = item.id;
  if (item.cat === 'tag' && item.tagColor) cosm.activeTagColor = item.id;
  if (item.cat === 'tag' && item.tagStyle) cosm.activeTagStyle = item.id;
  if (item.cat === 'tag' && item.tagFx)    cosm.activeTagFx    = item.id;
}



console.log('[Boutique Groupe] Module loaded ✓');

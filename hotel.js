// ══════════════════════════════════════════════════
// HÔTEL DES VENTES — code extrait de index.html
// ══════════════════════════════════════════════════
// Dépendances globales attendues (définies dans index.html) :
//   - dbGet, dbSet, dbDelete, dbGetAll
//   - state, migrateAccount, saveAccount, addBalanceTransaction, refreshUI
//   - getTodayKey, escapeHTML, setAlert, checkNotifUpdates
// ══════════════════════════════════════════════════

// ── HOTEL HELPERS ─────────────────────────────────
async function getHotelListing(id) { return dbGet('hotel/' + id); }
async function saveHotelListing(item) { await dbSet('hotel/' + item.id, item); }
async function deleteHotelListing(id) { await dbDelete('hotel/' + id); }
async function getAllHotelListings() { return dbGetAll('hotel'); }

// ── HOME PREVIEW ──────────────────────────────────
async function renderHomeHotel() {
  const el = document.getElementById('homeHotelList');
  if (!el) return;
  el.innerHTML = '<div class="home-empty">Chargement…</div>';
  const all = await getAllHotelListings();
  // Nettoyer les expirés
  const now = Date.now();
  const active = all.filter(l => now - new Date(l.createdAt).getTime() < 24 * 3600 * 1000);
  if (!active.length) {
    el.innerHTML = '<div class="home-empty">Aucun titre en vente pour le moment.</div>';
    return;
  }
  // Les 4 plus récents
  const recent = [...active].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);
  el.innerHTML = '';
  recent.forEach(item => {
    const owned = (state.ownedTitles || []).includes('custom_' + item.id);
    const isMine = item.creatorCode === state.code;
    const canAfford = state.balance >= item.price;
    const div = document.createElement('div');
    div.className = 'home-bet-row';
    div.innerHTML = `
      <div class="home-bet-desc">
        <span class="title-badge">${escapeHTML(item.titleName)}</span>
        ${isMine ? ' <span style="font-size:.7rem;color:var(--muted);">(mon titre)</span>' : ''}
        ${owned && !isMine ? ' <span style="font-size:.7rem;color:var(--green);">✅ Possédé</span>' : ''}
      </div>
      <div class="home-bet-meta">
        <span>Par <strong>${escapeHTML(item.creatorName)}</strong></span>
        <span style="color:var(--primary);font-weight:700;">${item.price.toLocaleString('fr-FR')} 🪙</span>
        <span>${timeLeft(item.createdAt)}</span>
        ${!isMine && !owned ? `<span style="color:${canAfford ? 'var(--green)' : 'var(--muted)'};font-size:.78rem;font-weight:600;">${canAfford ? '✓ Tu peux acheter' : '✗ Solde insuffisant'}</span>` : ''}
      </div>
    `;
    el.appendChild(div);
  });
  if (active.length > 4) {
    const more = document.createElement('div');
    more.style.cssText = 'font-size:.78rem;color:var(--muted);text-align:center;padding:6px 0;';
    more.textContent = `+ ${active.length - 4} autre${active.length - 4 > 1 ? 's' : ''} titre${active.length - 4 > 1 ? 's' : ''} en vente…`;
    el.appendChild(more);
  }
}

// ── LOGIQUE PRINCIPALE ────────────────────────────
async function cleanupHotelListings() {
  const all = await getAllHotelListings();
  const now = Date.now();
  for (const item of all) {
    if (now - new Date(item.createdAt).getTime() > 24 * 3600 * 1000) {
      await deleteHotelListing(item.id);
    }
  }
}

async function handleCreateHotelListing() {
  const titleName = document.getElementById('hotelTitleInput').value.trim();
  const price     = parseInt(document.getElementById('hotelPriceInput').value);

  if (!titleName)          { setAlert('hotelCreateAlert', 'Donne un nom à ton titre !', 'error'); return; }
  if (titleName.length > 50) { setAlert('hotelCreateAlert', 'Le titre ne peut pas dépasser 50 caractères !', 'error'); return; }
  if (!price || price < 1) { setAlert('hotelCreateAlert', 'Entre un prix valide !', 'error'); return; }

  // One listing per day per user
  await cleanupHotelListings();
  const all = await getAllHotelListings();
  const today = getTodayKey();
  const alreadyToday = all.find(l => l.creatorCode === state.code && l.createdAt.startsWith(today));
  if (alreadyToday) { setAlert('hotelCreateAlert', 'Tu as déjà mis un titre en vente aujourd\'hui !', 'error'); return; }

  const id = 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  const listing = {
    id, titleName, price,
    creatorCode: state.code,
    creatorName: state.name,
    createdAt: new Date().toISOString(),
    buyers: [],  // list of codes who bought
  };
  await saveHotelListing(listing);
  document.getElementById('hotelTitleInput').value = '';
  document.getElementById('hotelPriceInput').value = '';
  setAlert('hotelCreateAlert', '✅ Titre mis en vente pour 24h !', 'success');
  setTimeout(() => { document.getElementById('hotelCreateAlert').className = 'alert'; }, 3000);
  checkNotifUpdates();
  renderHotel();
}

async function buyHotelListing(listingId) {
  const listing = await getHotelListing(listingId);
  if (!listing) { alert('Ce titre n\'est plus disponible.'); renderHotel(); return; }

  // Check already bought
  if ((listing.buyers || []).includes(state.code)) { alert('Tu possèdes déjà ce titre !'); return; }
  // Creator can't buy their own
  if (listing.creatorCode === state.code) { alert('Tu ne peux pas acheter ton propre titre !'); return; }
  // Check balance
  if (state.balance < listing.price) { alert(`Solde insuffisant ! Il te faut ${listing.price.toLocaleString('fr-FR')} Pomels.`); return; }

  // Débiter l'acheteur atomiquement
  const hotelBuyerUpd = await addBalanceTransaction(state.code, -listing.price, {
    type: 'hotel', desc: `Titre acheté : "${listing.titleName}" (Hôtel des Ventes)`, amount: -listing.price, date: new Date().toISOString()
  });
  if (hotelBuyerUpd) {
    state = migrateAccount(hotelBuyerUpd);
  } else {
    alert('Erreur réseau — réessaie dans quelques secondes.');
    return;
  }

  // Add custom title to buyer's owned titles
  const customId = 'custom_' + listingId;
  if (!state.ownedTitles) state.ownedTitles = [];
  if (!state.ownedTitles.includes(customId)) state.ownedTitles.push(customId);

  // Store custom title definition locally in account
  if (!state.customTitles) state.customTitles = {};
  state.customTitles[customId] = { id: customId, name: listing.titleName, type: 'title' };

  await saveAccount(state);

  // Créditer le vendeur atomiquement
  await addBalanceTransaction(listing.creatorCode, listing.price, {
    type: 'hotel', desc: `Titre vendu : "${listing.titleName}"`, amount: listing.price, date: new Date().toISOString()
  });

  // Mark buyer in listing
  listing.buyers = listing.buyers || [];
  listing.buyers.push(state.code);
  await saveHotelListing(listing);

  refreshUI();
  setAlert('hotelCreateAlert', `✅ Titre "${listing.titleName}" acheté et ajouté à tes paramètres !`, 'success');
  setTimeout(() => { document.getElementById('hotelCreateAlert').className = 'alert'; }, 4000);
  renderHotel();
}

function timeLeft(createdAt) {
  const expiresAt = new Date(createdAt).getTime() + 24 * 3600 * 1000;
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expiré';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `⏳ ${h}h ${m}min`;
}

async function renderHotel() {
  await cleanupHotelListings();
  const all = await getAllHotelListings();
  const list = document.getElementById('hotelList');
  list.innerHTML = '';

  // Check if user already posted today
  const today = getTodayKey();
  const alreadyToday = all.find(l => l.creatorCode === state.code && l.createdAt.startsWith(today));
  const createZone = document.getElementById('hotelCreateZone');
  if (alreadyToday) {
    createZone.style.opacity = '.5';
    createZone.style.pointerEvents = 'none';
    createZone.querySelector('h3').textContent = 'Titre en vente (1 par jour max — reviens demain !)';
  } else {
    createZone.style.opacity = '';
    createZone.style.pointerEvents = '';
    createZone.querySelector('h3').textContent = 'Mettre en vente un titre';
  }

  const sorted = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!sorted.length) {
    list.innerHTML = '<div class="bet-empty">Aucun titre en vente pour le moment.</div>';
    return;
  }

  sorted.forEach(item => {
    const isMine   = item.creatorCode === state.code;
    const alreadyBought = (item.buyers || []).includes(state.code);
    // Check if owned via ownedTitles
    const customId = 'custom_' + item.id;
    const owned    = (state.ownedTitles || []).includes(customId);
    const canAfford = state.balance >= item.price;

    const div = document.createElement('div');
    div.className = 'hotel-item' + (isMine ? ' mine' : '') + (owned ? ' owned' : '');

    let actionBtn = '';
    if (isMine) {
      actionBtn = '<span class="hotel-badge-mine">Mon titre</span>';
    } else if (owned) {
      actionBtn = '<button class="btn-buy owned-btn" disabled>✅ Possédé</button>';
    } else {
      actionBtn = `<button class="btn-buy" ${!canAfford ? 'disabled title="Solde insuffisant"' : ''} onclick="buyHotelListing('${item.id}')">${canAfford ? 'Acheter' : 'Pas assez'}</button>`;
    }

    div.innerHTML = `
      <div class="hotel-item-info">
        <div class="hotel-item-name">
          <span class="title-badge">${escapeHTML(item.titleName)}</span>
          ${isMine ? '<span class="hotel-badge-mine">Moi</span>' : ''}
          ${owned && !isMine ? '<span class="hotel-badge-owned">Possédé</span>' : ''}
        </div>
        <div class="hotel-item-creator">Par <strong>${escapeHTML(item.creatorName)}</strong> · ${(item.buyers||[]).length} acheteur${(item.buyers||[]).length > 1 ? 's' : ''}</div>
        <div class="hotel-item-expires">${timeLeft(item.createdAt)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
        <span class="hotel-item-price">${item.price.toLocaleString('fr-FR')} 🪙</span>
        ${actionBtn}
      </div>
    `;
    list.appendChild(div);
  });
}

// ══════════════════════════════════════════════════
// MARCHÉ NOIR — revente de titres entre joueurs
// ══════════════════════════════════════════════════
// Dépendances globales attendues (définies dans index.html) :
//   - dbGet, dbSet, dbDelete, dbGetAll
//   - state, migrateAccount, saveAccount, getAccount, addBalanceTransaction, refreshUI
//   - SHOP_TITLES, resolveTitleDef
//   - escapeHTML, setAlert, showConfirm, closeConfirm
//
// Modèle d'un listing :
// {
//   id, sellerCode, sellerName,
//   titleId,            // id du titre vendu (ex: "king_coffee" ou "custom_xyz")
//   titleName,          // snapshot du nom au moment de la vente
//   titleSource,        // 'shop' (boutique) | 'custom' (Hôtel des Ventes)
//   titleDef,           // snapshot complet de la def custom (si source='custom'), pour transférer à l'acheteur
//   price,
//   status,             // 'active' | 'reserved' | 'sold' | 'cancelled'
//   createdAt,
//   updatedAt,
//   // Si status === 'reserved' : acheteur candidat, Pomels débités en escrow
//   requesterCode, requesterName, requestedAt,
//   // Si status === 'sold' :
//   buyerCode, buyerName, soldAt,
// }
// ══════════════════════════════════════════════════

// ── HELPERS DB ────────────────────────────────────
async function getMarcheNoirListing(id)   { return dbGet('marche_noir/' + id); }
async function saveMarcheNoirListing(l)   { await dbSet('marche_noir/' + l.id, l); }
async function deleteMarcheNoirListing(id){ await dbDelete('marche_noir/' + id); }
async function getAllMarcheNoirListings() { return dbGetAll('marche_noir'); }

// ── COULEUR CUSTOM (picker) ───────────────────────
// Presets rapides — l'utilisateur peut aussi piocher librement via l'input color
const MN_COLOR_PRESETS = [
  '#eb5846', '#f5c842', '#3ecf6e', '#4ec9d9', '#a974ff',
  '#ff7eb9', '#ff9140', '#ffffff', '#111111',
];

// Couleur sélectionnée pour la mise en vente en cours (null = défaut)
let _mnSelectedColor = null;

// ── UTILS ─────────────────────────────────────────
// Durée pendant laquelle une annonce 'sold' ou 'cancelled' reste visible avant suppression
const MN_ARCHIVE_MS = 24 * 3600 * 1000; // 24h

// Titres du compte qui sont actuellement listés au Marché Noir (active)
async function _getMyActivelyListedTitleIds() {
  const all = await getAllMarcheNoirListings();
  const mine = all.filter(l => l.sellerCode === state.code && l.status === 'active');
  return new Set(mine.map(l => l.titleId));
}

// Liste les titres possédés par l'utilisateur actuel (type='title' uniquement)
function _getMyOwnedTitles() {
  const owned = state.ownedTitles || [];
  const titles = [];
  owned.forEach(tid => {
    const def = resolveTitleDef(tid);
    if (def && def.type === 'title') {
      titles.push({
        id: tid,
        name: def.name,
        source: tid.startsWith('custom_') ? 'custom' : 'shop',
        def: def,
      });
    }
  });
  return titles;
}

// Met à jour l'aperçu du titre sélectionné (badge visuel sous le select)
function _mnUpdateTitlePreview() {
  const selectEl = document.getElementById('mnTitleSelect');
  const previewEl = document.getElementById('mnTitlePreview');
  if (!selectEl || !previewEl) return;
  const tid = selectEl.value;
  if (!tid) { previewEl.innerHTML = ''; return; }
  const def = resolveTitleDef(tid);
  if (!def) { previewEl.innerHTML = ''; return; }
  // Prévisualiser avec la couleur en cours
  const previewDef = _mnSelectedColor ? { ...def, customColor: _mnSelectedColor } : def;
  const style = titleBadgeStyle(previewDef);
  previewEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;background:var(--surface-glass);border:1px solid var(--border-soft);border-radius:8px;">
      <span style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;">Aperçu :</span>
      <span class="title-badge" style="${style}">${escapeHTML(def.name)}</span>
    </div>
  `;
}

// ── Picker couleur : UI ───────────────────────────
function _mnRenderColorPresets() {
  const row = document.getElementById('mnColorPresets');
  if (!row) return;
  row.innerHTML = '';
  MN_COLOR_PRESETS.forEach(c => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = c;
    btn.onclick = () => _mnPickPreset(c);
    const selected = _mnSelectedColor && _mnSelectedColor.toLowerCase() === c.toLowerCase();
    btn.style.cssText = `width:26px;height:26px;border-radius:50%;border:2px solid ${selected ? 'var(--text)' : 'var(--border)'};background:${c};cursor:pointer;padding:0;transition:transform .15s;`;
    btn.onmouseenter = () => { btn.style.transform = 'scale(1.15)'; };
    btn.onmouseleave = () => { btn.style.transform = ''; };
    row.appendChild(btn);
  });
}

function _mnPickPreset(color) {
  _mnSelectedColor = color;
  const input = document.getElementById('mnColorInput');
  if (input) input.value = color;
  _mnRenderColorPresets();
  _mnUpdateTitlePreview();
}

function _mnOnColorChange() {
  const input = document.getElementById('mnColorInput');
  if (!input) return;
  _mnSelectedColor = input.value;
  _mnRenderColorPresets();
  _mnUpdateTitlePreview();
}

function _mnResetColor() {
  _mnSelectedColor = null;
  const input = document.getElementById('mnColorInput');
  if (input) input.value = '#ffffff';
  _mnRenderColorPresets();
  _mnUpdateTitlePreview();
}

// Appelé quand on change de titre dans le select :
// si le titre a déjà une customColor (revente), pré-charge cette couleur dans le picker.
function _mnOnTitleSelect() {
  const selectEl = document.getElementById('mnTitleSelect');
  if (!selectEl) return;
  const tid = selectEl.value;
  if (!tid) { _mnResetColor(); return; }
  const def = resolveTitleDef(tid);
  const input = document.getElementById('mnColorInput');
  if (def && def.customColor) {
    _mnSelectedColor = def.customColor;
    if (input) input.value = def.customColor;
  } else {
    _mnSelectedColor = null;
    if (input) input.value = '#ffffff';
  }
  _mnRenderColorPresets();
  _mnUpdateTitlePreview();
}

// Nettoyer les annonces archivées trop anciennes
async function _cleanupMarcheNoir() {
  const all = await getAllMarcheNoirListings();
  const now = Date.now();
  for (const l of all) {
    if (l.status === 'sold' || l.status === 'cancelled') {
      const ts = new Date(l.updatedAt || l.soldAt || l.createdAt).getTime();
      if (now - ts > MN_ARCHIVE_MS) {
        await deleteMarcheNoirListing(l.id);
      }
    }
  }
}

// ── RENDU PRINCIPAL ───────────────────────────────
async function renderMarcheNoir() {
  await _cleanupMarcheNoir();

  const all = await getAllMarcheNoirListings();

  // ─ Picker couleur : presets ─
  _mnRenderColorPresets();

  // ─ Sélecteur "Mes titres à mettre en vente" ─
  const selectEl = document.getElementById('mnTitleSelect');
  const previewEl = document.getElementById('mnTitlePreview');
  if (selectEl) {
    const owned = _getMyOwnedTitles();
    const alreadyListed = await _getMyActivelyListedTitleIds();
    const available = owned.filter(t => !alreadyListed.has(t.id));

    // Mémoriser le titre choisi pour re-sélectionner après un re-render
    const prevSelected = selectEl.value;

    selectEl.innerHTML = '';
    if (!owned.length) {
      selectEl.innerHTML = '<option value="">Aucun titre — achètes-en à la Boutique !</option>';
      selectEl.disabled = true;
    } else if (!available.length) {
      selectEl.innerHTML = '<option value="">Tous tes titres sont déjà en vente</option>';
      selectEl.disabled = true;
    } else {
      selectEl.disabled = false;
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = `— Choisir parmi tes ${available.length} titre${available.length > 1 ? 's' : ''} —`;
      selectEl.appendChild(placeholder);
      available.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        selectEl.appendChild(opt);
      });
      // Re-sélectionner le titre précédent si toujours disponible
      if (prevSelected && available.some(t => t.id === prevSelected)) {
        selectEl.value = prevSelected;
      }
    }
    _mnUpdateTitlePreview();
  }

  // ─ Mes annonces actives ou réservées (vendeur) ─
  const myListings = all.filter(l => l.sellerCode === state.code && (l.status === 'active' || l.status === 'reserved'))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const myListingsSection = document.getElementById('mnMyListingsSection');
  const myListingsEl = document.getElementById('mnMyListings');
  if (myListingsEl) {
    if (myListings.length === 0) {
      if (myListingsSection) myListingsSection.style.display = 'none';
    } else {
      if (myListingsSection) myListingsSection.style.display = '';
      myListingsEl.innerHTML = '';
      myListings.forEach(l => myListingsEl.appendChild(_buildMarcheNoirCard(l, 'mine')));
    }
  }

  // ─ Tous les listings (actifs/réservés des autres + sold/cancelled récents) ─
  const otherActive = all
    .filter(l => (l.status === 'active' || l.status === 'reserved') && l.sellerCode !== state.code)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const recentlyClosed = all
    .filter(l => (l.status === 'sold' || l.status === 'cancelled'))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  const listEl = document.getElementById('mnList');
  if (listEl) {
    listEl.innerHTML = '';
    if (otherActive.length === 0 && recentlyClosed.length === 0) {
      listEl.innerHTML = '<div class="bet-empty">Aucun titre en vente pour le moment.</div>';
    } else {
      otherActive.forEach(l => listEl.appendChild(_buildMarcheNoirCard(l, 'other')));
      if (recentlyClosed.length) {
        const sep = document.createElement('div');
        sep.style.cssText = 'font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin:8px 0 4px;';
        sep.textContent = 'Historique récent (24h)';
        listEl.appendChild(sep);
        recentlyClosed.forEach(l => listEl.appendChild(_buildMarcheNoirCard(l, 'archived')));
      }
    }
  }
}

function _buildMarcheNoirCard(l, role) {
  const div = document.createElement('div');
  let cls = 'mn-item';
  if (role === 'mine') cls += ' mine';
  if (l.status === 'sold' || l.status === 'cancelled') cls += ' sold';
  if (l.status === 'reserved') cls += ' reserved';
  div.className = cls;

  const dateStr = new Date(l.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // Savoir si l'acheteur potentiel possède déjà ce titre
  const iAlreadyOwn = (state.ownedTitles || []).includes(l.titleId);
  const iAmRequester = l.status === 'reserved' && l.requesterCode === state.code;

  // Bloc action à droite
  let actionHTML = '';
  if (l.status === 'active') {
    if (role === 'mine') {
      actionHTML = `<button class="mn-btn-withdraw" onclick="withdrawMarcheNoirListing('${l.id}')">↩️ Retirer</button>`;
    } else {
      const canAfford = state.balance >= l.price;
      if (iAlreadyOwn) {
        actionHTML = `<button class="btn-buy owned-btn" disabled>✅ Déjà possédé</button>`;
      } else if (!canAfford) {
        actionHTML = `<button class="btn-buy" disabled title="Solde insuffisant">Pas assez</button>`;
      } else {
        actionHTML = `<button class="btn-buy mn-btn-want" onclick="requestMarcheNoirListing('${l.id}')">✋ Je veux !</button>`;
      }
    }
  } else if (l.status === 'reserved') {
    if (role === 'mine') {
      // Je suis le vendeur, quelqu'un a demandé
      actionHTML = `
        <button class="mn-btn-accept" onclick="acceptMarcheNoirOffer('${l.id}')">✅ Accepter</button>
        <button class="mn-btn-refuse" onclick="refuseMarcheNoirOffer('${l.id}')">✖️ Refuser</button>
      `;
    } else if (iAmRequester) {
      // Je suis l'acheteur candidat
      actionHTML = `<button class="mn-btn-withdraw" onclick="cancelMarcheNoirRequest('${l.id}')">↩️ Annuler ma demande</button>`;
    } else {
      // Quelqu'un d'autre a déjà demandé
      actionHTML = `<button class="btn-buy" disabled title="Une autre personne a déjà fait une demande">🔒 Réservé</button>`;
    }
  } else if (l.status === 'sold') {
    actionHTML = `<span class="mn-badge owned">Vendu à ${escapeHTML(l.buyerName || '?')}</span>`;
  } else if (l.status === 'cancelled') {
    actionHTML = `<span class="mn-badge" style="background:var(--surface-glass);color:var(--muted);border:1px solid var(--border-soft);">Retiré</span>`;
  }

  // Ligne de status "Demande en cours"
  let reservedInfoHTML = '';
  if (l.status === 'reserved') {
    if (role === 'mine') {
      reservedInfoHTML = `<div class="mn-reserved-info">🔥 <strong>${escapeHTML(l.requesterName || '?')}</strong> veut acheter ton titre — accepte ou refuse !</div>`;
    } else if (iAmRequester) {
      reservedInfoHTML = `<div class="mn-reserved-info">⏳ Demande en attente de validation par <strong>${escapeHTML(l.sellerName)}</strong>. Tes Pomels sont réservés.</div>`;
    } else {
      reservedInfoHTML = `<div class="mn-reserved-info" style="background:var(--surface-glass);border-color:var(--border-soft);color:var(--muted);">🔒 Demande en cours par <strong style="color:var(--text);">${escapeHTML(l.requesterName || '?')}</strong></div>`;
    }
  }

  div.innerHTML = `
    <div class="mn-item-info">
      <div class="mn-item-name">
        <span class="title-badge" style="${l.customColor ? titleBadgeStyle({customColor:l.customColor}) : ''}">${escapeHTML(l.titleName)}</span>
        <span class="mn-badge ${l.titleSource === 'custom' ? 'hotel' : 'shop'}">${l.titleSource === 'custom' ? 'Hôtel' : 'Boutique'}</span>
        ${role === 'mine' ? '<span class="mn-badge mine">Mon annonce</span>' : ''}
        ${role !== 'mine' && iAlreadyOwn && (l.status === 'active' || l.status === 'reserved') ? '<span class="mn-badge owned">Déjà possédé</span>' : ''}
      </div>
      <div class="mn-item-seller">Vendeur : <strong>${escapeHTML(l.sellerName)}</strong></div>
      <div class="mn-item-date">Mis en vente le ${dateStr}</div>
      ${reservedInfoHTML}
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;">
      <span class="mn-item-price">${l.price.toLocaleString('fr-FR')} 🪙</span>
      ${actionHTML}
    </div>
  `;
  return div;
}

// ── CRÉER UNE ANNONCE ─────────────────────────────
async function handleCreateMarcheNoirListing() {
  const selectEl = document.getElementById('mnTitleSelect');
  const titleId = selectEl ? selectEl.value : '';
  const price = parseInt(document.getElementById('mnPriceInput').value);

  if (!titleId) { setAlert('mnCreateAlert', 'Sélectionne un titre à vendre !', 'error'); return; }
  if (!price || price < 1) { setAlert('mnCreateAlert', 'Entre un prix valide !', 'error'); return; }
  if (price > 999999) { setAlert('mnCreateAlert', 'Prix maximum : 999 999 Pomels.', 'error'); return; }

  // Vérifier qu'on possède toujours le titre
  if (!(state.ownedTitles || []).includes(titleId)) {
    setAlert('mnCreateAlert', '❌ Tu ne possèdes plus ce titre.', 'error');
    renderMarcheNoir();
    return;
  }

  // Vérifier qu'il n'est pas déjà en vente
  const alreadyListed = await _getMyActivelyListedTitleIds();
  if (alreadyListed.has(titleId)) {
    setAlert('mnCreateAlert', '❌ Ce titre est déjà en vente.', 'error');
    renderMarcheNoir();
    return;
  }

  const def = resolveTitleDef(titleId);
  if (!def || def.type !== 'title') {
    setAlert('mnCreateAlert', '❌ Ce titre est invalide.', 'error');
    return;
  }

  const source = titleId.startsWith('custom_') ? 'custom' : 'shop';
  const titleDef = (source === 'custom') ? ((state.customTitles || {})[titleId] || def) : null;

  // Couleur custom choisie (null si couleur par défaut)
  const customColor = _mnSelectedColor || null;

  const id = 'mn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const now = new Date().toISOString();
  const listing = {
    id,
    sellerCode: state.code,
    sellerName: state.name,
    titleId,
    titleName: def.name,
    titleSource: source,
    titleDef: titleDef, // null pour les titres shop, objet complet pour les custom
    customColor,        // null ou hex
    price,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  await saveMarcheNoirListing(listing);

  document.getElementById('mnPriceInput').value = '';
  _mnResetColor();
  setAlert('mnCreateAlert', `✅ Titre "${def.name}" mis en vente pour ${price.toLocaleString('fr-FR')} 🪙 !`, 'success');
  setTimeout(() => { document.getElementById('mnCreateAlert').className = 'alert'; }, 3000);
  renderMarcheNoir();
}

// ── RETIRER UNE ANNONCE ───────────────────────────
async function withdrawMarcheNoirListing(listingId) {
  const l = await getMarcheNoirListing(listingId);
  if (!l || l.sellerCode !== state.code) { renderMarcheNoir(); return; }
  if (l.status === 'reserved') {
    alert('Quelqu\'un a fait une demande — tu dois d\'abord l\'accepter ou la refuser avant de pouvoir retirer l\'annonce.');
    renderMarcheNoir();
    return;
  }
  if (l.status !== 'active') {
    setAlert('mnCreateAlert', '❌ Cette annonce n\'est plus active.', 'error');
    renderMarcheNoir();
    return;
  }
  showConfirm(`Retirer ton annonce pour "${l.titleName}" ?`, async () => {
    const fresh = await getMarcheNoirListing(listingId);
    if (!fresh || fresh.sellerCode !== state.code || fresh.status !== 'active') {
      closeConfirm(); renderMarcheNoir(); return;
    }
    fresh.status = 'cancelled';
    fresh.updatedAt = new Date().toISOString();
    await saveMarcheNoirListing(fresh);
    closeConfirm();
    setAlert('mnCreateAlert', `↩️ Annonce retirée — tu conserves ton titre.`, 'success');
    setTimeout(() => { document.getElementById('mnCreateAlert').className = 'alert'; }, 3000);
    renderMarcheNoir();
  });
}

// ══════════════════════════════════════════════════
// RÉSERVATION (acheteur clique "Je veux !")
// → status 'active' → 'reserved', Pomels débités en escrow
// ══════════════════════════════════════════════════
async function requestMarcheNoirListing(listingId) {
  // Relire pour anti-race
  const l = await getMarcheNoirListing(listingId);
  if (!l) { alert('Cette annonce n\'est plus disponible.'); renderMarcheNoir(); return; }
  if (l.status !== 'active') {
    alert(l.status === 'reserved' ? 'Quelqu\'un vient de faire une demande avant toi !' : 'Cette annonce n\'est plus active.');
    renderMarcheNoir();
    return;
  }
  if (l.sellerCode === state.code) { alert('Tu ne peux pas demander ton propre titre !'); return; }
  if ((state.ownedTitles || []).includes(l.titleId)) {
    alert('Tu possèdes déjà ce titre !');
    renderMarcheNoir();
    return;
  }
  if (state.balance < l.price) {
    alert(`Solde insuffisant ! Il te faut ${l.price.toLocaleString('fr-FR')} Pomels.`);
    return;
  }

  // ── Étape 1 : verrouiller le listing en 'reserved' avec notre code ──
  const reservedAt = new Date().toISOString();
  const reservedListing = {
    ...l,
    status: 'reserved',
    requesterCode: state.code,
    requesterName: state.name,
    requestedAt: reservedAt,
    updatedAt: reservedAt,
  };
  await saveMarcheNoirListing(reservedListing);

  // Re-vérifier que notre verrou a tenu
  const check = await getMarcheNoirListing(listingId);
  if (!check || check.status !== 'reserved' || check.requesterCode !== state.code) {
    alert('Un autre joueur a fait une demande juste avant toi !');
    renderMarcheNoir();
    return;
  }

  // ── Étape 2 : débiter l'acheteur en escrow ──
  const buyerUpd = await addBalanceTransaction(state.code, -l.price, {
    type: 'marche_noir',
    desc: `Demande au Marché Noir : "${l.titleName}" — Pomels réservés`,
    amount: -l.price,
    date: reservedAt,
  });
  if (!buyerUpd) {
    // Rollback : rouvrir le listing
    await saveMarcheNoirListing({
      ...l, status: 'active',
      requesterCode: null, requesterName: null, requestedAt: null,
      updatedAt: new Date().toISOString(),
    });
    alert('Erreur réseau — réessaie dans quelques secondes.');
    renderMarcheNoir();
    return;
  }
  state = migrateAccount(buyerUpd);

  refreshUI();
  setAlert('mnCreateAlert',
    `✋ Demande envoyée pour "${l.titleName}" ! Tes ${l.price.toLocaleString('fr-FR')} 🪙 sont réservés en attendant la réponse du vendeur.`,
    'success'
  );
  setTimeout(() => { document.getElementById('mnCreateAlert').className = 'alert'; }, 5000);
  renderMarcheNoir();
}

// ══════════════════════════════════════════════════
// ACCEPTER (vendeur valide la demande)
// → transfert du titre, crédit du vendeur
// ══════════════════════════════════════════════════
async function acceptMarcheNoirOffer(listingId) {
  const l = await getMarcheNoirListing(listingId);
  if (!l || l.sellerCode !== state.code) { renderMarcheNoir(); return; }
  if (l.status !== 'reserved' || !l.requesterCode) {
    setAlert('mnCreateAlert', '❌ Aucune demande à accepter.', 'error');
    renderMarcheNoir();
    return;
  }

  showConfirm(`Vendre "${l.titleName}" à ${l.requesterName} pour ${l.price.toLocaleString('fr-FR')} 🪙 ?`, async () => {
    closeConfirm();

    // ── Étape 1 : verrouiller en 'sold' immédiatement ──
    const soldAt = new Date().toISOString();
    const soldListing = {
      ...l,
      status: 'sold',
      buyerCode: l.requesterCode,
      buyerName: l.requesterName,
      soldAt,
      updatedAt: soldAt,
    };
    await saveMarcheNoirListing(soldListing);

    // Vérif anti-race
    const check = await getMarcheNoirListing(listingId);
    if (!check || check.status !== 'sold') { renderMarcheNoir(); return; }

    // ── Étape 2 : ajouter le titre au compte de l'acheteur ──
    try {
      const buyer = await getAccount(l.requesterCode);
      if (buyer) {
        if (!buyer.ownedTitles) buyer.ownedTitles = [];
        if (!buyer.ownedTitles.includes(l.titleId)) buyer.ownedTitles.push(l.titleId);

        // Titre custom (Hôtel) : copier la définition avec la couleur custom si applicable
        if (l.titleSource === 'custom' && l.titleDef) {
          if (!buyer.customTitles) buyer.customTitles = {};
          buyer.customTitles[l.titleId] = {
            ...l.titleDef,
            ...(l.customColor ? { customColor: l.customColor } : {}),
          };
        }
        // Titre shop avec couleur custom : créer une surcharge dans customTitles
        // (resolveTitleDef mergera shop + custom pour appliquer la couleur)
        else if (l.titleSource === 'shop' && l.customColor) {
          if (!buyer.customTitles) buyer.customTitles = {};
          buyer.customTitles[l.titleId] = {
            id: l.titleId,
            name: l.titleName,
            type: 'title',
            customColor: l.customColor,
          };
        }

        await saveAccount(buyer);
      }
    } catch(e) { console.error('Erreur ajout titre acheteur:', e); }

    // ── Étape 3 : retirer le titre du compte du vendeur (moi) ──
    state.ownedTitles = (state.ownedTitles || []).filter(t => t !== l.titleId);
    state.activeTitles = (state.activeTitles || []).filter(t => t !== l.titleId);
    if (l.titleSource === 'custom' && state.customTitles) {
      delete state.customTitles[l.titleId];
    }
    await saveAccount(state);

    // ── Étape 4 : créditer le vendeur (moi) ──
    const sellerUpd = await addBalanceTransaction(state.code, l.price, {
      type: 'marche_noir',
      desc: `Titre vendu au Marché Noir : "${l.titleName}" (à ${l.requesterName})`,
      amount: l.price,
      date: soldAt,
    });
    if (sellerUpd) state = migrateAccount(sellerUpd);

    // ── Étape 5 : log historique acheteur (Pomels déjà débités à la demande) ──
    try {
      const buyer = await getAccount(l.requesterCode);
      if (buyer) {
        buyer.history = buyer.history || [];
        buyer.history.unshift({
          type: 'marche_noir',
          desc: `Titre acheté au Marché Noir : "${l.titleName}" (à ${l.sellerName})`,
          amount: 0, // Pomels déjà débités à la demande
          date: soldAt,
        });
        await saveAccount(buyer);
      }
    } catch(e) {}

    refreshUI();
    setAlert('mnCreateAlert',
      `✅ Vente conclue ! Tu reçois ${l.price.toLocaleString('fr-FR')} 🪙 de ${l.requesterName}.`,
      'success'
    );
    setTimeout(() => { document.getElementById('mnCreateAlert').className = 'alert'; }, 5000);
    renderMarcheNoir();
  });
}

// ══════════════════════════════════════════════════
// REFUSER (vendeur refuse la demande)
// → rembourser l'acheteur, listing revient à 'active'
// ══════════════════════════════════════════════════
async function refuseMarcheNoirOffer(listingId) {
  const l = await getMarcheNoirListing(listingId);
  if (!l || l.sellerCode !== state.code) { renderMarcheNoir(); return; }
  if (l.status !== 'reserved' || !l.requesterCode) {
    setAlert('mnCreateAlert', '❌ Aucune demande à refuser.', 'error');
    renderMarcheNoir();
    return;
  }

  showConfirm(`Refuser la demande de ${l.requesterName} ? Il récupérera ses ${l.price.toLocaleString('fr-FR')} 🪙.`, async () => {
    await _releaseReservation(l, 'refused');
    closeConfirm();
    setAlert('mnCreateAlert', `✖️ Demande refusée — ${l.requesterName} a été remboursé.`, 'success');
    setTimeout(() => { document.getElementById('mnCreateAlert').className = 'alert'; }, 4000);
    renderMarcheNoir();
  });
}

// ══════════════════════════════════════════════════
// ANNULER SA DEMANDE (acheteur retire son offre)
// → auto-remboursement, listing revient à 'active'
// ══════════════════════════════════════════════════
async function cancelMarcheNoirRequest(listingId) {
  const l = await getMarcheNoirListing(listingId);
  if (!l) { renderMarcheNoir(); return; }
  if (l.status !== 'reserved' || l.requesterCode !== state.code) {
    renderMarcheNoir();
    return;
  }

  showConfirm(`Annuler ta demande pour "${l.titleName}" ? Tes ${l.price.toLocaleString('fr-FR')} 🪙 te seront rendus.`, async () => {
    await _releaseReservation(l, 'cancelled_by_requester');
    closeConfirm();
    setAlert('mnCreateAlert', `↩️ Demande annulée — tes Pomels t'ont été rendus.`, 'success');
    setTimeout(() => { document.getElementById('mnCreateAlert').className = 'alert'; }, 4000);
    renderMarcheNoir();
  });
}

// ══════════════════════════════════════════════════
// Helper : libérer une réservation
// (rembourse le requester, listing → 'active')
// ══════════════════════════════════════════════════
async function _releaseReservation(l, reason) {
  const fresh = await getMarcheNoirListing(l.id);
  if (!fresh || fresh.status !== 'reserved') return;

  const requesterCode = fresh.requesterCode;
  const price = fresh.price;
  const titleName = fresh.titleName;

  // 1) Remettre le listing en 'active' et vider les champs requester
  const now = new Date().toISOString();
  const releasedListing = {
    ...fresh,
    status: 'active',
    requesterCode: null,
    requesterName: null,
    requestedAt: null,
    updatedAt: now,
  };
  await saveMarcheNoirListing(releasedListing);

  // 2) Rembourser l'acheteur
  const reasonLabel = reason === 'refused' ? 'refusée par le vendeur' : 'annulée';
  const refundDesc = `Demande Marché Noir ${reasonLabel} : "${titleName}" — Pomels remboursés`;
  const refundUpd = await addBalanceTransaction(requesterCode, price, {
    type: 'marche_noir',
    desc: refundDesc,
    amount: price,
    date: now,
  });
  // Si c'est moi (acheteur qui annule), mettre à jour state
  if (requesterCode === state.code && refundUpd) {
    state = migrateAccount(refundUpd);
    refreshUI();
  }
}

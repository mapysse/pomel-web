/* ═══════════════════════════════════════════════════════════════════════════
   POMMON — Système de jeu complet pour Pomel
   ═══════════════════════════════════════════════════════════════════════════

   Sommaire :
   1. CONSTANTES (types, faiblesses, rareté, XP)
   2. DONNÉES POMMONS (les 25 créatures)
   3. DONNÉES MOVES (les 29 attaques)
   4. SPRITES (fonctions de dessin pixel art 64x64)
   5. STOCKAGE (localStorage temporaire, switch Firebase à la fin)
   6. MOTEUR DE COMBAT (dégâts, crans, brûlure, ordre des tours)
   7. IA ADVERSAIRE (choix de move)
   8. GESTION ÉQUIPE & COLLECTION
   9. COMBATS SAUVAGES
  10. ARÈNES
  11. LIGUE POMMON
  12. INTERFACE (écrans, injection UI)
  13. INITIALISATION
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   1. CONSTANTES
   ═══════════════════════════════════════════════════════════════════════════ */

const PM_TYPES = ['plante', 'feu', 'eau', 'electrique', 'air', 'ombre', 'lumiere'];

const PM_TYPE_EMOJI = {
  plante: '🌿', feu: '🔥', eau: '💧', electrique: '⚡',
  air: '🌀', ombre: '🌑', lumiere: '✨'
};

const PM_TYPE_COLOR = {
  plante: '#4a8c3f', feu: '#d4553a', eau: '#3a7bd4', electrique: '#f0c040',
  air: '#a8c8e8', ombre: '#8855aa', lumiere: '#f5d540'
};

const PM_TYPE_LABEL = {
  plante: 'Plante', feu: 'Feu', eau: 'Eau', electrique: 'Électrique',
  air: 'Air', ombre: 'Ombre', lumiere: 'Lumière'
};

// Table faiblesses/résistances : PM_WEAK[defenderType] = { moveType: multiplicateur }
// Lecture : « Le défenseur (clé extérieure) subit X multiplicateur quand il est attaqué par moveType (clé intérieure) »
// Ex : PM_WEAK['feu']['eau'] = 1.5  → un Feu attaqué par une attaque Eau prend 1.5× les dégâts
// Ex : PM_WEAK['plante']['eau'] = 0.5 → une Plante attaquée par une attaque Eau prend 0.5× les dégâts
const PM_WEAK = {
  plante:     { eau: 0.6, electrique: 0.6, feu: 1.4, air: 1.4 },
  feu:        { plante: 0.6, lumiere: 0.6, eau: 1.4, ombre: 1.4 },
  eau:        { feu: 0.6, air: 0.6, electrique: 1.4, plante: 1.4 },
  electrique: { eau: 0.6, lumiere: 0.6, ombre: 1.4, plante: 1.4 },
  air:        { plante: 0.6, ombre: 0.6, electrique: 1.4, lumiere: 1.4 },
  ombre:      { feu: 0.6, electrique: 0.6, lumiere: 1.4, air: 1.4 },
  lumiere:    { air: 0.6, feu: 0.6, ombre: 1.4, eau: 1.4 }
};

// Rareté d'apparition en combat sauvage (pourcentage)
const PM_ENCOUNTER_RATES = {
  plante: 15, feu: 15, eau: 15, electrique: 15, air: 15,
  ombre: 8, lumiere: 8
  // Le reste (9%) est réparti en légendaires
};

// XP nécessaire pour passer au niveau suivant (index = niveau actuel)
const PM_XP_TABLE = [0, 15, 25, 35, 50, 65, 80, 100, 120, 150];
// Ex: PM_XP_TABLE[1] = 15 XP pour passer de niv 1 à niv 2

// Gains d'XP
const PM_XP_GAIN = {
  wild: 20,
  gym: 50,
  league: 25
};

// Modificateurs
const PM_STAB = 1.25;
const PM_WILD_NERF = 0.65;      // sauvages à 65% de leurs stats
const PM_GYM_BOOST = 1.20;      // champions d'arène à 120%
const PM_CAPTURE_RATE = 0.15;   // 15% de chance de capture
const PM_LEVEL_BONUS = 0.05;    // +5% par niveau

// Crans de stats (index = cran + 3, donc [-3 à +3])
const PM_STAGE_MULT = [0.35, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75];

// Limites quotidiennes
// Limites quotidiennes
// ⚠ MODE DEBUG : limites élevées pour tester. Remettre à 3/1/5 avant la prod !
const PM_DAILY_WILD = 999;
const PM_DAILY_GYM_WINS = 999;
const PM_DAILY_LEAGUE = 999;

// Brûlure
const PM_BURN_DAMAGE_PCT = 0.12;
const PM_BURN_DURATION = 3;

// Récompenses Pomels
const PM_REWARD_GYM = 1000;
const PM_REWARD_LEAGUE_PER_WIN = 50;


/* ═══════════════════════════════════════════════════════════════════════════
   2. DONNÉES POMMONS (25 créatures)
   ═══════════════════════════════════════════════════════════════════════════ */

const PM_DEX = {
  // 🌿 PLANTE — tanky, lent (identité : +HP +DEF, -VIT)
  pomalis:    { id:'pomalis',    name:'Pomalis',    type:'plante',     hp:75, atk:50, def:55, vit:40, starter:true,
                lore:'Petit quadrupède à la carapace végétale. Son bulbe dorsal absorbe la lumière du jour et libère un parfum apaisant.' },
  thornet:    { id:'thornet',    name:'Thornet',    type:'plante',     hp:80, atk:55, def:60, vit:45,
                lore:'Scarabée aux élytres couverts d\'épines. Il s\'enfouit dans la mousse et tend des embuscades aux imprudents.' },
  sylvagor:   { id:'sylvagor',   name:'Sylvagor',   type:'plante',     hp:95, atk:50, def:70, vit:45,
                lore:'Golem sylvestre qui s\'éveille à chaque printemps. Ses racines plongent si loin qu\'on dit qu\'il connaît les secrets du sol.' },
  sakuraze:   { id:'sakuraze',   name:'Sakuraze',   type:'plante',     hp:85, atk:55, def:55, vit:45,
                lore:'Esprit des cerisiers en fleurs. Sa danse fait tomber les pétales roses qui endorment ses adversaires.' },

  // 🔥 FEU — rapide, offensif (identité : +VIT +ATK, -HP)
  flameche:   { id:'flameche',   name:'Flamèche',   type:'feu',        hp:55, atk:55, def:45, vit:65, starter:true,
                lore:'Petit lézard à la queue enflammée. Sa flamme ne s\'éteint jamais, même sous la pluie — un mystère pour les érudits.' },
  viperod:    { id:'viperod',    name:'Vipérod',    type:'feu',        hp:50, atk:60, def:45, vit:85,
                lore:'Serpent de braise qui chasse la nuit. Son venin brûle la chair avant même que la morsure ne soit visible.' },
  magmaturne: { id:'magmaturne', name:'Magmaturne', type:'feu',        hp:65, atk:65, def:55, vit:75,
                lore:'Tortue volcanique dont la carapace abrite un cœur de lave. Elle hiberne dans les cratères actifs.' },
  tauralys:   { id:'tauralys',   name:'Tauralys',   type:'feu',        hp:55, atk:70, def:50, vit:65,
                lore:'Taureau des plaines brûlées. Ses cornes rougeoyantes peuvent fendre la pierre quand il charge.' },

  // 💧 EAU — équilibré (identité : aucune stat extrême)
  goutapom:   { id:'goutapom',   name:'Goutapom',   type:'eau',        hp:60, atk:50, def:55, vit:55, starter:true,
                lore:'Têtard joyeux des torrents limpides. Il saute hors de l\'eau pour communiquer par bulles chantantes.' },
  carapulse:  { id:'carapulse',  name:'Carapulse',  type:'eau',        hp:65, atk:55, def:60, vit:60,
                lore:'Crabe aux pinces capables de projeter des jets d\'eau à haute pression. Il arpente les récifs à la recherche de coquillages.' },
  abyssale:   { id:'abyssale',   name:'Abyssale',   type:'eau',        hp:70, atk:65, def:65, vit:60,
                lore:'Méduse des grandes profondeurs. Ses filaments bioluminescents hypnotisent ses proies avant la décharge paralysante.' },
  onduline:   { id:'onduline',   name:'Onduline',   type:'eau',        hp:60, atk:60, def:60, vit:60,
                lore:'Hippocampe des courants chauds. Il se déplace toujours à contre-courant, porté par des remous invisibles.' },

  // ⚡ ÉLECTRIQUE — glass cannon (identité : +ATK +VIT, -DEF)
  volture:    { id:'volture',    name:'Volture',    type:'electrique', hp:55, atk:60, def:45, vit:80,
                lore:'Écureuil électrique qui saute de branche en branche. Ses joues stockent assez d\'énergie pour allumer une maison.' },
  fulguron:   { id:'fulguron',   name:'Fulguron',   type:'electrique', hp:50, atk:70, def:40, vit:80,
                lore:'Sphère d\'énergie pure flottant dans l\'atmosphère. On la confond souvent avec la foudre en boule.' },
  rhinovolt:  { id:'rhinovolt',  name:'Rhinovolt',  type:'electrique', hp:60, atk:65, def:45, vit:70,
                lore:'Rhinocéros à la corne conductrice. Sa charge génère des arcs électriques qui paralysent sur plusieurs mètres.' },
  raispore:   { id:'raispore',   name:'Raispore',   type:'electrique', hp:55, atk:75, def:45, vit:85,
                lore:'Hybride champignon-arachnide. Ses spores électrisées s\'accrochent à l\'air humide pour former des décharges aléatoires.' },

  // 🌀 AIR — agile (identité : +VIT, -HP)
  zephibri:   { id:'zephibri',   name:'Zéphibri',   type:'air',        hp:50, atk:55, def:50, vit:85,
                lore:'Minuscule colibri aux ailes si rapides qu\'elles deviennent invisibles. Il défie les lois de la gravité.' },
  cyclonin:   { id:'cyclonin',   name:'Cyclonin',   type:'air',        hp:55, atk:65, def:55, vit:85,
                lore:'Ninja des nuages, maître du vent tranchant. On raconte qu\'il peut traverser une tempête sans se mouiller.' },
  stratocepe: { id:'stratocepe', name:'Stratocèpe', type:'air',        hp:45, atk:60, def:50, vit:85,
                lore:'Champignon nuageux qui flotte en haute altitude. Son chapeau se condense et libère de brèves averses.' },

  // 🌑 OMBRE — défensif (identité : +HP +DEF, -ATK)
  spectrelis: { id:'spectrelis', name:'Spectrelis', type:'ombre',      hp:75, atk:45, def:70, vit:50,
                lore:'Graine fantôme hantée par l\'âme d\'un vieux jardin oublié. Elle murmure des berceuses aux plantes mourantes.' },
  putrefel:   { id:'putrefel',   name:'Putréfel',   type:'ombre',      hp:85, atk:45, def:75, vit:55,
                lore:'Pomme zombie maudite. Plus on la coupe, plus elle repousse — et plus elle sent mauvais.' },
  nihilium:   { id:'nihilium',   name:'Nihilium',   type:'ombre',      hp:90, atk:55, def:85, vit:60, legendary:true,
                lore:'Sphère de vide absolu, apparition rarissime. Sa simple présence absorbe la lumière des étoiles.' },

  // ✨ LUMIÈRE — offensif (identité : +ATK, -DEF)
  papiluxe:   { id:'papiluxe',   name:'Papiluxe',   type:'lumiere',    hp:60, atk:70, def:45, vit:65,
                lore:'Papillon dont les ailes réfléchissent la lumière du soleil en mille reflets dorés. Il guide les voyageurs égarés.' },
  solarion:   { id:'solarion',   name:'Solarion',   type:'lumiere',    hp:65, atk:75, def:50, vit:70,
                lore:'Lion-soleil, gardien des aubes. Sa crinière flamboyante brûle sans consumer et illumine les vallées au lever du jour.' },
  astraflore: { id:'astraflore', name:'Astraflore', type:'lumiere',    hp:70, atk:85, def:55, vit:80, legendary:true,
                lore:'Déesse florale des cieux étoilés. Sa fleur frontale contient, dit-on, un fragment de constellation vivante.' }
};

// Liste ordonnée pour itération
const PM_DEX_IDS = Object.keys(PM_DEX);


/* ═══════════════════════════════════════════════════════════════════════════
   3. DONNÉES MOVES (29 attaques)
   ═══════════════════════════════════════════════════════════════════════════ */

const PM_MOVES = {
  // Plante
  fouet_roncier:   { id:'fouet_roncier',   name:'Fouet Roncier',    type:'plante',     power:80, accuracy:85,  pp:3, category:'attack', desc:'Attaque Plante puissante.' },
  photosynthese:   { id:'photosynthese',   name:'Photosynthèse',    type:'plante',     power:0,  accuracy:100, pp:3, category:'heal', healPct:0.35, desc:'Récupère 35% des PV max.' },
  lancer_seve:     { id:'lancer_seve',     name:'Jet d\'Écume',      type:'eau',        power:50, accuracy:95,  pp:5, category:'attack', desc:'Attaque Eau (couvre les Feu).' },
  pollen_lourd:    { id:'pollen_lourd',    name:'Pollen Lourd',     type:'plante',     power:0,  accuracy:90,  pp:3, category:'debuff', stat:'vit', stages:-1, desc:'Baisse la Vitesse adverse d\'un cran.' },

  // Feu
  brasier:         { id:'brasier',         name:'Brasier',          type:'feu',        power:80, accuracy:85,  pp:3, category:'attack', desc:'Attaque Feu puissante.' },
  flamme_vive:     { id:'flamme_vive',     name:'Flamme Vive',      type:'feu',        power:50, accuracy:95,  pp:5, category:'attack', burnChance:0.30, desc:'Attaque Feu, 30% de brûler l\'adversaire.' },
  tranchant:       { id:'tranchant',       name:'Coup d\'Aile',      type:'air',        power:50, accuracy:95,  pp:5, category:'attack', desc:'Attaque Air (couvre les Eau).' },
  surchauffe:      { id:'surchauffe',      name:'Surchauffe',       type:'feu',        power:0,  accuracy:100, pp:3, category:'buff', stat:'atk', stages:1, desc:'Augmente ta propre Attaque d\'un cran.' },

  // Eau
  torrent:         { id:'torrent',         name:'Torrent',          type:'eau',        power:80, accuracy:85,  pp:3, category:'attack', desc:'Attaque Eau puissante.' },
  aqua_jet:        { id:'aqua_jet',        name:'Aqua Jet',         type:'eau',        power:40, accuracy:100, pp:5, category:'attack', priority:true, desc:'Attaque Eau rapide : frappe toujours en premier.' },
  eclair_marin:    { id:'eclair_marin',    name:'Éclair Marin',     type:'electrique', power:50, accuracy:95,  pp:5, category:'attack', desc:'Attaque Électrique (couvre les Plante).' },
  corrosion:       { id:'corrosion',       name:'Corrosion',        type:'eau',        power:0,  accuracy:90,  pp:3, category:'debuff', stat:'def', stages:-1, desc:'Baisse la Défense adverse d\'un cran.' },

  // Électrique
  arc_voltaique:   { id:'arc_voltaique',   name:'Arc Voltaïque',    type:'electrique', power:55, accuracy:90,  pp:5, category:'attack', sideEffect:'debuff_def', chance:0.25, desc:'Attaque Électrique, 25% de baisser la Défense adverse.' },
  surcharge:       { id:'surcharge',       name:'Surcharge',        type:'electrique', power:55, accuracy:90,  pp:5, category:'attack', sideEffect:'buff_atk', chance:0.25, desc:'Attaque Électrique, 25% d\'augmenter ta propre Attaque.' },
  galvanisation:   { id:'galvanisation',   name:'Galvanisation',    type:'electrique', power:0,  accuracy:100, pp:3, category:'buff', stat:'atk', stages:1, desc:'Augmente ta propre Attaque d\'un cran.' },
  racine_choc:     { id:'racine_choc',     name:'Fouet Végétal',    type:'plante',     power:50, accuracy:95,  pp:5, category:'attack', desc:'Attaque Plante (couvre les Eau).' },

  // Air
  cyclone:         { id:'cyclone',         name:'Cyclone',          type:'air',        power:80, accuracy:85,  pp:3, category:'attack', desc:'Attaque Air puissante.' },
  brise_vitale:    { id:'brise_vitale',    name:'Brise Vitale',     type:'air',        power:45, accuracy:95,  pp:5, category:'attack', selfHealPct:0.15, desc:'Attaque Air qui soigne 15% des PV infligés.' },
  eclat_celeste:   { id:'eclat_celeste',   name:'Éclat Céleste',    type:'lumiere',    power:50, accuracy:95,  pp:5, category:'attack', desc:'Attaque Lumière (couvre les Ombre).' },
  vent_curatif:    { id:'vent_curatif',    name:'Vent Curatif',     type:'air',        power:0,  accuracy:100, pp:3, category:'heal', healPct:0.35, desc:'Récupère 35% des PV max.' },

  // Ombre
  nuit_noire:      { id:'nuit_noire',      name:'Nuit Noire',       type:'ombre',      power:80, accuracy:85,  pp:3, category:'attack', desc:'Attaque Ombre puissante.' },
  griffure_spec:   { id:'griffure_spec',   name:'Griffure Spectrale', type:'ombre',    power:55, accuracy:95,  pp:5, category:'attack', desc:'Attaque Ombre standard.' },
  voile_obscur:    { id:'voile_obscur',    name:'Voile Obscur',     type:'ombre',      power:0,  accuracy:100, pp:3, category:'buff', stat:'def', stages:1, desc:'Augmente ta propre Défense d\'un cran.' },
  flamme_maudite:  { id:'flamme_maudite',  name:'Flamme Maudite',   type:'feu',        power:50, accuracy:95,  pp:5, category:'attack', desc:'Attaque Feu (couvre les Plante).' },

  // Lumière
  rayon_sacre:     { id:'rayon_sacre',     name:'Rayon Sacré',      type:'lumiere',    power:80, accuracy:85,  pp:3, category:'attack', desc:'Attaque Lumière puissante.' },
  eclat_dore:      { id:'eclat_dore',      name:'Éclat Doré',       type:'lumiere',    power:55, accuracy:95,  pp:5, category:'attack', desc:'Attaque Lumière standard.' },
  aura_radieuse:   { id:'aura_radieuse',   name:'Aura Radieuse',    type:'lumiere',    power:0,  accuracy:100, pp:3, category:'buff', stat:'atk', stages:1, desc:'Augmente ta propre Attaque d\'un cran.' },
  ombre_inversee:  { id:'ombre_inversee',  name:'Ombre Inversée',   type:'ombre',      power:50, accuracy:95,  pp:5, category:'attack', desc:'Attaque Ombre (couvre les Lumière).' },

  // Universel (backup quand plus de PP)
  lutte:           { id:'lutte',           name:'Lutte',            type:'neutre',     power:30, accuracy:100, pp:99, category:'attack', recoilPct:0.15, desc:'Attaque désespérée, inflige 15% de recul à l\'utilisateur.' }
};

// Moves assignés par type : tous les PokePoms d'un type apprennent les 4 moves de leur type
const PM_MOVES_BY_TYPE = {
  plante:     ['fouet_roncier', 'photosynthese', 'lancer_seve', 'pollen_lourd'],
  feu:        ['brasier', 'flamme_vive', 'tranchant', 'surchauffe'],
  eau:        ['torrent', 'aqua_jet', 'eclair_marin', 'corrosion'],
  electrique: ['arc_voltaique', 'surcharge', 'galvanisation', 'racine_choc'],
  air:        ['cyclone', 'brise_vitale', 'eclat_celeste', 'vent_curatif'],
  ombre:      ['nuit_noire', 'griffure_spec', 'voile_obscur', 'flamme_maudite'],
  lumiere:    ['rayon_sacre', 'eclat_dore', 'aura_radieuse', 'ombre_inversee']
};

function getMoveset(pokepomId) {
  const poke = PM_DEX[pokepomId];
  return PM_MOVES_BY_TYPE[poke.type].map(mid => PM_MOVES[mid]);
}


/* ═══════════════════════════════════════════════════════════════════════════
   4. SPRITES (25 fonctions de dessin pixel art 64x64)
   ═══════════════════════════════════════════════════════════════════════════ */

const PM_SPRITES = {};

PM_SPRITES.pomalis = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(24,4,16,4,'#2d8c2d'); px(22,6,20,4,'#3da03d'); px(20,8,24,6,'#3da03d');
  px(22,12,20,4,'#2d8c2d'); px(18,2,4,6,'#4dc74d'); px(16,0,3,4,'#5de05d');
  px(40,3,4,5,'#4dc74d'); px(43,1,3,4,'#5de05d'); px(30,1,4,4,'#5de05d'); px(31,0,2,2,'#7aff7a');
  px(12,16,40,6,'#5a9e4a'); px(10,20,44,8,'#4e8c3e'); px(10,26,44,8,'#437a34');
  px(12,32,40,6,'#3a6e2c'); px(14,36,36,4,'#326224');
  px(18,26,28,8,'#6ab85a'); px(20,32,24,4,'#5ea84e');
  px(2,18,12,6,'#5a9e4a'); px(0,22,14,8,'#4e8c3e'); px(0,28,12,6,'#437a34');
  px(2,32,10,4,'#3a6e2c'); px(0,24,4,4,'#6ab85a');
  px(4,22,3,3,'#1a1a22'); px(5,22,2,2,'#ffffff'); px(9,22,3,3,'#1a1a22'); px(10,22,2,2,'#ffffff');
  px(2,28,4,1,'#2d6620');
  px(12,38,6,8,'#437a34'); px(10,44,8,4,'#326224'); px(10,46,10,4,'#2a5420');
  px(22,38,6,8,'#437a34'); px(20,44,8,4,'#326224'); px(20,46,10,4,'#2a5420');
  px(36,38,6,8,'#437a34'); px(34,44,8,4,'#326224'); px(34,46,10,4,'#2a5420');
  px(46,38,6,8,'#437a34'); px(44,44,8,4,'#326224'); px(44,46,10,4,'#2a5420');
  px(52,30,6,4,'#4e8c3e'); px(56,28,4,4,'#5a9e4a'); px(58,26,4,3,'#6ab85a');
};

PM_SPRITES.thornet = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(20,2,2,6,'#5a9040'); px(18,0,2,3,'#6ab850'); px(40,2,2,6,'#5a9040'); px(42,0,2,3,'#6ab850');
  px(22,8,18,8,'#3a6e2c'); px(20,10,22,6,'#326224');
  px(24,11,4,3,'#cc2222'); px(25,12,2,1,'#ff6644');
  px(34,11,4,3,'#cc2222'); px(35,12,2,1,'#ff6644');
  px(22,16,4,3,'#2a5420'); px(36,16,4,3,'#2a5420'); px(20,17,3,2,'#1e4018'); px(39,17,3,2,'#1e4018');
  px(18,18,26,6,'#4e8c3e'); px(16,20,30,6,'#437a34');
  px(12,26,38,8,'#3a6e2c'); px(10,30,42,8,'#326224'); px(12,36,38,8,'#2a5420');
  px(14,42,34,4,'#1e4018'); px(18,44,26,3,'#1a3614');
  px(14,24,3,4,'#6ab850'); px(10,26,3,3,'#5a9040'); px(46,24,3,4,'#6ab850'); px(50,26,3,3,'#5a9040');
  px(20,23,2,4,'#6ab850'); px(40,23,2,4,'#6ab850'); px(30,22,4,5,'#7acc60'); px(31,20,2,3,'#8ae070');
  px(20,30,6,3,'#4e8c3e'); px(30,32,8,3,'#4e8c3e'); px(38,30,6,3,'#4e8c3e');
  px(12,28,4,10,'#2a5420'); px(8,34,4,6,'#1e4018'); px(6,38,4,4,'#1a3614');
  px(46,28,4,10,'#2a5420'); px(50,34,4,6,'#1e4018'); px(52,38,4,4,'#1a3614');
  px(10,34,4,8,'#2a5420'); px(6,40,4,4,'#1e4018'); px(48,34,4,8,'#2a5420'); px(52,40,4,4,'#1e4018');
  px(16,22,4,6,'#2a5420'); px(12,26,4,4,'#1e4018'); px(42,22,4,6,'#2a5420'); px(46,26,4,4,'#1e4018');
};

PM_SPRITES.sylvagor = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(16,0,32,4,'#3da03d'); px(12,2,40,6,'#4dc74d'); px(10,6,44,6,'#3da03d'); px(14,10,36,4,'#2d8c2d');
  px(8,4,6,4,'#5de05d'); px(48,3,6,5,'#5de05d'); px(28,0,8,2,'#6af06a');
  px(22,8,4,4,'#1a1a22'); px(23,9,2,2,'#ffcc00'); px(36,8,4,4,'#1a1a22'); px(37,9,2,2,'#ffcc00');
  px(22,14,20,6,'#6B4226'); px(20,18,24,10,'#5a3720'); px(18,24,28,10,'#4a2c18'); px(20,32,24,6,'#3e2414');
  px(22,20,3,6,'#7a5535'); px(30,22,4,8,'#7a5535'); px(38,18,3,6,'#7a5535');
  px(20,28,4,3,'#4e8c3e'); px(36,26,4,3,'#4e8c3e');
  px(10,18,10,4,'#5a3720'); px(6,20,8,4,'#4a2c18'); px(2,22,6,4,'#5a3720'); px(0,24,4,3,'#4a2c18'); px(0,21,3,3,'#3da03d');
  px(44,18,10,4,'#5a3720'); px(50,20,8,4,'#4a2c18'); px(56,22,6,4,'#5a3720'); px(60,24,4,3,'#4a2c18'); px(61,21,3,3,'#3da03d');
  px(18,36,10,10,'#4a2c18'); px(16,42,12,6,'#3e2414'); px(14,46,14,6,'#34200e');
  px(12,50,4,4,'#4a2c18'); px(28,50,3,3,'#4a2c18');
  px(36,36,10,10,'#4a2c18'); px(34,42,12,6,'#3e2414'); px(34,46,14,6,'#34200e');
  px(48,50,4,4,'#4a2c18'); px(34,50,3,3,'#4a2c18');
};

PM_SPRITES.sakuraze = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  ctx.globalAlpha=0.5;
  px(8,8,3,3,'#ffaacc'); px(52,12,3,3,'#ffaacc'); px(4,30,2,2,'#ff88aa');
  px(56,24,2,2,'#ff88aa'); px(12,50,2,2,'#ffaacc'); px(50,44,3,3,'#ffaacc');
  ctx.globalAlpha=1;
  px(20,2,24,4,'#ff88aa'); px(16,4,32,6,'#ff7799'); px(14,8,36,6,'#ee6688'); px(18,12,28,4,'#dd5577');
  px(18,2,4,4,'#ffccdd'); px(34,3,4,4,'#ffccdd'); px(26,1,4,3,'#ffddee'); px(42,6,4,4,'#ffccdd');
  px(22,8,4,4,'#1a1a22'); px(23,9,2,2,'#dd2266'); px(36,8,4,4,'#1a1a22'); px(37,9,2,2,'#dd2266');
  px(28,13,8,1,'#aa3355'); px(29,14,6,1,'#cc5577');
  px(28,16,8,4,'#5a9040'); px(26,18,12,4,'#4e8040'); px(28,22,8,6,'#437034');
  px(26,26,12,4,'#3a6028'); px(28,28,8,6,'#326020');
  px(18,18,8,3,'#5a9040'); px(12,16,8,3,'#4e8040'); px(8,14,6,3,'#5a9040'); px(6,12,4,3,'#6ab850');
  px(4,10,4,4,'#ff88aa'); px(5,11,2,2,'#ffccdd');
  px(38,18,8,3,'#5a9040'); px(44,16,8,3,'#4e8040'); px(50,14,6,3,'#5a9040'); px(54,12,4,3,'#6ab850');
  px(56,10,4,4,'#ff88aa'); px(57,11,2,2,'#ffccdd');
  px(26,34,4,6,'#3a6028'); px(34,34,4,6,'#3a6028');
  px(24,38,4,8,'#326020'); px(36,38,4,8,'#326020');
  px(22,44,4,6,'#2a5018'); px(38,44,4,6,'#2a5018');
  px(20,48,4,4,'#326020'); px(40,48,4,4,'#326020');
  px(18,50,3,4,'#3a6028'); px(43,50,3,4,'#3a6028');
  ctx.globalAlpha=0.12;
  px(22,58,20,2,'#6ab850'); px(26,57,12,1,'#4e8040');
  ctx.globalAlpha=1;
};

PM_SPRITES.flameche = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(14,6,16,4,'#cc3322'); px(12,8,20,6,'#dd3828'); px(10,10,24,6,'#cc3322'); px(12,14,20,4,'#bb2a1e');
  px(22,2,4,6,'#ff6600'); px(24,0,3,4,'#ff8800'); px(26,0,2,3,'#ffaa00'); px(18,4,3,4,'#ff5500');
  px(14,10,4,3,'#ffcc00'); px(15,11,2,1,'#1a1a22');
  px(22,10,4,3,'#ffcc00'); px(23,11,2,1,'#1a1a22');
  px(12,15,10,2,'#991515'); px(13,15,2,1,'#ffffff'); px(18,15,2,1,'#ffffff');
  px(18,18,10,4,'#cc3322');
  px(20,22,14,6,'#dd3828'); px(22,26,14,8,'#cc3322'); px(24,32,12,6,'#bb2a1e');
  px(24,28,8,8,'#ee8866'); px(26,34,6,4,'#dd7755');
  px(14,22,6,3,'#cc3322'); px(10,23,6,3,'#bb2a1e'); px(8,24,4,3,'#cc3322');
  px(6,24,2,1,'#ffcc88'); px(6,26,2,1,'#ffcc88');
  px(34,24,6,3,'#cc3322'); px(38,25,4,3,'#bb2a1e');
  px(42,25,2,1,'#ffcc88'); px(42,27,2,1,'#ffcc88');
  px(22,38,6,8,'#bb2a1e'); px(20,44,8,4,'#aa2218'); px(18,46,10,4,'#991a14');
  px(16,48,3,2,'#ffcc88'); px(27,48,3,2,'#ffcc88');
  px(34,36,6,10,'#bb2a1e'); px(32,44,8,4,'#aa2218'); px(32,46,10,4,'#991a14');
  px(30,48,3,2,'#ffcc88'); px(41,48,3,2,'#ffcc88');
  px(36,34,6,4,'#cc3322'); px(42,32,6,4,'#cc3322'); px(46,30,6,4,'#dd4422');
  px(50,28,4,4,'#ff6600'); px(52,26,4,4,'#ff8800'); px(54,24,4,3,'#ffaa00');
  px(56,22,3,3,'#ffcc44'); px(58,20,2,3,'#ffee66');
  px(57,18,3,3,'#ffaa00'); px(59,16,2,3,'#ff8800'); px(58,14,2,2,'#ff6600');
};

PM_SPRITES.viperod = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(6,10,14,6,'#dd3322'); px(4,12,16,8,'#cc2a1a'); px(6,18,12,4,'#bb2214');
  px(10,6,4,6,'#ff5500'); px(12,4,3,4,'#ff7700'); px(14,2,2,4,'#ff9944');
  px(6,13,4,3,'#ffcc00'); px(7,14,2,1,'#1a1a22');
  px(14,13,4,3,'#ffcc00'); px(15,14,2,1,'#1a1a22');
  px(6,20,2,3,'#ffffee'); px(16,20,2,3,'#ffffee');
  px(14,20,8,6,'#dd3322'); px(18,24,10,6,'#cc2a1a'); px(24,28,12,6,'#dd3322');
  px(32,26,10,6,'#cc2a1a'); px(38,22,10,6,'#dd3322'); px(44,18,8,6,'#cc2a1a');
  px(16,24,6,3,'#ee8866'); px(22,30,8,3,'#ee8866'); px(36,28,6,3,'#ee8866'); px(42,22,6,3,'#ee8866');
  px(20,22,3,2,'#ff6644'); px(28,26,3,2,'#ff6644'); px(38,24,3,2,'#ff6644');
  px(48,16,6,4,'#cc2a1a'); px(50,12,6,4,'#bb2214'); px(52,8,4,6,'#cc2a1a'); px(50,6,4,4,'#dd3322');
  px(48,2,4,5,'#ff6600'); px(50,0,3,4,'#ff8800'); px(52,0,2,2,'#ffaa44');
  px(28,32,10,4,'#bb2214'); px(24,34,8,4,'#aa1a10'); px(20,36,8,4,'#bb2214');
  px(16,38,8,4,'#cc2a1a'); px(14,40,6,4,'#bb2214'); px(12,42,6,4,'#aa1a10');
  px(10,44,4,4,'#cc2a1a'); px(8,46,4,3,'#dd3322'); px(6,48,3,2,'#ff5544');
};

PM_SPRITES.magmaturne = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(16,6,32,4,'#5a3720'); px(12,8,40,6,'#4a2c18'); px(10,12,44,8,'#3e2414');
  px(12,18,40,6,'#4a2c18'); px(16,22,32,4,'#5a3720');
  px(20,8,3,10,'#ff6600'); px(18,10,2,6,'#ffaa00');
  px(34,10,3,8,'#ff6600'); px(36,12,2,4,'#ffaa00');
  px(26,14,8,3,'#ff4400'); px(28,12,4,2,'#ff8800');
  px(42,14,4,4,'#ff5500'); px(44,16,2,2,'#ffcc00');
  ctx.globalAlpha=0.4;
  px(22,4,3,3,'#ff8844'); px(30,2,4,4,'#ff6622'); px(40,4,3,3,'#ffaa44');
  ctx.globalAlpha=0.25;
  px(26,0,3,3,'#ffcc88'); px(36,1,2,2,'#ffcc88');
  ctx.globalAlpha=1;
  px(2,16,12,6,'#6e4030'); px(0,18,14,8,'#5a3428'); px(2,24,10,4,'#4e2a20');
  px(4,19,3,3,'#ff6600'); px(5,20,1,1,'#1a1a22');
  px(9,19,3,3,'#ff6600'); px(10,20,1,1,'#1a1a22');
  px(4,24,6,2,'#3e1e14');
  px(10,26,8,8,'#5a3428'); px(8,32,10,6,'#4e2a20'); px(6,36,12,4,'#3e1e14');
  px(24,26,8,8,'#5a3428'); px(22,32,10,6,'#4e2a20'); px(22,36,12,4,'#3e1e14');
  px(36,26,8,8,'#5a3428'); px(34,32,10,6,'#4e2a20'); px(34,36,12,4,'#3e1e14');
  px(50,26,8,8,'#5a3428'); px(48,32,10,6,'#4e2a20'); px(48,36,12,4,'#3e1e14');
  px(56,20,4,4,'#5a3428'); px(58,18,4,4,'#6e4030'); px(60,16,3,3,'#ff5500');
};

PM_SPRITES.tauralys = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(8,2,4,8,'#cc5500'); px(6,0,3,4,'#ff8800'); px(4,0,2,2,'#ffcc44');
  px(48,2,4,8,'#cc5500'); px(53,0,3,4,'#ff8800'); px(56,0,2,2,'#ffcc44');
  px(14,6,32,6,'#4a2c18'); px(12,10,36,8,'#3e2414'); px(16,16,28,4,'#34200e');
  px(18,11,5,4,'#ff4400'); px(19,12,3,2,'#ffcc00');
  px(37,11,5,4,'#ff4400'); px(38,12,3,2,'#ffcc00');
  px(26,16,4,2,'#1a1a0e'); px(34,16,4,2,'#1a1a0e');
  ctx.globalAlpha=0.3;
  px(25,14,3,2,'#ff8844'); px(35,14,3,2,'#ff8844');
  ctx.globalAlpha=1;
  px(16,20,28,6,'#4a2c18');
  px(10,24,44,8,'#3e2414'); px(8,28,48,10,'#34200e'); px(10,36,44,6,'#2a1a0a'); px(14,40,36,4,'#241608');
  px(16,28,2,6,'#ff5500'); px(28,30,3,4,'#ff6600'); px(40,26,2,8,'#ff5500'); px(48,30,2,4,'#ff4400');
  ctx.globalAlpha=0.2;
  px(20,32,4,3,'#ff8844'); px(34,34,4,2,'#ff8844');
  ctx.globalAlpha=1;
  px(10,42,8,8,'#34200e'); px(8,48,10,6,'#2a1a0a'); px(6,52,12,4,'#241608');
  px(22,42,8,8,'#34200e'); px(20,48,10,6,'#2a1a0a'); px(20,52,12,4,'#241608');
  px(36,42,8,8,'#34200e'); px(34,48,10,6,'#2a1a0a'); px(34,52,12,4,'#241608');
  px(48,42,8,8,'#34200e'); px(46,48,10,6,'#2a1a0a'); px(46,52,12,4,'#241608');
  px(54,34,4,4,'#3e2414'); px(56,30,4,6,'#4a2c18'); px(58,28,4,4,'#ff6600'); px(60,26,3,3,'#ff8800');
};

PM_SPRITES.goutapom = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(22,6,20,4,'#4ab0e0'); px(18,8,28,4,'#42a0d4'); px(16,10,32,6,'#3a90c8');
  px(14,14,36,8,'#3585be'); px(14,20,36,8,'#3078b0'); px(16,26,32,6,'#2c6ca4');
  px(18,30,28,4,'#286098'); px(22,32,20,4,'#24568c');
  ctx.globalAlpha=0.4;
  px(20,10,8,6,'#7ccef0'); px(18,12,6,4,'#a0e0ff');
  ctx.globalAlpha=0.25;
  px(22,8,4,4,'#c0f0ff');
  ctx.globalAlpha=1;
  px(22,16,6,6,'#ffffff'); px(36,16,6,6,'#ffffff');
  px(24,17,4,4,'#1a2a44'); px(38,17,4,4,'#1a2a44');
  px(25,18,2,2,'#1a1a22'); px(39,18,2,2,'#1a1a22');
  px(22,16,2,2,'#e0f4ff'); px(36,16,2,2,'#e0f4ff');
  px(28,26,8,2,'#1e5080'); px(30,27,4,1,'#4ab0e0');
  px(10,16,4,6,'#42a0d4'); px(8,18,4,4,'#4ab0e0'); px(6,20,3,2,'#5cbce8');
  px(50,16,4,6,'#42a0d4'); px(52,18,4,4,'#4ab0e0'); px(55,20,3,2,'#5cbce8');
  px(26,34,12,4,'#286098'); px(28,38,10,3,'#24568c'); px(30,41,10,3,'#205080');
  px(34,44,8,3,'#1c4874'); px(36,47,8,3,'#1c4874'); px(38,50,8,3,'#184068');
  px(40,53,10,3,'#3a90c8'); px(42,55,8,3,'#4ab0e0'); px(44,57,6,3,'#5cbce8');
  px(38,54,4,3,'#3585be'); px(36,55,4,3,'#42a0d4');
  ctx.globalAlpha=0.35;
  px(8,8,3,3,'#7ccef0'); px(52,6,4,4,'#7ccef0'); px(56,12,2,2,'#a0e0ff'); px(6,28,2,2,'#a0e0ff');
  ctx.globalAlpha=1;
  ctx.globalAlpha=0.15;
  px(20,62,24,2,'#4ab0e0'); px(24,61,16,1,'#3a90c8');
  ctx.globalAlpha=1;
};

PM_SPRITES.carapulse = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(18,6,28,4,'#8B6540'); px(14,8,36,6,'#7a5535'); px(12,12,40,8,'#6B4226');
  px(14,18,36,4,'#5a3720'); px(18,20,28,4,'#4a2c18');
  px(20,10,3,4,'#9a7550'); px(32,8,4,4,'#9a7550'); px(40,12,3,4,'#9a7550');
  px(28,8,2,10,'#5a3720');
  px(22,2,4,6,'#4aa8d9'); px(23,0,2,3,'#5cbce8'); px(23,0,2,2,'#1a1a22');
  px(38,2,4,6,'#4aa8d9'); px(39,0,2,3,'#5cbce8'); px(39,0,2,2,'#1a1a22');
  px(28,20,8,2,'#3e2010');
  px(4,14,10,4,'#4aa8d9'); px(0,16,12,6,'#3a90c8'); px(0,20,10,6,'#3078b0');
  px(2,24,8,4,'#2868a0'); px(0,18,4,4,'#2c6ca4'); px(0,22,4,3,'#24568c');
  px(50,14,10,4,'#4aa8d9'); px(52,16,12,6,'#3a90c8'); px(54,20,10,6,'#3078b0');
  px(54,24,8,4,'#2868a0'); px(60,18,4,4,'#2c6ca4'); px(60,22,4,3,'#24568c');
  px(14,24,4,8,'#3a90c8'); px(10,30,4,6,'#3078b0'); px(8,34,4,4,'#2868a0');
  px(20,24,4,8,'#3a90c8'); px(18,30,4,6,'#3078b0'); px(16,34,4,4,'#2868a0');
  px(26,24,4,6,'#3a90c8'); px(24,28,4,6,'#3078b0'); px(22,32,4,4,'#2868a0');
  px(36,24,4,6,'#3a90c8'); px(38,28,4,6,'#3078b0'); px(40,32,4,4,'#2868a0');
  px(42,24,4,8,'#3a90c8'); px(44,30,4,6,'#3078b0'); px(46,34,4,4,'#2868a0');
  px(48,24,4,8,'#3a90c8'); px(50,30,4,6,'#3078b0'); px(52,34,4,4,'#2868a0');
  ctx.globalAlpha=0.35;
  px(24,36,4,8,'#5cbce8'); px(36,36,4,8,'#5cbce8'); px(26,40,2,6,'#7ccef0'); px(38,40,2,6,'#7ccef0');
  ctx.globalAlpha=1;
};

PM_SPRITES.abyssale = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(22,2,20,4,'#2c6ca4'); px(18,4,28,4,'#286098'); px(14,6,36,6,'#24568c');
  px(12,10,40,6,'#205080'); px(14,14,36,4,'#1c4874'); px(18,16,28,4,'#184068');
  ctx.globalAlpha=0.5;
  px(22,6,4,4,'#5cbce8'); px(36,8,4,3,'#5cbce8'); px(28,4,6,3,'#7ccef0');
  ctx.globalAlpha=0.3;
  px(18,10,3,3,'#a0e0ff'); px(42,10,3,3,'#a0e0ff');
  ctx.globalAlpha=1;
  px(24,10,4,4,'#00ffcc'); px(25,11,2,2,'#aaffee');
  px(36,10,4,4,'#00ffcc'); px(37,11,2,2,'#aaffee');
  px(10,18,6,3,'#2c6ca4'); px(48,18,6,3,'#2c6ca4'); px(8,19,4,2,'#286098'); px(52,19,4,2,'#286098');
  px(14,20,3,10,'#24568c'); px(12,28,3,8,'#1c4874'); px(10,34,3,8,'#184068'); px(12,40,2,6,'#1c4874');
  px(22,20,3,12,'#205080'); px(20,30,3,10,'#1c4874'); px(22,38,2,8,'#184068');
  px(30,20,4,14,'#24568c'); px(28,32,4,10,'#205080'); px(30,40,3,8,'#1c4874');
  px(38,20,3,12,'#205080'); px(40,30,3,10,'#1c4874'); px(38,38,2,8,'#184068');
  px(46,20,3,10,'#24568c'); px(48,28,3,8,'#1c4874'); px(50,34,3,8,'#184068'); px(48,40,2,6,'#1c4874');
  ctx.globalAlpha=0.6;
  px(11,44,3,2,'#00ffcc'); px(21,44,3,2,'#00ffcc'); px(30,46,3,2,'#00ffcc');
  px(38,44,3,2,'#00ffcc'); px(48,44,3,2,'#00ffcc');
  ctx.globalAlpha=0.3;
  px(6,6,2,2,'#00ffcc'); px(56,4,2,2,'#00ffcc'); px(4,26,2,2,'#5cbce8'); px(58,30,2,2,'#5cbce8');
  ctx.globalAlpha=1;
};

PM_SPRITES.onduline = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(38,2,3,6,'#5cbce8'); px(40,6,3,4,'#4aa8d9'); px(42,10,3,4,'#3a90c8');
  px(40,14,3,4,'#5cbce8'); px(38,18,3,4,'#4aa8d9'); px(36,22,3,3,'#3a90c8');
  px(14,4,16,4,'#3a90c8'); px(12,6,20,6,'#3585be'); px(14,10,16,4,'#3078b0');
  px(4,6,10,3,'#3a90c8'); px(0,7,6,2,'#4aa8d9');
  px(24,0,4,6,'#5cbce8'); px(26,0,3,3,'#7ccef0');
  px(16,7,4,4,'#ffffff'); px(17,8,3,3,'#1a2a44'); px(18,9,1,1,'#1a1a22'); px(16,7,2,1,'#e0f4ff');
  px(20,14,12,6,'#3078b0'); px(22,18,10,6,'#2c6ca4'); px(24,22,10,6,'#286098');
  px(26,26,10,6,'#24568c'); px(24,30,10,6,'#205080'); px(22,34,10,6,'#1c4874');
  px(22,16,4,3,'#5cbce8'); px(24,20,4,3,'#5cbce8'); px(26,24,4,3,'#5cbce8');
  px(26,28,4,3,'#5cbce8'); px(24,32,4,3,'#5cbce8'); px(22,36,4,3,'#5cbce8');
  px(20,38,8,4,'#1c4874'); px(16,40,8,4,'#184068'); px(14,42,6,4,'#1c4874');
  px(14,44,4,4,'#205080'); px(16,46,6,4,'#24568c'); px(20,48,6,3,'#286098');
  px(24,48,4,4,'#24568c'); px(26,46,4,3,'#205080'); px(24,44,4,3,'#1c4874');
  px(20,46,4,3,'#3a90c8'); px(22,48,2,2,'#4aa8d9');
  px(12,16,8,3,'#4aa8d9'); px(8,18,6,3,'#5cbce8'); px(6,20,4,2,'#7ccef0'); px(4,18,3,2,'#5cbce8');
};

PM_SPRITES.volture = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(12,4,4,6,'#e8c840'); px(14,2,3,4,'#f0d050'); px(40,4,4,6,'#e8c840'); px(41,2,3,4,'#f0d050');
  px(13,6,2,3,'#ff9944');
  px(14,8,24,4,'#f0d050'); px(12,10,28,8,'#e8c840'); px(14,16,24,4,'#d4b030');
  px(10,14,4,4,'#ff9944'); px(38,14,4,4,'#ff9944');
  ctx.globalAlpha=0.5;
  px(10,14,3,3,'#ffcc88'); px(39,14,3,3,'#ffcc88');
  ctx.globalAlpha=1;
  px(16,12,4,4,'#1a1a22'); px(17,13,2,2,'#ffffff');
  px(30,12,4,4,'#1a1a22'); px(31,13,2,2,'#ffffff');
  px(22,16,8,3,'#f8e060'); px(24,18,4,2,'#e8a830'); px(25,17,2,1,'#1a1a22');
  px(14,20,24,6,'#e8c840'); px(16,26,20,6,'#d4b030'); px(18,32,16,4,'#c0a020');
  px(20,22,12,4,'#fff080'); px(22,26,8,4,'#f8e060');
  px(10,22,6,6,'#d4b030'); px(8,26,6,4,'#c0a020');
  px(38,22,6,6,'#d4b030'); px(42,26,6,4,'#c0a020');
  px(16,36,6,6,'#c0a020'); px(14,40,8,4,'#a88810');
  px(30,36,6,6,'#c0a020'); px(30,40,8,4,'#a88810');
  px(44,16,4,6,'#ffcc00'); px(46,12,4,6,'#ffee44'); px(50,8,4,6,'#ffcc00');
  px(48,4,4,6,'#ffee44'); px(52,14,4,4,'#f0c040'); px(54,18,4,4,'#ffcc00');
  px(50,22,4,6,'#ffee44'); px(54,24,4,4,'#ffcc00');
  ctx.globalAlpha=0.6;
  px(6,12,2,3,'#ffee44'); px(4,16,2,2,'#ffcc00'); px(54,30,2,3,'#ffee44');
  ctx.globalAlpha=1;
};

PM_SPRITES.fulguron = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  ctx.globalAlpha=0.3;
  px(10,10,44,4,'#ffee44'); px(8,14,48,4,'#ffcc00'); px(6,18,52,12,'#ffee44');
  px(8,30,48,4,'#ffcc00'); px(10,34,44,4,'#ffee44');
  ctx.globalAlpha=1;
  px(22,14,20,4,'#ffcc00'); px(18,16,28,6,'#ffdd22'); px(14,20,36,10,'#ffee44');
  px(16,28,32,6,'#ffcc00'); px(20,32,24,4,'#e8b800');
  px(24,20,16,8,'#ffffaa'); px(26,22,12,4,'#ffffff');
  px(22,22,4,4,'#1a1a22'); px(38,22,4,4,'#1a1a22');
  px(23,23,2,2,'#ffee44'); px(39,23,2,2,'#ffee44');
  px(28,28,8,1,'#1a1a22'); px(30,29,2,2,'#ff6600'); px(32,29,2,2,'#ff6600');
  px(28,4,3,6,'#ffee44'); px(30,0,3,6,'#ffffaa'); px(32,4,2,8,'#ffcc00');
  px(26,38,3,6,'#ffee44'); px(24,44,3,4,'#ffcc00'); px(34,38,3,6,'#ffee44');
  px(36,44,3,4,'#ffcc00'); px(30,46,3,6,'#ffee44');
  px(8,18,4,3,'#ffee44'); px(4,20,4,3,'#ffcc00'); px(0,22,4,3,'#ffee44');
  px(2,26,4,3,'#ffcc00'); px(6,28,4,3,'#ffee44');
  px(50,18,4,3,'#ffee44'); px(54,20,4,3,'#ffcc00'); px(58,22,4,3,'#ffee44');
  px(56,26,4,3,'#ffcc00'); px(52,28,4,3,'#ffee44');
  ctx.globalAlpha=0.5;
  px(12,8,2,2,'#ffffaa'); px(50,10,2,2,'#ffffaa'); px(14,50,2,2,'#ffffaa'); px(48,52,2,2,'#ffffaa');
  ctx.globalAlpha=1;
};

PM_SPRITES.rhinovolt = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(6,2,3,8,'#ffee44'); px(4,6,3,6,'#ffcc00'); px(2,10,3,4,'#ffee44');
  px(6,12,2,4,'#ffcc00'); px(4,14,3,3,'#ffee44');
  px(10,12,20,6,'#f0c040'); px(8,16,24,8,'#e8b030'); px(10,22,22,6,'#d4a020');
  px(12,14,2,12,'#5a8040'); px(18,14,2,14,'#5a8040'); px(24,14,2,12,'#5a8040'); px(28,16,2,10,'#5a8040');
  px(14,18,4,3,'#1a1a22'); px(15,19,2,1,'#ffcc00');
  px(24,18,4,3,'#1a1a22'); px(25,19,2,1,'#ffcc00');
  px(10,24,4,3,'#b08010'); px(12,26,2,1,'#1a1a22');
  px(30,14,24,6,'#e8b030'); px(32,20,26,10,'#d4a020'); px(30,28,28,8,'#c09010'); px(34,36,22,4,'#a08010');
  px(34,16,2,20,'#5a8040'); px(40,18,2,20,'#5a8040'); px(46,18,2,20,'#5a8040'); px(52,18,2,18,'#5a8040');
  px(32,38,6,10,'#a08010'); px(30,44,8,6,'#8a6808'); px(28,48,10,4,'#746008');
  px(44,38,6,10,'#a08010'); px(42,44,8,6,'#8a6808'); px(42,48,10,4,'#746008');
  px(22,36,6,8,'#a08010'); px(20,42,8,6,'#8a6808'); px(18,46,10,4,'#746008');
  px(54,24,6,4,'#d4a020'); px(58,22,4,4,'#ffee44'); px(60,20,3,3,'#ffcc00');
  ctx.globalAlpha=0.5;
  px(2,30,2,4,'#ffee44'); px(6,36,2,3,'#ffee44'); px(60,34,2,4,'#ffee44');
  ctx.globalAlpha=1;
};

PM_SPRITES.raispore = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(18,4,28,4,'#5c2080'); px(14,6,36,6,'#6c2890'); px(12,10,40,6,'#4c1870'); px(14,14,36,4,'#3c1060');
  px(22,8,4,4,'#ffee44'); px(32,10,4,3,'#ffee44'); px(40,8,4,4,'#ffee44');
  px(18,12,3,3,'#ffcc00'); px(44,12,3,3,'#ffcc00');
  ctx.globalAlpha=0.6;
  px(16,2,2,4,'#ffee44'); px(30,0,2,4,'#ffee44'); px(46,2,2,4,'#ffee44');
  ctx.globalAlpha=1;
  px(16,18,32,2,'#8855aa'); px(18,20,28,2,'#6c2890');
  px(24,22,16,8,'#c8a0d0'); px(22,28,20,6,'#b088c0'); px(24,32,16,4,'#a078b0');
  px(22,26,3,3,'#ffee44'); px(27,24,3,3,'#ffee44'); px(34,24,3,3,'#ffee44'); px(39,26,3,3,'#ffee44');
  px(23,27,1,1,'#1a1a22'); px(28,25,1,1,'#1a1a22'); px(35,25,1,1,'#1a1a22'); px(40,27,1,1,'#1a1a22');
  px(26,30,3,2,'#ffcc00'); px(35,30,3,2,'#ffcc00');
  px(14,24,10,2,'#6c2890'); px(8,22,6,2,'#4c1870'); px(4,20,4,4,'#3c1060');
  px(16,28,8,2,'#6c2890'); px(10,28,6,3,'#4c1870'); px(4,28,6,4,'#3c1060');
  px(14,32,10,2,'#6c2890'); px(8,32,6,4,'#4c1870'); px(2,34,6,4,'#3c1060');
  px(16,36,8,2,'#6c2890'); px(8,36,8,4,'#4c1870'); px(4,38,4,4,'#3c1060');
  px(40,24,10,2,'#6c2890'); px(50,22,6,2,'#4c1870'); px(56,20,4,4,'#3c1060');
  px(40,28,8,2,'#6c2890'); px(48,28,6,3,'#4c1870'); px(54,28,6,4,'#3c1060');
  px(40,32,10,2,'#6c2890'); px(50,32,6,4,'#4c1870'); px(56,34,6,4,'#3c1060');
  px(40,36,8,2,'#6c2890'); px(48,36,8,4,'#4c1870'); px(56,38,4,4,'#3c1060');
  ctx.globalAlpha=0.4;
  px(4,42,4,2,'#ffee44'); px(56,42,4,2,'#ffee44');
  ctx.globalAlpha=1;
};

PM_SPRITES.zephibri = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  ctx.globalAlpha=0.4;
  px(2,10,10,4,'#c8d8e8'); px(0,14,12,3,'#a8c8e8');
  ctx.globalAlpha=0.7;
  px(6,12,8,4,'#d8e8f0');
  ctx.globalAlpha=0.4;
  px(52,10,10,4,'#c8d8e8'); px(52,14,12,3,'#a8c8e8');
  ctx.globalAlpha=0.7;
  px(50,12,8,4,'#d8e8f0');
  ctx.globalAlpha=1;
  px(22,14,20,4,'#8866aa'); px(18,16,28,6,'#7755aa'); px(16,20,32,10,'#6644aa');
  px(18,28,28,6,'#553388'); px(22,32,20,4,'#442266');
  ctx.globalAlpha=0.5;
  px(20,18,6,4,'#bb99cc'); px(22,22,4,3,'#cca0dd');
  ctx.globalAlpha=1;
  px(24,12,16,2,'#5c3366'); px(28,10,8,2,'#4a2855');
  px(0,22,16,3,'#ffcc44'); px(14,21,6,2,'#e8b030'); px(0,22,2,3,'#d4a020');
  px(18,20,4,4,'#ffffff'); px(19,21,3,3,'#1a1a22'); px(20,22,1,1,'#ffffff');
  px(42,20,4,4,'#ffffff'); px(43,21,3,3,'#1a1a22'); px(44,22,1,1,'#ffffff');
  px(26,34,12,3,'#553388'); px(24,36,16,3,'#442266');
  px(22,38,4,4,'#5c3366'); px(26,38,4,4,'#6644aa'); px(30,38,4,4,'#7755aa');
  px(34,38,4,4,'#6644aa'); px(38,38,4,4,'#5c3366');
  px(28,36,2,4,'#d4a020'); px(34,36,2,4,'#d4a020');
  px(26,40,4,1,'#b08818'); px(34,40,4,1,'#b08818');
  ctx.globalAlpha=0.3;
  px(52,6,4,2,'#ffffff'); px(56,4,3,2,'#ffffff'); px(8,6,4,2,'#ffffff'); px(4,4,3,2,'#ffffff');
  px(54,30,4,2,'#e0e8f0'); px(6,32,4,2,'#e0e8f0');
  ctx.globalAlpha=0.1;
  px(22,52,20,2,'#6644aa');
  ctx.globalAlpha=1;
};

PM_SPRITES.cyclonin = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  ctx.globalAlpha=0.3;
  px(6,8,6,4,'#d8e8f0'); px(52,8,6,4,'#d8e8f0');
  px(4,20,4,10,'#c8d8e8'); px(56,20,4,10,'#c8d8e8');
  px(8,40,6,4,'#d8e8f0'); px(50,40,6,4,'#d8e8f0');
  ctx.globalAlpha=0.2;
  px(0,14,6,14,'#e8f0f8'); px(58,14,6,14,'#e8f0f8');
  ctx.globalAlpha=1;
  px(18,2,28,4,'#3a6028'); px(14,4,36,6,'#437034'); px(16,8,32,4,'#326020');
  px(10,4,6,4,'#5a9040'); px(48,4,6,4,'#5a9040');
  px(18,12,28,4,'#8a98a8');
  px(22,13,6,2,'#ffee44'); px(36,13,6,2,'#ffee44');
  px(16,14,32,2,'#5a3020');
  px(22,16,20,4,'#a8b8c8'); px(20,20,24,8,'#98a8b8'); px(22,28,20,6,'#889888');
  px(20,26,24,2,'#5a3020');
  px(14,18,6,4,'#98a8b8'); px(10,14,6,6,'#889888'); px(8,10,4,6,'#788878');
  ctx.globalAlpha=0.7;
  px(4,6,8,2,'#e0f0ff'); px(2,8,6,2,'#c0d8e8'); px(0,10,6,2,'#a0c0d8');
  ctx.globalAlpha=1;
  px(44,18,6,4,'#98a8b8'); px(48,20,6,6,'#889888'); px(52,22,4,6,'#788878');
  ctx.globalAlpha=0.7;
  px(54,26,8,2,'#e0f0ff'); px(56,28,6,2,'#c0d8e8'); px(58,30,6,2,'#a0c0d8');
  ctx.globalAlpha=1;
  px(22,34,8,8,'#788878'); px(20,42,10,6,'#687868'); px(18,48,12,4,'#586858');
  px(34,34,8,8,'#788878'); px(34,42,10,6,'#687868'); px(34,48,12,4,'#586858');
  ctx.globalAlpha=0.4;
  px(2,50,4,2,'#e0f0ff'); px(58,50,4,2,'#e0f0ff'); px(6,56,6,2,'#c0d8e8'); px(52,56,6,2,'#c0d8e8');
  ctx.globalAlpha=1;
};

PM_SPRITES.stratocepe = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  ctx.globalAlpha=0.5;
  px(2,8,8,3,'#ffffff'); px(0,10,6,2,'#e0e8f0'); px(54,10,10,3,'#ffffff'); px(56,12,6,2,'#e0e8f0');
  ctx.globalAlpha=1;
  px(14,4,36,3,'#e0e8f0'); px(10,7,44,4,'#f0f4f8'); px(8,11,48,6,'#ffffff');
  px(10,17,44,4,'#f0f4f8'); px(14,21,36,3,'#e0e8f0'); px(18,24,28,2,'#c8d4e0');
  px(12,3,6,4,'#ffffff'); px(22,2,8,5,'#ffffff'); px(34,2,8,5,'#ffffff'); px(46,3,6,4,'#ffffff');
  px(8,18,4,4,'#e0e8f0'); px(52,18,4,4,'#e0e8f0');
  px(24,12,5,5,'#1a1a22'); px(25,13,3,3,'#5cbce8'); px(26,14,1,1,'#ffffff');
  px(35,12,5,5,'#1a1a22'); px(36,13,3,3,'#5cbce8'); px(37,14,1,1,'#ffffff');
  px(28,19,8,1,'#5c7090'); px(30,20,4,1,'#788ca0');
  px(26,26,12,4,'#f0f4f8'); px(28,30,8,6,'#e0e8f0'); px(30,36,4,4,'#d0dce8');
  px(26,28,12,1,'#a8c0d8');
  ctx.globalAlpha=0.6;
  px(14,30,8,3,'#ffffff'); px(42,32,8,3,'#ffffff'); px(12,38,6,2,'#f0f4f8'); px(46,40,6,2,'#f0f4f8');
  ctx.globalAlpha=0.4;
  px(20,42,4,2,'#e0e8f0'); px(40,46,4,2,'#e0e8f0'); px(28,48,4,2,'#e0e8f0');
  ctx.globalAlpha=0.1;
  px(22,58,20,2,'#a8b8c8');
  ctx.globalAlpha=1;
};

PM_SPRITES.spectrelis = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  ctx.globalAlpha=0.4;
  px(8,2,10,4,'#553388'); px(46,2,10,4,'#553388'); px(20,0,24,4,'#442266');
  ctx.globalAlpha=0.6;
  px(14,4,36,4,'#3c1060'); px(12,8,40,4,'#2a0846');
  ctx.globalAlpha=1;
  px(18,8,28,4,'#2a0846'); px(14,12,36,6,'#1e0634'); px(12,18,40,10,'#1a0530');
  px(14,28,36,6,'#220a3c'); px(18,34,28,4,'#2a0846');
  px(22,14,2,14,'#aa44dd'); px(32,12,2,18,'#aa44dd'); px(40,16,2,12,'#8833bb');
  ctx.globalAlpha=0.6;
  px(21,12,4,4,'#dd88ff'); px(31,10,4,4,'#dd88ff');
  ctx.globalAlpha=1;
  px(28,20,8,6,'#cc0022'); px(30,22,4,3,'#ff3355'); px(31,22,2,1,'#ffccaa');
  ctx.globalAlpha=0.6;
  px(26,18,12,2,'#aa0022'); px(26,26,12,2,'#aa0022');
  ctx.globalAlpha=1;
  px(22,32,20,3,'#1a0530'); px(24,33,2,3,'#ffffee'); px(28,33,2,3,'#ffffee');
  px(34,33,2,3,'#ffffee'); px(38,33,2,3,'#ffffee');
  px(14,38,6,6,'#2a0846'); px(10,42,6,6,'#1e0634'); px(8,46,4,6,'#1a0530');
  px(8,50,2,4,'#552266'); px(12,50,2,4,'#552266');
  px(44,38,6,6,'#2a0846'); px(44,42,6,6,'#1e0634'); px(52,46,4,6,'#1a0530');
  px(50,50,2,4,'#552266'); px(54,50,2,4,'#552266');
  ctx.globalAlpha=0.5;
  px(18,50,28,3,'#2a0846'); px(20,54,24,3,'#1e0634');
  ctx.globalAlpha=0.3;
  px(14,58,36,4,'#3c1060');
  ctx.globalAlpha=1;
};

PM_SPRITES.putrefel = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(28,2,3,6,'#3a2010'); px(26,4,3,4,'#2a1608'); px(31,0,2,5,'#2a1608');
  px(32,4,6,3,'#5a5020'); px(38,2,3,3,'#3a3010');
  px(20,8,22,4,'#553322'); px(14,10,30,6,'#442218'); px(12,14,34,12,'#3a1e14');
  px(10,22,36,8,'#2e1810'); px(14,28,30,6,'#44201a'); px(18,32,22,4,'#553322');
  px(16,14,4,4,'#1a0808'); px(34,18,5,5,'#1a0808'); px(22,24,4,3,'#1a0808');
  ctx.globalAlpha=0.7;
  px(17,15,2,2,'#441010'); px(35,19,3,3,'#441010');
  ctx.globalAlpha=1;
  px(28,12,5,3,'#5a5020'); px(28,28,4,2,'#442055'); px(38,26,4,3,'#5a5020');
  ctx.globalAlpha=0.6;
  px(30,13,3,1,'#7a7040');
  ctx.globalAlpha=1;
  px(20,18,5,4,'#aa0022'); px(21,19,3,2,'#ff3355'); px(22,20,1,1,'#ffccaa');
  px(30,16,4,3,'#aa0022'); px(31,17,2,1,'#ff3355');
  px(22,26,14,2,'#1a0808'); px(24,25,2,1,'#1a0808');
  px(28,27,2,1,'#1a0808'); px(32,25,2,1,'#1a0808');
  px(22,36,16,4,'#2e1810'); px(20,40,20,6,'#1a0c08'); px(22,46,16,4,'#2e1810');
  px(14,36,8,3,'#3a1e14'); px(10,34,6,3,'#2e1810'); px(6,30,6,6,'#1a0c08');
  px(4,32,2,3,'#000000'); px(4,36,2,2,'#000000');
  px(38,38,6,3,'#3a1e14'); px(42,40,6,4,'#2e1810'); px(44,44,4,6,'#1a0c08');
  px(46,50,2,2,'#000000'); px(44,50,2,2,'#000000');
  px(22,50,6,8,'#1a0c08'); px(20,56,8,4,'#0e0604');
  px(34,50,6,8,'#1a0c08'); px(36,56,8,4,'#0e0604');
  ctx.globalAlpha=0.3;
  px(16,58,6,3,'#442055'); px(42,58,6,3,'#442055');
  ctx.globalAlpha=1;
};

PM_SPRITES.nihilium = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  ctx.globalAlpha=0.3;
  px(8,16,48,4,'#442277'); px(6,20,52,24,'#2a0846'); px(8,44,48,4,'#442277');
  px(12,14,40,2,'#3c1060'); px(12,48,40,2,'#3c1060');
  ctx.globalAlpha=1;
  ctx.globalAlpha=0.8;
  px(4,8,2,2,'#ffffff'); px(56,12,2,2,'#ffffff'); px(2,30,2,2,'#aaccff');
  px(60,32,2,2,'#aaccff'); px(6,52,2,2,'#ffffff'); px(54,54,2,2,'#ffffff');
  ctx.globalAlpha=0.5;
  px(10,4,1,1,'#ffffff'); px(50,6,1,1,'#ffffff'); px(4,56,1,1,'#ffffff');
  ctx.globalAlpha=1;
  px(20,16,24,4,'#000000'); px(16,18,32,6,'#000000'); px(12,22,40,8,'#000000');
  px(10,28,44,8,'#000000'); px(12,34,40,8,'#000000'); px(16,40,32,6,'#000000'); px(20,44,24,4,'#000000');
  px(12,20,4,4,'#0c0418'); px(48,20,4,4,'#0c0418'); px(48,40,4,4,'#0c0418'); px(12,40,4,4,'#0c0418');
  px(20,26,5,5,'#ffffff'); px(21,27,3,3,'#1a1a22'); px(22,28,1,1,'#ffffff');
  px(39,26,5,5,'#ffffff'); px(40,27,3,3,'#1a1a22'); px(41,28,1,1,'#ffffff');
  px(26,36,12,1,'#442277');
  ctx.globalAlpha=0.15;
  px(18,22,4,3,'#aa44dd'); px(20,25,2,2,'#dd88ff');
  ctx.globalAlpha=1;
  px(30,12,4,6,'#1a0530'); px(32,10,2,4,'#0c0418'); px(34,10,2,3,'#2a0846');
  ctx.globalAlpha=0.5;
  px(2,22,3,1,'#aa44dd'); px(58,22,3,1,'#aa44dd'); px(2,42,3,1,'#aa44dd'); px(58,42,3,1,'#aa44dd');
  ctx.globalAlpha=1;
};

PM_SPRITES.papiluxe = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(28,2,2,6,'#d4a020'); px(34,2,2,6,'#d4a020'); px(27,0,2,3,'#f0c040'); px(35,0,2,3,'#f0c040');
  px(26,8,12,4,'#d4a020'); px(24,10,16,4,'#c09018');
  px(25,11,4,4,'#1a1a22'); px(26,12,2,2,'#ffee44');
  px(35,11,4,4,'#1a1a22'); px(36,12,2,2,'#ffee44');
  px(30,14,4,18,'#a87810'); px(31,32,2,8,'#8a6008');
  px(30,18,4,1,'#6a4806'); px(30,22,4,1,'#6a4806'); px(30,26,4,1,'#6a4806'); px(30,30,4,1,'#6a4806');
  px(14,10,16,4,'#ffdd44'); px(10,12,20,6,'#f0c040'); px(6,14,24,8,'#d4a020');
  px(4,18,26,6,'#e8b030'); px(6,22,24,4,'#d4a020'); px(10,24,20,3,'#c09018'); px(14,26,16,2,'#a87810');
  px(16,16,2,2,'#ffffff'); px(15,17,4,1,'#ffffff'); px(17,15,1,4,'#ffffff');
  ctx.globalAlpha=0.6;
  px(14,15,2,2,'#ffffaa'); px(18,18,2,2,'#ffffaa');
  ctx.globalAlpha=1;
  px(4,16,3,4,'#ff8844');
  px(34,10,16,4,'#ffdd44'); px(34,12,20,6,'#f0c040'); px(34,14,24,8,'#d4a020');
  px(34,18,26,6,'#e8b030'); px(34,22,24,4,'#d4a020'); px(34,24,20,3,'#c09018'); px(34,26,16,2,'#a87810');
  px(46,16,2,2,'#ffffff'); px(45,17,4,1,'#ffffff'); px(47,15,1,4,'#ffffff');
  ctx.globalAlpha=0.6;
  px(44,15,2,2,'#ffffaa'); px(48,18,2,2,'#ffffaa');
  ctx.globalAlpha=1;
  px(57,16,3,4,'#ff8844');
  px(16,28,14,4,'#e8b030'); px(14,32,16,4,'#d4a020'); px(16,36,14,3,'#c09018'); px(18,38,10,2,'#a87810');
  px(20,32,2,2,'#ffffff'); px(19,33,4,1,'#ffffff');
  px(34,28,14,4,'#e8b030'); px(34,32,16,4,'#d4a020'); px(34,36,14,3,'#c09018'); px(36,38,10,2,'#a87810');
  px(42,32,2,2,'#ffffff'); px(41,33,4,1,'#ffffff');
  ctx.globalAlpha=0.5;
  px(2,8,2,2,'#ffee44'); px(60,10,2,2,'#ffee44'); px(4,44,2,2,'#ffee44'); px(58,42,2,2,'#ffee44');
  ctx.globalAlpha=0.1;
  px(24,58,16,2,'#d4a020');
  ctx.globalAlpha=1;
};

PM_SPRITES.solarion = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  px(2,24,4,3,'#ffdd44'); px(0,26,3,2,'#ffcc00');
  px(58,24,4,3,'#ffdd44'); px(61,26,3,2,'#ffcc00');
  px(4,10,4,3,'#ffdd44'); px(2,8,3,3,'#ffcc00');
  px(56,10,4,3,'#ffdd44'); px(59,8,3,3,'#ffcc00');
  px(4,40,4,3,'#ffdd44'); px(2,42,3,3,'#ffcc00');
  px(56,40,4,3,'#ffdd44'); px(59,42,3,3,'#ffcc00');
  px(28,0,4,4,'#ffcc00'); px(26,2,3,3,'#ffdd44'); px(33,2,3,3,'#ffdd44');
  px(18,6,28,4,'#ff9900'); px(12,8,40,6,'#ffaa22'); px(8,12,48,8,'#ffcc44');
  px(6,18,52,10,'#ffdd66'); px(8,26,48,8,'#ffcc44'); px(12,32,40,6,'#ffaa22'); px(18,36,28,4,'#ff9900');
  px(14,14,3,8,'#ff8800'); px(48,14,3,8,'#ff8800'); px(14,24,3,8,'#ff8800'); px(48,24,3,8,'#ff8800');
  px(22,10,3,4,'#ff8800'); px(40,10,3,4,'#ff8800'); px(22,32,3,4,'#ff8800'); px(40,32,3,4,'#ff8800');
  px(22,16,20,4,'#fff0aa'); px(20,20,24,10,'#ffe088'); px(22,30,20,4,'#ffcc66');
  px(24,20,4,4,'#1a1a22'); px(25,21,2,2,'#ffcc44');
  px(36,20,4,4,'#1a1a22'); px(37,21,2,2,'#ffcc44');
  px(30,26,4,3,'#ff8800'); px(31,27,2,1,'#1a1a22');
  px(28,30,8,2,'#d48820'); px(30,32,4,1,'#d48820');
  px(22,38,20,6,'#ffaa22'); px(20,44,24,6,'#ff9900'); px(22,50,20,4,'#d48820');
  px(20,42,6,10,'#ff9900'); px(18,50,8,6,'#d48820'); px(18,54,10,4,'#b06810');
  px(38,42,6,10,'#ff9900'); px(38,50,8,6,'#d48820'); px(36,54,10,4,'#b06810');
  px(28,54,8,4,'#b06810');
  px(44,40,8,3,'#ff9900'); px(50,38,6,4,'#ffaa22'); px(54,36,4,4,'#ffcc44');
  px(56,32,4,4,'#ffdd44'); px(58,30,3,3,'#ffee66'); px(57,28,3,3,'#ffffaa');
};

PM_SPRITES.astraflore = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  ctx.globalAlpha=0.9;
  px(4,6,2,2,'#ffffff'); px(58,8,2,2,'#ffffff'); px(6,50,2,2,'#ffffff'); px(56,52,2,2,'#ffffff');
  ctx.globalAlpha=0.6;
  px(10,2,1,1,'#ffffff'); px(52,4,1,1,'#ffffff'); px(2,28,1,1,'#ffccff'); px(60,34,1,1,'#ffccff');
  ctx.globalAlpha=1;
  ctx.globalAlpha=0.3;
  px(10,10,44,4,'#ffdd44'); px(6,14,52,30,'#ffcc88'); px(10,44,44,4,'#ffdd44');
  ctx.globalAlpha=0.4;
  px(12,12,40,2,'#fff0aa'); px(12,44,40,2,'#fff0aa');
  ctx.globalAlpha=1;
  px(28,4,8,6,'#ffccaa'); px(30,2,4,6,'#ffddcc'); px(31,0,2,4,'#ffffff');
  px(28,38,8,6,'#ffccaa'); px(30,42,4,6,'#ffddcc'); px(31,46,2,4,'#ffffff');
  px(6,28,6,8,'#ffccaa'); px(4,30,6,4,'#ffddcc'); px(0,31,4,2,'#ffffff');
  px(52,28,6,8,'#ffccaa'); px(54,30,6,4,'#ffddcc'); px(60,31,4,2,'#ffffff');
  px(12,12,6,6,'#ffccaa'); px(8,8,6,6,'#ffddcc');
  px(46,12,6,6,'#ffccaa'); px(50,8,6,6,'#ffddcc');
  px(12,46,6,6,'#ffccaa'); px(8,50,6,6,'#ffddcc');
  px(46,46,6,6,'#ffccaa'); px(50,50,6,6,'#ffddcc');
  px(22,14,20,4,'#ffaa44'); px(18,18,28,6,'#ffbb66'); px(14,22,32,12,'#ffcc88');
  px(18,34,28,6,'#ffbb66'); px(22,40,20,4,'#ffaa44');
  px(22,20,20,16,'#fff0aa'); px(26,22,12,12,'#ffffdd'); px(28,24,8,8,'#ffffff');
  px(22,24,4,4,'#1a2a44'); px(23,25,2,2,'#aaccff'); px(24,26,1,1,'#ffffff');
  px(38,24,4,4,'#1a2a44'); px(39,25,2,2,'#aaccff'); px(40,26,1,1,'#ffffff');
  px(31,20,2,2,'#ffcc44'); px(30,21,4,1,'#ffcc44'); px(32,19,1,4,'#ffdd66');
  px(27,32,10,1,'#d49050'); px(29,33,6,1,'#b87040');
  px(28,42,8,4,'#88c8ff'); px(26,46,12,4,'#6aa8e8'); px(24,50,16,4,'#5098d8');
  px(26,54,12,4,'#4088c8'); px(30,58,8,3,'#3078b8');
  ctx.globalAlpha=0.5;
  px(30,44,4,10,'#aaddff');
  ctx.globalAlpha=0.8;
  px(18,54,1,1,'#ffff88'); px(44,56,1,1,'#ffff88'); px(20,60,1,1,'#ffccff'); px(42,60,1,1,'#ffccff');
  ctx.globalAlpha=1;
};

// Helper universel pour dessiner un PokePom
function drawPokePom(canvas, pokepomId) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  const fn = PM_SPRITES[pokepomId];
  if (fn) fn(ctx);
}


/* ═══════════════════════════════════════════════════════════════════════════
   5. STOCKAGE (localStorage temporaire)
   ═══════════════════════════════════════════════════════════════════════════ */

// ────────────────────────────────────────────────────────────────────────
// Stockage Firebase avec cache mémoire (pattern identique au clicker)
// ────────────────────────────────────────────────────────────────────────
// _pmCache      : copie en mémoire du player state (synchrone)
// _pmLoaded     : true quand Firebase a répondu (évite d'écraser avec null)
// _pmSaveTimer  : debounce des écritures Firebase (évite le spam)
// ────────────────────────────────────────────────────────────────────────

let _pmCache = null;
let _pmLoaded = false;
let _pmLoadedForCode = null;  // code de l'utilisateur pour lequel les données sont chargées
let _pmSaveTimer = null;

function pmPath() { return 'pommon/' + state.code; }

// Charge depuis Firebase (appelé une fois au démarrage / navigation)
// Garantit que toutes les propriétés attendues existent
// (Firebase ne stocke pas les [] vides → au rechargement certaines clés manquent)
function pmNormalizePlayer(data) {
  if (!data) return null;
  // Arrays que Firebase peut transformer en objets indexés ou supprimer s'ils sont vides
  if (data.collection && !Array.isArray(data.collection)) {
    data.collection = Object.values(data.collection);
  }
  if (!Array.isArray(data.collection)) data.collection = [];
  if (data.team && !Array.isArray(data.team)) {
    data.team = Object.values(data.team);
  }
  if (!Array.isArray(data.team)) data.team = [];
  if (data.badges && !Array.isArray(data.badges)) {
    data.badges = Object.values(data.badges);
  }
  if (!Array.isArray(data.badges)) data.badges = [];
  // Valeurs numériques par défaut
  data.dailyWildCount   = data.dailyWildCount   || 0;
  data.dailyGymWins     = data.dailyGymWins     || 0;
  data.dailyLeagueCount = data.dailyLeagueCount || 0;
  data.leagueBestScore  = data.leagueBestScore  || 0;
  data.totalCaptures    = data.totalCaptures    || 0;
  data.totalBattlesWon  = data.totalBattlesWon  || 0;
  data.lastActiveDate   = data.lastActiveDate   || new Date().toISOString().slice(0,10);
  return data;
}

async function pmLoadFromFirebase() {
  if (typeof dbGet !== 'function' || !state || !state.code) {
    _pmCache = null;
    _pmLoaded = true;
    return null;
  }
  try {
    const data = await dbGet(pmPath());
    _pmCache = data ? pmNormalizePlayer(data) : null;
  } catch(e) {
    console.error('[pokepom] load error', e);
    _pmCache = null;
  }
  _pmLoaded = true;
  return _pmCache;
}

// Sauvegarde avec debounce (toutes les 400ms max — évite le spam sur actions rapides)
function pmScheduleSave() {
  if (!_pmLoaded || !_pmCache) return;
  if (_pmSaveTimer) clearTimeout(_pmSaveTimer);
  _pmSaveTimer = setTimeout(async () => {
    _pmSaveTimer = null;
    if (typeof dbSet !== 'function' || !state || !state.code) return;
    try {
      await dbSet(pmPath(), _pmCache);
    } catch(e) {
      console.error('[pokepom] save error', e);
    }
  }, 400);
}

// Sauvegarde immédiate (utilisée aux fins de combat pour garantir la persistance)
async function pmSaveNow() {
  if (!_pmLoaded || !_pmCache) return;
  if (_pmSaveTimer) { clearTimeout(_pmSaveTimer); _pmSaveTimer = null; }
  if (typeof dbSet !== 'function' || !state || !state.code) return;
  try {
    await dbSet(pmPath(), _pmCache);
  } catch(e) {
    console.error('[pokepom] saveNow error', e);
  }
}

// API synchrone (le reste du code PokePom n'a pas à changer)
function pmGet(key) {
  if (!_pmCache) return null;
  if (key === 'player') return _pmCache;
  return _pmCache[key] !== undefined ? _pmCache[key] : null;
}

function pmSet(key, value) {
  if (!_pmCache) _pmCache = {};
  if (key === 'player') {
    _pmCache = value;
  } else {
    _pmCache[key] = value;
  }
  pmScheduleSave();
}

function pmGetPlayer() {
  return _pmCache || null;
}

function pmSavePlayer(data) {
  _pmCache = data;
  pmScheduleSave();
}

// Leaderboard Ligue (même pattern que snake_lb / g2048_lb)
async function pmSaveLeagueLb(score) {
  if (score <= 0 || typeof dbGet !== 'function' || typeof dbSet !== 'function') return;
  if (!state || !state.code) return;
  const path = 'pommon_league_lb/' + state.code;
  try {
    const existing = await dbGet(path);
    if (!existing || score > existing.score) {
      await dbSet(path, {
        name: state.name,
        code: state.code,
        score: score,
        date: new Date().toISOString()
      });
    }
  } catch(e) { console.error('[pokepom] saveLeagueLb error', e); }
}

function pmInitPlayer(starterId) {
  const today = new Date().toISOString().slice(0,10);
  const starterInstance = pmCreatePokePomInstance(starterId, 1);
  const player = {
    hasAccount: true,
    starterId: starterId,
    collection: [starterInstance],  // Liste d'instances (avec XP, niveau)
    team: [starterInstance.uid],    // UIDs des PokePoms d'équipe
    badges: [],                     // Liste des types d'arènes battues
    dailyWildCount: 0,
    dailyGymWins: 0,
    dailyLeagueCount: 0,
    lastActiveDate: today,
    leagueBestScore: 0,
    totalCaptures: 1,
    totalBattlesWon: 0
  };
  pmSavePlayer(player);
  return player;
}

function pmCreatePokePomInstance(pokepomId, level = 1, xp = 0) {
  const base = PM_DEX[pokepomId];
  return {
    uid: 'pm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    pokepomId: pokepomId,
    nickname: base.name,
    level: level,
    xp: xp,
    capturedAt: new Date().toISOString()
  };
}

// Calcule les stats réelles d'un PokePom en tenant compte du niveau
function pmGetStats(instance) {
  const base = PM_DEX[instance.pokepomId];
  const mult = 1 + (instance.level - 1) * PM_LEVEL_BONUS;
  return {
    hp: Math.floor(base.hp * mult),
    atk: Math.floor(base.atk * mult),
    def: Math.floor(base.def * mult),
    vit: Math.floor(base.vit * mult)
  };
}

// Check et reset quotidien
function pmCheckDailyReset(player) {
  const today = new Date().toISOString().slice(0,10);
  if (player.lastActiveDate !== today) {
    player.dailyWildCount = 0;
    player.dailyGymWins = 0;
    player.dailyLeagueCount = 0;
    player.lastActiveDate = today;
    pmSavePlayer(player);
  }
  return player;
}

// Ajout d'XP et montée de niveau
function pmGainXP(instance, amount) {
  instance.xp += amount;
  let leveledUp = false;
  while (instance.level < 10 && instance.xp >= PM_XP_TABLE[instance.level]) {
    instance.xp -= PM_XP_TABLE[instance.level];
    instance.level++;
    leveledUp = true;
  }
  if (instance.level >= 10) instance.xp = 0;
  return leveledUp;
}

// Mettre à jour une instance dans la collection
function pmUpdateInstance(player, updatedInstance) {
  const idx = player.collection.findIndex(p => p.uid === updatedInstance.uid);
  if (idx !== -1) {
    player.collection[idx] = updatedInstance;
    pmSavePlayer(player);
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
   6. MOTEUR DE COMBAT
   ═══════════════════════════════════════════════════════════════════════════ */

// Crée un combattant (prêt pour le combat)
function pmCreateFighter(instance, statMultiplier = 1.0) {
  const stats = pmGetStats(instance);
  const base = PM_DEX[instance.pokepomId];
  const moves = getMoveset(instance.pokepomId);
  return {
    uid: instance.uid,
    instance: instance,
    pokepomId: instance.pokepomId,
    name: instance.nickname || base.name,
    type: base.type,
    level: instance.level,
    maxHp: stats.hp,
    hp: stats.hp,
    atk: Math.floor(stats.atk * statMultiplier),
    def: Math.floor(stats.def * statMultiplier),
    vit: Math.floor(stats.vit * statMultiplier),
    baseAtk: Math.floor(stats.atk * statMultiplier),
    baseDef: Math.floor(stats.def * statMultiplier),
    baseVit: Math.floor(stats.vit * statMultiplier),
    stages: { atk: 0, def: 0, vit: 0 },
    moves: moves.map(m => ({ ...m, currentPp: m.pp })),
    burnTurns: 0,
    ko: false
  };
}

// Applique les crans aux stats
function pmApplyStages(fighter) {
  fighter.atk = Math.floor(fighter.baseAtk * PM_STAGE_MULT[fighter.stages.atk + 3]);
  fighter.def = Math.floor(fighter.baseDef * PM_STAGE_MULT[fighter.stages.def + 3]);
  fighter.vit = Math.floor(fighter.baseVit * PM_STAGE_MULT[fighter.stages.vit + 3]);
}

// Calcule les dégâts d'un move
function pmCalcDamage(attacker, defender, move) {
  if (move.power === 0) return 0;
  const stab = (move.type === attacker.type) ? PM_STAB : 1.0;
  // Lecture : PM_WEAK[défenseur][typeAttaque] = multiplicateur subi par le défenseur
  const typeMod = (PM_WEAK[defender.type] && PM_WEAK[defender.type][move.type]) || 1.0;
  const baseDmg = (attacker.atk * move.power / defender.def) / 3;
  const dmg = Math.floor(baseDmg * stab * typeMod);
  return Math.max(1, dmg);
}

// Effectiveness label
function pmEffectivenessLabel(moveType, defenderType) {
  // Lecture : PM_WEAK[défenseur][typeAttaque]
  const mod = (PM_WEAK[defenderType] && PM_WEAK[defenderType][moveType]) || 1.0;
  if (mod >= 1.3) return 'C\'est super efficace !';
  if (mod <= 0.7) return 'C\'est peu efficace…';
  return '';
}

// Exécute un move et retourne les événements du tour
function pmExecuteMove(attacker, defender, move) {
  const events = [];
  events.push({ type:'use_move', attacker: attacker.name, move: move.name, moveType: move.type });

  // Jet de précision
  const roll = Math.random() * 100;
  if (roll > move.accuracy) {
    events.push({ type:'miss', attacker: attacker.name });
    // Consomme PP même si raté
    if (move.id !== 'lutte') move.currentPp--;
    return events;
  }

  // Consomme PP
  if (move.id !== 'lutte') move.currentPp--;

  // Exécution selon catégorie
  if (move.category === 'attack') {
    const dmg = pmCalcDamage(attacker, defender, move);
    defender.hp = Math.max(0, defender.hp - dmg);
    events.push({ type:'damage', target: defender.name, amount: dmg });

    const effLabel = pmEffectivenessLabel(move.type, defender.type);
    if (effLabel) events.push({ type:'effectiveness', label: effLabel });

    // Recul (Lutte)
    if (move.recoilPct) {
      const recoil = Math.floor(attacker.maxHp * move.recoilPct);
      attacker.hp = Math.max(0, attacker.hp - recoil);
      events.push({ type:'recoil', target: attacker.name, amount: recoil });
    }

    // Self-heal (Brise Vitale)
    if (move.selfHealPct) {
      const heal = Math.floor(attacker.maxHp * move.selfHealPct);
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
      events.push({ type:'self_heal', target: attacker.name, amount: heal });
    }

    // Brûlure
    if (move.burnChance && Math.random() < move.burnChance) {
      if (defender.burnTurns === 0) {
        defender.burnTurns = PM_BURN_DURATION;
        events.push({ type:'burn_applied', target: defender.name });
      }
    }

    // Effet secondaire
    if (move.sideEffect && move.chance && Math.random() < move.chance) {
      if (move.sideEffect === 'debuff_def') {
        if (defender.stages.def > -3) {
          defender.stages.def--;
          pmApplyStages(defender);
          events.push({ type:'stage', target: defender.name, stat:'DEF', dir:-1 });
        }
      } else if (move.sideEffect === 'buff_atk') {
        if (attacker.stages.atk < 3) {
          attacker.stages.atk++;
          pmApplyStages(attacker);
          events.push({ type:'stage', target: attacker.name, stat:'ATK', dir:1 });
        }
      }
    }

    // KO check
    if (defender.hp === 0) {
      defender.ko = true;
      events.push({ type:'ko', target: defender.name });
    }
  } else if (move.category === 'heal') {
    const heal = Math.floor(attacker.maxHp * move.healPct);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
    events.push({ type:'heal', target: attacker.name, amount: heal });
  } else if (move.category === 'buff') {
    if (attacker.stages[move.stat] < 3) {
      attacker.stages[move.stat] += move.stages;
      if (attacker.stages[move.stat] > 3) attacker.stages[move.stat] = 3;
      pmApplyStages(attacker);
      events.push({ type:'stage', target: attacker.name, stat: move.stat.toUpperCase(), dir: move.stages });
    } else {
      events.push({ type:'stat_max', target: attacker.name, stat: move.stat.toUpperCase() });
    }
  } else if (move.category === 'debuff') {
    if (defender.stages[move.stat] > -3) {
      defender.stages[move.stat] += move.stages;
      if (defender.stages[move.stat] < -3) defender.stages[move.stat] = -3;
      pmApplyStages(defender);
      events.push({ type:'stage', target: defender.name, stat: move.stat.toUpperCase(), dir: move.stages });
    } else {
      events.push({ type:'stat_min', target: defender.name, stat: move.stat.toUpperCase() });
    }
  }

  return events;
}

// Applique la brûlure en fin de tour
function pmApplyEndOfTurnEffects(fighter) {
  const events = [];
  if (fighter.burnTurns > 0 && !fighter.ko) {
    const dmg = Math.floor(fighter.maxHp * PM_BURN_DAMAGE_PCT);
    fighter.hp = Math.max(0, fighter.hp - dmg);
    events.push({ type:'burn_damage', target: fighter.name, amount: dmg });
    fighter.burnTurns--;
    if (fighter.burnTurns === 0) {
      events.push({ type:'burn_end', target: fighter.name });
    }
    if (fighter.hp === 0) {
      fighter.ko = true;
      events.push({ type:'ko', target: fighter.name });
    }
  }
  return events;
}

// Vérifie si le fighter n'a plus aucun PP
function pmHasNoPP(fighter) {
  return fighter.moves.every(m => m.currentPp <= 0);
}

// Move Lutte
function pmGetLutte() {
  return { ...PM_MOVES.lutte, currentPp: 99 };
}

// Effectue un tour de combat complet
function pmRunTurn(attacker, defender, attackerMoveIdx, defenderMoveIdx) {
  let attackerMove = attacker.moves[attackerMoveIdx];
  let defenderMove = defender.moves[defenderMoveIdx];

  // Lutte si plus de PP
  if (pmHasNoPP(attacker)) attackerMove = pmGetLutte();
  if (pmHasNoPP(defender)) defenderMove = pmGetLutte();

  // Déterminer qui commence
  let first = attacker, firstMove = attackerMove, second = defender, secondMove = defenderMove;
  if (defenderMove.priority && !attackerMove.priority) {
    first = defender; firstMove = defenderMove; second = attacker; secondMove = attackerMove;
  } else if (attackerMove.priority && !defenderMove.priority) {
    // attacker reste premier (déjà)
  } else if (attacker.vit === defender.vit) {
    if (Math.random() < 0.5) {
      first = defender; firstMove = defenderMove; second = attacker; secondMove = attackerMove;
    }
  } else if (defender.vit > attacker.vit) {
    first = defender; firstMove = defenderMove; second = attacker; secondMove = attackerMove;
  }

  const allEvents = [];
  // Premier
  const ev1 = pmExecuteMove(first, second, firstMove);
  allEvents.push(...ev1);
  // Second attaque seulement si pas KO
  if (!second.ko) {
    const ev2 = pmExecuteMove(second, first, secondMove);
    allEvents.push(...ev2);
  }
  // Fin de tour
  allEvents.push(...pmApplyEndOfTurnEffects(attacker));
  allEvents.push(...pmApplyEndOfTurnEffects(defender));

  return allEvents;
}


/* ═══════════════════════════════════════════════════════════════════════════
   7. IA ADVERSAIRE
   ═══════════════════════════════════════════════════════════════════════════ */

function pmAIChooseMove(self, opponent) {
  // Filtrer les moves avec PP
  const availableIdxs = [];
  self.moves.forEach((m, i) => { if (m.currentPp > 0) availableIdxs.push(i); });

  // Plus de PP → Lutte (géré ailleurs)
  if (availableIdxs.length === 0) return 0;

  // Catégoriser les moves
  const strongAttacks = [];
  const mediumAttacks = [];
  const utilityMoves = [];

  availableIdxs.forEach(i => {
    const m = self.moves[i];
    if (m.category === 'attack') {
      if (m.power >= 70) strongAttacks.push(i);
      else mediumAttacks.push(i);
    } else {
      utilityMoves.push(i);
    }
  });

  // Distribution : 60% fort, 30% moyen, 10% utilitaire
  const roll = Math.random();

  // Si low HP, 40% chance de heal si dispo
  if (self.hp < self.maxHp * 0.35) {
    const healMove = availableIdxs.find(i => self.moves[i].category === 'heal');
    if (healMove !== undefined && Math.random() < 0.4) return healMove;
  }

  if (roll < 0.6 && strongAttacks.length > 0) {
    return strongAttacks[Math.floor(Math.random() * strongAttacks.length)];
  } else if (roll < 0.9 && mediumAttacks.length > 0) {
    return mediumAttacks[Math.floor(Math.random() * mediumAttacks.length)];
  } else if (utilityMoves.length > 0) {
    return utilityMoves[Math.floor(Math.random() * utilityMoves.length)];
  }

  // Fallback
  const allAttacks = [...strongAttacks, ...mediumAttacks];
  if (allAttacks.length > 0) return allAttacks[Math.floor(Math.random() * allAttacks.length)];
  return availableIdxs[0];
}


/* ═══════════════════════════════════════════════════════════════════════════
   8. GESTION ÉQUIPE & COLLECTION
   ═══════════════════════════════════════════════════════════════════════════ */

function pmGetTeam(player) {
  return player.team.map(uid => player.collection.find(p => p.uid === uid)).filter(Boolean);
}

function pmSetTeam(player, uids) {
  player.team = uids.slice(0, 3);
  pmSavePlayer(player);
}

function pmAddToCollection(player, instance) {
  player.collection.push(instance);
  player.totalCaptures = (player.totalCaptures || 0) + 1;
  pmSavePlayer(player);
}


/* ═══════════════════════════════════════════════════════════════════════════
   9. COMBATS SAUVAGES
   ═══════════════════════════════════════════════════════════════════════════ */

function pmGenerateWildEncounter() {
  const roll = Math.random() * 100;
  let acc = 0;
  let type = null;
  // Choix du type selon rareté
  for (const t of PM_TYPES) {
    acc += PM_ENCOUNTER_RATES[t];
    if (roll < acc) { type = t; break; }
  }
  if (!type) type = 'plante';

  // Liste des PokePoms de ce type
  const candidates = PM_DEX_IDS.filter(id => PM_DEX[id].type === type);
  // Chance ultra-rare de légendaire (si type ombre ou lumière, 10% que ce soit le légendaire)
  const legends = candidates.filter(id => PM_DEX[id].legendary);
  let chosen;
  if (legends.length > 0 && Math.random() < 0.1) {
    chosen = legends[Math.floor(Math.random() * legends.length)];
  } else {
    const nonLegends = candidates.filter(id => !PM_DEX[id].legendary);
    chosen = nonLegends[Math.floor(Math.random() * nonLegends.length)] || candidates[0];
  }

  // Niveau du sauvage : basé sur niveau moyen de l'équipe, ±1
  const player = pmGetPlayer();
  const team = pmGetTeam(player);
  const avgLvl = team.length > 0 ? Math.floor(team.reduce((s,p) => s+p.level, 0) / team.length) : 1;
  const wildLvl = Math.max(1, Math.min(10, avgLvl + (Math.floor(Math.random() * 3) - 1)));
  return pmCreatePokePomInstance(chosen, wildLvl);
}

function pmAttemptCapture() {
  return Math.random() < PM_CAPTURE_RATE;
}


/* ═══════════════════════════════════════════════════════════════════════════
   10. ARÈNES
   ═══════════════════════════════════════════════════════════════════════════ */

const PM_GYMS = [
  { id:'plante',     name:'Arène Plante',     champion:'sylvagor',   championName:'Champion Sylvagor',     order:1 },
  { id:'eau',        name:'Arène Eau',        champion:'abyssale',   championName:'Championne Abyssale',    order:2 },
  { id:'feu',        name:'Arène Feu',        champion:'magmaturne', championName:'Champion Magmaturne',   order:3 },
  { id:'electrique', name:'Arène Électrique', champion:'raispore',   championName:'Champion Raispore',     order:4 },
  { id:'air',        name:'Arène Air',        champion:'cyclonin',   championName:'Champion Cyclonin',     order:5 },
  { id:'ombre',      name:'Arène Ombre',      champion:'putrefel',   championName:'Champion Putréfel',     order:6 },
  { id:'lumiere',    name:'Arène Lumière',    champion:'solarion',   championName:'Champion Solarion',     order:7 }
];

function pmGetGym(id) {
  return PM_GYMS.find(g => g.id === id);
}

function pmGenerateGymChampion(gym) {
  // Champion au niveau 7, stats boostées
  const lvl = 7;
  const instance = pmCreatePokePomInstance(gym.champion, lvl);
  return instance;
}


/* ═══════════════════════════════════════════════════════════════════════════
   11. LIGUE POMMON
   ═══════════════════════════════════════════════════════════════════════════ */

function pmGenerateLeagueOpponent(roundNum) {
  // Niveau progressif : round 1 = 5, +1 par round, max 10
  const lvl = Math.min(10, 4 + roundNum);
  const chosen = PM_DEX_IDS[Math.floor(Math.random() * PM_DEX_IDS.length)];
  return pmCreatePokePomInstance(chosen, lvl);
}


/* ═══════════════════════════════════════════════════════════════════════════
   12. INTERFACE
   ═══════════════════════════════════════════════════════════════════════════ */

// ── État UI PokePom ──
let _pmView = 'home'; // home, collection, team, info, wild, gym, gymPick, league, battle, starter
let _pmBattleState = null; // État du combat en cours
let _pmPendingGym = null; // Arène sélectionnée en attente du choix du combattant

// Injection des styles CSS
function pmInjectStyles() {
  if (document.getElementById('pokepom-styles')) return;
  const style = document.createElement('style');
  style.id = 'pokepom-styles';
  style.textContent = `
    /* ═══ POMMON STYLES ═══ */
    .pm-wrap { display:flex; flex-direction:column; gap:20px; }
    .pm-header { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
    .pm-title { font-size:1.4rem; font-weight:800; letter-spacing:-.5px; }
    .pm-sub { font-size:.85rem; color:var(--muted); }

    .pm-tabs { display:flex; gap:6px; background:var(--surface2); border-radius:10px; padding:4px; flex-wrap:wrap; }
    .pm-tab { background:transparent; border:none; border-radius:8px; padding:8px 14px; font-family:'Syne',sans-serif; font-size:.82rem; font-weight:600; color:var(--muted); cursor:pointer; transition:all .2s; }
    .pm-tab.active { background:var(--primary); color:#fff; }
    .pm-tab:not(.active):hover { background:var(--surface); color:var(--text); }

    .pm-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:20px; min-width:0; overflow:hidden; }

    .pm-stat-row { display:flex; gap:8px; margin:8px 0; }
    .pm-stat-box { background:var(--surface2); border-radius:8px; padding:8px 12px; flex:1; min-width:0; text-align:center; }
    .pm-stat-label { font-size:.65rem; font-weight:700; color:var(--muted); letter-spacing:.08em; text-transform:uppercase; }
    .pm-stat-val { font-family:'Space Mono',monospace; font-size:1rem; font-weight:700; color:var(--primary); margin-top:2px; }

    .pm-type-badge { display:inline-block; padding:2px 10px; border-radius:12px; font-size:.7rem; font-weight:700; letter-spacing:.03em; color:#fff; }

    .pm-sprite-wrap { display:flex; justify-content:center; align-items:center; }
    .pm-sprite { image-rendering:pixelated; image-rendering:crisp-edges; display:block; }
    .pm-sprite-sm { width:64px; height:64px; }
    .pm-sprite-md { width:96px; height:96px; }
    .pm-sprite-lg { width:160px; height:160px; }
    .pm-sprite-xl { width:200px; height:200px; }

    .pm-hp-bar { height:8px; background:var(--surface2); border-radius:4px; overflow:hidden; margin-top:4px; }
    .pm-hp-fill { height:100%; background:linear-gradient(90deg, #34c768 0%, #f5c842 60%, #EB5846 90%); transition:width .3s ease; }
    .pm-hp-fill.ok { background:#34c768; }
    .pm-hp-fill.mid { background:#f5c842; }
    .pm-hp-fill.low { background:#EB5846; }

    .pm-xp-bar { height:4px; background:var(--surface2); border-radius:2px; overflow:hidden; margin-top:4px; }
    .pm-xp-fill { height:100%; background:var(--blue); transition:width .3s ease; }

    .pm-starter-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:16px; }
    .pm-starter-card { background:var(--surface); border:2px solid var(--border); border-radius:var(--radius); padding:20px; cursor:pointer; transition:all .2s; display:flex; flex-direction:column; align-items:center; gap:10px; }
    .pm-starter-card:hover { border-color:var(--primary); transform:translateY(-2px); }
    .pm-starter-name { font-size:1.1rem; font-weight:800; }

    .pm-team-slots { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; }
    .pm-team-slot { background:var(--surface); border:2px solid var(--border); border-radius:var(--radius); padding:14px; display:flex; flex-direction:column; align-items:center; gap:6px; min-height:180px; cursor:pointer; transition:all .15s; }
    .pm-team-slot:hover { border-color:var(--primary); }
    .pm-team-slot.empty { background:var(--surface2); opacity:.5; }

    .pm-collection-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px; }
    .pm-collection-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:12px; display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer; transition:all .15s; min-width:0; }
    .pm-collection-card:hover { border-color:var(--primary); transform:translateY(-1px); }
    .pm-collection-card.in-team { border-color:var(--green); }
    .pm-collection-name { font-size:.88rem; font-weight:700; text-align:center; }
    .pm-collection-level { font-size:.72rem; color:var(--muted); font-family:'Space Mono',monospace; }
    .pm-coll-lore { font-size:.72rem; color:var(--text); opacity:.8; font-style:italic; text-align:center; line-height:1.35; padding:4px 6px; }
    .pm-coll-stats { display:grid; grid-template-columns:repeat(4, 1fr); gap:4px; width:100%; margin-top:6px; }
    .pm-coll-stat { background:var(--surface2); border-radius:6px; padding:4px 2px; display:flex; flex-direction:column; align-items:center; gap:1px; }
    .pm-coll-stat-k { font-size:.6rem; font-weight:700; color:var(--muted); letter-spacing:.05em; }
    .pm-coll-stat-v { font-size:.82rem; font-weight:700; font-family:'Space Mono',monospace; color:var(--text); }
    .pm-coll-moves { display:flex; flex-direction:column; gap:4px; width:100%; margin-top:6px; }
    .pm-coll-move { background:var(--surface2); border-radius:6px; padding:5px 8px; }
    .pm-coll-move-name { font-size:.74rem; font-weight:700; }
    .pm-coll-move-meta { font-size:.64rem; color:var(--muted); font-family:'Space Mono',monospace; margin-top:1px; }

    .pm-battle-arena { display:flex; flex-direction:column; gap:16px; }
    .pm-battle-field { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .pm-battle-side { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:14px; display:flex; flex-direction:column; align-items:center; gap:8px; }
    .pm-battle-side.active { border-color:var(--primary); box-shadow:0 0 16px var(--primary-glow); }
    .pm-battle-info { width:100%; }
    .pm-battle-name { font-size:.95rem; font-weight:700; text-align:center; }
    .pm-battle-level { font-size:.7rem; color:var(--muted); text-align:center; font-family:'Space Mono',monospace; }
    .pm-battle-hp-text { font-family:'Space Mono',monospace; font-size:.75rem; text-align:right; margin-top:4px; color:var(--muted); }
    .pm-battle-status { display:flex; gap:4px; flex-wrap:wrap; margin-top:4px; justify-content:center; }
    .pm-battle-status-icon { font-size:.9rem; }
    .pm-battle-status-badge { background:var(--surface2); border-radius:4px; padding:1px 6px; font-size:.65rem; font-weight:700; }

    .pm-battle-log { background:var(--surface2); border:1px solid var(--border); border-radius:var(--radius); padding:14px; font-size:.85rem; line-height:1.6; min-height:80px; max-height:160px; overflow-y:auto; }
    .pm-log-line { margin-bottom:4px; }
    .pm-log-line.eff { color:var(--yellow); font-weight:600; }
    .pm-log-line.miss { color:var(--muted); font-style:italic; }
    .pm-log-line.ko { color:var(--red); font-weight:700; }

    .pm-moves-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; }
    .pm-move-btn { background:var(--surface); border:2px solid var(--border); border-radius:var(--radius-sm); padding:12px; text-align:left; cursor:pointer; transition:all .15s; font-family:'Syne',sans-serif; color:var(--text); }
    .pm-move-btn:hover:not(:disabled) { border-color:var(--primary); transform:translateY(-1px); }
    .pm-move-btn:disabled { opacity:.4; cursor:not-allowed; }
    .pm-move-name { font-size:.88rem; font-weight:700; }
    .pm-move-info { font-size:.7rem; color:var(--muted); margin-top:2px; font-family:'Space Mono',monospace; }
    .pm-move-desc { font-size:.72rem; color:var(--text); opacity:.75; margin-top:6px; line-height:1.3; font-style:italic; }
    .pm-move-pp { color:var(--blue); }
    .pm-move-pp.low { color:var(--yellow); }
    .pm-move-pp.empty { color:var(--red); }

    .pm-switch-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px; }
    .pm-switch-btn { background:var(--surface); border:2px solid var(--border); border-radius:var(--radius-sm); padding:10px; display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer; transition:all .15s; font-family:'Syne',sans-serif; color:var(--text); min-width:0; }
    .pm-switch-btn:not(:disabled):hover { border-color:var(--primary); transform:translateY(-1px); }
    .pm-switch-btn:disabled { opacity:.4; cursor:not-allowed; }

    .pm-gym-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px; }
    .pm-gym-card { background:var(--surface); border:2px solid var(--border); border-radius:var(--radius); padding:16px; display:flex; flex-direction:column; gap:8px; cursor:pointer; transition:all .15s; min-width:0; }
    .pm-gym-card:hover { border-color:var(--primary); transform:translateY(-1px); }
    .pm-gym-card.won { border-color:var(--green); background:rgba(52,199,104,0.06); }
    .pm-gym-name { font-size:1rem; font-weight:800; }
    .pm-gym-champion { font-size:.8rem; color:var(--muted); }

    .pm-daily-info { font-size:.78rem; color:var(--muted); background:var(--surface2); border-radius:8px; padding:8px 14px; }
    .pm-daily-info strong { color:var(--primary); }

    .pm-result-screen { display:flex; flex-direction:column; align-items:center; gap:16px; padding:30px 20px; text-align:center; }
    .pm-result-title { font-size:1.8rem; font-weight:800; letter-spacing:-1px; }
    .pm-result-title.win { color:var(--green); }
    .pm-result-title.lose { color:var(--red); }
    .pm-reward { font-family:'Space Mono',monospace; font-size:1.2rem; color:var(--primary); font-weight:700; }

    .pm-capture-prompt { display:flex; flex-direction:column; align-items:center; gap:14px; padding:20px; }

    .pm-quick-btns { display:flex; gap:10px; flex-wrap:wrap; }

    .pm-lvl-up-tag { font-size:.75rem; color:var(--yellow); font-weight:700; }

    @media (max-width: 600px) {
      .pm-starter-grid { grid-template-columns:1fr; }
      .pm-team-slots { grid-template-columns:1fr; }
      .pm-battle-field { grid-template-columns:1fr; }
      .pm-moves-grid { grid-template-columns:1fr; }
      .pm-gym-grid { grid-template-columns:1fr; }
    }
  `;
  document.head.appendChild(style);
}

// Injection de la page (le bouton sidenav est dans index.html)
function pmInjectUI() {
  // Page
  const mainContent = document.getElementById('main-content');
  if (mainContent && !document.getElementById('page-pokepom')) {
    const page = document.createElement('div');
    page.id = 'page-pokepom';
    page.className = 'page';
    page.style.maxWidth = '900px';
    mainContent.appendChild(page);

    // Masquer le bouton info flottant quand on quitte PomMon
    const observer = new MutationObserver(() => {
      const floatBtn = document.getElementById('pm-info-float');
      if (!floatBtn) return;
      floatBtn.style.display = page.classList.contains('active') ? 'flex' : 'none';
    });
    observer.observe(page, { attributes: true, attributeFilter: ['class'] });
  }
}

// Navigation vers PokePom (async pour pouvoir charger depuis Firebase)
async function pmGoTo(view) {
  // Stopper la map si on quitte la home
  if (typeof pmStopMap === 'function') pmStopMap();
  // Cacher toutes les pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Activer page pokepom
  const page = document.getElementById('page-pokepom');
  if (page) page.classList.add('active');
  // Activer le bouton sidenav
  document.querySelectorAll('.sidenav-item').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('snav-pokepom');
  if (btn) btn.classList.add('active');
  // Topbar title
  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = '🐾 PokePom';

  if (typeof _currentPage !== 'undefined') _currentPage = 'pokepom';
  if (typeof _mobileSidenavOpen !== 'undefined' && _mobileSidenavOpen && typeof closeMobileSidenav === 'function') closeMobileSidenav();

  _pmView = view;
  window.scrollTo(0, 0);

  // Détection de changement de compte (logout/login d'un autre user)
  if (_pmLoadedForCode && state && state.code && _pmLoadedForCode !== state.code) {
    _pmCache = null;
    _pmLoaded = false;
    _pmLoadedForCode = null;
  }

  // Charger depuis Firebase au premier accès
  if (!_pmLoaded) {
    // Afficher un loader le temps de la requête
    if (page) page.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);">Chargement de tes PokePoms…</div>';
    await pmLoadFromFirebase();
    if (state && state.code) _pmLoadedForCode = state.code;
  }

  pmRenderPage();
}

// Rendu principal selon l'état
function pmRenderPage() {
  const page = document.getElementById('page-pokepom');
  if (!page) return;

  // Vérifier si le joueur existe, sinon demander starter
  let player = pmGetPlayer();
  if (!player) {
    pmRenderStarterChoice(page);
    return;
  }

  // Garantir l'intégrité des données (arrays manquants, etc.)
  player = pmNormalizePlayer(player);

  // Check daily reset
  player = pmCheckDailyReset(player);

  switch (_pmView) {
    case 'home': pmRenderHome(page, player); break;
    case 'collection': pmRenderCollection(page, player); break;
    case 'info': pmRenderInfo(page, player); break;
    case 'team': pmRenderTeamManager(page, player); break;
    case 'wild': pmRenderWildBattle(page, player); break;
    case 'gym': pmRenderGyms(page, player); break;
    case 'gymPick': pmRenderGymPick(page, player); break;
    case 'league': pmRenderLeague(page, player); break;
    case 'battle': pmRenderBattle(page, player); break;
    default: pmRenderHome(page, player);
  }

  // Bouton info flottant (visible sur toutes les vues sauf info, attaché au body pour survivre aux innerHTML)
  let floatBtn = document.getElementById('pm-info-float');
  if (_pmView === 'info') {
    if (floatBtn) floatBtn.style.display = 'none';
  } else {
    if (!floatBtn) {
      floatBtn = document.createElement('button');
      floatBtn.id = 'pm-info-float';
      floatBtn.onclick = () => pmGoTo('info');
      floatBtn.textContent = '📖';
      floatBtn.title = 'Infos & Guide';
      Object.assign(floatBtn.style, {
        position:'fixed', bottom:'24px', right:'24px', zIndex:'90',
        width:'48px', height:'48px', borderRadius:'50%',
        background:'var(--surface)', border:'2px solid var(--border)',
        boxShadow:'0 4px 16px rgba(0,0,0,0.3)',
        fontSize:'1.3rem', cursor:'pointer', display:'flex',
        alignItems:'center', justifyContent:'center',
        transition:'all .2s',
      });
      floatBtn.onmouseenter = () => { floatBtn.style.borderColor = 'var(--primary)'; floatBtn.style.transform = 'scale(1.1)'; };
      floatBtn.onmouseleave = () => { floatBtn.style.borderColor = 'var(--border)'; floatBtn.style.transform = 'scale(1)'; };
      document.body.appendChild(floatBtn);
    }
    floatBtn.style.display = 'flex';
  }
}

// ── Écran choix du starter ──
function pmRenderStarterChoice(page) {
  const starters = ['pomalis', 'flameche', 'goutapom'];
  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">🐾 Bienvenue dans PokePom !</div>
          <div class="pm-sub">Choisis ton premier compagnon pour débuter l'aventure.</div>
        </div>
      </div>
      <div class="pm-card">
        <div class="pm-starter-grid" id="pm-starter-grid"></div>
      </div>
    </div>
  `;
  const grid = document.getElementById('pm-starter-grid');
  starters.forEach(id => {
    const p = PM_DEX[id];
    const card = document.createElement('div');
    card.className = 'pm-starter-card';
    card.onclick = () => pmChooseStarter(id);
    card.innerHTML = `
      <canvas width="64" height="64" class="pm-sprite pm-sprite-xl" id="pm-starter-${id}"></canvas>
      <div class="pm-starter-name">${p.name}</div>
      <span class="pm-type-badge" style="background:${PM_TYPE_COLOR[p.type]}">${PM_TYPE_EMOJI[p.type]} ${PM_TYPE_LABEL[p.type]}</span>
      <div class="pm-stat-row" style="width:100%;">
        <div class="pm-stat-box"><div class="pm-stat-label">HP</div><div class="pm-stat-val">${p.hp}</div></div>
        <div class="pm-stat-box"><div class="pm-stat-label">ATK</div><div class="pm-stat-val">${p.atk}</div></div>
        <div class="pm-stat-box"><div class="pm-stat-label">DEF</div><div class="pm-stat-val">${p.def}</div></div>
        <div class="pm-stat-box"><div class="pm-stat-label">VIT</div><div class="pm-stat-val">${p.vit}</div></div>
      </div>
    `;
    grid.appendChild(card);
    setTimeout(() => drawPokePom(document.getElementById('pm-starter-' + id), id), 10);
  });
}

function pmChooseStarter(id) {
  pmInitPlayer(id);
  _pmView = 'home';
  pmRenderPage();
  if (typeof showToast === 'function') showToast(`${PM_DEX[id].name} a rejoint ton équipe !`, '🐾');
}

// ── Écran d'accueil PokePom ──
// ═══════════════════════════════════════════════════════════════════════════
// MAP WORLD — Style Pokémon Rubis/Saphir GBA
// ═══════════════════════════════════════════════════════════════════════════

const PM_MAP_W = 800;
const PM_MAP_H = 600;
const PM_TILE = 16;
const PM_ENCOUNTER_CHANCE = 0.12;
const PM_STEP_COOLDOWN = 130;

// Personnages disponibles
const PM_AVATARS = [
  { id: 'red',    label: 'Rouge',  body: '#c03c2c', hair: '#6a1a1a', skin: '#f5d0a0' },
  { id: 'blue',   label: 'Bleu',   body: '#2a5aaa', hair: '#1a2a5a', skin: '#f5d0a0' },
  { id: 'green',  label: 'Vert',   body: '#2a8a3a', hair: '#1a4a1a', skin: '#e8c890' },
  { id: 'purple', label: 'Violet', body: '#7a3aaa', hair: '#3a1a5a', skin: '#f0d0b0' },
  { id: 'gold',   label: 'Doré',   body: '#c0962c', hair: '#5a4010', skin: '#f5d8a8' },
];

const PM_ZONES = {
  elementaire: { label: 'Prairie Élémentaire', grass1: '#48a848', grass2: '#58c058', ground: '#78c850', types: ['plante','feu','eau','electrique'], legendRate: 0 },
  montagne:    { label: 'Mont des Vents',      grass1: '#688868', grass2: '#78a878', ground: '#90a880', types: ['air'], legendRate: 0.05 },
  lumiere:     { label: 'Plaine Lumineuse',     grass1: '#a8a848', grass2: '#c0c058', ground: '#c8c078', types: ['lumiere'], legendRate: 0.05 },
  grotte:      { label: 'Grotte du Crépuscule', grass1: '#585868', grass2: '#686880', ground: '#606068', types: ['ombre'], legendRate: 0.05 },
};

// Couleurs GBA
const GBA = {
  grass:     '#48a848', grassDark: '#389838', grassLight: '#58c058',
  path:      '#c8b07a', pathDark: '#b89858', pathLight: '#d8c898',
  water:     '#3890f8', waterDark: '#2870d0', waterLight: '#58a8f8',
  tree:      '#206020', treeTrunk: '#885830', treeLight: '#30a030',
  wall:      '#b0a090', wallDark: '#908070', wallLight: '#c8b8a8',
  roof:      '#c83030', roofGym: '#c83030', roofLigue: '#6838a8', roofCentre: '#3878c8',
  flower1:   '#f06060', flower2: '#f0a0a0', flower3: '#f0e060',
};

let _pmMapGrid = null;
let _pmMapPlayer = null;
let _pmMapLoop = null;
let _pmMapKeys = {};
let _pmMapLastStep = 0;
let _pmMapZoneGrid = null;
let _pmMapCanvas = null;
let _pmMapViewX = 0;
let _pmMapViewY = 0;
let _pmMapAvatar = 'red';
let _pmPendingZoneEncounter = null;

const PM_MAP_FULL_W = 50;
const PM_MAP_FULL_H = 38;

// Cell types: 0=grass, 1=tallgrass, 2=wall, 3=arene, 4=ligue, 5=centre, 6=water, 7=path, 8=tree, 9=flower

function pmBuildMap() {
  const W = PM_MAP_FULL_W, H = PM_MAP_FULL_H;
  const grid = [], zones = [];
  for (let r = 0; r < H; r++) { grid[r] = []; zones[r] = []; for (let c = 0; c < W; c++) { grid[r][c] = 0; zones[r][c] = null; } }

  // Murs extérieurs = arbres
  for (let c = 0; c < W; c++) { grid[0][c] = 8; grid[H-1][c] = 8; }
  for (let r = 0; r < H; r++) { grid[r][0] = 8; grid[r][W-1] = 8; }

  const cx = Math.floor(W / 2), cy = Math.floor(H / 2);

  // Chemins principaux (croix au centre)
  for (let c = 3; c < W - 3; c++) { grid[cy][c] = 7; grid[cy+1][c] = 7; }
  for (let r = 3; r < H - 3; r++) { grid[r][cx] = 7; grid[r][cx-1] = 7; }

  // Arène (3×4) au centre
  for (let dr = -2; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    grid[cy-3+dr][cx+dc] = 2;
  }
  grid[cy-1][cx] = 3; // porte

  // Centre PokePom (3×3) à gauche
  for (let dr = 0; dr <= 2; dr++) for (let dc = 0; dc <= 2; dc++) {
    grid[cy-3+dr][cx-6+dc] = 2;
  }
  grid[cy-1][cx-5] = 5; // porte

  // Ligue (3×3) à droite
  for (let dr = 0; dr <= 2; dr++) for (let dc = 0; dc <= 2; dc++) {
    grid[cy-3+dr][cx+4+dc] = 2;
  }
  grid[cy-1][cx+5] = 4; // porte

  // Dégager autour des bâtiments (chemin)
  for (let dc = -8; dc <= 8; dc++) { grid[cy-1][cx+dc] = grid[cy-1][cx+dc] || 7; if (grid[cy-1][cx+dc] === 0) grid[cy-1][cx+dc] = 7; }

  // Zones d'herbes hautes
  const zoneDefs = [
    { id: 'elementaire', startR: 2,    startC: 2,    rows: 14, cols: 20 },
    { id: 'montagne',    startR: 2,    startC: W-18, rows: 14, cols: 16 },
    { id: 'lumiere',     startR: H-14, startC: 2,    rows: 12, cols: 20 },
    { id: 'grotte',      startR: H-14, startC: W-18, rows: 12, cols: 16 },
  ];

  for (const z of zoneDefs) {
    for (let r = z.startR; r < z.startR + z.rows && r < H - 1; r++) {
      for (let c = z.startC; c < z.startC + z.cols && c < W - 1; c++) {
        if (grid[r][c] !== 0) continue;
        const rnd = Math.random();
        if (rnd < 0.55) grid[r][c] = 1;       // herbe haute
        else if (rnd < 0.80) grid[r][c] = 0;  // herbe courte
        else if (rnd < 0.88) grid[r][c] = 6;  // eau
        else if (rnd < 0.93) grid[r][c] = 9;  // fleur
        else grid[r][c] = 8;                   // arbre
        zones[r][c] = z.id;
      }
    }
  }

  // Arbres bordure entre zones et chemin
  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      if (grid[r][c] === 0 && !zones[r][c]) {
        // Herbe normale hors zone
        if (Math.random() < 0.04) grid[r][c] = 8;
        else if (Math.random() < 0.06) grid[r][c] = 9;
      }
    }
  }

  _pmMapGrid = grid;
  _pmMapZoneGrid = zones;
}

function pmGetZoneAt(r, c) {
  if (!_pmMapZoneGrid || r < 0 || c < 0 || r >= PM_MAP_FULL_H || c >= PM_MAP_FULL_W) return null;
  return _pmMapZoneGrid[r][c];
}

// ── Rencontre par zone ──
function pmGenerateZoneEncounter(zoneId) {
  const zone = PM_ZONES[zoneId];
  if (!zone) return pmGenerateWildEncounter();
  const type = zone.types[Math.floor(Math.random() * zone.types.length)];
  const candidates = PM_DEX_IDS.filter(id => PM_DEX[id].type === type);
  const legends = candidates.filter(id => PM_DEX[id].legendary);
  let chosen;
  if (legends.length > 0 && Math.random() < zone.legendRate) {
    chosen = legends[Math.floor(Math.random() * legends.length)];
  } else {
    const nonLegends = candidates.filter(id => !PM_DEX[id].legendary);
    chosen = nonLegends[Math.floor(Math.random() * nonLegends.length)] || candidates[0];
  }
  const player = pmGetPlayer();
  const team = pmGetTeam(player);
  const avgLvl = team.length > 0 ? Math.floor(team.reduce((s,p) => s+p.level, 0) / team.length) : 1;
  const wildLvl = Math.max(1, Math.min(10, avgLvl + (Math.floor(Math.random() * 3) - 1)));
  return pmCreatePokePomInstance(chosen, wildLvl);
}

// ── Rendu GBA ──
function pmRenderMap() {
  const canvas = _pmMapCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const T = PM_TILE;
  const viewCols = Math.ceil(canvas.width / T) + 1;
  const viewRows = Math.ceil(canvas.height / T) + 1;

  _pmMapViewX = Math.max(0, Math.min(PM_MAP_FULL_W - viewCols + 1, _pmMapPlayer.c - Math.floor(viewCols / 2)));
  _pmMapViewY = Math.max(0, Math.min(PM_MAP_FULL_H - viewRows + 1, _pmMapPlayer.r - Math.floor(viewRows / 2)));

  ctx.imageSmoothingEnabled = false;

  for (let vr = 0; vr < viewRows; vr++) {
    for (let vc = 0; vc < viewCols; vc++) {
      const mr = vr + _pmMapViewY, mc = vc + _pmMapViewX;
      if (mr < 0 || mr >= PM_MAP_FULL_H || mc < 0 || mc >= PM_MAP_FULL_W) continue;
      const cell = _pmMapGrid[mr][mc];
      const zone = _pmMapZoneGrid[mr][mc];
      const px = vc * T, py = vr * T;
      const seed = (mr * 97 + mc * 31) % 17;
      const zDef = zone ? PM_ZONES[zone] : null;

      // Base grass
      ctx.fillStyle = zDef ? zDef.ground : GBA.grass;
      ctx.fillRect(px, py, T, T);
      // Grass texture
      if (cell === 0 || cell === 1 || cell === 9) {
        ctx.fillStyle = (seed % 3 === 0) ? (zDef ? zDef.grass2 : GBA.grassLight) : (zDef ? zDef.grass1 : GBA.grassDark);
        ctx.fillRect(px + (seed % 5), py + (seed % 4), T - 2, T - 2);
      }

      if (cell === 1) {
        // Tall grass — motif en V GBA style
        ctx.fillStyle = zDef ? zDef.grass2 : GBA.grassLight;
        ctx.fillRect(px, py, T, T);
        ctx.strokeStyle = zDef ? zDef.grass1 : GBA.grassDark;
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const bx = px + 2 + i * 5 + (seed % 3);
          ctx.beginPath(); ctx.moveTo(bx, py + T - 1); ctx.lineTo(bx + 2, py + 4 + (seed % 4)); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bx + 4, py + T - 1); ctx.lineTo(bx + 2, py + 4 + (seed % 4)); ctx.stroke();
        }
      } else if (cell === 7) {
        // Path — sandy GBA style
        ctx.fillStyle = GBA.path;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = GBA.pathLight;
        ctx.fillRect(px + 1, py + 1, T - 2, 1);
        ctx.fillStyle = GBA.pathDark;
        ctx.fillRect(px + 1, py + T - 2, T - 2, 1);
      } else if (cell === 6) {
        // Water — animated
        ctx.fillStyle = GBA.water;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = GBA.waterLight;
        const waveOff = Math.floor(Date.now() / 400 + mc) % 4;
        ctx.fillRect(px + waveOff * 3, py + 4, 6, 2);
        ctx.fillRect(px + ((waveOff + 2) % 4) * 3, py + 10, 5, 2);
      } else if (cell === 8) {
        // Tree — GBA style round canopy + trunk
        ctx.fillStyle = zDef ? zDef.ground : GBA.grass;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = GBA.treeTrunk;
        ctx.fillRect(px + 6, py + 10, 4, 6);
        ctx.fillStyle = GBA.tree;
        ctx.beginPath();
        ctx.arc(px + T / 2, py + 6, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = GBA.treeLight;
        ctx.beginPath();
        ctx.arc(px + T / 2 - 2, py + 4, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (cell === 9) {
        // Flower
        const fc = [GBA.flower1, GBA.flower2, GBA.flower3][seed % 3];
        ctx.fillStyle = '#40a040';
        ctx.fillRect(px + 7, py + 8, 2, 6);
        ctx.fillStyle = fc;
        ctx.beginPath(); ctx.arc(px + 8, py + 7, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f8f870';
        ctx.fillRect(px + 7, py + 6, 2, 2);
      } else if (cell === 2) {
        // Wall / building body
        ctx.fillStyle = GBA.wall;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = GBA.wallLight;
        ctx.fillRect(px + 1, py + 1, T - 2, 1);
        ctx.fillStyle = GBA.wallDark;
        ctx.fillRect(px, py + T - 1, T, 1);
      } else if (cell === 3) {
        // Arène door
        ctx.fillStyle = GBA.path;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = GBA.roofGym;
        ctx.fillRect(px + 2, py, T - 4, T - 2);
        ctx.fillStyle = '#f8d878';
        ctx.fillRect(px + 5, py + 4, 6, 8);
        // Pokeball symbol
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(px + 8, py + 7, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = GBA.roofGym;
        ctx.beginPath(); ctx.arc(px + 8, py + 7, 3, 0, Math.PI); ctx.fill();
      } else if (cell === 4) {
        // Ligue door
        ctx.fillStyle = GBA.path;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = GBA.roofLigue;
        ctx.fillRect(px + 2, py, T - 4, T - 2);
        ctx.fillStyle = '#d0a0f0';
        ctx.fillRect(px + 5, py + 4, 6, 8);
        ctx.fillStyle = '#f8f870';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', px + 8, py + 11);
        ctx.textAlign = 'left';
      } else if (cell === 5) {
        // Centre door
        ctx.fillStyle = GBA.path;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = GBA.roofCentre;
        ctx.fillRect(px + 2, py, T - 4, T - 2);
        ctx.fillStyle = '#90d0f8';
        ctx.fillRect(px + 5, py + 4, 6, 8);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('+', px + 8, py + 11);
        ctx.textAlign = 'left';
      }

      // Building roofs (row above doors)
      if (mr > 0) {
        const above = _pmMapGrid[mr - 1] ? _pmMapGrid[mr - 1][mc] : -1;
        if (cell === 2 && mr >= 2) {
          // Check if this is the top row of a building
          const below = mr + 1 < PM_MAP_FULL_H ? _pmMapGrid[mr + 1][mc] : -1;
          if (below === 3 || below === 4 || below === 5) {
            // Roof row
            const roofColor = below === 3 ? GBA.roofGym : below === 4 ? GBA.roofLigue : GBA.roofCentre;
            ctx.fillStyle = roofColor;
            ctx.fillRect(px - 2, py, T + 4, T);
            ctx.fillStyle = roofColor;
            ctx.fillRect(px - 1, py + 2, T + 2, T - 2);
          }
        }
      }
    }
  }

  // Player sprite — GBA style
  const ppx = (_pmMapPlayer.c - _pmMapViewX) * T;
  const ppy = (_pmMapPlayer.r - _pmMapViewY) * T;
  const av = PM_AVATARS.find(a => a.id === _pmMapAvatar) || PM_AVATARS[0];
  const walkFrame = Math.floor(Date.now() / 200) % 2;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(ppx + T/2, ppy + T - 1, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
  // Body
  ctx.fillStyle = av.body;
  ctx.fillRect(ppx + 4, ppy + 6, 8, 7);
  // Head
  ctx.fillStyle = av.skin;
  ctx.fillRect(ppx + 4, ppy + 1, 8, 6);
  // Hair
  ctx.fillStyle = av.hair;
  ctx.fillRect(ppx + 3, ppy, 10, 3);
  ctx.fillRect(ppx + 3, ppy + 1, 2, 3);
  // Eyes
  ctx.fillStyle = '#000';
  ctx.fillRect(ppx + 6, ppy + 4, 1, 1);
  ctx.fillRect(ppx + 9, ppy + 4, 1, 1);
  // Legs (animated)
  ctx.fillStyle = av.body;
  if (walkFrame === 0) {
    ctx.fillRect(ppx + 5, ppy + 13, 3, 3);
    ctx.fillRect(ppx + 9, ppy + 13, 3, 3);
  } else {
    ctx.fillRect(ppx + 4, ppy + 13, 3, 3);
    ctx.fillRect(ppx + 10, ppy + 13, 3, 3);
  }

  // Zone label
  const currentZone = pmGetZoneAt(_pmMapPlayer.r, _pmMapPlayer.c);
  const currentCell = _pmMapGrid[_pmMapPlayer.r][_pmMapPlayer.c];
  let label = '';
  if (currentZone && PM_ZONES[currentZone]) label = PM_ZONES[currentZone].label;
  else if (currentCell === 3) label = '🏆 Arène';
  else if (currentCell === 4) label = '⭐ Ligue PokePom';
  else if (currentCell === 5) label = '🏥 Centre PokePom';
  const labelEl = document.getElementById('pm-map-zone-label');
  if (labelEl) labelEl.textContent = label || 'Pomel World';

  const hudEl = document.getElementById('pm-map-hud');
  if (hudEl) {
    const player = pmGetPlayer();
    hudEl.textContent = `🌿 ${Math.max(0, PM_DAILY_WILD - player.dailyWildCount)}/${PM_DAILY_WILD}`;
  }
}

// ── Mouvement & interactions ──
function pmMapTryMove(dr, dc) {
  const now = Date.now();
  if (now - _pmMapLastStep < PM_STEP_COOLDOWN) return;
  _pmMapLastStep = now;
  const nr = _pmMapPlayer.r + dr, nc = _pmMapPlayer.c + dc;
  if (nr < 0 || nr >= PM_MAP_FULL_H || nc < 0 || nc >= PM_MAP_FULL_W) return;
  const cell = _pmMapGrid[nr][nc];

  if (cell === 3) { pmStopMap(); pmGoTo('gym'); return; }
  if (cell === 4) { pmStopMap(); pmGoTo('league'); return; }
  if (cell === 5) { pmStopMap(); _pmShowCentreMenu(); return; }
  if (cell === 2 || cell === 6 || cell === 8) return; // mur, eau, arbre

  _pmMapPlayer.r = nr;
  _pmMapPlayer.c = nc;

  if (cell === 1) {
    const zone = pmGetZoneAt(nr, nc);
    if (zone && Math.random() < PM_ENCOUNTER_CHANCE) {
      const player = pmGetPlayer();
      if (player.dailyWildCount < PM_DAILY_WILD) {
        _pmPendingZoneEncounter = zone;
        pmStopMap();
        pmGoTo('wild');
        return;
      }
    }
  }

  pmRenderMap();
}

function _pmShowCentreMenu() {
  const page = document.getElementById('page-pokepom');
  if (!page) return;
  const player = pmGetPlayer();
  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">🏥 Centre PokePom</div>
          <div class="pm-sub">Gère ton équipe et consulte ta collection</div>
        </div>
        <button class="btn-outline" onclick="pmGoTo('home')">← Retour à la map</button>
      </div>
      <div class="pm-card">
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn-primary" onclick="pmGoTo('team')">🔄 Gérer l'équipe</button>
          <button class="btn-primary" onclick="pmGoTo('collection')" style="background:var(--yellow); color:#000;">📚 Collection (${player.collection.length} PokePoms)</button>
          <button class="btn-outline" onclick="pmGoTo('info')">📖 Infos & Guide</button>
        </div>
      </div>
      <div class="pm-card">
        <h3 style="font-size:.75rem; font-weight:700; color:var(--muted); letter-spacing:.1em; text-transform:uppercase; margin-bottom:12px;">Changer de personnage</h3>
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
          ${PM_AVATARS.map(av => `
            <div onclick="_pmMapAvatar='${av.id}'; pmGoTo('home');" style="cursor:pointer; padding:8px 14px; border-radius:10px; border:2px solid ${_pmMapAvatar === av.id ? 'var(--primary)' : 'var(--border)'}; background:${_pmMapAvatar === av.id ? 'var(--primary-subtle)' : 'var(--surface2)'}; display:flex; flex-direction:column; align-items:center; gap:4px; transition:all .2s;">
              <canvas width="16" height="16" id="pm-av-preview-${av.id}" style="width:32px; height:32px; image-rendering:pixelated;"></canvas>
              <span style="font-size:.7rem; font-weight:600; color:${_pmMapAvatar === av.id ? 'var(--primary)' : 'var(--muted)'};">${av.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  // Dessiner les previews
  PM_AVATARS.forEach(av => {
    setTimeout(() => {
      const c = document.getElementById('pm-av-preview-' + av.id);
      if (!c) return;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#48a848';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = av.body;
      ctx.fillRect(4, 6, 8, 7);
      ctx.fillStyle = av.skin;
      ctx.fillRect(4, 1, 8, 6);
      ctx.fillStyle = av.hair;
      ctx.fillRect(3, 0, 10, 3);
      ctx.fillRect(3, 1, 2, 3);
      ctx.fillStyle = '#000';
      ctx.fillRect(6, 4, 1, 1);
      ctx.fillRect(9, 4, 1, 1);
      ctx.fillStyle = av.body;
      ctx.fillRect(5, 13, 3, 3);
      ctx.fillRect(9, 13, 3, 3);
    }, 10);
  });
}

// ── Contrôles ──
function pmMapKeyDown(e) {
  const dirs = {
    ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1],
    KeyZ:[-1,0], KeyS:[1,0], KeyQ:[0,-1], KeyD:[0,1],
  };
  const d = dirs[e.code];
  if (d && _pmMapGrid) { e.preventDefault(); pmMapTryMove(d[0], d[1]); }
}

function pmMapDpadMove(dr, dc) { if (_pmMapGrid) pmMapTryMove(dr, dc); }

function pmStartMap() {
  if (!_pmMapGrid) pmBuildMap();
  if (!_pmMapPlayer) {
    _pmMapPlayer = { r: Math.floor(PM_MAP_FULL_H / 2) + 2, c: Math.floor(PM_MAP_FULL_W / 2) };
  }
  document.addEventListener('keydown', pmMapKeyDown);
  if (_pmMapLoop) cancelAnimationFrame(_pmMapLoop);
  function loop() { pmRenderMap(); _pmMapLoop = requestAnimationFrame(loop); }
  _pmMapLoop = requestAnimationFrame(loop);
}

function pmStopMap() {
  document.removeEventListener('keydown', pmMapKeyDown);
  if (_pmMapLoop) { cancelAnimationFrame(_pmMapLoop); _pmMapLoop = null; }
}

// ── pmRenderHome — la map GBA ──
function pmRenderHome(page, player) {
  const team = pmGetTeam(player);
  const badgeCount = player.badges.length;

  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header" style="margin-bottom:0;">
        <div>
          <div class="pm-title">🐾 PokePom</div>
          <div class="pm-sub">${player.collection.length} capturés · ${badgeCount}/7 badges</div>
        </div>
        <span id="pm-map-hud" style="font-size:.75rem; color:var(--muted); background:var(--surface2); padding:4px 10px; border-radius:6px; font-family:'Space Mono',monospace;"></span>
      </div>

      <div id="pm-map-zone-label" style="text-align:center; font-size:.8rem; font-weight:700; color:var(--primary); min-height:1.2em; margin-bottom:4px;">Pomel World</div>

      <div style="position:relative; width:${PM_MAP_W}px; max-width:100%; margin:0 auto; border-radius:8px; overflow:hidden; border:3px solid #505868; box-shadow:0 0 0 3px #282830, 0 4px 20px rgba(0,0,0,0.5); background:#000;">
        <canvas id="pm-map-canvas" width="${PM_MAP_W}" height="${PM_MAP_H}" style="display:block; width:100%; height:auto; image-rendering:pixelated;"></canvas>
      </div>

      <!-- D-pad mobile -->
      <div class="pm-map-dpad" id="pm-map-dpad">
        <button class="pm-map-dpad-btn pm-dpad-up" ontouchstart="pmMapDpadMove(-1,0);event.preventDefault();">▲</button>
        <button class="pm-map-dpad-btn pm-dpad-left" ontouchstart="pmMapDpadMove(0,-1);event.preventDefault();">◀</button>
        <button class="pm-map-dpad-btn pm-dpad-right" ontouchstart="pmMapDpadMove(0,1);event.preventDefault();">▶</button>
        <button class="pm-map-dpad-btn pm-dpad-down" ontouchstart="pmMapDpadMove(1,0);event.preventDefault();">▼</button>
      </div>

      <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:4px;">
        <div style="display:flex; align-items:center; gap:4px; font-size:.7rem; color:var(--muted);">
          <span style="width:12px;height:12px;border-radius:2px;background:${GBA.grassLight};display:inline-block;border:1px solid ${GBA.grassDark};"></span> Herbes
        </div>
        <div style="display:flex; align-items:center; gap:4px; font-size:.7rem; color:var(--muted);">
          <span style="width:12px;height:12px;border-radius:2px;background:${GBA.roofGym};display:inline-block;"></span> Arène
        </div>
        <div style="display:flex; align-items:center; gap:4px; font-size:.7rem; color:var(--muted);">
          <span style="width:12px;height:12px;border-radius:2px;background:${GBA.roofLigue};display:inline-block;"></span> Ligue
        </div>
        <div style="display:flex; align-items:center; gap:4px; font-size:.7rem; color:var(--muted);">
          <span style="width:12px;height:12px;border-radius:2px;background:${GBA.roofCentre};display:inline-block;"></span> Centre
        </div>
        <div onclick="pmGoTo('info')" style="display:flex; align-items:center; gap:5px; font-size:.72rem; color:#fff; cursor:pointer; font-weight:700; background:var(--primary); padding:4px 12px; border-radius:6px; transition:all .2s;" onmouseenter="this.style.filter='brightness(1.15)'" onmouseleave="this.style.filter=''">
          📖 Infos & Guide
        </div>
      </div>

      <div style="text-align:center; font-size:.65rem; color:var(--muted); margin-top:2px;">
        ⬆⬇⬅➡ / ZQSD pour se déplacer · Marche dans les herbes pour rencontrer des PokePoms
      </div>
    </div>
  `;

  // Injecter le CSS dpad si pas déjà fait
  if (!document.getElementById('pm-map-dpad-css')) {
    const s = document.createElement('style');
    s.id = 'pm-map-dpad-css';
    s.textContent = `
      .pm-map-dpad { display:none; margin:0 auto; width:160px; height:160px; position:relative; user-select:none; -webkit-user-select:none; }
      .pm-map-dpad-btn { position:absolute; width:50px; height:50px; border-radius:12px; background:var(--surface); border:2px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:1.3rem; cursor:pointer; transition:all .1s; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
      .pm-map-dpad-btn:active { background:var(--primary); border-color:var(--primary); transform:scale(.9); }
      .pm-dpad-up    { top:0;   left:50%; transform:translateX(-50%); }
      .pm-dpad-down  { bottom:0;left:50%; transform:translateX(-50%); }
      .pm-dpad-left  { left:0;  top:50%;  transform:translateY(-50%); }
      .pm-dpad-right { right:0; top:50%;  transform:translateY(-50%); }
      @media (max-width:600px) { .pm-map-dpad { display:block; } }
      @media (min-width:601px) { .pm-map-dpad { display:none; } }
    `;
    document.head.appendChild(s);
  }

  _pmMapCanvas = document.getElementById('pm-map-canvas');
  pmStartMap();
}

// ── Écran « Infos & Guide » ──
function pmRenderInfo(page, player) {
  // Générer la table des types dynamiquement
  const types = ['plante','feu','eau','electrique','air','ombre','lumiere'];
  let typeTableRows = '';
  for (const t of types) {
    const weakTo = [], resistTo = [];
    for (const atk of types) {
      const mod = (PM_WEAK[t] && PM_WEAK[t][atk]) || 1.0;
      if (mod > 1) weakTo.push(atk);
      if (mod < 1) resistTo.push(atk);
    }
    typeTableRows += `
      <tr>
        <td style="font-weight:700;">
          <span style="display:inline-block; padding:2px 8px; border-radius:6px; background:${PM_TYPE_COLOR[t]}; font-size:.75rem; color:#fff;">
            ${PM_TYPE_EMOJI[t]} ${PM_TYPE_LABEL[t]}
          </span>
        </td>
        <td style="color:var(--red); font-size:.82rem;">
          ${weakTo.map(w => `<span style="display:inline-block; padding:1px 6px; border-radius:4px; background:${PM_TYPE_COLOR[w]}; color:#fff; font-size:.7rem; margin:1px;">${PM_TYPE_EMOJI[w]} ${PM_TYPE_LABEL[w]}</span>`).join(' ')}
        </td>
        <td style="color:var(--green); font-size:.82rem;">
          ${resistTo.map(r => `<span style="display:inline-block; padding:1px 6px; border-radius:4px; background:${PM_TYPE_COLOR[r]}; color:#fff; font-size:.7rem; margin:1px;">${PM_TYPE_EMOJI[r]} ${PM_TYPE_LABEL[r]}</span>`).join(' ')}
        </td>
      </tr>`;
  }

  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">📖 Infos & Guide</div>
          <div class="pm-sub">Tout ce qu'il faut savoir pour devenir maître PokePom</div>
        </div>
        <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
      </div>

      <div class="pm-card">
        <h3 style="font-size:.85rem; font-weight:700; color:var(--primary); margin-bottom:10px;">🗺️ Comment jouer</h3>
        <div style="display:flex; flex-direction:column; gap:8px; font-size:.85rem; line-height:1.6; color:var(--text);">
          <div>Bienvenue dans <strong>PokePom</strong> ! Tu explores un monde ouvert avec ton personnage. Déplace-toi avec les <strong>flèches / ZQSD</strong> (ou le d-pad sur mobile).</div>
          <div>Le monde contient <strong>4 zones d'herbes hautes</strong>, chacune avec des PokePoms différents. Quand tu marches dans les herbes, tu as une chance de déclencher un <strong>combat sauvage</strong>. Bats le PokePom adverse pour le capturer et l'ajouter à ta collection !</div>
          <div>Au centre de la map, tu trouveras <strong>3 bâtiments</strong> :</div>
        </div>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:6px; font-size:.85rem; line-height:1.6; color:var(--text);">
          <div>🏆 <strong style="color:#c03c2c;">Arène</strong> (rouge) — Entre dedans pour défier les champions de chaque type et gagner des badges</div>
          <div>⭐ <strong style="color:#8a5acc;">Ligue PokePom</strong> (violet) — Accessible avec 7 badges, enchaîne des combats de plus en plus durs</div>
          <div>🏥 <strong style="color:#3a8acc;">Centre PokePom</strong> (bleu) — Gère ton équipe, consulte ta collection et ce guide</div>
        </div>
      </div>

      <div class="pm-card">
        <h3 style="font-size:.85rem; font-weight:700; color:var(--primary); margin-bottom:10px;">🌿 Les zones de la map</h3>
        <div style="display:flex; flex-direction:column; gap:8px; font-size:.85rem; line-height:1.6; color:var(--text);">
          <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#3a7a28; vertical-align:middle; margin-right:6px;"></span><strong>Prairie Élémentaire</strong> (haut-gauche) — Feu 🔥, Plante 🌿, Eau 💧, Électrique ⚡. Idéale pour débuter !</div>
          <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#6a7a5a; vertical-align:middle; margin-right:6px;"></span><strong>Mont des Vents</strong> (haut-droite) — Air 🌀 uniquement. Chance rare de croiser un légendaire.</div>
          <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#a89a40; vertical-align:middle; margin-right:6px;"></span><strong>Plaine Lumineuse</strong> (bas-gauche) — Lumière ✨ uniquement. Chance rare de légendaire.</div>
          <div><span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:#3a2a40; vertical-align:middle; margin-right:6px;"></span><strong>Grotte du Crépuscule</strong> (bas-droite) — Ombre 🌑 uniquement. Chance rare de légendaire.</div>
        </div>
        <div style="margin-top:8px; padding:10px 14px; background:var(--surface2); border-radius:8px; font-size:.78rem; color:var(--muted); line-height:1.5;">
          Tu as <strong>${PM_DAILY_WILD} rencontres sauvages par jour</strong>. Choisis bien dans quelle zone tu chasses ! Le nombre de combats restants est affiché en haut de la map.
        </div>
      </div>

      <div class="pm-card">
        <h3 style="font-size:.85rem; font-weight:700; color:var(--primary); margin-bottom:10px;">🎯 Objectif du jeu</h3>
        <div style="display:flex; flex-direction:column; gap:6px; font-size:.85rem; line-height:1.6; color:var(--text);">
          <div><strong>1.</strong> Choisis ton starter parmi Pomalis 🌿, Flamèche 🔥 ou Goutapom 💧</div>
          <div><strong>2.</strong> Explore les zones, capture des PokePoms et compose une équipe de 3</div>
          <div><strong>3.</strong> Bats les 7 champions d'arène pour obtenir tous les badges</div>
          <div><strong>4.</strong> Débloque la Ligue PokePom et tente le meilleur score !</div>
        </div>
      </div>

      <div class="pm-card">
        <h3 style="font-size:.85rem; font-weight:700; color:var(--primary); margin-bottom:10px;">⚔️ Les statistiques</h3>
        <div style="display:flex; flex-direction:column; gap:8px; font-size:.85rem; line-height:1.6; color:var(--text);">
          <div><strong style="color:var(--green);">❤️ HP</strong> — Points de vie. Quand ils tombent à 0, le PokePom est K.O.</div>
          <div><strong style="color:var(--primary);">⚔️ ATK</strong> — Attaque. Plus c'est haut, plus les coups font mal.</div>
          <div><strong style="color:var(--yellow);">🛡️ DEF</strong> — Défense. Réduit les dégâts subis.</div>
          <div><strong style="color:#00d4ff;">💨 VIT</strong> — Vitesse. Le PokePom le plus rapide attaque en premier.</div>
        </div>
        <div style="margin-top:12px; padding:10px 14px; background:var(--surface2); border-radius:8px; font-size:.78rem; color:var(--muted); line-height:1.5;">
          <strong>Formule de dégâts :</strong> (ATK × Puissance / DEF) ÷ 3 × STAB × Type<br>
          Un combat dure en moyenne 3 à 4 tours.
        </div>
      </div>

      <div class="pm-card">
        <h3 style="font-size:.85rem; font-weight:700; color:var(--primary); margin-bottom:10px;">✨ Le STAB</h3>
        <div style="font-size:.85rem; line-height:1.6; color:var(--text);">
          <strong>STAB</strong> = <em>Same Type Attack Bonus</em>. Quand un PokePom utilise une attaque <strong>du même type que lui</strong>, les dégâts sont multipliés par <strong style="color:var(--green);">×${PM_STAB}</strong>.
        </div>
        <div style="margin-top:8px; padding:10px 14px; background:var(--surface2); border-radius:8px; font-size:.8rem; color:var(--muted); line-height:1.5;">
          Exemple : un PokePom 🔥 Feu qui utilise une attaque Feu fait ×${PM_STAB} dégâts.<br>
          Mais s'il utilise une attaque 💧 Eau, pas de bonus.
        </div>
      </div>

      <div class="pm-card">
        <h3 style="font-size:.85rem; font-weight:700; color:var(--primary); margin-bottom:10px;">🔥 Table des types</h3>
        <div style="font-size:.82rem; line-height:1.5; color:var(--text); margin-bottom:10px;">
          Chaque type a des <strong style="color:var(--red);">faiblesses</strong> (×1.4 dégâts subis) et des <strong style="color:var(--green);">résistances</strong> (×0.6 dégâts subis).
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:.82rem;">
            <thead>
              <tr style="border-bottom:2px solid var(--border);">
                <th style="text-align:left; padding:8px 6px; color:var(--muted); font-size:.7rem; text-transform:uppercase; letter-spacing:.05em;">Type</th>
                <th style="text-align:left; padding:8px 6px; color:var(--red); font-size:.7rem; text-transform:uppercase; letter-spacing:.05em;">Faible contre (×1.4)</th>
                <th style="text-align:left; padding:8px 6px; color:var(--green); font-size:.7rem; text-transform:uppercase; letter-spacing:.05em;">Résiste à (×0.6)</th>
              </tr>
            </thead>
            <tbody>${typeTableRows}</tbody>
          </table>
        </div>
        <div style="margin-top:10px; padding:10px 14px; background:var(--surface2); border-radius:8px; font-size:.78rem; color:var(--muted); line-height:1.5;">
          💡 <strong>Astuce :</strong> Utilise le bouton "🔄 Changer de PokePom" en combat pour switcher vers un PokePom qui résiste au type adverse !
        </div>
      </div>

      <div class="pm-card">
        <h3 style="font-size:.85rem; font-weight:700; color:var(--primary); margin-bottom:10px;">🏆 Paliers de puissance</h3>
        <div style="display:flex; flex-direction:column; gap:6px; font-size:.85rem; line-height:1.6; color:var(--text);">
          <div><strong>Starter</strong> (total 220) — Les 3 PokePoms de départ</div>
          <div><strong>Normal</strong> (total 240) — Trouvables en combat sauvage</div>
          <div><strong>Champion</strong> (total 260) — Plus rares, plus forts</div>
          <div><strong>Légendaire</strong> (total 290) — Extrêmement rares !</div>
        </div>
        <div style="margin-top:8px; padding:10px 14px; background:var(--surface2); border-radius:8px; font-size:.78rem; color:var(--muted); line-height:1.5;">
          Le total = HP + ATK + DEF + VIT. Un légendaire n'est pas invincible : avec les bons types, un normal peut le battre.
        </div>
      </div>

      <div class="pm-card">
        <h3 style="font-size:.85rem; font-weight:700; color:var(--primary); margin-bottom:10px;">🎮 Modes de jeu</h3>
        <div style="display:flex; flex-direction:column; gap:8px; font-size:.85rem; line-height:1.6; color:var(--text);">
          <div><strong>🌿 Combat sauvage</strong> — Affronte un PokePom aléatoire. Tu peux le capturer si tu le bats ! (${PM_DAILY_WILD} combats/jour)</div>
          <div><strong>🏆 Arènes</strong> — 7 arènes de type, chacune avec un champion. Bats-les tous pour débloquer la Ligue ! (${PM_DAILY_GYM_WINS} victoire/jour)</div>
          <div><strong>⭐ Ligue PokePom</strong> — Enchaîne des combats contre des adversaires de plus en plus forts. Nécessite 7 badges. (${PM_DAILY_LEAGUE} runs/jour)</div>
        </div>
      </div>

      <div class="pm-card">
        <h3 style="font-size:.85rem; font-weight:700; color:var(--primary); margin-bottom:10px;">📈 Niveaux & XP</h3>
        <div style="font-size:.85rem; line-height:1.6; color:var(--text);">
          Chaque PokePom gagne de l'XP en combattant. En montant de niveau (max 10), ses stats augmentent de <strong>+2 HP, +1 ATK, +1 DEF, +1 VIT</strong> par niveau.
        </div>
        <div style="margin-top:8px; padding:10px 14px; background:var(--surface2); border-radius:8px; font-size:.78rem; color:var(--muted); line-height:1.5;">
          XP gagnée : 🌿 sauvage = ${PM_XP_GAIN.wild} XP · 🏆 arène = ${PM_XP_GAIN.gym} XP · ⭐ ligue = ${PM_XP_GAIN.league} XP
        </div>
      </div>

      <div class="pm-card">
        <h3 style="font-size:.85rem; font-weight:700; color:var(--primary); margin-bottom:10px;">💡 Conseils</h3>
        <div style="display:flex; flex-direction:column; gap:6px; font-size:.85rem; line-height:1.6; color:var(--text);">
          <div>• Compose une équipe de <strong>3 types différents</strong> pour couvrir un maximum de matchups</div>
          <div>• Le <strong>switch en combat</strong> coûte un tour (l'adversaire attaque), mais peut sauver un PokePom faible</div>
          <div>• Quand un PokePom tombe K.O., tu dois en choisir un autre — ce changement est <strong>gratuit</strong></div>
          <div>• Les types <strong>Ombre</strong> et <strong>Lumière</strong> sont très forts mais aussi vulnérables l'un à l'autre</div>
          <div>• Un PokePom déjà capturé ne peut pas être recapturé — tu gagnes juste de l'XP</div>
        </div>
      </div>
    </div>
  `;
}

// ── Écran « Gérer l'équipe » : stats + moves, focus fonctionnel ──
function pmRenderTeamManager(page, player) {
  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">🔄 Gérer l'équipe</div>
          <div class="pm-sub">Clique sur un PokePom pour l'ajouter/retirer de ton équipe (${player.team.length}/3)</div>
        </div>
        <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
      </div>
      <div class="pm-card">
        <div class="pm-collection-grid" id="pm-team-grid"></div>
      </div>
    </div>
  `;

  const grid = document.getElementById('pm-team-grid');
  player.collection.forEach(inst => {
    const base = PM_DEX[inst.pokepomId];
    const inTeam = player.team.includes(inst.uid);
    const card = document.createElement('div');
    card.className = 'pm-collection-card' + (inTeam ? ' in-team' : '');
    card.onclick = () => pmToggleTeam(inst.uid);
    const xpMax = inst.level < 10 ? PM_XP_TABLE[inst.level] : 0;
    const xpPct = inst.level < 10 ? (inst.xp / xpMax) * 100 : 100;
    const stats = pmGetStats(inst);
    const moveIds = PM_MOVES_BY_TYPE[base.type] || [];
    const movesHtml = moveIds.map(mId => {
      const m = PM_MOVES[mId];
      if (!m) return '';
      return `<div class="pm-coll-move" style="border-left:3px solid ${PM_TYPE_COLOR[m.type]};">
        <div class="pm-coll-move-name">${PM_TYPE_EMOJI[m.type]} ${m.name}</div>
        <div class="pm-coll-move-meta">${m.power > 0 ? 'P.' + m.power + ' · ' : ''}${m.accuracy}% · ${m.pp}PP</div>
      </div>`;
    }).join('');
    card.innerHTML = `
      <canvas width="64" height="64" class="pm-sprite pm-sprite-md" id="pm-team-${inst.uid}"></canvas>
      <div class="pm-collection-name">${base.name}${inTeam ? ' ✓' : ''}${base.legendary ? ' ✦' : ''}</div>
      <span class="pm-type-badge" style="background:${PM_TYPE_COLOR[base.type]};">${PM_TYPE_EMOJI[base.type]} ${PM_TYPE_LABEL[base.type]}</span>
      <div class="pm-collection-level">Niv ${inst.level}${inst.level < 10 ? ` · ${inst.xp}/${xpMax} XP` : ' ★ MAX'}</div>
      ${inst.level < 10 ? `<div class="pm-xp-bar" style="width:100%;"><div class="pm-xp-fill" style="width:${xpPct}%"></div></div>` : ''}
      <div class="pm-coll-stats">
        <div class="pm-coll-stat"><span class="pm-coll-stat-k">HP</span><span class="pm-coll-stat-v">${stats.hp}</span></div>
        <div class="pm-coll-stat"><span class="pm-coll-stat-k">ATK</span><span class="pm-coll-stat-v">${stats.atk}</span></div>
        <div class="pm-coll-stat"><span class="pm-coll-stat-k">DEF</span><span class="pm-coll-stat-v">${stats.def}</span></div>
        <div class="pm-coll-stat"><span class="pm-coll-stat-k">VIT</span><span class="pm-coll-stat-v">${stats.vit}</span></div>
      </div>
      <div class="pm-coll-moves">
        ${movesHtml}
      </div>
    `;
    grid.appendChild(card);
    setTimeout(() => drawPokePom(document.getElementById('pm-team-' + inst.uid), inst.pokepomId), 10);
  });
}

// ── Écran « Collection » : sprite + type + lore, focus encyclopédique ──
function pmRenderCollection(page, player) {
  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">📚 Collection</div>
          <div class="pm-sub">${player.collection.length}/25 PokePoms capturés</div>
        </div>
        <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
      </div>
      <div class="pm-card">
        <div class="pm-collection-grid" id="pm-coll-grid"></div>
      </div>
    </div>
  `;

  const grid = document.getElementById('pm-coll-grid');
  player.collection.forEach(inst => {
    const base = PM_DEX[inst.pokepomId];
    const inTeam = player.team.includes(inst.uid);
    const card = document.createElement('div');
    card.className = 'pm-collection-card' + (inTeam ? ' in-team' : '');
    // Dans la collection, clic = toggle équipe aussi (pour rester pratique)
    card.onclick = () => pmToggleTeam(inst.uid);
    card.innerHTML = `
      <canvas width="64" height="64" class="pm-sprite pm-sprite-md" id="pm-coll-${inst.uid}"></canvas>
      <div class="pm-collection-name">${base.name}${inTeam ? ' ✓' : ''}${base.legendary ? ' ✦' : ''}</div>
      <span class="pm-type-badge" style="background:${PM_TYPE_COLOR[base.type]};">${PM_TYPE_EMOJI[base.type]} ${PM_TYPE_LABEL[base.type]}</span>
      <div class="pm-collection-level">Niv ${inst.level}${base.legendary ? ' · Légendaire' : ''}</div>
      ${base.lore ? `<div class="pm-coll-lore">${base.lore}</div>` : ''}
    `;
    grid.appendChild(card);
    setTimeout(() => drawPokePom(document.getElementById('pm-coll-' + inst.uid), inst.pokepomId), 10);
  });
}

function pmToggleTeam(uid) {
  const player = pmGetPlayer();
  const idx = player.team.indexOf(uid);
  if (idx !== -1) {
    // Retirer
    if (player.team.length === 1) {
      if (typeof showToast === 'function') showToast('Tu dois garder au moins 1 PokePom dans l\'équipe !', '⚠️');
      return;
    }
    player.team.splice(idx, 1);
  } else {
    // Ajouter
    if (player.team.length >= 3) {
      if (typeof showToast === 'function') showToast('Équipe pleine (max 3) — retire un PokePom d\'abord.', '⚠️');
      return;
    }
    player.team.push(uid);
  }
  pmSavePlayer(player);
  pmRenderPage();
}

// ── Écran combat sauvage (avant combat) ──
function pmRenderWildBattle(page, player) {
  if (player.dailyWildCount >= PM_DAILY_WILD) {
    page.innerHTML = `
      <div class="pm-wrap">
        <div class="pm-header">
          <div>
            <div class="pm-title">🌿 Combats sauvages</div>
            <div class="pm-sub">Limite quotidienne atteinte — reviens demain !</div>
          </div>
          <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
        </div>
      </div>
    `;
    return;
  }

  const team = pmGetTeam(player);
  if (team.length === 0) {
    page.innerHTML = `
      <div class="pm-wrap">
        <div class="pm-header"><div class="pm-title">🌿 Combats sauvages</div></div>
        <div class="pm-card">Tu n'as aucun PokePom en équipe ! Va au Centre PokePom pour gérer ton équipe.</div>
        <button class="btn-outline" onclick="pmGoTo('home')">← Retour à la map</button>
      </div>
    `;
    return;
  }

  // Si un seul PokePom dans l'équipe, lancer directement le combat
  if (team.length === 1) {
    pmStartWildBattle(team[0]);
    return;
  }

  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">🌿 Combat sauvage</div>
          <div class="pm-sub">${PM_DAILY_WILD - player.dailyWildCount}/${PM_DAILY_WILD} rencontres restantes aujourd'hui</div>
        </div>
        <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
      </div>
      <div class="pm-card" style="text-align:center;">
        <p style="margin-bottom:14px; color:var(--muted);">Un PokePom sauvage apparaît ! Choisis qui envoyer au combat.</p>
        <div class="pm-team-slots" id="pm-team-pick"></div>
      </div>
    </div>
  `;

  const slots = document.getElementById('pm-team-pick');
  team.forEach((inst, i) => {
    const base = PM_DEX[inst.pokepomId];
    const slot = document.createElement('div');
    slot.className = 'pm-team-slot';
    slot.style.cursor = 'pointer';
    slot.onclick = () => pmStartWildBattle(inst);
    slot.innerHTML = `
      <canvas width="64" height="64" class="pm-sprite pm-sprite-lg" id="pm-pick-${i}"></canvas>
      <div style="font-weight:700;">${base.name}</div>
      <div style="font-size:.75rem; color:var(--muted); font-family:'Space Mono',monospace;">Niv ${inst.level}</div>
      <span class="pm-type-badge" style="background:${PM_TYPE_COLOR[base.type]};">${PM_TYPE_EMOJI[base.type]}</span>
    `;
    slots.appendChild(slot);
    setTimeout(() => drawPokePom(document.getElementById('pm-pick-' + i), inst.pokepomId), 10);
  });
}

function pmStartWildBattle(firstInstance) {
  const player = pmGetPlayer();
  const team = pmGetTeam(player);
  if (team.length === 0) return;

  // Créer fighters pour toute l'équipe
  const teamFighters = team.map(inst => pmCreateFighter(inst, 1.0));
  // Placer le PokePom choisi en premier
  let firstIdx = team.findIndex(t => t.uid === firstInstance.uid);
  if (firstIdx < 0) firstIdx = 0;

  const wild = _pmPendingZoneEncounter
    ? pmGenerateZoneEncounter(_pmPendingZoneEncounter)
    : pmGenerateWildEncounter();
  _pmPendingZoneEncounter = null;
  const wildFighter = pmCreateFighter(wild, PM_WILD_NERF);

  _pmBattleState = {
    mode: 'wild',
    wildInstance: wild,
    team: team,                      // instances joueur
    teamFighters: teamFighters,      // fighters correspondants
    currentTeamIdx: firstIdx,
    playerInstance: team[firstIdx],
    playerFighter: teamFighters[firstIdx],
    opponentFighter: wildFighter,
    log: [
      `Un ${PM_DEX[wild.pokepomId].name} sauvage apparaît ! (Niv ${wild.level})`,
      `Tu envoies ${teamFighters[firstIdx].name} au combat !`
    ],
    turn: 0,
    finished: false,
    ended: false
  };
  _pmView = 'battle';
  pmRenderPage();
}

// ── Écran arènes ──
function pmRenderGyms(page, player) {
  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">🏆 Arènes</div>
          <div class="pm-sub">${player.badges.length}/7 badges · ${player.dailyGymWins >= PM_DAILY_GYM_WINS ? 'Tu as déjà gagné une arène aujourd\'hui' : 'Tentatives illimitées aujourd\'hui (1 victoire max)'}</div>
        </div>
        <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
      </div>
      <div class="pm-gym-grid" id="pm-gym-grid"></div>
    </div>
  `;

  const grid = document.getElementById('pm-gym-grid');
  PM_GYMS.forEach(gym => {
    const won = player.badges.includes(gym.id);
    const card = document.createElement('div');
    card.className = 'pm-gym-card' + (won ? ' won' : '');
    card.onclick = won ? null : () => pmStartGymBattle(gym);
    card.innerHTML = `
      <div class="pm-sprite-wrap">
        <canvas width="64" height="64" class="pm-sprite pm-sprite-lg" id="pm-gym-${gym.id}"></canvas>
      </div>
      <div class="pm-gym-name">${PM_TYPE_EMOJI[gym.id]} ${gym.name}</div>
      <div class="pm-gym-champion">${gym.championName}</div>
      <span class="pm-type-badge" style="background:${PM_TYPE_COLOR[gym.id]}; align-self:flex-start;">${PM_TYPE_LABEL[gym.id]}</span>
      <div style="font-size:.72rem; color:var(--muted); margin-top:4px;">
        Récompense : 1000 🪙 + badge
      </div>
      ${won ? '<div style="color:var(--green); font-weight:700; font-size:.85rem;">✓ Battue</div>' : ''}
    `;
    grid.appendChild(card);
    setTimeout(() => drawPokePom(document.getElementById('pm-gym-' + gym.id), gym.champion), 10);
  });
}

function pmStartGymBattle(gym) {
  const player = pmGetPlayer();
  if (player.badges.includes(gym.id)) return;
  if (player.dailyGymWins >= PM_DAILY_GYM_WINS) {
    if (typeof showToast === 'function') showToast('Tu as déjà gagné une arène aujourd\'hui !', '⚠️');
    return;
  }

  const team = pmGetTeam(player);
  if (team.length === 0) return;

  // Ouvrir l'écran de sélection du premier combattant
  _pmPendingGym = gym;
  _pmView = 'gymPick';
  pmRenderPage();
}

// Écran : choisir quel PokePom envoyer en premier pour l'arène
function pmRenderGymPick(page, player) {
  const gym = _pmPendingGym;
  if (!gym) { _pmView = 'gym'; pmRenderPage(); return; }
  const team = pmGetTeam(player);
  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">🏆 ${gym.name}</div>
          <div class="pm-sub">Choisis ton premier combattant. Tu pourras switcher pendant le combat.</div>
        </div>
        <button class="btn-outline" onclick="pmGoTo('gym')">← Retour</button>
      </div>
      <div class="pm-card" style="text-align:center;">
        <div class="pm-team-slots" id="pm-gym-pick"></div>
      </div>
    </div>
  `;
  const slots = document.getElementById('pm-gym-pick');
  team.forEach((inst, i) => {
    const base = PM_DEX[inst.pokepomId];
    const slot = document.createElement('div');
    slot.className = 'pm-team-slot';
    slot.style.cursor = 'pointer';
    slot.onclick = () => pmLaunchGymBattle(gym, inst);
    slot.innerHTML = `
      <canvas width="64" height="64" class="pm-sprite pm-sprite-lg" id="pm-gympick-${i}"></canvas>
      <div style="font-weight:700;">${base.name}</div>
      <div style="font-size:.75rem; color:var(--muted); font-family:'Space Mono',monospace;">Niv ${inst.level}</div>
      <span class="pm-type-badge" style="background:${PM_TYPE_COLOR[base.type]};">${PM_TYPE_EMOJI[base.type]}</span>
    `;
    slots.appendChild(slot);
    setTimeout(() => drawPokePom(document.getElementById('pm-gympick-' + i), inst.pokepomId), 10);
  });
}

function pmLaunchGymBattle(gym, firstInstance) {
  const player = pmGetPlayer();
  const team = pmGetTeam(player);
  const teamFighters = team.map(inst => pmCreateFighter(inst, 1.0));
  let firstIdx = team.findIndex(t => t.uid === firstInstance.uid);
  if (firstIdx < 0) firstIdx = 0;

  const championInstance = pmGenerateGymChampion(gym);
  const championFighter = pmCreateFighter(championInstance, PM_GYM_BOOST);

  _pmBattleState = {
    mode: 'gym',
    gym: gym,
    team: team,
    teamFighters: teamFighters,
    currentTeamIdx: firstIdx,
    playerInstance: team[firstIdx],
    playerFighter: teamFighters[firstIdx],
    opponentFighter: championFighter,
    log: [
      `${gym.championName} te défie avec ${championFighter.name} (Niv ${championInstance.level}, boosté) !`,
      `Tu envoies ${teamFighters[firstIdx].name} !`
    ],
    turn: 0,
    finished: false,
    ended: false
  };
  _pmPendingGym = null;
  _pmView = 'battle';
  pmRenderPage();
}

// ── Écran Ligue ──
function pmRenderLeague(page, player) {
  if (player.badges.length < 7) {
    page.innerHTML = `
      <div class="pm-wrap">
        <div class="pm-header">
          <div class="pm-title">⭐ Ligue PokePom</div>
          <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
        </div>
        <div class="pm-card">Tu dois battre les 7 arènes avant d'accéder à la Ligue ! (${player.badges.length}/7)</div>
      </div>
    `;
    return;
  }

  if (player.dailyLeagueCount >= PM_DAILY_LEAGUE) {
    page.innerHTML = `
      <div class="pm-wrap">
        <div class="pm-header">
          <div class="pm-title">⭐ Ligue PokePom</div>
          <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
        </div>
        <div class="pm-card">Tu as épuisé tes 5 tentatives quotidiennes. Reviens demain !<br><br>Meilleur score : <strong>${player.leagueBestScore} victoires</strong></div>
      </div>
    `;
    return;
  }

  const team = pmGetTeam(player);
  if (team.length < 3) {
    page.innerHTML = `
      <div class="pm-wrap">
        <div class="pm-header">
          <div class="pm-title">⭐ Ligue PokePom</div>
          <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
        </div>
        <div class="pm-card">Tu dois avoir une équipe complète de 3 PokePoms pour entrer en Ligue !</div>
      </div>
    `;
    return;
  }

  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">⭐ Ligue PokePom</div>
          <div class="pm-sub">Survie avec équipe de 3 · HP/PP conservés · 50 🪙 par victoire</div>
        </div>
        <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
      </div>
      <div class="pm-card" style="text-align:center;">
        <p style="margin-bottom:14px;">Tentatives restantes : <strong>${PM_DAILY_LEAGUE - player.dailyLeagueCount}/${PM_DAILY_LEAGUE}</strong></p>
        <p style="margin-bottom:14px; color:var(--muted);">Meilleur score : <strong style="color:var(--primary);">${player.leagueBestScore} victoires</strong></p>
        <button class="btn-primary" onclick="pmStartLeagueRun()">Commencer une run</button>
      </div>
      <div class="pm-card">
        <h3 style="font-size:.75rem; font-weight:700; color:var(--muted); letter-spacing:.1em; text-transform:uppercase; margin-bottom:12px;">🏆 Classement général</h3>
        <div id="pm-league-lb-list"><div style="color:var(--muted); font-size:.85rem;">Chargement…</div></div>
      </div>
    </div>
  `;
  // Charger et afficher le classement en async
  pmRenderLeagueLb();
}

// Rendu du leaderboard Ligue (async, chargé après affichage principal)
async function pmRenderLeagueLb() {
  const list = document.getElementById('pm-league-lb-list');
  if (!list) return;
  if (typeof dbGet !== 'function') { list.innerHTML = '<div style="color:var(--muted); font-size:.85rem;">Classement non disponible.</div>'; return; }
  try {
    const snap = await dbGet('pommon_league_lb');
    if (!snap) { list.innerHTML = '<div style="color:var(--muted); font-size:.85rem;">Aucun score enregistré — sois le premier !</div>'; return; }
    const entries = Object.values(snap).sort((a, b) => b.score - a.score).slice(0, 10);
    if (entries.length === 0) { list.innerHTML = '<div style="color:var(--muted); font-size:.85rem;">Aucun score enregistré.</div>'; return; }
    const medals = ['🥇', '🥈', '🥉'];
    list.innerHTML = '';
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const rank = i + 1;
      const isMe = state && e.code === state.code;
      const medal = rank <= 3 ? medals[i] : rank;
      const safeName = typeof escapeHTML === 'function' ? escapeHTML(e.name) : (e.name || '').replace(/</g,'&lt;');
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 12px; background:var(--surface2); border:1px solid ' + (isMe ? 'var(--primary)' : 'var(--border)') + '; border-radius:8px; margin-bottom:6px;';
      row.innerHTML = `
        <span style="font-weight:700; font-size:.95rem; min-width:30px;">${medal}</span>
        <span style="flex:1; font-weight:600; font-size:.88rem; overflow:hidden; text-overflow:ellipsis;">${safeName}${isMe ? ' <span style="background:var(--primary); color:#fff; padding:1px 8px; border-radius:100px; font-size:.65rem; margin-left:4px;">Moi</span>' : ''}</span>
        <span style="font-family:'Space Mono',monospace; font-weight:700; color:var(--primary); font-size:.9rem;">${e.score}</span>
      `;
      list.appendChild(row);
    }
  } catch (e) {
    console.error('[pokepom] renderLeagueLb error', e);
    list.innerHTML = '<div style="color:var(--muted); font-size:.85rem;">Erreur de chargement.</div>';
  }
}

function pmStartLeagueRun() {
  const player = pmGetPlayer();
  const team = pmGetTeam(player);
  const teamFighters = team.map(inst => pmCreateFighter(inst, 1.0));
  const firstOpp = pmGenerateLeagueOpponent(1);
  const oppFighter = pmCreateFighter(firstOpp, 1.0);

  _pmBattleState = {
    mode: 'league',
    teamFighters: teamFighters,
    currentTeamIdx: 0,
    playerFighter: teamFighters[0],
    opponentFighter: oppFighter,
    opponentInstance: firstOpp,
    roundNum: 1,
    winsInRun: 0,
    log: [`🌟 Début de la run Ligue !`, `Round 1 : un ${oppFighter.name} (Niv ${firstOpp.level}) apparaît !`, `Tu envoies ${teamFighters[0].name} !`],
    turn: 0,
    finished: false,
    ended: false
  };

  // Décompter une tentative
  player.dailyLeagueCount++;
  pmSavePlayer(player);

  _pmView = 'battle';
  pmRenderPage();
}

// ── Écran de combat ──
function pmRenderBattle(page, player) {
  const bs = _pmBattleState;
  if (!bs) { pmGoTo('home'); return; }

  const p = bs.playerFighter;
  const o = bs.opponentFighter;

  // Construire l'interface combat
  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">${bs.mode === 'wild' ? '🌿 Combat sauvage' : bs.mode === 'gym' ? '🏆 Arène ' + PM_TYPE_LABEL[bs.gym.id] : '⭐ Ligue · Round ' + (bs.roundNum || 1)}</div>
          ${bs.mode === 'league' ? `<div class="pm-sub">Victoires dans la run : ${bs.winsInRun}</div>` : ''}
        </div>
      </div>

      <div class="pm-battle-arena">
        <div class="pm-battle-field">
          <!-- PokePom joueur (gauche) -->
          <div class="pm-battle-side ${p.ko ? '' : 'active'}">
            <canvas width="64" height="64" class="pm-sprite pm-sprite-lg" id="pm-battle-player"></canvas>
            <div class="pm-battle-info">
              <div class="pm-battle-name">${p.name}</div>
              <div class="pm-battle-level">Niv ${p.level} · ${PM_TYPE_EMOJI[p.type]}</div>
              <div class="pm-hp-bar"><div class="pm-hp-fill ${pmHpClass(p)}" style="width:${(p.hp/p.maxHp)*100}%"></div></div>
              <div class="pm-battle-hp-text">${p.hp} / ${p.maxHp} HP</div>
              ${pmRenderStatusBadges(p)}
            </div>
          </div>

          <!-- Adversaire (droite) -->
          <div class="pm-battle-side ${o.ko ? '' : 'active'}">
            <canvas width="64" height="64" class="pm-sprite pm-sprite-lg" id="pm-battle-opp"></canvas>
            <div class="pm-battle-info">
              <div class="pm-battle-name">${o.name}</div>
              <div class="pm-battle-level">Niv ${o.level} · ${PM_TYPE_EMOJI[o.type]}</div>
              <div class="pm-hp-bar"><div class="pm-hp-fill ${pmHpClass(o)}" style="width:${(o.hp/o.maxHp)*100}%"></div></div>
              <div class="pm-battle-hp-text">${o.hp} / ${o.maxHp} HP</div>
              ${pmRenderStatusBadges(o)}
            </div>
          </div>
        </div>

        <div class="pm-battle-log" id="pm-log">
          ${bs.log.map(l => `<div class="pm-log-line">${l}</div>`).join('')}
        </div>

        ${bs.ended ? pmRenderBattleEnd(bs) : pmRenderMoveChoices(p)}
      </div>
    </div>
  `;

  setTimeout(() => {
    drawPokePom(document.getElementById('pm-battle-player'), p.pokepomId);
    drawPokePom(document.getElementById('pm-battle-opp'), o.pokepomId);
    // Scroll log to bottom
    const log = document.getElementById('pm-log');
    if (log) log.scrollTop = log.scrollHeight;
  }, 10);
}

function pmHpClass(fighter) {
  const pct = fighter.hp / fighter.maxHp;
  if (pct > 0.5) return 'ok';
  if (pct > 0.2) return 'mid';
  return 'low';
}

function pmRenderStatusBadges(fighter) {
  const badges = [];
  if (fighter.burnTurns > 0) badges.push('<span class="pm-battle-status-badge" style="background:rgba(235,88,70,0.2); color:var(--red);">🔥 Brûlure ' + fighter.burnTurns + 'T</span>');
  ['atk','def','vit'].forEach(stat => {
    if (fighter.stages[stat] !== 0) {
      const sign = fighter.stages[stat] > 0 ? '+' : '';
      const color = fighter.stages[stat] > 0 ? 'var(--green)' : 'var(--red)';
      badges.push(`<span class="pm-battle-status-badge" style="color:${color};">${stat.toUpperCase()} ${sign}${fighter.stages[stat]}</span>`);
    }
  });
  return `<div class="pm-battle-status">${badges.join('')}</div>`;
}

function pmRenderMoveChoices(fighter) {
  const bs = _pmBattleState;
  // Mode "choix forcé après KO" : afficher uniquement la liste des PokePoms dispo
  if (bs && bs.forcedSwitch) {
    return pmRenderSwitchChoices(true);
  }
  // Mode "switch manuel" : afficher liste + bouton annuler
  if (bs && bs.switching) {
    return pmRenderSwitchChoices(false);
  }

  const hasAnyPP = !pmHasNoPP(fighter);
  let html = '<div class="pm-moves-grid">';
  fighter.moves.forEach((m, i) => {
    const ppLeft = m.currentPp;
    const ppClass = ppLeft === 0 ? 'empty' : ppLeft <= 1 ? 'low' : '';
    const disabled = ppLeft === 0 ? 'disabled' : '';
    const desc = m.desc || '';
    html += `
      <button class="pm-move-btn" ${disabled} onclick="pmDoBattleTurn(${i})">
        <div class="pm-move-name" style="color:${PM_TYPE_COLOR[m.type] || 'inherit'};">${PM_TYPE_EMOJI[m.type] || '◌'} ${m.name}</div>
        <div class="pm-move-info">
          ${m.power > 0 ? 'Puiss. ' + m.power + ' · ' : ''}${m.accuracy}%
          <span class="pm-move-pp ${ppClass}">· ${ppLeft}/${m.pp} PP</span>
        </div>
        ${desc ? `<div class="pm-move-desc">${desc}</div>` : ''}
      </button>
    `;
  });
  html += '</div>';
  if (!hasAnyPP) {
    html += '<div style="margin-top:10px; text-align:center; color:var(--yellow); font-weight:700;">Plus aucun PP ! Tu vas utiliser Lutte.</div>';
    html += '<button class="btn-primary" style="margin-top:10px;" onclick="pmDoBattleTurn(0)">Utiliser Lutte</button>';
  }

  // Bouton "Changer de PokePom" s'il y a au moins un autre PokePom dispo (non-KO)
  if (bs && bs.teamFighters) {
    const availableCount = bs.teamFighters.filter((f, i) => !f.ko && i !== bs.currentTeamIdx).length;
    if (availableCount > 0) {
      html += `
        <button class="btn-outline" style="margin-top:10px; width:100%;" onclick="pmOpenSwitch()">
          🔄 Changer de PokePom <span style="color:var(--muted); font-size:.8rem;">(coûte un tour)</span>
        </button>
      `;
    }
  }

  return html;
}

// Affiche les PokePoms de l'équipe (pour switch manuel ou forcé après KO)
function pmRenderSwitchChoices(isForced) {
  const bs = _pmBattleState;
  if (!bs || !bs.teamFighters) return '';
  let html = isForced
    ? '<div style="margin-bottom:10px; text-align:center; color:var(--yellow); font-weight:700;">Ton PokePom est K.O. ! Choisis un remplaçant :</div>'
    : '<div style="margin-bottom:10px; text-align:center; color:var(--muted); font-size:.85rem;">Choisis le PokePom à envoyer au combat :</div>';
  html += '<div class="pm-switch-grid">';
  bs.teamFighters.forEach((f, i) => {
    const isActive = i === bs.currentTeamIdx;
    const isKo = f.ko;
    const disabled = isActive || isKo ? 'disabled' : '';
    const hpPct = Math.max(0, Math.min(100, (f.hp / f.hpMax) * 100));
    const hpColor = hpPct > 50 ? 'var(--green)' : hpPct > 20 ? 'var(--yellow)' : 'var(--red)';
    const stateLabel = isKo ? ' <span style="color:var(--red); font-weight:700;">K.O.</span>' : isActive ? ' <span style="color:var(--blue); font-weight:700;">(actif)</span>' : '';
    html += `
      <button class="pm-switch-btn" ${disabled} onclick="pmDoSwitch(${i}, ${isForced ? 'false' : 'true'})">
        <canvas width="48" height="48" class="pm-sprite" id="pm-sw-${i}" style="image-rendering:pixelated;"></canvas>
        <div style="font-weight:700; font-size:.88rem;">${f.name}${stateLabel}</div>
        <span class="pm-type-badge" style="background:${PM_TYPE_COLOR[f.type]}; font-size:.7rem;">${PM_TYPE_EMOJI[f.type]} ${PM_TYPE_LABEL[f.type]}</span>
        <div style="font-size:.72rem; color:var(--muted); font-family:'Space Mono',monospace;">Niv ${f.level} · PV ${f.hp}/${f.hpMax}</div>
        <div style="width:100%; height:5px; background:var(--surface2); border-radius:3px; overflow:hidden;">
          <div style="height:100%; width:${hpPct}%; background:${hpColor}; transition:width .3s;"></div>
        </div>
      </button>
    `;
  });
  html += '</div>';
  if (!isForced) {
    html += '<button class="btn-outline" style="margin-top:10px; width:100%;" onclick="pmCancelSwitch()">← Annuler</button>';
  }
  // Dessiner les sprites après insertion DOM
  setTimeout(() => {
    bs.teamFighters.forEach((f, i) => {
      const c = document.getElementById('pm-sw-' + i);
      if (c) drawPokePom(c, f.pokepomId);
    });
  }, 10);
  return html;
}

function pmOpenSwitch() {
  const bs = _pmBattleState;
  if (!bs || bs.ended) return;
  bs.switching = true;
  pmRenderPage();
}

function pmCancelSwitch() {
  const bs = _pmBattleState;
  if (!bs) return;
  bs.switching = false;
  pmRenderPage();
}

// Effectue le switch de PokePom
// costsTurn = true : switch manuel, l'adversaire attaque ce tour
// costsTurn = false : switch forcé après KO, pas d'attaque adverse
function pmDoSwitch(newIdx, costsTurn) {
  const bs = _pmBattleState;
  if (!bs || bs.ended) return;
  const newFighter = bs.teamFighters[newIdx];
  if (!newFighter || newFighter.ko || newIdx === bs.currentTeamIdx) return;

  const oldName = bs.playerFighter.name;
  const newName = newFighter.name;

  bs.currentTeamIdx = newIdx;
  bs.playerFighter = newFighter;
  bs.playerInstance = bs.team[newIdx];
  bs.switching = false;
  bs.forcedSwitch = false;

  if (costsTurn) {
    bs.log.push(`Tu rappelles ${oldName} et envoies ${newName} !`);
    // L'adversaire attaque pendant le switch
    const o = bs.opponentFighter;
    if (!o.ko) {
      const oppMoveIdx = pmAIChooseMove(o, newFighter);
      const events = pmExecuteMove(o, newFighter, o.moves[oppMoveIdx]);
      events.forEach(ev => bs.log.push(pmEventToText(ev)));
      // Fin de tour (brûlure)
      const endEvents1 = pmApplyEndOfTurnEffects(newFighter);
      endEvents1.forEach(ev => bs.log.push(pmEventToText(ev)));
      const endEvents2 = pmApplyEndOfTurnEffects(o);
      endEvents2.forEach(ev => bs.log.push(pmEventToText(ev)));
      bs.turn++;
      // Si le nouveau PokePom est KO direct → switch forcé
      if (newFighter.ko) {
        const hasOther = bs.teamFighters.some((f, i) => !f.ko && i !== newIdx);
        if (hasOther) {
          bs.forcedSwitch = true;
        } else {
          pmHandleBattleEnd();
        }
      }
    }
  } else {
    bs.log.push(`Tu envoies ${newName} au combat !`);
  }
  pmRenderPage();
}

function pmDoBattleTurn(moveIdx) {
  const bs = _pmBattleState;
  if (!bs || bs.ended) return;

  const p = bs.playerFighter;
  const o = bs.opponentFighter;

  // IA choisit son move
  const oppMoveIdx = pmAIChooseMove(o, p);

  // Exécuter le tour
  const events = pmRunTurn(p, o, moveIdx, oppMoveIdx);

  // Traduire les événements en texte de log
  events.forEach(ev => {
    bs.log.push(pmEventToText(ev));
  });

  bs.turn++;

  // Vérifier fin du combat
  if (p.ko || o.ko) {
    pmHandleBattleEnd();
  }

  pmRenderPage();
}

function pmEventToText(ev) {
  switch (ev.type) {
    case 'use_move': {
      const typeColor = PM_TYPE_COLOR[ev.moveType] || 'var(--muted)';
      const typeEmoji = PM_TYPE_EMOJI[ev.moveType] || '';
      const typeLabel = PM_TYPE_LABEL[ev.moveType] || '';
      const badge = ev.moveType && ev.moveType !== 'neutre'
        ? ` <span style="background:${typeColor}30; color:${typeColor}; border:1px solid ${typeColor}60; border-radius:6px; padding:1px 7px; font-size:.72rem; font-weight:700; margin-left:4px; vertical-align:middle;">${typeEmoji} ${typeLabel}</span>`
        : '';
      return `<span style="color:var(--primary);">${ev.attacker}</span> utilise <strong>${ev.move}</strong>${badge} !`;
    }
    case 'miss': return `<span class="pm-log-line miss">${ev.attacker} rate son attaque !</span>`;
    case 'damage': return `${ev.target} perd ${ev.amount} PV.`;
    case 'effectiveness': return `<span class="pm-log-line eff">${ev.label}</span>`;
    case 'recoil': return `${ev.target} subit ${ev.amount} de dégâts de recul !`;
    case 'self_heal': return `${ev.target} récupère ${ev.amount} PV !`;
    case 'burn_applied': return `🔥 ${ev.target} est brûlé !`;
    case 'burn_damage': return `🔥 ${ev.target} perd ${ev.amount} PV à cause de la brûlure.`;
    case 'burn_end': return `${ev.target} n'est plus brûlé.`;
    case 'heal': return `${ev.target} récupère ${ev.amount} PV !`;
    case 'stage': {
      const dir = ev.dir > 0 ? 'augmente' : 'baisse';
      const times = Math.abs(ev.dir) > 1 ? ' beaucoup' : '';
      return `${ev.target}, ${ev.stat} ${dir}${times} !`;
    }
    case 'stat_max': return `${ev.target} a déjà ${ev.stat} au maximum !`;
    case 'stat_min': return `${ev.target} a déjà ${ev.stat} au minimum !`;
    case 'ko': return `<span class="pm-log-line ko">${ev.target} est K.O. !</span>`;
    default: return '';
  }
}

function pmHandleBattleEnd() {
  const bs = _pmBattleState;
  const p = bs.playerFighter;
  const o = bs.opponentFighter;
  const player = pmGetPlayer();

  // En Ligue, gérer la transition entre combats
  if (bs.mode === 'league') {
    if (o.ko) {
      // Victoire en round
      bs.winsInRun++;
      player.totalBattlesWon = (player.totalBattlesWon || 0) + 1;

      // XP
      const leveledUp = pmGainXP(bs.playerInstance || p.instance, PM_XP_GAIN.league);
      if (leveledUp) {
        bs.log.push(`⬆️ ${p.name} monte au niveau ${(bs.playerInstance || p.instance).level} !`);
      }

      // Reward Pomels (gain atomique via addBalanceTransaction)
      if (typeof addBalanceTransaction === 'function') {
        addBalanceTransaction(state.code, PM_REWARD_LEAGUE_PER_WIN, {
          type: 'pokepom_league',
          desc: `Victoire Ligue PokePom (round ${bs.roundNum})`,
          amount: PM_REWARD_LEAGUE_PER_WIN,
          date: new Date().toISOString()
        }).then(updated => {
          if (updated && typeof migrateAccount === 'function') {
            state = migrateAccount(updated);
            if (typeof refreshUI === 'function') refreshUI();
          }
        });
      } else if (typeof state !== 'undefined' && state) {
        state.balance = (state.balance || 0) + PM_REWARD_LEAGUE_PER_WIN;
        if (typeof saveAccount === 'function') saveAccount(state);
      }

      bs.log.push(`🎉 +${PM_REWARD_LEAGUE_PER_WIN} 🪙 Pomels !`);

      // Sauvegarder instances équipe
      bs.teamFighters.forEach(f => {
        if (f.instance) pmUpdateInstance(player, f.instance);
      });

      // Mise à jour score
      if (bs.winsInRun > player.leagueBestScore) {
        player.leagueBestScore = bs.winsInRun;
      }
      pmSavePlayer(player);

      // Round suivant
      bs.roundNum++;
      const nextOpp = pmGenerateLeagueOpponent(bs.roundNum);
      bs.opponentInstance = nextOpp;
      bs.opponentFighter = pmCreateFighter(nextOpp, 1.0);
      bs.log.push(`<strong>Round ${bs.roundNum}</strong> : un ${bs.opponentFighter.name} (Niv ${nextOpp.level}) apparaît !`);
      return; // Continue le combat
    } else if (p.ko) {
      // Switch vers suivant si dispo
      bs.currentTeamIdx++;
      const nextFighter = bs.teamFighters[bs.currentTeamIdx];
      if (nextFighter && !nextFighter.ko) {
        bs.playerFighter = nextFighter;
        bs.log.push(`Tu envoies ${nextFighter.name} au combat !`);
        return;
      }
      // Plus personne → fin run
      bs.ended = true;
      // Mise à jour du score final
      if (bs.winsInRun > player.leagueBestScore) {
        player.leagueBestScore = bs.winsInRun;
      }
      pmSavePlayer(player);
      // Leaderboard Ligue + flush Firebase
      pmSaveLeagueLb(bs.winsInRun);
      pmSaveNow();
    }
  } else if (bs.mode === 'wild') {
    if (o.ko) {
      // Victoire sauvage
      player.dailyWildCount++;
      player.totalBattlesWon = (player.totalBattlesWon || 0) + 1;
      const leveledUp = pmGainXP(bs.playerInstance, PM_XP_GAIN.wild);
      if (leveledUp) {
        bs.log.push(`⬆️ ${p.name} monte au niveau ${bs.playerInstance.level} !`);
      }
      pmUpdateInstance(player, bs.playerInstance);

      // Anti-doublon : si déjà possédé, pas de capture
      const alreadyOwned = (player.collection || []).some(c => c.pokepomId === bs.wildInstance.pokepomId);
      if (alreadyOwned) {
        bs.log.push(`💨 Le ${o.name} s'enfuit. Tu possèdes déjà ce PokePom — seulement l'XP pour toi.`);
      } else {
        // Tentative de capture (seulement si pas déjà possédé)
        const captured = pmAttemptCapture();
        if (captured) {
          const captureInst = bs.wildInstance;
          pmAddToCollection(player, captureInst);
          bs.log.push(`<strong>🎉 ${PM_DEX[captureInst.pokepomId].name} a été capturé ! Il rejoint ta collection.</strong>`);
        } else {
          bs.log.push(`💨 Le ${o.name} s'est enfui...`);
        }
      }

      // Sauvegarder le fighter actif dans l'instance puis toute l'équipe
      if (bs.teamFighters) {
        bs.teamFighters.forEach((f, i) => {
          if (bs.team && bs.team[i]) pmUpdateInstance(player, bs.team[i]);
        });
      }

      bs.ended = true;
      pmSaveNow();
    } else if (p.ko) {
      // Le PokePom actif est KO — chercher un remplaçant dans l'équipe
      const hasOther = bs.teamFighters && bs.teamFighters.some((f, i) => !f.ko && i !== bs.currentTeamIdx);
      if (hasOther) {
        // Switch forcé — le joueur choisit parmi les non-KO
        bs.forcedSwitch = true;
        return;
      }
      // Toute l'équipe est KO → défaite
      player.dailyWildCount++;
      pmSavePlayer(player);
      bs.log.push(`<strong>Toute ton équipe est K.O. ! Tu as perdu ce combat.</strong>`);
      bs.ended = true;
      pmSaveNow();
    }
  } else if (bs.mode === 'gym') {
    if (o.ko) {
      // Victoire arène
      player.badges.push(bs.gym.id);
      player.dailyGymWins++;
      player.totalBattlesWon = (player.totalBattlesWon || 0) + 1;

      const leveledUp = pmGainXP(bs.playerInstance, PM_XP_GAIN.gym);
      if (leveledUp) {
        bs.log.push(`⬆️ ${p.name} monte au niveau ${bs.playerInstance.level} !`);
      }
      pmUpdateInstance(player, bs.playerInstance);

      // Sauvegarder toute l'équipe (XP peut toucher d'autres PokePoms plus tard)
      if (bs.teamFighters) {
        bs.teamFighters.forEach((f, i) => {
          if (bs.team && bs.team[i]) pmUpdateInstance(player, bs.team[i]);
        });
      }

      // Reward Pomels (gain atomique via addBalanceTransaction)
      if (typeof addBalanceTransaction === 'function') {
        addBalanceTransaction(state.code, PM_REWARD_GYM, {
          type: 'pokepom_gym',
          desc: `Arène ${PM_TYPE_LABEL[bs.gym.id]} battue`,
          amount: PM_REWARD_GYM,
          date: new Date().toISOString()
        }).then(updated => {
          if (updated && typeof migrateAccount === 'function') {
            state = migrateAccount(updated);
            if (typeof refreshUI === 'function') refreshUI();
          }
        });
      } else if (typeof state !== 'undefined' && state) {
        state.balance = (state.balance || 0) + PM_REWARD_GYM;
        if (typeof saveAccount === 'function') saveAccount(state);
      }

      bs.log.push(`<strong>🏆 Arène ${PM_TYPE_LABEL[bs.gym.id]} vaincue ! Badge obtenu + ${PM_REWARD_GYM} 🪙 Pomels !</strong>`);
      pmSavePlayer(player);
      bs.ended = true;
      pmSaveNow();
    } else if (p.ko) {
      // Le PokePom actif est KO — chercher un remplaçant
      const hasOther = bs.teamFighters && bs.teamFighters.some((f, i) => !f.ko && i !== bs.currentTeamIdx);
      if (hasOther) {
        bs.forcedSwitch = true;
        return;
      }
      // Toute l'équipe KO → défaite
      bs.log.push(`<strong>Toute ton équipe est K.O. ! Tu as perdu l'arène.</strong>`);
      bs.ended = true;
    }
  }
}

function pmRenderBattleEnd(bs) {
  const p = bs.playerFighter;
  const o = bs.opponentFighter;
  let html = '<div class="pm-result-screen">';

  if (bs.mode === 'league') {
    html += `
      <div class="pm-result-title lose">Run terminée</div>
      <div>Victoires : <strong>${bs.winsInRun}</strong></div>
      <div class="pm-reward">+${bs.winsInRun * PM_REWARD_LEAGUE_PER_WIN} 🪙</div>
      <button class="btn-primary" onclick="pmGoTo('home')">Retour à l'accueil</button>
    `;
  } else if (bs.mode === 'wild') {
    if (o.ko) {
      html += `
        <div class="pm-result-title win">Victoire !</div>
        <div>+${PM_XP_GAIN.wild} XP</div>
        <div class="pm-quick-btns">
          <button class="btn-outline" onclick="pmGoTo('home')">Accueil</button>
          <button class="btn-primary" onclick="pmGoTo('home')">Retour à la map</button>
        </div>
      `;
    } else {
      html += `
        <div class="pm-result-title lose">Défaite...</div>
        <div class="pm-quick-btns">
          <button class="btn-outline" onclick="pmGoTo('home')">Accueil</button>
        </div>
      `;
    }
  } else if (bs.mode === 'gym') {
    if (o.ko) {
      html += `
        <div class="pm-result-title win">🏆 Arène vaincue !</div>
        <div class="pm-reward">+${PM_REWARD_GYM} 🪙 + Badge ${PM_TYPE_LABEL[bs.gym.id]}</div>
        <button class="btn-primary" onclick="pmGoTo('home')">Retour à l'accueil</button>
      `;
    } else {
      html += `
        <div class="pm-result-title lose">Défaite...</div>
        <div>Réessaie quand tu es prêt !</div>
        <div class="pm-quick-btns">
          <button class="btn-outline" onclick="pmGoTo('gym')">Retour arènes</button>
          <button class="btn-primary" onclick="pmGoTo('home')">Accueil</button>
        </div>
      `;
    }
  }

  html += '</div>';
  return html;
}


/* ═══════════════════════════════════════════════════════════════════════════
   13. INITIALISATION
   ═══════════════════════════════════════════════════════════════════════════ */

function initPommon() {
  pmInjectStyles();
  pmInjectUI();
}

// Auto-init au chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPommon);
} else {
  // Délai pour attendre que l'UI Pomel soit prête
  setTimeout(initPommon, 500);
}

// Retry en cas où le sidenav n'existe pas encore
setTimeout(() => { if (!document.getElementById('snav-pokepom')) pmInjectUI(); }, 2000);
setTimeout(() => { if (!document.getElementById('snav-pokepom')) pmInjectUI(); }, 5000);

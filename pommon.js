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

const PM_TYPES = ['plante', 'feu', 'eau', 'electrique', 'air', 'ombre', 'lumiere', 'glace', 'metal'];

const PM_TYPE_EMOJI = {
  plante: '🌿', feu: '🔥', eau: '💧', electrique: '⚡',
  air: '🌀', ombre: '🌑', lumiere: '✨',
  glace: '❄️', metal: '⚙️'
};

const PM_TYPE_COLOR = {
  plante: '#4a8c3f', feu: '#d4553a', eau: '#3a7bd4', electrique: '#f0c040',
  air: '#a8c8e8', ombre: '#8855aa', lumiere: '#f5d540',
  glace: '#8acce0', metal: '#9098a8'
};

const PM_TYPE_LABEL = {
  plante: 'Plante', feu: 'Feu', eau: 'Eau', electrique: 'Électrique',
  air: 'Air', ombre: 'Ombre', lumiere: 'Lumière',
  glace: 'Glace', metal: 'Métal'
};

// Table faiblesses/résistances : PM_WEAK[defenderType] = { moveType: multiplicateur }
// Lecture : « Le défenseur (clé extérieure) subit X multiplicateur quand il est attaqué par moveType (clé intérieure) »
// Ex : PM_WEAK['feu']['eau'] = 1.4  → un Feu attaqué par une attaque Eau prend 1.4× les dégâts
// Ex : PM_WEAK['plante']['eau'] = 0.6 → une Plante attaquée par une attaque Eau prend 0.6× les dégâts
const PM_WEAK = {
  plante:     { eau: 0.6, electrique: 0.6, feu: 1.4, air: 1.4, glace: 1.4 },
  feu:        { plante: 0.6, lumiere: 0.6, glace: 0.6, eau: 1.4, ombre: 1.4 },
  eau:        { feu: 0.6, air: 0.6, electrique: 1.4, plante: 1.4 },
  electrique: { eau: 0.6, lumiere: 0.6, metal: 0.6, ombre: 1.4, plante: 1.4 },
  air:        { plante: 0.6, ombre: 0.6, lumiere: 0.6, electrique: 1.4, glace: 1.4 },
  ombre:      { feu: 0.6, electrique: 0.6, lumiere: 1.4, air: 1.4 },
  lumiere:    { air: 0.6, feu: 0.6, ombre: 1.4, eau: 1.4 },
  glace:      { air: 0.6, feu: 1.4, metal: 1.4, lumiere: 1.4 },
  metal:      { lumiere: 0.6, glace: 0.6, feu: 1.4, electrique: 1.4 }
};

// Rareté d'apparition en combat sauvage R1 (pourcentage)
// Glace et Métal n'apparaissent qu'en R2 (cf. PM_R2_ENCOUNTER_RATES dans la section R2)
const PM_ENCOUNTER_RATES = {
  plante: 15, feu: 15, eau: 15, electrique: 15, air: 15,
  ombre: 8, lumiere: 8
  // Le reste (9%) est réparti en légendaires
};

// Niveau maximum d'un PokePom
const PM_LEVEL_MAX = 30;

// XP nécessaire pour passer au niveau suivant
// Formule : floor(15 + level*8 + level² * 1.5)
// Donne : 15 → 25 → 38 → 56 → 80 → 109 → 145 → 187 → 235 → 290 → ...
//        ... → ~1660 pour passer de 29 à 30
function pmXpToNext(level) {
  return Math.floor(15 + level * 8 + level * level * 1.5);
}

// Tableau pré-calculé pour accès rapide (index = niveau actuel, valeur = XP requis pour next)
const PM_XP_TABLE = (() => {
  const arr = [0]; // niv 0 inutilisé
  for (let lvl = 1; lvl < PM_LEVEL_MAX; lvl++) arr.push(pmXpToNext(lvl));
  return arr;
})();

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

// ── Région 2 — Terres de PomStud ──
const PM_R1_WILD_LEVEL_CAP = 12;        // sauvages R1 plafonnés à niv 12
const PM_R2_WILD_LEVEL_MIN = 6;         // plancher minimum en R2
const PM_R2_UNLOCK_BADGES = 7;          // 7 badges R1 nécessaires pour débloquer R2

// ── Évolution ──
const PM_EVOLUTION_LEVEL = 20;          // niveau de déclenchement
const PM_EVOLUTION_STAT_MULT = 1.5;     // stats × 1.5 à l'évolution

// Table d'évolution : base id → évolution id
// Seuls les PokePoms listés ici peuvent évoluer. Les autres restent dans leur forme.
const PM_EVOLUTIONS = {
  // Évolutions R1 (10)
  pomalis:    'pomalor',
  thornet:    'thornogor',
  flameche:   'brasileon',
  viperod:    'viperiphon',
  goutapom:   'goutaragon',
  carapulse:  'carapharos',
  volture:    'volterion',
  fulguron:   'fulgurion',
  zephibri:   'zephirion',
  spectrelis: 'spectreval',

  // Évolutions R2 (10)
  cristellis:   'cristelune',
  frimadon:     'glacedrak',
  forgemin:     'forgehammer',
  acierus:      'acierox',
  mousseron:    'mousseroi',
  vrillemousse: 'vrillarcane',
  braslune:     'braslunaire',
  pyrecate:     'pyrecarde',
  voilombre:    'voilarchive',
  brumelope:    'brumelord'
};

// ── Dojo ──
const PM_DOJO_MIN_LEVEL = 10;           // PokePom doit être niv 10+ pour apprendre au Dojo
const PM_DOJO_COST_BASIC = 400;         // moves basiques (power 50-60 ou utilitaires simples)
const PM_DOJO_COST_STANDARD = 1000;     // moves standards (power 70-80, ou buffs +2 crans)
const PM_DOJO_COST_SIGNATURE = 2500;    // moves signature (power 85+ ou effets uniques)

// Crans de stats (index = cran + 3, donc [-3 à +3])
const PM_STAGE_MULT = [0.35, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75];

// Limites quotidiennes

const PM_DAILY_GYM_WINS = 1;  // 1 arène battue par jour max
const PM_DAILY_LEAGUE = 20;

// Brûlure
const PM_BURN_DAMAGE_PCT = 0.12;
const PM_BURN_DURATION = 3;

// Récompenses Pomels
const PM_REWARD_GYM = 1000;
const PM_REWARD_LEAGUE_PER_WIN = 50;

// ═══════════════════════════════════════════════════════════════════════════
// PvP — combats multijoueurs synchrones
// ═══════════════════════════════════════════════════════════════════════════

// ELO et paliers
const PM_ELO_START = 1000;          // ELO de départ pour tout nouveau joueur
const PM_ELO_K = 32;                // K-factor (ampleur des changements ELO)

// Paliers ELO et leurs seuils (ascendant : minElo inclusif)
// On les classe dans l'ordre pour faciliter la recherche du tier d'un ELO donné.
const PM_ELO_TIERS = [
  { id: 'debutant',  label: 'Débutant',  minElo: 0,    color: '#a8a8a8', emoji: '🌱' },
  { id: 'novice',    label: 'Novice',    minElo: 800,  color: '#88c850', emoji: '🌿' },
  { id: 'confirme',  label: 'Confirmé',  minElo: 1100, color: '#3890f8', emoji: '⚔️' },
  { id: 'champion',  label: 'Champion',  minElo: 1400, color: '#a060c8', emoji: '🏆' },
  { id: 'maitre',    label: 'Maître',    minElo: 1700, color: '#f0a830', emoji: '👑' }
];

// Récompenses Pomels par tier (modéré, validé)
const PM_PVP_REWARDS = {
  debutant:  { win: 200,  loss: 50  },
  novice:    { win: 350,  loss: 75  },
  confirme:  { win: 500,  loss: 100 },
  champion:  { win: 700,  loss: 150 },
  maitre:    { win: 1000, loss: 200 }
};

// Timing
const PM_PVP_TURN_TIMEOUT_MS = 60 * 60 * 1000;   // 1 heure par tour, défaite si dépassé
const PM_PVP_LISTING_LIMIT = 50;                 // max 50 joueurs affichés dans la liste

// Soin auto avant chaque combat PvP : true (validé)
const PM_PVP_HEAL_BEFORE = true;

// Récompenses hebdomadaires basées sur le classement ELO :
//   Top 1 : 2000, Top 2 : 1500, Top 3 : 1000, le reste : 500
// Distribuées chaque lundi à 9h. NE réinitialise PAS l'ELO (cumulatif).
const PM_PVP_WEEKLY_PRIZES = [2000, 1500, 1000];
const PM_PVP_WEEKLY_CONSOLATION = 500;
// Le LB est dérivé du nœud pokepom_pvp directement (pas de LB séparé)
// On utilise un nœud "distributed" pour garantir l'idempotence de la distribution
const PM_PVP_DISTRIBUTED_PATH = 'pokepom_pvp_distributed';


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
                lore:'Déesse florale des cieux étoilés. Sa fleur frontale contient, dit-on, un fragment de constellation vivante.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // RÉGION 2 — TERRES DE POMSTUD
  // 18 nouveaux PokePoms (région 2 uniquement, flag region:2)
  // ═══════════════════════════════════════════════════════════════════════════

  // ❄️ GLACE (5) — glass cannon (+VIT +ATK, -DEF -HP)
  cristellis:  { id:'cristellis',  name:'Cristellis',  type:'glace',      hp:50, atk:55, def:40, vit:70, region:2,
                 lore:'Petite biche aux bois de cristal. Ses sabots gravent des runes glacées sur le sol qu\'elle foule.' },
  frimadon:    { id:'frimadon',    name:'Frimadon',    type:'glace',      hp:55, atk:65, def:45, vit:75, region:2,
                 lore:'Dragon des congères. Son souffle fige l\'air en sculptures fugaces que seul un œil pur peut voir.' },
  glacelune:   { id:'glacelune',   name:'Glacelune',   type:'glace',      hp:60, atk:55, def:55, vit:70, region:2,
                 lore:'Renarde des aurores polaires. Sa fourrure capture la lumière des étoiles et la rend, transformée.' },
  cryomorphe:  { id:'cryomorphe',  name:'Cryomorphe',  type:'glace',      hp:55, atk:70, def:50, vit:80, region:2,
                 lore:'Esprit des tempêtes blanches. On dit qu\'il fut jadis un voyageur qui n\'a jamais voulu rentrer chez lui.' },
  hivernel:    { id:'hivernel',    name:'Hivernel',    type:'glace',      hp:80, atk:85, def:65, vit:90, region:2, legendary:true,
                 lore:'Cervidé royal des glaces éternelles. Ses bois portent la mémoire de tous les hivers du monde.' },

  // ⚙️ MÉTAL (5) — tank lourd (+HP +DEF, -VIT)
  forgemin:    { id:'forgemin',    name:'Forgemin',    type:'metal',      hp:70, atk:55, def:75, vit:30, region:2,
                 lore:'Petite enclume vivante. Elle chante quand on la frappe, et ne chante que pour les forgerons honnêtes.' },
  acierus:     { id:'acierus',     name:'Aciérus',     type:'metal',      hp:80, atk:65, def:85, vit:35, region:2,
                 lore:'Chevalier sans visage, armure animée par un serment oublié. Il garde encore quelque chose, mais quoi ?' },
  orichale:    { id:'orichale',    name:'Orichale',    type:'metal',      hp:85, atk:60, def:95, vit:40, region:2,
                 lore:'Golem de minerai pur. Plus on le travaille, plus il devient beau, et plus il devient vieux.' },
  sentinhelm:  { id:'sentinhelm',  name:'Sentinhelm',  type:'metal',      hp:75, atk:75, def:80, vit:45, region:2,
                 lore:'Heaume hanté errant dans les ruines. Son cri est celui d\'une bataille qui ne s\'est jamais arrêtée.' },
  rouilleron:  { id:'rouilleron',  name:'Rouilleron',  type:'metal',      hp:95, atk:80, def:100, vit:35, region:2, legendary:true,
                 lore:'Titan de fer corrodé. Chaque éclat de rouille qui tombe de lui a la valeur d\'un siècle.' },

  // 🌿 PLANTE (2) — natifs R2
  mousseron:   { id:'mousseron',   name:'Mousseron',   type:'plante',     hp:75, atk:55, def:65, vit:40, region:2,
                 lore:'Sage des sous-bois, couvert de lichens rares. Ses pas font pousser des fleurs là où il a marché.' },
  vrillemousse:{ id:'vrillemousse',name:'Vrillemousse',type:'plante',     hp:80, atk:60, def:70, vit:45, region:2,
                 lore:'Liane épineuse aux yeux multiples. Elle chasse en silence ce que les jardiniers oublient.' },

  // 🔥 FEU (2) — natifs R2
  braslune:    { id:'braslune',    name:'Braslune',    type:'feu',        hp:55, atk:65, def:45, vit:75, region:2,
                 lore:'Loup des cendres, pelage incandescent. Il hurle aux nuits sans étoiles pour les rappeler à l\'ordre.' },
  pyrecate:    { id:'pyrecate',    name:'Pyrécate',    type:'feu',        hp:60, atk:70, def:50, vit:65, region:2,
                 lore:'Mante religieuse de braise. Ses lames trancheraient l\'aube si elle l\'osait.' },

  // 💧 EAU (1) — natif R2
  profondine:  { id:'profondine',  name:'Profondine',  type:'eau',        hp:70, atk:65, def:65, vit:65, region:2,
                 lore:'Anguille des fosses oubliées. Sa lumière interne attire ceux qui cherchent ce qu\'ils ne devraient pas trouver.' },

  // ⚡ ÉLECTRIQUE (1) — natif R2
  voltaigle:   { id:'voltaigle',   name:'Voltaigle',   type:'electrique', hp:60, atk:75, def:45, vit:85, region:2,
                 lore:'Aigle des hauteurs orageuses. Sa serre saisit la foudre comme d\'autres saisissent une plume.' },

  // 🌀 AIR (1) — natif R2
  brumelope:   { id:'brumelope',   name:'Brumélope',   type:'air',        hp:55, atk:60, def:55, vit:85, region:2,
                 lore:'Antilope des nuées. On ne la voit qu\'à l\'aube, quand le ciel hésite encore.' },

  // 🌑 OMBRE (1) — natif R2
  voilombre:   { id:'voilombre',   name:'Voilombre',   type:'ombre',      hp:80, atk:55, def:75, vit:55, region:2,
                 lore:'Manteau abandonné par un voyageur d\'autrefois. Il cherche encore quelqu\'un à protéger.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // ÉVOLUTIONS (20) — obtenues uniquement par évolution au niveau 20
  // Stats = base × 1.5 (arrondi à l'entier le plus proche)
  // Flag isEvolution:true → exclues des spawns sauvages et choix de starter
  // ═══════════════════════════════════════════════════════════════════════════

  // Évolutions R1 (10)
  pomalor:     { id:'pomalor',     name:'Pomalor',     type:'plante',     hp:113, atk:75, def:83, vit:60, isEvolution:true,
                 lore:'Le bulbe a fleuri en couronne végétale. Son parfum apaise désormais des cités entières.' },
  thornogor:   { id:'thornogor',   name:'Thornogor',   type:'plante',     hp:120, atk:83, def:90, vit:68, isEvolution:true,
                 lore:'Ses élytres se sont fondus en armure de chitine. Il ne tend plus d\'embuscades : il livre bataille.' },
  brasileon:   { id:'brasileon',   name:'Brasileon',   type:'feu',        hp:83, atk:83, def:68, vit:98, isEvolution:true,
                 lore:'Lézard royal au poitrail incandescent. Sa flamme guide les voyageurs perdus dans les nuits froides.' },
  viperiphon:  { id:'viperiphon',  name:'Vipériphon',  type:'feu',        hp:75, atk:90, def:68, vit:128, isEvolution:true,
                 lore:'Serpent ailé de braise. Sa morsure scelle des pactes dont nul ne connaît plus les termes.' },
  goutaragon:  { id:'goutaragon',  name:'Goutaragon',  type:'eau',        hp:90, atk:75, def:83, vit:83, isEvolution:true,
                 lore:'Le têtard est devenu seigneur des torrents. Ses bulbes-gemmes chantent sous les cascades.' },
  carapharos:  { id:'carapharos',  name:'Carapharos',  type:'eau',        hp:98, atk:83, def:90, vit:90, isEvolution:true,
                 lore:'Crabe-phare aux pinces titanesques. Les marins lui doivent plus qu\'ils ne le sauront jamais.' },
  volterion:   { id:'volterion',   name:'Voltérion',   type:'electrique', hp:83, atk:90, def:68, vit:120, isEvolution:true,
                 lore:'Écureuil-éclair aux moustaches conductrices. Il garde l\'énergie d\'une tempête entière dans sa queue.' },
  fulgurion:   { id:'fulgurion',   name:'Fulgurion',   type:'electrique', hp:75, atk:105, def:60, vit:120, isEvolution:true,
                 lore:'Sphère devenue tempête en miniature. Ceux qui la touchent ne s\'en souviennent jamais clairement.' },
  zephirion:   { id:'zephirion',   name:'Zéphirion',   type:'air',        hp:75, atk:83, def:75, vit:128, isEvolution:true,
                 lore:'Colibri-prince aux ailes d\'arc-en-ciel. Sa danse au matin est dit-on un rituel ancien.' },
  spectreval:  { id:'spectreval',  name:'Spectreval',  type:'ombre',      hp:113, atk:68, def:105, vit:75, isEvolution:true,
                 lore:'La graine fantôme a poussé en arbuste hanté. Ses fruits ne tombent que pour les âmes apaisées.' },

  // Évolutions R2 (10)
  cristelune:  { id:'cristelune',  name:'Cristelune',  type:'glace',      hp:75, atk:83, def:60, vit:105, isEvolution:true,
                 lore:'Biche-prêtresse, bois fait de constellations gelées. Elle marche entre les rêves des dormeurs.' },
  glacedrak:   { id:'glacedrak',   name:'Glacedrak',   type:'glace',      hp:83, atk:98, def:68, vit:113, isEvolution:true,
                 lore:'Dragon des hivers anciens. Son souffle a un jour gelé une mer entière, dit la légende.' },
  forgehammer: { id:'forgehammer', name:'Forgehammer', type:'metal',      hp:105, atk:83, def:113, vit:45, isEvolution:true,
                 lore:'Enclume animée portant le marteau de son défunt maître. Elle frappe encore selon le rythme appris.' },
  acierox:     { id:'acierox',     name:'Aciérox',     type:'metal',      hp:120, atk:98, def:128, vit:53, isEvolution:true,
                 lore:'Chevalier-roi sans royaume. L\'éclat de son armure révèle la vérité des cœurs.' },
  mousseroi:   { id:'mousseroi',   name:'Mousseroi',   type:'plante',     hp:113, atk:83, def:98, vit:60, isEvolution:true,
                 lore:'Sage millénaire des forêts profondes. Ses paroles font germer les pierres.' },
  vrillarcane: { id:'vrillarcane', name:'Vrillarcane', type:'plante',     hp:120, atk:90, def:105, vit:68, isEvolution:true,
                 lore:'Liane-archiviste aux yeux d\'ambre. Elle a vu pousser et mourir des civilisations.' },
  braslunaire: { id:'braslunaire', name:'Braslunaire', type:'feu',        hp:83, atk:98, def:68, vit:113, isEvolution:true,
                 lore:'Loup-roi aux flammes argentées. Il ne hurle plus : il décide, et la nuit obéit.' },
  pyrecarde:   { id:'pyrecarde',   name:'Pyrécarde',   type:'feu',        hp:90, atk:105, def:75, vit:98, isEvolution:true,
                 lore:'Mante-générale aux lames doubles. Elle tranche désormais ce qu\'elle voulait jadis seulement effleurer.' },
  voilarchive: { id:'voilarchive', name:'Voilarchive', type:'ombre',      hp:120, atk:83, def:113, vit:83, isEvolution:true,
                 lore:'Manteau ancien qui contient mille mémoires. Il cherche maintenant à les transmettre.' },
  brumelord:   { id:'brumelord',   name:'Brumélord',   type:'air',        hp:83, atk:90, def:83, vit:128, isEvolution:true,
                 lore:'Antilope-souverain des nuées. Ceux qui le suivent au crépuscule ne reviennent jamais tout à fait pareils.' }
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

  // Glace
  blizzard:        { id:'blizzard',        name:'Blizzard',         type:'glace',      power:80, accuracy:85,  pp:3, category:'attack', desc:'Attaque Glace puissante.' },
  cristal_eclat:   { id:'cristal_eclat',   name:'Éclat de Cristal', type:'glace',      power:50, accuracy:95,  pp:5, category:'attack', sideEffect:'debuff_def', chance:0.25, desc:'Attaque Glace, 25% de baisser la Défense adverse.' },
  vent_polaire:    { id:'vent_polaire',    name:'Vent Polaire',     type:'air',        power:50, accuracy:95,  pp:5, category:'attack', desc:'Attaque Air (couvre les Plante).' },
  givre_acere:     { id:'givre_acere',     name:'Givre Acéré',      type:'glace',      power:0,  accuracy:90,  pp:3, category:'debuff', stat:'vit', stages:-1, desc:'Baisse la Vitesse adverse d\'un cran.' },

  // Métal
  charge_lourde:   { id:'charge_lourde',   name:'Charge Lourde',    type:'metal',      power:80, accuracy:85,  pp:3, category:'attack', desc:'Attaque Métal puissante.' },
  lame_acier:      { id:'lame_acier',      name:'Lame d\'Acier',    type:'metal',      power:50, accuracy:95,  pp:5, category:'attack', sideEffect:'buff_atk', chance:0.25, desc:'Attaque Métal, 25% d\'augmenter ta propre Attaque.' },
  poing_brulant:   { id:'poing_brulant',   name:'Poing Brûlant',    type:'feu',        power:50, accuracy:95,  pp:5, category:'attack', desc:'Attaque Feu (couvre les Glace).' },
  forteresse:      { id:'forteresse',      name:'Forteresse',       type:'metal',      power:0,  accuracy:100, pp:3, category:'buff', stat:'def', stages:1, desc:'Augmente ta propre Défense d\'un cran.' },

  // ═══════════════════════════════════════════════════════════════════════════
  // MOVES SIGNATURE DOJO — exclusivement appris au Dojo (R2)
  // 7 moves de type signature (power 85+, effets uniques) + 3 moves universels
  // Tous ont dojoOnly:true pour qu'on puisse les filtrer si besoin
  // ═══════════════════════════════════════════════════════════════════════════

  // Signatures de type (1 par type, power 85-90)
  lame_seve:       { id:'lame_seve',       name:'Lame Sève',        type:'plante',     power:85, accuracy:90,  pp:3, category:'attack', dojoOnly:true, desc:'Attaque Plante puissante.' },
  volcan_sacre:    { id:'volcan_sacre',    name:'Volcan Sacré',     type:'feu',        power:90, accuracy:85,  pp:3, category:'attack', burnChance:0.35, dojoOnly:true, desc:'Attaque Feu, 35% de brûler.' },
  raz_de_maree:    { id:'raz_de_maree',    name:'Raz-de-Marée',     type:'eau',        power:85, accuracy:90,  pp:3, category:'attack', sideEffect:'debuff_vit', chance:0.25, dojoOnly:true, desc:'Attaque Eau, 25% de baisser la Vitesse.' },
  foudre_pure:     { id:'foudre_pure',     name:'Foudre Pure',      type:'electrique', power:90, accuracy:85,  pp:3, category:'attack', sideEffect:'debuff_def', chance:0.30, dojoOnly:true, desc:'Attaque Électrique, 30% de baisser la Défense.' },
  souffle_aurore:  { id:'souffle_aurore',  name:'Souffle Aurore',   type:'air',        power:80, accuracy:95,  pp:3, category:'attack', healFraction:0.25, dojoOnly:true, desc:'Attaque Air, soigne 25% des dégâts infligés.' },
  cristal_brise:   { id:'cristal_brise',   name:'Cristal Brisé',    type:'glace',      power:90, accuracy:85,  pp:3, category:'attack', sideEffect:'debuff_def', chance:0.30, dojoOnly:true, desc:'Attaque Glace, 30% de baisser la Défense.' },
  lame_orichal:    { id:'lame_orichal',    name:'Lame d\'Orichal',  type:'metal',      power:85, accuracy:90,  pp:3, category:'attack', ignoreDefBuffs:true, dojoOnly:true, desc:'Attaque Métal, ignore les buffs de Défense adverses.' },

  // Universels utilitaires (n'importe quel type peut les apprendre)
  aura_de_fer:     { id:'aura_de_fer',     name:'Aura de Fer',      type:'neutre',     power:0, accuracy:100, pp:3, category:'buff',   stat:'def', stages:2, dojoOnly:true, desc:'Augmente sa propre Défense de 2 crans.' },
  hate_ancienne:   { id:'hate_ancienne',   name:'Hâte Ancienne',    type:'neutre',     power:0, accuracy:100, pp:3, category:'buff',   stat:'vit', stages:2, dojoOnly:true, desc:'Augmente sa propre Vitesse de 2 crans.' },
  malediction:     { id:'malediction',     name:'Malédiction',      type:'ombre',      power:0, accuracy:90,  pp:3, category:'debuff', multiStat:['atk','def'], stages:-1, dojoOnly:true, desc:'Baisse l\'Attaque ET la Défense adverses d\'un cran.' },

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
  lumiere:    ['rayon_sacre', 'eclat_dore', 'aura_radieuse', 'ombre_inversee'],
  glace:      ['blizzard', 'cristal_eclat', 'vent_polaire', 'givre_acere'],
  metal:      ['charge_lourde', 'lame_acier', 'poing_brulant', 'forteresse']
};

// ═══════════════════════════════════════════════════════════════════════════
// CATALOGUE DOJO
// ═══════════════════════════════════════════════════════════════════════════
// Pour chaque type, liste des moves apprenables au Dojo.
// Composition (8 moves par type) :
//   - 4 moves natifs du type (utiles pour ré-apprendre si oubliés)
//   - 1 move signature exclusif du type (power 85+)
//   - 2-3 moves de couverture (autres types, choisis par cohérence)
//
// Les 3 moves universels (aura_de_fer, hate_ancienne, malediction) sont
// accessibles à tous les types via PM_DOJO_UNIVERSAL.
const PM_DOJO_CATALOG = {
  plante: [
    // Natifs (rachetables)
    'fouet_roncier', 'photosynthese', 'lancer_seve', 'pollen_lourd',
    // Signature
    'lame_seve',
    // Couverture : Plante peut taper Eau et Roche-équivalent → Tranchant Feu, Charge Lourde Métal
    'tranchant', 'charge_lourde'
  ],
  feu: [
    'brasier', 'flamme_vive', 'tranchant', 'surchauffe',
    'volcan_sacre',
    // Couverture : Feu peut taper Glace et Plante → Cristal Brisé Glace, Lame d'Orichal Métal
    'cristal_eclat', 'lame_orichal'
  ],
  eau: [
    'torrent', 'aqua_jet', 'eclair_marin', 'corrosion',
    'raz_de_maree',
    // Couverture : Eau peut taper Feu et Roche-équivalent → Givre Acéré Glace, Vent Polaire Air
    'givre_acere', 'vent_polaire'
  ],
  electrique: [
    'arc_voltaique', 'surcharge', 'galvanisation', 'racine_choc',
    'foudre_pure',
    // Couverture : Élec peut taper Eau et Air → Aqua Jet Eau, Cyclone Air
    'aqua_jet', 'cyclone'
  ],
  air: [
    'cyclone', 'brise_vitale', 'eclat_celeste', 'vent_curatif',
    'souffle_aurore',
    // Couverture : Air peut taper Plante et Glace → Lancer Sève Plante, Blizzard Glace
    'lancer_seve', 'blizzard'
  ],
  ombre: [
    'nuit_noire', 'griffure_spec', 'voile_obscur', 'flamme_maudite',
    // Pas de move signature de type "ombre" stricto sensu — Malédiction (universel) est leur signature
    'malediction',
    // Couverture : Ombre peut taper Lumière et Air → Eclat Doré Lumière, Cyclone Air
    'eclat_dore', 'cyclone'
  ],
  lumiere: [
    'rayon_sacre', 'eclat_dore', 'aura_radieuse', 'ombre_inversee',
    // Pas de signature lumière stricto — utilisons le move air signature, vu Hauteurs de Solenne (lumière + air)
    'souffle_aurore',
    // Couverture : Lumière peut taper Glace et Ombre → Cristal Brisé Glace, Voile Obscur Ombre
    'cristal_brise', 'voile_obscur'
  ],
  glace: [
    'blizzard', 'cristal_eclat', 'vent_polaire', 'givre_acere',
    'cristal_brise',
    // Couverture : Glace peut taper Plante et Air → Lancer Sève, Cyclone
    'lancer_seve', 'cyclone'
  ],
  metal: [
    'charge_lourde', 'lame_acier', 'poing_brulant', 'forteresse',
    'lame_orichal',
    // Couverture : Métal peut taper Glace et Lumière → Givre Acéré, Eclat Doré
    'givre_acere', 'eclat_dore'
  ],
};

// Moves universels accessibles à TOUS les PokePoms via le Dojo
const PM_DOJO_UNIVERSAL = ['aura_de_fer', 'hate_ancienne', 'malediction'];

// Détermine le coût d'un move au Dojo selon ses caractéristiques
function pmDojoMoveCost(moveId) {
  const m = PM_MOVES[moveId];
  if (!m) return PM_DOJO_COST_BASIC;
  // Move signature exclusif (dojoOnly = true) : signature ou universel
  if (m.dojoOnly) {
    if (m.power >= 85 || m.healFraction || m.ignoreDefBuffs) return PM_DOJO_COST_SIGNATURE;
    if (m.stages === 2 || m.stages === -1 && m.multiStat) return PM_DOJO_COST_STANDARD;
    return PM_DOJO_COST_STANDARD;
  }
  // Move standard de type : power 70+ → standard, sinon basic
  if (m.power >= 70) return PM_DOJO_COST_STANDARD;
  return PM_DOJO_COST_BASIC;
}

// Liste l'ensemble des moves apprenables au Dojo pour un PokePom donné
// Retourne un array d'ids (tous valides dans PM_MOVES)
function pmDojoMovesFor(pokepomId) {
  const poke = PM_DEX[pokepomId];
  if (!poke) return [];
  const typeMoves = PM_DOJO_CATALOG[poke.type] || [];
  // Concat avec les universels, dédoublonner
  const all = [...new Set([...typeMoves, ...PM_DOJO_UNIVERSAL])];
  return all;
}

// Retourne le moveset (4 moves) d'un PokePom.
// Comportement :
//   - Si appelé avec un id (string) : moves natifs du type (compat existante, ex: pour
//     les sauvages, champions, ligue qui n'ont pas d'instance persistée)
//   - Si appelé avec une instance ayant customMoves : moves persos (déterminés au Dojo)
//   - Si appelé avec une instance sans customMoves : moves natifs du type
function getMoveset(pokepomIdOrInstance) {
  // Cas 1 : appelé avec une instance (objet)
  if (typeof pokepomIdOrInstance === 'object' && pokepomIdOrInstance !== null) {
    const inst = pokepomIdOrInstance;
    if (Array.isArray(inst.customMoves) && inst.customMoves.length === 4) {
      return inst.customMoves.map(mid => PM_MOVES[mid]).filter(Boolean);
    }
    // Fallback sur les natifs du type
    const poke = PM_DEX[inst.pokepomId];
    return PM_MOVES_BY_TYPE[poke.type].map(mid => PM_MOVES[mid]);
  }
  // Cas 2 : appelé avec un id (string)
  const poke = PM_DEX[pokepomIdOrInstance];
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

// ═══════════════════════════════════════════════════════════════════════════
// SPRITES RÉGION 2 — Terres de PomStud (18 PokePoms)
// Palette type Glace : cyan/blanc/lavande (#a8dcff, #d8f0ff, #ccccee, #b0bcd0)
// Palette type Métal : acier/cuivre/rouille (#7080a0, #b0b8c8, #d0d4e0, #b87040)
// ═══════════════════════════════════════════════════════════════════════════

// ❄️ GLACE — 5 PokePoms

PM_SPRITES.cristellis = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Bois de cristal sur la tête
  px(18,2,2,8,'#88ccee'); px(20,4,2,4,'#aaddff'); px(16,4,2,2,'#aaddff'); px(14,6,2,2,'#cceeff');
  px(44,2,2,8,'#88ccee'); px(42,4,2,4,'#aaddff'); px(46,4,2,2,'#aaddff'); px(48,6,2,2,'#cceeff');
  px(20,0,2,2,'#ffffff'); px(44,0,2,2,'#ffffff');
  // Tête
  px(20,10,24,8,'#d8f0ff'); px(18,12,28,8,'#c0e0f0'); px(20,18,24,4,'#a8d0e8');
  // Joues bleutées
  px(22,16,4,3,'#88c0e0'); px(38,16,4,3,'#88c0e0');
  // Yeux
  px(24,13,4,4,'#1a2a44'); px(25,14,2,2,'#aaeeff'); px(36,13,4,4,'#1a2a44'); px(37,14,2,2,'#aaeeff');
  px(24,13,1,1,'#ffffff'); px(36,13,1,1,'#ffffff');
  // Petit museau
  px(30,18,4,3,'#ffffff'); px(31,19,2,1,'#dde6ff');
  // Corps
  px(18,22,28,12,'#d8f0ff'); px(16,24,32,10,'#c0e0f0'); px(18,32,28,4,'#a8d0e8');
  // Marques cristal sur le flanc
  ctx.globalAlpha=0.6;
  px(22,26,3,3,'#aaddff'); px(38,28,3,3,'#aaddff'); px(28,24,2,2,'#cceeff');
  ctx.globalAlpha=1;
  // Pattes arrière
  px(18,36,6,10,'#a8d0e8'); px(16,40,6,8,'#90b8d0'); px(40,36,6,10,'#a8d0e8'); px(42,40,6,8,'#90b8d0');
  // Pattes avant
  px(22,38,5,8,'#a8d0e8'); px(20,44,5,6,'#90b8d0'); px(37,38,5,8,'#a8d0e8'); px(39,44,5,6,'#90b8d0');
  // Sabots cristallins
  px(15,46,6,3,'#88ccee'); px(43,46,6,3,'#88ccee'); px(19,48,5,2,'#88ccee'); px(40,48,5,2,'#88ccee');
  // Petite queue
  px(46,24,4,4,'#aaddff'); px(50,22,3,3,'#cceeff'); px(52,20,2,2,'#ffffff');
  // Particules de givre
  ctx.globalAlpha=0.5;
  px(8,16,2,2,'#ffffff'); px(54,18,2,2,'#ffffff'); px(6,38,2,2,'#cceeff'); px(56,40,2,2,'#cceeff');
  ctx.globalAlpha=1;
};

PM_SPRITES.frimadon = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Tête de dragon
  px(8,8,18,8,'#a0c8e0'); px(6,12,22,8,'#88b8d4'); px(8,18,18,4,'#7098b8');
  // Cornes
  px(10,4,3,5,'#ccddee'); px(11,2,2,3,'#ffffff'); px(20,4,3,5,'#ccddee'); px(21,2,2,3,'#ffffff');
  // Yeux
  px(10,13,4,3,'#1a2a44'); px(11,14,2,1,'#88ddff');
  px(18,13,4,3,'#1a2a44'); px(19,14,2,1,'#88ddff');
  // Dents
  px(8,18,2,3,'#ffffff'); px(22,18,2,3,'#ffffff');
  // Souffle givré
  ctx.globalAlpha=0.7;
  px(0,12,8,4,'#cceeff'); px(0,14,6,2,'#ffffff');
  ctx.globalAlpha=0.4;
  px(0,10,4,2,'#cceeff'); px(0,18,4,2,'#cceeff');
  ctx.globalAlpha=1;
  // Cou
  px(20,20,10,4,'#88b8d4'); px(22,24,12,4,'#7098b8');
  // Corps long et serpentin
  px(26,22,18,8,'#a0c8e0'); px(30,28,16,8,'#88b8d4'); px(34,34,16,6,'#7098b8');
  px(38,38,16,6,'#88b8d4'); px(42,42,14,4,'#a0c8e0'); px(46,44,12,4,'#88b8d4');
  // Pics de glace sur le dos
  px(28,18,3,5,'#ddeeff'); px(34,16,3,7,'#cceeff'); px(40,18,3,5,'#ddeeff');
  px(46,22,3,5,'#cceeff'); px(52,28,3,5,'#ddeeff');
  // Ailes glacées
  ctx.globalAlpha=0.6;
  px(20,4,16,8,'#ddeeff'); px(24,2,12,4,'#ffffff'); px(26,12,12,4,'#cceeff');
  ctx.globalAlpha=1;
  px(22,8,2,3,'#88ccee'); px(28,6,2,4,'#88ccee'); px(34,8,2,3,'#88ccee');
  // Queue avec pic
  px(54,46,4,4,'#a0c8e0'); px(56,42,4,5,'#cceeff'); px(60,40,3,4,'#ffffff');
  // Ventre
  px(30,32,14,4,'#cceeff');
  // Particules
  ctx.globalAlpha=0.4;
  px(2,28,2,2,'#ffffff'); px(4,40,1,1,'#ffffff'); px(60,16,1,1,'#cceeff'); px(58,52,2,2,'#ffffff');
  ctx.globalAlpha=1;
};

PM_SPRITES.glacelune = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aurore de fond
  ctx.globalAlpha=0.25;
  px(0,4,64,6,'#ccaaff'); px(0,8,64,6,'#aaccff'); px(0,12,64,4,'#ccffee');
  ctx.globalAlpha=1;
  // Oreilles pointues
  px(14,4,4,8,'#e8f0ff'); px(16,2,3,5,'#ffffff'); px(15,8,3,3,'#aac0d8');
  px(46,4,4,8,'#e8f0ff'); px(45,2,3,5,'#ffffff'); px(46,8,3,3,'#aac0d8');
  // Tête
  px(18,10,28,8,'#e8f0ff'); px(16,14,32,8,'#d0d8ee'); px(18,20,28,4,'#b0bcd8');
  // Marques d'aurore sur le front
  ctx.globalAlpha=0.5;
  px(26,12,12,3,'#ccaaff'); px(28,14,8,2,'#aaccff');
  ctx.globalAlpha=1;
  // Yeux étoilés
  px(22,15,4,4,'#2a2a44'); px(23,16,2,2,'#aaccff'); px(24,17,1,1,'#ffffff');
  px(38,15,4,4,'#2a2a44'); px(39,16,2,2,'#aaccff'); px(40,17,1,1,'#ffffff');
  // Museau
  px(30,20,4,3,'#1a1a22'); px(31,21,2,1,'#ffffff');
  // Corps
  px(18,24,28,10,'#e8f0ff'); px(16,28,32,10,'#d0d8ee'); px(18,36,28,4,'#b0bcd8');
  // Marques aurore sur le flanc
  ctx.globalAlpha=0.5;
  px(20,28,8,3,'#ccaaff'); px(36,30,8,3,'#aaccff');
  ctx.globalAlpha=1;
  // Pattes
  px(18,40,6,10,'#b0bcd8'); px(16,46,6,6,'#90a0c0');
  px(40,40,6,10,'#b0bcd8'); px(42,46,6,6,'#90a0c0');
  px(24,42,5,8,'#b0bcd8'); px(35,42,5,8,'#b0bcd8');
  // 9 queues stylisées (3 visibles + suggestions)
  px(46,28,6,4,'#e8f0ff'); px(50,26,5,5,'#ffffff'); px(54,28,4,4,'#ccaaff');
  px(48,32,6,4,'#d0d8ee'); px(52,34,5,3,'#aaccff');
  px(50,36,5,5,'#ccffee'); px(54,38,4,4,'#ffffff');
  // Étoiles
  ctx.globalAlpha=0.8;
  px(4,4,1,1,'#ffffff'); px(58,2,1,1,'#ffffff'); px(2,30,1,1,'#ffccff'); px(60,30,1,1,'#ccffee');
  px(8,52,1,1,'#ffffff'); px(56,52,1,1,'#aaccff');
  ctx.globalAlpha=1;
};

PM_SPRITES.cryomorphe = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Tempête tourbillonnante en arrière-plan
  ctx.globalAlpha=0.3;
  px(8,12,48,40,'#cceeff'); px(12,16,40,32,'#ddf4ff'); px(16,20,32,24,'#ffffff');
  ctx.globalAlpha=1;
  // Corps spectral central
  px(22,14,20,8,'#aaccee'); px(20,18,24,10,'#88b8dd'); px(22,26,20,8,'#aaccee');
  px(24,32,16,8,'#88b8dd'); px(26,38,12,8,'#aaccee');
  // Forme nuageuse qui se dissout en bas
  ctx.globalAlpha=0.7;
  px(20,44,24,4,'#cceeff'); px(22,48,20,4,'#ddf4ff'); px(26,52,12,4,'#ffffff');
  ctx.globalAlpha=0.4;
  px(18,52,8,3,'#cceeff'); px(40,52,8,3,'#cceeff'); px(20,56,4,2,'#ffffff'); px(42,56,4,2,'#ffffff');
  ctx.globalAlpha=1;
  // Yeux brillants
  px(26,18,4,4,'#1a2a44'); px(27,19,2,2,'#88ccff'); px(28,20,1,1,'#ffffff');
  px(34,18,4,4,'#1a2a44'); px(35,19,2,2,'#88ccff'); px(36,20,1,1,'#ffffff');
  // Lueur autour des yeux
  ctx.globalAlpha=0.5;
  px(24,16,8,8,'#aaeeff'); px(32,16,8,8,'#aaeeff');
  ctx.globalAlpha=1;
  // Bouche fantomatique
  px(28,26,8,2,'#1a2a44'); px(30,27,4,1,'#000000');
  // Bras de tempête
  px(10,22,12,6,'#aaccee'); px(6,26,10,6,'#88b8dd'); px(2,30,8,5,'#aaccee');
  px(42,22,12,6,'#aaccee'); px(48,26,10,6,'#88b8dd'); px(54,30,8,5,'#aaccee');
  // Cristaux flottants
  ctx.globalAlpha=0.8;
  px(4,8,2,2,'#ffffff'); px(58,10,2,2,'#ffffff'); px(2,42,2,2,'#cceeff'); px(60,40,2,2,'#cceeff');
  px(10,4,1,1,'#ffffff'); px(54,4,1,1,'#ffffff'); px(8,58,1,1,'#cceeff'); px(56,58,1,1,'#cceeff');
  ctx.globalAlpha=1;
  // Tourbillons
  ctx.globalAlpha=0.4;
  px(14,32,4,2,'#ffffff'); px(46,32,4,2,'#ffffff'); px(28,46,8,2,'#ffffff');
  ctx.globalAlpha=1;
};

PM_SPRITES.hivernel = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Halo royal
  ctx.globalAlpha=0.3;
  px(8,8,48,12,'#ddf4ff'); px(4,12,56,8,'#cceeff');
  ctx.globalAlpha=1;
  // Bois royaux majestueux (plus grands)
  px(12,2,3,12,'#cceeff'); px(8,4,3,8,'#aaddff'); px(4,6,3,5,'#88ccee'); px(2,2,2,4,'#ffffff');
  px(10,8,2,3,'#ddf4ff'); px(14,4,2,4,'#ffffff');
  px(49,2,3,12,'#cceeff'); px(53,4,3,8,'#aaddff'); px(57,6,3,5,'#88ccee'); px(60,2,2,4,'#ffffff');
  px(52,8,2,3,'#ddf4ff'); px(48,4,2,4,'#ffffff');
  // Couronne de glace
  px(22,8,4,4,'#ffffff'); px(30,6,4,5,'#ffffff'); px(38,8,4,4,'#ffffff');
  px(20,12,24,2,'#cceeff');
  // Tête noble
  px(18,14,28,8,'#e0eef8'); px(16,18,32,8,'#c0d8ec'); px(18,24,28,4,'#a0c0d8');
  // Yeux royaux
  px(22,18,4,5,'#2a2a44'); px(23,19,2,3,'#aaddff'); px(24,20,1,1,'#ffffff');
  px(38,18,4,5,'#2a2a44'); px(39,19,2,3,'#aaddff'); px(40,20,1,1,'#ffffff');
  // Marques royales
  ctx.globalAlpha=0.6;
  px(28,22,8,2,'#88ccee');
  ctx.globalAlpha=1;
  // Museau
  px(28,24,8,4,'#ffffff'); px(30,26,4,2,'#ddf4ff');
  px(30,27,4,2,'#1a1a22');
  // Corps puissant
  px(16,28,32,12,'#e0eef8'); px(14,32,36,12,'#c0d8ec'); px(16,40,32,6,'#a0c0d8');
  // Détails givrés sur le pelage
  ctx.globalAlpha=0.5;
  px(20,32,4,3,'#ffffff'); px(40,34,4,3,'#ffffff'); px(28,38,8,2,'#cceeff');
  ctx.globalAlpha=1;
  // Pattes
  px(14,44,8,12,'#a0c0d8'); px(12,50,8,8,'#88a8c0');
  px(42,44,8,12,'#a0c0d8'); px(42,50,8,8,'#88a8c0');
  px(22,46,6,10,'#a0c0d8'); px(36,46,6,10,'#a0c0d8');
  // Sabots cristallins
  px(11,56,8,4,'#88ccee'); px(13,58,6,2,'#aaddff');
  px(43,56,8,4,'#88ccee'); px(45,58,6,2,'#aaddff');
  px(20,56,6,3,'#88ccee'); px(36,56,6,3,'#88ccee');
  // Particules sacrées
  ctx.globalAlpha=0.7;
  px(4,18,1,1,'#ffffff'); px(60,20,1,1,'#ffffff'); px(2,38,2,2,'#ddf4ff'); px(60,42,2,2,'#ddf4ff');
  px(8,52,1,1,'#ffffff'); px(56,54,1,1,'#ffffff');
  ctx.globalAlpha=1;
};

// ⚙️ MÉTAL — 5 PokePoms

PM_SPRITES.forgemin = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Forme d'enclume
  // Plateau supérieur étroit
  px(20,10,24,5,'#909cb0'); px(18,12,28,4,'#7080a0'); px(20,15,24,2,'#5e6e8a');
  // Cou rétréci
  px(26,15,12,4,'#7080a0'); px(28,18,8,3,'#5e6e8a');
  // Corne traditionnelle d'enclume (droite)
  px(44,11,8,3,'#909cb0'); px(50,12,4,2,'#7080a0'); px(53,12,3,2,'#5e6e8a');
  // Visage sur le plateau
  px(24,12,3,3,'#1a1a22'); px(25,13,1,1,'#ffaa44');
  px(37,12,3,3,'#1a1a22'); px(38,13,1,1,'#ffaa44');
  // Petite bouche tendre
  px(30,14,4,1,'#1a1a22');
  // Base de l'enclume large et lourde
  px(14,21,36,12,'#909cb0'); px(12,24,40,12,'#7080a0'); px(14,33,36,5,'#5e6e8a');
  // Hauts-reliefs de la base (pieds traditionnels)
  px(10,28,8,8,'#909cb0'); px(8,32,8,6,'#7080a0'); px(8,36,10,4,'#5e6e8a');
  px(46,28,8,8,'#909cb0'); px(48,32,8,6,'#7080a0'); px(46,36,10,4,'#5e6e8a');
  // Marque de coups de marteau
  px(22,26,4,2,'#5e6e8a'); px(36,28,4,2,'#5e6e8a'); px(28,30,5,2,'#5e6e8a');
  // Reflets brillants
  ctx.globalAlpha=0.5;
  px(20,11,8,2,'#d0d8e8'); px(16,22,12,2,'#b8c4d4');
  ctx.globalAlpha=1;
  // Petits pieds en bas
  px(16,40,6,8,'#5e6e8a'); px(14,46,8,6,'#4a5870');
  px(42,40,6,8,'#5e6e8a'); px(46,46,8,6,'#4a5870');
  px(22,42,8,6,'#5e6e8a'); px(34,42,8,6,'#5e6e8a');
  // Étincelles
  ctx.globalAlpha=0.8;
  px(54,18,2,2,'#ffaa44'); px(56,16,1,1,'#ffcc66'); px(58,20,1,1,'#ff8800');
  px(4,18,1,1,'#ffaa44'); px(2,22,1,1,'#ffcc66');
  ctx.globalAlpha=1;
  // Texture
  px(20,32,2,1,'#4a5870'); px(40,34,2,1,'#4a5870');
};

PM_SPRITES.acierus = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Heaume de chevalier
  px(20,4,24,6,'#aab4c4'); px(18,6,28,8,'#8898ac'); px(20,12,24,4,'#6a7a90');
  // Plumet (panache du heaume)
  px(28,0,8,4,'#5060a0'); px(30,2,4,2,'#7080c0');
  // Visière sombre avec fente lumineuse
  px(20,14,24,5,'#3a4458'); px(22,16,8,1,'#ffaa00'); px(34,16,8,1,'#ffaa00');
  // Cou en mailles
  px(26,19,12,4,'#7080a0'); px(28,21,8,2,'#5e6e8a');
  // Plastron et armure
  px(14,22,36,16,'#aab4c4'); px(12,26,40,16,'#8898ac'); px(14,38,36,6,'#6a7a90');
  // Croix gravée centrale
  px(31,24,2,12,'#5060a0'); px(26,30,12,2,'#5060a0');
  // Épaulières
  px(8,22,10,8,'#909cb0'); px(6,26,10,6,'#7080a0'); px(6,30,12,4,'#5e6e8a');
  px(46,22,10,8,'#909cb0'); px(48,26,10,6,'#7080a0'); px(46,30,12,4,'#5e6e8a');
  // Bras armurés
  px(8,32,8,12,'#7080a0'); px(6,38,8,8,'#5e6e8a');
  px(48,32,8,12,'#7080a0'); px(50,38,8,8,'#5e6e8a');
  // Gantelets
  px(6,42,10,5,'#909cb0'); px(48,42,10,5,'#909cb0');
  // Reflets brillants
  ctx.globalAlpha=0.5;
  px(22,8,8,2,'#d0d8e8'); px(18,24,8,2,'#c0c8d8'); px(40,28,6,2,'#c0c8d8');
  ctx.globalAlpha=1;
  // Jambes/jupe d'armure
  px(18,44,12,12,'#7080a0'); px(34,44,12,12,'#7080a0');
  px(16,50,14,8,'#5e6e8a'); px(34,50,14,8,'#5e6e8a');
  // Sole metallique
  px(14,58,18,4,'#4a5870'); px(32,58,18,4,'#4a5870');
  // Aura mystique (faible)
  ctx.globalAlpha=0.25;
  px(2,16,4,30,'#7080c0'); px(58,16,4,30,'#7080c0');
  ctx.globalAlpha=1;
};

PM_SPRITES.orichale = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Tête massive de golem
  px(16,4,32,8,'#a08858'); px(14,8,36,8,'#886a40'); px(16,14,32,4,'#6a5230');
  // Yeux luisants (orichalque vert-doré)
  px(22,8,5,5,'#222822'); px(23,9,3,3,'#aaff88'); px(24,10,1,1,'#ffffff');
  px(37,8,5,5,'#222822'); px(38,9,3,3,'#aaff88'); px(39,10,1,1,'#ffffff');
  // Mâchoire carrée
  px(22,14,20,4,'#5e4828'); px(24,16,16,2,'#3e3018');
  // Dents
  px(26,16,2,2,'#ddc888'); px(30,16,2,2,'#ddc888'); px(34,16,2,2,'#ddc888'); px(38,16,2,2,'#ddc888');
  // Cou
  px(24,18,16,4,'#886a40');
  // Filons d'orichalque sur le visage
  ctx.globalAlpha=0.7;
  px(18,7,2,5,'#aaff88'); px(44,9,2,4,'#aaff88');
  ctx.globalAlpha=1;
  // Corps massif
  px(8,22,48,18,'#a08858'); px(6,26,52,18,'#886a40'); px(8,40,48,6,'#6a5230');
  // Filons d'orichalque sur le torse (pulsation lumineuse)
  px(20,28,3,8,'#aaff88'); px(40,30,3,7,'#aaff88'); px(28,34,8,2,'#aaff88');
  ctx.globalAlpha=0.7;
  px(19,28,5,2,'#ccffaa'); px(39,30,5,2,'#ccffaa'); px(28,34,8,1,'#ccffaa');
  ctx.globalAlpha=1;
  // Bras puissants
  px(2,24,8,16,'#886a40'); px(0,28,6,12,'#6a5230');
  px(54,24,10,16,'#886a40'); px(58,28,6,12,'#6a5230');
  // Poings
  px(0,38,10,8,'#a08858'); px(54,38,10,8,'#a08858');
  px(2,42,6,4,'#5e4828'); px(56,42,6,4,'#5e4828');
  // Filon dans les bras
  ctx.globalAlpha=0.7;
  px(4,30,1,8,'#aaff88'); px(58,30,1,8,'#aaff88');
  ctx.globalAlpha=1;
  // Jambes trapues
  px(14,46,12,14,'#886a40'); px(38,46,12,14,'#886a40');
  px(12,52,14,10,'#6a5230'); px(38,52,14,10,'#6a5230');
  // Pieds
  px(10,58,18,4,'#3e3018'); px(36,58,18,4,'#3e3018');
  // Filons partout sur la peau
  ctx.globalAlpha=0.4;
  px(46,32,2,4,'#aaff88'); px(12,34,2,3,'#aaff88'); px(20,40,3,2,'#aaff88');
  ctx.globalAlpha=1;
  // Halo sacré
  ctx.globalAlpha=0.2;
  px(0,0,64,64,'#aaff88');
  ctx.globalAlpha=1;
};

PM_SPRITES.sentinhelm = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura spectrale autour du heaume
  ctx.globalAlpha=0.3;
  px(10,4,44,40,'#5060a0'); px(14,8,36,32,'#7080c0');
  ctx.globalAlpha=1;
  // Heaume forme classique
  // Casque haut arrondi
  px(22,6,20,4,'#909cb0'); px(20,8,24,4,'#7080a0');
  // Visière partie supérieure
  px(18,12,28,8,'#aab4c4'); px(16,14,32,8,'#8898ac'); px(18,20,28,4,'#6a7a90');
  // Fente de visière + lueurs surnaturelles
  px(20,16,24,3,'#1a1a22');
  ctx.globalAlpha=0.9;
  px(22,17,8,1,'#aaccff'); px(34,17,8,1,'#aaccff');
  ctx.globalAlpha=1;
  // Mentonnière
  px(20,22,24,6,'#7080a0'); px(22,26,20,4,'#5e6e8a');
  // Petits reliefs pointus
  px(20,28,3,4,'#5e6e8a'); px(30,30,4,2,'#5e6e8a'); px(41,28,3,4,'#5e6e8a');
  // Plumet noir effiloché
  px(28,2,8,5,'#1a1a22'); px(30,0,4,3,'#3a3a44');
  px(26,6,2,2,'#1a1a22'); px(36,6,2,2,'#1a1a22');
  // Reflets sur le casque
  ctx.globalAlpha=0.5;
  px(24,8,8,2,'#d0d8e8'); px(20,16,4,1,'#c0c8d8');
  ctx.globalAlpha=1;
  // Pas de corps — il flotte. Juste l'âme spectrale en dessous
  ctx.globalAlpha=0.7;
  px(22,32,20,8,'#5060a0'); px(24,38,16,8,'#404870');
  ctx.globalAlpha=0.5;
  px(18,42,28,6,'#5060a0'); px(20,46,24,6,'#404870');
  ctx.globalAlpha=0.3;
  px(14,50,36,5,'#5060a0'); px(18,54,28,4,'#404870');
  ctx.globalAlpha=0.15;
  px(10,58,44,4,'#5060a0');
  ctx.globalAlpha=1;
  // Yeux lumineux dans les ténèbres (sous le heaume)
  px(28,36,3,3,'#aaccff'); px(33,36,3,3,'#aaccff');
  ctx.globalAlpha=0.5;
  px(27,35,5,5,'#ddeeff'); px(32,35,5,5,'#ddeeff');
  ctx.globalAlpha=1;
  // Particules d'âme
  ctx.globalAlpha=0.7;
  px(8,30,1,1,'#aaccff'); px(56,32,1,1,'#aaccff'); px(4,46,2,2,'#7080c0'); px(58,46,2,2,'#7080c0');
  px(12,58,1,1,'#aaccff'); px(52,58,1,1,'#aaccff');
  ctx.globalAlpha=1;
};

PM_SPRITES.rouilleron = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura ancestrale ferreuse
  ctx.globalAlpha=0.25;
  px(2,2,60,60,'#b87040'); px(6,6,52,52,'#a05030');
  ctx.globalAlpha=1;
  // Tête massive corrodée
  px(14,2,36,8,'#7a5040'); px(12,6,40,8,'#5e3e30'); px(14,12,36,4,'#3e2820');
  // Cornes de fer rouillées
  px(8,2,4,8,'#3e2820'); px(6,4,3,5,'#251610');
  px(52,2,4,8,'#3e2820'); px(55,4,3,5,'#251610');
  // Yeux rougeoyants brûlants
  px(20,7,6,5,'#1a0a0a'); px(21,8,4,3,'#ff6600'); px(22,9,2,1,'#ffaa44');
  px(38,7,6,5,'#1a0a0a'); px(39,8,4,3,'#ff6600'); px(40,9,2,1,'#ffaa44');
  // Plaques de rouille sur la tête
  ctx.globalAlpha=0.6;
  px(16,4,4,4,'#b87040'); px(44,6,4,4,'#b87040'); px(28,12,8,2,'#b87040');
  ctx.globalAlpha=1;
  // Mâchoire
  px(20,14,24,6,'#3e2820'); px(22,18,20,4,'#251610');
  // Dents inégales
  px(22,18,2,4,'#aa9888'); px(28,18,2,3,'#aa9888'); px(34,18,2,4,'#aa9888'); px(40,18,2,3,'#aa9888');
  // Cou massif
  px(22,20,20,4,'#5e3e30');
  // Corps colossal
  px(8,24,48,20,'#7a5040'); px(6,28,52,20,'#5e3e30'); px(8,46,48,4,'#3e2820');
  // Plaques de rouille géantes sur le torse
  ctx.globalAlpha=0.7;
  px(14,28,8,8,'#b87040'); px(38,30,10,8,'#b87040'); px(22,38,12,5,'#b87040');
  ctx.globalAlpha=1;
  px(14,28,8,1,'#3e2820'); px(38,30,10,1,'#3e2820');
  // Bras gigantesques
  px(0,26,10,18,'#5e3e30'); px(0,30,8,14,'#3e2820');
  px(54,26,10,18,'#5e3e30'); px(56,30,8,14,'#3e2820');
  // Poings écraseurs
  px(0,40,12,10,'#7a5040'); px(52,40,12,10,'#7a5040');
  px(2,44,8,6,'#3e2820'); px(54,44,8,6,'#3e2820');
  // Rouille sur les bras (qui tombe)
  ctx.globalAlpha=0.6;
  px(2,34,4,4,'#b87040'); px(58,36,4,3,'#b87040');
  ctx.globalAlpha=1;
  // Flocons de rouille qui tombent
  ctx.globalAlpha=0.7;
  px(8,52,1,1,'#b87040'); px(20,54,2,1,'#a05030'); px(34,56,1,1,'#b87040'); px(50,52,1,1,'#a05030');
  ctx.globalAlpha=1;
  // Jambes énormes
  px(12,50,14,12,'#5e3e30'); px(38,50,14,12,'#5e3e30');
  px(10,56,16,6,'#3e2820'); px(38,56,16,6,'#3e2820');
  // Vapeur de rouille
  ctx.globalAlpha=0.4;
  px(24,2,2,2,'#b87040'); px(36,4,2,2,'#b87040');
  ctx.globalAlpha=1;
};

// 🌿 PLANTE — 2 PokePoms R2

PM_SPRITES.mousseron = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Chapeau de champignon couvert de mousse
  px(18,4,28,4,'#5a8830'); px(14,6,36,8,'#4a7028'); px(12,12,40,6,'#3a5820');
  // Lichens dorés sur le chapeau
  px(20,6,4,3,'#a8d048'); px(34,8,5,3,'#a8d048'); px(28,4,4,3,'#c0e060');
  px(40,8,4,3,'#a8d048'); px(22,12,3,2,'#a8d048');
  // Petites fleurs rares
  ctx.globalAlpha=0.9;
  px(18,8,2,2,'#f0c8a0'); px(44,6,2,2,'#f0c8a0'); px(30,10,2,2,'#ffe080');
  ctx.globalAlpha=1;
  // Bord du chapeau
  px(10,16,44,4,'#2a4818'); px(8,18,48,3,'#1e3812');
  // Tête / corps en colonne (pied du champignon)
  px(20,20,24,8,'#d8c898'); px(18,24,28,6,'#c0b078'); px(20,28,24,4,'#a89060');
  // Yeux sages
  px(24,22,4,4,'#1a1a22'); px(25,23,2,2,'#88a868'); px(26,24,1,1,'#ffffff');
  px(36,22,4,4,'#1a1a22'); px(37,23,2,2,'#88a868'); px(38,24,1,1,'#ffffff');
  // Sourires bienveillant
  px(28,26,8,2,'#1a1a22'); px(30,27,4,1,'#5a3018');
  // Marques de mousse sur le pied
  ctx.globalAlpha=0.7;
  px(20,26,4,3,'#5a8830'); px(40,28,4,3,'#5a8830'); px(28,30,8,2,'#5a8830');
  ctx.globalAlpha=1;
  // Base / bras-racines
  px(14,32,36,8,'#a89060'); px(12,36,40,8,'#88784a');
  // Petits bras de racines
  px(8,34,8,6,'#a89060'); px(48,34,8,6,'#a89060'); px(6,38,8,4,'#88784a'); px(50,38,8,4,'#88784a');
  // Pieds-racines
  px(14,42,10,12,'#88784a'); px(40,42,10,12,'#88784a');
  px(12,50,14,8,'#5a4830'); px(38,50,14,8,'#5a4830');
  // Petites racines secondaires
  px(8,54,4,6,'#5a4830'); px(52,54,4,6,'#5a4830'); px(24,54,4,6,'#5a4830'); px(36,54,4,6,'#5a4830');
  // Fleurs poussent dans les pas (au sol)
  ctx.globalAlpha=0.8;
  px(2,60,2,2,'#f0c8a0'); px(60,60,2,2,'#f0c8a0'); px(28,60,2,2,'#ffe080'); px(34,60,2,2,'#ffe080');
  ctx.globalAlpha=1;
  // Spore particles
  ctx.globalAlpha=0.5;
  px(4,8,1,1,'#a8d048'); px(58,10,1,1,'#a8d048'); px(2,30,1,1,'#c0e060');
  ctx.globalAlpha=1;
};

PM_SPRITES.vrillemousse = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Liane principale qui s'enroule
  px(28,2,8,4,'#3e6020'); px(24,6,16,4,'#4a7028'); px(20,10,8,4,'#3e6020'); px(36,10,8,4,'#3e6020');
  px(16,14,12,4,'#4a7028'); px(36,14,12,4,'#4a7028');
  // Corps central enroulé
  px(20,18,24,10,'#5a8830'); px(18,22,28,10,'#4a7028'); px(20,30,24,6,'#3a5820');
  // Plusieurs yeux multiples (caractéristique principale)
  px(22,20,3,3,'#1a2a14'); px(23,21,1,1,'#ffaa00');
  px(28,20,3,3,'#1a2a14'); px(29,21,1,1,'#ffaa00');
  px(34,20,3,3,'#1a2a14'); px(35,21,1,1,'#ffaa00');
  px(40,20,3,3,'#1a2a14'); px(41,21,1,1,'#ffaa00');
  // Petits yeux secondaires
  px(25,25,2,2,'#1a2a14'); px(31,25,2,2,'#1a2a14'); px(37,25,2,2,'#1a2a14');
  // Bouche dentée (crocs cachés dans la liane)
  px(26,29,12,3,'#1a1a14'); px(28,30,2,2,'#ddccaa'); px(31,30,2,2,'#ddccaa'); px(34,30,2,2,'#ddccaa');
  // Épines dorsales
  px(22,16,2,4,'#a8c048'); px(28,14,2,4,'#a8c048'); px(34,14,2,4,'#a8c048'); px(40,16,2,4,'#a8c048');
  // Lianes-bras qui s'étendent
  px(8,22,12,4,'#4a7028'); px(4,26,10,4,'#3e6020'); px(0,30,8,3,'#3e6020');
  px(44,22,12,4,'#4a7028'); px(50,26,10,4,'#3e6020'); px(56,30,8,3,'#3e6020');
  // Épines sur les bras
  px(10,21,2,2,'#a8c048'); px(54,21,2,2,'#a8c048'); px(6,25,2,2,'#a8c048'); px(58,25,2,2,'#a8c048');
  // Bourgeons piquants au bout
  px(0,28,4,4,'#a8c048'); px(60,28,4,4,'#a8c048');
  px(0,30,2,2,'#5a3018'); px(62,30,2,2,'#5a3018');
  // Corps inférieur
  px(18,36,28,12,'#3a5820'); px(16,40,32,10,'#2a4418'); px(20,48,24,4,'#1e3210');
  // Pattes-lianes qui s'enroulent au sol
  px(14,48,8,12,'#3a5820'); px(42,48,8,12,'#3a5820');
  px(10,54,12,8,'#2a4418'); px(42,54,12,8,'#2a4418');
  // Épines aux pieds
  px(12,58,2,4,'#a8c048'); px(50,58,2,4,'#a8c048'); px(20,58,2,4,'#a8c048'); px(42,58,2,4,'#a8c048');
  // Marbrures jaunes/dorées
  ctx.globalAlpha=0.6;
  px(24,32,8,2,'#a8c048'); px(38,40,4,3,'#a8c048');
  ctx.globalAlpha=1;
};

// 🔥 FEU — 2 PokePoms R2

PM_SPRITES.braslune = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Lune en arrière-plan (petite)
  ctx.globalAlpha=0.3;
  px(50,4,10,10,'#ffeebb'); px(52,6,8,8,'#ffe888');
  ctx.globalAlpha=1;
  // Tête de loup
  px(16,8,28,8,'#3a2418'); px(14,12,32,8,'#2a1812'); px(16,18,28,4,'#1e1008');
  // Oreilles pointues
  px(14,4,6,8,'#3a2418'); px(16,2,4,4,'#4a3020');
  px(40,4,6,8,'#3a2418'); px(42,2,4,4,'#4a3020');
  // Pelage incandescent (touches de braise)
  ctx.globalAlpha=0.7;
  px(18,10,4,3,'#aa3818'); px(38,10,4,3,'#aa3818'); px(24,8,3,2,'#cc4820');
  ctx.globalAlpha=1;
  // Yeux jaunes brûlants
  px(20,13,4,4,'#1a0a08'); px(21,14,2,2,'#ffcc00'); px(22,15,1,1,'#ffffff');
  px(36,13,4,4,'#1a0a08'); px(37,14,2,2,'#ffcc00'); px(38,15,1,1,'#ffffff');
  // Museau étroit
  px(26,18,8,5,'#2a1812'); px(28,21,4,2,'#1e1008');
  px(28,22,4,1,'#3e2818');
  // Crocs visibles
  px(24,22,2,4,'#ffeebb'); px(34,22,2,4,'#ffeebb');
  // Corps
  px(14,22,32,12,'#3a2418'); px(12,26,36,12,'#2a1812'); px(14,36,32,4,'#1e1008');
  // Crinière de feu sur le dos
  px(20,18,4,4,'#cc4820'); px(28,16,4,5,'#dd6028'); px(36,18,4,4,'#cc4820');
  ctx.globalAlpha=0.8;
  px(22,20,2,3,'#ff7030'); px(30,18,2,4,'#ff8838'); px(38,20,2,3,'#ff7030');
  ctx.globalAlpha=1;
  // Marques de feu sur les flancs
  ctx.globalAlpha=0.6;
  px(18,30,5,4,'#aa3818'); px(38,32,5,4,'#aa3818'); px(28,34,4,2,'#cc4820');
  ctx.globalAlpha=1;
  // Pattes
  px(14,38,8,12,'#2a1812'); px(12,44,8,8,'#1e1008');
  px(40,38,8,12,'#2a1812'); px(42,44,8,8,'#1e1008');
  px(22,40,6,10,'#2a1812'); px(34,40,6,10,'#2a1812');
  // Pattes avec lueur de braise
  ctx.globalAlpha=0.6;
  px(14,46,2,4,'#ff6020'); px(46,46,2,4,'#ff6020');
  ctx.globalAlpha=1;
  // Griffes
  px(12,50,8,3,'#5a3a28'); px(40,50,8,3,'#5a3a28');
  px(20,50,6,2,'#5a3a28'); px(34,50,6,2,'#5a3a28');
  // Queue avec flammes
  px(46,28,4,8,'#3a2418'); px(48,24,5,6,'#cc4820'); px(52,20,3,6,'#dd6028'); px(54,16,2,4,'#ff8838');
  ctx.globalAlpha=0.7;
  px(50,18,2,3,'#ffcc00');
  ctx.globalAlpha=1;
  // Étincelles autour
  ctx.globalAlpha=0.8;
  px(4,12,1,1,'#ff8838'); px(60,30,1,1,'#ff8838'); px(2,40,2,1,'#ffcc00'); px(58,42,1,1,'#ffcc00');
  ctx.globalAlpha=1;
};

PM_SPRITES.pyrecate = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Antennes
  px(22,2,2,6,'#b8401a'); px(40,2,2,6,'#b8401a');
  px(20,0,2,3,'#dd6028'); px(42,0,2,3,'#dd6028');
  // Tête triangulaire de mante
  px(20,6,24,6,'#cc4820'); px(18,10,28,6,'#a8381a'); px(20,16,24,4,'#7a2810');
  // Yeux composés énormes
  px(18,8,8,8,'#1a0808'); px(19,9,6,6,'#ffaa44');
  px(38,8,8,8,'#1a0808'); px(39,9,6,6,'#ffaa44');
  // Reflets dans les yeux
  px(20,9,2,2,'#ffeebb'); px(40,9,2,2,'#ffeebb');
  px(22,12,1,1,'#ff6020'); px(42,12,1,1,'#ff6020');
  // Mandibules
  px(28,18,8,3,'#1a0808'); px(26,20,3,2,'#3a1810'); px(35,20,3,2,'#3a1810');
  // Cou fin
  px(28,20,8,4,'#a8381a'); px(30,22,4,3,'#7a2810');
  // Thorax (corps insectoïde)
  px(20,24,24,10,'#cc4820'); px(18,28,28,10,'#a8381a'); px(20,36,24,4,'#7a2810');
  // Marques flamboyantes sur le thorax
  ctx.globalAlpha=0.8;
  px(22,28,4,4,'#ff7030'); px(38,30,4,4,'#ff7030'); px(28,32,8,2,'#ff8838');
  ctx.globalAlpha=1;
  // LAMES (les avant-bras de mante)
  // Bras gauche
  px(8,20,12,4,'#a8381a'); px(4,16,10,4,'#7a2810');
  // Lame gauche
  px(2,8,6,12,'#cc4820'); px(0,10,4,10,'#a8381a'); px(0,4,3,8,'#dd6028');
  // Tranchant éclatant gauche
  ctx.globalAlpha=0.9;
  px(0,8,2,12,'#ffaa44'); px(0,4,2,4,'#ffeebb');
  ctx.globalAlpha=1;
  // Bras droit
  px(44,20,12,4,'#a8381a'); px(50,16,10,4,'#7a2810');
  // Lame droite
  px(56,8,6,12,'#cc4820'); px(60,10,4,10,'#a8381a'); px(61,4,3,8,'#dd6028');
  ctx.globalAlpha=0.9;
  px(62,8,2,12,'#ffaa44'); px(62,4,2,4,'#ffeebb');
  ctx.globalAlpha=1;
  // Ailes repliées arrière
  ctx.globalAlpha=0.7;
  px(12,28,8,16,'#a8381a'); px(44,28,8,16,'#a8381a');
  ctx.globalAlpha=0.5;
  px(10,32,8,12,'#cc4820'); px(46,32,8,12,'#cc4820');
  ctx.globalAlpha=1;
  // Veines des ailes
  px(14,32,1,8,'#3a1810'); px(49,32,1,8,'#3a1810');
  // Abdomen segmenté
  px(20,40,24,16,'#7a2810'); px(22,44,20,12,'#5e1c08');
  // Segments de l'abdomen
  px(20,44,24,1,'#3a1810'); px(20,48,24,1,'#3a1810'); px(20,52,24,1,'#3a1810');
  // Marques de braise sur l'abdomen
  ctx.globalAlpha=0.7;
  px(28,42,8,2,'#ff7030'); px(28,46,8,2,'#ff7030'); px(28,50,8,2,'#ff7030');
  ctx.globalAlpha=1;
  // Pattes
  px(20,46,4,8,'#3a1810'); px(40,46,4,8,'#3a1810');
  px(18,52,4,8,'#3a1810'); px(42,52,4,8,'#3a1810');
  // Étincelles
  ctx.globalAlpha=0.7;
  px(8,4,1,1,'#ff8838'); px(56,4,1,1,'#ff8838'); px(28,4,1,1,'#ffeebb');
  ctx.globalAlpha=1;
};

// 💧 EAU — 1 PokePom R2

PM_SPRITES.profondine = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Eaux profondes en arrière-plan
  ctx.globalAlpha=0.5;
  px(0,0,64,64,'#0a1830');
  ctx.globalAlpha=1;
  // Tête d'anguille
  px(8,12,16,8,'#1a3a5a'); px(6,14,18,8,'#0e2a48'); px(8,20,16,4,'#081a30');
  // Yeux luisants vert phosphorescent
  px(10,15,4,4,'#0a0a1a'); px(11,16,2,2,'#88ff88'); px(12,17,1,1,'#ffffff');
  px(18,15,4,4,'#0a0a1a'); px(19,16,2,2,'#88ff88'); px(20,17,1,1,'#ffffff');
  // Lueur autour des yeux
  ctx.globalAlpha=0.5;
  px(8,13,8,8,'#88ff88'); px(16,13,8,8,'#88ff88');
  ctx.globalAlpha=1;
  // Mâchoire entrouverte avec dents
  px(8,21,16,3,'#000810'); px(10,22,2,2,'#ddffdd'); px(14,22,2,2,'#ddffdd'); px(18,22,2,2,'#ddffdd');
  // Antennes lumineuses (lampes)
  px(12,4,2,8,'#1a3a5a'); px(20,4,2,8,'#1a3a5a');
  // Bulbes lumineux
  px(11,2,4,4,'#88ff88'); px(19,2,4,4,'#88ff88');
  ctx.globalAlpha=0.7;
  px(10,1,6,6,'#ccffcc'); px(18,1,6,6,'#ccffcc');
  ctx.globalAlpha=1;
  px(12,3,2,2,'#ffffff'); px(20,3,2,2,'#ffffff');
  // Corps long et serpentin
  px(20,18,16,10,'#1a3a5a'); px(28,22,18,10,'#0e2a48'); px(38,28,16,8,'#1a3a5a');
  px(46,32,12,8,'#0e2a48'); px(50,36,10,6,'#1a3a5a');
  // Ventre clair
  px(20,24,12,4,'#3a6a8a'); px(32,28,12,4,'#3a6a8a'); px(42,34,8,3,'#3a6a8a');
  // Marbrures bioluminescentes
  ctx.globalAlpha=0.7;
  px(24,20,4,3,'#88ffaa'); px(38,24,4,3,'#88ffaa'); px(48,30,4,3,'#88ffaa');
  ctx.globalAlpha=1;
  // Nageoires dorsales
  ctx.globalAlpha=0.7;
  px(18,12,4,8,'#3a6a8a'); px(28,16,4,7,'#3a6a8a'); px(40,22,4,6,'#3a6a8a'); px(50,28,4,4,'#3a6a8a');
  ctx.globalAlpha=1;
  // Continuation du corps qui s'enroule
  px(46,38,10,8,'#0e2a48'); px(40,42,12,8,'#1a3a5a'); px(30,46,14,8,'#0e2a48');
  px(18,50,16,8,'#1a3a5a'); px(8,54,12,6,'#0e2a48');
  // Queue en pointe
  px(2,54,8,5,'#1a3a5a'); px(0,56,4,3,'#3a6a8a');
  // Petite nageoire de queue
  ctx.globalAlpha=0.8;
  px(0,52,4,3,'#3a6a8a'); px(0,58,4,3,'#3a6a8a');
  ctx.globalAlpha=1;
  // Bulles
  ctx.globalAlpha=0.6;
  px(28,8,2,2,'#aaccff'); px(48,12,2,2,'#aaccff'); px(58,40,2,2,'#aaccff'); px(40,4,1,1,'#ffffff');
  ctx.globalAlpha=1;
};

// ⚡ ÉLECTRIQUE — 1 PokePom R2

PM_SPRITES.voltaigle = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Éclairs en arrière-plan
  ctx.globalAlpha=0.3;
  px(2,2,4,2,'#ffeb44'); px(4,4,3,4,'#ffeb44'); px(2,8,2,2,'#ffeb44');
  px(58,16,4,2,'#ffeb44'); px(56,18,3,3,'#ffeb44');
  ctx.globalAlpha=1;
  // Tête noble d'aigle
  px(20,6,20,6,'#5a3a20'); px(18,10,24,6,'#4a2818'); px(20,14,20,4,'#3a1c10');
  // Bec recourbé puissant
  px(22,12,4,8,'#ffcc44'); px(20,14,4,6,'#ddaa30'); px(22,18,2,3,'#ddaa30');
  px(18,16,3,3,'#3a1c10');
  // Yeux perçants jaunes
  px(28,10,4,5,'#1a1a08'); px(29,11,2,3,'#ffeb44'); px(30,12,1,1,'#ffffff');
  px(36,10,4,5,'#1a1a08'); px(37,11,2,3,'#ffeb44'); px(38,12,1,1,'#ffffff');
  // Plumes de tête (crête)
  px(24,4,4,5,'#3a1c10'); px(36,4,4,5,'#3a1c10'); px(30,2,4,4,'#5a3a20');
  // Étincelles électriques sur la crête
  ctx.globalAlpha=0.9;
  px(26,2,2,2,'#ffeb44'); px(38,3,2,2,'#ffeb44'); px(32,0,2,2,'#ffffff');
  ctx.globalAlpha=1;
  // Cou
  px(26,18,12,4,'#4a2818'); px(28,20,8,2,'#3a1c10');
  // Corps
  px(20,22,24,12,'#5a3a20'); px(18,26,28,12,'#4a2818'); px(20,36,24,4,'#3a1c10');
  // Plastron clair
  px(26,26,12,8,'#a87850'); px(28,28,8,6,'#c08858');
  // Plumes texturées
  ctx.globalAlpha=0.5;
  px(22,28,4,2,'#3a1c10'); px(40,30,4,2,'#3a1c10'); px(24,32,3,2,'#3a1c10'); px(38,34,3,2,'#3a1c10');
  ctx.globalAlpha=1;
  // GRANDES AILES déployées
  // Aile gauche
  px(0,18,18,8,'#4a2818'); px(2,14,16,6,'#5a3a20');
  px(0,26,16,6,'#3a1c10'); px(2,30,14,4,'#2a1208');
  // Plumes pointes aile gauche
  px(0,16,4,2,'#3a1c10'); px(0,22,3,2,'#3a1c10'); px(0,28,4,2,'#3a1c10');
  // Aile droite
  px(46,18,18,8,'#4a2818'); px(46,14,16,6,'#5a3a20');
  px(48,26,16,6,'#3a1c10'); px(48,30,14,4,'#2a1208');
  px(60,16,4,2,'#3a1c10'); px(61,22,3,2,'#3a1c10'); px(60,28,4,2,'#3a1c10');
  // Étincelles électriques sur les ailes
  ctx.globalAlpha=0.9;
  px(8,18,2,2,'#ffeb44'); px(54,20,2,2,'#ffeb44'); px(4,28,2,2,'#ffffff'); px(58,28,2,2,'#ffffff');
  ctx.globalAlpha=1;
  // Serres
  px(22,40,6,10,'#ffcc44'); px(36,40,6,10,'#ffcc44');
  px(20,48,8,4,'#ddaa30'); px(36,48,8,4,'#ddaa30');
  // Griffes
  px(20,52,2,6,'#1a1a08'); px(24,52,2,6,'#1a1a08'); px(28,52,2,6,'#1a1a08');
  px(36,52,2,6,'#1a1a08'); px(40,52,2,6,'#1a1a08'); px(44,52,2,6,'#1a1a08');
  // Foudre dans la serre droite
  ctx.globalAlpha=0.9;
  px(46,42,2,8,'#ffeb44'); px(48,46,3,6,'#ffeb44'); px(50,50,2,5,'#ffffff');
  px(48,52,4,3,'#ffeb44');
  ctx.globalAlpha=1;
  px(48,42,1,4,'#ffffff'); px(50,48,1,3,'#ffffff');
  // Queue
  px(28,38,8,12,'#4a2818'); px(30,46,4,8,'#3a1c10');
  // Petites étincelles
  ctx.globalAlpha=0.7;
  px(12,4,1,1,'#ffeb44'); px(50,4,1,1,'#ffeb44'); px(2,40,1,1,'#ffffff'); px(60,40,1,1,'#ffffff');
  ctx.globalAlpha=1;
};

// 🌀 AIR — 1 PokePom R2

PM_SPRITES.brumelope = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Brume aurorale
  ctx.globalAlpha=0.3;
  px(0,4,64,12,'#ffccaa'); px(0,12,64,8,'#ffaa88'); px(0,18,64,6,'#ddccff');
  ctx.globalAlpha=1;
  // Cornes longues élégantes
  px(18,4,2,12,'#ddccaa'); px(16,2,2,8,'#eedccc'); px(14,0,2,4,'#ffffff');
  px(44,4,2,12,'#ddccaa'); px(46,2,2,8,'#eedccc'); px(48,0,2,4,'#ffffff');
  // Stries sur les cornes
  px(18,8,2,1,'#aa9988'); px(18,12,2,1,'#aa9988'); px(44,8,2,1,'#aa9988'); px(44,12,2,1,'#aa9988');
  // Tête fine
  px(20,10,24,8,'#f0d8b8'); px(18,14,28,6,'#dcc098'); px(20,18,24,4,'#bca680');
  // Yeux doux
  px(22,15,4,4,'#1a1a22'); px(23,16,2,2,'#ffccaa'); px(24,17,1,1,'#ffffff');
  px(38,15,4,4,'#1a1a22'); px(39,16,2,2,'#ffccaa'); px(40,17,1,1,'#ffffff');
  // Marques d'aurore sur le visage
  ctx.globalAlpha=0.5;
  px(28,12,8,2,'#ddccff'); px(30,14,4,2,'#ffccaa');
  ctx.globalAlpha=1;
  // Petit museau
  px(30,18,4,3,'#ffffff'); px(31,19,2,1,'#1a1a22');
  // Cou élancé
  px(28,20,8,6,'#dcc098'); px(30,24,4,4,'#bca680');
  // Corps fin et long
  px(18,26,28,10,'#f0d8b8'); px(16,30,32,10,'#dcc098'); px(18,38,28,4,'#bca680');
  // Marques aurorales sur le flanc
  ctx.globalAlpha=0.5;
  px(22,30,8,3,'#ddccff'); px(36,32,8,3,'#ffccaa');
  ctx.globalAlpha=1;
  // Pattes longues et fines (hautes)
  // Avant
  px(20,42,4,14,'#bca680'); px(18,52,4,8,'#9c8460');
  px(38,42,4,14,'#bca680'); px(40,52,4,8,'#9c8460');
  // Arrière (plus courtes)
  px(28,42,4,14,'#bca680'); px(30,54,4,6,'#9c8460');
  px(36,42,4,14,'#bca680'); px(34,54,4,6,'#9c8460');
  // Sabots fins
  px(16,58,8,4,'#5a4830'); px(38,58,8,4,'#5a4830');
  px(28,58,5,4,'#5a4830'); px(34,58,5,4,'#5a4830');
  // Petite queue
  px(46,28,4,6,'#dcc098'); px(48,32,3,4,'#bca680');
  px(48,36,2,5,'#ffffff'); px(48,40,2,3,'#dcc098');
  // Particules de brume
  ctx.globalAlpha=0.5;
  px(2,30,2,2,'#ffffff'); px(60,32,2,2,'#ffffff'); px(4,48,2,2,'#ddccff'); px(58,50,2,2,'#ddccff');
  px(8,20,1,1,'#ffccaa'); px(54,22,1,1,'#ffccaa');
  ctx.globalAlpha=1;
};

// 🌑 OMBRE — 1 PokePom R2

PM_SPRITES.voilombre = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura sombre
  ctx.globalAlpha=0.3;
  px(8,12,48,48,'#3a2a4a'); px(12,16,40,40,'#2a1a3a');
  ctx.globalAlpha=1;
  // Capuche du manteau
  px(20,4,24,8,'#3a2a4a'); px(16,8,32,8,'#2a1a3a'); px(18,14,28,6,'#1a0a28');
  // Bords de la capuche pointus
  px(14,10,4,6,'#1a0a28'); px(46,10,4,6,'#1a0a28');
  px(16,6,4,4,'#3a2a4a'); px(44,6,4,4,'#3a2a4a');
  // Intérieur sombre de la capuche (vide)
  px(22,14,20,8,'#000008');
  // Yeux flottants dans l'obscurité
  px(26,16,4,4,'#aabbff'); px(34,16,4,4,'#aabbff');
  ctx.globalAlpha=0.8;
  px(25,15,6,6,'#ddeeff'); px(33,15,6,6,'#ddeeff');
  ctx.globalAlpha=1;
  px(27,17,2,2,'#ffffff'); px(35,17,2,2,'#ffffff');
  // Manteau qui tombe (corps)
  px(14,20,36,16,'#3a2a4a'); px(12,24,40,16,'#2a1a3a'); px(14,36,36,8,'#1a0a28');
  // Plis du tissu
  ctx.globalAlpha=0.6;
  px(20,26,2,12,'#1a0a28'); px(30,28,2,10,'#1a0a28'); px(40,26,2,12,'#1a0a28');
  ctx.globalAlpha=1;
  // Bordures dorées (vestige du voyageur)
  ctx.globalAlpha=0.7;
  px(14,20,36,1,'#aa8844'); px(14,38,36,1,'#aa8844');
  ctx.globalAlpha=1;
  // Manches déchirées
  px(8,22,8,12,'#3a2a4a'); px(6,28,8,8,'#2a1a3a'); px(4,32,6,6,'#1a0a28');
  px(48,22,8,12,'#3a2a4a'); px(50,28,8,8,'#2a1a3a'); px(54,32,6,6,'#1a0a28');
  // Mains spectrales (à peine visibles)
  ctx.globalAlpha=0.6;
  px(2,34,6,6,'#5060a0'); px(56,34,6,6,'#5060a0');
  ctx.globalAlpha=1;
  // Bas du manteau qui se dissout
  ctx.globalAlpha=0.8;
  px(12,42,40,8,'#2a1a3a'); px(14,46,36,6,'#1a0a28');
  ctx.globalAlpha=0.6;
  px(14,50,36,6,'#3a2a4a'); px(18,54,28,4,'#2a1a3a');
  ctx.globalAlpha=0.4;
  px(18,56,28,4,'#3a2a4a'); px(22,58,20,4,'#2a1a3a');
  ctx.globalAlpha=0.2;
  px(24,60,16,3,'#3a2a4a');
  ctx.globalAlpha=1;
  // Broche centrale (l'âme du voyageur)
  px(30,28,4,4,'#aa8844'); px(31,29,2,2,'#ffeebb'); px(32,30,1,1,'#ffffff');
  ctx.globalAlpha=0.5;
  px(28,26,8,8,'#ffeebb');
  ctx.globalAlpha=1;
  // Particules d'âme
  ctx.globalAlpha=0.7;
  px(4,16,1,1,'#aabbff'); px(60,18,1,1,'#aabbff');
  px(2,42,2,2,'#5060a0'); px(60,44,2,2,'#5060a0');
  px(8,56,1,1,'#aabbff'); px(56,58,1,1,'#aabbff');
  ctx.globalAlpha=1;
};


// SPRITES ÉVOLUTIONS — Premier batch test (5 sprites pour validation)

// 🌿 Pomalor — évolution de Pomalis (couronne végétale + parfum)
PM_SPRITES.pomalor = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Couronne de fleurs au-dessus de la tête
  px(20,2,6,4,'#ff8888'); px(28,0,8,5,'#ff6666'); px(38,2,6,4,'#ff8888');
  px(22,3,2,2,'#ffaaaa'); px(30,1,4,2,'#ffcccc'); px(40,3,2,2,'#ffaaaa');
  px(22,5,20,2,'#aa3030'); // tige de couronne
  // Bulbe en couronne (plus grand que Pomalis)
  px(18,7,28,8,'#88c850'); px(16,11,32,8,'#5a9830'); px(18,17,28,4,'#3e7020');
  // Pétales sur le bulbe
  ctx.globalAlpha=0.7;
  px(20,9,4,3,'#ff6666'); px(40,11,4,3,'#ffcc66'); px(28,8,4,3,'#ffaaff');
  ctx.globalAlpha=1;
  // Tête (verte)
  px(18,20,28,12,'#88c850'); px(16,24,32,10,'#6aa040'); px(18,32,28,4,'#3e7020');
  // Yeux (plus grands, royaux)
  px(22,24,5,6,'#1a2a14'); px(23,25,3,4,'#88dd44'); px(24,26,1,2,'#ffffff');
  px(37,24,5,6,'#1a2a14'); px(38,25,3,4,'#88dd44'); px(39,26,1,2,'#ffffff');
  // Joues fleuries
  px(20,30,3,3,'#ffaacc'); px(41,30,3,3,'#ffaacc');
  // Sourire serein
  px(28,32,8,2,'#1a1a14'); px(30,33,4,1,'#5a3018');
  // Corps
  px(14,34,36,12,'#88c850'); px(12,38,40,12,'#6aa040'); px(14,46,36,4,'#3e7020');
  // Vrilles parfumées s'échappant
  ctx.globalAlpha=0.6;
  px(8,36,4,3,'#88c850'); px(4,38,4,4,'#88c850'); px(2,42,3,3,'#88c850');
  px(52,36,4,3,'#88c850'); px(56,38,4,4,'#88c850'); px(59,42,3,3,'#88c850');
  ctx.globalAlpha=1;
  // Pattes
  px(16,50,10,12,'#3e7020'); px(38,50,10,12,'#3e7020');
  px(14,56,12,8,'#2a4818'); px(38,56,12,8,'#2a4818');
  // Pétales qui flottent autour
  ctx.globalAlpha=0.8;
  px(2,18,2,2,'#ff8888'); px(60,22,2,2,'#ffaaff'); px(4,52,2,2,'#ffcc66'); px(58,54,2,2,'#ff8888');
  px(8,8,1,1,'#ffaaff'); px(54,12,1,1,'#ffcc66');
  ctx.globalAlpha=1;
};

// 🔥 Brasileon — évolution de Flamèche (lézard royal)
PM_SPRITES.brasileon = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura ardente
  ctx.globalAlpha=0.3;
  px(0,4,64,56,'#ff6020');
  ctx.globalAlpha=1;
  // Cornes royales
  px(14,4,3,8,'#5a2010'); px(12,6,3,5,'#3e1408'); px(13,2,3,3,'#7a3018');
  px(47,4,3,8,'#5a2010'); px(48,6,3,5,'#3e1408'); px(48,2,3,3,'#7a3018');
  // Tête de lézard royal
  px(18,8,28,8,'#ff6020'); px(16,12,32,8,'#cc4818'); px(18,18,28,4,'#9a3010');
  // Crête de feu sur la tête
  px(24,4,4,6,'#ffaa20'); px(30,2,4,8,'#ffcc40'); px(36,4,4,6,'#ffaa20');
  ctx.globalAlpha=0.8;
  px(26,2,2,4,'#ffee88'); px(32,0,2,4,'#ffffff'); px(38,2,2,4,'#ffee88');
  ctx.globalAlpha=1;
  // Yeux royaux
  px(22,14,4,5,'#1a0a08'); px(23,15,2,3,'#ffeb44'); px(24,16,1,1,'#ffffff');
  px(38,14,4,5,'#1a0a08'); px(39,15,2,3,'#ffeb44'); px(40,16,1,1,'#ffffff');
  // Museau royal
  px(28,20,8,4,'#cc4818'); px(30,22,4,2,'#9a3010');
  // Crocs
  px(26,22,2,4,'#ffeebb'); px(36,22,2,4,'#ffeebb');
  // Cou
  px(24,24,16,4,'#cc4818');
  // Poitrail incandescent (caractéristique principale)
  px(22,28,20,12,'#ffaa20'); px(26,30,12,8,'#ffcc40'); px(28,32,8,4,'#ffee88');
  ctx.globalAlpha=0.8;
  px(30,33,4,2,'#ffffff');
  ctx.globalAlpha=1;
  // Corps autour du poitrail
  px(14,28,8,16,'#cc4818'); px(42,28,8,16,'#cc4818');
  px(12,32,8,12,'#9a3010'); px(44,32,8,12,'#9a3010');
  px(14,40,36,6,'#9a3010');
  // Bras avec griffes
  px(8,32,8,12,'#cc4818'); px(48,32,8,12,'#cc4818');
  px(6,40,8,6,'#9a3010'); px(50,40,8,6,'#9a3010');
  // Griffes ardentes
  px(4,42,4,6,'#ffaa20'); px(56,42,4,6,'#ffaa20');
  px(4,46,2,3,'#ffeebb'); px(58,46,2,3,'#ffeebb');
  // Pattes
  px(16,46,10,14,'#9a3010'); px(38,46,10,14,'#9a3010');
  px(14,54,12,8,'#5a2010'); px(38,54,12,8,'#5a2010');
  // Queue royale avec flamme
  px(46,38,8,8,'#cc4818'); px(50,42,8,6,'#ffaa20'); px(54,38,6,8,'#ffcc40');
  px(58,34,4,8,'#ffee88'); px(60,30,3,6,'#ffffff');
  ctx.globalAlpha=0.8;
  px(56,40,2,4,'#ffeebb');
  ctx.globalAlpha=1;
  // Étincelles royales
  ctx.globalAlpha=0.9;
  px(2,16,1,1,'#ffeb44'); px(62,18,1,1,'#ffeb44'); px(4,52,2,1,'#ffaa20'); px(58,52,2,1,'#ffaa20');
  ctx.globalAlpha=1;
};

// 💧 Goutaragon — évolution de Goutapom (seigneur des torrents)
PM_SPRITES.goutaragon = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura aquatique
  ctx.globalAlpha=0.3;
  px(0,8,64,52,'#3a7bd4');
  ctx.globalAlpha=1;
  // Antennes-bulbes (gemmes-cascade)
  px(20,2,4,8,'#1a3a5a'); px(40,2,4,8,'#1a3a5a');
  px(18,0,4,4,'#88ddff'); px(40,0,4,4,'#88ddff');
  ctx.globalAlpha=0.8;
  px(19,1,2,2,'#ffffff'); px(41,1,2,2,'#ffffff');
  ctx.globalAlpha=1;
  // Tête seigneuriale
  px(16,8,32,8,'#3a7bd4'); px(14,12,36,8,'#2a5a9a'); px(16,18,32,4,'#1a3a5a');
  // Couronne d'eau
  px(22,6,20,2,'#88ddff'); px(26,4,4,2,'#aaeeff'); px(34,4,4,2,'#aaeeff');
  ctx.globalAlpha=0.8;
  px(24,5,2,3,'#ffffff'); px(36,5,2,3,'#ffffff');
  ctx.globalAlpha=1;
  // Yeux royaux turquoise
  px(20,14,5,5,'#0a1830'); px(21,15,3,3,'#88ddff'); px(22,16,1,1,'#ffffff');
  px(39,14,5,5,'#0a1830'); px(40,15,3,3,'#88ddff'); px(41,16,1,1,'#ffffff');
  // Bouche
  px(28,20,8,3,'#1a3a5a'); px(30,21,4,1,'#000810');
  // Cou avec branchies
  px(22,22,20,4,'#2a5a9a'); px(20,24,4,3,'#88ddff'); px(40,24,4,3,'#88ddff');
  // Corps massif
  px(12,26,40,16,'#3a7bd4'); px(10,30,44,16,'#2a5a9a'); px(12,42,40,4,'#1a3a5a');
  // Ventre clair
  px(20,32,24,8,'#88ddff'); px(22,34,20,4,'#aaeeff');
  // Marques d'écailles brillantes
  ctx.globalAlpha=0.7;
  px(16,30,4,3,'#88ddff'); px(46,32,4,3,'#88ddff'); px(28,42,8,2,'#88ddff');
  ctx.globalAlpha=1;
  // Bras puissants avec palmes
  px(4,28,10,14,'#2a5a9a'); px(2,32,10,10,'#1a3a5a');
  px(50,28,10,14,'#2a5a9a'); px(52,32,10,10,'#1a3a5a');
  // Palmes
  px(0,38,8,8,'#3a7bd4'); px(56,38,8,8,'#3a7bd4');
  ctx.globalAlpha=0.7;
  px(1,40,5,5,'#88ddff'); px(58,40,5,5,'#88ddff');
  ctx.globalAlpha=1;
  // Pattes
  px(14,46,12,12,'#2a5a9a'); px(38,46,12,12,'#2a5a9a');
  px(12,54,14,6,'#1a3a5a'); px(38,54,14,6,'#1a3a5a');
  // Pieds palmés
  px(10,58,18,4,'#3a7bd4'); px(36,58,18,4,'#3a7bd4');
  // Queue avec nageoire
  px(46,40,8,10,'#2a5a9a'); px(48,46,10,8,'#1a3a5a');
  ctx.globalAlpha=0.8;
  px(54,44,8,8,'#88ddff'); px(56,48,6,6,'#aaeeff');
  ctx.globalAlpha=1;
  // Bulles
  ctx.globalAlpha=0.7;
  px(4,12,2,2,'#aaeeff'); px(58,16,2,2,'#aaeeff'); px(2,52,1,1,'#ffffff'); px(60,54,1,1,'#ffffff');
  ctx.globalAlpha=1;
};

// ❄️ Cristelune — évolution de Cristellis (biche-prêtresse)
PM_SPRITES.cristelune = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Halo lunaire constellation
  ctx.globalAlpha=0.4;
  px(8,4,48,16,'#ddccff'); px(12,8,40,8,'#aaccff');
  ctx.globalAlpha=1;
  // Étoiles dans le halo
  ctx.globalAlpha=0.9;
  px(14,6,1,1,'#ffffff'); px(50,8,1,1,'#ffffff'); px(20,10,1,1,'#ffeeff');
  px(44,4,1,1,'#ffeeff'); px(30,12,1,1,'#ffffff');
  ctx.globalAlpha=1;
  // Bois cristallins constellés (plus majestueux)
  px(14,2,3,12,'#aaccff'); px(10,4,3,8,'#88aaee'); px(8,8,2,4,'#ddeeff');
  px(12,8,2,3,'#ffffff'); px(16,4,2,4,'#ffffff');
  px(47,2,3,12,'#aaccff'); px(51,4,3,8,'#88aaee'); px(54,8,2,4,'#ddeeff');
  px(50,8,2,3,'#ffffff'); px(46,4,2,4,'#ffffff');
  // Étoile au sommet des bois
  ctx.globalAlpha=0.9;
  px(14,1,2,2,'#ffffff'); px(48,1,2,2,'#ffffff');
  ctx.globalAlpha=1;
  // Diadème lumineux
  px(22,10,20,2,'#ddeeff'); px(28,8,8,2,'#ffffff');
  ctx.globalAlpha=0.8;
  px(30,7,4,2,'#ddccff');
  ctx.globalAlpha=1;
  // Tête (forme allongée plus mature)
  px(20,12,24,8,'#ddeeff'); px(18,16,28,8,'#bcd0ee'); px(20,22,24,4,'#9cb0d8');
  // Marques sacrées sur le visage
  ctx.globalAlpha=0.6;
  px(28,14,8,2,'#ddccff');
  ctx.globalAlpha=1;
  // Yeux profonds (plus grands, royaux)
  px(22,15,5,6,'#1a2a44'); px(23,16,3,4,'#aaeeff'); px(24,17,1,2,'#ffffff');
  px(37,15,5,6,'#1a2a44'); px(38,16,3,4,'#aaeeff'); px(39,17,1,2,'#ffffff');
  // Museau délicat
  px(30,22,4,3,'#ffffff'); px(31,23,2,1,'#ddeeff');
  // Corps élancé
  px(16,26,32,12,'#ddeeff'); px(14,30,36,10,'#bcd0ee'); px(16,38,32,4,'#9cb0d8');
  // Robe constellation
  ctx.globalAlpha=0.7;
  px(20,30,4,4,'#ddccff'); px(26,32,4,4,'#aaccff'); px(34,30,4,4,'#ddccff'); px(40,32,4,4,'#aaccff');
  ctx.globalAlpha=1;
  // Étoiles brillantes sur la robe
  ctx.globalAlpha=0.9;
  px(22,32,1,1,'#ffffff'); px(28,34,1,1,'#ffffff'); px(36,32,1,1,'#ffffff'); px(42,34,1,1,'#ffffff');
  ctx.globalAlpha=1;
  // Pattes longues
  px(16,40,5,14,'#9cb0d8'); px(14,48,5,10,'#7c90b8');
  px(43,40,5,14,'#9cb0d8'); px(45,48,5,10,'#7c90b8');
  px(22,42,5,12,'#9cb0d8'); px(37,42,5,12,'#9cb0d8');
  // Sabots étoilés
  px(13,58,8,4,'#aaccff'); px(43,58,8,4,'#aaccff');
  px(20,56,7,4,'#aaccff'); px(37,56,7,4,'#aaccff');
  ctx.globalAlpha=0.8;
  px(15,60,4,1,'#ffffff'); px(45,60,4,1,'#ffffff');
  ctx.globalAlpha=1;
  // Queue stellaire
  px(46,30,4,4,'#ddeeff'); px(50,32,3,4,'#ffffff');
  ctx.globalAlpha=0.7;
  px(52,30,3,3,'#ddccff');
  ctx.globalAlpha=1;
  // Particules constellées
  ctx.globalAlpha=0.7;
  px(2,28,1,1,'#ffffff'); px(60,30,1,1,'#ffffff'); px(4,46,2,2,'#ddccff'); px(58,48,2,2,'#aaccff');
  ctx.globalAlpha=1;
};

// ⚙️ Aciérox — évolution d'Aciérus (chevalier-roi)
PM_SPRITES.acierox = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura royale
  ctx.globalAlpha=0.3;
  px(2,2,60,60,'#5060a0');
  ctx.globalAlpha=1;
  // Heaume royal (plus haut, plus orné)
  px(20,2,24,4,'#ccd4e4'); px(18,4,28,8,'#aab4c4'); px(20,10,24,4,'#8898ac');
  // Plumet doré royal (plus grand)
  px(26,0,12,3,'#ddaa30'); px(28,0,8,2,'#ffcc44'); px(30,0,4,2,'#ffeebb');
  // Couronne sur le heaume
  px(22,3,20,2,'#ffcc44'); px(26,1,4,3,'#ffeebb'); px(34,1,4,3,'#ffeebb');
  // Visière sombre avec lueur dorée perçante
  px(20,12,24,5,'#3a4458'); px(22,14,8,2,'#ffcc44'); px(34,14,8,2,'#ffcc44');
  ctx.globalAlpha=0.9;
  px(23,15,6,1,'#ffeebb'); px(35,15,6,1,'#ffeebb');
  ctx.globalAlpha=1;
  // Cou armoré
  px(24,17,16,4,'#8898ac'); px(26,19,12,2,'#6a7a90');
  // Plastron royal massif
  px(12,21,40,18,'#ccd4e4'); px(10,25,44,16,'#aab4c4'); px(12,39,40,4,'#8898ac');
  // Croix royale dorée
  px(31,23,2,14,'#ffcc44'); px(24,29,16,2,'#ffcc44');
  ctx.globalAlpha=0.8;
  px(31,23,2,1,'#ffeebb'); px(24,29,16,1,'#ffeebb');
  ctx.globalAlpha=1;
  // Joyaux sur le plastron
  px(20,32,3,3,'#ff4444'); px(41,32,3,3,'#4488ff');
  ctx.globalAlpha=0.9;
  px(21,33,1,1,'#ffaaaa'); px(42,33,1,1,'#aaccff');
  ctx.globalAlpha=1;
  // Épaulières royales
  px(4,21,12,10,'#ccd4e4'); px(2,25,12,8,'#aab4c4'); px(2,29,14,6,'#8898ac');
  px(48,21,12,10,'#ccd4e4'); px(50,25,12,8,'#aab4c4'); px(48,29,14,6,'#8898ac');
  // Pointes sur épaulières
  px(0,24,4,4,'#6a7a90'); px(60,24,4,4,'#6a7a90');
  // Bras armurés
  px(4,33,10,12,'#8898ac'); px(2,39,10,8,'#6a7a90');
  px(50,33,10,12,'#8898ac'); px(52,39,10,8,'#6a7a90');
  // Gantelets dorés
  px(2,43,12,5,'#ffcc44'); px(50,43,12,5,'#ffcc44');
  ctx.globalAlpha=0.8;
  px(4,43,8,2,'#ffeebb'); px(52,43,8,2,'#ffeebb');
  ctx.globalAlpha=1;
  // Reflets divins
  ctx.globalAlpha=0.6;
  px(20,7,8,2,'#ffffff'); px(16,23,8,2,'#ddeeff'); px(40,27,6,2,'#ddeeff');
  ctx.globalAlpha=1;
  // Jupe d'armure (jambes)
  px(16,45,14,12,'#aab4c4'); px(34,45,14,12,'#aab4c4');
  px(14,51,16,8,'#8898ac'); px(34,51,16,8,'#8898ac');
  // Bordure dorée jupe
  ctx.globalAlpha=0.8;
  px(14,55,16,1,'#ffcc44'); px(34,55,16,1,'#ffcc44');
  ctx.globalAlpha=1;
  // Bottes
  px(12,58,18,4,'#6a7a90'); px(34,58,18,4,'#6a7a90');
  px(14,60,14,2,'#3a4458'); px(36,60,14,2,'#3a4458');
  // Aura mystique plus forte
  ctx.globalAlpha=0.4;
  px(0,12,3,40,'#ffcc44'); px(61,12,3,40,'#ffcc44');
  ctx.globalAlpha=1;
};


// SPRITES ÉVOLUTIONS — 15 restants

// ═══════════════════════════════════════════════════════════════════════════
// R1 — 7 évolutions restantes
// ═══════════════════════════════════════════════════════════════════════════

// 🌿 Thornogor — évolution de Thornet (armure de chitine, scarabée guerrier)
PM_SPRITES.thornogor = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura verte
  ctx.globalAlpha=0.3;
  px(4,4,56,56,'#3a7028');
  ctx.globalAlpha=1;
  // Cornes / mandibules de scarabée géant
  px(12,4,4,10,'#1e3812'); px(8,8,4,6,'#0a2008'); px(10,2,4,4,'#3e6020');
  px(48,4,4,10,'#1e3812'); px(52,8,4,6,'#0a2008'); px(50,2,4,4,'#3e6020');
  // Pinces extérieures
  px(6,12,4,3,'#0a2008'); px(54,12,4,3,'#0a2008');
  // Tête
  px(18,8,28,8,'#3a7028'); px(16,12,32,8,'#2a5418'); px(18,18,28,4,'#1e3812');
  // Yeux composés rouges (guerrier)
  px(22,12,5,5,'#1a0a0a'); px(23,13,3,3,'#aa3030'); px(24,14,1,1,'#ff8888');
  px(37,12,5,5,'#1a0a0a'); px(38,13,3,3,'#aa3030'); px(39,14,1,1,'#ff8888');
  // Marque de guerre sur le front
  ctx.globalAlpha=0.7;
  px(28,11,8,2,'#aa3030');
  ctx.globalAlpha=1;
  // Mandibules inférieures
  px(24,18,16,3,'#1e3812'); px(26,20,2,3,'#0a2008'); px(36,20,2,3,'#0a2008');
  // Cou
  px(26,21,12,4,'#2a5418');
  // Carapace dorsale (chitine renforcée)
  px(10,25,44,18,'#3a7028'); px(8,29,48,16,'#2a5418'); px(10,43,44,4,'#1e3812');
  // Plaques de chitine en lignes
  ctx.globalAlpha=0.7;
  px(12,30,40,1,'#1e3812'); px(12,35,40,1,'#1e3812'); px(12,40,40,1,'#1e3812');
  ctx.globalAlpha=1;
  // Pics dorsaux
  px(20,23,3,4,'#1e3812'); px(30,21,4,5,'#1e3812'); px(41,23,3,4,'#1e3812');
  ctx.globalAlpha=0.8;
  px(21,23,1,2,'#88aa44'); px(31,21,2,2,'#88aa44'); px(42,23,1,2,'#88aa44');
  ctx.globalAlpha=1;
  // Marques rouges (signes de guerre)
  ctx.globalAlpha=0.6;
  px(20,32,3,4,'#aa3030'); px(41,34,3,4,'#aa3030');
  ctx.globalAlpha=1;
  // Pattes (6, comme un insecte)
  // Avant
  px(2,30,8,4,'#1e3812'); px(0,33,6,4,'#0a2008');
  px(54,30,8,4,'#1e3812'); px(58,33,6,4,'#0a2008');
  // Milieu
  px(2,38,8,4,'#1e3812'); px(0,41,6,4,'#0a2008');
  px(54,38,8,4,'#1e3812'); px(58,41,6,4,'#0a2008');
  // Pattes principales
  px(14,46,10,12,'#2a5418'); px(40,46,10,12,'#2a5418');
  px(12,52,12,8,'#1e3812'); px(40,52,12,8,'#1e3812');
  // Griffes finales
  px(10,58,6,4,'#0a2008'); px(48,58,6,4,'#0a2008');
  // Élytres lisibles sur les côtés
  ctx.globalAlpha=0.6;
  px(10,28,8,12,'#3e6020'); px(46,28,8,12,'#3e6020');
  ctx.globalAlpha=1;
};

// 🔥 Vipériphon — évolution de Vipérod (serpent ailé de braise)
PM_SPRITES.viperiphon = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura ardente
  ctx.globalAlpha=0.3;
  px(0,0,64,64,'#ff4020');
  ctx.globalAlpha=1;
  // Tête de serpent dragon
  px(8,16,18,8,'#cc3818'); px(6,20,22,8,'#9a2810'); px(8,26,18,4,'#7a1808');
  // Cornes effilées
  px(10,12,3,6,'#3e1408'); px(11,8,2,5,'#1e0408');
  px(20,12,3,6,'#3e1408'); px(21,8,2,5,'#1e0408');
  // Yeux royaux dorés
  px(10,20,4,4,'#1a0a08'); px(11,21,2,2,'#ffcc44'); px(12,22,1,1,'#ffeebb');
  px(18,20,4,4,'#1a0a08'); px(19,21,2,2,'#ffcc44'); px(20,22,1,1,'#ffeebb');
  // Crocs venimeux longs
  px(10,26,2,5,'#ffeebb'); px(20,26,2,5,'#ffeebb');
  // Langue fendue
  px(0,22,10,2,'#ff4020');
  px(0,21,3,1,'#ff8844'); px(0,24,3,1,'#ff8844');
  // Cou serpentin
  px(22,22,10,4,'#9a2810'); px(26,26,12,4,'#cc3818');
  // GRANDES AILES enflammées
  // Aile gauche
  px(20,4,16,12,'#cc3818'); px(24,2,12,8,'#ff6020');
  px(28,0,8,4,'#ffaa20');
  // Membranes brûlantes
  ctx.globalAlpha=0.8;
  px(26,4,8,8,'#ffcc44'); px(28,2,4,4,'#ffeebb');
  ctx.globalAlpha=1;
  px(22,8,2,5,'#3e1408'); px(28,6,2,7,'#3e1408');
  // Aile droite
  px(40,8,18,10,'#cc3818'); px(44,4,14,8,'#ff6020');
  px(48,2,8,4,'#ffaa20');
  ctx.globalAlpha=0.8;
  px(46,6,8,8,'#ffcc44'); px(48,4,4,4,'#ffeebb');
  ctx.globalAlpha=1;
  px(42,10,2,7,'#3e1408'); px(48,8,2,7,'#3e1408');
  // Corps long et serpentin (s'enroule)
  px(28,28,16,8,'#cc3818'); px(32,30,16,8,'#9a2810');
  px(38,34,18,8,'#cc3818'); px(42,38,16,8,'#9a2810');
  // Marques de braise sur le corps
  ctx.globalAlpha=0.7;
  px(32,30,4,4,'#ffaa20'); px(46,36,4,4,'#ffaa20'); px(40,44,4,4,'#ffaa20');
  ctx.globalAlpha=1;
  // Continuation du corps
  px(48,42,12,8,'#cc3818'); px(46,46,14,8,'#9a2810');
  px(40,50,16,8,'#cc3818'); px(34,54,14,8,'#9a2810');
  px(24,56,16,6,'#cc3818'); px(14,58,14,4,'#9a2810');
  // Queue avec flamme
  px(8,58,8,4,'#cc3818'); px(2,56,8,5,'#ffaa20'); px(0,54,4,5,'#ffcc44');
  ctx.globalAlpha=0.8;
  px(0,52,3,4,'#ffeebb');
  ctx.globalAlpha=1;
  // Étincelles royales
  ctx.globalAlpha=0.9;
  px(58,4,1,1,'#ffeb44'); px(2,12,1,1,'#ffeb44'); px(60,28,2,1,'#ffaa20');
  ctx.globalAlpha=1;
};

// 💧 Carapharos — évolution de Carapulse (crabe-phare titanesque)
PM_SPRITES.carapharos = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura aquatique
  ctx.globalAlpha=0.25;
  px(0,8,64,52,'#3a7bd4');
  ctx.globalAlpha=1;
  // Carapace géante (massive)
  px(8,12,48,24,'#5a8cdc'); px(6,16,52,22,'#3a6cb4'); px(8,32,48,8,'#1a4488');
  // Phare central (caractéristique principale du lore)
  px(28,4,8,12,'#2a4878'); px(26,8,12,8,'#1a3858');
  // Bulbe lumineux du phare
  px(28,4,8,5,'#ffeebb'); px(30,2,4,4,'#ffffff');
  ctx.globalAlpha=0.8;
  px(29,3,6,3,'#fff8cc');
  ctx.globalAlpha=1;
  // Faisceaux lumineux
  ctx.globalAlpha=0.4;
  px(20,2,4,8,'#ffffff'); px(40,2,4,8,'#ffffff');
  px(16,4,2,6,'#ffffff'); px(46,4,2,6,'#ffffff');
  ctx.globalAlpha=1;
  // Yeux pédonculés (sur la carapace)
  px(16,18,5,7,'#1a1a22'); px(17,19,3,5,'#88ddff'); px(18,20,1,2,'#ffffff');
  px(43,18,5,7,'#1a1a22'); px(44,19,3,5,'#88ddff'); px(45,20,1,2,'#ffffff');
  // Reliefs de la carapace
  ctx.globalAlpha=0.6;
  px(12,22,40,2,'#88ddff'); px(14,28,36,2,'#88ddff');
  ctx.globalAlpha=1;
  // Marques d'écailles
  px(20,26,3,2,'#1a4488'); px(40,26,3,2,'#1a4488'); px(28,30,8,2,'#1a4488');
  // PINCES TITANESQUES (énormes, caractéristique principale)
  // Pince gauche
  px(0,24,12,16,'#5a8cdc'); px(0,28,8,12,'#3a6cb4');
  // Bout de pince
  px(0,22,4,8,'#3a6cb4'); px(0,18,3,4,'#1a4488');
  px(0,40,4,8,'#3a6cb4'); px(0,44,3,4,'#1a4488');
  // Reflets sur pinces
  ctx.globalAlpha=0.7;
  px(2,26,4,3,'#88ddff'); px(2,38,4,3,'#88ddff');
  ctx.globalAlpha=1;
  // Pince droite
  px(52,24,12,16,'#5a8cdc'); px(56,28,8,12,'#3a6cb4');
  px(60,22,4,8,'#3a6cb4'); px(61,18,3,4,'#1a4488');
  px(60,40,4,8,'#3a6cb4'); px(61,44,3,4,'#1a4488');
  ctx.globalAlpha=0.7;
  px(58,26,4,3,'#88ddff'); px(58,38,4,3,'#88ddff');
  ctx.globalAlpha=1;
  // Pattes (4 paires)
  px(10,40,8,8,'#3a6cb4'); px(46,40,8,8,'#3a6cb4');
  px(14,42,4,10,'#1a4488'); px(46,42,4,10,'#1a4488');
  // Pattes médianes
  px(20,42,4,12,'#3a6cb4'); px(40,42,4,12,'#3a6cb4');
  px(20,52,4,8,'#1a4488'); px(40,52,4,8,'#1a4488');
  // Pattes centrales
  px(28,46,8,16,'#3a6cb4'); px(28,56,8,6,'#1a4488');
  // Bulles
  ctx.globalAlpha=0.7;
  px(12,8,2,2,'#aaeeff'); px(50,10,2,2,'#aaeeff'); px(4,52,1,1,'#ffffff'); px(58,54,1,1,'#ffffff');
  ctx.globalAlpha=1;
};

// ⚡ Voltérion — évolution de Volture (écureuil-éclair royal)
PM_SPRITES.volterion = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Éclairs en arrière-plan
  ctx.globalAlpha=0.4;
  px(2,2,3,4,'#ffeb44'); px(58,4,3,4,'#ffeb44'); px(4,58,3,4,'#ffeb44'); px(58,58,3,4,'#ffeb44');
  ctx.globalAlpha=1;
  // Oreilles longues avec glands électriques
  px(14,2,5,12,'#5a3a20'); px(12,8,4,8,'#3a1c10');
  px(45,2,5,12,'#5a3a20'); px(48,8,4,8,'#3a1c10');
  // Glands électriques au bout des oreilles
  ctx.globalAlpha=0.9;
  px(13,2,4,3,'#ffeb44'); px(46,2,4,3,'#ffeb44');
  px(14,1,2,2,'#ffffff'); px(47,1,2,2,'#ffffff');
  ctx.globalAlpha=1;
  // Tête
  px(18,8,28,10,'#5a3a20'); px(16,12,32,10,'#4a2818'); px(18,20,28,4,'#3a1c10');
  // Moustaches conductrices (caractéristique principale)
  ctx.globalAlpha=0.9;
  px(2,16,16,1,'#ffeb44'); px(46,16,16,1,'#ffeb44');
  px(0,18,12,1,'#ffaa20'); px(52,18,12,1,'#ffaa20');
  ctx.globalAlpha=1;
  // Yeux jaunes électriques
  px(22,14,4,5,'#1a1a08'); px(23,15,2,3,'#ffeb44'); px(24,16,1,1,'#ffffff');
  px(38,14,4,5,'#1a1a08'); px(39,15,2,3,'#ffeb44'); px(40,16,1,1,'#ffffff');
  // Marque éclair sur le front
  ctx.globalAlpha=0.9;
  px(31,11,2,2,'#ffeb44'); px(30,13,3,1,'#ffeb44'); px(32,12,2,1,'#ffaa20');
  ctx.globalAlpha=1;
  // Petit nez et bouche
  px(30,20,4,2,'#1a1a08'); px(28,22,8,2,'#1a1a08');
  px(30,21,1,1,'#ff6020');
  // Cou avec collier d'éclairs
  px(24,24,16,4,'#4a2818');
  ctx.globalAlpha=0.8;
  px(24,24,16,1,'#ffeb44');
  ctx.globalAlpha=1;
  // Corps
  px(18,28,28,14,'#5a3a20'); px(16,32,32,14,'#4a2818'); px(18,42,28,4,'#3a1c10');
  // Plastron clair
  px(24,32,16,10,'#a87850'); px(26,34,12,6,'#c08858');
  // Pattes avant
  px(16,42,8,10,'#4a2818'); px(40,42,8,10,'#4a2818');
  px(14,48,8,8,'#3a1c10'); px(40,48,8,8,'#3a1c10');
  // Petites mains
  px(13,52,8,4,'#a87850'); px(43,52,8,4,'#a87850');
  // Pattes arrière repliées
  px(20,46,8,12,'#3a1c10'); px(36,46,8,12,'#3a1c10');
  // Pieds
  px(18,56,12,5,'#1a1208'); px(34,56,12,5,'#1a1208');
  // Énorme queue chargée d'électricité (caractéristique principale)
  px(48,28,8,10,'#5a3a20'); px(52,32,8,12,'#4a2818');
  px(52,38,12,12,'#5a3a20'); px(50,42,12,16,'#4a2818');
  // Touffe au bout
  px(46,52,16,10,'#5a3a20');
  // Éclairs dans la queue
  ctx.globalAlpha=0.9;
  px(54,30,2,4,'#ffeb44'); px(58,38,2,5,'#ffeb44'); px(50,46,3,4,'#ffeb44');
  px(56,52,3,5,'#ffaa20'); px(48,56,4,4,'#ffeb44');
  ctx.globalAlpha=1;
  px(55,32,1,1,'#ffffff'); px(59,40,1,1,'#ffffff'); px(51,48,1,1,'#ffffff');
  // Étincelles flottantes
  ctx.globalAlpha=0.9;
  px(8,28,1,1,'#ffeb44'); px(56,16,1,1,'#ffeb44'); px(2,46,2,1,'#ffaa20'); px(60,46,2,1,'#ffaa20');
  ctx.globalAlpha=1;
};

// ⚡ Fulgurion — évolution de Fulguron (tempête en miniature)
PM_SPRITES.fulgurion = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Tempête tournoyante (couches d'éclairs)
  ctx.globalAlpha=0.3;
  px(4,4,56,56,'#aacc88'); px(8,8,48,48,'#88aa66');
  ctx.globalAlpha=1;
  // Sphère noyau (centre)
  px(20,20,24,24,'#ffeb44'); px(18,24,28,16,'#f0c040'); px(22,28,20,8,'#ffaa20');
  ctx.globalAlpha=0.9;
  px(24,28,16,8,'#ffffff'); px(28,30,8,4,'#ffeebb');
  ctx.globalAlpha=1;
  // Yeux dans la sphère (intenses, terrifiants)
  px(24,28,4,5,'#1a1a08'); px(25,29,2,3,'#ffffff'); px(26,30,1,1,'#ffaa44');
  px(36,28,4,5,'#1a1a08'); px(37,29,2,3,'#ffffff'); px(38,30,1,1,'#ffaa44');
  // Bouche fendue d'éclairs
  px(28,36,8,3,'#1a1a08');
  ctx.globalAlpha=0.9;
  px(30,37,4,1,'#ffeb44');
  ctx.globalAlpha=1;
  // Anneaux d'éclairs autour de la sphère
  px(8,12,8,3,'#ffeb44'); px(48,12,8,3,'#ffeb44');
  px(4,28,4,4,'#ffeb44'); px(56,28,4,4,'#ffeb44');
  px(8,48,8,3,'#ffeb44'); px(48,48,8,3,'#ffeb44');
  // Reliefs des éclairs (zigzag)
  px(10,15,2,3,'#ffaa20'); px(50,10,2,3,'#ffaa20');
  px(2,32,3,2,'#ffaa20'); px(58,32,3,2,'#ffaa20');
  px(10,46,2,3,'#ffaa20'); px(48,52,2,3,'#ffaa20');
  // Reflets brillants
  ctx.globalAlpha=0.9;
  px(10,12,4,1,'#ffffff'); px(52,12,4,1,'#ffffff'); px(10,50,4,1,'#ffffff'); px(50,50,4,1,'#ffffff');
  ctx.globalAlpha=1;
  // Particules électriques tournoyantes
  ctx.globalAlpha=0.8;
  px(2,2,2,2,'#ffeb44'); px(58,2,2,2,'#ffeb44');
  px(28,4,2,2,'#ffaa20'); px(34,4,2,2,'#ffaa20');
  px(2,28,2,2,'#ffeb44'); px(60,30,2,2,'#ffeb44');
  px(2,58,2,2,'#ffeb44'); px(58,58,2,2,'#ffeb44');
  px(28,60,2,2,'#ffaa20'); px(34,60,2,2,'#ffaa20');
  ctx.globalAlpha=1;
  // Petits éclairs minces autour
  ctx.globalAlpha=0.9;
  px(15,3,1,2,'#ffffff'); px(48,3,1,2,'#ffffff');
  px(3,15,2,1,'#ffffff'); px(60,18,2,1,'#ffffff');
  px(15,60,1,2,'#ffffff'); px(50,60,1,2,'#ffffff');
  ctx.globalAlpha=1;
  // Frange floue (la sphère semble pulser)
  ctx.globalAlpha=0.5;
  px(18,18,28,4,'#ffeb44'); px(18,42,28,4,'#ffeb44');
  px(18,22,4,20,'#ffeb44'); px(42,22,4,20,'#ffeb44');
  ctx.globalAlpha=1;
};

// 🌀 Zéphirion — évolution de Zéphibri (colibri-prince arc-en-ciel)
PM_SPRITES.zephirion = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Halo arc-en-ciel
  ctx.globalAlpha=0.3;
  px(4,4,56,8,'#ff8888'); px(4,12,56,8,'#ffcc88'); px(4,20,56,8,'#88ccff'); px(4,28,56,8,'#ccffaa');
  ctx.globalAlpha=1;
  // Tête fine
  px(20,12,16,6,'#aac8e8'); px(18,16,20,6,'#88a8c8'); px(20,20,16,4,'#688088');
  // Couronne d'arc-en-ciel
  px(22,8,12,4,'#ff6688'); px(24,6,8,5,'#ffaa66'); px(26,5,4,3,'#ffee66');
  ctx.globalAlpha=0.9;
  px(26,4,4,2,'#88ffaa'); px(27,3,2,2,'#88ccff');
  ctx.globalAlpha=1;
  // Long bec fin et royal
  px(36,16,12,4,'#ffcc44'); px(44,16,8,3,'#ddaa30');
  px(46,14,4,2,'#ffeebb');
  // Yeux brillants
  px(22,16,3,4,'#1a1a22'); px(23,17,1,2,'#88ddff');
  px(31,16,3,4,'#1a1a22'); px(32,17,1,2,'#88ddff');
  // Cou fin
  px(24,22,10,4,'#88a8c8'); px(26,24,6,3,'#688088');
  // Corps petit
  px(20,26,16,8,'#aac8e8'); px(18,30,20,8,'#88a8c8'); px(20,36,16,4,'#688088');
  // Marques arc-en-ciel sur le ventre
  ctx.globalAlpha=0.7;
  px(22,28,12,2,'#ff8888'); px(22,30,12,2,'#ffcc88'); px(22,32,12,2,'#88ccff'); px(22,34,12,2,'#ccffaa');
  ctx.globalAlpha=1;
  // GRANDES AILES déployées arc-en-ciel
  // Aile gauche
  px(0,16,18,12,'#ff8888'); px(2,12,16,8,'#ffcc88');
  px(0,28,18,8,'#88ccff'); px(2,32,14,6,'#ccffaa');
  ctx.globalAlpha=0.8;
  px(4,18,12,3,'#ffeebb'); px(4,30,12,3,'#ddffee');
  ctx.globalAlpha=1;
  // Bordures plumes aile gauche
  px(0,14,3,2,'#ff6688'); px(0,24,3,2,'#88aaff'); px(0,36,3,2,'#88cc66');
  // Aile droite (asymétrique pour donner mouvement)
  px(38,12,20,16,'#ff8888'); px(40,8,18,12,'#ffcc88');
  px(40,28,20,8,'#88ccff'); px(42,32,16,6,'#ccffaa');
  ctx.globalAlpha=0.8;
  px(42,14,12,3,'#ffeebb'); px(44,30,12,3,'#ddffee');
  ctx.globalAlpha=1;
  px(58,10,3,2,'#ff6688'); px(60,22,3,2,'#88aaff'); px(58,36,3,2,'#88cc66');
  // Pattes fines
  px(24,40,3,8,'#ffcc44'); px(33,40,3,8,'#ffcc44');
  px(22,46,4,4,'#ddaa30'); px(34,46,4,4,'#ddaa30');
  // Griffes
  px(20,50,2,3,'#1a1a22'); px(24,50,2,3,'#1a1a22');
  px(34,50,2,3,'#1a1a22'); px(38,50,2,3,'#1a1a22');
  // Longue queue arc-en-ciel
  px(28,42,4,8,'#ff8888'); px(26,48,8,6,'#ffcc88');
  px(24,52,12,6,'#88ccff'); px(22,56,16,6,'#ccffaa');
  ctx.globalAlpha=0.8;
  px(28,52,4,2,'#ffeebb'); px(28,58,4,3,'#ddffee');
  ctx.globalAlpha=1;
  // Plumes éparses arc-en-ciel
  ctx.globalAlpha=0.8;
  px(2,4,2,2,'#ff8888'); px(58,4,2,2,'#88ccff');
  px(2,46,1,1,'#ffcc66'); px(60,48,1,1,'#88ffaa');
  ctx.globalAlpha=1;
};

// 🌑 Spectreval — évolution de Spectrelis (arbuste hanté)
PM_SPRITES.spectreval = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura spectrale
  ctx.globalAlpha=0.3;
  px(0,8,64,52,'#5060a0');
  ctx.globalAlpha=1;
  // Couronne de feuilles fantomatiques (en haut)
  px(20,2,24,4,'#3a2a4a'); px(16,4,32,6,'#2a1a3a'); px(20,8,24,4,'#1a0a28');
  // Feuilles individuelles
  ctx.globalAlpha=0.9;
  px(22,3,4,3,'#5060a0'); px(28,1,4,4,'#5060a0'); px(34,2,4,3,'#5060a0'); px(40,3,4,3,'#5060a0');
  ctx.globalAlpha=1;
  // Fruits (les "fruits qui ne tombent que pour les âmes apaisées")
  px(18,6,3,3,'#7080c0'); px(28,4,3,3,'#7080c0'); px(38,4,3,3,'#7080c0'); px(43,6,3,3,'#7080c0');
  ctx.globalAlpha=0.8;
  px(19,7,1,1,'#aabbff'); px(29,5,1,1,'#aabbff'); px(39,5,1,1,'#aabbff'); px(44,7,1,1,'#aabbff');
  ctx.globalAlpha=1;
  // Tronc/visage central (l'arbuste a un visage)
  px(22,12,20,12,'#3a2a4a'); px(20,16,24,10,'#2a1a3a'); px(22,24,20,4,'#1a0a28');
  // Yeux fantomatiques
  px(24,18,4,5,'#aabbff'); px(36,18,4,5,'#aabbff');
  ctx.globalAlpha=0.7;
  px(23,17,6,7,'#ddeeff'); px(35,17,6,7,'#ddeeff');
  ctx.globalAlpha=1;
  px(25,19,2,3,'#ffffff'); px(37,19,2,3,'#ffffff');
  // Bouche de l'arbre
  px(28,24,8,3,'#1a0a28'); px(30,25,4,2,'#000010');
  // Branches-bras qui s'étendent
  px(8,18,16,4,'#3a2a4a'); px(4,22,12,4,'#2a1a3a');
  px(40,18,16,4,'#3a2a4a'); px(48,22,12,4,'#2a1a3a');
  // Petites feuilles aux bouts
  px(0,20,4,4,'#3a2a4a'); px(60,20,4,4,'#3a2a4a');
  ctx.globalAlpha=0.8;
  px(1,21,2,2,'#5060a0'); px(61,21,2,2,'#5060a0');
  ctx.globalAlpha=1;
  // Tronc central plus large
  px(18,28,28,14,'#3a2a4a'); px(16,32,32,12,'#2a1a3a'); px(18,42,28,4,'#1a0a28');
  // Reliefs de l'écorce
  ctx.globalAlpha=0.6;
  px(22,30,2,12,'#1a0a28'); px(30,30,2,12,'#1a0a28'); px(38,30,2,12,'#1a0a28');
  ctx.globalAlpha=1;
  // Visage secondaire sur le tronc
  px(26,34,3,3,'#aabbff'); px(34,34,3,3,'#aabbff');
  ctx.globalAlpha=0.8;
  px(28,38,8,2,'#1a0a28');
  ctx.globalAlpha=1;
  // Racines fantomatiques
  px(14,42,8,12,'#2a1a3a'); px(42,42,8,12,'#2a1a3a');
  px(12,48,8,8,'#1a0a28'); px(44,48,8,8,'#1a0a28');
  // Racines secondaires
  ctx.globalAlpha=0.7;
  px(8,52,6,6,'#2a1a3a'); px(50,52,6,6,'#2a1a3a');
  ctx.globalAlpha=1;
  // Base
  px(22,46,20,12,'#2a1a3a'); px(24,52,16,8,'#1a0a28');
  // Bas qui se dissout en brume
  ctx.globalAlpha=0.6;
  px(18,58,28,4,'#3a2a4a'); px(20,60,24,3,'#2a1a3a');
  ctx.globalAlpha=0.4;
  px(14,60,36,3,'#3a2a4a');
  ctx.globalAlpha=1;
  // Particules d'âme
  ctx.globalAlpha=0.7;
  px(4,12,1,1,'#aabbff'); px(60,14,1,1,'#aabbff');
  px(2,40,2,2,'#5060a0'); px(58,42,2,2,'#5060a0');
  px(8,56,1,1,'#aabbff'); px(54,56,1,1,'#aabbff');
  ctx.globalAlpha=1;
};

// ═══════════════════════════════════════════════════════════════════════════
// R2 — 8 évolutions restantes
// ═══════════════════════════════════════════════════════════════════════════

// ❄️ Glacedrak — évolution de Frimadon (dragon des hivers anciens)
PM_SPRITES.glacedrak = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura glaciale ancienne
  ctx.globalAlpha=0.3;
  px(0,0,64,64,'#88ccee');
  ctx.globalAlpha=1;
  // Tête massive de dragon
  px(6,12,22,10,'#88b8d4'); px(4,16,26,10,'#5e8cb0'); px(6,24,22,4,'#3e6c90');
  // Cornes glaciales énormes
  px(8,4,4,10,'#ffffff'); px(6,2,4,5,'#ddeeff');
  px(20,4,4,10,'#ffffff'); px(22,2,4,5,'#ddeeff');
  // Cornes secondaires
  px(14,6,3,7,'#cceeff'); px(15,4,2,3,'#ffffff');
  // Yeux royaux glacés
  px(8,18,5,5,'#1a2a44'); px(9,19,3,3,'#aaeeff'); px(10,20,1,1,'#ffffff');
  px(18,18,5,5,'#1a2a44'); px(19,19,3,3,'#aaeeff'); px(20,20,1,1,'#ffffff');
  // Crocs glaciaux
  px(6,24,3,5,'#ffffff'); px(22,24,3,5,'#ffffff');
  // Souffle gelé puissant
  ctx.globalAlpha=0.8;
  px(0,18,6,6,'#ddeeff'); px(0,20,4,4,'#ffffff');
  ctx.globalAlpha=0.5;
  px(0,14,6,4,'#cceeff'); px(0,24,6,4,'#cceeff');
  ctx.globalAlpha=1;
  // Cou massif
  px(22,22,12,6,'#5e8cb0'); px(26,28,12,4,'#3e6c90');
  // Corps long et ondulant
  px(28,24,18,10,'#88b8d4'); px(34,30,16,10,'#5e8cb0');
  px(38,36,18,8,'#88b8d4'); px(42,40,16,10,'#5e8cb0');
  px(46,44,16,8,'#88b8d4');
  // Pics de glace majestueux sur le dos
  px(28,18,3,7,'#ddeeff'); px(36,16,3,9,'#ffffff'); px(44,18,3,7,'#ddeeff');
  px(50,22,3,7,'#cceeff'); px(56,28,3,7,'#ddeeff');
  // Reflets sur les pics
  ctx.globalAlpha=0.9;
  px(36,16,1,4,'#ffffff'); px(44,18,1,3,'#ffffff');
  ctx.globalAlpha=1;
  // GRANDES AILES glaciales
  ctx.globalAlpha=0.7;
  px(20,2,20,10,'#ddeeff'); px(24,0,16,4,'#ffffff');
  px(22,12,16,6,'#cceeff');
  ctx.globalAlpha=1;
  // Membrures ailes
  px(22,6,2,4,'#88ccee'); px(28,4,2,6,'#88ccee'); px(34,6,2,4,'#88ccee');
  // Cristaux dans les ailes
  ctx.globalAlpha=0.9;
  px(26,8,2,2,'#ffffff'); px(32,6,2,2,'#ffffff'); px(38,8,2,2,'#ffffff');
  ctx.globalAlpha=1;
  // Ventre clair
  px(34,30,12,6,'#cceeff'); px(40,38,12,4,'#cceeff');
  // Marques runes glacées
  ctx.globalAlpha=0.7;
  px(36,32,3,2,'#88ccee'); px(44,40,3,2,'#88ccee');
  ctx.globalAlpha=1;
  // Queue se terminant en pic majeur
  px(58,46,4,8,'#5e8cb0'); px(56,40,5,8,'#cceeff'); px(60,36,3,6,'#ffffff');
  // Particules glacées
  ctx.globalAlpha=0.5;
  px(2,30,2,2,'#ffffff'); px(60,8,1,1,'#ffffff'); px(4,50,1,1,'#cceeff'); px(60,58,2,2,'#ffffff');
  ctx.globalAlpha=1;
};

// ⚙️ Forgehammer — évolution de Forgemin (enclume avec marteau)
PM_SPRITES.forgehammer = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura de forge
  ctx.globalAlpha=0.3;
  px(2,2,60,60,'#ffaa44');
  ctx.globalAlpha=1;
  // Plateau supérieur (plus large que Forgemin)
  px(16,8,32,6,'#aab4c4'); px(14,12,36,5,'#909cb0'); px(16,17,32,2,'#7080a0');
  // Cou
  px(22,17,20,4,'#7080a0'); px(24,20,16,3,'#5e6e8a');
  // Cornes d'enclume (deux côtés cette fois)
  px(8,11,8,4,'#aab4c4'); px(0,12,8,3,'#7080a0'); px(0,12,4,2,'#5e6e8a');
  px(48,11,8,4,'#aab4c4'); px(56,12,8,3,'#7080a0'); px(60,12,4,2,'#5e6e8a');
  // Visage royal
  px(20,12,4,4,'#1a1a22'); px(21,13,2,2,'#ffaa44'); px(22,14,1,1,'#ffeebb');
  px(40,12,4,4,'#1a1a22'); px(41,13,2,2,'#ffaa44'); px(42,14,1,1,'#ffeebb');
  // Sourire confiant
  px(28,16,8,1,'#1a1a22');
  // MARTEAU posé sur l'épaule (caractéristique principale)
  // Manche
  px(50,20,4,16,'#5a3018'); px(52,32,4,12,'#3e2010');
  // Tête du marteau
  px(46,16,16,10,'#aab4c4'); px(44,18,20,8,'#909cb0'); px(46,24,16,4,'#7080a0');
  // Reflets
  ctx.globalAlpha=0.7;
  px(48,18,8,2,'#d0d8e8');
  ctx.globalAlpha=1;
  // Marque sur le marteau
  px(52,20,2,2,'#ffaa44'); px(53,21,1,1,'#ffeebb');
  // Base massive
  px(10,22,40,16,'#aab4c4'); px(8,26,44,16,'#909cb0'); px(10,38,40,4,'#7080a0');
  // Pieds (4)
  px(6,30,8,8,'#909cb0'); px(4,34,8,6,'#7080a0'); px(4,38,10,3,'#5e6e8a');
  px(50,30,8,8,'#909cb0'); px(52,34,8,6,'#7080a0'); px(50,38,10,3,'#5e6e8a');
  // Marques de coups
  px(20,28,5,2,'#5e6e8a'); px(36,30,5,2,'#5e6e8a'); px(28,32,7,2,'#5e6e8a');
  px(22,36,4,2,'#5e6e8a'); px(38,36,4,2,'#5e6e8a');
  // Filons dorés (mémoire du forgeron)
  ctx.globalAlpha=0.8;
  px(14,30,2,5,'#ffcc44'); px(46,32,2,5,'#ffcc44');
  ctx.globalAlpha=1;
  // Bras tenant le marteau
  px(46,28,8,8,'#7080a0'); px(48,32,8,4,'#5e6e8a');
  // Reflets brillants
  ctx.globalAlpha=0.6;
  px(16,12,8,1,'#d0d8e8'); px(12,24,12,2,'#b8c4d4');
  ctx.globalAlpha=1;
  // Petits pieds du bas
  px(14,42,8,12,'#7080a0'); px(12,48,10,8,'#5e6e8a');
  px(40,42,8,12,'#7080a0'); px(40,48,10,8,'#5e6e8a');
  px(20,46,8,10,'#7080a0'); px(34,46,8,10,'#7080a0');
  // Sole
  px(10,54,16,4,'#4a5870'); px(36,54,18,4,'#4a5870'); px(20,54,8,4,'#4a5870');
  // Étincelles ardentes
  ctx.globalAlpha=0.9;
  px(58,8,2,2,'#ffaa44'); px(60,10,1,1,'#ffeebb'); px(2,10,1,1,'#ffaa44');
  px(40,4,2,1,'#ffcc44'); px(2,40,1,1,'#ffaa44'); px(60,42,2,2,'#ffaa44');
  ctx.globalAlpha=1;
};

// 🌿 Mousseroi — évolution de Mousseron (sage millénaire)
PM_SPRITES.mousseroi = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura forestière millénaire
  ctx.globalAlpha=0.3;
  px(0,0,64,64,'#5a8830');
  ctx.globalAlpha=1;
  // Chapeau royal de champignon (plus large, plus haut)
  px(14,2,36,4,'#3a5820'); px(10,6,44,8,'#5a8830'); px(8,12,48,6,'#4a7028');
  // Ornements lichens dorés
  px(16,4,4,3,'#c0e060'); px(28,2,6,3,'#ffe080'); px(40,4,4,3,'#c0e060');
  px(20,6,3,3,'#a8d048'); px(36,8,3,3,'#a8d048'); px(46,6,3,3,'#a8d048');
  // Couronne dorée sous le chapeau
  px(18,12,28,2,'#ffcc44'); px(22,11,4,2,'#ffeebb'); px(38,11,4,2,'#ffeebb');
  // Bord du chapeau
  px(6,16,52,4,'#2a4818'); px(4,18,56,3,'#1e3812');
  // Yeux sages anciens
  px(20,22,5,5,'#1a1a22'); px(21,23,3,3,'#88a868'); px(22,24,1,1,'#ffffff');
  px(39,22,5,5,'#1a1a22'); px(40,23,3,3,'#88a868'); px(41,24,1,1,'#ffffff');
  // Sourcils blancs (de sagesse)
  ctx.globalAlpha=0.8;
  px(18,20,8,1,'#ffffff'); px(38,20,8,1,'#ffffff');
  ctx.globalAlpha=1;
  // Tête (plus pâle, plus marquée par l'âge)
  px(18,21,28,8,'#e0d4a8'); px(16,25,32,6,'#c8b888'); px(18,29,28,4,'#a89860');
  // Marques de mousse anciennes
  ctx.globalAlpha=0.7;
  px(20,25,4,3,'#5a8830'); px(40,25,4,3,'#5a8830'); px(28,28,8,2,'#5a8830');
  ctx.globalAlpha=1;
  // Sourire bienveillant
  px(28,29,8,2,'#1a1a22'); px(30,30,4,1,'#5a3018');
  // Barbe blanche (sagesse)
  ctx.globalAlpha=0.9;
  px(24,30,16,5,'#ffffff'); px(26,33,12,4,'#ddeeee'); px(28,36,8,3,'#ffffff');
  ctx.globalAlpha=1;
  // Corps (drapé)
  px(12,32,40,12,'#a89860'); px(10,36,44,10,'#88784a'); px(12,44,40,4,'#5a4830');
  // Bras-racines plus longs
  px(2,34,12,8,'#88784a'); px(0,38,12,6,'#5a4830');
  px(50,34,12,8,'#88784a'); px(52,38,12,6,'#5a4830');
  // Bâton magique en main droite
  px(60,28,2,16,'#5a3018'); px(58,26,3,4,'#88784a');
  // Pommeau lumineux du bâton
  ctx.globalAlpha=0.9;
  px(58,24,4,4,'#ffe080'); px(60,22,2,2,'#ffffff');
  ctx.globalAlpha=1;
  // Pieds-racines
  px(14,46,12,12,'#88784a'); px(38,46,12,12,'#88784a');
  px(12,52,16,8,'#5a4830'); px(36,52,16,8,'#5a4830');
  // Racines anciennes secondaires
  px(8,54,4,8,'#5a4830'); px(52,54,4,8,'#5a4830');
  px(20,56,4,6,'#3e2810'); px(40,56,4,6,'#3e2810');
  // Fleurs qui poussent au sol (lore)
  ctx.globalAlpha=0.9;
  px(2,60,2,2,'#ffe080'); px(4,58,2,2,'#f0c8a0');
  px(28,60,2,2,'#ffaaff'); px(34,60,2,2,'#ffe080'); px(40,60,2,2,'#f0c8a0');
  px(58,60,2,2,'#ffe080'); px(60,58,2,2,'#ffaaff');
  ctx.globalAlpha=1;
  // Spores anciennes
  ctx.globalAlpha=0.6;
  px(6,8,1,1,'#c0e060'); px(54,10,1,1,'#c0e060'); px(2,28,1,1,'#a8d048'); px(60,30,1,1,'#a8d048');
  ctx.globalAlpha=1;
};

// 🌿 Vrillarcane — évolution de Vrillemousse (liane-archiviste)
PM_SPRITES.vrillarcane = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura ancestrale ambrée
  ctx.globalAlpha=0.3;
  px(0,0,64,64,'#aa8844');
  ctx.globalAlpha=1;
  // Lianes principales s'enroulant en spirales (plus complexe)
  px(28,2,8,4,'#3e6020'); px(20,4,24,4,'#4a7028'); px(14,8,12,4,'#3e6020'); px(38,8,12,4,'#3e6020');
  px(8,12,16,4,'#4a7028'); px(40,12,16,4,'#4a7028');
  // Symboles arcanes flottants au-dessus
  ctx.globalAlpha=0.9;
  px(10,2,2,2,'#ffcc44'); px(30,0,4,3,'#ffcc44'); px(52,2,2,2,'#ffcc44');
  px(11,1,1,1,'#ffffff'); px(31,1,2,1,'#ffeebb'); px(53,1,1,1,'#ffffff');
  ctx.globalAlpha=1;
  // Corps central enroulé puissant
  px(18,16,28,12,'#5a8830'); px(16,20,32,12,'#4a7028'); px(18,30,28,6,'#3a5820');
  // Yeux multiples ambrés (une rangée + secondaires)
  px(20,20,3,4,'#1a2a14'); px(21,21,1,2,'#ffaa00');
  px(26,20,3,4,'#1a2a14'); px(27,21,1,2,'#ffaa00');
  px(32,20,3,4,'#1a2a14'); px(33,21,1,2,'#ffaa00');
  px(38,20,3,4,'#1a2a14'); px(39,21,1,2,'#ffaa00');
  // Yeux secondaires plus grands (sages)
  px(22,26,4,3,'#1a2a14'); px(23,27,2,1,'#ffcc44');
  px(28,26,4,3,'#1a2a14'); px(29,27,2,1,'#ffcc44');
  px(36,26,4,3,'#1a2a14'); px(37,27,2,1,'#ffcc44');
  // Bouche-trésor (où elle garde les histoires)
  px(26,30,12,4,'#1a1a14'); px(28,31,2,3,'#ddccaa'); px(31,31,2,3,'#ddccaa'); px(34,31,2,3,'#ddccaa');
  // Épines dorsales dorées
  px(20,14,2,5,'#a8c048'); px(26,12,2,5,'#a8c048'); px(34,12,2,5,'#a8c048'); px(42,14,2,5,'#a8c048');
  ctx.globalAlpha=0.9;
  px(20,14,1,2,'#ffcc44'); px(26,12,1,2,'#ffcc44'); px(34,12,1,2,'#ffcc44'); px(42,14,1,2,'#ffcc44');
  ctx.globalAlpha=1;
  // Lianes-bras puissantes qui s'étendent loin
  px(4,20,14,4,'#4a7028'); px(0,24,12,4,'#3e6020');
  px(46,20,14,4,'#4a7028'); px(52,24,12,4,'#3e6020');
  // Épines sur les bras
  px(6,19,2,2,'#a8c048'); px(56,19,2,2,'#a8c048');
  px(8,23,2,2,'#a8c048'); px(54,23,2,2,'#a8c048');
  // Fleurs ambrées au bout des bras (les "yeux d'ambre")
  px(0,28,4,4,'#ffaa00'); px(60,28,4,4,'#ffaa00');
  ctx.globalAlpha=0.9;
  px(1,29,2,2,'#ffcc44'); px(61,29,2,2,'#ffcc44');
  ctx.globalAlpha=1;
  // Corps inférieur
  px(16,36,32,16,'#3a5820'); px(14,40,36,14,'#2a4418'); px(16,52,32,4,'#1e3210');
  // Marques runiques sur le ventre
  ctx.globalAlpha=0.7;
  px(22,42,4,3,'#a8c048'); px(38,42,4,3,'#a8c048'); px(28,46,8,2,'#a8c048');
  ctx.globalAlpha=1;
  // Pattes-racines massives qui s'enroulent
  px(10,52,10,12,'#3a5820'); px(44,52,10,12,'#3a5820');
  px(8,58,14,6,'#2a4418'); px(42,58,14,6,'#2a4418');
  // Épines aux pieds
  px(10,60,2,4,'#a8c048'); px(52,60,2,4,'#a8c048'); px(18,60,2,4,'#a8c048'); px(44,60,2,4,'#a8c048');
  // Vrilles fines flottantes
  ctx.globalAlpha=0.7;
  px(24,8,2,2,'#a8c048'); px(38,10,2,2,'#a8c048');
  ctx.globalAlpha=1;
};

// 🔥 Braslunaire — évolution de Braslune (loup-roi argenté)
PM_SPRITES.braslunaire = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Lune royale en arrière-plan
  ctx.globalAlpha=0.4;
  px(46,2,16,16,'#ffeebb'); px(48,4,12,12,'#ffe888');
  ctx.globalAlpha=1;
  // Tête de loup royal
  px(14,8,28,8,'#1a1408'); px(12,12,32,8,'#0a0a04'); px(14,18,28,4,'#000000');
  // Oreilles royales pointues
  px(12,2,6,8,'#1a1408'); px(14,0,4,4,'#3a2418');
  px(38,2,6,8,'#1a1408'); px(42,0,4,4,'#3a2418');
  // Couronne d'argent
  px(16,8,24,2,'#cccccc'); px(20,6,4,3,'#ffffff'); px(28,5,4,4,'#ffffff'); px(36,6,4,3,'#ffffff');
  // Pelage argenté incandescent (caractéristique principale)
  ctx.globalAlpha=0.8;
  px(14,10,4,5,'#ddeeff'); px(38,10,4,5,'#ddeeff'); px(20,8,4,3,'#ffffff'); px(32,8,4,3,'#ffffff');
  ctx.globalAlpha=1;
  // Yeux argentés brûlants (différents de Braslune)
  px(18,13,4,5,'#1a1a22'); px(19,14,2,3,'#ddeeff'); px(20,15,1,1,'#ffffff');
  px(34,13,4,5,'#1a1a22'); px(35,14,2,3,'#ddeeff'); px(36,15,1,1,'#ffffff');
  // Museau royal
  px(24,18,8,5,'#0a0a04'); px(26,21,4,3,'#000000');
  px(26,22,4,1,'#3e2818');
  // Crocs argentés
  px(22,22,2,5,'#ffffff'); px(32,22,2,5,'#ffffff');
  // Crinière de feu argenté (signe royal)
  px(16,8,4,3,'#ffffff'); px(24,4,4,4,'#ddeeff'); px(34,8,4,3,'#ffffff');
  px(20,6,4,3,'#cccccc'); px(32,6,4,3,'#cccccc');
  // Cou avec collier
  px(20,22,16,4,'#1a1408');
  ctx.globalAlpha=0.8;
  px(20,22,16,1,'#cccccc');
  ctx.globalAlpha=1;
  // Corps
  px(10,26,36,14,'#1a1408'); px(8,30,40,14,'#0a0a04'); px(10,40,36,4,'#000000');
  // Crinière argentée sur le dos
  px(16,22,4,5,'#ffffff'); px(24,20,4,7,'#ddeeff'); px(32,22,4,5,'#ffffff'); px(40,24,4,4,'#cccccc');
  ctx.globalAlpha=0.8;
  px(18,22,2,3,'#ffffff'); px(26,20,2,4,'#ffffff'); px(34,22,2,3,'#ffffff');
  ctx.globalAlpha=1;
  // Marques argentées sur les flancs
  ctx.globalAlpha=0.7;
  px(14,32,5,4,'#cccccc'); px(40,34,5,4,'#cccccc'); px(28,36,4,3,'#ddeeff');
  ctx.globalAlpha=1;
  // Pattes
  px(10,42,10,14,'#0a0a04'); px(8,48,10,10,'#000000');
  px(40,42,10,14,'#0a0a04'); px(42,48,10,10,'#000000');
  px(20,44,8,12,'#0a0a04'); px(34,44,8,12,'#0a0a04');
  // Lueur argentée aux pattes
  ctx.globalAlpha=0.6;
  px(10,50,2,5,'#ddeeff'); px(48,50,2,5,'#ddeeff');
  ctx.globalAlpha=1;
  // Griffes argentées
  px(8,56,12,4,'#cccccc'); px(40,56,12,4,'#cccccc');
  px(20,56,8,4,'#cccccc'); px(34,56,8,4,'#cccccc');
  // Queue royale avec flamme argentée
  px(46,32,4,8,'#1a1408'); px(48,28,5,8,'#ddeeff'); px(52,24,4,8,'#ffffff');
  px(56,20,3,6,'#ffffff'); px(58,16,2,4,'#ffeebb');
  ctx.globalAlpha=0.9;
  px(50,26,2,3,'#ffffff');
  ctx.globalAlpha=1;
  // Étincelles d'argent
  ctx.globalAlpha=0.9;
  px(2,16,1,1,'#ffffff'); px(60,38,1,1,'#ffffff'); px(2,44,1,1,'#ddeeff'); px(58,46,1,1,'#ddeeff');
  ctx.globalAlpha=1;
};

// 🔥 Pyrécarde — évolution de Pyrécate (mante-générale)
PM_SPRITES.pyrecarde = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura ardente
  ctx.globalAlpha=0.3;
  px(0,0,64,64,'#cc4818');
  ctx.globalAlpha=1;
  // Antennes longues royales
  px(20,0,2,8,'#b8401a'); px(42,0,2,8,'#b8401a');
  px(18,0,2,4,'#dd6028'); px(44,0,2,4,'#dd6028');
  ctx.globalAlpha=0.9;
  px(19,0,1,2,'#ffaa44'); px(45,0,1,2,'#ffaa44');
  ctx.globalAlpha=1;
  // Couronne de général
  px(22,4,20,3,'#ffcc44'); px(26,2,4,3,'#ffeebb'); px(34,2,4,3,'#ffeebb');
  // Tête triangulaire
  px(18,7,28,6,'#cc4818'); px(16,11,32,6,'#a8381a'); px(18,17,28,4,'#7a2810');
  // Yeux composés intenses
  px(16,9,9,9,'#1a0808'); px(17,10,7,7,'#ffaa44');
  px(39,9,9,9,'#1a0808'); px(40,10,7,7,'#ffaa44');
  // Reflets profonds
  px(18,11,3,3,'#ffeebb'); px(41,11,3,3,'#ffeebb');
  px(20,13,2,2,'#ff6020'); px(43,13,2,2,'#ff6020');
  // Mandibules aiguisées
  px(26,17,4,4,'#1a0808'); px(34,17,4,4,'#1a0808');
  px(24,19,3,3,'#3a1810'); px(37,19,3,3,'#3a1810');
  // Cou royal
  px(28,20,8,4,'#a8381a'); px(30,22,4,3,'#7a2810');
  // Thorax (plus large, plus orné)
  px(18,24,28,12,'#cc4818'); px(16,28,32,12,'#a8381a'); px(18,38,28,4,'#7a2810');
  // Marques flamboyantes royales
  ctx.globalAlpha=0.9;
  px(20,28,5,5,'#ffaa44'); px(39,28,5,5,'#ffaa44'); px(26,32,12,4,'#ff7030');
  ctx.globalAlpha=1;
  // Décorations dorées sur le thorax
  px(28,30,2,8,'#ffcc44'); px(34,30,2,8,'#ffcc44');
  // QUATRE LAMES (deux paires - "lames doubles")
  // Bras gauche supérieur
  px(6,20,12,4,'#a8381a'); px(2,16,8,4,'#7a2810');
  // Lame gauche supérieure
  px(0,4,4,14,'#cc4818'); px(0,2,3,8,'#dd6028');
  ctx.globalAlpha=0.9;
  px(0,6,2,12,'#ffaa44'); px(0,2,2,4,'#ffeebb');
  ctx.globalAlpha=1;
  // Bras gauche inférieur
  px(6,30,10,4,'#a8381a'); px(2,32,6,4,'#7a2810');
  // Lame gauche inférieure (plus petite)
  px(0,30,4,8,'#cc4818'); px(0,28,2,4,'#dd6028');
  ctx.globalAlpha=0.9;
  px(0,30,2,8,'#ffaa44');
  ctx.globalAlpha=1;
  // Bras droit supérieur
  px(46,20,12,4,'#a8381a'); px(54,16,8,4,'#7a2810');
  // Lame droite supérieure
  px(60,4,4,14,'#cc4818'); px(61,2,3,8,'#dd6028');
  ctx.globalAlpha=0.9;
  px(62,6,2,12,'#ffaa44'); px(62,2,2,4,'#ffeebb');
  ctx.globalAlpha=1;
  // Bras droit inférieur
  px(48,30,10,4,'#a8381a'); px(56,32,6,4,'#7a2810');
  // Lame droite inférieure
  px(60,30,4,8,'#cc4818'); px(62,28,2,4,'#dd6028');
  ctx.globalAlpha=0.9;
  px(62,30,2,8,'#ffaa44');
  ctx.globalAlpha=1;
  // Ailes repliées
  ctx.globalAlpha=0.7;
  px(14,30,6,12,'#a8381a'); px(44,30,6,12,'#a8381a');
  ctx.globalAlpha=0.5;
  px(12,32,6,10,'#cc4818'); px(46,32,6,10,'#cc4818');
  ctx.globalAlpha=1;
  // Veines des ailes
  px(16,32,1,8,'#3a1810'); px(47,32,1,8,'#3a1810');
  // Abdomen long
  px(20,40,24,18,'#7a2810'); px(22,44,20,14,'#5e1c08');
  // Segments
  px(20,44,24,1,'#3a1810'); px(20,48,24,1,'#3a1810'); px(20,52,24,1,'#3a1810');
  // Marques dorées sur l'abdomen
  ctx.globalAlpha=0.9;
  px(28,42,8,2,'#ffcc44'); px(28,46,8,2,'#ffcc44'); px(28,50,8,2,'#ffcc44');
  ctx.globalAlpha=1;
  // Pattes
  px(20,52,4,10,'#3a1810'); px(40,52,4,10,'#3a1810');
  px(18,58,4,6,'#3a1810'); px(42,58,4,6,'#3a1810');
  // Étincelles
  ctx.globalAlpha=0.9;
  px(8,2,1,1,'#ffeebb'); px(56,2,1,1,'#ffeebb'); px(28,4,1,1,'#ffeebb');
  ctx.globalAlpha=1;
};

// 🌑 Voilarchive — évolution de Voilombre (manteau d'archives)
PM_SPRITES.voilarchive = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura ancienne
  ctx.globalAlpha=0.3;
  px(2,2,60,60,'#3a2a4a'); px(8,8,48,48,'#2a1a3a');
  ctx.globalAlpha=1;
  // Capuche royale (plus haute)
  px(18,2,28,8,'#3a2a4a'); px(14,6,36,10,'#2a1a3a'); px(16,14,32,6,'#1a0a28');
  // Bordures dorées de la capuche
  ctx.globalAlpha=0.8;
  px(14,6,36,1,'#ffcc44'); px(14,16,36,1,'#ffcc44');
  ctx.globalAlpha=1;
  // Pointes capuche
  px(12,12,4,6,'#1a0a28'); px(48,12,4,6,'#1a0a28');
  // Intérieur sombre
  px(20,12,24,10,'#000008');
  // Yeux dans la capuche (plus brillants, anciens)
  px(24,15,5,5,'#aabbff'); px(35,15,5,5,'#aabbff');
  ctx.globalAlpha=0.9;
  px(23,14,7,7,'#ddeeff'); px(34,14,7,7,'#ddeeff');
  ctx.globalAlpha=1;
  px(26,17,2,2,'#ffffff'); px(37,17,2,2,'#ffffff');
  // Manteau qui tombe (plus drapé)
  px(12,20,40,16,'#3a2a4a'); px(10,24,44,16,'#2a1a3a'); px(12,36,40,8,'#1a0a28');
  // Plis riches du tissu
  ctx.globalAlpha=0.6;
  px(18,26,2,12,'#1a0a28'); px(28,28,2,10,'#1a0a28'); px(38,26,2,12,'#1a0a28'); px(46,28,2,8,'#1a0a28');
  ctx.globalAlpha=1;
  // Bordures dorées royales
  ctx.globalAlpha=0.9;
  px(12,20,40,1,'#ffcc44'); px(12,38,40,1,'#ffcc44'); px(12,42,40,1,'#aa8844');
  ctx.globalAlpha=1;
  // Symboles archives écrits sur le manteau
  ctx.globalAlpha=0.7;
  px(20,28,2,2,'#ffeebb'); px(24,32,2,2,'#ffeebb'); px(30,28,2,2,'#ffeebb');
  px(36,32,2,2,'#ffeebb'); px(42,28,2,2,'#ffeebb'); px(46,32,2,2,'#ffeebb');
  ctx.globalAlpha=1;
  // Petits points connecteurs (mémoires)
  ctx.globalAlpha=0.9;
  px(21,29,1,1,'#ffffff'); px(31,29,1,1,'#ffffff'); px(43,29,1,1,'#ffffff');
  ctx.globalAlpha=1;
  // Manches majestueuses
  px(4,22,12,14,'#3a2a4a'); px(2,26,12,12,'#2a1a3a'); px(0,30,8,8,'#1a0a28');
  px(48,22,12,14,'#3a2a4a'); px(50,26,12,12,'#2a1a3a'); px(56,30,8,8,'#1a0a28');
  // Bordures dorées sur les manches
  ctx.globalAlpha=0.8;
  px(2,34,12,1,'#ffcc44'); px(50,34,12,1,'#ffcc44');
  ctx.globalAlpha=1;
  // Mains spectrales tenant des objets (un livre, une plume?)
  ctx.globalAlpha=0.7;
  px(0,34,6,6,'#5060a0'); px(58,34,6,6,'#5060a0');
  ctx.globalAlpha=1;
  // Livre dans la main gauche
  px(0,32,4,6,'#5a3018'); px(0,33,4,1,'#aa8844'); px(0,36,4,1,'#aa8844');
  ctx.globalAlpha=0.9;
  px(1,34,2,1,'#ffeebb');
  ctx.globalAlpha=1;
  // Plume dans la main droite
  px(60,28,2,8,'#ffffff'); px(58,30,2,5,'#ddeeff');
  // Broche centrale plus grande (cœur de l'archive)
  px(28,28,8,8,'#aa8844'); px(30,30,4,4,'#ffcc44'); px(31,31,2,2,'#ffeebb');
  ctx.globalAlpha=0.6;
  px(25,25,14,14,'#ffeebb');
  ctx.globalAlpha=1;
  // Bas du manteau qui se dissout en mémoires
  ctx.globalAlpha=0.8;
  px(10,44,44,8,'#2a1a3a'); px(12,48,40,6,'#1a0a28');
  ctx.globalAlpha=0.6;
  px(12,52,40,6,'#3a2a4a'); px(14,56,36,4,'#2a1a3a');
  ctx.globalAlpha=0.4;
  px(16,58,32,4,'#3a2a4a'); px(20,60,24,3,'#2a1a3a');
  ctx.globalAlpha=1;
  // Pages volantes (mémoires)
  ctx.globalAlpha=0.8;
  px(4,46,3,3,'#ffeebb'); px(58,48,3,3,'#ffeebb');
  ctx.globalAlpha=1;
  px(5,47,1,1,'#aa8844'); px(59,49,1,1,'#aa8844');
  // Particules d'âme dorées
  ctx.globalAlpha=0.8;
  px(2,18,1,1,'#aabbff'); px(60,20,1,1,'#aabbff');
  px(8,52,2,2,'#ffcc44'); px(54,54,2,2,'#ffcc44');
  px(2,58,1,1,'#aabbff'); px(60,60,1,1,'#aabbff');
  ctx.globalAlpha=1;
};

// 🌀 Brumélord — évolution de Brumélope (antilope-souverain)
PM_SPRITES.brumelord = function(ctx) {
  const px = (x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };
  // Aura crépusculaire majestueuse
  ctx.globalAlpha=0.4;
  px(0,2,64,16,'#ffaa66'); px(0,12,64,12,'#ddccff'); px(0,20,64,8,'#aa88ee');
  ctx.globalAlpha=1;
  // Cornes royales gigantesques (plus longues, ramifiées)
  px(16,2,3,18,'#ddccaa'); px(13,4,3,12,'#eedccc'); px(11,8,2,6,'#ffffff');
  px(10,2,2,4,'#ffffff'); px(14,0,2,4,'#ffffff');
  // Ramifications cornes gauches
  px(10,12,3,3,'#eedccc'); px(8,16,3,3,'#ddccaa');
  px(45,2,3,18,'#ddccaa'); px(48,4,3,12,'#eedccc'); px(51,8,2,6,'#ffffff');
  px(52,2,2,4,'#ffffff'); px(48,0,2,4,'#ffffff');
  // Ramifications cornes droites
  px(51,12,3,3,'#eedccc'); px(53,16,3,3,'#ddccaa');
  // Stries dorées sur cornes
  ctx.globalAlpha=0.9;
  px(16,8,3,1,'#ffcc44'); px(16,12,3,1,'#ffcc44'); px(16,16,3,1,'#ffcc44');
  px(45,8,3,1,'#ffcc44'); px(45,12,3,1,'#ffcc44'); px(45,16,3,1,'#ffcc44');
  ctx.globalAlpha=1;
  // Couronne dorée entre les cornes
  px(20,10,24,3,'#ffcc44'); px(28,8,8,3,'#ffeebb');
  ctx.globalAlpha=0.9;
  px(30,7,4,2,'#ffffff');
  ctx.globalAlpha=1;
  // Tête fine et noble
  px(20,14,24,8,'#f0d8b8'); px(18,18,28,6,'#dcc098'); px(20,22,24,4,'#bca680');
  // Marques d'aurore sur le visage
  ctx.globalAlpha=0.6;
  px(26,16,12,2,'#ddccff'); px(28,18,8,2,'#ffccaa');
  ctx.globalAlpha=1;
  // Yeux royaux profonds
  px(22,18,4,5,'#1a1a22'); px(23,19,2,3,'#ffccaa'); px(24,20,1,1,'#ffffff');
  px(38,18,4,5,'#1a1a22'); px(39,19,2,3,'#ffccaa'); px(40,20,1,1,'#ffffff');
  // Halo léger autour des yeux
  ctx.globalAlpha=0.5;
  px(21,17,6,7,'#ffeeee'); px(37,17,6,7,'#ffeeee');
  ctx.globalAlpha=1;
  // Petit museau
  px(30,22,4,3,'#ffffff'); px(31,23,2,1,'#1a1a22');
  // Cou élancé
  px(28,24,8,6,'#dcc098'); px(30,28,4,4,'#bca680');
  // Corps royal
  px(16,30,32,12,'#f0d8b8'); px(14,34,36,12,'#dcc098'); px(16,42,32,4,'#bca680');
  // Marques aurorales somptueuses
  ctx.globalAlpha=0.6;
  px(20,34,8,4,'#ddccff'); px(36,36,8,4,'#ffccaa'); px(28,40,8,2,'#ffcc44');
  ctx.globalAlpha=1;
  // Crinière dorée sur le cou
  ctx.globalAlpha=0.9;
  px(28,28,2,4,'#ffcc44'); px(34,28,2,4,'#ffcc44');
  ctx.globalAlpha=1;
  // Pattes longues royales
  px(18,46,4,14,'#bca680'); px(16,54,4,8,'#9c8460');
  px(40,46,4,14,'#bca680'); px(42,54,4,8,'#9c8460');
  px(28,46,4,14,'#bca680'); px(30,54,4,8,'#9c8460');
  px(36,46,4,14,'#bca680'); px(34,54,4,8,'#9c8460');
  // Sabots dorés
  px(14,60,8,4,'#ffcc44'); px(40,60,8,4,'#ffcc44');
  px(28,60,4,4,'#ffcc44'); px(34,60,4,4,'#ffcc44');
  ctx.globalAlpha=0.9;
  px(15,61,6,1,'#ffeebb'); px(41,61,6,1,'#ffeebb');
  ctx.globalAlpha=1;
  // Queue royale
  px(46,32,4,8,'#dcc098'); px(50,34,4,6,'#bca680');
  px(50,38,3,8,'#ffffff'); px(50,44,3,4,'#dcc098');
  ctx.globalAlpha=0.8;
  px(50,38,3,3,'#ffeebb');
  ctx.globalAlpha=1;
  // Particules d'aurore
  ctx.globalAlpha=0.7;
  px(2,30,2,2,'#ffccaa'); px(60,32,2,2,'#ddccff');
  px(4,52,2,2,'#ffcc44'); px(58,54,2,2,'#ffcc44');
  px(8,18,1,1,'#ffffff'); px(54,20,1,1,'#ffffff');
  ctx.globalAlpha=1;
};


// Helper universel pour dessiner un PokePom
function drawPokePom(canvas, pokepomId) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  const fn = PM_SPRITES[pokepomId];
  if (fn) fn(ctx);
}

// Variante : dessine la silhouette blanche du PokePom (utilisé pour l'animation d'évolution)
// On dessine d'abord normalement, puis on couvre tous les pixels non-transparents en blanc
function drawPokePomSilhouette(canvas, pokepomId) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  const fn = PM_SPRITES[pokepomId];
  if (!fn) return;
  fn(ctx);
  // Composite "source-in" : remplace tout pixel rendu par du blanc, en respectant la forme
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 64);
  ctx.globalCompositeOperation = 'source-over';
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATION D'ÉVOLUTION (popup plein écran)
   ═══════════════════════════════════════════════════════════════════════════
   Séquence (durées approximatives) :
     0   → 600ms   : fade-in du fond noir + texte "Hum ? Quelque chose se passe..."
     600 → 2200ms  : glow blanc qui s'intensifie autour de la base
     2200 → 4200ms : alternance silhouette base / silhouette évolution (~250ms chacune)
     4200 → 4500ms : flash blanc total
     4500 → 5500ms : reveal de l'évolution + glow qui se dissipe
     5500ms        : message final + bouton OK (attend l'utilisateur)
   Pas de skip. Pas de son. Bouton OK obligatoire pour fermer.
   ─────────────────────────────────────────────────────────────────────────── */

// Affiche l'animation d'évolution. Renvoie une Promise résolue quand l'utilisateur clique OK.
function pmShowEvolutionAnimation(oldId, newId) {
  return new Promise((resolve) => {
    const oldName = PM_DEX[oldId]?.name || oldId;
    const newName = PM_DEX[newId]?.name || newId;

    // Conteneur plein écran
    const overlay = document.createElement('div');
    overlay.id = 'pm-evolution-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(0, 0, 0, 0);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 24px;
      transition: background 600ms ease-in;
      pointer-events: auto;
    `;

    // Zone du sprite (avec glow)
    const stage = document.createElement('div');
    stage.style.cssText = `
      position: relative;
      width: 256px; height: 256px;
      display: flex; align-items: center; justify-content: center;
    `;

    // Glow (radial blanc qui pulse)
    const glow = document.createElement('div');
    glow.style.cssText = `
      position: absolute; inset: 0;
      background: radial-gradient(circle, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 60%, transparent 100%);
      transition: background 1500ms ease-in-out;
      pointer-events: none;
    `;
    stage.appendChild(glow);

    // Canvas du sprite (256x256 avec scaling depuis 64x64)
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    canvas.style.cssText = `
      width: 192px; height: 192px;
      image-rendering: pixelated; image-rendering: crisp-edges;
      position: relative; z-index: 2;
      transition: opacity 200ms;
    `;
    stage.appendChild(canvas);

    // Flash blanc plein écran (caché au début)
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed; inset: 0;
      background: #ffffff;
      opacity: 0;
      transition: opacity 200ms ease-out;
      pointer-events: none;
      z-index: 100000;
    `;
    document.body.appendChild(flash);

    // Texte principal
    const text = document.createElement('div');
    text.style.cssText = `
      font-family: 'Space Mono', monospace;
      color: #ffffff;
      font-size: 1.1rem;
      text-align: center;
      max-width: 80vw;
      opacity: 0;
      transition: opacity 400ms;
      min-height: 3em;
      padding: 0 24px;
    `;
    text.textContent = '';

    // Bouton OK (caché tant que l'animation n'est pas finie)
    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText = `
      padding: 12px 32px;
      background: #ffffff;
      color: #1a1a22;
      border: none;
      border-radius: 8px;
      font-family: 'Space Mono', monospace;
      font-size: 1rem;
      font-weight: bold;
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: opacity 300ms;
    `;
    okBtn.addEventListener('click', () => {
      overlay.style.background = 'rgba(0, 0, 0, 0)';
      overlay.style.transition = 'background 300ms ease-out';
      setTimeout(() => {
        overlay.remove();
        flash.remove();
        resolve();
      }, 300);
    });

    overlay.appendChild(stage);
    overlay.appendChild(text);
    overlay.appendChild(okBtn);
    document.body.appendChild(overlay);

    // Étape 1 : Dessine la base immédiatement
    drawPokePom(canvas, oldId);

    // Étape 2 : Fade-in du fond noir
    requestAnimationFrame(() => {
      overlay.style.background = 'rgba(0, 0, 0, 0.92)';
    });

    // Étape 3 : Apparition du texte d'intro à 600ms
    setTimeout(() => {
      text.textContent = `Hum ? Quelque chose se passe...`;
      text.style.opacity = '1';
    }, 600);

    // Étape 4 : Glow s'intensifie à 1200ms
    setTimeout(() => {
      glow.style.background = 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 80%)';
      text.style.opacity = '0';
    }, 1200);

    // Étape 5 : Mise à jour du texte à 1700ms
    setTimeout(() => {
      text.textContent = `${oldName} évolue !`;
      text.style.opacity = '1';
    }, 1700);

    // Étape 6 : Alternance silhouettes base ↔ évolution à 2200ms
    // 4 alternances de ~400ms chacune (base→évo→base→évo→base→évo→base→évo)
    let isEvo = false;
    const altCount = 7; // 7 changements pour finir sur l'évolution
    let altDone = 0;
    const altInterval = setInterval(() => {
      isEvo = !isEvo;
      if (isEvo) {
        drawPokePomSilhouette(canvas, newId);
      } else {
        drawPokePomSilhouette(canvas, oldId);
      }
      altDone++;
      if (altDone >= altCount) {
        clearInterval(altInterval);
      }
    }, 280);

    // Étape 7 : Flash blanc à 4200ms
    setTimeout(() => {
      flash.style.opacity = '1';
    }, 4200);

    // Étape 8 : Reveal à 4500ms (flash s'estompe, sprite final apparaît)
    setTimeout(() => {
      drawPokePom(canvas, newId);
      flash.style.opacity = '0';
      // Glow qui se dissipe doucement
      glow.style.background = 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 60%, transparent 100%)';
      text.style.opacity = '0';
    }, 4500);

    // Étape 9 : Glow disparaît complètement à 5200ms
    setTimeout(() => {
      glow.style.background = 'radial-gradient(circle, rgba(255,255,255,0) 0%, transparent 100%)';
    }, 5200);

    // Étape 10 : Message final + bouton OK à 5500ms
    setTimeout(() => {
      text.innerHTML = `<strong>Félicitations !</strong><br>${oldName} a évolué en <strong>${newName}</strong> !`;
      text.style.opacity = '1';
      okBtn.style.opacity = '1';
      okBtn.style.pointerEvents = 'auto';
    }, 5500);
  });
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
  // Badges R2 (étape 6)
  if (data.badgesR2 && !Array.isArray(data.badgesR2)) {
    data.badgesR2 = Object.values(data.badgesR2);
  }
  if (!Array.isArray(data.badgesR2)) data.badgesR2 = [];
  // PomeDex étendu : trace des PokePoms RENCONTRÉS (capturés ou évolués depuis).
  // Permet de garder la forme de base au PomeDex après évolution. Pour les
  // anciens players, on initialise à partir de leur collection actuelle.
  if (data.dexSeen && !Array.isArray(data.dexSeen)) {
    data.dexSeen = Object.values(data.dexSeen);
  }
  if (!Array.isArray(data.dexSeen)) {
    data.dexSeen = (data.collection || []).map(i => i.pokepomId);
  }
  // Backfill : s'il y a une instance dans collection dont l'id n'est pas dans dexSeen, l'ajouter
  (data.collection || []).forEach(i => {
    if (i.pokepomId && !data.dexSeen.includes(i.pokepomId)) data.dexSeen.push(i.pokepomId);
  });
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

// Sauvegarde avec debounce (toutes les 2 secondes max — réduit le bandwidth Firebase)
let _pmDirty = false;

function pmScheduleSave() {
  if (!_pmLoaded || !_pmCache) return;
  _pmDirty = true;
  if (_pmSaveTimer) return; // un save est déjà programmé, on attend
  _pmSaveTimer = setTimeout(async () => {
    _pmSaveTimer = null;
    if (!_pmDirty) return;
    _pmDirty = false;
    if (typeof dbSet !== 'function' || !state || !state.code) return;
    try {
      await dbSet(pmPath(), _pmCache);
    } catch(e) {
      console.error('[pokepom] save error', e);
      _pmDirty = true; // re-marquer dirty pour réessayer
    }
  }, 2000);
}

// Sauvegarde immédiate (utilisée aux fins de combat pour garantir la persistance)
async function pmSaveNow() {
  if (!_pmLoaded || !_pmCache) return;
  if (_pmSaveTimer) { clearTimeout(_pmSaveTimer); _pmSaveTimer = null; }
  _pmDirty = false;
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
      _pmLeagueLbCache = null; // Invalider le cache
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

// Vérifie si une instance peut/doit évoluer et applique la transformation.
//
// L'architecture du jeu calcule les stats à la volée via pmGetStats(instance),
// donc évoluer = simplement changer instance.pokepomId. Les stats, moves, type,
// sprite seront automatiquement ceux de la nouvelle forme dès la prochaine lecture.
//
// Déclencheurs :
//   - Le PokePom a une entrée dans PM_EVOLUTIONS
//   - Niveau >= PM_EVOLUTION_LEVEL (20) OU flag pendingEvolution = true
//
// Retourne { oldId, newId } si évolution effectuée, null sinon.
function pmCheckAndApplyEvolution(instance) {
  if (!instance) return null;
  const evoId = PM_EVOLUTIONS[instance.pokepomId];
  if (!evoId) return null;

  const reachedLevel = instance.level >= PM_EVOLUTION_LEVEL;
  const isPending = instance.pendingEvolution === true;
  if (!reachedLevel && !isPending) return null;

  if (!PM_DEX[evoId]) {
    console.warn('[PokePom] Évolution introuvable dans le Dex:', evoId);
    return null;
  }

  const oldId = instance.pokepomId;
  instance.pokepomId = evoId;
  delete instance.pendingEvolution;

  // PomeDex : marquer la NOUVELLE forme comme vue (la base reste vue puisqu'elle
  // a été ajoutée à dexSeen au moment de la capture initiale, et qu'on ne retire
  // jamais d'entrées du PomeDex).
  try {
    const player = (typeof pmGetPlayer === 'function') ? pmGetPlayer() : null;
    if (player) {
      if (!player.dexSeen) player.dexSeen = [];
      if (!player.dexSeen.includes(evoId)) {
        player.dexSeen.push(evoId);
        // pmSavePlayer si dispo (pour persister immédiatement)
        if (typeof pmSavePlayer === 'function') pmSavePlayer(player);
      }
    }
  } catch (e) { /* sandbox/test env, on ignore */ }

  return { oldId, newId: evoId };
}

// ═══════════════════════════════════════════════════════════════════════════
// DOJO — apprentissage de moves
// ═══════════════════════════════════════════════════════════════════════════

// Retourne le moveset effectif d'une instance sous forme d'array d'IDs (pour Dojo).
// Si l'instance a customMoves, retourne ça ; sinon les natifs du type.
function pmGetInstanceMoveIds(instance) {
  if (Array.isArray(instance.customMoves) && instance.customMoves.length === 4) {
    return [...instance.customMoves];
  }
  const poke = PM_DEX[instance.pokepomId];
  return [...PM_MOVES_BY_TYPE[poke.type]];
}

// Apprend un nouveau move au Dojo, en remplacement d'un move existant.
// Vérifie :
//   - L'instance existe et appartient au joueur
//   - Niveau >= PM_DOJO_MIN_LEVEL (10)
//   - Le move est dans le catalogue de cette espèce
//   - Le PokePom ne connaît pas déjà ce move (sinon inutile)
//   - Le slot de remplacement est valide [0..3]
//   - Le joueur a assez de Pomels (vérifié via wallet)
//
// NOTE : la déduction des Pomels est faite par l'UI via addBalanceTransaction
// (transaction atomique). Cette fonction ne touche pas au wallet. Elle se contente
// de muter l'instance.
//
// Retourne { ok: true, oldMoveId, newMoveId } ou { ok: false, reason }
function pmDojoLearnMove(player, instanceUid, newMoveId, replaceSlotIdx) {
  const instance = (player.collection || []).find(i => i.uid === instanceUid);
  if (!instance) return { ok: false, reason: 'instance_not_found' };
  if (instance.level < PM_DOJO_MIN_LEVEL) {
    return { ok: false, reason: 'level_too_low', minLevel: PM_DOJO_MIN_LEVEL };
  }
  const allowed = pmDojoMovesFor(instance.pokepomId);
  if (!allowed.includes(newMoveId)) return { ok: false, reason: 'move_not_learnable' };
  if (!PM_MOVES[newMoveId]) return { ok: false, reason: 'invalid_move' };

  const currentMoves = pmGetInstanceMoveIds(instance);
  if (currentMoves.includes(newMoveId)) return { ok: false, reason: 'already_known' };
  if (replaceSlotIdx < 0 || replaceSlotIdx > 3) return { ok: false, reason: 'invalid_slot' };

  const oldMoveId = currentMoves[replaceSlotIdx];

  // Mute customMoves : crée le tableau si absent
  const newMoves = [...currentMoves];
  newMoves[replaceSlotIdx] = newMoveId;
  instance.customMoves = newMoves;

  return { ok: true, oldMoveId, newMoveId };
}
// ═══════════════════════════════════════════════════════════════════════════
// PvP — Helpers ELO et profil → définis dans la nouvelle implémentation à la fin
// ═══════════════════════════════════════════════════════════════════════════


// Ajout d'XP et montée de niveau
// Retourne { leveledUp: bool, evolved: bool, oldId: string|null, newId: string|null }
// L'évolution est gérée ici pour qu'elle se déclenche systématiquement au passage de niveau
function pmGainXP(instance, amount) {
  instance.xp += amount;
  let leveledUp = false;
  while (instance.level < PM_LEVEL_MAX && instance.xp >= PM_XP_TABLE[instance.level]) {
    instance.xp -= PM_XP_TABLE[instance.level];
    instance.level++;
    leveledUp = true;
  }
  if (instance.level >= PM_LEVEL_MAX) instance.xp = 0;

  // Évolution : niveau 20 OU flag pendingEvolution (capture > niv 20)
  let evolved = false;
  let oldId = null, newId = null;
  if (leveledUp && typeof pmCheckAndApplyEvolution === 'function') {
    const evoResult = pmCheckAndApplyEvolution(instance);
    if (evoResult) {
      evolved = true;
      oldId = evoResult.oldId;
      newId = evoResult.newId;
    }
  }

  return { leveledUp, evolved, oldId, newId };
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
  const moves = getMoveset(instance);  // passe l'instance (pour customMoves)
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
  // Si le move ignore les buffs DEF (ex: Lame d'Orichal), utiliser baseDef
  // si l'adversaire a un buff DEF positif. Une DEF déjà debuffée reste plus basse.
  let defValue = defender.def;
  if (move.ignoreDefBuffs && defender.stages && defender.stages.def > 0) {
    defValue = defender.baseDef;
  }
  const baseDmg = (attacker.atk * move.power / defValue) / 3;
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

    // Self-heal (Brise Vitale, ratio sur HP max)
    if (move.selfHealPct) {
      const heal = Math.floor(attacker.maxHp * move.selfHealPct);
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
      events.push({ type:'self_heal', target: attacker.name, amount: heal });
    }

    // Drain (Souffle Aurore, ratio sur dégâts infligés)
    if (move.healFraction && dmg > 0) {
      const heal = Math.floor(dmg * move.healFraction);
      if (heal > 0) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
        events.push({ type:'self_heal', target: attacker.name, amount: heal });
      }
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
      } else if (move.sideEffect === 'debuff_vit') {
        if (defender.stages.vit > -3) {
          defender.stages.vit--;
          pmApplyStages(defender);
          events.push({ type:'stage', target: defender.name, stat:'VIT', dir:-1 });
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
    // Support pour move multi-stats (ex: Malédiction → ATK + DEF)
    const statsToDebuff = move.multiStat || [move.stat];
    let anyApplied = false;
    for (const stat of statsToDebuff) {
      if (defender.stages[stat] > -3) {
        defender.stages[stat] += move.stages;
        if (defender.stages[stat] < -3) defender.stages[stat] = -3;
        anyApplied = true;
        events.push({ type:'stage', target: defender.name, stat: stat.toUpperCase(), dir: move.stages });
      } else {
        events.push({ type:'stat_min', target: defender.name, stat: stat.toUpperCase() });
      }
    }
    if (anyApplied) pmApplyStages(defender);
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

// Quand un PokePom sort du combat (switch volontaire ou KO), tous les buffs/nerfs
// (stages atk/def/vit) et le statut de brûlure sont remis à zéro. C'est cohérent
// avec la règle : ces effets sont liés au "moment de combat" du PokePom, pas
// persistants. Réutilisé par le PvE (pmDoSwitch + KO auto-switch) et le PvP
// (pvpResolveTurn) pour un comportement unifié.
function pmResetFighterStateOnExit(fighter) {
  if (!fighter) return;
  fighter.stages = { atk: 0, def: 0, vit: 0 };
  fighter.burnTurns = 0;
  // hp et ko sont préservés intentionnellement — si le PokePom revient au combat
  // plus tard, il garde ses HP actuels.
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
  // Marquer comme vu dans le PomeDex (idempotent)
  if (!player.dexSeen) player.dexSeen = [];
  if (instance.pokepomId && !player.dexSeen.includes(instance.pokepomId)) {
    player.dexSeen.push(instance.pokepomId);
  }
  pmSavePlayer(player);
}


/* ═══════════════════════════════════════════════════════════════════════════
   9. COMBATS SAUVAGES
   ═══════════════════════════════════════════════════════════════════════════ */

function pmGenerateWildEncounter() {
  // Détermine la map active pour filtrer les candidats
  // (sécurité : si appelée hors map context, default à R1)
  const mapId = (typeof _pmCurrentMap !== 'undefined' && _pmCurrentMap === 'r2') ? 'r2' : 'r1';

  const roll = Math.random() * 100;
  let acc = 0;
  let type = null;
  // Choix du type selon rareté
  for (const t of PM_TYPES) {
    acc += PM_ENCOUNTER_RATES[t] || 0;
    if (roll < acc) { type = t; break; }
  }
  if (!type) type = 'plante';

  // Liste des PokePoms de ce type, filtrée par map et excluant évolutions
  const allOfType = PM_DEX_IDS.filter(id => PM_DEX[id].type === type);
  let candidates = pmFilterCandidatesForMap(allOfType, mapId);
  // Si vide pour la map, fallback : tous les non-évolutions de cette map
  if (candidates.length === 0) {
    candidates = PM_DEX_IDS.filter(id => {
      const p = PM_DEX[id];
      if (p.isEvolution) return false;
      if (mapId === 'r1') return !p.region || p.region !== 2;
      return p.region === 2;
    });
  }
  if (candidates.length === 0) candidates = PM_DEX_IDS.filter(id => !PM_DEX[id].isEvolution);

  // Chance ultra-rare de légendaire
  const legends = candidates.filter(id => PM_DEX[id].legendary);
  let chosen;
  if (legends.length > 0 && Math.random() < 0.1) {
    chosen = legends[Math.floor(Math.random() * legends.length)];
  } else {
    const nonLegends = candidates.filter(id => !PM_DEX[id].legendary);
    chosen = nonLegends[Math.floor(Math.random() * nonLegends.length)] || candidates[0];
  }

  // Niveau du sauvage : basé sur niveau moyen de l'équipe, ±1
  // R1 : plafond PM_R1_WILD_LEVEL_CAP (12)
  // R2 : plancher PM_R2_WILD_LEVEL_MIN (6), plafond PM_LEVEL_MAX (30)
  let wildLvl;
  if (mapId === 'r2') {
    wildLvl = Math.max(PM_R2_WILD_LEVEL_MIN, Math.min(PM_LEVEL_MAX, avgLvl + (Math.floor(Math.random() * 5) - 2)));
  } else {
    wildLvl = Math.max(1, Math.min(PM_R1_WILD_LEVEL_CAP, avgLvl + (Math.floor(Math.random() * 3) - 1)));
  }
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

// ═══════════════════════════════════════════════════════════════════════════
// ARÈNES RÉGION 2 — 6 arènes plus difficiles (niveau 14 → 27)
// 4 doublons des types R1 (champions = évolutions) + 2 nouveaux types
// Récompense Pomels par paliers de difficulté.
// Stockées dans player.badgesR2 (séparé de player.badges).
// ═══════════════════════════════════════════════════════════════════════════
const PM_GYMS_R2 = [
  { id:'plante2',     name:'Arène Plante (R2)',     champion:'mousseroi',  championName:'Maître Mousseroi',  order:1, level:14, reward:1500, region:2 },
  { id:'feu2',        name:'Arène Feu (R2)',        champion:'pyrecarde',  championName:'Générale Pyrécarde', order:2, level:17, reward:1500, region:2 },
  { id:'glace',       name:'Arène Glace',           champion:'hivernel',   championName:'Roi Hivernel',      order:3, level:20, reward:2000, region:2 },
  { id:'eau2',        name:'Arène Eau (R2)',        champion:'goutaragon', championName:'Seigneur Goutaragon', order:4, level:22, reward:2000, region:2 },
  { id:'metal',       name:'Arène Métal',           champion:'rouilleron', championName:'Titan Rouilleron',  order:5, level:25, reward:2500, region:2 },
  { id:'electrique2', name:'Arène Électrique (R2)', champion:'fulgurion',  championName:'Tempête Fulgurion', order:6, level:27, reward:2500, region:2 }
];

// Récompenses Pomels variables pour les arènes R2 (le R1 reste à PM_REWARD_GYM)
function pmGetGymReward(gym) {
  return gym.reward || PM_REWARD_GYM;
}

function pmGetGym(id) {
  return PM_GYMS.find(g => g.id === id) || PM_GYMS_R2.find(g => g.id === id);
}

// Liste des arènes actives selon la carte courante
function pmGetActiveGyms() {
  return _pmCurrentMap === 'r2' ? PM_GYMS_R2 : PM_GYMS;
}

// Liste des badges du joueur pour la map active (R1 → badges, R2 → badgesR2)
function pmGetActiveBadges(player) {
  if (_pmCurrentMap === 'r2') return player.badgesR2 || [];
  return player.badges || [];
}

function pmGenerateGymChampion(gym) {
  // Niveau : 7 par défaut (R1), ou champ gym.level pour R2
  const lvl = gym.level || 7;
  const instance = pmCreatePokePomInstance(gym.champion, lvl);
  return instance;
}


/* ═══════════════════════════════════════════════════════════════════════════
   11. LIGUE POMMON
   ═══════════════════════════════════════════════════════════════════════════ */

function pmGenerateLeagueOpponent(roundNum) {
  // Ligue R1 : niveau progressif, plafonné cohérent avec R1 (proche du cap sauvages)
  // Round 1 = 5, +1 par round, max 12 (= niveau cap R1)
  const lvl = Math.min(PM_R1_WILD_LEVEL_CAP, 4 + roundNum);
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
    .pm-collection-card.pm-coll-unknown { opacity:0.6; cursor:default; filter:grayscale(1); }
    .pm-collection-card.pm-coll-unknown:hover { border-color:var(--border); transform:none; }
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

    // Masquer le bouton info flottant ET stopper la map quand on quitte PomMon
    const observer = new MutationObserver(() => {
      const isActive = page.classList.contains('active');
      const floatBtn = document.getElementById('pm-info-float');
      if (floatBtn) floatBtn.style.display = isActive ? 'flex' : 'none';
      if (!isActive && typeof pmStopMap === 'function') {
        pmStopMap();
        _pmMapNeedsResume = true; // Forcer un "Continuer" au retour
      }
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
    case 'dojo': pmRenderDojo(page, player); break;
    case 'pvp': pmRenderPvpHub(page, player); break;
    case 'pvpList': pmRenderPvpList(page, player); break;
    case 'pvpBattle': pmRenderPvpBattle(page, player); break;
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

// Zones de la Région 2 — Terres de PomStud
// Chaque zone a sa palette propre (cohérente avec son thème) et ses types associés.
// Les R2 spawnent UNIQUEMENT en R2, et inversement les R1 ne spawnent pas en R2.
const PM_R2_ZONES = {
  bois_aelmoria:  { label: "Bois d'Aelmoria",     grass1: '#3e7028', grass2: '#5a9038', ground: '#4a6028', types: ['plante','ombre'],     legendRate: 0.04 },
  cendrelande:    { label: 'Cendrelande',          grass1: '#7a3a28', grass2: '#9a5238', ground: '#5a2818', types: ['feu','metal'],       legendRate: 0.04 },
  glaciers_vorh:  { label: 'Glaciers de Vorh',     grass1: '#88b8d4', grass2: '#aac8e8', ground: '#688898', types: ['glace','eau'],       legendRate: 0.05 },
  mines_orichal:  { label: "Mines d'Orichal",      grass1: '#5a4830', grass2: '#7a6848', ground: '#3e3018', types: ['metal','electrique'],legendRate: 0.04 },
  hauteurs_solenne:{ label: 'Hauteurs de Solenne',grass1: '#c0c058', grass2: '#d8d878', ground: '#a8a848', types: ['lumiere','air'],     legendRate: 0.05 },
  marais_oblivion:{ label: "Marais d'Oblivion",   grass1: '#3a3848', grass2: '#5a5868', ground: '#2a2838', types: ['ombre','glace'],     legendRate: 0.05 },
};

// ═══════════════════════════════════════════════════════════════════════════
// LORE : panneaux (type 13) et PNJ (type 14)
// ═══════════════════════════════════════════════════════════════════════════
// Chaque entrée : { kind: 'sign' | 'pnj', zone: 'id_zone', text: 'string',
//                   pages: ['p1','p2'], pnjLabel?: '...' }
// Position relative à la zone : posée par le builder dans une case herbe libre
// (kind 'sign') ou sur le chemin/bord (kind 'pnj').
// ─────────────────────────────────────────────────────────────────────────
// Le builder utilise PM_LORE_R1 / PM_LORE_R2 pour placer ces éléments.
// On peut placer plusieurs éléments dans la même zone — l'ordre de la liste
// détermine l'ordre de placement (premier libre).

const PM_LORE_R1 = [
  // Prairie Élémentaire — accueil tutoriel
  { kind: 'sign', zone: 'elementaire',
    text: "Bienvenue à la Prairie Élémentaire. Ici cohabitent les quatre éléments fondateurs : Plante, Feu, Eau et Électricité." },
  { kind: 'pnj', zone: 'elementaire', pnjLabel: 'Vieil Apprenti',
    pages: [
      "Tiens, un nouveau visage. Tu sors de Bourg-Pomel ?",
      "Cette prairie est l'endroit idéal pour commencer. Garde-toi de t'aventurer trop au sud avant d'avoir gagné quelques badges.",
      "On dit qu'au-delà de la mer s'étendent d'autres terres. Mais ce sont des histoires de marins."
    ] },

  // Mont des Vents — un peu mystique
  { kind: 'sign', zone: 'montagne',
    text: "Mont des Vents. Le souffle ne s'arrête jamais ici. Les anciens disaient qu'il portait la voix des oiseaux disparus." },
  { kind: 'pnj', zone: 'montagne', pnjLabel: 'Bergère',
    pages: [
      "Mes brebis se sont enfuies quand un Cyclonin est passé. Tu en as vu ?",
      "Si tu en croises un, ne le fixe pas trop longtemps. Il prend ça pour un défi."
    ] },

  // Plaine Lumineuse
  { kind: 'sign', zone: 'lumiere',
    text: "Plaine Lumineuse. Le soleil se lève ici en premier, et se couche en dernier. Les PokePoms qui y vivent en gardent un peu de cet éclat." },

  // Grotte du Crépuscule
  { kind: 'sign', zone: 'grotte',
    text: "Grotte du Crépuscule. La lumière n'y entre jamais tout à fait. Les ombres y prennent forme sans qu'on sache si elles regardent." },
  { kind: 'pnj', zone: 'grotte', pnjLabel: 'Ermite',
    pages: [
      "Hé. Pas un mot trop fort. Ils écoutent.",
      "Si tu cherches Nihilium, perds ton temps ailleurs. C'est lui qui te trouve, pas l'inverse."
    ] }
];

const PM_LORE_R2 = [
  // Bois d'Aelmoria — Plante / Ombre — forêt primordiale
  { kind: 'sign', zone: 'bois_aelmoria',
    text: "Bois d'Aelmoria. Forêt primordiale aux arbres millénaires. Les racines y plongent si profond, dit-on, qu'elles touchent l'âme du monde." },
  { kind: 'pnj', zone: 'bois_aelmoria', pnjLabel: 'Jardinière Errante',
    pages: [
      "Tu sens cette odeur ? C'est l'humus des âges.",
      "Mon Mousseroi a appris à parler aux arbres. Enfin... à les écouter, plus précisément.",
      "Ne marche pas sur les fougères dorées. Elles se souviennent."
    ] },

  // Cendrelande — Feu / Métal — plaine volcanique forgée
  { kind: 'sign', zone: 'cendrelande',
    text: "Cendrelande. La roche fond et se reforge sans cesse. Les forgerons d'antan y travaillaient le minerai pendant que les flammes bénissaient leurs ouvrages." },
  { kind: 'pnj', zone: 'cendrelande', pnjLabel: 'Apprenti Forgeron',
    pages: [
      "Ah, un voyageur. Approche, mais reste en deçà de la ligne rouge.",
      "Mon maître affirmait qu'un Forgehammer ne sonne juste qu'entre des mains honnêtes.",
      "Je n'ai pas encore réussi à le faire chanter. Mais peut-être qu'un jour..."
    ] },

  // Glaciers de Vorh — Glace / Eau
  { kind: 'sign', zone: 'glaciers_vorh',
    text: "Glaciers de Vorh. Mer gelée éternelle. Sous la glace, des courants chauds creusent des cathédrales bleutées que peu d'yeux ont vues." },
  { kind: 'pnj', zone: 'glaciers_vorh', pnjLabel: 'Pêcheuse de Givre',
    pages: [
      "Tu ne devrais pas rester immobile trop longtemps. Le froid pénètre les os.",
      "J'ai vu un Hivernel, une fois. Une seule. Il n'a pas regardé dans ma direction et j'en remercie encore les saisons.",
      "Si tu vois une silhouette de cristal danser sur la glace, ne danse pas avec elle."
    ] },

  // Mines d'Orichal — Métal / Électrique
  { kind: 'sign', zone: 'mines_orichal',
    text: "Mines d'Orichal. Galeries oubliées où le minerai vit encore. Les filons d'orichalque pulsent d'une lumière propre, comme si la pierre rêvait d'être éveillée." },
  { kind: 'pnj', zone: 'mines_orichal', pnjLabel: 'Vieux Mineur',
    pages: [
      "Bonjour, voyageur. Ne touche pas aux veines vertes — elles mordent.",
      "On a cessé d'extraire l'orichalque il y a trois générations. La pierre s'était mise à se plaindre.",
      "Maintenant on vient juste l'écouter."
    ] },

  // Hauteurs de Solenne — Lumière / Air
  { kind: 'sign', zone: 'hauteurs_solenne',
    text: "Hauteurs de Solenne. Plateaux célestes baignés par un soleil qui ne se couche jamais. Le vent y porte des chants dans une langue que personne ne parle plus." },
  { kind: 'pnj', zone: 'hauteurs_solenne', pnjLabel: 'Astronome Aveugle',
    pages: [
      "L'altitude ? Six mille pas, mesurés au pouls.",
      "Je ne vois plus, mais j'entends les étoiles bouger. Elles chuchotent ce qui va arriver, parfois.",
      "Tu transportes quelque chose de fort. Une évolution récente, peut-être ? Je sens l'écho."
    ] },

  // Marais d'Oblivion — Ombre / Glace
  { kind: 'sign', zone: 'marais_oblivion',
    text: "Marais d'Oblivion. Étendue de tourbières gelées où les âmes oubliées prennent forme. Mieux vaut ne pas y prononcer son propre nom à voix haute." },
  { kind: 'pnj', zone: 'marais_oblivion', pnjLabel: 'Voyageur Sans Nom',
    pages: [
      "...",
      "Ah pardon. J'avais oublié comment on parlait.",
      "Si tu vois un manteau abandonné sur un rocher, laisse-le. Il attend quelqu'un. Ce n'est pas toi."
    ] }
];

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
let _pmMapNeedsResume = false;

const PM_MAP_FULL_W = 50;
const PM_MAP_FULL_H = 38;

// Région 2 — carte plus grande pour accueillir 6 zones (vs 4 en R1)
// Disposition prévue : 3 zones en haut, 3 en bas, séparées par un chemin en croix
const PM_MAP_R2_W = 70;
const PM_MAP_R2_H = 48;

// Carte courante : 'r1' ou 'r2'. Persisté côté player (player.currentMap).
let _pmCurrentMap = 'r1';

// Grille R2 (générée une fois lors du premier accès, comme R1)
let _pmMapR2Grid = null;
let _pmMapR2ZoneGrid = null;

// Lore : dictionnaires "row,col" → entrée PM_LORE_R1/R2 (rempli par les builders)
let _pmLoreR1 = {};
let _pmLoreR2 = {};

// Helper : récupère l'entrée de lore à une position sur la map active
function pmGetLoreAt(r, c) {
  const dict = _pmCurrentMap === 'r2' ? _pmLoreR2 : _pmLoreR1;
  return dict[r + ',' + c] || null;
}

// Cell types: 0=grass, 1=tallgrass, 2=wall, 3=arene, 4=ligue, 5=centre, 6=water, 7=path, 8=tree, 9=flower
//             10=passage_r2 (porte sur la carte R1 menant en R2), 11=passage_r1 (porte sur R2 menant en R1)
//             12=dojo (R2 uniquement)
//             13=panneau (lore court, déclenche à l'approche), 14=pnj (dialogue plus long)

// Place les éléments de lore (panneaux + PNJ) sur une grille déjà construite.
// Stratégie pour chaque entrée :
//   - sign (panneau) : case herbe (0) ou fleur (9) adjacente à un chemin (7) dans la zone cible
//   - pnj : case chemin (7) à une distance manhattan ≤ 2 d'une case de la zone cible
// La case est convertie en tile 13 (sign) ou 14 (pnj). L'entrée est mémorisée
// dans `loreDict` par sa position "row,col".
function pmPlaceLore(grid, zones, W, H, loreList, loreDict) {
  // Index : pour chaque case zone, mémoriser sa zone pour faire un BFS local rapide.
  // Mais pour 6 zones × ~250 cases on peut faire simple.

  for (const entry of loreList) {
    const candidates = [];
    for (let r = 1; r < H - 1; r++) {
      for (let c = 1; c < W - 1; c++) {
        const tile = grid[r][c];

        if (entry.kind === 'sign') {
          // Panneau : dans la zone, sur herbe (0) ou fleur (9), idéalement près d'un chemin
          const inZone = zones[r][c] === entry.zone;
          if (!inZone) continue;
          if (tile !== 0 && tile !== 9) continue;
          const nearPath =
            (grid[r-1] && grid[r-1][c] === 7) ||
            (grid[r+1] && grid[r+1][c] === 7) ||
            (grid[r][c-1] === 7) ||
            (grid[r][c+1] === 7);
          candidates.push({ r, c, score: nearPath ? 10 : 1 });
        } else if (entry.kind === 'pnj') {
          // PNJ : sur chemin (7), à distance manhattan ≤ 4 d'une case de la zone
          if (tile !== 7) continue;
          let minDist = 999;
          for (let dr = -4; dr <= 4; dr++) {
            for (let dc = -4; dc <= 4; dc++) {
              const rr = r + dr, cc = c + dc;
              if (rr < 0 || rr >= H || cc < 0 || cc >= W) continue;
              if (zones[rr][cc] === entry.zone) {
                const dist = Math.abs(dr) + Math.abs(dc);
                if (dist < minDist) minDist = dist;
              }
            }
          }
          if (minDist > 4) continue;
          // Plus c'est proche, plus c'est prioritaire
          candidates.push({ r, c, score: 10 - minDist });
        }
      }
    }

    if (candidates.length === 0) continue;
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.filter(x => x.score === candidates[0].score);
    const pick = top[Math.floor(Math.random() * top.length)];

    grid[pick.r][pick.c] = entry.kind === 'sign' ? 13 : 14;
    loreDict[pick.r + ',' + pick.c] = entry;
  }
}

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

  // ── Passage vers la Région 2 (Terres de PomStud) ──
  // Placé sur le bord est, au milieu vertical (au bout du chemin horizontal central).
  // Une "route" de chemin part du chemin central (cy) jusqu'au bord est (W-2).
  for (let c = cx + 8; c < W - 1; c++) {
    if (grid[cy][c] === 0 || grid[cy][c] === 8 || grid[cy][c] === 9) grid[cy][c] = 7;
    if (grid[cy+1][c] === 0 || grid[cy+1][c] === 8 || grid[cy+1][c] === 9) grid[cy+1][c] = 7;
  }
  // Case passage : juste avant le bord
  grid[cy][W-2] = 10;
  grid[cy+1][W-2] = 10;
  zones[cy][W-2] = null;
  zones[cy+1][W-2] = null;

  // Placement du lore (panneaux + PNJ)
  _pmLoreR1 = {};
  pmPlaceLore(grid, zones, W, H, PM_LORE_R1, _pmLoreR1);

  _pmMapGrid = grid;
  _pmMapZoneGrid = zones;
}

function pmGetZoneAt(r, c) {
  const M = pmGetActiveMapData();
  if (!M.zones || r < 0 || c < 0 || r >= M.H || c >= M.W) return null;
  return M.zones[r][c];
}

// ── Rencontre par zone ──
// Filtre le pool de candidats selon la carte courante :
// - En R1 : exclut les natifs R2 (region:2) ET les évolutions (isEvolution:true)
// - En R2 : exclut les natifs R1 (pas de region:2) et toujours les évolutions
function pmFilterCandidatesForMap(candidates, mapId) {
  return candidates.filter(id => {
    const p = PM_DEX[id];
    if (p.isEvolution) return false; // Q8 : évolutions jamais sauvages
    if (mapId === 'r1') return !p.region || p.region !== 2;
    if (mapId === 'r2') return p.region === 2;
    return true;
  });
}

function pmGenerateZoneEncounter(zoneId) {
  const zone = PM_ZONES[zoneId];
  if (!zone) return pmGenerateWildEncounter();
  const type = zone.types[Math.floor(Math.random() * zone.types.length)];
  const allOfType = PM_DEX_IDS.filter(id => PM_DEX[id].type === type);
  const candidates = pmFilterCandidatesForMap(allOfType, 'r1');
  if (candidates.length === 0) return pmGenerateWildEncounter();
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
  // Plafond niveau région 1 (les zones R2 utilisent pmGenerateR2ZoneEncounter)
  const wildLvl = Math.max(1, Math.min(PM_R1_WILD_LEVEL_CAP, avgLvl + (Math.floor(Math.random() * 3) - 1)));
  return pmCreatePokePomInstance(chosen, wildLvl);
}

// ───────────────────────────────────────────────────────────────────────
// RÉGION 2 — Builder de la carte
// ───────────────────────────────────────────────────────────────────────
// Layout : carte 70×48 avec
//   - 6 zones d'herbes hautes (3 en haut, 3 en bas)
//   - Routes en croix : 2 horizontales, 2 verticales
//   - Dojo central (3×3)
//   - Centre PokePom (3×3) au sud du dojo
//   - Passage R1 sur le bord ouest (au milieu)
function pmBuildMapR2() {
  const W = PM_MAP_R2_W, H = PM_MAP_R2_H;
  const grid = [], zones = [];
  for (let r = 0; r < H; r++) {
    grid[r] = []; zones[r] = [];
    for (let c = 0; c < W; c++) { grid[r][c] = 0; zones[r][c] = null; }
  }

  // Bordures = arbres
  for (let c = 0; c < W; c++) { grid[0][c] = 8; grid[H-1][c] = 8; }
  for (let r = 0; r < H; r++) { grid[r][0] = 8; grid[r][W-1] = 8; }

  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2);

  // Routes horizontales (2 niveaux) : nord et sud du centre, séparant les 6 zones
  const upperRoadR = Math.floor(H / 3);     // ~16
  const lowerRoadR = Math.floor(2 * H / 3); // ~32
  for (let c = 3; c < W - 3; c++) {
    grid[upperRoadR][c] = 7; grid[upperRoadR + 1][c] = 7;
    grid[lowerRoadR][c] = 7; grid[lowerRoadR + 1][c] = 7;
  }

  // Routes verticales : 2 axes (1/3 et 2/3 de la largeur)
  const leftRoadC = Math.floor(W / 3);   // ~23
  const rightRoadC = Math.floor(2 * W / 3); // ~46
  for (let r = 3; r < H - 3; r++) {
    grid[r][leftRoadC] = 7; grid[r][leftRoadC + 1] = 7;
    grid[r][rightRoadC] = 7; grid[r][rightRoadC + 1] = 7;
  }

  // Dojo central (3×3) au centre exact
  for (let dr = 0; dr <= 2; dr++) for (let dc = 0; dc <= 2; dc++) {
    grid[cy - 1 + dr][cx - 1 + dc] = 2;
  }
  grid[cy + 1][cx] = 12; // porte Dojo
  // Dégager autour du dojo
  for (let dc = -3; dc <= 3; dc++) {
    if (grid[cy + 2][cx + dc] === 0) grid[cy + 2][cx + dc] = 7;
  }

  // Centre PokePom au sud du Dojo
  const centerR = cy + 5;
  for (let dr = 0; dr <= 2; dr++) for (let dc = 0; dc <= 2; dc++) {
    grid[centerR + dr][cx - 1 + dc] = 2;
  }
  grid[centerR + 2][cx] = 5; // porte centre PokePom

  // Passage retour R1 : sur le bord ouest, niveau du milieu vertical
  // Une "route" part du leftRoadC vers le bord ouest
  for (let c = 1; c < leftRoadC; c++) {
    if (grid[cy][c] === 0 || grid[cy][c] === 8 || grid[cy][c] === 9) grid[cy][c] = 7;
    if (grid[cy + 1][c] === 0 || grid[cy + 1][c] === 8 || grid[cy + 1][c] === 9) grid[cy + 1][c] = 7;
  }
  grid[cy][1] = 11;
  grid[cy + 1][1] = 11;

  // Définir les 6 zones (3 en haut, 3 en bas)
  // Coordonnées calibrées pour rester entre les routes et bordures
  const zoneDefs = [
    // Rangée Nord (au-dessus de upperRoadR)
    { id: 'bois_aelmoria',   startR: 2, startC: 2,                rows: upperRoadR - 3, cols: leftRoadC - 3 },
    { id: 'glaciers_vorh',   startR: 2, startC: leftRoadC + 3,    rows: upperRoadR - 3, cols: rightRoadC - leftRoadC - 4 },
    { id: 'hauteurs_solenne',startR: 2, startC: rightRoadC + 3,   rows: upperRoadR - 3, cols: W - rightRoadC - 5 },
    // Rangée Sud (sous lowerRoadR)
    { id: 'cendrelande',     startR: lowerRoadR + 3, startC: 2,                rows: H - lowerRoadR - 5, cols: leftRoadC - 3 },
    { id: 'mines_orichal',   startR: lowerRoadR + 3, startC: leftRoadC + 3,    rows: H - lowerRoadR - 5, cols: rightRoadC - leftRoadC - 4 },
    { id: 'marais_oblivion', startR: lowerRoadR + 3, startC: rightRoadC + 3,   rows: H - lowerRoadR - 5, cols: W - rightRoadC - 5 },
  ];

  for (const z of zoneDefs) {
    for (let r = z.startR; r < z.startR + z.rows && r < H - 1; r++) {
      for (let c = z.startC; c < z.startC + z.cols && c < W - 1; c++) {
        if (grid[r][c] !== 0) continue;
        const rnd = Math.random();
        if (rnd < 0.55) grid[r][c] = 1;       // herbe haute
        else if (rnd < 0.78) grid[r][c] = 0;  // herbe courte
        else if (rnd < 0.86) grid[r][c] = 6;  // eau
        else if (rnd < 0.92) grid[r][c] = 9;  // fleur
        else grid[r][c] = 8;                   // arbre
        zones[r][c] = z.id;
      }
    }
  }

  // Décor sur les chemins / hors zones : quelques arbres + fleurs épars
  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      if (grid[r][c] === 0 && !zones[r][c]) {
        const rnd = Math.random();
        if (rnd < 0.04) grid[r][c] = 8;
        else if (rnd < 0.07) grid[r][c] = 9;
      }
    }
  }

  // Placement du lore R2 (panneaux + PNJ)
  _pmLoreR2 = {};
  pmPlaceLore(grid, zones, W, H, PM_LORE_R2, _pmLoreR2);

  _pmMapR2Grid = grid;
  _pmMapR2ZoneGrid = zones;
}

// Rencontre dans une zone R2 — plancher niveau 6
function pmGenerateR2ZoneEncounter(zoneId) {
  const zone = PM_R2_ZONES[zoneId];
  if (!zone) return pmGenerateWildEncounter();

  // On essaie chaque type de la zone dans un ordre aléatoire jusqu'à en trouver
  // un qui a au moins un candidat R2. Évite de fallback sur des types hors-zone
  // si un type de la zone n'a pas (encore) de natif R2.
  const shuffled = [...zone.types].sort(() => Math.random() - 0.5);
  let candidates = [];
  let pickedType = null;
  for (const t of shuffled) {
    const allOfType = PM_DEX_IDS.filter(id => PM_DEX[id].type === t);
    const filtered = pmFilterCandidatesForMap(allOfType, 'r2');
    if (filtered.length > 0) { candidates = filtered; pickedType = t; break; }
  }
  if (candidates.length === 0) {
    // Aucun type de la zone n'a de natif R2 → fallback global (ne devrait pas arriver
    // si zoneDefs cohérent, mais on protège).
    const allR2 = PM_DEX_IDS.filter(id => PM_DEX[id].region === 2 && !PM_DEX[id].isEvolution);
    if (allR2.length === 0) return pmGenerateWildEncounter();
    const pick = allR2[Math.floor(Math.random() * allR2.length)];
    return pmCreatePokePomInstance(pick, PM_R2_WILD_LEVEL_MIN);
  }

  const legends = candidates.filter(id => PM_DEX[id].legendary);
  let chosen;
  if (legends.length > 0 && Math.random() < zone.legendRate) {
    chosen = legends[Math.floor(Math.random() * legends.length)];
  } else {
    const nonLegends = candidates.filter(id => !PM_DEX[id].legendary);
    chosen = nonLegends[Math.floor(Math.random() * nonLegends.length)] || candidates[0];
  }
  // Niveau : moyenne équipe ±2, plafonné à PM_LEVEL_MAX, plancher PM_R2_WILD_LEVEL_MIN
  const player = pmGetPlayer();
  const team = pmGetTeam(player);
  const avgLvl = team.length > 0 ? Math.floor(team.reduce((s,p) => s+p.level, 0) / team.length) : PM_R2_WILD_LEVEL_MIN;
  const wildLvl = Math.max(PM_R2_WILD_LEVEL_MIN, Math.min(PM_LEVEL_MAX, avgLvl + (Math.floor(Math.random() * 5) - 2)));
  return pmCreatePokePomInstance(chosen, wildLvl);
}

// Helpers carte courante : retourne grille / zoneGrid / dimensions actives
function pmGetActiveMapData() {
  if (_pmCurrentMap === 'r2') {
    if (!_pmMapR2Grid) pmBuildMapR2();
    return {
      grid: _pmMapR2Grid,
      zones: _pmMapR2ZoneGrid,
      W: PM_MAP_R2_W,
      H: PM_MAP_R2_H,
      mapId: 'r2',
      zoneDefs: PM_R2_ZONES,
      encounter: pmGenerateR2ZoneEncounter
    };
  }
  if (!_pmMapGrid) pmBuildMap();
  return {
    grid: _pmMapGrid,
    zones: _pmMapZoneGrid,
    W: PM_MAP_FULL_W,
    H: PM_MAP_FULL_H,
    mapId: 'r1',
    zoneDefs: PM_ZONES,
    encounter: pmGenerateZoneEncounter
  };
}

// ── Rendu GBA ──
function pmRenderMap() {
  const canvas = _pmMapCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const T = PM_TILE;
  const viewCols = Math.ceil(canvas.width / T) + 1;
  const viewRows = Math.ceil(canvas.height / T) + 1;

  // Map active (R1 ou R2)
  const M = pmGetActiveMapData();

  _pmMapViewX = Math.max(0, Math.min(M.W - viewCols + 1, _pmMapPlayer.c - Math.floor(viewCols / 2)));
  _pmMapViewY = Math.max(0, Math.min(M.H - viewRows + 1, _pmMapPlayer.r - Math.floor(viewRows / 2)));

  ctx.imageSmoothingEnabled = false;

  for (let vr = 0; vr < viewRows; vr++) {
    for (let vc = 0; vc < viewCols; vc++) {
      const mr = vr + _pmMapViewY, mc = vc + _pmMapViewX;
      if (mr < 0 || mr >= M.H || mc < 0 || mc >= M.W) continue;
      const cell = M.grid[mr][mc];
      const zone = M.zones[mr][mc];
      const px = vc * T, py = vr * T;
      const seed = (mr * 97 + mc * 31) % 17;
      const zDef = zone ? M.zoneDefs[zone] : null;

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
      } else if (cell === 10) {
        // Passage vers Région 2 (porte/portail spécial)
        ctx.fillStyle = GBA.path;
        ctx.fillRect(px, py, T, T);
        // Cadre du portail (pierre violette)
        ctx.fillStyle = '#5a3a8a';
        ctx.fillRect(px + 1, py, T - 2, T);
        ctx.fillStyle = '#7a5aaa';
        ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
        // Centre lumineux animé (pulse)
        const pulse = Math.abs(Math.sin(Date.now() / 400));
        ctx.fillStyle = `rgba(255, 240, 200, ${0.6 + pulse * 0.4})`;
        ctx.fillRect(px + 4, py + 4, T - 8, T - 8);
        // Symbole flèche vers la droite (vers R2)
        ctx.fillStyle = '#3a1a5a';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('▶', px + 8, py + 12);
        ctx.textAlign = 'left';
      } else if (cell === 11) {
        // Retour vers Région 1
        ctx.fillStyle = GBA.path;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#3a5a8a';
        ctx.fillRect(px + 1, py, T - 2, T);
        ctx.fillStyle = '#5a7aaa';
        ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
        const pulse = Math.abs(Math.sin(Date.now() / 400));
        ctx.fillStyle = `rgba(220, 240, 255, ${0.6 + pulse * 0.4})`;
        ctx.fillRect(px + 4, py + 4, T - 8, T - 8);
        ctx.fillStyle = '#1a3a5a';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('◀', px + 8, py + 12);
        ctx.textAlign = 'left';
      } else if (cell === 12) {
        // Porte du Dojo
        ctx.fillStyle = GBA.path;
        ctx.fillRect(px, py, T, T);
        // Toit traditionnel rouge
        ctx.fillStyle = '#a82828';
        ctx.fillRect(px + 2, py, T - 4, T - 2);
        ctx.fillStyle = '#c84848';
        ctx.fillRect(px + 1, py + 2, T - 2, 2);
        // Porte
        ctx.fillStyle = '#5a3018';
        ctx.fillRect(px + 5, py + 5, 6, 8);
        // Symbole "道" (Dojo) — rendu en cercle pour le pixel
        ctx.fillStyle = '#f8e060';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('道', px + 8, py + 12);
        ctx.textAlign = 'left';
      } else if (cell === 13) {
        // Panneau de lore (en bois, sur fond herbe)
        // Fond : herbe (continue de la zone si visible)
        const zone = M.zones[mr][mc];
        const zDef = zone ? M.zoneDefs[zone] : null;
        ctx.fillStyle = zDef ? zDef.ground : GBA.grass;
        ctx.fillRect(px, py, T, T);
        // Poteau du panneau
        ctx.fillStyle = '#5a3018';
        ctx.fillRect(px + 7, py + 8, 2, 7);
        // Plaque de bois
        ctx.fillStyle = '#a87038';
        ctx.fillRect(px + 2, py + 2, T - 4, 8);
        ctx.fillStyle = '#c8884a';
        ctx.fillRect(px + 3, py + 3, T - 6, 6);
        // Texte "i" pour info
        ctx.fillStyle = '#3a1a08';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('i', px + 8, py + 9);
        ctx.textAlign = 'left';
      } else if (cell === 14) {
        // PNJ : sur chemin, petit personnage
        ctx.fillStyle = GBA.path;
        ctx.fillRect(px, py, T, T);
        // Tête (peau)
        ctx.fillStyle = '#f0c890';
        ctx.fillRect(px + 5, py + 2, 6, 5);
        // Cheveux
        ctx.fillStyle = '#5a3018';
        ctx.fillRect(px + 5, py + 1, 6, 3);
        // Yeux
        ctx.fillStyle = '#1a1a22';
        ctx.fillRect(px + 6, py + 4, 1, 1);
        ctx.fillRect(px + 9, py + 4, 1, 1);
        // Corps (vêtement, varie par seed)
        const seed = (mr * 13 + mc * 7) % 3;
        const shirts = ['#3878c8', '#c8487a', '#48a848']; // bleu, rose, vert
        ctx.fillStyle = shirts[seed];
        ctx.fillRect(px + 4, py + 7, 8, 6);
        // Jambes
        ctx.fillStyle = '#3a3a48';
        ctx.fillRect(px + 5, py + 13, 2, 3);
        ctx.fillRect(px + 9, py + 13, 2, 3);
        // Marqueur "!" en surbrillance pour signaler dialogue (subtile)
        const pulse = Math.abs(Math.sin(Date.now() / 600));
        ctx.fillStyle = `rgba(255, 240, 100, ${0.4 + pulse * 0.4})`;
        ctx.fillRect(px + 12, py - 1, 3, 5);
      }

      // Building roofs (row above doors)
      if (mr > 0) {
        const above = M.grid[mr - 1] ? M.grid[mr - 1][mc] : -1;
        if (cell === 2 && mr >= 2) {
          // Check if this is the top row of a building
          const below = mr + 1 < M.H ? M.grid[mr + 1][mc] : -1;
          if (below === 3 || below === 4 || below === 5 || below === 12) {
            // Roof row
            const roofColor = below === 3 ? GBA.roofGym
                            : below === 4 ? GBA.roofLigue
                            : below === 12 ? '#a82828'
                            : GBA.roofCentre;
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
  const M2 = pmGetActiveMapData();
  const currentZone = pmGetZoneAt(_pmMapPlayer.r, _pmMapPlayer.c);
  const currentCell = M2.grid[_pmMapPlayer.r][_pmMapPlayer.c];
  let label = '';
  const zDef2 = currentZone ? M2.zoneDefs[currentZone] : null;
  if (zDef2) label = zDef2.label;
  else if (currentCell === 3) label = '🏆 Arène';
  else if (currentCell === 4) label = '⭐ Ligue PokePom';
  else if (currentCell === 5) label = '🏥 Centre PokePom';
  else if (currentCell === 10) label = '🚪 Passage vers Région 2';
  else if (currentCell === 11) label = '🚪 Retour vers Région 1';
  else if (currentCell === 12) label = '🥋 Dojo';
  else if (M2.mapId === 'r2') label = 'Terres de PomStud';
  const labelEl = document.getElementById('pm-map-zone-label');
  if (labelEl) labelEl.textContent = label || 'Pomel World';

  const hudEl = document.getElementById('pm-map-hud');
  if (hudEl) hudEl.textContent = '';
}

// ── Mouvement & interactions ──
function pmMapTryMove(dr, dc) {
  const now = Date.now();
  if (now - _pmMapLastStep < PM_STEP_COOLDOWN) return;
  _pmMapLastStep = now;
  const M = pmGetActiveMapData();
  const nr = _pmMapPlayer.r + dr, nc = _pmMapPlayer.c + dc;
  if (nr < 0 || nr >= M.H || nc < 0 || nc >= M.W) return;
  const cell = M.grid[nr][nc];

  if (cell === 3) { pmStopMap(); pmGoTo('gym'); return; }
  if (cell === 4) { pmStopMap(); pmGoTo('league'); return; }
  if (cell === 5) { pmStopMap(); _pmShowCentreMenu(); return; }
  if (cell === 12) { pmStopMap(); pmGoTo('dojo'); return; }
  if (cell === 10) { pmStopMap(); pmTryEnterR2(); return; }
  if (cell === 11) { pmStopMap(); pmReturnToR1(); return; }
  if (cell === 14) {
    // PNJ : bloque le passage mais déclenche le dialogue
    const lore = pmGetLoreAt(nr, nc);
    if (lore) pmShowLoreDialog(lore);
    return;
  }
  if (cell === 2 || cell === 6 || cell === 8) return; // mur, eau, arbre

  _pmMapPlayer.r = nr;
  _pmMapPlayer.c = nc;

  if (cell === 13) {
    // Panneau : on marche dessus, déclenche le dialogue
    const lore = pmGetLoreAt(nr, nc);
    if (lore) {
      pmRenderMap(); // pour que la position du joueur soit à jour avant overlay
      pmShowLoreDialog(lore);
      return;
    }
  }

  if (cell === 1) {
    const zone = pmGetZoneAt(nr, nc);
    if (zone && Math.random() < PM_ENCOUNTER_CHANCE) {
      _pmPendingZoneEncounter = zone;
      pmStopMap();
      pmGoTo('wild');
      return;
    }
  }

  pmRenderMap();
}

// ── Transitions de carte R1 ↔ R2 ──
// Vérifie le déblocage R2 (7 badges R1) et fait basculer la carte courante.
// Si non débloqué, affiche un modal explicatif.
function pmTryEnterR2() {
  const player = pmGetPlayer();
  const badgeCount = (player.badges || []).length;
  if (badgeCount < PM_R2_UNLOCK_BADGES) {
    pmShowR2LockedModal(badgeCount);
    return;
  }
  // Déblocage : transition vers R2
  _pmCurrentMap = 'r2';
  player.currentMap = 'r2';
  if (!_pmMapR2Grid) pmBuildMapR2();
  // Position de spawn en R2 : juste à droite du passage retour, milieu vertical
  _pmMapPlayer = { r: Math.floor(PM_MAP_R2_H / 2), c: 3 };
  pmSaveNow();
  pmGoTo('home'); // recharge l'écran map
}

function pmReturnToR1() {
  const player = pmGetPlayer();
  _pmCurrentMap = 'r1';
  player.currentMap = 'r1';
  if (!_pmMapGrid) pmBuildMap();
  // Position de spawn en R1 : juste à gauche du passage R2 (bord est)
  _pmMapPlayer = { r: Math.floor(PM_MAP_FULL_H / 2), c: PM_MAP_FULL_W - 4 };
  pmSaveNow();
  pmGoTo('home');
}

function pmShowR2LockedModal(currentBadges) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Space Mono', monospace;
  `;
  overlay.innerHTML = `
    <div style="background: #2a2238; border: 2px solid #7a5aaa; border-radius: 12px; padding: 24px; max-width: 360px; color: #fff;">
      <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 12px; text-align: center;">
        🚪 Le passage est scellé
      </div>
      <div style="font-size: .95rem; line-height: 1.5; margin-bottom: 16px;">
        Au-delà s'étendent les <strong>Terres de PomStud</strong>, une région ancienne où
        sommeillent des PokePoms inconnus. Mais le portail ne s'ouvrira qu'à un Dresseur
        ayant prouvé sa valeur dans toute la région actuelle.
      </div>
      <div style="font-size: .95rem; margin-bottom: 16px; text-align: center;">
        <strong>Badges nécessaires : ${PM_R2_UNLOCK_BADGES}/${PM_R2_UNLOCK_BADGES}</strong><br>
        Tu en as actuellement : <strong>${currentBadges}</strong>
      </div>
      <button id="pm-r2-locked-close" style="width: 100%; padding: 10px; background: #7a5aaa; color: #fff; border: none; border-radius: 8px; font-family: inherit; font-size: 1rem; font-weight: bold; cursor: pointer;">D'accord</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('pm-r2-locked-close').addEventListener('click', () => {
    overlay.remove();
    // Relancer la map (pmStopMap a été appelée avant le modal)
    if (typeof pmStartMap === 'function') pmStartMap();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DIALOGUE LORE — Boîte style GBA en bas d'écran
// ═══════════════════════════════════════════════════════════════════════════
// Affiche une bulle de dialogue avec :
//   - Pour un panneau (kind:'sign')  : un seul écran de texte
//   - Pour un PNJ (kind:'pnj')      : pages multiples (entry.pages),
//     avec label PNJ ("Vieil Apprenti") + indicateur "▼ Continuer"
// L'overlay capture les clics et les touches Espace/Entrée pour avancer.
let _pmLoreCurrentPage = 0;
let _pmLoreCurrentEntry = null;

function pmShowLoreDialog(entry) {
  if (!entry) return;
  _pmLoreCurrentEntry = entry;
  _pmLoreCurrentPage = 0;

  // Construire l'overlay si pas déjà présent
  let overlay = document.getElementById('pm-lore-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'pm-lore-overlay';
  overlay.style.cssText = `
    position: fixed; left: 0; right: 0; bottom: 0;
    z-index: 8500;
    display: flex; align-items: flex-end; justify-content: center;
    padding: 16px;
    pointer-events: auto;
  `;
  // Box GBA-style
  const box = document.createElement('div');
  box.id = 'pm-lore-box';
  box.style.cssText = `
    background: linear-gradient(180deg, #f8f4d8 0%, #e8d8a8 100%);
    border: 4px solid #5a3018;
    border-radius: 8px;
    box-shadow: 0 -4px 16px rgba(0,0,0,0.5), inset 0 0 0 2px #f8e4b8;
    max-width: 640px;
    width: 100%;
    padding: 16px 18px 14px;
    font-family: 'Space Mono', monospace;
    color: #3a1a08;
    cursor: pointer;
    user-select: none;
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  pmRenderLorePage();

  // Click-to-advance + clavier
  const advance = () => pmAdvanceLore();
  overlay.addEventListener('click', advance);
  const keyHandler = (e) => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      advance();
    }
  };
  // On stocke le handler pour pouvoir le retirer
  overlay._keyHandler = keyHandler;
  document.addEventListener('keydown', keyHandler);
}

function pmRenderLorePage() {
  const box = document.getElementById('pm-lore-box');
  const entry = _pmLoreCurrentEntry;
  if (!box || !entry) return;

  let title = '';
  let body = '';
  let hasMore = false;

  if (entry.kind === 'sign') {
    title = '📜 Panneau';
    body = entry.text || '';
    hasMore = false;
  } else if (entry.kind === 'pnj') {
    title = entry.pnjLabel || 'Voyageur';
    const pages = entry.pages || [entry.text || ''];
    body = pages[_pmLoreCurrentPage] || '';
    hasMore = _pmLoreCurrentPage < pages.length - 1;
  }

  const indicator = hasMore ? '▼ Continuer' : '✓ Fermer';

  box.innerHTML = `
    <div style="font-size:.78rem; font-weight:bold; color:#7a3018; margin-bottom:6px; letter-spacing:.04em;">
      ${title}
    </div>
    <div style="font-size:.95rem; line-height:1.55; min-height:3em;">
      ${body.replace(/\n/g, '<br>')}
    </div>
    <div style="font-size:.72rem; text-align:right; color:#7a4828; margin-top:6px;">
      ${indicator}
    </div>
  `;
}

function pmAdvanceLore() {
  const entry = _pmLoreCurrentEntry;
  if (!entry) { pmCloseLoreDialog(); return; }

  if (entry.kind === 'pnj' && Array.isArray(entry.pages)) {
    if (_pmLoreCurrentPage < entry.pages.length - 1) {
      _pmLoreCurrentPage++;
      pmRenderLorePage();
      return;
    }
  }
  pmCloseLoreDialog();
}

function pmCloseLoreDialog() {
  const overlay = document.getElementById('pm-lore-overlay');
  if (overlay) {
    if (overlay._keyHandler) {
      document.removeEventListener('keydown', overlay._keyHandler);
    }
    overlay.remove();
  }
  _pmLoreCurrentEntry = null;
  _pmLoreCurrentPage = 0;
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
          <button class="btn-primary" onclick="pmGoTo('collection')" style="background:var(--yellow); color:#000;">📚 PomeDex (${player.collection.length}/${PM_DEX_IDS.length})</button>
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
  if (d && _pmMapPlayer) { e.preventDefault(); pmMapTryMove(d[0], d[1]); }
}

function pmMapDpadMove(dr, dc) { if (_pmMapPlayer) pmMapTryMove(dr, dc); }

function pmStartMap() {
  // Restaure la carte courante depuis le player si présente
  const player = pmGetPlayer();
  if (player && player.currentMap === 'r2') {
    _pmCurrentMap = 'r2';
  } else {
    _pmCurrentMap = 'r1';
  }
  // Force la construction de la map active
  pmGetActiveMapData();
  if (!_pmMapPlayer) {
    if (_pmCurrentMap === 'r2') {
      _pmMapPlayer = { r: Math.floor(PM_MAP_R2_H / 2), c: 3 };
    } else {
      _pmMapPlayer = { r: Math.floor(PM_MAP_FULL_H / 2) + 2, c: Math.floor(PM_MAP_FULL_W / 2) };
    }
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
          <div class="pm-sub">PomeDex ${player.collection.length}/${PM_DEX_IDS.length} · ${badgeCount}/${PM_GYMS.length} badges${(player.badgesR2 && player.badgesR2.length) ? ` · R2 ${player.badgesR2.length}/${PM_GYMS_R2.length}` : ''}</div>
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

      <!-- Gros bouton PvP en bandeau (avec pastille "à toi de jouer" si applicable) -->
      <div id="pm-home-pvp-btn" onclick="pmGoTo('pvp')" style="position:relative; margin-top:8px; padding:10px 14px; background:linear-gradient(90deg, #a83838 0%, #c83838 50%, #a83838 100%); color:#fff; cursor:pointer; font-weight:800; border-radius:8px; text-align:center; font-size:.95rem; letter-spacing:.04em; box-shadow:0 2px 6px rgba(168,56,56,0.3); transition:all .2s; display:flex; align-items:center; justify-content:center; gap:8px;" onmouseenter="this.style.filter='brightness(1.1)'; this.style.transform='translateY(-1px)';" onmouseleave="this.style.filter=''; this.style.transform='';">
        <span style="font-size:1.2rem;">⚔️</span>
        <span>Affronter d'autres dresseurs</span>
        <span style="font-size:1.2rem;">⚔️</span>
        <span id="pm-home-pvp-badge" style="display:none; position:absolute; top:-6px; right:-6px; background:var(--yellow); color:#000; font-size:.65rem; font-weight:900; padding:2px 7px; border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.4); animation:pmPulse 1.5s ease-in-out infinite;">À TOI !</span>
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
      @keyframes pmPulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.12); } }
    `;
    document.head.appendChild(s);
  }

  // Vérification asynchrone : si c'est mon tour PvP, on affiche la pastille
  // "À TOI !" sur le bouton. Le helper a son propre cache 10s pour éviter
  // de spammer Firebase.
  if (typeof pvpCheckMyTurn === 'function') {
    pvpCheckMyTurn().then(turn => {
      const badge = document.getElementById('pm-home-pvp-badge');
      if (badge) badge.style.display = turn ? 'block' : 'none';
    }).catch(() => {});
  }

  _pmMapCanvas = document.getElementById('pm-map-canvas');

  if (_pmMapNeedsResume) {
    // Restaurer la carte courante depuis player.currentMap
    const player = pmGetPlayer();
    if (player && player.currentMap === 'r2') _pmCurrentMap = 'r2';
    else _pmCurrentMap = 'r1';
    pmGetActiveMapData(); // force build si besoin
    if (!_pmMapPlayer) {
      _pmMapPlayer = _pmCurrentMap === 'r2'
        ? { r: Math.floor(PM_MAP_R2_H / 2), c: 3 }
        : { r: Math.floor(PM_MAP_FULL_H / 2) + 2, c: Math.floor(PM_MAP_FULL_W / 2) };
    }
    // Rendre un seul frame
    pmRenderMap();

    // Overlay par-dessus le canvas
    const wrap = _pmMapCanvas.parentElement;
    if (wrap) {
      const overlay = document.createElement('div');
      overlay.id = 'pm-map-resume-overlay';
      overlay.style.cssText = 'position:absolute;inset:0;background:rgba(13,13,15,0.75);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;backdrop-filter:blur(3px);z-index:5;cursor:pointer;';
      overlay.innerHTML = `
        <div style="font-size:1.4rem;font-weight:800;color:var(--primary);">🐾 PokePom</div>
        <button class="btn-primary" style="padding:12px 36px;">▶ Continuer</button>
      `;
      overlay.onclick = () => {
        overlay.remove();
        _pmMapNeedsResume = false;
        pmStartMap();
      };
      wrap.style.position = 'relative';
      wrap.appendChild(overlay);
    }
  } else {
    pmStartMap();
  }
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
          Choisis bien dans quelle zone tu chasses selon les types que tu veux capturer !
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
          <div><strong>🌿 Combat sauvage</strong> — Affronte un PokePom aléatoire. Tu peux le capturer si tu le bats !</div>
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
    const xpMax = inst.level < PM_LEVEL_MAX ? PM_XP_TABLE[inst.level] : 0;
    const xpPct = inst.level < PM_LEVEL_MAX ? (inst.xp / xpMax) * 100 : 100;
    const stats = pmGetStats(inst);
    // Moveset effectif (custom si appris au Dojo, sinon natifs)
    const effectiveMoves = getMoveset(inst);
    const movesHtml = effectiveMoves.map(m => {
      if (!m) return '';
      return `<div class="pm-coll-move" style="border-left:3px solid ${PM_TYPE_COLOR[m.type] || '#888'};">
        <div class="pm-coll-move-name">${PM_TYPE_EMOJI[m.type] || ''} ${m.name}</div>
        <div class="pm-coll-move-meta">${m.power > 0 ? 'P.' + m.power + ' · ' : ''}${m.accuracy}% · ${m.pp}PP</div>
      </div>`;
    }).join('');
    card.innerHTML = `
      <canvas width="64" height="64" class="pm-sprite pm-sprite-md" id="pm-team-${inst.uid}"></canvas>
      <div class="pm-collection-name">${base.name}${inTeam ? ' ✓' : ''}${base.legendary ? ' ✦' : ''}</div>
      <span class="pm-type-badge" style="background:${PM_TYPE_COLOR[base.type]};">${PM_TYPE_EMOJI[base.type]} ${PM_TYPE_LABEL[base.type]}</span>
      <div class="pm-collection-level">Niv ${inst.level}${inst.level < PM_LEVEL_MAX ? ` · ${inst.xp}/${xpMax} XP` : ' ★ MAX'}</div>
      ${inst.level < PM_LEVEL_MAX ? `<div class="pm-xp-bar" style="width:100%;"><div class="pm-xp-fill" style="width:${xpPct}%"></div></div>` : ''}
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

// ── Écran « PomeDex » : sprite + type + lore, focus encyclopédique ──
function pmRenderCollection(page, player) {
  // Set des PokePoms RENCONTRÉS (capturés + obtenus par évolution depuis).
  // Une fois vu, un PokePom reste au PomeDex pour toujours, même si on n'a plus
  // d'instance vivante de cette forme (cas évolution : la base disparaît du
  // tableau collection mais reste au PomeDex).
  const seenIds = new Set([
    ...(player.dexSeen || []),
    ...player.collection.map(i => i.pokepomId)
  ]);
  // Map id → première instance possédée (pour permettre les actions équipe)
  const firstInstanceById = {};
  player.collection.forEach(i => {
    if (!firstInstanceById[i.pokepomId]) firstInstanceById[i.pokepomId] = i;
  });

  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">📚 PomeDex</div>
          <div class="pm-sub">${seenIds.size}/${PM_DEX_IDS.length} PokePoms découverts · ${player.collection.length} possédés</div>
        </div>
        <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
      </div>
      <div class="pm-card">
        <div class="pm-collection-grid" id="pm-coll-grid"></div>
      </div>
    </div>
  `;

  const grid = document.getElementById('pm-coll-grid');

  // Afficher tous les PokePoms du Dex (vus + non vus)
  Object.values(PM_DEX).forEach(base => {
    const seen = seenIds.has(base.id);
    const inst = firstInstanceById[base.id]; // peut être undefined si forme évolutive perdue
    const owned = !!inst;
    const inTeam = inst ? player.team.includes(inst.uid) : false;
    const card = document.createElement('div');

    if (seen) {
      // Vu — affichage complet (avec ou sans instance)
      card.className = 'pm-collection-card' + (inTeam ? ' in-team' : '') + (owned ? '' : ' pm-coll-evolved-away');
      // Cliquable seulement si on a encore une instance
      if (owned) card.onclick = () => pmToggleTeam(inst.uid);
      const slotId = inst ? inst.uid : 'seen-' + base.id;
      const levelLine = owned
        ? `Niv ${inst.level}${base.legendary ? ' · Légendaire' : ''}`
        : (base.legendary ? 'Légendaire' : 'Vu (évolué)');
      card.innerHTML = `
        <canvas width="64" height="64" class="pm-sprite pm-sprite-md" id="pm-coll-${slotId}"></canvas>
        <div class="pm-collection-name">${base.name}${inTeam ? ' ✓' : ''}${base.legendary ? ' ✦' : ''}</div>
        <span class="pm-type-badge" style="background:${PM_TYPE_COLOR[base.type]};">${PM_TYPE_EMOJI[base.type]} ${PM_TYPE_LABEL[base.type]}</span>
        <div class="pm-collection-level">${levelLine}</div>
        ${base.lore ? `<div class="pm-coll-lore">${base.lore}</div>` : ''}
      `;
      grid.appendChild(card);
      setTimeout(() => drawPokePom(document.getElementById('pm-coll-' + slotId), base.id), 10);
    } else {
      // Non vu : silhouette noire + nom ???
      card.className = 'pm-collection-card pm-coll-unknown';
      card.innerHTML = `
        <canvas width="64" height="64" class="pm-sprite pm-sprite-md" id="pm-coll-unk-${base.id}"></canvas>
        <div class="pm-collection-name">???</div>
        <span class="pm-type-badge" style="background:#555;">? Inconnu</span>
        <div class="pm-collection-level">Non découvert</div>
      `;
      grid.appendChild(card);
      // Dessiner le sprite puis appliquer le filtre silhouette
      setTimeout(() => {
        const canvas = document.getElementById('pm-coll-unk-' + base.id);
        if (!canvas) return;
        drawPokePom(canvas, base.id);
        setTimeout(() => {
          const ctx = canvas.getContext('2d');
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] > 0) { // pixel non transparent
              d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; // tout en noir
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }, 50);
      }, 10);
    }
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

  // L'encounter à utiliser dépend de la map courante (R1 → pmGenerateZoneEncounter, R2 → pmGenerateR2ZoneEncounter)
  const M = pmGetActiveMapData();
  const wild = _pmPendingZoneEncounter
    ? M.encounter(_pmPendingZoneEncounter)
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
  // Liste d'arènes selon la map active
  const gyms = pmGetActiveGyms();
  const badges = pmGetActiveBadges(player);
  const totalGyms = gyms.length;
  const regionLabel = _pmCurrentMap === 'r2' ? ' — Terres de PomStud' : '';

  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">🏆 Arènes${regionLabel}</div>
          <div class="pm-sub">${badges.length}/${totalGyms} badges · ${player.dailyGymWins >= PM_DAILY_GYM_WINS ? '⛔ Reviens demain — 1 arène battue max par jour' : '✅ Tu peux battre 1 arène aujourd\'hui'}</div>
        </div>
        <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
      </div>
      <div class="pm-gym-grid" id="pm-gym-grid"></div>
    </div>
  `;

  const grid = document.getElementById('pm-gym-grid');
  gyms.forEach(gym => {
    const won = badges.includes(gym.id);
    // Récupérer le type via le champion (gym.id peut être 'plante2' qui n'est pas un type valide)
    const championBase = PM_DEX[gym.champion];
    const championType = championBase ? championBase.type : 'neutre';
    const reward = pmGetGymReward(gym);

    const card = document.createElement('div');
    card.className = 'pm-gym-card' + (won ? ' won' : '');
    card.onclick = won ? null : () => pmStartGymBattle(gym);
    card.innerHTML = `
      <div class="pm-sprite-wrap">
        <canvas width="64" height="64" class="pm-sprite pm-sprite-lg" id="pm-gym-${gym.id}"></canvas>
      </div>
      <div class="pm-gym-name">${PM_TYPE_EMOJI[championType] || ''} ${gym.name}</div>
      <div class="pm-gym-champion">${gym.championName}${gym.level ? ` · Niv ${gym.level}` : ''}</div>
      <span class="pm-type-badge" style="background:${PM_TYPE_COLOR[championType] || '#888'}; align-self:flex-start;">${PM_TYPE_LABEL[championType] || ''}</span>
      <div style="font-size:.72rem; color:var(--muted); margin-top:4px;">
        Récompense : ${reward} 🪙 + badge
      </div>
      ${won ? '<div style="color:var(--green); font-weight:700; font-size:.85rem;">✓ Battue</div>' : ''}
    `;
    grid.appendChild(card);
    setTimeout(() => drawPokePom(document.getElementById('pm-gym-' + gym.id), gym.champion), 10);
  });
}

function pmStartGymBattle(gym) {
  const player = pmGetPlayer();
  const badges = pmGetActiveBadges(player);
  if (badges.includes(gym.id)) return;
  if (player.dailyGymWins >= PM_DAILY_GYM_WINS) {
    if (typeof showToast === 'function') showToast('Tu as déjà battu une arène aujourd\'hui ! Reviens demain. 🕐', '⚠️');
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
      <div class="pm-card">
        <h3 style="font-size:.75rem; font-weight:700; color:var(--muted); letter-spacing:.1em; text-transform:uppercase; margin-bottom:12px;">📅 Classement hebdo</h3>
        <div style="font-size:.75rem; color:var(--muted); margin-bottom:10px;">🥇 2 000 🪙 · 🥈 1 500 🪙 · 🥉 1 000 🪙 · autres 500 🪙</div>
        <div id="pm-league-weekly-lb-list"><div style="color:var(--muted); font-size:.85rem;">Chargement…</div></div>
      </div>
    </div>
  `;
  pmRenderLeagueLb();
  pmRenderLeagueWeeklyLb();
  checkPmLeagueWeeklyReset().catch(() => {});
}

// Rendu du leaderboard Ligue (async, chargé après affichage principal, cache 60s)
let _pmLeagueLbCache = null;
let _pmLeagueLbCacheTime = 0;

async function pmRenderLeagueLb() {
  const list = document.getElementById('pm-league-lb-list');
  if (!list) return;
  if (typeof dbGet !== 'function') { list.innerHTML = '<div style="color:var(--muted); font-size:.85rem;">Classement non disponible.</div>'; return; }
  try {
    const now = Date.now();
    let snap;
    if (_pmLeagueLbCache && (now - _pmLeagueLbCacheTime) < 60000) {
      snap = _pmLeagueLbCache;
    } else {
      snap = await dbGet('pommon_league_lb');
      _pmLeagueLbCache = snap;
      _pmLeagueLbCacheTime = now;
    }
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

// ── Leaderboard Ligue HEBDO ──
const PM_LEAGUE_WEEKLY_PRIZES = [2000, 1500, 1000];
const PM_LEAGUE_WEEKLY_CONSOLATION = 500;

function getPmLeagueWeekKey() {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  return mon.getFullYear() + '-' + String(mon.getMonth()+1).padStart(2,'0') + '-' + String(mon.getDate()).padStart(2,'0');
}

async function pmSaveLeagueWeeklyScore(score) {
  if (score <= 0 || typeof dbGet !== 'function' || typeof dbSet !== 'function') return;
  if (!state || !state.code) return;
  const safeCode = state.code.replace(/[.#$[\]/]/g, '_');
  const weekKey = getPmLeagueWeekKey();
  const path = 'pommon_league_weekly_lb/' + safeCode;
  try {
    const existing = await dbGet(path);
    if (!existing || existing.weekKey !== weekKey || score > existing.score) {
      await dbSet(path, { name: state.name, code: state.code, score, weekKey, date: new Date().toISOString() });
    }
  } catch(e) { console.error('[pokepom] saveLeagueWeekly error', e); }
}

async function pmRenderLeagueWeeklyLb() {
  const list = document.getElementById('pm-league-weekly-lb-list');
  if (!list || typeof dbGet !== 'function') return;
  list.innerHTML = '<div style="color:var(--muted); font-size:.85rem;">Chargement…</div>';
  try {
    const snap = await dbGet('pommon_league_weekly_lb');
    if (!snap) { list.innerHTML = '<div style="color:var(--muted); font-size:.85rem;">Aucun score cette semaine.</div>'; return; }
    const currentWeek = getPmLeagueWeekKey();
    const entries = Object.values(snap)
      .filter(e => !e.weekKey || e.weekKey === currentWeek)
      .sort((a, b) => b.score - a.score);
    if (entries.length === 0) { list.innerHTML = '<div style="color:var(--muted); font-size:.85rem;">Aucun score cette semaine.</div>'; return; }
    const medals = ['🥇', '🥈', '🥉'];
    list.innerHTML = '';
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const rank = i + 1;
      const isMe = state && e.code === state.code;
      const safeName = typeof escapeHTML === 'function' ? escapeHTML(e.name) : (e.name || '').replace(/</g,'&lt;');
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 12px; background:var(--surface2); border:1px solid ' + (isMe ? 'var(--primary)' : 'var(--border)') + '; border-radius:8px; margin-bottom:6px;';
      row.innerHTML = `
        <span style="font-weight:700; font-size:.95rem; min-width:30px;">${medals[i] || rank}</span>
        <span style="flex:1; font-weight:600; font-size:.88rem; overflow:hidden; text-overflow:ellipsis;">${safeName}${isMe ? ' <span style="background:var(--primary); color:#fff; padding:1px 8px; border-radius:100px; font-size:.65rem; margin-left:4px;">Moi</span>' : ''}</span>
        <span style="font-family:'Space Mono',monospace; font-weight:700; color:var(--primary); font-size:.9rem;">${e.score} victoires</span>
      `;
      list.appendChild(row);
    }
  } catch(e) {
    console.error('[pokepom] renderLeagueWeeklyLb error', e);
    list.innerHTML = '<div style="color:var(--muted); font-size:.85rem;">Erreur de chargement.</div>';
  }
}

async function checkPmLeagueWeeklyReset() {
  const now = new Date();
  if (now.getDay() !== 1 || now.getHours() < 9) return;
  const prevMon = new Date(now);
  prevMon.setDate(now.getDate() - 7);
  const pDay = prevMon.getDay();
  const pDiff = pDay === 0 ? -6 : 1 - pDay;
  prevMon.setDate(prevMon.getDate() + pDiff);
  const prevWeekKey = prevMon.getFullYear() + '-' + String(prevMon.getMonth()+1).padStart(2,'0') + '-' + String(prevMon.getDate()).padStart(2,'0');
  if (typeof dbGet !== 'function') return;
  const distributed = await dbGet('pommon_league_weekly_distributed/' + prevWeekKey);
  if (distributed) return;
  await dbSet('pommon_league_weekly_distributed/' + prevWeekKey, true);
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  const recheck = await dbGet('pommon_league_weekly_distributed/' + prevWeekKey);
  if (recheck !== true) return;
  const snap = await dbGet('pommon_league_weekly_lb');
  if (!snap) return;
  const entries = Object.values(snap)
    .filter(e => !e.weekKey || e.weekKey === prevWeekKey)
    .sort((a, b) => b.score - a.score);
  if (entries.length === 0) return;
  if (typeof distributeReliably === 'function') {
    await distributeReliably(entries.map((e, i) => ({
      code: e.code, amount: i < 3 ? PM_LEAGUE_WEEKLY_PRIZES[i] : PM_LEAGUE_WEEKLY_CONSOLATION,
      historyEntry: { type: 'pokepom_league', desc: '🐾 Classement hebdo Ligue PokePom — #' + (i+1), amount: i < 3 ? PM_LEAGUE_WEEKLY_PRIZES[i] : PM_LEAGUE_WEEKLY_CONSOLATION, date: new Date().toISOString() }
    })));
  }
  const allKeys = Object.keys(snap);
  for (const key of allKeys) {
    const entry = snap[key];
    if (!entry.weekKey || entry.weekKey === prevWeekKey) {
      await dbDelete('pommon_league_weekly_lb/' + key);
    }
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
// ═══════════════════════════════════════════════════════════════════════════
// DOJO — Interface
// ═══════════════════════════════════════════════════════════════════════════
// État UI : quel PokePom est actuellement sélectionné dans l'écran Dojo.
// Stocké au niveau module pour persister entre les rerenders.
let _pmDojoSelectedUid = null;

function pmRenderDojo(page, player) {
  // Header + intro
  // NOTE : le Dojo utilise un thème "papier" (fond clair, texte sombre) avec des
  // couleurs explicites partout pour rester lisible quel que soit le thème global.
  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">🥋 Dojo</div>
          <div class="pm-sub">Apprends de nouvelles techniques à tes PokePoms (niv ${PM_DOJO_MIN_LEVEL}+)</div>
        </div>
        <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
      </div>

      <div class="pm-card" style="background:#f5edd6; color:#3a1a08; border:2px solid #5a3018;">
        <div style="font-style:italic; color:#7a4828; margin-bottom:12px; font-size:.92rem; line-height:1.5;">
          « Au cœur des Terres de PomStud, ce Dojo enseigne des techniques que les sauvages
          ne connaissent pas. Choisis un disciple, choisis un art. »
        </div>

        <div style="margin-bottom:8px; font-weight:bold; color:#3a1a08;">1. Choisis un PokePom</div>
        <div id="pm-dojo-team" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;"></div>

        <div id="pm-dojo-detail" style="color:#3a1a08;"></div>
      </div>
    </div>
  `;

  const teamEl = document.getElementById('pm-dojo-team');
  const eligibleTeam = (player.team || [])
    .map(uid => player.collection.find(p => p.uid === uid))
    .filter(Boolean);

  if (eligibleTeam.length === 0) {
    teamEl.innerHTML = `<div style="color:#7a4828; font-size:.9rem;">Aucun PokePom dans ton équipe. Reviens après en avoir ajouté un.</div>`;
    return;
  }

  // Si la sélection actuelle n'est plus dans l'équipe, en choisir une nouvelle
  if (!_pmDojoSelectedUid || !eligibleTeam.find(i => i.uid === _pmDojoSelectedUid)) {
    _pmDojoSelectedUid = eligibleTeam[0].uid;
  }

  eligibleTeam.forEach(inst => {
    const base = PM_DEX[inst.pokepomId];
    const isSelected = inst.uid === _pmDojoSelectedUid;
    const tooLow = inst.level < PM_DOJO_MIN_LEVEL;
    const card = document.createElement('div');
    card.style.cssText = `
      flex: 0 0 96px;
      padding: 8px;
      background: ${isSelected ? '#fff4d8' : '#e8d8a8'};
      border: 2px solid ${isSelected ? '#a06028' : '#b89858'};
      border-radius: 10px;
      cursor: ${tooLow ? 'not-allowed' : 'pointer'};
      opacity: ${tooLow ? 0.55 : 1};
      text-align: center;
      transition: background .15s, border-color .15s;
      color: #3a1a08;
    `;
    card.innerHTML = `
      <canvas width="64" height="64" id="pm-dojo-sprite-${inst.uid}" style="image-rendering:pixelated; width:64px; height:64px;"></canvas>
      <div style="font-size:.78rem; font-weight:bold; margin-top:4px; color:#3a1a08;">${inst.nickname || base.name}</div>
      <div style="font-size:.7rem; color:#7a4828;">Niv ${inst.level}</div>
    `;
    if (!tooLow) {
      card.onclick = () => {
        _pmDojoSelectedUid = inst.uid;
        pmRenderDojo(page, pmGetPlayer());
      };
    }
    teamEl.appendChild(card);
    setTimeout(() => {
      const cv = document.getElementById(`pm-dojo-sprite-${inst.uid}`);
      if (cv) drawPokePom(cv, inst.pokepomId);
    }, 0);
  });

  // Détail du PokePom sélectionné
  pmRenderDojoDetail(player);
}

function pmRenderDojoDetail(player) {
  const detail = document.getElementById('pm-dojo-detail');
  if (!detail) return;
  const inst = player.collection.find(i => i.uid === _pmDojoSelectedUid);
  if (!inst) {
    detail.innerHTML = '';
    return;
  }
  if (inst.level < PM_DOJO_MIN_LEVEL) {
    detail.innerHTML = `
      <div style="padding:16px; background:#f8e0d8; border:2px solid #a04040; border-radius:8px; color:#7a2020;">
        Ce PokePom doit atteindre le niveau ${PM_DOJO_MIN_LEVEL} avant d'apprendre au Dojo.
      </div>`;
    return;
  }

  const base = PM_DEX[inst.pokepomId];
  const currentMoves = pmGetInstanceMoveIds(inst);
  const learnable = pmDojoMovesFor(inst.pokepomId).filter(mid => !currentMoves.includes(mid));

  // Section 1 : moves actuels
  let html = `
    <div style="margin-bottom:8px; font-weight:bold; color:#3a1a08;">2. Moves actuels de ${inst.nickname || base.name}</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px;">
  `;
  currentMoves.forEach((mid, idx) => {
    const m = PM_MOVES[mid];
    if (!m) return;
    html += `
      <div style="padding:8px; background:#fbf3da; border:1px solid #c8b07a; border-left:4px solid ${PM_TYPE_COLOR[m.type] || '#888'}; border-radius:4px; color:#3a1a08;">
        <div style="font-weight:bold; font-size:.85rem; color:#3a1a08;">${PM_TYPE_EMOJI[m.type] || ''} ${m.name}</div>
        <div style="font-size:.72rem; color:#7a4828;">${m.power > 0 ? 'Puiss. ' + m.power + ' · ' : ''}${m.accuracy}% · ${m.pp}PP</div>
      </div>
    `;
  });
  html += `</div>`;

  // Section 2 : moves apprenables
  html += `<div style="margin-bottom:8px; font-weight:bold; color:#3a1a08;">3. Moves disponibles au Dojo</div>`;
  if (learnable.length === 0) {
    html += `<div style="padding:12px; color:#7a4828; font-style:italic;">Ce PokePom connaît déjà tous les moves disponibles dans son catalogue.</div>`;
  } else {
    const balance = (typeof state !== 'undefined' && state) ? (state.balance || 0) : 0;
    html += `<div style="display:grid; grid-template-columns:1fr; gap:8px;">`;
    learnable.forEach(mid => {
      const m = PM_MOVES[mid];
      if (!m) return;
      const cost = pmDojoMoveCost(mid);
      const canAfford = balance >= cost;
      const isSignature = m.dojoOnly;
      html += `
        <div style="padding:10px; background:#fbf3da; border:1px solid #c8b07a; border-left:5px solid ${PM_TYPE_COLOR[m.type] || '#888'}; border-radius:6px; display:flex; gap:12px; align-items:center; color:#3a1a08;">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:bold; font-size:.92rem; color:#3a1a08;">
              ${PM_TYPE_EMOJI[m.type] || ''} ${m.name}
              ${isSignature ? '<span style="font-size:.7rem; color:#a87000; margin-left:6px;">★ Signature</span>' : ''}
            </div>
            <div style="font-size:.78rem; color:#7a4828; margin-top:2px;">
              ${m.power > 0 ? 'Puiss. ' + m.power + ' · ' : ''}${m.accuracy}% · ${m.pp}PP
            </div>
            <div style="font-size:.78rem; margin-top:4px; line-height:1.3; color:#3a1a08;">${m.desc || ''}</div>
          </div>
          <div style="flex:0 0 auto; text-align:right;">
            <div style="font-weight:bold; color:${canAfford ? '#a06000' : '#a08068'}; margin-bottom:4px;">
              ${cost} 🪙
            </div>
            <button
              ${canAfford ? '' : 'disabled'}
              onclick="pmDojoStartLearning('${inst.uid}', '${mid}')"
              style="padding:6px 12px; background:${canAfford ? '#7a4828' : '#aaa'}; color:#fff; border:none; border-radius:6px; font-family:inherit; font-size:.8rem; font-weight:bold; cursor:${canAfford ? 'pointer' : 'not-allowed'};">
              Apprendre
            </button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    html += `<div style="margin-top:12px; font-size:.82rem; color:#7a4828; text-align:right;">Solde : <strong style="color:#a06000;">${balance} 🪙 Pomels</strong></div>`;
  }

  detail.innerHTML = html;
}

// Lance le flow d'apprentissage : popup pour choisir le move à remplacer
function pmDojoStartLearning(instanceUid, newMoveId) {
  const player = pmGetPlayer();
  const inst = player.collection.find(i => i.uid === instanceUid);
  if (!inst) return;
  const newMove = PM_MOVES[newMoveId];
  if (!newMove) return;
  const cost = pmDojoMoveCost(newMoveId);
  const balance = (typeof state !== 'undefined' && state) ? (state.balance || 0) : 0;
  if (balance < cost) {
    alert(`Tu as besoin de ${cost} 🪙 Pomels (tu en as ${balance}).`);
    return;
  }

  const currentMoves = pmGetInstanceMoveIds(inst);

  // Popup de remplacement
  const overlay = document.createElement('div');
  overlay.id = 'pm-dojo-replace-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(0,0,0,0.85);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Space Mono', monospace;
    padding: 16px;
  `;

  let movesHtml = '';
  currentMoves.forEach((mid, idx) => {
    const m = PM_MOVES[mid];
    if (!m) return;
    movesHtml += `
      <button class="pm-replace-slot" data-slot="${idx}"
        style="text-align:left; padding:10px 12px; background:#fbf3da; border:2px solid #c8b07a; border-left:5px solid ${PM_TYPE_COLOR[m.type] || '#888'}; border-radius:6px; cursor:pointer; color:#3a1a08; font-family:inherit; transition:background .15s, border-color .15s;">
        <div style="font-weight:bold; font-size:.92rem; color:#3a1a08;">
          ${PM_TYPE_EMOJI[m.type] || ''} ${m.name}
        </div>
        <div style="font-size:.74rem; color:#7a4828;">
          ${m.power > 0 ? 'Puiss. ' + m.power + ' · ' : ''}${m.accuracy}% · ${m.pp}PP
        </div>
      </button>
    `;
  });

  overlay.innerHTML = `
    <div style="background:#f5edd6; border:3px solid #5a3018; border-radius:12px; padding:20px; max-width:480px; width:100%; color:#3a1a08; box-shadow:0 8px 24px rgba(0,0,0,0.4);">
      <div style="font-size:1.1rem; font-weight:bold; margin-bottom:8px; color:#3a1a08;">
        Apprendre <span style="color:#a06000;">${newMove.name}</span> ?
      </div>
      <div style="font-size:.85rem; color:#7a4828; margin-bottom:14px;">
        Quel move ${inst.nickname || PM_DEX[inst.pokepomId].name} doit-il oublier ?
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        ${movesHtml}
      </div>
      <div style="display:flex; gap:8px; margin-top:16px;">
        <button id="pm-dojo-cancel" style="flex:1; padding:10px; background:#a08068; color:#fff; border:none; border-radius:8px; font-family:inherit; font-weight:bold; cursor:pointer;">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Handlers
  document.getElementById('pm-dojo-cancel').onclick = () => overlay.remove();
  overlay.querySelectorAll('.pm-replace-slot').forEach(btn => {
    btn.onmouseenter = () => { btn.style.borderColor = '#a06028'; btn.style.background = '#fff4d8'; };
    btn.onmouseleave = () => { btn.style.borderColor = '#c8b07a'; btn.style.background = '#fbf3da'; };
    btn.onclick = () => {
      const slot = parseInt(btn.dataset.slot, 10);
      pmDojoConfirmLearn(instanceUid, newMoveId, slot, overlay);
    };
  });
}

// Effectue l'apprentissage : débite Pomels + mute customMoves
function pmDojoConfirmLearn(instanceUid, newMoveId, slotIdx, overlay) {
  const player = pmGetPlayer();
  const cost = pmDojoMoveCost(newMoveId);
  const newMove = PM_MOVES[newMoveId];
  const inst = player.collection.find(i => i.uid === instanceUid);
  if (!inst) { overlay.remove(); return; }
  const oldMoveId = pmGetInstanceMoveIds(inst)[slotIdx];
  const oldMove = PM_MOVES[oldMoveId];

  // Débit Pomels (atomique)
  if (typeof addBalanceTransaction === 'function' && typeof state !== 'undefined' && state) {
    addBalanceTransaction(state.code, -cost, {
      type: 'pokepom_dojo',
      desc: `Apprentissage Dojo : ${newMove.name}`,
      amount: -cost,
      date: new Date().toISOString()
    }).then(updated => {
      if (updated && typeof migrateAccount === 'function') {
        state = migrateAccount(updated);
        if (typeof refreshUI === 'function') refreshUI();
      }
      // Apprendre le move
      const result = pmDojoLearnMove(player, instanceUid, newMoveId, slotIdx);
      if (result.ok) {
        pmUpdateInstance(player, inst);
        pmSaveNow();
        overlay.remove();
        // Toast simple
        pmShowDojoSuccess(inst, oldMove, newMove);
      } else {
        alert('Apprentissage échoué : ' + result.reason);
      }
    });
  } else {
    // Fallback sans wallet (mode dev/test)
    if (typeof state !== 'undefined' && state) state.balance = Math.max(0, (state.balance || 0) - cost);
    const result = pmDojoLearnMove(player, instanceUid, newMoveId, slotIdx);
    if (result.ok) {
      pmUpdateInstance(player, inst);
      pmSaveNow();
      overlay.remove();
      pmShowDojoSuccess(inst, oldMove, newMove);
    } else {
      alert('Apprentissage échoué : ' + result.reason);
    }
  }
}

// Toast de succès après apprentissage
function pmShowDojoSuccess(inst, oldMove, newMove) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    z-index: 10000;
    background: #2a4838; color: #fff;
    padding: 14px 20px; border-radius: 8px;
    font-family: 'Space Mono', monospace; font-size: .9rem;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    animation: dojoToast 2.4s ease-in-out;
    border-left: 4px solid #88dd88;
    max-width: 90vw;
  `;
  toast.innerHTML = `
    <div style="font-weight:bold; margin-bottom:4px;">🥋 Apprentissage réussi !</div>
    <div style="font-size:.85rem;">
      ${inst.nickname || PM_DEX[inst.pokepomId].name} a oublié <strong>${oldMove.name}</strong>
      et a appris <strong>${newMove.name}</strong> !
    </div>
  `;
  if (!document.getElementById('pm-dojo-toast-style')) {
    const style = document.createElement('style');
    style.id = 'pm-dojo-toast-style';
    style.textContent = `
      @keyframes dojoToast {
        0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        15% { opacity: 1; transform: translateX(-50%) translateY(0); }
        85% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
  }
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);

  // Re-render le screen Dojo
  pmGoTo('dojo');
}

// ═══════════════════════════════════════════════════════════════════════════
// PvP — Implémentation déplacée à la fin du fichier (réécriture propre)
// ═══════════════════════════════════════════════════════════════════════════

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
          <div class="pm-title">${bs.mode === 'wild' ? '🌿 Combat sauvage' : bs.mode === 'gym' ? '🏆 ' + bs.gym.name : '⭐ Ligue · Round ' + (bs.roundNum || 1)}</div>
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

    // Animation d'évolution : déclenchée à la fin du combat si une évolution
    // s'est produite pendant le gain d'XP. On consomme le flag pour éviter
    // la rejouer si le joueur revient sur l'écran de fin (ex: clic Rejouer).
    if (bs.ended && bs.pendingEvolution && !bs._evoPlayed) {
      bs._evoPlayed = true;
      const { oldId, newId } = bs.pendingEvolution;
      pmShowEvolutionAnimation(oldId, newId).then(() => {
        // Persiste l'instance évoluée (pmGainXP a déjà muté l'objet)
        if (bs.playerInstance) pmUpdateInstance(player, bs.playerInstance);
        // Synchronise le fighter visible pour que le rerender montre la nouvelle forme
        if (bs.playerFighter && bs.playerFighter.pokepomId === oldId) {
          bs.playerFighter.pokepomId = newId;
          const newBase = PM_DEX[newId];
          if (newBase) {
            bs.playerFighter.type = newBase.type;
            // On garde le nom personnalisé éventuel, sinon nouveau nom de base
            if (!bs.playerInstance || !bs.playerInstance.nickname || bs.playerInstance.nickname === PM_DEX[oldId].name) {
              bs.playerFighter.name = newBase.name;
            }
          }
        }
        pmSaveNow();
        bs.pendingEvolution = null;
        pmGoTo('battle');
      });
    }
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

  const oldFighter = bs.playerFighter;
  const oldName = oldFighter.name;
  const newName = newFighter.name;

  // Le PokePom qui sort perd ses buffs/nerfs et sa brûlure. C'est la règle :
  // les altérations sont liées à la présence sur le terrain. S'il revient plus
  // tard, il revient "neutre".
  pmResetFighterStateOnExit(oldFighter);

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
      const xpRes = pmGainXP(bs.playerInstance || p.instance, PM_XP_GAIN.league);
      if (xpRes.leveledUp) {
        bs.log.push(`⬆️ ${p.name} monte au niveau ${(bs.playerInstance || p.instance).level} !`);
      }
      if (xpRes.evolved) {
        bs.pendingEvolution = { oldId: xpRes.oldId, newId: xpRes.newId };
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
      // Reset stages/brûlure du PokePom KO qui sort du combat
      pmResetFighterStateOnExit(p);
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
      // Leaderboard Ligue (général + hebdo) + flush Firebase
      pmSaveLeagueLb(bs.winsInRun);
      pmSaveLeagueWeeklyScore(bs.winsInRun);
      pmSaveNow();
    }
  } else if (bs.mode === 'wild') {
    if (o.ko) {
      // Victoire sauvage
      player.dailyWildCount++;
      player.totalBattlesWon = (player.totalBattlesWon || 0) + 1;
      const xpRes = pmGainXP(bs.playerInstance, PM_XP_GAIN.wild);
      if (xpRes.leveledUp) {
        bs.log.push(`⬆️ ${p.name} monte au niveau ${bs.playerInstance.level} !`);
      }
      if (xpRes.evolved) {
        bs.pendingEvolution = { oldId: xpRes.oldId, newId: xpRes.newId };
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
          // Si le PokePom est capturé après le niveau d'évolution et qu'il
          // a une évolution disponible, on pose le flag pendingEvolution
          // pour qu'il évolue à son prochain passage de niveau (cf. spec Q8).
          if (captureInst.level >= PM_EVOLUTION_LEVEL && PM_EVOLUTIONS[captureInst.pokepomId]) {
            captureInst.pendingEvolution = true;
          }
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
      // Victoire arène : R1 stocke dans player.badges, R2 dans player.badgesR2
      const isR2 = bs.gym.region === 2;
      if (isR2) {
        player.badgesR2 = player.badgesR2 || [];
        if (!player.badgesR2.includes(bs.gym.id)) player.badgesR2.push(bs.gym.id);
      } else {
        if (!player.badges.includes(bs.gym.id)) player.badges.push(bs.gym.id);
      }
      player.dailyGymWins++;
      player.totalBattlesWon = (player.totalBattlesWon || 0) + 1;

      const xpRes = pmGainXP(bs.playerInstance, PM_XP_GAIN.gym);
      if (xpRes.leveledUp) {
        bs.log.push(`⬆️ ${p.name} monte au niveau ${bs.playerInstance.level} !`);
      }
      if (xpRes.evolved) {
        bs.pendingEvolution = { oldId: xpRes.oldId, newId: xpRes.newId };
      }
      pmUpdateInstance(player, bs.playerInstance);

      // Sauvegarder toute l'équipe (XP peut toucher d'autres PokePoms plus tard)
      if (bs.teamFighters) {
        bs.teamFighters.forEach((f, i) => {
          if (bs.team && bs.team[i]) pmUpdateInstance(player, bs.team[i]);
        });
      }

      // Récompense Pomels (montant variable selon arène)
      const reward = pmGetGymReward(bs.gym);
      // Label du type via le champion (gym.id peut être 'plante2', invalide pour PM_TYPE_LABEL)
      const championType = (PM_DEX[bs.gym.champion] || {}).type || 'neutre';
      const typeLabel = PM_TYPE_LABEL[championType] || bs.gym.name;

      if (typeof addBalanceTransaction === 'function') {
        addBalanceTransaction(state.code, reward, {
          type: 'pokepom_gym',
          desc: `${bs.gym.name} battue`,
          amount: reward,
          date: new Date().toISOString()
        }).then(updated => {
          if (updated && typeof migrateAccount === 'function') {
            state = migrateAccount(updated);
            if (typeof refreshUI === 'function') refreshUI();
          }
        });
      } else if (typeof state !== 'undefined' && state) {
        state.balance = (state.balance || 0) + reward;
        if (typeof saveAccount === 'function') saveAccount(state);
      }

      bs.log.push(`<strong>🏆 ${bs.gym.name} vaincue ! Badge obtenu + ${reward} 🪙 Pomels !</strong>`);
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
      const reward = pmGetGymReward(bs.gym);
      html += `
        <div class="pm-result-title win">🏆 Arène vaincue !</div>
        <div class="pm-reward">+${reward} 🪙 + Badge ${bs.gym.name}</div>
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

// Flush PomMon data avant de quitter la page
window.addEventListener('beforeunload', () => {
  if (_pmDirty && _pmCache && typeof dbSet === 'function' && state && state.code) {
    try { dbSet(pmPath(), _pmCache); } catch(e) {}
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && _pmDirty) {
    pmSaveNow();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PvP v3 — Architecture "alternated turns"
// ═══════════════════════════════════════════════════════════════════════════
//
// Principe (simple et robuste) :
//   1. Au début de chaque tour, currentPlayer = celui qui a la vitesse la
//      plus élevée (sur son PokePom actif). En cas d'égalité, P1.
//   2. Le currentPlayer joue son action → on l'écrit dans pendingAction et on
//      passe le currentPlayer à l'autre.
//   3. L'autre joueur joue son action → comme il a maintenant LES DEUX actions,
//      il résout le tour entièrement sur SON poste (pmExecuteMove + end-of-turn)
//      et écrit le résultat dans Firebase.
//   4. Les deux clients voient le résultat arriver via onValue. Nouveau tour.
//
// Visuellement c'est fluide (chacun voit "À toi" / "L'adversaire choisit"),
// mais techniquement c'est strictement séquentiel → AUCUNE race condition.
// Pas besoin de RNG seedé, pas de failover, pas de flag "resolving" :
// par construction, à chaque instant un seul client peut écrire.
//
// Cas KO : si ton PokePom actif est KO en début de tour, ton UI affiche
// uniquement la grille de switch (pas de moves). Le switch consomme ton tour
// normalement (le tour continue, l'autre joue ensuite).
//
// Nodes Firebase :
//   pokepom_pvp/{code}              → profil PvP (ELO, currentBattleId, ...)
//   pokepom_battles/{id}            → état du combat
//   pokepom_pvp_distributed/{week}  → flag distribution hebdo

// ─────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────

const PVP_PATH       = 'pokepom_pvp';
const BATTLES_PATH   = 'pokepom_battles';
const DISTRIB_PATH   = 'pokepom_pvp_distributed';
const TURN_TIMEOUT_MS    = PM_PVP_TURN_TIMEOUT_MS;     // 1h par tour
const ELO_START      = PM_ELO_START;

// ─────────────────────────────────────────────────────────────────────
// Helpers ELO (réutilisent les constantes globales du jeu)
// ─────────────────────────────────────────────────────────────────────

function pmEloTier(elo) {
  for (let i = PM_ELO_TIERS.length - 1; i >= 0; i--) {
    if (elo >= PM_ELO_TIERS[i].minElo) return PM_ELO_TIERS[i];
  }
  return PM_ELO_TIERS[0];
}

function pmEloCalc(myElo, oppElo, win) {
  const expected = 1 / (1 + Math.pow(10, (oppElo - myElo) / 400));
  const change = Math.round(PM_ELO_K * ((win ? 1 : 0) - expected));
  return Math.max(0, myElo + change);
}

function pmEloReward(tierId, win) {
  const r = PM_PVP_REWARDS[tierId] || PM_PVP_REWARDS.debutant;
  return win ? r.win : r.loss;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers Firebase (sanitization + écritures sûres)
// ─────────────────────────────────────────────────────────────────────
//
// Firebase Realtime Database rejette undefined/NaN. On nettoie systématiquement
// avant écriture pour éviter les erreurs silencieuses.

function pvpSanitize(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'number' && !isFinite(obj)) return 0;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(pvpSanitize);
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = pvpSanitize(obj[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

async function pvpWrite(path, val) {
  const clean = pvpSanitize(val);
  if (typeof dbSetStrict === 'function') return await dbSetStrict(path, clean);
  // Fallback
  const MAX = 3;
  let lastErr = null;
  for (let i = 0; i < MAX; i++) {
    try { await db.ref(path).set(clean); return; }
    catch (e) { lastErr = e; if (i < MAX-1) await new Promise(r => setTimeout(r, 200 * (i + 1))); }
  }
  throw lastErr || new Error('pvpWrite failed: ' + path);
}

async function pvpUpdate(path, updates) {
  const clean = pvpSanitize(updates);
  const MAX = 3;
  let lastErr = null;
  for (let i = 0; i < MAX; i++) {
    try { await db.ref(path).update(clean); return; }
    catch (e) { lastErr = e; if (i < MAX-1) await new Promise(r => setTimeout(r, 200 * (i + 1))); }
  }
  throw lastErr || new Error('pvpUpdate failed: ' + path);
}

async function pvpRead(path) {
  if (typeof dbGet === 'function') return await dbGet(path);
  const snap = await db.ref(path).once('value');
  return snap.exists() ? snap.val() : null;
}

// ─────────────────────────────────────────────────────────────────────
// Profil PvP
// ─────────────────────────────────────────────────────────────────────

let _pvpProfileCache = null;

function pvpDefaultProfile(code, displayName, avatarId) {
  return {
    code: code,
    displayName: displayName || code,
    avatarId: avatarId || 'avatar_classic',
    elo: ELO_START,
    wins: 0,
    losses: 0,
    abandons: 0,
    currentBattleId: '',
    teamSnapshot: [],
    lastSeen: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
}

function pvpNormalizeProfile(data, code) {
  if (!data) return pvpDefaultProfile(code, code, 'avatar_classic');
  return {
    code: data.code || code,
    displayName: data.displayName || code,
    avatarId: data.avatarId || 'avatar_classic',
    elo: typeof data.elo === 'number' ? data.elo : ELO_START,
    wins: typeof data.wins === 'number' ? data.wins : 0,
    losses: typeof data.losses === 'number' ? data.losses : 0,
    abandons: typeof data.abandons === 'number' ? data.abandons : 0,
    currentBattleId: data.currentBattleId || '',
    teamSnapshot: Array.isArray(data.teamSnapshot) ? data.teamSnapshot : [],
    lastSeen: data.lastSeen || new Date().toISOString(),
    createdAt: data.createdAt || new Date().toISOString()
  };
}

async function pvpLoadProfile() {
  if (!state || !state.code) return null;
  const path = PVP_PATH + '/' + state.code;
  try {
    const data = await pvpRead(path);
    if (data) {
      _pvpProfileCache = pvpNormalizeProfile(data, state.code);
    } else {
      _pvpProfileCache = pvpDefaultProfile(state.code, state.name || state.code,
        (typeof _pmMapAvatar !== 'undefined') ? _pmMapAvatar : 'avatar_classic');
      await pvpWrite(path, _pvpProfileCache);
    }
  } catch (e) {
    console.error('[pvp] loadProfile', e);
    return null;
  }
  return _pvpProfileCache;
}

async function pvpSaveProfile(profile) {
  if (!profile || !profile.code) return;
  _pvpProfileCache = profile;
  try { await pvpWrite(PVP_PATH + '/' + profile.code, profile); }
  catch (e) { console.error('[pvp] saveProfile', e); }
}

async function pvpLoadOtherProfile(code) {
  if (!code) return null;
  try {
    const data = await pvpRead(PVP_PATH + '/' + code);
    return data ? pvpNormalizeProfile(data, code) : null;
  } catch (e) { return null; }
}

function pvpBuildTeamSnapshot(player) {
  return pmGetTeam(player).map(inst => ({
    pokepomId: inst.pokepomId,
    nickname: inst.nickname || PM_DEX[inst.pokepomId].name,
    level: inst.level,
    customMoves: Array.isArray(inst.customMoves) ? inst.customMoves.slice() : []
  }));
}

// ─────────────────────────────────────────────────────────────────────
// Sérialisation des fighters pour Firebase
// ─────────────────────────────────────────────────────────────────────
//
// On stocke les moveIds (pas les objets) car PM_MOVES est global et grand.
// Au moment de jouer un move, le résolveur reconstruit l'objet move via PM_MOVES[id].

function pvpSerializeFighter(fighter) {
  return {
    uid: fighter.uid || '',
    pokepomId: fighter.pokepomId,
    name: fighter.name,
    type: fighter.type,
    level: fighter.level,
    hp: fighter.hp,
    maxHp: fighter.maxHp,
    atk: fighter.atk,
    def: fighter.def,
    vit: fighter.vit,
    baseAtk: fighter.baseAtk,
    baseDef: fighter.baseDef,
    baseVit: fighter.baseVit,
    stages: {
      atk: (fighter.stages && fighter.stages.atk) || 0,
      def: (fighter.stages && fighter.stages.def) || 0,
      vit: (fighter.stages && fighter.stages.vit) || 0
    },
    burnTurns: fighter.burnTurns || 0,
    ko: !!fighter.ko,
    moveIds: fighter.moves.map(m => m.id),
    // PP courants par move (parallèle à moveIds). Au max au début, décrémentés
    // par pmExecuteMove à chaque utilisation. Permet d'afficher les PP restants
    // dans la grille des moves PvP (cohérent avec PvE).
    movePps: fighter.moves.map(m => (typeof m.currentPp === 'number' ? m.currentPp : m.pp))
  };
}

function pvpDeserializeFighter(data) {
  return {
    uid: data.uid || '',
    pokepomId: data.pokepomId,
    name: data.name,
    type: data.type,
    level: data.level,
    hp: data.hp,
    maxHp: data.maxHp,
    atk: data.atk,
    def: data.def,
    vit: data.vit,
    baseAtk: data.baseAtk,
    baseDef: data.baseDef,
    baseVit: data.baseVit,
    stages: {
      atk: (data.stages && data.stages.atk) || 0,
      def: (data.stages && data.stages.def) || 0,
      vit: (data.stages && data.stages.vit) || 0
    },
    burnTurns: data.burnTurns || 0,
    ko: !!data.ko,
    // Clone profond de chaque move pour ne pas muter PM_MOVES global.
    // Les PP courants sont restaurés depuis data.movePps si présent (préserve
    // la consommation entre tours). Fallback m.pp si absent (1er tour).
    moves: (data.moveIds || [])
      .map((id, i) => {
        const base = PM_MOVES[id];
        if (!base) return null;
        const storedPp = (Array.isArray(data.movePps) && typeof data.movePps[i] === 'number')
          ? data.movePps[i]
          : base.pp;
        return { ...base, currentPp: storedPp };
      })
      .filter(Boolean)
  };
}

function pvpBuildTeamFromPlayer(player) {
  return pmGetTeam(player).map(inst => {
    const f = pmCreateFighter(inst, 1.0);
    f.hp = f.maxHp;
    f.burnTurns = 0;
    f.stages = { atk: 0, def: 0, vit: 0 };
    f.ko = false;
    return pvpSerializeFighter(f);
  });
}

function pvpBuildTeamFromSnapshot(snapshot) {
  return snapshot.map(s => {
    const tmpInst = {
      uid: 'opp_' + s.pokepomId + '_' + Math.random().toString(36).slice(2, 7),
      pokepomId: s.pokepomId,
      nickname: s.nickname || (PM_DEX[s.pokepomId] && PM_DEX[s.pokepomId].name) || '?',
      level: s.level || 1,
      xp: 0,
      customMoves: Array.isArray(s.customMoves) && s.customMoves.length === 4 ? s.customMoves : null
    };
    const f = pmCreateFighter(tmpInst, 1.0);
    f.hp = f.maxHp;
    f.burnTurns = 0;
    f.stages = { atk: 0, def: 0, vit: 0 };
    f.ko = false;
    return pvpSerializeFighter(f);
  });
}

// ─────────────────────────────────────────────────────────────────────
// Liste des adversaires
// ─────────────────────────────────────────────────────────────────────

let _pvpListCache = null;
let _pvpListCacheTime = 0;

async function pvpLoadList() {
  try {
    const [accountsSnap, pommonSnap, pvpSnap] = await Promise.all([
      pvpRead('accounts'),
      pvpRead('pommon'),
      pvpRead(PVP_PATH)
    ]);
    if (!accountsSnap) return [];
    const list = Object.values(accountsSnap)
      .filter(a => a && a.code && a.code !== state.code)
      .map(a => {
        const pvp = pvpSnap && pvpSnap[a.code] ? pvpSnap[a.code] : null;
        const pommon = pommonSnap && pommonSnap[a.code] ? pommonSnap[a.code] : null;
        let teamSnapshot = [];
        if (pvp && Array.isArray(pvp.teamSnapshot) && pvp.teamSnapshot.length > 0) {
          teamSnapshot = pvp.teamSnapshot;
        } else if (pommon && Array.isArray(pommon.team) && Array.isArray(pommon.collection)) {
          teamSnapshot = pommon.team
            .map(uid => pommon.collection.find(i => i && i.uid === uid))
            .filter(Boolean)
            .map(inst => ({
              pokepomId: inst.pokepomId,
              nickname: inst.nickname || (PM_DEX[inst.pokepomId] && PM_DEX[inst.pokepomId].name) || '?',
              level: inst.level || 1,
              customMoves: Array.isArray(inst.customMoves) ? inst.customMoves : null
            }));
        }
        return {
          code: a.code,
          displayName: a.name || a.code,
          avatarId: (pvp && pvp.avatarId) || a.avatarId || 'avatar_classic',
          elo: (pvp && typeof pvp.elo === 'number') ? pvp.elo : ELO_START,
          wins: (pvp && pvp.wins) || 0,
          losses: (pvp && pvp.losses) || 0,
          currentBattleId: (pvp && pvp.currentBattleId) || '',
          hasPokepom: !!pommon,
          hasTeam: teamSnapshot.length > 0,
          teamSnapshot: teamSnapshot
        };
      })
      .sort((a, b) => a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()));
    return list;
  } catch (e) {
    console.error('[pvp] loadList', e);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// Listener temps réel
// ─────────────────────────────────────────────────────────────────────

let _pvpListenerRef = null;
let _pvpListenerCb = null;
let _pvpCurrentBattle = null;  // copie locale de l'état Firebase, mise à jour par le listener
let _pvpLastCreatedBattleId = null;
let _pvpRewardClaimed = {};    // battleId → true (anti-double versement Pomels)
let _pvpEndApplied = {};       // battleId → true (anti-double application ELO)

function pvpDetachListener() {
  if (_pvpListenerRef && _pvpListenerCb) {
    try { _pvpListenerRef.off('value', _pvpListenerCb); } catch(e) {}
  }
  _pvpListenerRef = null;
  _pvpListenerCb = null;
}

function pvpAttachListener(battleId, onUpdate) {
  pvpDetachListener();
  _pvpListenerRef = db.ref(BATTLES_PATH + '/' + battleId);
  _pvpListenerCb = (snap) => {
    const data = snap.exists() ? snap.val() : null;
    _pvpCurrentBattle = data;
    // Invalide le cache de notif d'accueil : un changement d'état Firebase
    // signifie qu'au prochain refreshUI on doit revérifier "c'est à toi de jouer".
    if (typeof pvpInvalidateTurnCache === 'function') pvpInvalidateTurnCache();
    onUpdate(data);
  };
  _pvpListenerRef.on('value', _pvpListenerCb);
}

// ─────────────────────────────────────────────────────────────────────
// Création d'un combat
// ─────────────────────────────────────────────────────────────────────

let _pvpInitInProgress = false;

async function pvpInitChallenge(opponentCode) {
  if (_pvpInitInProgress) return;
  _pvpInitInProgress = true;
  try {
    const player = pmGetPlayer();
    if (!player) { alert('Profil joueur introuvable.'); return; }

    const team = pmGetTeam(player);
    if (team.length === 0) { alert('Tu dois avoir au moins 1 PokePom dans ton équipe.'); return; }
    if (!opponentCode || opponentCode === state.code) { alert('Adversaire invalide.'); return; }

    const myProfile = await pvpLoadProfile();
    if (!myProfile) { alert('Impossible de charger ton profil PvP.'); return; }
    if (myProfile.currentBattleId) { alert('Tu as déjà un combat en cours.'); return; }

    let oppProfile = await pvpLoadOtherProfile(opponentCode);
    if (!oppProfile) {
      const acc = await pvpRead('accounts/' + opponentCode);
      const pommon = await pvpRead('pommon/' + opponentCode);
      if (!acc) { alert('Adversaire introuvable.'); return; }
      oppProfile = pvpDefaultProfile(opponentCode, acc.name || opponentCode, acc.avatarId);
      if (pommon && Array.isArray(pommon.team) && Array.isArray(pommon.collection)) {
        oppProfile.teamSnapshot = pommon.team
          .map(uid => pommon.collection.find(i => i && i.uid === uid))
          .filter(Boolean)
          .map(inst => ({
            pokepomId: inst.pokepomId,
            nickname: inst.nickname || (PM_DEX[inst.pokepomId] && PM_DEX[inst.pokepomId].name) || '?',
            level: inst.level || 1,
            customMoves: Array.isArray(inst.customMoves) ? inst.customMoves : []
          }));
      }
      try { await pvpWrite(PVP_PATH + '/' + opponentCode, oppProfile); } catch (e) {}
    }
    if (oppProfile.currentBattleId) {
      alert(oppProfile.displayName + ' est déjà en combat.');
      _pvpListCache = null;
      pmGoTo('pvpList');
      return;
    }
    if (!oppProfile.teamSnapshot || oppProfile.teamSnapshot.length === 0) {
      alert(oppProfile.displayName + ' n\'a pas configuré son équipe PvP.');
      return;
    }

    // Build des équipes (full HP)
    const myTeam  = pvpBuildTeamFromPlayer(player);
    const oppTeam = pvpBuildTeamFromSnapshot(oppProfile.teamSnapshot);

    const battleId = 'b_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    const now = Date.now();
    const battle = {
      id: battleId,
      status: 'active',
      createdAt: new Date(now).toISOString(),
      lastUpdate: new Date(now).toISOString(),
      p1: {
        code: state.code,
        displayName: myProfile.displayName,
        avatarId: myProfile.avatarId || 'avatar_classic',
        eloAtStart: myProfile.elo,
        tierAtStart: pmEloTier(myProfile.elo).id
      },
      p2: {
        code: oppProfile.code,
        displayName: oppProfile.displayName,
        avatarId: oppProfile.avatarId || 'avatar_classic',
        eloAtStart: oppProfile.elo,
        tierAtStart: pmEloTier(oppProfile.elo).id
      },
      p1Team: myTeam,
      p2Team: oppTeam,
      p1ActiveIdx: 0,
      p2ActiveIdx: 0,
      turnNumber: 1,
      turnDeadline: new Date(now + TURN_TIMEOUT_MS).toISOString(),
      // Le plus rapide commence
      currentPlayer: '',          // sera fixé ci-dessous
      pendingAction: null,        // action du 1er joueur, en attente de la 2e
      pendingActionBy: '',        // 'p1' ou 'p2'
      log: [
        myProfile.displayName + ' défie ' + oppProfile.displayName + ' !',
        'Tour 1 — démarrage'
      ],
      winner: '',
      endReason: ''
    };
    // P1 (l'initiateur du défi) choisit toujours son action en premier.
    // La vitesse n'est PAS révélée à ce stade : elle ne joue qu'à la résolution,
    // ce qui ajoute de la stratégie (le joueur doit deviner la vitesse adverse
    // en observant qui frappe en premier dans le récap du tour précédent).
    battle.currentPlayer = 'p1';
    battle.log.push(battle.p1.displayName + ' joue en premier (rappel : la vitesse de chacun n\'est révélée qu\'en cours de combat).');

    console.log('[pvp] creating battle', battleId, 'size:', JSON.stringify(battle).length);
    console.log('[pvp] codes :', { myCode: state.code, p1Code: battle.p1.code, p2Code: battle.p2.code, opponentCode });
    await pvpWrite(BATTLES_PATH + '/' + battleId, battle);
    console.log('[pvp] battle saved');

    await Promise.all([
      pvpUpdate(PVP_PATH + '/' + state.code, {
        currentBattleId: battleId,
        lastSeen: new Date().toISOString()
      }),
      pvpUpdate(PVP_PATH + '/' + opponentCode, { currentBattleId: battleId })
    ]);

    if (_pvpProfileCache) _pvpProfileCache.currentBattleId = battleId;
    _pvpLastCreatedBattleId = battleId;
    _pvpListCache = null;
    pmGoTo('pvpBattle');
  } catch (e) {
    console.error('[pvp] initChallenge', e);
    alert('Erreur lors du lancement du combat :\n\n' + (e && e.message || e));
  } finally {
    _pvpInitInProgress = false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Soumission d'une action
// ─────────────────────────────────────────────────────────────────────
//
// L'action arrive dans 1 des 2 états possibles :
//   - Cas 1 : pendingAction == null → c'est le 1er à jouer ce tour.
//             On stocke pendingAction et on passe currentPlayer à l'autre.
//   - Cas 2 : pendingAction != null → c'est le 2nd. On a les 2 actions,
//             on résout localement TOUT le tour et on écrit le résultat.

function pvpIdentifyMe(battle) {
  if (!battle || !state) {
    console.warn('[pvp] identifyMe : battle ou state manquant', { hasBattle: !!battle, hasState: !!state });
    return null;
  }
  if (battle.p1.code === state.code) return 'p1';
  if (battle.p2.code === state.code) return 'p2';
  // Debug : pourquoi on ne reconnaît pas ?
  console.warn('[pvp] identifyMe : mismatch', {
    myCode: state.code,
    p1Code: battle.p1 && battle.p1.code,
    p2Code: battle.p2 && battle.p2.code,
    battleId: battle.id
  });
  return null;
}

let _pvpSubmitting = false; // évite double-soumission par double-clic

async function pvpSubmitMove(moveIdx) {
  if (_pvpSubmitting) return;
  const battle = _pvpCurrentBattle;
  if (!battle || battle.status !== 'active') return;
  const me = pvpIdentifyMe(battle);
  if (!me || me !== battle.currentPlayer) return;

  const myTeam = me === 'p1' ? battle.p1Team : battle.p2Team;
  const myActiveIdx = me === 'p1' ? (battle.p1ActiveIdx||0) : (battle.p2ActiveIdx||0);
  const myActive = myTeam[myActiveIdx];
  if (!myActive || myActive.ko || myActive.hp <= 0) return;
  const moveId = myActive.moveIds && myActive.moveIds[moveIdx];
  if (!moveId) return;

  const action = { type: 'move', moveIdx: moveIdx, by: me };
  _pvpSubmitting = true;
  try {
    await pvpHandleAction(battle, me, action);
  } catch (e) {
    console.error('[pvp] submitMove', e);
    alert('Erreur soumission action : ' + (e && e.message || e));
  } finally {
    _pvpSubmitting = false;
  }
}

async function pvpSubmitSwitch(toIdx) {
  if (_pvpSubmitting) return;
  const battle = _pvpCurrentBattle;
  if (!battle || battle.status !== 'active') return;
  const me = pvpIdentifyMe(battle);
  if (!me || me !== battle.currentPlayer) return;

  const myTeam = me === 'p1' ? battle.p1Team : battle.p2Team;
  const myActiveIdx = me === 'p1' ? (battle.p1ActiveIdx||0) : (battle.p2ActiveIdx||0);
  const target = myTeam[toIdx];
  if (!target || target.ko || target.hp <= 0) return;
  if (toIdx === myActiveIdx) return;

  const action = { type: 'switch', toIdx: toIdx, by: me };
  _pvpSubmitting = true;
  try {
    await pvpHandleAction(battle, me, action);
  } catch (e) {
    console.error('[pvp] submitSwitch', e);
    alert('Erreur soumission action : ' + (e && e.message || e));
  } finally {
    _pvpSubmitting = false;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Cœur de la logique : dispatch d'une action
// ─────────────────────────────────────────────────────────────────────

async function pvpHandleAction(battle, me, action) {
  // Cas 1 : aucune action en attente → on est le 1er à jouer ce tour
  if (!battle.pendingAction) {
    // On stocke notre action, on passe la main à l'autre
    const other = me === 'p1' ? 'p2' : 'p1';
    const otherName = other === 'p1' ? battle.p1.displayName : battle.p2.displayName;
    const myName    = me    === 'p1' ? battle.p1.displayName : battle.p2.displayName;
    const updates = {
      pendingAction: action,
      pendingActionBy: me,
      currentPlayer: other,
      lastUpdate: new Date().toISOString()
    };
    // Log discret : "X a fait son choix, à Y de jouer"
    const log = (battle.log || []).slice();
    log.push(myName + ' a fait son choix.');
    log.push("À " + otherName + " de jouer.");
    updates.log = log;
    await pvpUpdate(BATTLES_PATH + '/' + battle.id, updates);
    return;
  }

  // Cas 2 : il y avait déjà une pendingAction → on a maintenant les 2 actions.
  // On résout TOUT le tour ici, sur notre poste.
  const firstAction  = battle.pendingAction;
  const secondAction = action;
  // L'ordre PvE-style : firstAction d'abord (P1 ou P2 selon qui a joué en 1er),
  // puis secondAction. Mais en PvP avec vitesse, on a déjà ordonné par vitesse en
  // début de tour via currentPlayer, donc firstAction est BIEN celui du joueur le
  // plus rapide.
  const firstBy  = battle.pendingActionBy;
  const secondBy = me;

  await pvpResolveTurn(battle, firstAction, firstBy, secondAction, secondBy);
}

// ─────────────────────────────────────────────────────────────────────
// Résolution complète d'un tour
// ─────────────────────────────────────────────────────────────────────
//
// Réutilise pmExecuteMove + pmApplyEndOfTurnEffects (moteur PvE), donc cohérent
// avec le combat PvE en termes de mécaniques (crits, type effectiveness, status...).

async function pvpResolveTurn(battle, action1, by1, action2, by2) {
  // Deserialize les fighters actifs (clone profond, ne mute pas le snapshot)
  const teamP1 = battle.p1Team.map(f => ({ ...f, stages: { ...(f.stages||{}) } }));
  const teamP2 = battle.p2Team.map(f => ({ ...f, stages: { ...(f.stages||{}) } }));
  let p1Idx = battle.p1ActiveIdx || 0;
  let p2Idx = battle.p2ActiveIdx || 0;

  let p1Active = pvpDeserializeFighter(teamP1[p1Idx]);
  let p2Active = pvpDeserializeFighter(teamP2[p2Idx]);

  const newLogs = [];
  const logEvent = (ev) => {
    if (typeof pmEventToText === 'function') {
      const txt = pmEventToText(ev);
      if (txt) newLogs.push(txt);
    }
  };

  // Helper : applique une action sur les fighters actifs
  // Retourne true si l'action était un switch (donc pas d'attaque)
  const applyAction = (action, by) => {
    if (action.type === 'switch') {
      // Switch : retire le PokePom actif (en resettant ses buffs/brûlure
      // comme en PvE), envoie le nouveau (clone deserialized = état frais)
      if (by === 'p1') {
        pmResetFighterStateOnExit(p1Active);
        teamP1[p1Idx] = pvpSerializeFighter(p1Active);
        const oldName = p1Active.name;
        p1Idx = action.toIdx;
        p1Active = pvpDeserializeFighter(teamP1[p1Idx]);
        newLogs.push(battle.p1.displayName + ' retire ' + oldName + ' et envoie ' + p1Active.name + ' !');
      } else {
        pmResetFighterStateOnExit(p2Active);
        teamP2[p2Idx] = pvpSerializeFighter(p2Active);
        const oldName = p2Active.name;
        p2Idx = action.toIdx;
        p2Active = pvpDeserializeFighter(teamP2[p2Idx]);
        newLogs.push(battle.p2.displayName + ' retire ' + oldName + ' et envoie ' + p2Active.name + ' !');
      }
      return true;
    }
    // type 'move'
    const attacker = by === 'p1' ? p1Active : p2Active;
    const defender = by === 'p1' ? p2Active : p1Active;
    if (attacker.ko || attacker.hp <= 0) return false; // KO depuis l'action de l'autre
    if (defender.ko || defender.hp <= 0) return false; // déjà KO, on n'attaque pas
    let move = attacker.moves[action.moveIdx];
    if (!move) return false;
    // Lutte si plus de PP (comme en PvE). Substitue le move par Lutte si tous
    // les moves de l'attaquant sont à 0 PP, ou si le move spécifique cliqué est à 0.
    if (typeof pmHasNoPP === 'function' && typeof pmGetLutte === 'function') {
      if (pmHasNoPP(attacker) || (typeof move.currentPp === 'number' && move.currentPp <= 0)) {
        move = pmGetLutte();
      }
    }
    const events = pmExecuteMove(attacker, defender, move);
    events.forEach(logEvent);
    return false;
  };

  // 1) Détermine l'ordre de résolution selon les règles complètes :
  //    - Un switch est toujours prioritaire sur un move (comme en Pokémon classique)
  //    - Sinon, un move avec priority:true devance un move normal
  //    - Sinon, le plus rapide attaque en premier (sur sa vit courante, stages compris)
  //    - Égalité de vitesse → tirage au sort 50/50
  //
  //  `currentPlayer` en début de tour est basé sur la vitesse seule (pour décider
  //  qui voit "À toi" en 1er dans l'UI), mais ici à la résolution on connaît
  //  les deux actions et on applique les règles complètes.

  const isSwitch1 = action1.type === 'switch';
  const isSwitch2 = action2.type === 'switch';
  const getMovePriority = (action, fighter) => {
    if (action.type !== 'move') return 0;
    const move = fighter.moves[action.moveIdx];
    return (move && move.priority) ? 1 : 0;
  };
  const prio1 = isSwitch1 ? 6 : getMovePriority(action1, by1 === 'p1' ? p1Active : p2Active);
  const prio2 = isSwitch2 ? 6 : getMovePriority(action2, by2 === 'p1' ? p1Active : p2Active);

  let firstAction = action1, firstBy = by1;
  let secondAction = action2, secondBy = by2;

  if (prio2 > prio1) {
    // action2 passe en premier
    firstAction = action2; firstBy = by2;
    secondAction = action1; secondBy = by1;
  } else if (prio1 === prio2) {
    // Même priorité → vitesse
    const fighter1 = by1 === 'p1' ? p1Active : p2Active;
    const fighter2 = by2 === 'p1' ? p1Active : p2Active;
    if (fighter2.vit > fighter1.vit) {
      firstAction = action2; firstBy = by2;
      secondAction = action1; secondBy = by1;
    } else if (fighter2.vit === fighter1.vit) {
      // Égalité → 50/50 (comme PvE)
      if (Math.random() < 0.5) {
        firstAction = action2; firstBy = by2;
        secondAction = action1; secondBy = by1;
      }
    }
    // sinon fighter1 plus rapide → on garde l'ordre par défaut (action1 first)
  }

  // 2) Application des actions dans l'ordre déterminé
  applyAction(firstAction, firstBy);
  applyAction(secondAction, secondBy);

  // 3) End-of-turn effects (burn etc.) sur les deux actifs courants
  const eot1 = pmApplyEndOfTurnEffects(p1Active);
  eot1.forEach(logEvent);
  const eot2 = pmApplyEndOfTurnEffects(p2Active);
  eot2.forEach(logEvent);

  // Re-serialize les actifs courants dans l'équipe
  teamP1[p1Idx] = pvpSerializeFighter(p1Active);
  teamP2[p2Idx] = pvpSerializeFighter(p2Active);

  // Détection fin de combat
  const p1AllKo = teamP1.every(f => f.ko || f.hp <= 0);
  const p2AllKo = teamP2.every(f => f.ko || f.hp <= 0);
  let status = 'active';
  let winner = '';
  let endReason = '';

  if (p1AllKo && p2AllKo) {
    status = 'completed'; winner = 'p2'; endReason = 'ko';
    newLogs.push('Les deux équipes K.O. — victoire par tirage à ' + battle.p2.displayName + '.');
  } else if (p1AllKo) {
    status = 'completed'; winner = 'p2'; endReason = 'ko';
    newLogs.push('🏆 ' + battle.p2.displayName + ' remporte le combat !');
  } else if (p2AllKo) {
    status = 'completed'; winner = 'p1'; endReason = 'ko';
    newLogs.push('🏆 ' + battle.p1.displayName + ' remporte le combat !');
  }

  // Forced switch : si l'un des actifs courants est KO mais qu'il reste des PokePoms,
  // on bascule sur le 1er non-KO disponible automatiquement (le joueur n'a pas à
  // gérer une UI de switch forcé séparée — c'est plus simple en PvP async).
  // Le PvE laisse choisir, mais en PvP "alterné" ça compliquerait le flow.
  // À chaque sortie de combat (KO ou switch), on reset les stages et la brûlure
  // du PokePom qui sort (règle commune PvE/PvP).
  if (status === 'active') {
    if (teamP1[p1Idx].ko || teamP1[p1Idx].hp <= 0) {
      // Reset direct sur la forme sérialisée (équivalent à pmResetFighterStateOnExit
      // sur un fighter désérialisé, mais évite un round-trip)
      teamP1[p1Idx].stages = { atk: 0, def: 0, vit: 0 };
      teamP1[p1Idx].burnTurns = 0;
      const nextIdx = teamP1.findIndex(f => !f.ko && f.hp > 0);
      if (nextIdx >= 0) {
        p1Idx = nextIdx;
        newLogs.push(battle.p1.displayName + ' envoie ' + teamP1[p1Idx].name + ' !');
      }
    }
    if (teamP2[p2Idx].ko || teamP2[p2Idx].hp <= 0) {
      teamP2[p2Idx].stages = { atk: 0, def: 0, vit: 0 };
      teamP2[p2Idx].burnTurns = 0;
      const nextIdx = teamP2.findIndex(f => !f.ko && f.hp > 0);
      if (nextIdx >= 0) {
        p2Idx = nextIdx;
        newLogs.push(battle.p2.displayName + ' envoie ' + teamP2[p2Idx].name + ' !');
      }
    }
  }

  // Préparer les updates
  const updates = {
    p1Team: teamP1,
    p2Team: teamP2,
    p1ActiveIdx: p1Idx,
    p2ActiveIdx: p2Idx,
    log: (battle.log || []).concat(newLogs),
    lastUpdate: new Date().toISOString(),
    status: status,
    winner: winner,
    endReason: endReason,
    pendingAction: null,
    pendingActionBy: ''
  };

  if (status === 'active') {
    const newTurn = (battle.turnNumber || 1) + 1;
    updates.turnNumber = newTurn;
    updates.turnDeadline = new Date(Date.now() + TURN_TIMEOUT_MS).toISOString();
    // P1 choisit toujours son action en premier, quel que soit la vitesse.
    // La vitesse joue uniquement à la résolution (qui frappe en premier dans
    // le récap), pour préserver la stratégie : le joueur doit deviner la
    // vitesse adverse en observant l'ordre des frappes des tours précédents.
    updates.currentPlayer = 'p1';
    updates.log.push('— Tour ' + newTurn + ' — ' + battle.p1.displayName + ' joue en premier.');
  }

  await pvpUpdate(BATTLES_PATH + '/' + battle.id, updates);

  // Si combat terminé : appliquer ELO et récompenses
  if (status === 'completed') {
    try {
      await pvpApplyBattleEnd({ ...battle, ...updates });
    } catch (e) { console.error('[pvp] applyBattleEnd', e); }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Fin de combat : ELO + Pomels
// ─────────────────────────────────────────────────────────────────────

async function pvpApplyBattleEnd(battle) {
  if (_pvpEndApplied[battle.id]) return;
  _pvpEndApplied[battle.id] = true;

  const p1Won = battle.winner === 'p1';
  const newP1Elo = pmEloCalc(battle.p1.eloAtStart, battle.p2.eloAtStart, p1Won);
  const newP2Elo = pmEloCalc(battle.p2.eloAtStart, battle.p1.eloAtStart, !p1Won);

  // Met à jour les profils Firebase (relectures car les profils peuvent avoir
  // changé entre temps, par ex. autres combats)
  const p1Profile = await pvpLoadOtherProfile(battle.p1.code);
  const p2Profile = await pvpLoadOtherProfile(battle.p2.code);

  if (p1Profile) {
    p1Profile.elo = newP1Elo;
    if (p1Won) p1Profile.wins = (p1Profile.wins || 0) + 1;
    else p1Profile.losses = (p1Profile.losses || 0) + 1;
    if (battle.endReason === 'forfeit' && !p1Won) p1Profile.abandons = (p1Profile.abandons || 0) + 1;
    p1Profile.currentBattleId = '';
    p1Profile.lastSeen = new Date().toISOString();
    await pvpSaveProfile(p1Profile);
  }
  if (p2Profile) {
    p2Profile.elo = newP2Elo;
    if (!p1Won) p2Profile.wins = (p2Profile.wins || 0) + 1;
    else p2Profile.losses = (p2Profile.losses || 0) + 1;
    if (battle.endReason === 'forfeit' && p1Won) p2Profile.abandons = (p2Profile.abandons || 0) + 1;
    p2Profile.currentBattleId = '';
    await pvpSaveProfile(p2Profile);
  }

  // Pomels : le joueur courant se verse SES propres pomels
  await pvpClaimMyReward(battle);
}

async function pvpClaimMyReward(battle) {
  if (!battle || battle.status !== 'completed') return;
  if (_pvpRewardClaimed[battle.id]) return;
  _pvpRewardClaimed[battle.id] = true;

  const me = pvpIdentifyMe(battle);
  if (!me) return;
  const p1Won = battle.winner === 'p1';
  const iWon = (me === 'p1' && p1Won) || (me === 'p2' && !p1Won);
  const myStartTier = me === 'p1' ? battle.p1.tierAtStart : battle.p2.tierAtStart;
  const reward = pmEloReward(myStartTier, iWon);
  if (reward <= 0 || typeof addBalanceTransaction !== 'function') return;
  try {
    const oppName = me === 'p1' ? battle.p2.displayName : battle.p1.displayName;
    const updated = await addBalanceTransaction(state.code, reward, {
      type: 'pokepom_pvp',
      desc: (iWon ? 'Victoire PvP vs ' : 'Défaite PvP vs ') + oppName,
      amount: reward,
      date: new Date().toISOString()
    });
    if (updated && typeof migrateAccount === 'function') {
      state = migrateAccount(updated);
      if (typeof refreshUI === 'function') refreshUI();
    }
  } catch (e) { console.warn('[pvp] claim reward', e); }

  if (_pvpProfileCache && _pvpProfileCache.currentBattleId === battle.id) {
    _pvpProfileCache.currentBattleId = '';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Abandon
// ─────────────────────────────────────────────────────────────────────

async function pvpAbandon() {
  const battle = _pvpCurrentBattle;
  if (!battle || battle.status !== 'active') return;
  if (!confirm('Abandonner = défaite + perte d\'ELO. Confirmer ?')) return;

  const me = pvpIdentifyMe(battle);
  if (!me) return;
  const winner = me === 'p1' ? 'p2' : 'p1';
  const updates = {
    status: 'completed',
    winner: winner,
    endReason: 'forfeit',
    pendingAction: null,
    pendingActionBy: '',
    lastUpdate: new Date().toISOString(),
    log: (battle.log || []).concat([
      (me === 'p1' ? battle.p1.displayName : battle.p2.displayName) + ' abandonne. Victoire à ' +
      (me === 'p1' ? battle.p2.displayName : battle.p1.displayName) + '.'
    ])
  };
  try {
    await pvpUpdate(BATTLES_PATH + '/' + battle.id, updates);
    await pvpApplyBattleEnd({ ...battle, ...updates });
  } catch (e) {
    console.error('[pvp] abandon', e);
    alert('Erreur abandon : ' + (e && e.message || e));
  }
}

async function pvpForceClearAndExit() {
  pvpDetachListener();
  try {
    if (_pvpProfileCache) {
      _pvpProfileCache.currentBattleId = '';
      await pvpSaveProfile(_pvpProfileCache);
    } else if (state && state.code) {
      await pvpUpdate(PVP_PATH + '/' + state.code, { currentBattleId: '' });
    }
  } catch (e) { console.error('[pvp] forceClear', e); }
  _pvpCurrentBattle = null;
  pmGoTo('pvp');
}

// ─────────────────────────────────────────────────────────────────────
// Helper pour les notifications externes (page d'accueil Pomel, menu PokePom)
// ─────────────────────────────────────────────────────────────────────
//
// Retourne null si pas de combat en cours OU si ce n'est pas mon tour.
// Sinon retourne { battleId, oppName, turnNumber } pour afficher la notif.
// Utilisé par renderHomePvp() (index.html) et pmRenderHome (raccourci PokePom).
// Cache 10s pour éviter de spammer Firebase à chaque refreshUI.
let _pvpTurnCheckCache = null;
let _pvpTurnCheckCacheTime = 0;

async function pvpCheckMyTurn() {
  if (!state || !state.code) return null;
  const now = Date.now();
  if (_pvpTurnCheckCache !== undefined && (now - _pvpTurnCheckCacheTime) < 10000) {
    return _pvpTurnCheckCache;
  }
  try {
    const profile = await pvpRead(PVP_PATH + '/' + state.code);
    if (!profile || !profile.currentBattleId) {
      _pvpTurnCheckCache = null;
      _pvpTurnCheckCacheTime = now;
      return null;
    }
    const battle = await pvpRead(BATTLES_PATH + '/' + profile.currentBattleId);
    if (!battle || battle.status !== 'active') {
      _pvpTurnCheckCache = null;
      _pvpTurnCheckCacheTime = now;
      return null;
    }
    const me = battle.p1 && battle.p1.code === state.code ? 'p1'
             : battle.p2 && battle.p2.code === state.code ? 'p2'
             : null;
    if (!me || battle.currentPlayer !== me) {
      _pvpTurnCheckCache = null;
      _pvpTurnCheckCacheTime = now;
      return null;
    }
    const oppName = me === 'p1' ? (battle.p2 && battle.p2.displayName) : (battle.p1 && battle.p1.displayName);
    const result = {
      battleId: battle.id,
      oppName: oppName || 'l\'adversaire',
      turnNumber: battle.turnNumber || 1
    };
    _pvpTurnCheckCache = result;
    _pvpTurnCheckCacheTime = now;
    return result;
  } catch (e) {
    console.warn('[pvp] checkMyTurn', e);
    return null;
  }
}

// Invalide le cache (appeler après une action PvP pour éviter de garder un
// état obsolète à l'écran).
function pvpInvalidateTurnCache() {
  _pvpTurnCheckCache = undefined;
  _pvpTurnCheckCacheTime = 0;
}

window.pvpCheckMyTurn = pvpCheckMyTurn;
window.pvpInvalidateTurnCache = pvpInvalidateTurnCache;

// ─────────────────────────────────────────────────────────────────────
// Leaderboard PvP & distribution hebdomadaire
// ─────────────────────────────────────────────────────────────────────

async function pvpLoadLeaderboard(limit = 50) {
  try {
    const snap = await pvpRead(PVP_PATH);
    if (!snap) return [];
    return Object.values(snap)
      .filter(p => p && p.code && typeof p.elo === 'number')
      .sort((a, b) => b.elo - a.elo)
      .slice(0, limit);
  } catch (e) { return []; }
}

async function pvpCheckWeeklyReset() {
  const now = new Date();
  if (now.getDay() !== 1) return;
  if (now.getHours() < 9) return;
  const prev = new Date(now);
  prev.setDate(now.getDate() - 7);
  const prevDay = prev.getDay();
  const diff = (prevDay === 0 ? -6 : 1 - prevDay);
  const prevMonday = new Date(prev);
  prevMonday.setDate(prev.getDate() + diff);
  prevMonday.setHours(0, 0, 0, 0);
  const prevWeekKey = prevMonday.toISOString().slice(0, 10);
  const distributed = await pvpRead(DISTRIB_PATH + '/' + prevWeekKey);
  if (distributed) return;
  await pvpWrite(DISTRIB_PATH + '/' + prevWeekKey, true);
  const recheck = await pvpRead(DISTRIB_PATH + '/' + prevWeekKey);
  if (!recheck) return;
  const snap = await pvpRead(PVP_PATH);
  if (!snap) return;
  const ranked = Object.values(snap)
    .filter(p => p && p.code && typeof p.elo === 'number' && (p.wins||0) + (p.losses||0) > 0)
    .sort((a, b) => b.elo - a.elo);
  if (typeof addBalanceTransaction === 'function') {
    await Promise.all(ranked.map(async (p, i) => {
      const amount = i < 3 ? PM_PVP_WEEKLY_PRIZES[i] : PM_PVP_WEEKLY_CONSOLATION;
      try {
        await addBalanceTransaction(p.code, amount, {
          type: 'pokepom_pvp',
          desc: '⚔️ Classement hebdo PvP — #' + (i+1),
          amount: amount,
          date: new Date().toISOString()
        });
      } catch (e) {}
    }));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────
// Hub PvP
// ─────────────────────────────────────────────────────────────────────

async function pmRenderPvpHub(page, player) {
  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">⚔️ PvP — Combats classés</div>
          <div class="pm-sub">Défie d'autres dresseurs et grimpe le classement</div>
        </div>
        <button class="btn-outline" onclick="pmGoTo('home')">← Retour</button>
      </div>
      <div class="pm-card" id="pvp-hub-content" style="text-align:center; padding:40px 20px;">
        <div style="color:var(--muted);">Chargement…</div>
      </div>
    </div>
  `;

  const profile = await pvpLoadProfile();
  if (!profile) {
    document.getElementById('pvp-hub-content').innerHTML =
      '<div style="color:var(--red);">Impossible de charger ton profil PvP.</div>';
    return;
  }
  pvpCheckWeeklyReset().catch(() => {});

  const snapshot = pvpBuildTeamSnapshot(player);
  if (snapshot.length > 0) {
    profile.teamSnapshot = snapshot;
    profile.lastSeen = new Date().toISOString();
    await pvpSaveProfile(profile);
  }

  const tier = pmEloTier(profile.elo);
  const total = profile.wins + profile.losses;
  const wr = total > 0 ? Math.round(profile.wins * 100 / total) : 0;
  const tierIdx = PM_ELO_TIERS.findIndex(t => t.id === tier.id);
  const nextTier = tierIdx < PM_ELO_TIERS.length - 1 ? PM_ELO_TIERS[tierIdx + 1] : null;

  let progressHtml = '';
  if (nextTier) {
    const span = nextTier.minElo - tier.minElo;
    const inTier = profile.elo - tier.minElo;
    const pct = Math.min(100, Math.max(0, Math.round(inTier * 100 / span)));
    progressHtml = `
      <div style="margin-top:12px;">
        <div style="display:flex; justify-content:space-between; font-size:.72rem; color:var(--muted); margin-bottom:4px;">
          <span>${tier.label}</span><span>${profile.elo} / ${nextTier.minElo} ELO</span><span>${nextTier.label} ${nextTier.emoji}</span>
        </div>
        <div style="height:8px; background:var(--surface2); border-radius:4px; overflow:hidden;">
          <div style="width:${pct}%; height:100%; background:${tier.color};"></div>
        </div>
      </div>`;
  } else {
    progressHtml = `<div style="margin-top:12px; font-size:.78rem; text-align:center; color:${tier.color}; font-weight:bold;">★ Tier maximal atteint ★</div>`;
  }

  const battleHtml = profile.currentBattleId
    ? `<div style="margin-bottom:12px; padding:12px; background:#a83838; color:#fff; border-radius:8px; text-align:center; cursor:pointer;" onclick="pmGoTo('pvpBattle')">⚔️ <strong>Combat en cours</strong> — clique pour reprendre</div>`
    : '';

  let teamHtml = '';
  if (snapshot.length === 0) {
    teamHtml = `<div style="padding:14px; background:#3a2030; color:#ffaaaa; border-radius:8px; margin-bottom:12px;">⚠️ Aucun PokePom dans ton équipe.</div>`;
  } else {
    teamHtml = `<div style="margin-bottom:8px; font-size:.78rem; color:var(--muted); text-transform:uppercase;">Ton équipe</div>`;
    teamHtml += `<div style="display:flex; gap:8px; justify-content:center; margin-bottom:16px; flex-wrap:wrap;">`;
    snapshot.forEach((s, i) => {
      teamHtml += `<div style="text-align:center; padding:6px;">
        <canvas width="64" height="64" id="pvp-hub-${i}" style="image-rendering:pixelated; width:56px; height:56px;"></canvas>
        <div style="font-size:.7rem; font-weight:bold;">${s.nickname}</div>
        <div style="font-size:.65rem; color:var(--muted);">Niv ${s.level}</div>
      </div>`;
    });
    teamHtml += `</div>`;
  }

  const disabled = snapshot.length === 0 || !!profile.currentBattleId;
  document.getElementById('pvp-hub-content').innerHTML = `
    ${battleHtml}
    <div style="display:flex; align-items:center; gap:14px; margin-bottom:14px;">
      <div style="font-size:3rem;">${tier.emoji}</div>
      <div style="flex:1; text-align:left;">
        <div style="font-size:.72rem; color:var(--muted); text-transform:uppercase;">Ton rang</div>
        <div style="font-size:1.4rem; font-weight:bold; color:${tier.color};">${tier.label}</div>
        <div style="font-size:.85rem; color:var(--muted); font-family:'Space Mono',monospace;">${profile.elo} ELO</div>
      </div>
    </div>
    ${progressHtml}
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:16px; margin-bottom:16px;">
      <div style="text-align:center; padding:10px; background:var(--surface2); border-radius:6px;">
        <div style="font-size:.7rem; color:var(--muted); text-transform:uppercase;">Victoires</div>
        <div style="font-size:1.2rem; font-weight:bold; color:#88dd88;">${profile.wins}</div>
      </div>
      <div style="text-align:center; padding:10px; background:var(--surface2); border-radius:6px;">
        <div style="font-size:.7rem; color:var(--muted); text-transform:uppercase;">Défaites</div>
        <div style="font-size:1.2rem; font-weight:bold; color:#dd8888;">${profile.losses}</div>
      </div>
      <div style="text-align:center; padding:10px; background:var(--surface2); border-radius:6px;">
        <div style="font-size:.7rem; color:var(--muted); text-transform:uppercase;">Win rate</div>
        <div style="font-size:1.2rem; font-weight:bold;">${total > 0 ? wr + '%' : '—'}</div>
      </div>
    </div>
    ${teamHtml}
    <button onclick="pmGoTo('pvpList')" ${disabled ? 'disabled' : ''}
      style="width:100%; padding:14px; background:${disabled ? '#555' : '#a83838'}; color:#fff; border:none; border-radius:8px; font-family:inherit; font-size:1rem; font-weight:bold; cursor:${disabled ? 'not-allowed' : 'pointer'};">
      ⚔️ Voir les joueurs à défier
    </button>
    <div style="margin-top:18px; padding:14px; background:var(--surface2); border:1px solid var(--border); border-radius:10px;">
      <div style="margin-bottom:10px;">
        <div style="font-weight:bold;">🏆 Classement hebdo PvP</div>
        <div style="font-size:.7rem; color:var(--muted);">Récompenses chaque lundi 9h · Top 1 : 2000 🪙 · Top 2 : 1500 🪙 · Top 3 : 1000 🪙 · Autres : 500 🪙</div>
      </div>
      <div id="pvp-lb-list" style="font-size:.85rem;">
        <div style="color:var(--muted); text-align:center; padding:10px;">Chargement…</div>
      </div>
    </div>
    <div style="margin-top:14px; font-size:.74rem; color:var(--muted); text-align:center;">
      Combats au tour par tour · le plus rapide commence · 1h par tour<br>
      Récompense : <strong>${PM_PVP_REWARDS[tier.id].win}</strong> Pomels en victoire, <strong>${PM_PVP_REWARDS[tier.id].loss}</strong> en défaite
    </div>
  `;

  setTimeout(() => {
    snapshot.forEach((s, i) => {
      const cv = document.getElementById('pvp-hub-' + i);
      if (cv) drawPokePom(cv, s.pokepomId);
    });
  }, 0);

  const lb = await pvpLoadLeaderboard(10);
  const lbEl = document.getElementById('pvp-lb-list');
  if (lbEl) {
    if (lb.length === 0) {
      lbEl.innerHTML = '<div style="color:var(--muted); text-align:center;">Aucun joueur classé.</div>';
    } else {
      lbEl.innerHTML = lb.map((p, i) => {
        const t = pmEloTier(p.elo);
        const isMe = p.code === state.code;
        return `<div style="display:flex; gap:8px; padding:6px 8px; ${isMe ? 'background:rgba(168,56,56,0.15);' : ''} border-radius:4px;">
          <div style="font-weight:bold; color:var(--muted); min-width:28px;">#${i+1}</div>
          <div style="flex:1;">${p.displayName || p.code}${isMe ? ' (toi)' : ''}</div>
          <div style="color:${t.color}; font-weight:bold;">${t.emoji} ${p.elo}</div>
        </div>`;
      }).join('');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Liste des adversaires
// ─────────────────────────────────────────────────────────────────────

async function pmRenderPvpList(page, player) {
  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">⚔️ Choisir un adversaire</div>
          <div class="pm-sub">Tous les joueurs Pomel · ordre alphabétique</div>
        </div>
        <button class="btn-outline" onclick="pmGoTo('pvp')">← Retour</button>
      </div>
      <div id="pvp-list-content" class="pm-card">
        <div style="color:var(--muted); text-align:center; padding:20px;">Chargement…</div>
      </div>
    </div>
  `;

  const team = pmGetTeam(player);
  if (team.length === 0) {
    document.getElementById('pvp-list-content').innerHTML =
      `<div style="padding:14px; background:#3a2030; color:#ffaaaa; border-radius:8px;">Tu dois avoir au moins 1 PokePom dans ton équipe.</div>`;
    return;
  }

  const now = Date.now();
  let list;
  if (_pvpListCache && (now - _pvpListCacheTime) < 30000) {
    list = _pvpListCache;
  } else {
    list = await pvpLoadList();
    _pvpListCache = list;
    _pvpListCacheTime = now;
  }

  const content = document.getElementById('pvp-list-content');
  if (!list || list.length === 0) {
    content.innerHTML = `
      <div style="text-align:center; padding:30px;">
        <div style="font-size:2.5rem;">🔍</div>
        <div style="font-weight:bold; margin-top:8px;">Aucun adversaire trouvé</div>
        <button onclick="_pvpListCache = null; pmGoTo('pvpList');" style="margin-top:14px; padding:8px 18px; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:6px; cursor:pointer;">🔄 Rafraîchir</button>
      </div>`;
    return;
  }

  const challengeable = list.filter(p => p.hasTeam && !p.currentBattleId).length;
  let html = `<div style="font-size:.78rem; color:var(--muted); margin-bottom:8px;">${list.length} dresseur(s) · ${challengeable} défiable(s)</div>`;
  html += `<div style="display:flex; flex-direction:column; gap:8px;">`;
  list.forEach(p => {
    const tier = pmEloTier(p.elo);
    const total = p.wins + p.losses;
    const inBattle = !!p.currentBattleId;
    const noPokepom = !p.hasPokepom;
    const noTeam = !p.hasTeam;
    const safeName = (typeof escapeHTML === 'function') ? escapeHTML(p.displayName) : p.displayName.replace(/</g, '&lt;');

    let teamPreview = '';
    if (!noTeam) {
      teamPreview = '<div style="display:flex; gap:2px; margin-top:4px;">';
      p.teamSnapshot.forEach((s, i) => {
        teamPreview += `<canvas width="64" height="64" id="pvp-list-${p.code}-${i}" style="image-rendering:pixelated; width:32px; height:32px;"></canvas>`;
      });
      teamPreview += '</div>';
    } else {
      teamPreview = '<div style="font-size:.68rem; color:#a86040; font-style:italic; margin-top:4px;">' +
        (noPokepom ? "N'a jamais joué au PokePom" : "Pas d'équipe configurée") + '</div>';
    }

    const stats = total > 0
      ? `<div style="font-size:.68rem; color:var(--muted);">${p.wins}V / ${p.losses}D · ${Math.round(p.wins*100/total)}% wr</div>`
      : `<div style="font-size:.68rem; color:var(--muted);">Aucun combat PvP joué</div>`;

    let btn;
    if (inBattle) btn = '<button disabled style="padding:6px 14px; background:#666; color:#aaa; border:none; border-radius:6px; cursor:not-allowed; font-size:.78rem;">En combat</button>';
    else if (noPokepom) btn = '<button disabled style="padding:6px 14px; background:#666; color:#aaa; border:none; border-radius:6px; cursor:not-allowed; font-size:.78rem;">N/A</button>';
    else if (noTeam) btn = '<button disabled style="padding:6px 14px; background:#666; color:#aaa; border:none; border-radius:6px; cursor:not-allowed; font-size:.78rem;">Indisponible</button>';
    else btn = `<button onclick="pvpInitChallenge('${p.code}')" style="padding:8px 14px; background:#a83838; color:#fff; border:none; border-radius:6px; cursor:pointer; font-family:inherit; font-weight:bold; font-size:.82rem;">Défier ⚔</button>`;

    const dimmed = noPokepom || noTeam;
    const tierLine = (total > 0 || !noPokepom)
      ? `<div style="font-size:.72rem; color:${tier.color}; font-weight:bold;">${tier.label} · ${p.elo} ELO</div>`
      : `<div style="font-size:.72rem; color:var(--muted);">Pas encore classé</div>`;

    html += `<div style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--surface2); border:1px solid var(--border); border-left:4px solid ${dimmed ? '#666' : tier.color}; border-radius:8px; ${dimmed ? 'opacity:.65;' : ''}">
      <div style="font-size:1.6rem;">${dimmed ? '👤' : tier.emoji}</div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${safeName}</div>
        ${tierLine}${stats}${teamPreview}
      </div>
      <div>${btn}</div>
    </div>`;
  });
  html += `</div>`;
  html += `<div style="text-align:center; margin-top:14px;"><button onclick="_pvpListCache = null; pmGoTo('pvpList');" style="padding:8px 18px; background:var(--surface); color:var(--text); border:1px solid var(--border); border-radius:6px; cursor:pointer;">🔄 Rafraîchir</button></div>`;
  content.innerHTML = html;

  setTimeout(() => {
    list.forEach(p => {
      if (!Array.isArray(p.teamSnapshot)) return;
      p.teamSnapshot.forEach((s, i) => {
        const cv = document.getElementById(`pvp-list-${p.code}-${i}`);
        if (cv) drawPokePom(cv, s.pokepomId);
      });
    });
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────
// Écran de combat (UI réutilisant les classes PvE)
// ─────────────────────────────────────────────────────────────────────

async function pmRenderPvpBattle(page, player) {
  page.innerHTML = `
    <div class="pm-wrap">
      <div class="pm-header">
        <div>
          <div class="pm-title">⚔️ Combat PvP</div>
          <div class="pm-sub" id="pvp-battle-sub">Chargement…</div>
        </div>
        <button class="btn-outline" onclick="pvpDetachListener(); pmGoTo('pvp');">← Retour</button>
      </div>
      <div id="pvp-battle-content">
        <div class="pm-card" style="text-align:center; padding:20px;">Récupération de l'état…</div>
      </div>
    </div>
  `;

  // Source de vérité pour le battleId
  let battleId = _pvpLastCreatedBattleId;
  _pvpLastCreatedBattleId = null;
  if (!battleId && _pvpProfileCache && _pvpProfileCache.currentBattleId) {
    battleId = _pvpProfileCache.currentBattleId;
  }
  if (!battleId) {
    const profile = await pvpLoadProfile();
    battleId = profile && profile.currentBattleId;
  }
  if (!battleId) {
    document.getElementById('pvp-battle-content').innerHTML = `
      <div class="pm-card" style="text-align:center; padding:30px;">
        <div style="font-size:2.5rem;">🕊️</div>
        <div style="margin-top:8px; font-weight:bold;">Aucun combat en cours.</div>
        <button class="btn-primary" style="margin-top:16px;" onclick="pmGoTo('pvp')">Retour</button>
      </div>`;
    return;
  }

  // Pre-fetch avec retry pour la propagation Firebase
  let initial = await pvpRead(BATTLES_PATH + '/' + battleId);
  for (let attempt = 0; attempt < 3 && !initial; attempt++) {
    await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    initial = await pvpRead(BATTLES_PATH + '/' + battleId);
  }
  if (!initial) {
    document.getElementById('pvp-battle-content').innerHTML = `
      <div class="pm-card" style="text-align:center; padding:20px;">
        <div style="font-weight:bold; margin-bottom:8px;">⚠️ Combat introuvable</div>
        <div style="font-size:.85rem; margin-bottom:12px;">ID : <code>${battleId}</code></div>
        <button class="btn-primary" onclick="pvpForceClearAndExit()">Réinitialiser et retourner</button>
      </div>`;
    return;
  }

  pvpAttachListener(battleId, async (battle) => {
    if (!battle) {
      document.getElementById('pvp-battle-content').innerHTML = `
        <div class="pm-card" style="text-align:center; padding:20px;">
          <div style="font-weight:bold;">⚠️ Combat supprimé.</div>
          <button class="btn-primary" style="margin-top:14px;" onclick="pvpForceClearAndExit()">Retour</button>
        </div>`;
      return;
    }
    // Reset du mode switch UI quand l'état Firebase change (nouveau tour)
    _pvpUiSwitching = false;
    pvpRenderBattleUI(battle);
    if (battle.status === 'completed') {
      await pvpClaimMyReward(battle);
      if (_pvpProfileCache && _pvpProfileCache.currentBattleId === battle.id) {
        _pvpProfileCache.currentBattleId = '';
        try { await pvpUpdate(PVP_PATH + '/' + state.code, { currentBattleId: '' }); } catch(e) {}
      }
    }
  });
}

function pvpRenderBattleUI(battle) {
  const content = document.getElementById('pvp-battle-content');
  const subEl = document.getElementById('pvp-battle-sub');
  if (!content) return;

  const me = pvpIdentifyMe(battle);
  if (!me) {
    content.innerHTML = `
      <div class="pm-card" style="text-align:center; padding:20px;">
        <div style="font-size:2.5rem;">⚠️</div>
        <div style="font-weight:700; margin:8px 0;">Combat orphelin détecté</div>
        <button class="btn-primary" onclick="pvpForceClearAndExit()">Nettoyer et retourner</button>
      </div>`;
    return;
  }
  const myKey  = me;
  const oppKey = me === 'p1' ? 'p2' : 'p1';
  const myInfo  = battle[myKey];
  const oppInfo = battle[oppKey];
  const myTeam  = battle[myKey + 'Team'] || [];
  const oppTeam = battle[oppKey + 'Team'] || [];
  const myActiveIdx  = battle[myKey + 'ActiveIdx']  || 0;
  const oppActiveIdx = battle[oppKey + 'ActiveIdx'] || 0;
  const myActive  = myTeam[myActiveIdx];
  const oppActive = oppTeam[oppActiveIdx];
  const isMyTurn = battle.currentPlayer === myKey;

  // ───── Combat terminé ─────
  if (battle.status === 'completed') {
    pvpDetachListener();
    const iWon = battle.winner === myKey;
    const titleColor = iWon ? 'var(--green)' : 'var(--red)';
    const titleEmoji = iWon ? '🏆' : '💔';
    const titleText  = iWon ? 'Victoire !' : 'Défaite';
    const reasonLabel = battle.endReason === 'forfeit' ? 'par abandon'
      : battle.endReason === 'timeout' ? 'par timeout' : 'par K.O.';
    if (subEl) subEl.textContent = 'Combat terminé';
    content.innerHTML = `
      <div class="pm-card" style="text-align:center; padding:20px;">
        <div style="font-size:3rem; margin-bottom:10px;">${titleEmoji}</div>
        <div style="font-size:1.6rem; font-weight:700; color:${titleColor};">${titleText}</div>
        <div style="font-size:.9rem; color:var(--muted); margin-top:4px;">${reasonLabel}</div>
        <div class="pm-battle-log" style="margin-top:16px; max-height:240px;">
          ${(battle.log||[]).map(l => `<div class="pm-log-line">${l}</div>`).join('')}
        </div>
        <button class="btn-primary" style="margin-top:18px;" onclick="pvpDetachListener(); pmGoTo('pvp');">Retour</button>
      </div>`;
    return;
  }

  // ───── Sous-titre ─────
  let subText = `Tour ${battle.turnNumber}`;
  if (isMyTurn) {
    subText += battle.pendingAction ? " · À toi ! (l'adversaire a déjà joué)" : " · À toi de jouer";
  } else {
    subText += battle.pendingAction ? " · L'adversaire a fini, résolution…" : " · L'adversaire choisit son action…";
  }
  if (subEl) subEl.textContent = subText;

  // ───── Helpers de rendu ─────
  const hpClass = (f) => {
    const pct = f.hp / f.maxHp;
    if (pct > 0.5) return 'ok';
    if (pct > 0.2) return 'mid';
    return 'low';
  };
  const renderStatusBadges = (f) => {
    const badges = [];
    if (f.burnTurns > 0) badges.push('<span class="pm-battle-status-badge" style="background:rgba(235,88,70,0.2); color:var(--red);">🔥 Brûlure ' + f.burnTurns + 'T</span>');
    ['atk','def','vit'].forEach(stat => {
      const v = (f.stages && f.stages[stat]) || 0;
      if (v !== 0) {
        const sign = v > 0 ? '+' : '';
        const color = v > 0 ? 'var(--green)' : 'var(--red)';
        badges.push(`<span class="pm-battle-status-badge" style="color:${color};">${stat.toUpperCase()} ${sign}${v}</span>`);
      }
    });
    return `<div class="pm-battle-status">${badges.join('')}</div>`;
  };
  const renderTeamBar = (team, activeIdx, side, clickable) => {
    let h = `<div style="display:flex; gap:6px; justify-content:center; margin-top:6px; flex-wrap:wrap;">`;
    team.forEach((f, i) => {
      const isActive = i === activeIdx;
      const isKo = f.ko || f.hp <= 0;
      const borderColor = isKo ? 'var(--red)' : isActive ? 'var(--primary)' : 'var(--border)';
      const opacity = isKo ? 0.4 : 1;
      const click = clickable && !isKo && !isActive ? `onclick="pvpSubmitSwitch(${i})"` : '';
      const cursor = (clickable && !isKo && !isActive) ? 'pointer' : 'default';
      const hpPct = Math.max(0, Math.min(100, (f.hp / f.maxHp) * 100));
      const hpColor = hpPct > 50 ? 'var(--green)' : hpPct > 20 ? 'var(--yellow)' : 'var(--red)';
      h += `<div ${click} title="${f.name}${isKo ? ' (K.O.)' : ''}"
        style="position:relative; padding:3px; opacity:${opacity}; cursor:${cursor}; display:flex; flex-direction:column; align-items:center; gap:2px; min-width:42px;">
        <canvas width="64" height="64" id="pvp-mini-${side}-${i}" class="pm-sprite"
          style="width:36px; height:36px; border:2px solid ${borderColor}; border-radius:6px; background:var(--surface2);"></canvas>
        <div style="width:36px; height:3px; background:var(--surface2); border-radius:2px; overflow:hidden;">
          <div style="width:${hpPct}%; height:100%; background:${hpColor};"></div>
        </div>
      </div>`;
    });
    h += `</div>`;
    return h;
  };
  const renderSide = (info, fighter, team, activeIdx, side, isMe) => {
    if (!fighter) return `<div class="pm-battle-side"><div style="color:var(--muted);">Aucun PokePom actif</div></div>`;
    const hpPct = Math.max(0, Math.min(100, (fighter.hp / fighter.maxHp) * 100));
    return `
      <div class="pm-battle-side ${fighter.ko ? '' : 'active'}">
        <div style="font-size:.7rem; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; font-weight:700; text-align:center;">${info.displayName}${isMe ? ' (toi)' : ''}</div>
        <canvas width="64" height="64" class="pm-sprite pm-sprite-lg" id="pvp-active-${side}"></canvas>
        <div class="pm-battle-info">
          <div class="pm-battle-name">${fighter.name}</div>
          <div class="pm-battle-level">Niv ${fighter.level} · ${PM_TYPE_EMOJI[fighter.type]||''} ${PM_TYPE_LABEL[fighter.type]||''}</div>
          <div class="pm-hp-bar"><div class="pm-hp-fill ${hpClass(fighter)}" style="width:${hpPct}%"></div></div>
          <div class="pm-battle-hp-text">${fighter.hp} / ${fighter.maxHp} HP</div>
          ${renderStatusBadges(fighter)}
        </div>
        ${renderTeamBar(team, activeIdx, side, false)}
      </div>`;
  };

  // ───── Panneau d'action ─────
  let actionHtml = '';
  if (!isMyTurn) {
    actionHtml = `
      <div class="pm-card" style="text-align:center; padding:18px;">
        <div style="font-size:1.4rem;">⏳</div>
        <div style="font-weight:700; margin-top:6px;">L'adversaire choisit son action…</div>
        <div style="font-size:.78rem; color:var(--muted); margin-top:6px;">
          ${battle.pendingAction
            ? '<strong>' + (battle.pendingActionBy === 'p1' ? battle.p1.displayName : battle.p2.displayName) + '</strong> a joué en premier — résolution dès que tu joueras.'
            : 'Patience, l\'autre joueur réfléchit.'}
        </div>
      </div>`;
  } else if (myActive && (myActive.ko || myActive.hp <= 0)) {
    // KO : on n'arrive ici normalement pas (auto-switch dans résolution),
    // mais safety net : grille de switch.
    const available = myTeam.filter((f, i) => i !== myActiveIdx && !(f.ko || f.hp <= 0)).length;
    if (available === 0) {
      actionHtml = `<div class="pm-card" style="text-align:center; color:var(--red); font-weight:700;">Tous tes PokePoms sont K.O. !</div>`;
    } else {
      actionHtml = `<div style="margin-bottom:10px; text-align:center; color:var(--yellow); font-weight:700;">${myActive.name} est K.O. ! Choisis un remplaçant :</div>`;
      actionHtml += `<div class="pm-switch-grid">`;
      myTeam.forEach((f, i) => {
        const isActive = i === myActiveIdx;
        const isKo = f.ko || f.hp <= 0;
        const disabled = (isActive || isKo) ? 'disabled' : '';
        const hpPct = Math.max(0, Math.min(100, (f.hp / f.maxHp) * 100));
        const hpColor = hpPct > 50 ? 'var(--green)' : hpPct > 20 ? 'var(--yellow)' : 'var(--red)';
        const stateLabel = isKo ? ' <span style="color:var(--red); font-weight:700;">K.O.</span>'
          : isActive ? ' <span style="color:var(--blue); font-weight:700;">(actif)</span>' : '';
        actionHtml += `
          <button class="pm-switch-btn" ${disabled} onclick="pvpSubmitSwitch(${i})">
            <canvas width="48" height="48" class="pm-sprite" id="pvp-sw-${i}"></canvas>
            <div style="font-weight:700; font-size:.88rem;">${f.name}${stateLabel}</div>
            <span class="pm-type-badge" style="background:${PM_TYPE_COLOR[f.type]}; font-size:.7rem;">${PM_TYPE_EMOJI[f.type]} ${PM_TYPE_LABEL[f.type]}</span>
            <div style="font-size:.72rem; color:var(--muted); font-family:'Space Mono',monospace;">Niv ${f.level} · PV ${f.hp}/${f.maxHp}</div>
            <div style="width:100%; height:5px; background:var(--surface2); border-radius:3px; overflow:hidden;">
              <div style="height:100%; width:${hpPct}%; background:${hpColor};"></div>
            </div>
          </button>`;
      });
      actionHtml += `</div>`;
    }
  } else if (myActive) {
    if (_pvpUiSwitching) {
      // Grille de switch manuelle
      actionHtml = `<div style="margin-bottom:10px; text-align:center; color:var(--muted); font-size:.85rem;">Choisis le PokePom à envoyer (consomme ton tour) :</div>`;
      actionHtml += `<div class="pm-switch-grid">`;
      myTeam.forEach((f, i) => {
        const isActive = i === myActiveIdx;
        const isKo = f.ko || f.hp <= 0;
        const disabled = (isActive || isKo) ? 'disabled' : '';
        const hpPct = Math.max(0, Math.min(100, (f.hp / f.maxHp) * 100));
        const hpColor = hpPct > 50 ? 'var(--green)' : hpPct > 20 ? 'var(--yellow)' : 'var(--red)';
        const stateLabel = isKo ? ' <span style="color:var(--red); font-weight:700;">K.O.</span>'
          : isActive ? ' <span style="color:var(--blue); font-weight:700;">(actif)</span>' : '';
        actionHtml += `
          <button class="pm-switch-btn" ${disabled} onclick="pvpSubmitSwitch(${i})">
            <canvas width="48" height="48" class="pm-sprite" id="pvp-sw-${i}"></canvas>
            <div style="font-weight:700; font-size:.88rem;">${f.name}${stateLabel}</div>
            <span class="pm-type-badge" style="background:${PM_TYPE_COLOR[f.type]}; font-size:.7rem;">${PM_TYPE_EMOJI[f.type]} ${PM_TYPE_LABEL[f.type]}</span>
            <div style="font-size:.72rem; color:var(--muted); font-family:'Space Mono',monospace;">Niv ${f.level} · PV ${f.hp}/${f.maxHp}</div>
            <div style="width:100%; height:5px; background:var(--surface2); border-radius:3px; overflow:hidden;">
              <div style="height:100%; width:${hpPct}%; background:${hpColor};"></div>
            </div>
          </button>`;
      });
      actionHtml += `</div>`;
      actionHtml += `<button class="btn-outline" style="margin-top:10px; width:100%;" onclick="pvpCancelSwitch()">← Annuler</button>`;
    } else {
      // Grille des moves (style PvE) — avec affichage des PP restants
      const myPps = (myActive && Array.isArray(myActive.movePps)) ? myActive.movePps : [];
      // Si tous les moves sont à 0 PP, on signalera la "Lutte" comme en PvE.
      // En PvP, comme on garde une exécution simple, on désactive juste les moves vides.
      // (Le moteur pmExecuteMove substitue déjà "lutte" si plus de PP — voir pmRunTurn,
      //  mais ici on appelle pmExecuteMove directement, donc on permet quand même
      //  de cliquer un move sans PP : il sera lutté à la résolution.)
      actionHtml = `<div class="pm-moves-grid">`;
      (myActive.moveIds || []).forEach((mid, i) => {
        const m = PM_MOVES[mid];
        if (!m) return;
        const desc = m.desc || '';
        const maxPp = m.pp;
        const ppLeft = (typeof myPps[i] === 'number') ? myPps[i] : maxPp;
        const ppClass = ppLeft <= 0 ? 'empty' : ppLeft <= 1 ? 'low' : '';
        const disabled = ppLeft <= 0 ? 'disabled' : '';
        actionHtml += `
          <button class="pm-move-btn" ${disabled} onclick="pvpSubmitMove(${i})">
            <div class="pm-move-name" style="color:${PM_TYPE_COLOR[m.type] || 'inherit'};">${PM_TYPE_EMOJI[m.type] || '◌'} ${m.name}</div>
            <div class="pm-move-info">
              ${m.power > 0 ? 'Puiss. ' + m.power + ' · ' : ''}${m.accuracy}%
              <span class="pm-move-pp ${ppClass}">· ${ppLeft}/${maxPp} PP</span>
            </div>
            ${desc ? `<div class="pm-move-desc">${desc}</div>` : ''}
          </button>`;
      });
      actionHtml += `</div>`;
      // Si plus aucun PP, on prévient
      const allEmpty = (myActive.moveIds || []).every((mid, i) => {
        const max = (PM_MOVES[mid] && PM_MOVES[mid].pp) || 0;
        const left = (typeof myPps[i] === 'number') ? myPps[i] : max;
        return left <= 0;
      });
      if (allEmpty) {
        actionHtml += '<div style="margin-top:10px; text-align:center; color:var(--yellow); font-weight:700;">Plus aucun PP ! Tu vas utiliser Lutte.</div>';
        actionHtml += '<button class="btn-primary" style="margin-top:10px; width:100%;" onclick="pvpSubmitMove(0)">Utiliser Lutte</button>';
      }
      const availableSwitches = myTeam.filter((f, i) => i !== myActiveIdx && !(f.ko || f.hp <= 0)).length;
      if (availableSwitches > 0) {
        actionHtml += `<button class="btn-outline" style="margin-top:10px; width:100%;" onclick="pvpOpenSwitch()">🔄 Changer de PokePom <span style="color:var(--muted); font-size:.8rem;">(consomme le tour)</span></button>`;
      }
    }
  }

  // Log + timer
  const recentLog = (battle.log || []).slice(-12);
  const logHtml = `<div class="pm-battle-log" id="pvp-log">${recentLog.map(l => `<div class="pm-log-line">${l}</div>`).join('')}</div>`;
  let timerHtml = '';
  if (battle.turnDeadline) {
    const ms = new Date(battle.turnDeadline).getTime() - Date.now();
    if (ms > 0) timerHtml = `<div style="font-size:.78rem; color:var(--muted); text-align:right; margin-bottom:6px;">⏱️ ${Math.floor(ms/60000)} min restantes</div>`;
    else timerHtml = `<div style="font-size:.78rem; color:var(--red); text-align:right; font-weight:700; margin-bottom:6px;">⏱️ Temps écoulé !</div>`;
  }
  const abandonHtml = `<button class="btn-outline" style="margin-top:10px; width:100%; color:var(--red); border-color:var(--red);" onclick="pvpAbandon()">🏳️ Abandonner</button>`;

  content.innerHTML = `
    ${timerHtml}
    <div class="pm-battle-arena">
      <div class="pm-battle-field">
        ${renderSide(myInfo, myActive, myTeam, myActiveIdx, 'me', true)}
        ${renderSide(oppInfo, oppActive, oppTeam, oppActiveIdx, 'opp', false)}
      </div>
      ${logHtml}
      ${actionHtml}
      ${abandonHtml}
    </div>
  `;

  setTimeout(() => {
    if (myActive)  { const c = document.getElementById('pvp-active-me');  if (c) drawPokePom(c, myActive.pokepomId); }
    if (oppActive) { const c = document.getElementById('pvp-active-opp'); if (c) drawPokePom(c, oppActive.pokepomId); }
    myTeam.forEach((f, i)  => { const c = document.getElementById('pvp-mini-me-' + i);  if (c) drawPokePom(c, f.pokepomId); });
    oppTeam.forEach((f, i) => { const c = document.getElementById('pvp-mini-opp-' + i); if (c) drawPokePom(c, f.pokepomId); });
    myTeam.forEach((f, i) => { const c = document.getElementById('pvp-sw-' + i); if (c) drawPokePom(c, f.pokepomId); });
    const log = document.getElementById('pvp-log');
    if (log) log.scrollTop = log.scrollHeight;
  }, 0);
}

// Mode switch manuel (équivalent pmOpenSwitch / pmCancelSwitch)
let _pvpUiSwitching = false;
function pvpOpenSwitch() {
  if (!_pvpCurrentBattle || _pvpCurrentBattle.status !== 'active') return;
  const me = pvpIdentifyMe(_pvpCurrentBattle);
  if (me !== _pvpCurrentBattle.currentPlayer) return;
  _pvpUiSwitching = true;
  pvpRenderBattleUI(_pvpCurrentBattle);
}
function pvpCancelSwitch() {
  _pvpUiSwitching = false;
  if (_pvpCurrentBattle) pvpRenderBattleUI(_pvpCurrentBattle);
}

// ─────────────────────────────────────────────────────────────────────
// Exports globaux pour les onclick HTML
// ─────────────────────────────────────────────────────────────────────

window.pvpInitChallenge   = pvpInitChallenge;
window.pvpSubmitMove      = pvpSubmitMove;
window.pvpSubmitSwitch    = pvpSubmitSwitch;
window.pvpAbandon         = pvpAbandon;
window.pvpForceClearAndExit = pvpForceClearAndExit;
window.pvpDetachListener  = pvpDetachListener;
window.pvpOpenSwitch      = pvpOpenSwitch;
window.pvpCancelSwitch    = pvpCancelSwitch;
window.pmRenderPvpHub     = pmRenderPvpHub;
window.pmRenderPvpList    = pmRenderPvpList;
window.pmRenderPvpBattle  = pmRenderPvpBattle;
window.pmEloTier          = pmEloTier;

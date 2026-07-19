import { POWER_TILES, getPlayerPyramidColors, getPlayerPyramidLevel, isGrayTokenTile } from "../constants/powerTiles";
import { PYRAMID_SLOTS, PYRAMID_COLORS } from "../constants/pyramids";
import { ZONE_ADJACENCY, BOARD_ZONES, TELEPORT_TARGETS } from "../constants/board";
import { MAX_UNITS_PER_ZONE } from "../constants/game";
import { COMBAT_CARDS } from "../constants/cards";
import { CREATURE_POWERS, getPowerTileCombatBonus, getZoneMaxUnits, getCombatCreatureBonus, getJpTokenCombatBonus } from "../constants/creaturePowers";
import { getValidPriestDestinations } from "../constants/taSetiGraph";
import { TASETI_E_BONUSES } from "../constants/taSetiBonuses";
import { E_TO_TOKENS } from "../constants/taSetiPositions";

const TEMPLES = ["T1", "T2", "T3", "TB"];

// ─── Poids de l'IA ───────────────────────────────────────────────────────────
// Modifier uniquement les valeurs numériques pour calibrer le comportement.
// Référence complète des règles : Project_Files/Rules_IA_V2.txt
// Poids de base de chaque candidat : 1. Les règles valides s'additionnent.
export const AI_WEIGHTS = {

  // ── Prière ──────────────────────────────────────────────────────────────
  prayer_urgentAnk:      70,   // ank <= 2 → urgence, prayer2
  prayer_lowAnk:         40,   // ank <= 5 → besoin d'ank, prayer2
  prayer_highAnk_niv3:   30,   // ank >= 7 → peut se permettre prayer3
  prayer_tile_niv3:      20,   // possède tuile "Prière +1 ank" → prayer3
  // ank >= 11 → prayer ignorée (non candidat)

  // ── Achat de tuile ──────────────────────────────────────────────────────
  buy_creature:          50,   // tuile de type créature
  buy_vpImmediate:       50,   // tuile donne VP immédiat (Point Majeur)
  buy_combat:            55,   // tuile avec bonus de combat (force, bouclier)
  buy_noCombatTile:      40,   // aucune tuile combat/créature → priorité à en acheter une
  buy_movement:          25,   // tuile avec bonus de déplacement / téléportation
  buy_level3:            30,   // tuile de niveau 3
  buy_noTileInColor:     25,   // aucune tuile possédée de cette couleur
  buy_fewTiles:          20,   // moins de 2 tuiles au total
  buy_richEnough:        20,   // ank >= 7

  // ── Achat — notes DB (page ?ratings) ────────────────────────────────────
  buy_dbTileScale:       25,   // par point d'écart à 3 de la note individuelle (note 5 → +50, note 1 → -50)
  buy_dbComboScale:      20,   // par point d'écart à 3, par combo avec une tuile possédée (cumulés)
  buy_dbComboCap:        60,   // borne du cumul des synergies possédées (±)
  buy_dbPotentialScale:   8,   // par point >3 d'une combo avec une tuile encore achetable (synergie future)
  buy_dbPotentialCap:    24,   // borne du bonus de synergie future
  buy_dbPriorityFactor: 0.4,   // atténuation du potentiel si la tuile n'est pas à acheter en premier (priorityTile)

  // ── Recrutement ─────────────────────────────────────────────────────────
  // Une "troupe complète" = une zone avec MAX_UNITS_PER_ZONE unités de ma couleur.
  // Recruter n'a de sens que pour former/reformer des troupes complètes (0 ou 1
  // actuellement) ou compléter une troupe entamée — pas au-delà de 2 troupes.
  recruit_bigReserve:    30,   // réserve >= 3
  recruit_fewOnBoard:    40,   // total unités sur plateau < 5
  recruit_richEnough:    20,   // ank >= 3
  recruit_noCompleteTroop: 50, // aucune troupe complète (5 unités) → priorité pour en former une
  recruit_oneCompleteTroop: 30,// une seule troupe complète → recruter pour en reformer une 2e
  recruit_completePartial: 35, // une troupe entamée peut être complétée par ce recrutement

  // ── Déplacement ─────────────────────────────────────────────────────────
  move_emptyTemple:      60,   // cible est un temple vide
  move_adjacentTemple:   25,   // cible adjacente à un temple vide
  move_priestAdvance:    30,   // peut avancer un prêtre sur Ta-Seti
  move_reinforce:        15,   // cible déjà occupée par mes unités (regroupement)
  move_control2temples:  70,   // ce déplacement permettra de contrôler >= 2 temples
  move_preferBoth:       25,   // bonus si le type de déplacement complémentaire est déjà utilisé
  move_earlyPenalty:    -22,   // pénalité par token restant au-dessus de 2 (déplacements tardifs)
  move_lastToken:        80,   // dernier jeton → forcer le déplacement manquant
  move_towardAttack:     45,   // bonus si le déplacement met à portée d'attaque un ennemi faible
  move_emptyDesert:     -50,   // cible désert vide sans intérêt stratégique → mauvaise destination

  // ── Attaque ─────────────────────────────────────────────────────────────
  attack_base:           40,   // attaque légale (ratio >= 1:1)
  attack_ratio2to1:     100,   // ratio attaque >= 2:1
  attack_ratio1_5to1:    65,   // ratio attaque >= 1.5:1
  attack_ratio1to1:      35,   // ratio >= 1:1 (sans bonus ratio supérieur)
  attack_temple:         75,   // cible est un temple (T1, T2, T3, TB)
  attack_enemyCity:      45,   // cible est une cité ennemie
  attack_enemyAlone:     65,   // ennemi a 1 seule unité dans la cible
  attack_myUnits4plus:   35,   // j'ai >= 4 unités attaquantes
  attack_leaderEnemy:    45,   // adversaire leader au score est dans cette zone
  attack_myCreature:     50,   // j'ai une créature dans la zone source
  attack_myStrongCard:   25,   // j'ai une carte combat de force >= 4
  attack_enemyCreature:  -15,  // ennemi a une créature (risque élevé)
  attack_adjTemple:      35,   // cible adjacente à un temple vide (enchaîner)
  attack_hasCombatTile:  30,   // possède au moins une tuile combat ou créature

  // ── Amélioration de pyramide ─────────────────────────────────────────────
  pyramid_toLevel2:      40,   // niveau cible = 2
  pyramid_toLevel3:      30,   // niveau cible = 3
  pyramid_toLevel4:      20,   // niveau cible = 4
  pyramid_noTiles:       30,   // aucune tuile possédée de cette couleur
  pyramid_ank8plus:      20,   // ank >= 8

  // ── Cartes ID — phase jour ───────────────────────────────────────────────
  id_ank_critical:       70,   // jouer gain_ank si ank <= 2
  id_ank_low:            45,   // jouer gain_ank si ank <= 4
  id_taxation:           30,   // jouer taxation_divine si ank <= 5
  id_renforts:           40,   // jouer renforts si réserve faible
  id_teleport:           25,   // jouer téléportation (téléportation gratuite ce tour)
  id_pluiedefeu:         35,   // jouer pluie de feu si une cible valable existe
  id_recuperation:       20,   // jouer récupération d'ID si la défausse contient une carte

  // ── Carte combat — sélection ────────────────────────────────────────────
  combatCard_force4:     30,   // force >= 4
  combatCard_force3:     15,   // force = 3
  combatCard_shields2:   20,   // boucliers >= 2
  combatCard_blood2:     20,   // gouttes de sang >= 2 (relevé pour usage plus fréquent)
  combatCard_topForce:   30,   // bonus pour la carte avec la force maximale disponible
  combatCard_topBlood:   25,   // bonus pour la carte avec le max de sang disponible
  combatCard_vsBlood:    30,   // préférer boucliers si adversaire a des cartes sang (>= 2)

  // ── Carte combat — défausse ─────────────────────────────────────────────
  discard_lowForce:      50,   // force <= 2 (mauvaise carte → défausser)
  discard_force1:        30,   // force = 1 (très mauvaise → bonus de défausse)
  discard_highShields:   20,   // boucliers >= 3 (garder pour défense → ne pas défausser)

  // ── Draft (phase initiale) ────────────────────────────────────────────────
  draft_creature:        40,   // tuile de type créature
  draft_vp:              50,   // tuile donne VP immédiat
  draft_matchColor:      35,   // couleur = pyramide la plus haute
  draft_combat:          35,   // tuile avec bonus de combat
  draft_movement:        25,   // tuile avec bonus de déplacement
  draft_noTileInColor:   15,   // aucune tuile possédée de cette couleur
  draft_recruitUpgrade:  30,   // tuile "Recrutement" ou "Augmentation pyramide"

  // ── Aube : position dans l'ordre de jeu ──────────────────────────────────
  dawn_firstIfTemple:    60,   // temple vide accessible → jouer en premier
  dawn_firstIfAttack:    50,   // veux attaquer avant que l'adversaire se renforce
  dawn_lastIfReactive:   40,   // stratégie réactive → jouer en dernier
  dawn_lastIfLeader:     60,   // je suis leader → jouer en dernier (prudence)

  // ── Téléportation ────────────────────────────────────────────────────────
  teleport_ankPenalty:  -10,   // pénalité par ank dépensé pour se téléporter

  // ── Planification (plan sur 3 coups, révisé à chaque tour) ───────────────
  plan_stepDiscount:   0.92,   // escompte par coup : privilégie la valeur immédiate à valeur égale
  plan_lateActionMalus: 0.8,   // décote des actions de plateau (déplacement/attaque) planifiées pour plus tard
  plan_lateBuyMalus:   0.85,   // décote des achats planifiés pour plus tard (la tuile peut être prise entre-temps)
  plan_easyAttackRatio: 1.5,   // ratio à partir duquel une victoire est "facile" → attaque immédiate

  // ── Règles métier supplémentaires ────────────────────────────────────────
  recruit_incompleteInCity: 40, // troupe incomplète dans la cité (ou Recrutement Local) → recruter au plus vite
  buy_reinforceWhenWeak:    30, // aucune attaque favorable en vue → viser les tuiles de force/combat
};

// ─── Moteur de sélection pondérée ────────────────────────────────────────────
// Poids négatifs ignorés pour éviter un total nul. Poids minimum 0 par candidat.
function weightedSelect(candidates) {
  if (candidates.length === 0) return null;
  const total = candidates.reduce((s, c) => s + Math.max(0, c.weight), 0);
  if (total <= 0) return candidates[candidates.length - 1];
  let r = Math.random() * total;
  for (const c of candidates) {
    r -= Math.max(0, c.weight);
    if (r <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMyZonesSorted(boardUnits, aiColor) {
  return Object.entries(boardUnits)
    .filter(([, c]) => (c?.[aiColor] || 0) > 0)
    .sort(([, ca], [, cb]) => (cb[aiColor] || 0) - (ca[aiColor] || 0))
    .map(([zId]) => zId);
}

function getEnemyEntry(boardUnits, zoneId, aiColor) {
  const zoneUnits = boardUnits[zoneId] || {};
  const entry = Object.entries(zoneUnits).find(([c, n]) => c !== aiColor && (n || 0) > 0);
  return entry ? { color: entry[0], count: entry[1] } : null;
}

function getTotalVP(playerId, gameState) {
  return gameState?.players?.[playerId]?.vpPermanent ?? 0;
}

function isLeader(playerId, allPlayers, gameState) {
  const myVP = getTotalVP(playerId, gameState);
  return allPlayers.every(p => p.id === playerId || getTotalVP(p.id, gameState) <= myVP);
}

function getLeaderEnemyColor(aiPlayerId, aiColor, allPlayers, gameState) {
  const leader = allPlayers
    .filter(p => p.id !== aiPlayerId)
    .sort((a, b) => getTotalVP(b.id, gameState) - getTotalVP(a.id, gameState))[0];
  return leader?.color ?? null;
}

function getCreatureInZone(zoneId, color, gameState) {
  return (
    gameState?.creatureAssignments?.[zoneId]?.[color] ||
    gameState?.creatureAssignments2?.[zoneId]?.[color] ||
    null
  );
}

function getCreaturePowerById(tileId) {
  const name = tileId ? POWER_TILES.find(t => t.id === tileId)?.name : null;
  return name ? CREATURE_POWERS[name] : null;
}

// Valeur estimée (en poids IA) d'un bonus Ta-Seti
function tasetiBonusValue(b) {
  switch (b?.type) {
    case 'ank':           return (b.value ?? 1) * 8;
    case 'vp':            return (b.value ?? 1) * 45;
    case 'tasetiRecruit': return (b.value ?? 1) * 10;
    case 'destroyUnit':   return 25;
    case 'idCard':        return (b.value ?? 1) * 15;
    case 'moveBonus':     return 8;
    case 'combatForce':
    case 'combatBlood':
    case 'combatShields': return (b.value ?? 1) * 8;
    default:              return 5;
  }
}

// Valeur du meilleur pas de prêtre disponible : chaque action de déplacement
// avance aussi un prêtre sur Ta-Seti, cette valeur s'ajoute donc aux candidats
// de déplacement (bonus des nœuds E_, jetons présents, fin de piste +1 PV).
function estimateTasetiMoveValue(gameState, aiPlayerId) {
  const layout = gameState?.taSetiLayout;
  if (!layout) return 0;
  const faces = Array.isArray(layout) ? layout : Object.values(layout);
  const raw = gameState.taSetiPriestPositions?.[aiPlayerId] || {};
  const positions = [raw['0'] ?? '', raw['1'] ?? '', raw['2'] ?? ''];
  let best = 0;
  for (const pos of positions) {
    for (const dest of getValidPriestDestinations(pos, layout)) {
      let v = 4; // progression de base
      const em = dest.match(/^E_(\d+)_/);
      if (em) {
        const fk = `${em[1]}${faces[parseInt(em[1]) - 1]}`;
        (TASETI_E_BONUSES[fk]?.[dest] ?? []).forEach(b => { v += tasetiBonusValue(b); });
        (E_TO_TOKENS[fk]?.[dest] ?? []).forEach(tid => {
          const hasToken = (tid.startsWith('JI') && gameState.jiAssignment?.[tid]) ||
                           (tid.startsWith('JU') && gameState.puAssignment?.[tid]) ||
                           (tid.startsWith('JP') && gameState.jpAssignment?.[tid]);
          if (hasToken) v += 12;
        });
      }
      if (dest === 'E_4_2' && !gameState.taSetiE4_2DailyVp) v += 45; // fin de piste : +1 PV
      best = Math.max(best, v);
    }
  }
  return best;
}

// Ta-Seti : décide si l'IA prend les jetons d'un emplacement E_ (le prêtre
// retourne alors en réserve) ou les laisse pour continuer à avancer.
// Choix pondéré : valeur des jetons vs progression abandonnée (les sections
// profondes rapprochent de la fin de piste et de son +1 PV).
export function aiDecideTakeTokens(tokenCardIds, section) {
  if (tokenCardIds.length === 0) return false;
  if (tokenCardIds.includes('PU_points')) return true; // +1 PV direct : toujours pris
  let value = 0;
  for (const cardId of tokenCardIds) {
    if (cardId === 'PU_ID' || cardId === 'JI_ID') value += 55; // pioche de carte ID
    else value += 40;                                          // bonus +1 (combat, déplacement…)
  }
  const progressCost = 30 + (section ?? 1) * 10; // section 1 → 40 … section 4 → 70
  return Math.random() * (value + progressCost) < value;
}

// Cerbère : cible d'équipement — une troupe faible (1-2 unités) sans créature sur
// un temple, à sécuriser. Retourne l'id de zone ou null si aucune cible valable.
export function aiFindCerbereTarget(aiColor, boardUnits, creatureAssignments) {
  const targets = TEMPLES.filter(zId => {
    const n = boardUnits?.[zId]?.[aiColor] || 0;
    return n >= 1 && n <= 2 && !creatureAssignments?.[zId]?.[aiColor];
  });
  targets.sort((a, b) => (boardUnits[a]?.[aiColor] || 0) - (boardUnits[b]?.[aiColor] || 0));
  return targets[0] ?? null;
}

function hasStrongCombatCard(playerState) {
  const available = playerState.availableCombatCards || [1, 2, 3, 4, 5, 6, 7, 8];
  return available.some(id => (COMBAT_CARDS.find(c => c.id === id)?.force ?? 0) >= 4);
}

function hasEmptyTempleAdjacent(zoneId, boardUnits) {
  return (ZONE_ADJACENCY[zoneId] || []).some(
    adj => TEMPLES.includes(adj) && !Object.values(boardUnits[adj] || {}).some(n => n > 0)
  );
}

function countMyTemples(aiColor, boardUnits) {
  return TEMPLES.filter(t => (boardUnits[t]?.[aiColor] || 0) > 0).length;
}

function computeAITeleportCost(myState) {
  const owned = myState.ownedTileIds || [];
  const has = name => owned.some(id => POWER_TILES.find(t => t.id === id)?.name === name);
  return Math.max(0, (has("Réduction Téléportation") ? 1 : 2) - (has("Réduction d'ank") ? 1 : 0) - (has("Téléportation facile") ? 1 : 0));
}

// Bonus de déplacement d'une créature équipée sur la troupe (ex: Scarabée +2,
// Scorpion +2, Momie +1) — propre à la zone/troupe, contrairement aux autres
// bonus (tuiles, cartes ID, jetons JP) qui s'appliquent à tout le joueur.
function movementBonusInZone(zoneId, aiColor, gameState) {
  const ids = [
    gameState?.creatureAssignments?.[zoneId]?.[aiColor],
    gameState?.creatureAssignments2?.[zoneId]?.[aiColor],
  ];
  return ids.reduce((sum, id) => sum + (getCreaturePowerById(id)?.movementBonus ?? 0), 0);
}

// Capacité de déplacement GARANTIE (sans carte à jouer) :
// tuiles pouvoirs + jetons JP sur les prêtres + bonus de créature propre à la
// troupe qui bouge (fromZoneId). "Marche Forcée" n'est PAS comptée ici : la
// règle donne "+1 déplacement pour le déplacement en cours", donc uniquement
// si la carte est activement jouée pour CE déplacement précis — pas un bonus
// passif tant qu'elle reste en main.
function computeMovePointsDetail(aiPlayerId, gameState, fromZoneId = null) {
  const myState = gameState.players?.[aiPlayerId] || {};
  const ownedTileIds = myState.ownedTileIds || [];
  const sources = [];
  let pts = 1;

  const tileBonusCount = ownedTileIds.filter(id => {
    const name = POWER_TILES.find(t => t.id === id)?.name;
    return name === "Déplacement" || name === "Furie Bestiale";
  }).length;
  if (tileBonusCount > 0) {
    pts += tileBonusCount;
    sources.push(`tuile Déplacement/Furie Bestiale x${tileBonusCount}`);
  }

  // Jeton JP capacité déplacement : ne s'applique que si le prêtre porteur est
  // dans LA ZONE de la troupe qui bouge (fromZoneId), pas n'importe où sur le
  // plateau — même règle que pour tous les autres jetons JP (getJpTokenFlags).
  const aiColor = myState.color;
  if (fromZoneId) {
    const jpIdsHere = gameState.boardPriests?.[fromZoneId]?.[aiColor]?.jpTokenIds || [];
    const jpCount = jpIdsHere.filter(id => id === 'JP_capacite_deplacement').length;
    if (jpCount > 0) {
      pts += jpCount;
      sources.push(`jeton JP déplacement x${jpCount}`);
    }
  }

  if (fromZoneId) {
    const creatureBonus = movementBonusInZone(fromZoneId, aiColor, gameState);
    if (creatureBonus > 0) {
      pts += creatureBonus;
      sources.push(`créature +${creatureBonus}`);
    }
  }

  return { total: pts, sources };
}

function computeMaxMovePoints(aiPlayerId, gameState, fromZoneId = null) {
  return computeMovePointsDetail(aiPlayerId, gameState, fromZoneId).total;
}

// Nombre de cartes "Marche Forcée" en main, jouables pour étendre la portée
// d'UN déplacement précis (chacune consommée si utilisée).
function getMarcheForceeAvailable(aiPlayerId, gameState) {
  const myState = gameState.players?.[aiPlayerId] || {};
  return (myState.idCards || []).filter(c => c.id === "marche_forcee").length;
}

// Pour les logs : détail lisible des points de déplacement réellement utilisés
// pour un trajet donné (base + bonus garantis + Marche Forcée réellement jouée).
export function describeMovePoints(aiPlayerId, gameState, fromZoneId = null, marcheForceeUsed = 0) {
  const detail = computeMovePointsDetail(aiPlayerId, gameState, fromZoneId);
  if (marcheForceeUsed > 0) {
    return {
      total: detail.total + marcheForceeUsed,
      sources: [...detail.sources, `carte Marche Forcée x${marcheForceeUsed}`],
    };
  }
  return detail;
}

// BFS : retourne les temples vides atteignables depuis fromZoneId en <= maxPts pas
// (ne traverse pas les zones occupées par des ennemis)
function getReachableEmptyTemples(fromZoneId, maxPts, boardUnits, aiColor) {
  const visited = new Set([fromZoneId]);
  let frontier = [fromZoneId];
  const reachable = [];

  for (let step = 1; step <= maxPts; step++) {
    const next = [];
    for (const zone of frontier) {
      for (const adj of (ZONE_ADJACENCY[zone] || [])) {
        if (visited.has(adj)) continue;
        visited.add(adj);
        const adjUnits = boardUnits[adj] || {};
        const hasEnemy = Object.entries(adjUnits).some(([c, n]) => c !== aiColor && (n || 0) > 0);
        if (hasEnemy) continue;
        next.push(adj);
        if (TEMPLES.includes(adj) && !Object.values(adjUnits).some(n => n > 0)) {
          reachable.push(adj);
        }
      }
    }
    frontier = next;
  }

  return reachable;
}

// BFS : retourne toutes les zones accessibles depuis fromZoneId en <= maxPts pas
// (ne traverse pas les zones ennemies)
// Retourne { zoneId, distance } pour chaque zone accessible — la distance sert
// à déterminer si le trajet dépasse la capacité garantie et nécessite de jouer
// une/des carte(s) Marche Forcée.
function getReachableZonesForMove(fromZoneId, maxPts, boardUnits, aiColor) {
  const visited = new Set([fromZoneId]);
  let frontier = [fromZoneId];
  const reachable = [];
  for (let step = 1; step <= maxPts; step++) {
    const next = [];
    for (const zone of frontier) {
      for (const adj of (ZONE_ADJACENCY[zone] || [])) {
        if (visited.has(adj)) continue;
        visited.add(adj);
        const hasEnemy = Object.entries(boardUnits[adj] || {}).some(([c, n]) => c !== aiColor && (n || 0) > 0);
        if (hasEnemy) continue;
        reachable.push({ zoneId: adj, distance: step });
        next.push(adj);
      }
    }
    frontier = next;
  }
  return reachable;
}

// BFS : retourne les zones ennemies atteignables en <= maxPts pas, avec la
// distance parcourue. Une armée qui entre sur une case ennemie déclenche un
// combat immédiat et s'arrête (règle 6.10) — on ne peut donc PAS traverser une
// zone ennemie, seulement y arriver en dernière étape. Ceci permet à l'IA
// d'attaquer une cible à plusieurs cases de distance (ex: créature +2 mvt),
// pas seulement les voisins directs.
function getReachableEnemyZones(fromZoneId, maxPts, boardUnits, aiColor) {
  const visited = new Set([fromZoneId]);
  let frontier = [fromZoneId];
  const reachable = []; // { zoneId, distance }
  for (let step = 1; step <= maxPts; step++) {
    const next = [];
    for (const zone of frontier) {
      for (const adj of (ZONE_ADJACENCY[zone] || [])) {
        if (visited.has(adj)) continue;
        visited.add(adj);
        const hasEnemy = Object.entries(boardUnits[adj] || {}).some(([c, n]) => c !== aiColor && (n || 0) > 0);
        if (hasEnemy) { reachable.push({ zoneId: adj, distance: step }); continue; }
        next.push(adj);
      }
    }
    frontier = next;
  }
  return reachable;
}

// ─── Sélection de carte ID jour à jouer en bonus ─────────────────────────────
// Retourne la meilleure carte ID "day" à jouer gratuitement avec l'action principale.
// Cartes simples uniquement (effet direct, pas de pending state complex).
function selectBestDayIdCard(myState, boardUnits, aiColor, gameState = {}) {
  const dayCards = (myState.idCards || []).filter(c => c.timing === "day");
  if (dayCards.length === 0) return null;

  const ank = myState.ank ?? 7;
  const reserve = myState.unitsReserve ?? 0;
  const candidates = [];

  for (const card of dayCards) {
    switch (card.id) {
      case "gain_ank":
        if (ank <= 2) candidates.push({ card, weight: AI_WEIGHTS.id_ank_critical });
        else if (ank <= 4) candidates.push({ card, weight: AI_WEIGHTS.id_ank_low });
        break;
      case "taxation_divine":
        if (ank <= 5) candidates.push({ card, weight: AI_WEIGHTS.id_taxation });
        break;
      case "renforts":
        if (reserve <= 1) candidates.push({ card, weight: AI_WEIGHTS.id_renforts });
        break;
      case "teleportation":
        if (!(myState.pendingFreeAnyTeleport)) candidates.push({ card, weight: AI_WEIGHTS.id_teleport });
        break;
      case "pluie_de_feu": {
        // Cible potentielle : au moins une unité ennemie existe quelque part sur le
        // plateau (la protection pluie de feu et le choix précis sont filtrés au
        // moment de la résolution, resolveAiTaSetiPendings).
        const hasEnemyTarget = Object.values(boardUnits || {}).some(
          zone => Object.entries(zone || {}).some(([c, n]) => c !== aiColor && (n || 0) > 0)
        );
        if (hasEnemyTarget) candidates.push({ card, weight: AI_WEIGHTS.id_pluiedefeu });
        break;
      }
      case "recuperation_id":
        if ((gameState.idDiscard || []).length > 0) candidates.push({ card, weight: AI_WEIGHTS.id_recuperation });
        break;
      default:
        break;
    }
  }

  if (candidates.length === 0) return null;
  return weightedSelect(candidates)?.card ?? null;
}

// ─── Setup ───────────────────────────────────────────────────────────────────
// Choisit 1 pyramide niveau 2 + 1 niveau 1 selon joinOrder (déterministe)
// Règles : Rules_IA.txt § "Choisir couleur de pyramide" + "Choisir niveau initial"
export function aiChooseSetup(aiPlayer, gameState, allPlayers) {
  const joinOrder = aiPlayer.joinOrder;
  const slots = PYRAMID_SLOTS.filter(s => s.cityId === `J${joinOrder}`);
  const pyramids = gameState?.pyramids || {};

  const advPyramids = Object.values(pyramids).filter(p => p.ownerId && p.ownerId !== aiPlayer.id);

  const colorCandidates = PYRAMID_COLORS.map(color => {
    let weight = 1;
    const advWithColor = advPyramids.filter(p => p.color === color);
    const advLevel1    = advWithColor.filter(p => p.level === 1);
    const advLevel2up  = advWithColor.filter(p => p.level >= 2);

    if (advWithColor.length === 0) {
      weight += 50; // aucun adversaire n'a cette couleur
    } else if (advLevel2up.length === 0 && advLevel1.length > 0) {
      weight += 20; // adversaire en niveau 1 uniquement
    }

    if (color === "Blanc") {
      if (advLevel1.length >= 3) weight += 20; // 3 pyramides adverses blanc niv.1
      if (advWithColor.length >= 2) weight += 10; // 2 pyramides adverses blanc (niveaux mixtes)
    }

    return { color, weight };
  });

  // Option A : 3×Niv.1  |  Option B : Niv.2 + Niv.1  (mêmes poids que le choix de niveau)
  const useOptionA = weightedSelect([
    { opt: true,  weight: 1 + 10 }, // 3×niveau 1 (rare)
    { opt: false, weight: 1 + 60 }, // niveau 2 + niveau 1 (préféré)
  ]).opt;

  if (useOptionA) {
    const c1 = weightedSelect(colorCandidates);
    const c2 = weightedSelect(colorCandidates.filter(c => c.color !== c1.color));
    const c3 = weightedSelect(colorCandidates.filter(c => c.color !== c1.color && c.color !== c2.color));
    return [
      { slotId: slots[0].id, color: c1.color, level: 1 },
      { slotId: slots[1].id, color: c2.color, level: 1 },
      { slotId: slots[2].id, color: c3.color, level: 1 },
    ];
  }

  const c1 = weightedSelect(colorCandidates);
  const c2 = weightedSelect(colorCandidates.filter(c => c.color !== c1.color));
  return [
    { slotId: slots[0].id, color: c1.color, level: 2 },
    { slotId: slots[1].id, color: c2.color, level: 1 },
  ];
}

// ─── Placement ───────────────────────────────────────────────────────────────
// Règles : Rules_IA.txt § "Placer les unités initiales"
export function aiChoosePlacement(aiPlayer, gameState) {
  const n = aiPlayer.joinOrder;
  const pyramids = gameState?.pyramids || {};

  const zoneCandidates = [1, 2, 3].map(k => {
    const zoneId = `J${n}C${k}`;
    const pyramid = pyramids[`J${n}P${k}`];
    let weight = 1;
    if (!pyramid)           weight += 20; // pas de pyramide sur l'emplacement
    else if (pyramid.level === 1) weight += 10; // pyramide niveau 1
    return { zoneId, weight };
  });

  const first  = weightedSelect(zoneCandidates);
  const second = weightedSelect(zoneCandidates.filter(c => c.zoneId !== first.zoneId));

  return [first.zoneId, second.zoneId];
}

// ─── Draft ───────────────────────────────────────────────────────────────────
// Choisit la meilleure tuile de niveau 1 disponible selon les règles V2
export function aiChooseDraftTile(gameState, aiPlayerId) {
  const pyramids = gameState.pyramids || {};
  const myColors = getPlayerPyramidColors(aiPlayerId, pyramids);
  const availableTileIds = gameState.availableTileIds || [];
  const ownedTileIds = gameState.players?.[aiPlayerId]?.ownedTileIds || [];

  // Couleur de la pyramide la plus avancée
  const highestColor = myColors.reduce((best, color) => {
    const lvl = getPlayerPyramidLevel(aiPlayerId, color, pyramids);
    return lvl > (best ? getPlayerPyramidLevel(aiPlayerId, best, pyramids) : 0) ? color : best;
  }, null);

  // Tuiles de niveau 1 accessibles (de ma couleur en priorité, fallback toutes)
  let eligible = POWER_TILES.filter(
    t => t.level === 1 && myColors.includes(t.color) && availableTileIds.includes(t.id)
  );
  if (eligible.length === 0) {
    eligible = POWER_TILES.filter(t => t.level === 1 && availableTileIds.includes(t.id));
  }
  if (eligible.length === 0) return null;

  const scored = eligible.map(t => {
    const noTileInColor = !ownedTileIds.some(id => POWER_TILES.find(t2 => t2.id === id)?.color === t.color);
    let weight = 1;
    if (t.type === 'creature')              weight += AI_WEIGHTS.draft_creature;
    if ((t.vpOnPurchase ?? 0) > 0)          weight += AI_WEIGHTS.draft_vp;
    if (t.color === highestColor)           weight += AI_WEIGHTS.draft_matchColor;
    if (t.type === 'combat')                weight += AI_WEIGHTS.draft_combat;
    if (t.type === 'movement')              weight += AI_WEIGHTS.draft_movement;
    if (noTileInColor)                      weight += AI_WEIGHTS.draft_noTileInColor;
    const n = t.name || "";
    if (n.includes("Recrutement") || n.includes("Augmentation pyramide")) weight += AI_WEIGHTS.draft_recruitUpgrade;
    return { id: t.id, weight };
  });

  return weightedSelect(scored)?.id ?? null;
}

// ─── Phase de jeu (action principale) ────────────────────────────────────────
export function aiDecideAction(gameState, aiPlayerId, allPlayers, ratingsData = {}) {
  const myState = gameState.players?.[aiPlayerId] || {};
  const aiPlayer = allPlayers.find(p => p.id === aiPlayerId);
  const aiColor = aiPlayer?.color;
  const joinOrder = aiPlayer?.joinOrder;

  const actionsDone = myState.actionsThisTurn ?? 0;
  if ((myState.tokens ?? 5) <= 0) {
    return { type: "endTurn" };
  }
  if (actionsDone >= 1) {
    // Jeton gris : une 2e action est autorisée dans le même tour, une seule fois
    // par jour — jamais comme un tour indépendant.
    const hasGrayToken = actionsDone === 1 && !myState.grayBonusUsed &&
      (myState.ownedTileIds || []).some(id => isGrayTokenTile(POWER_TILES.find(t => t.id === id)));
    if (!hasGrayToken) return { type: "endTurn" };
  }

  const ank          = myState.ank ?? 7;
  const ownedTileIds = myState.ownedTileIds || [];
  const usedActions  = myState.usedActions || [];
  const unitsReserve = myState.unitsReserve ?? 0;
  const boardUnits   = gameState.boardUnits || {};
  const pyramids     = gameState.pyramids || {};
  const availableIds = gameState.availableTileIds || [];
  const tokensLeft   = myState.tokens ?? 5;

  const myZones = getMyZonesSorted(boardUnits, aiColor);
  const leaderColor = getLeaderEnemyColor(aiPlayerId, aiColor, allPlayers, gameState);

  const priestRaw  = gameState.taSetiPriestPositions?.[aiPlayerId] || {};
  const priestPos  = [priestRaw['0'] ?? '', priestRaw['1'] ?? '', priestRaw['2'] ?? ''];
  const taSetiLayout = gameState.taSetiLayout;
  const canAdvancePriest = taSetiLayout &&
    priestPos.some(p => getValidPriestDestinations(p, taSetiLayout).length > 0);

  const candidates = [];

  // DB ratings (injected from Firebase, default to empty so AI works without them)
  const { tileRatings = {}, tileCombinations = {} } = ratingsData;
  // gameProgress: 0 = début de partie, 1 = fin de partie
  // Utilise le numéro de tour si disponible (incrémenté chaque nuit), sinon VP max des joueurs
  const TOTAL_TURNS = 5;
  const VICTORY_VP = 10;
  const turnBased = gameState.turn != null
    ? Math.max(0, Math.min(1, (gameState.turn - 1) / Math.max(1, TOTAL_TURNS - 1)))
    : null;
  const vpBased = Math.max(0, Math.min(1,
    Math.max(...allPlayers.map(p => (gameState.players?.[p.id]?.vpPermanent ?? 0))) / VICTORY_VP
  ));
  const gameProgress = turnBased ?? vpBased;

  // ── Prière ────────────────────────────────────────────────────────────────
  // Chaque case d'action ne s'utilise qu'une fois par jour
  if (ank < 11) {
    if (!usedActions.includes('prayer2')) {
      let w2 = 1;
      if (ank <= 2) w2 += AI_WEIGHTS.prayer_urgentAnk;
      if (ank <= 5) w2 += AI_WEIGHTS.prayer_lowAnk;
      candidates.push({ type: "prayer2", weight: w2 });
    }

    if (!usedActions.includes('prayer3')) {
      let w3 = 1;
      if (ank >= 7) w3 += AI_WEIGHTS.prayer_highAnk_niv3;
      if (ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Priere +1 ank"))
        w3 += AI_WEIGHTS.prayer_tile_niv3;
      candidates.push({ type: "prayer3", weight: w3 });
    }
  }

  // ── Attaque ───────────────────────────────────────────────────────────────
  const hasCombatTile = ownedTileIds.some(id => {
    const t = POWER_TILES.find(t2 => t2.id === id);
    return t?.type === 'combat' || t?.type === 'creature';
  });
  // Victoire facile détectée → attaque immédiate, sans passer par le tirage
  let bestEasyAttack = null;
  // Au moins une attaque favorable en force de base ? (sinon → se renforcer en tuiles de force)
  let anyFavorableAttack = false;
  const disabledTilesAI = gameState.disabledTileIds || {};
  const myTilesCombat = getPowerTileCombatBonus(ownedTileIds, true, POWER_TILES, disabledTilesAI);

  for (const fromZoneId of myZones) {
    const myUnits = boardUnits[fromZoneId]?.[aiColor] || 0;
    if (myUnits < 2) continue;
    const attackCount = Math.min(myUnits - 1, 5);

    // Une armée peut attaquer toute cible ennemie atteignable en fin de trajet
    // (pas seulement les voisins directs) : le combat se déclenche dès l'entrée
    // sur la case ennemie et arrête le déplacement (règle 6.10), donc une
    // créature qui donne +mvt (Scarabée, Scorpion...) permet d'attaquer à
    // plusieurs cases de distance, en ligne droite, tant qu'aucune autre zone
    // ennemie n'est traversée en chemin. Marche Forcée peut aussi étendre la
    // portée, mais seulement si elle est réellement jouée (marquée sur la décision).
    const attackBasePts = computeMaxMovePoints(aiPlayerId, gameState, fromZoneId);
    const attackMarcheForcee = getMarcheForceeAvailable(aiPlayerId, gameState);
    const reachableEnemyZones = getReachableEnemyZones(fromZoneId, attackBasePts + attackMarcheForcee, boardUnits, aiColor);

    for (const { zoneId: adjZoneId, distance } of reachableEnemyZones) {
      const enemy = getEnemyEntry(boardUnits, adjZoneId, aiColor);
      if (!enemy) continue;
      if (attackCount < enemy.count) continue;
      const marcheForceeNeeded = Math.max(0, distance - attackBasePts);

      const ratio     = attackCount / Math.max(1, enemy.count);
      const isTemple  = TEMPLES.includes(adjZoneId);
      const isCity    = /^J\d+C\d+$/.test(adjZoneId) && !adjZoneId.startsWith(`J${joinOrder}`);
      const myCreature    = getCreatureInZone(fromZoneId, aiColor, gameState);
      const enemyCreature = getCreatureInZone(adjZoneId, enemy.color, gameState);
      // Zone protégée par une créature bloquante (Kraken, Cerbère) → inattaquable
      if (getCreaturePowerById(enemyCreature)?.blockEnemyEntry) continue;
      // Bouquetin adverse : coût d'entrée en ank, à payer en plus du combat
      const bouquetinCost = getCreaturePowerById(enemyCreature)?.attackerAnkCost ?? 0;
      if (bouquetinCost > 0 && ank < bouquetinCost) continue;
      const adjToEmpty    = hasEmptyTempleAdjacent(adjZoneId, boardUnits);

      let weight = 1 + AI_WEIGHTS.attack_base;
      if (ratio >= 2)       weight += AI_WEIGHTS.attack_ratio2to1;
      else if (ratio >= 1.5) weight += AI_WEIGHTS.attack_ratio1_5to1;
      else                   weight += AI_WEIGHTS.attack_ratio1to1;
      if (isTemple)          weight += AI_WEIGHTS.attack_temple;
      if (isCity)            weight += AI_WEIGHTS.attack_enemyCity;
      if (enemy.count === 1) weight += AI_WEIGHTS.attack_enemyAlone;
      if (attackCount >= 4)  weight += AI_WEIGHTS.attack_myUnits4plus;
      if (leaderColor && enemy.color === leaderColor) weight += AI_WEIGHTS.attack_leaderEnemy;
      if (myCreature)        weight += AI_WEIGHTS.attack_myCreature;
      if (hasStrongCombatCard(myState)) weight += AI_WEIGHTS.attack_myStrongCard;
      if (enemyCreature)     weight += AI_WEIGHTS.attack_enemyCreature;
      if (adjToEmpty)        weight += AI_WEIGHTS.attack_adjTemple;
      if (hasCombatTile)     weight += AI_WEIGHTS.attack_hasCombatTile;
      if (distance > 1)      weight -= (distance - 1) * 5; // légère préférence pour la cible la plus proche à mérite égal
      if (bouquetinCost > 0) weight -= bouquetinCost * 5; // coût d'entrée, dissuasion légère

      candidates.push({
        type: "attack", fromZoneId, toZoneId: adjZoneId, count: attackCount, weight,
        ...(marcheForceeNeeded > 0 && { marcheForceeUsed: marcheForceeNeeded }),
        ...(bouquetinCost > 0 && { bouquetinCost }),
      });

      // Force de base : unités + tuiles pouvoir + créature (annulations Serpent comprises)
      const enemyPid = allPlayers.find(p => p.color === enemy.color)?.id;
      const enemyTilesCombat = getPowerTileCombatBonus(
        gameState.players?.[enemyPid]?.ownedTileIds, false, POWER_TILES, disabledTilesAI
      );
      const myCreatP = getCreaturePowerById(myCreature);
      const enemyCreatP = getCreaturePowerById(enemyCreature);
      const myCreatForce = enemyCreatP?.nullifiesEnemy ? 0 : (myCreatP?.combatForce ?? 0);
      const enemyCreatForce = myCreatP?.nullifiesEnemy ? 0 : (enemyCreatP?.combatForce ?? 0);
      // Jetons JP des prêtres présents dans les zones concernées (force_attaque/
      // force_defense) — comme pour les tuiles et créatures, ils s'ajoutent à
      // l'estimation de force avant même de déclencher le combat.
      const myJpForce = getJpTokenCombatBonus(gameState.boardPriests, fromZoneId, aiColor, true).force;
      const enemyJpForce = getJpTokenCombatBonus(gameState.boardPriests, adjZoneId, enemy.color, false).force;
      const myBaseForce = attackCount + myTilesCombat.force + myCreatForce + myJpForce;
      const enemyBaseForce = enemy.count + enemyTilesCombat.force + enemyCreatForce + enemyJpForce;
      // Gouttes de sang potentielles adverses (tuiles + créature + jeton JP + ~2 d'une carte combat)
      const enemyJpBlood = getJpTokenCombatBonus(gameState.boardPriests, adjZoneId, enemy.color, false).blood;
      const enemyBloodPotential = enemyTilesCombat.blood + (enemyCreatP?.combatBlood ?? 0) + enemyJpBlood + 2;
      const forceFavorable = myBaseForce > enemyBaseForce && attackCount > enemyBloodPotential;
      if (forceFavorable) anyFavorableAttack = true;

      // Victoire facile : force de base supérieure (sans se faire décimer par le
      // sang) ou ratio écrasant — à jouer immédiatement, sans reporter l'attaque.
      const easyWin = forceFavorable || ratio >= 3 ||
        (ratio >= AI_WEIGHTS.plan_easyAttackRatio && (myCreature || hasCombatTile) && !enemyCreature);
      if (easyWin && (!bestEasyAttack || weight > bestEasyAttack.weight)) {
        bestEasyAttack = {
          type: "attack", fromZoneId, toZoneId: adjZoneId, count: attackCount, weight,
          ...(marcheForceeNeeded > 0 && { marcheForceeUsed: marcheForceeNeeded }),
          ...(bouquetinCost > 0 && { bouquetinCost }),
        };
      }
    }
  }

  // ── Achat de tuile ────────────────────────────────────────────────────────
  const myColors = getPlayerPyramidColors(aiPlayerId, pyramids);
  const hasCoutReduc = ownedTileIds.some(
    id => POWER_TILES.find(t => t.id === id)?.name === "Cout Pouvoir -1"
  );
  const colorToAction = { Rouge: "buy_red", Bleu: "buy_blue", Blanc: "buy_white", Noir: "buy_black" };
  const effectiveTileCost = t => Math.max(0, t.cost - (hasCoutReduc ? 1 : 0));

  // Filtres d'éligibilité indépendants du niveau de pyramide et de l'ank —
  // réutilisés par la planification (une tuile "désirée" doit rester légale).
  function isTileEligible(t) {
    if (!availableIds.includes(t.id)) return false;
    const ownedNames = ownedTileIds.map(id => POWER_TILES.find(x => x.id === id)?.name).filter(Boolean);
    if (ownedNames.includes(t.name)) return false;
    if (!myColors.includes(t.color)) return false;
    if (usedActions.includes(colorToAction[t.color])) return false;
    // Cerbère : uniquement pour sécuriser une troupe faible sans créature sur un temple
    const power = t.type === 'creature' ? CREATURE_POWERS[t.name] : null;
    if (power?.mustEquipOnPurchase &&
        !aiFindCerbereTarget(aiColor, boardUnits, gameState.creatureAssignments || {})) return false;
    // Un seul "Point Majeur" (type vp) par joueur
    if (t.type === 'vp' && ownedTileIds.some(id => POWER_TILES.find(x => x.id === id)?.type === 'vp')) return false;
    // Un seul "Jeton gris" par joueur
    if (isGrayTokenTile(t) && ownedTileIds.some(id => isGrayTokenTile(POWER_TILES.find(x => x.id === id)))) return false;
    return true;
  }

  // Score d'une tuile (heuristiques + notes DB) — partagé entre achat immédiat et plans
  function scoreBuyTile(tile) {
      const noTileInColor = !ownedTileIds.some(
        id => POWER_TILES.find(t2 => t2.id === id)?.color === tile.color
      );
      const hasNoCombatTile = !ownedTileIds.some(id => {
        const t2 = POWER_TILES.find(t3 => t3.id === id);
        return t2?.type === 'combat' || t2?.type === 'creature';
      });

      let weight = 1;
      if (tile.type === 'creature')                                      weight += AI_WEIGHTS.buy_creature;
      if ((tile.vpOnPurchase ?? 0) > 0)                                  weight += AI_WEIGHTS.buy_vpImmediate;
      if (tile.type === 'combat')                                         weight += AI_WEIGHTS.buy_combat;
      if (hasNoCombatTile && (tile.type === 'combat' || tile.type === 'creature')) weight += AI_WEIGHTS.buy_noCombatTile;
      // Aucune attaque favorable en force de base → se renforcer avec des tuiles de force
      if (!anyFavorableAttack && (tile.type === 'combat' || tile.type === 'creature')) weight += AI_WEIGHTS.buy_reinforceWhenWeak;
      if (tile.type === 'movement')                                       weight += AI_WEIGHTS.buy_movement;
      if (tile.level >= 3)                                                weight += AI_WEIGHTS.buy_level3;
      if (noTileInColor)                                                  weight += AI_WEIGHTS.buy_noTileInColor;
      if (ownedTileIds.length < 2)                                        weight += AI_WEIGHTS.buy_fewTiles;
      if (ank >= 7)                                                       weight += AI_WEIGHTS.buy_richEnough;

      // ── Score DB : note individuelle (début/fin pondérées par la temporalité) ──
      const tileData = tileRatings[tile.id];
      if (tileData) {
        const re = tileData.ratingEarly ?? 3;
        const rl = tileData.ratingLate ?? 3;
        const temp = tileData.temporality ?? 3;
        // tempBlend: 0 = ignore timing, 1 = fully use timing
        const tempBlend = (temp - 1) / 4;
        const neutralBase = (re + rl) / 2;
        const timedBase = re * (1 - gameProgress) + rl * gameProgress;
        const baseScore = neutralBase + (timedBase - neutralBase) * tempBlend;
        // delta from neutral 3 → negative penalises bad tiles, positive rewards good tiles
        weight += (baseScore - 3) * AI_WEIGHTS.buy_dbTileScale;
      }

      // ── Score DB : synergies avec les tuiles possédées (cumulées, bornées) ──
      // Somme des écarts à 3 : plusieurs bonnes synergies s'additionnent au lieu
      // d'être diluées dans une moyenne ; les combos non notées (3) sont neutres.
      let ownedComboBonus = 0;
      for (const ownedId of ownedTileIds) {
        const combo = tileCombinations[[tile.id, ownedId].sort().join('-')];
        if (!combo) continue;
        ownedComboBonus += ((combo.rating ?? 3) - 3) * AI_WEIGHTS.buy_dbComboScale;
      }
      weight += Math.max(-AI_WEIGHTS.buy_dbComboCap, Math.min(AI_WEIGHTS.buy_dbComboCap, ownedComboBonus));

      // ── Score DB : synergies futures (combos notées avec des tuiles encore
      // achetables). priorityTile départage : si la combo dit d'acheter l'autre
      // tuile en premier, le potentiel de celle-ci est atténué.
      let potentialBonus = 0;
      for (const otherId of availableIds) {
        if (otherId === tile.id) continue;
        const other = POWER_TILES.find(t => t.id === otherId);
        if (!other || !myColors.includes(other.color)) continue;
        const combo = tileCombinations[[tile.id, otherId].sort().join('-')];
        if (!combo) continue;
        const delta = (combo.rating ?? 3) - 3;
        if (delta <= 0) continue; // seules les bonnes synergies futures comptent
        const isPriority = (combo.priorityTile ?? 1) === (combo.id1 === tile.id ? 1 : 2);
        potentialBonus += delta * AI_WEIGHTS.buy_dbPotentialScale * (isPriority ? 1 : AI_WEIGHTS.buy_dbPriorityFactor);
      }
      weight += Math.min(AI_WEIGHTS.buy_dbPotentialCap, potentialBonus);

      return weight;
  }

  // Candidats d'achat immédiat (tuile payable et niveau de pyramide atteint)
  if (ank >= 5) {
    const buyable = POWER_TILES.filter(t => {
      if (!isTileEligible(t)) return false;
      if (getPlayerPyramidLevel(aiPlayerId, t.color, pyramids) < t.level) return false;
      if (t.secondaryColor && getPlayerPyramidLevel(aiPlayerId, t.secondaryColor, pyramids) < t.secondaryLevel) return false;
      return ank >= effectiveTileCost(t);
    });
    for (const tile of buyable) {
      candidates.push({ type: colorToAction[tile.color] || "buy_red", tileId: tile.id, weight: scoreBuyTile(tile) });
    }
  }

  // ── Recrutement ───────────────────────────────────────────────────────────
  if (unitsReserve > 0 && joinOrder && ank >= 1 && !usedActions.includes('recruit')) {
    const cityZoneIds = BOARD_ZONES.filter(z => z.id.startsWith(`J${joinOrder}C`)).map(z => z.id);
    const hasSpace = cityZoneIds.some(zId => (boardUnits[zId]?.[aiColor] || 0) < MAX_UNITS_PER_ZONE);
    const completeTroops = Object.values(boardUnits).filter(z => (z?.[aiColor] || 0) >= MAX_UNITS_PER_ZONE).length;
    // Déjà 2 troupes complètes (ou plus) → recruter ne ferait qu'éparpiller des unités inutiles.
    if (hasSpace && completeTroops < 2) {
      const myTotalOnBoard = Object.values(boardUnits).reduce((s, z) => s + (z?.[aiColor] || 0), 0);
      const hasPartialTroop = Object.values(boardUnits).some(z => {
        const n = z?.[aiColor] || 0;
        return n > 0 && n < MAX_UNITS_PER_ZONE;
      });
      let weight = 1;
      if (unitsReserve >= 3)    weight += AI_WEIGHTS.recruit_bigReserve;
      if (myTotalOnBoard < 5)   weight += AI_WEIGHTS.recruit_fewOnBoard;
      if (ank >= 3)             weight += AI_WEIGHTS.recruit_richEnough;
      if (completeTroops === 0) weight += AI_WEIGHTS.recruit_noCompleteTroop;
      else                      weight += AI_WEIGHTS.recruit_oneCompleteTroop;
      if (hasPartialTroop)      weight += AI_WEIGHTS.recruit_completePartial;
      // Troupe incomplète dans la cité (ou n'importe où avec Recrutement Local) →
      // recruter au plus vite pour la compléter
      const hasRecrutLocal = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Recrutement Local");
      const incompleteInCity = cityZoneIds.some(zId => {
        const n = boardUnits[zId]?.[aiColor] || 0;
        return n > 0 && n < MAX_UNITS_PER_ZONE;
      });
      if (incompleteInCity || (hasRecrutLocal && hasPartialTroop)) weight += AI_WEIGHTS.recruit_incompleteInCity;
      candidates.push({ type: "recruit", weight });
    }
  }

  // ── Déplacement (move1 et move2) ─────────────────────────────────────────
  // move1 et move2 sont fonctionnellement identiques mais utilisent des slots différents.
  // L'IA doit idéalement utiliser les deux. Pénalité en début de tour, bonus si l'autre est déjà fait.
  const myTemples = countMyTemples(aiColor, boardUnits);
  const aiOrder = aiPlayer?.order ?? 0;
  const isLastToPlay = allPlayers.every(p => p.id === aiPlayerId || (p.order ?? 0) <= aiOrder);
  const hasOnlyOneGroup = myZones.length === 1;
  const move1Used = usedActions.includes('move1');
  const move2Used = usedActions.includes('move2');

  // Pénalité à partir du jeton 3 : réserve les jetons 2 et 1 pour les déplacements
  const extraTokens = Math.max(0, tokensLeft - 2);
  const moveEarlyPenalty = extraTokens * AI_WEIGHTS.move_earlyPenalty;
  // Sur le dernier jeton, forcer l'utilisation du déplacement manquant
  const isLastToken = tokensLeft === 1;
  // Chaque action de déplacement avance aussi un prêtre : valeur estimée du
  // meilleur pas Ta-Seti disponible (ank, PV, jetons…), ajoutée aux candidats.
  const tasetiMoveValue = canAdvancePriest
    ? Math.max(AI_WEIGHTS.move_priestAdvance / 3, estimateTasetiMoveValue(gameState, aiPlayerId))
    : 0;

  for (const moveType of ['move1', 'move2']) {
    if (moveType === 'move1' && move1Used) continue;
    if (moveType === 'move2' && move2Used) continue;

    // Bonus si le type complémentaire est déjà utilisé (encourage à faire les deux)
    const complementUsed = moveType === 'move1' ? move2Used : move1Used;
    const preferBothBonus = complementUsed ? AI_WEIGHTS.move_preferBoth : 0;
    // Bonus fort sur le dernier jeton pour ne pas le gaspiller sur une autre action
    const lastTokenBonus = isLastToken ? AI_WEIGHTS.move_lastToken : 0;

    for (const fromZoneId of myZones) {
      // Créature immobile (Kraken, Cerbère) : garder le minimum d'unités requis sur place
      const myCreaturePower = getCreaturePowerById(gameState?.creatureAssignments?.[fromZoneId]?.[aiColor]);
      const minKeep = myCreaturePower?.immovable ? (myCreaturePower.minUnitsInZone ?? 0) : 0;
      const myUnits = (boardUnits[fromZoneId]?.[aiColor] || 0) - minKeep;
      if (myUnits < 1) continue;

      // Points de déplacement propres à cette troupe (bonus de créature + jeton
      // JP_capacite_deplacement local inclus, ex: Scarabée +2)
      const movePtsHere = computeMaxMovePoints(aiPlayerId, gameState, fromZoneId);
      // Marche Forcée en main : portée potentielle si la carte est jouée (voir plus bas)
      const marcheForceeHere = getMarcheForceeAvailable(aiPlayerId, gameState);

      const sourceIsTemple = TEMPLES.includes(fromZoneId);
      const reachableEmptyTemples = (sourceIsTemple && isLastToPlay && hasOnlyOneGroup)
        ? getReachableEmptyTemples(fromZoneId, movePtsHere, boardUnits, aiColor)
        : [];
      const canSplitForTemple = reachableEmptyTemples.length > 0;

      const reachableZones = getReachableZonesForMove(fromZoneId, movePtsHere + marcheForceeHere, boardUnits, aiColor);

      for (const { zoneId: adjZoneId, distance } of reachableZones) {
        const marcheForceeNeededMove = Math.max(0, distance - movePtsHere);
        const adjUnits = boardUnits[adjZoneId] || {};
        const existingFriendly = adjUnits[aiColor] || 0;

        const destIsEmptyTemple = TEMPLES.includes(adjZoneId) && !Object.values(adjUnits).some(n => n > 0);
        const keepBack = (canSplitForTemple && destIsEmptyTemple) ? 1 : 0;

        const intendedMove = myUnits - keepBack;
        // Plafond de zone : Légion (+2 partout), Bouliste (7 fixe), JP_legion (+2 localisé)
        const zoneMax = getZoneMaxUnits(adjZoneId, aiColor, gameState.creatureAssignments, gameState.players, POWER_TILES, null, MAX_UNITS_PER_ZONE, gameState.boardPriests);
        const canAdd = Math.min(intendedMove, zoneMax - existingFriendly);
        if (canAdd <= 0) continue;

        const isTemple   = TEMPLES.includes(adjZoneId);
        const zoneEmpty  = !Object.values(adjUnits).some(n => n > 0);
        // Bonus "tremplin vers un temple vide" : seulement si ce temple n'est pas
        // directement atteignable dans ce déplacement — sinon autant y aller franchement.
        const reachableSet = new Set(reachableZones.map(z => z.zoneId));
        const adjToEmpty = (ZONE_ADJACENCY[adjZoneId] || []).some(z =>
          TEMPLES.includes(z) &&
          !Object.values(boardUnits[z] || {}).some(n => n > 0) &&
          !reachableSet.has(z)
        );
        const newTemple  = isTemple && zoneEmpty ? 1 : 0;
        const wouldControl2 = (myTemples + newTemple) >= 2;

        // Opportunité d'attaque depuis la zone cible (ennemi faible = ratio >= 1.5:1)
        const unitsAfterMove = existingFriendly + canAdd;
        const hasAttackOpportunity = (ZONE_ADJACENCY[adjZoneId] || []).some(adj2 => {
          const enemy2 = getEnemyEntry(boardUnits, adj2, aiColor);
          return enemy2 && unitsAfterMove >= enemy2.count * 1.5;
        });

        // Une cible n'a de valeur stratégique que si elle rapproche d'un temple,
        // permet de renforcer/attaquer, ou de contrôler 2 temples. Un désert vide
        // sans aucun de ces atouts est une mauvaise destination (cf. règles IA).
        // NB: canAdvancePriest est volontairement exclu — c'est un bonus global
        // (vrai dès qu'un prêtre a un coup jouable, peu importe la destination),
        // déjà crédité séparément via tasetiMoveValue ; l'inclure ici neutralisait
        // la pénalité désert sur quasi tous les tours.
        const hasStrategicValue = (isTemple && zoneEmpty) || adjToEmpty
          || existingFriendly > 0 || wouldControl2 || hasAttackOpportunity;
        const isEmptyDesert = zoneEmpty && !isTemple && !hasStrategicValue;

        let weight = 1 + moveEarlyPenalty;
        // Les bonus "utiliser les deux déplacements" / "dernier jeton" ne doivent pas
        // forcer l'IA à se rendre sur une destination sans intérêt.
        if (!isEmptyDesert) weight += preferBothBonus + lastTokenBonus;
        if (isTemple && zoneEmpty) weight += AI_WEIGHTS.move_emptyTemple;
        if (adjToEmpty)            weight += AI_WEIGHTS.move_adjacentTemple;
        weight += tasetiMoveValue;
        if (existingFriendly > 0)  weight += AI_WEIGHTS.move_reinforce;
        if (wouldControl2)         weight += AI_WEIGHTS.move_control2temples;
        if (hasAttackOpportunity)  weight += AI_WEIGHTS.move_towardAttack;
        if (isEmptyDesert)         weight += AI_WEIGHTS.move_emptyDesert;

        if (weight > 0) {
          candidates.push({
            type: moveType, sourceZoneId: fromZoneId, targetZoneId: adjZoneId, count: canAdd, weight,
            ...(marcheForceeNeededMove > 0 && { marcheForceeUsed: marcheForceeNeededMove }),
          });
        }
      }
    }
  }

  // ── Téléportation vers un temple inaccessible normalement (vide OU ennemi) ──
  // La téléportation suit les mêmes règles qu'un déplacement normal : si la
  // cible est occupée par un adversaire, elle déclenche un combat. Un temple
  // ennemi faiblement défendu et hors de portée normale est souvent une
  // meilleure cible qu'un temple vide (gain de combat + retrait d'un temple
  // adverse + prise de contrôle), donc les deux cas doivent être évalués.
  const hasFreeAnyTeleport = myState.pendingFreeAnyTeleport ?? false;
  const rawTeleportCost = computeAITeleportCost(myState);
  const effectiveTeleportCost = hasFreeAnyTeleport ? 0 : rawTeleportCost;

  if (ank >= effectiveTeleportCost) {
    for (const moveType of ['move1', 'move2']) {
      if (moveType === 'move1' && move1Used) continue;
      if (moveType === 'move2' && move2Used) continue;

      const complementUsed = moveType === 'move1' ? move2Used : move1Used;
      const preferBothBonus = complementUsed ? AI_WEIGHTS.move_preferBoth : 0;
      const lastTokenBonusTele = isLastToken ? AI_WEIGHTS.move_lastToken : 0;

      for (const fromZoneId of myZones) {
        const myUnits = boardUnits[fromZoneId]?.[aiColor] || 0;
        if (myUnits < 1) continue;

        const movePtsHereTele = computeMaxMovePoints(aiPlayerId, gameState, fromZoneId);
        // Inclut Marche Forcée dans la portée "gratuite" : si une carte (coût 0)
        // suffit à atteindre la cible, pas besoin de payer une téléportation (Ank).
        const reachableNormal = new Set(
          getReachableZonesForMove(fromZoneId, movePtsHereTele + getMarcheForceeAvailable(aiPlayerId, gameState), boardUnits, aiColor)
            .map(z => z.zoneId)
        );

        for (const teleTarget of TELEPORT_TARGETS) {
          if (reachableNormal.has(teleTarget)) continue; // déjà accessible sans payer
          if (!TEMPLES.includes(teleTarget)) continue;   // uniquement les temples

          const enemyTele = getEnemyEntry(boardUnits, teleTarget, aiColor);

          if (enemyTele) {
            // Téléportation offensive : attaquer un temple ennemi hors de portée normale
            if (myUnits < 2) continue;
            const enemyCreatureTele = getCreatureInZone(teleTarget, enemyTele.color, gameState);
            if (getCreaturePowerById(enemyCreatureTele)?.blockEnemyEntry) continue;
            // Bouquetin adverse : coût d'entrée en ank, en plus du coût de téléportation
            const bouquetinCostTele = getCreaturePowerById(enemyCreatureTele)?.attackerAnkCost ?? 0;
            if (bouquetinCostTele > 0 && ank < effectiveTeleportCost + bouquetinCostTele) continue;
            const attackCount = Math.min(myUnits - 1, 5);
            if (attackCount < enemyTele.count) continue;

            const ratio = attackCount / Math.max(1, enemyTele.count);
            const myCreatureTele = getCreatureInZone(fromZoneId, aiColor, gameState);

            let weight = 1 + AI_WEIGHTS.attack_base;
            if (ratio >= 2)       weight += AI_WEIGHTS.attack_ratio2to1;
            else if (ratio >= 1.5) weight += AI_WEIGHTS.attack_ratio1_5to1;
            else                   weight += AI_WEIGHTS.attack_ratio1to1;
            weight += AI_WEIGHTS.attack_temple; // TELEPORT_TARGETS ne contient que des temples
            if (enemyTele.count === 1) weight += AI_WEIGHTS.attack_enemyAlone;
            if (attackCount >= 4)  weight += AI_WEIGHTS.attack_myUnits4plus;
            if (leaderColor && enemyTele.color === leaderColor) weight += AI_WEIGHTS.attack_leaderEnemy;
            if (myCreatureTele)    weight += AI_WEIGHTS.attack_myCreature;
            if (hasStrongCombatCard(myState)) weight += AI_WEIGHTS.attack_myStrongCard;
            if (enemyCreatureTele) weight += AI_WEIGHTS.attack_enemyCreature;
            if (hasCombatTile)     weight += AI_WEIGHTS.attack_hasCombatTile;
            weight += effectiveTeleportCost * AI_WEIGHTS.teleport_ankPenalty;
            if (bouquetinCostTele > 0) weight -= bouquetinCostTele * 5;

            if (weight > 0) {
              candidates.push({
                type: "attack",
                fromZoneId,
                toZoneId: teleTarget,
                count: attackCount,
                weight,
                isTeleport: true,
                teleportCost: effectiveTeleportCost,
                ...(bouquetinCostTele > 0 && { bouquetinCost: bouquetinCostTele }),
              });
            }
            continue;
          }

          const adjUnits = boardUnits[teleTarget] || {};
          if (Object.values(adjUnits).some(n => n > 0)) continue; // temple non vide (allié déjà dessus)

          const existingFriendly = adjUnits[aiColor] || 0;
          const zoneMaxTele = getZoneMaxUnits(teleTarget, aiColor, gameState.creatureAssignments, gameState.players, POWER_TILES, null, MAX_UNITS_PER_ZONE, gameState.boardPriests);
          const canAdd = Math.min(myUnits, zoneMaxTele - existingFriendly);
          if (canAdd <= 0) continue;

          const wouldControl2 = (myTemples + 1) >= 2;

          let weight = 1 + moveEarlyPenalty + preferBothBonus + lastTokenBonusTele + tasetiMoveValue;
          weight += AI_WEIGHTS.move_emptyTemple;
          if (wouldControl2) weight += AI_WEIGHTS.move_control2temples;
          weight += effectiveTeleportCost * AI_WEIGHTS.teleport_ankPenalty;

          if (weight > 0) {
            candidates.push({
              type: moveType,
              sourceZoneId: fromZoneId,
              targetZoneId: teleTarget,
              count: canAdd,
              weight,
              isTeleport: true,
              teleportCost: effectiveTeleportCost,
            });
          }
        }
      }
    }
  }

  // ── Amélioration de pyramide ──────────────────────────────────────────────
  const pyramidAlreadyUsed = usedActions.includes('upgradePyramid') || usedActions.includes('pyramid');
  if (!pyramidAlreadyUsed && (myState.tokens ?? 5) >= 1) {
    const myPyramids = Object.entries(pyramids)
      .filter(([, p]) => p.controllerId === aiPlayerId)
      .map(([slotId, p]) => ({ slotId, ...p }));

    for (const pyr of myPyramids) {
      const from = pyr.level ?? 0;
      if (from >= 4) continue;
      const to   = from + 1;
      const rawCost = (to * (to + 1)) / 2 - (from * (from + 1)) / 2;
      const hasReductionPyramideCand = ownedTileIds.some(
        id => POWER_TILES.find(t => t.id === id)?.name === "Réduction pyramide"
      );
      const hasAnkReducPyrCand = ownedTileIds.some(
        id => POWER_TILES.find(t => t.id === id)?.name === "Réduction d'ank"
      );
      const cost = Math.max(0, rawCost - (hasReductionPyramideCand ? (to - from) : 0) - (hasAnkReducPyrCand ? 1 : 0));
      if (ank < cost) continue;

      const noTilesInColor = !ownedTileIds.some(
        id => POWER_TILES.find(t => t.id === id)?.color === pyr.color
      );
      let weight = 1;
      if (to === 2) weight += AI_WEIGHTS.pyramid_toLevel2;
      else if (to === 3) weight += AI_WEIGHTS.pyramid_toLevel3;
      else if (to === 4) weight += AI_WEIGHTS.pyramid_toLevel4;
      if (noTilesInColor) weight += AI_WEIGHTS.pyramid_noTiles;
      if (ank >= 8)       weight += AI_WEIGHTS.pyramid_ank8plus;

      candidates.push({ type: "upgradePyramid", slotId: pyr.slotId, targetLevel: to, color: pyr.color, weight });
    }
  }

  // ── Planification générique sur 3 coups (revue à chaque tour) ────────────
  // Simule l'état des ressources (ank, cases d'action, pyramides, boutique) et
  // cherche la meilleure séquence de `planDepth` actions parmi TOUTES les
  // familles : prière, pyramide, achat, recrutement, déplacement, attaque.
  // Seul le premier pas est exécuté ; le plan est recalculé au tour suivant.
  const planDepth = Math.max(1, Math.min(3, tokensLeft));
  const bestOf = type => candidates.filter(c => c.type === type).sort((a, b) => b.weight - a.weight)[0] ?? null;
  const bestMoveCand   = [bestOf('move1'), bestOf('move2')].filter(Boolean).sort((a, b) => b.weight - a.weight)[0] ?? null;
  const bestAttackCand = bestOf('attack');
  const recruitCand    = bestOf('recruit');

  const prayerBonusCount = ownedTileIds.filter(id => POWER_TILES.find(t => t.id === id)?.name === "Priere +1 ank").length;
  const hasDayAnkTile = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "+1 d'Ank en journée");
  const prayerGainOf = base => base + prayerBonusCount + (hasDayAnkTile ? 1 : 0);
  const triCostRaw = (from, to) => (to * (to + 1)) / 2 - (from * (from + 1)) / 2;
  const hasReductionPyramidePlan = ownedTileIds.some(
    id => POWER_TILES.find(t => t.id === id)?.name === "Réduction pyramide"
  );
  const hasAnkReducPyrPlan = ownedTileIds.some(
    id => POWER_TILES.find(t => t.id === id)?.name === "Réduction d'ank"
  );
  const triCost = (from, to) => Math.max(0, triCostRaw(from, to)
    - (hasReductionPyramidePlan ? (to - from) : 0)
    - (hasAnkReducPyrPlan ? 1 : 0));

  // Pyramides contrôlées améliorables + tuiles légales (pré-calculées pour la recherche)
  const myPyrSlots = Object.entries(pyramids)
    .filter(([, p]) => p.controllerId === aiPlayerId && (p.level ?? 0) < 4)
    .map(([slotId, p]) => ({ slotId, color: p.color, level: p.level ?? 0 }));
  const scoreCache = new Map();
  const scoreTileCached = tile => {
    if (!scoreCache.has(tile.id)) scoreCache.set(tile.id, scoreBuyTile(tile));
    return scoreCache.get(tile.id);
  };
  const eligibleTiles = POWER_TILES.filter(t => {
    if (!isTileEligible(t)) return false;
    if (t.secondaryColor && getPlayerPyramidLevel(aiPlayerId, t.secondaryColor, pyramids) < t.secondaryLevel) return false;
    return true;
  });

  // Recherche en profondeur : retourne { score, steps }
  function planSearch(state, depth) {
    if (depth === 0) return { score: 0, steps: [] };
    let best = { score: 0, steps: [] };
    const options = [];
    const lateFactor = state.isFirst ? 1 : AI_WEIGHTS.plan_lateActionMalus;

    // Prières (chaque case une fois par jour) — valeur propre faible,
    // leur intérêt vient de ce qu'elles financent dans la suite du plan
    for (const [type, base, label] of [['prayer2', 2, 'prière niv.2'], ['prayer3', 2, 'prière niv.3']]) {
      if (state.used.has(type) || state.ank >= 11) continue;
      options.push({
        step: { type, label },
        value: (bestOf(type)?.weight ?? 1) * 0.4,
        apply: s => ({ ...s, ank: Math.min(11, s.ank + prayerGainOf(base)), used: new Set(s.used).add(type) }),
      });
    }

    // Pyramide (une action par jour, saut multi-niveaux possible)
    if (!state.used.has('pyramid')) {
      for (const pyr of myPyrSlots) {
        const from = state.pyr[pyr.slotId] ?? pyr.level;
        for (let to = from + 1; to <= 4; to++) {
          const cost = triCost(from, to);
          if (cost > state.ank) break;
          let v = 1 + (to - from - 1) * 10;
          if (to === 2) v += AI_WEIGHTS.pyramid_toLevel2;
          else if (to === 3) v += AI_WEIGHTS.pyramid_toLevel3;
          else if (to === 4) v += AI_WEIGHTS.pyramid_toLevel4;
          options.push({
            step: { type: 'upgradePyramid', slotId: pyr.slotId, targetLevel: to, color: pyr.color, label: `pyramide ${pyr.color}→${to}` },
            value: v,
            apply: s => ({ ...s, ank: s.ank - cost, used: new Set(s.used).add('pyramid'), pyr: { ...s.pyr, [pyr.slotId]: to } }),
          });
        }
      }
    }

    // Achats (une couleur par jour ; niveau de pyramide simulé par le plan)
    for (const tile of eligibleTiles) {
      if (state.bought.has(tile.id)) continue;
      const action = colorToAction[tile.color];
      if (state.used.has(action)) continue;
      const lvlNow = Math.max(
        getPlayerPyramidLevel(aiPlayerId, tile.color, pyramids),
        ...myPyrSlots.filter(p => p.color === tile.color).map(p => state.pyr[p.slotId] ?? 0)
      );
      if (lvlNow < tile.level) continue;
      const cost = effectiveTileCost(tile);
      if (cost > state.ank) continue;
      options.push({
        step: { type: action, tileId: tile.id, label: `achat ${tile.name}` },
        value: scoreTileCached(tile) * (state.isFirst ? 1 : AI_WEIGHTS.plan_lateBuyMalus),
        apply: s => ({ ...s, ank: s.ank - cost, used: new Set(s.used).add(action), bought: new Set(s.bought).add(tile.id) }),
      });
    }

    // Recrutement (case unique)
    if (recruitCand && !state.used.has('recruit') && state.ank >= 1) {
      options.push({
        step: { type: 'recruit', label: 'recrutement' },
        value: recruitCand.weight,
        apply: s => ({ ...s, ank: Math.max(0, s.ank - 2), used: new Set(s.used).add('recruit') }),
      });
    }

    // Déplacement (2 cases équivalentes) — valeur du meilleur candidat actuel,
    // décotée si planifiée pour plus tard (le plateau aura changé)
    if (bestMoveCand) {
      const mv = !state.used.has('move1') ? 'move1' : (!state.used.has('move2') ? 'move2' : null);
      if (mv) {
        options.push({
          step: { type: mv, label: 'déplacement' },
          value: Math.max(0, bestMoveCand.weight) * lateFactor,
          apply: s => ({ ...s, used: new Set(s.used).add(mv) }),
        });
      }
    }

    // Attaque — pleine valeur au premier coup uniquement
    if (bestAttackCand && !state.used.has('attack')) {
      options.push({
        step: { type: 'attack', label: 'attaque' },
        value: Math.max(0, bestAttackCand.weight) * lateFactor,
        apply: s => ({ ...s, used: new Set(s.used).add('attack') }),
      });
    }

    for (const opt of options) {
      const sub = planSearch({ ...opt.apply(state), isFirst: false }, depth - 1);
      const total = opt.value + AI_WEIGHTS.plan_stepDiscount * sub.score;
      if (total > best.score) best = { score: total, steps: [opt.step, ...sub.steps] };
    }
    return best;
  }

  const initialUsed = new Set(usedActions);
  if (usedActions.includes('upgradePyramid')) initialUsed.add('pyramid');
  const plan = planSearch({ ank, used: initialUsed, pyr: {}, bought: new Set(), isFirst: true }, planDepth);

  // ── Sélection de la carte ID à jouer gratuitement avec l'action ──────────
  const idCardToPlay = selectBestDayIdCard(myState, boardUnits, aiColor, gameState);

  // Victoire facile : attaque immédiate, prioritaire sur tout plan
  if (bestEasyAttack) {
    const dec = { ...bestEasyAttack, planNote: "victoire facile → attaque immédiate" };
    return idCardToPlay ? { ...dec, idCardToPlay } : dec;
  }

  // Exécute le premier pas du meilleur plan ; les pas de plateau sont résolus
  // avec le meilleur candidat concret du moment.
  function stepToDecision(step) {
    switch (step.type) {
      case 'prayer2':
      case 'prayer3':
      case 'recruit':
        return { type: step.type };
      case 'upgradePyramid':
        return { type: 'upgradePyramid', slotId: step.slotId, targetLevel: step.targetLevel, color: step.color };
      case 'move1':
      case 'move2':
        return bestMoveCand ? { ...bestMoveCand, type: step.type } : null;
      case 'attack':
        return bestAttackCand;
      default:
        return step.tileId ? { type: step.type, tileId: step.tileId } : null;
    }
  }

  let decision = null;
  if (plan.steps.length > 0) {
    const dec = stepToDecision(plan.steps[0]);
    if (dec) {
      decision = {
        ...dec,
        planNote: `PLAN ${plan.steps.length} coup${plan.steps.length > 1 ? "s" : ""} : ${plan.steps.map(s => s.label).join(' → ')}`,
      };
    }
  }
  // Filet de sécurité : aucun plan → ancien tirage pondéré
  if (!decision) decision = weightedSelect(candidates) ?? { type: "endTurn" };

  // ── Jeton doré : bonus gratuit (aucun jeton d'action ni case consommés) ────
  // Toutes les tuiles "jeton doré" d'un joueur partagent un seul usage par jour
  // (goldenTokenUsed) et sont bloquées le tour de leur achat (goldenBuyBlockedThisTurn).
  // Chaque variante est évaluée avec les mêmes pondérations que son équivalent
  // normal, et la meilleure est attachée à la décision principale comme bonus
  // (même mécanisme que idCardToPlay), qu'elle soit ou non de même type.
  let goldenAction = null;
  if (!myState.goldenTokenUsed && !myState.goldenBuyBlockedThisTurn) {
    const goldenOptions = [];

    const hasGoldenPrayer = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Jeton doré priére");
    if (hasGoldenPrayer && ank < 11) {
      const gain = prayerGainOf(2);
      goldenOptions.push({ type: "golden_prayer", weight: (bestOf('prayer2')?.weight ?? 1) * 0.4 + gain });
    }

    const hasGoldenMove  = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Déplacement Passe/Muraille");
    const hasGoldenMove3 = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Jeton Doré Déplacement");
    if ((hasGoldenMove || hasGoldenMove3) && bestMoveCand) {
      goldenOptions.push({ type: "golden_move", ...bestMoveCand, wallPass: hasGoldenMove, weight: bestMoveCand.weight });
    }

    const hasGoldenRecruit = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Jeton doré déplacement recrutement");
    if (hasGoldenRecruit && unitsReserve > 0 && joinOrder) {
      const hasRecrutLocalG = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Recrutement Local");
      const cityZoneIdsG = BOARD_ZONES.filter(z => z.id.startsWith(`J${joinOrder}C`) || (hasRecrutLocalG && (boardUnits[z.id]?.[aiColor] || 0) > 0)).map(z => z.id);
      const hasFree2 = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Recrutement + 2");
      const hasSpaceG = cityZoneIdsG.some(zId => {
        const max = getZoneMaxUnits(zId, aiColor, gameState.creatureAssignments || {}, gameState.players || {}, POWER_TILES, null, MAX_UNITS_PER_ZONE, gameState.boardPriests || {});
        return (boardUnits[zId]?.[aiColor] || 0) < max;
      });
      // Gratuit si "Recrutement + 2" (2 premières unités), sinon coûte 1 ank/unité comme un recrutement normal.
      if (hasSpaceG && (hasFree2 || ank >= 1)) {
        goldenOptions.push({ type: "golden_recruit", weight: (recruitCand?.weight ?? 1) * 0.8 });
      }
    }

    const hasGoldenBuy = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Jeton doré achat *2");
    if (hasGoldenBuy) {
      const hasAnkReducG = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Réduction d'ank");
      const boughtColorsTodayAI = usedActions.filter(a => a.startsWith("buy_"));
      const secondBuyTiles = POWER_TILES.filter(t => {
        if (!boughtColorsTodayAI.includes(colorToAction[t.color])) return false;
        if (!availableIds.includes(t.id)) return false;
        const ownedNames = ownedTileIds.map(id => POWER_TILES.find(x => x.id === id)?.name).filter(Boolean);
        if (ownedNames.includes(t.name)) return false;
        if (getPlayerPyramidLevel(aiPlayerId, t.color, pyramids) < t.level) return false;
        if (t.secondaryColor && getPlayerPyramidLevel(aiPlayerId, t.secondaryColor, pyramids) < t.secondaryLevel) return false;
        const power = t.type === 'creature' ? CREATURE_POWERS[t.name] : null;
        if (power?.mustEquipOnPurchase && !aiFindCerbereTarget(aiColor, boardUnits, gameState.creatureAssignments || {})) return false;
        if (t.type === 'vp' && ownedTileIds.some(id => POWER_TILES.find(x => x.id === id)?.type === 'vp')) return false;
        if (isGrayTokenTile(t) && ownedTileIds.some(id => isGrayTokenTile(POWER_TILES.find(x => x.id === id)))) return false;
        const cost = Math.max(0, t.cost + 1 - (hasCoutReduc ? 1 : 0) - (hasAnkReducG ? 1 : 0));
        return ank >= cost;
      });
      const bestSecondBuy = secondBuyTiles.map(t => ({ tile: t, weight: scoreTileCached(t) })).sort((a, b) => b.weight - a.weight)[0];
      if (bestSecondBuy) {
        goldenOptions.push({ type: "golden_buy", tileId: bestSecondBuy.tile.id, weight: bestSecondBuy.weight });
      }
    }

    goldenAction = goldenOptions.sort((a, b) => b.weight - a.weight)[0] ?? null;
  }

  if (goldenAction) decision = { ...decision, goldenAction };
  if (decision.type === "endTurn" || !idCardToPlay) return decision;
  return { ...decision, idCardToPlay };
}

// ─── Combat : sélection des cartes combat ────────────────────────────────────
// availableCards        : IDs des cartes combat disponibles pour l'IA
// opponentAvailableCards : IDs des cartes combat disponibles pour l'adversaire
export function aiChooseCombatCards(availableCards, opponentAvailableCards = []) {
  if (availableCards.length < 2) return null;

  // Potentiel maximal de l'adversaire (sang et boucliers)
  const oppCards = opponentAvailableCards.length > 0 ? opponentAvailableCards : [1,2,3,4,5,6,7,8];
  const opponentMaxBlood   = Math.max(0, ...oppCards.map(id => COMBAT_CARDS.find(c => c.id === id)?.blood   ?? 0));
  const opponentHasBlood   = opponentMaxBlood >= 2;

  // Force et sang maximaux disponibles pour l'IA
  const myMaxForce = Math.max(...availableCards.map(id => COMBAT_CARDS.find(c => c.id === id)?.force ?? 0));
  const myMaxBlood = Math.max(...availableCards.map(id => COMBAT_CARDS.find(c => c.id === id)?.blood ?? 0));

  // Sélection de la carte à jouer :
  // Par défaut → carte avec la force la plus élevée ou les plus de gouttes de sang.
  // Contre un adversaire avec des cartes sang → préférer boucliers ou force.
  const playChoices = availableCards.map(id => {
    const card = COMBAT_CARDS.find(c => c.id === id);
    const force   = card?.force   ?? 0;
    const blood   = card?.blood   ?? 0;
    const shields = card?.shields ?? 0;
    let weight = 1;

    // Bonus fort pour la carte avec la force maximale disponible
    if (force === myMaxForce) weight += AI_WEIGHTS.combatCard_topForce;
    else if (force >= 4)      weight += AI_WEIGHTS.combatCard_force4;
    else if (force >= 3)      weight += AI_WEIGHTS.combatCard_force3;

    // Bonus pour la carte avec le maximum de sang disponible (attaque secondaire)
    if (blood === myMaxBlood && myMaxBlood >= 2) weight += AI_WEIGHTS.combatCard_topBlood;
    else if (blood >= 2)                         weight += AI_WEIGHTS.combatCard_blood2;

    if (opponentHasBlood) {
      // Adversaire a des cartes sang : préférer force ou boucliers
      if (shields >= 2) weight += AI_WEIGHTS.combatCard_vsBlood + AI_WEIGHTS.combatCard_shields2;
      if (blood >= 1)   weight -= 15; // réduire l'attractivité des cartes sang
    } else {
      if (shields >= 2) weight += AI_WEIGHTS.combatCard_shields2;
    }

    return { id, weight };
  });
  const combatCardId = weightedSelect(playChoices).id;

  // Sélection de la carte à défausser : préférer les cartes faibles
  const remaining = availableCards.filter(id => id !== combatCardId);
  const discardChoices = remaining.map(id => {
    const card = COMBAT_CARDS.find(c => c.id === id);
    let weight = 1;
    if ((card?.force ?? 0) <= 2)   weight += AI_WEIGHTS.discard_lowForce;
    if ((card?.force ?? 0) === 1)  weight += AI_WEIGHTS.discard_force1;
    if ((card?.shields ?? 0) >= 3) weight += AI_WEIGHTS.discard_highShields;
    return { id, weight };
  });
  const discardCardId = weightedSelect(discardChoices).id;

  return { combatCard: combatCardId, discardCard: discardCardId };
}

// ─── Combat : choix de carte SACHANT la carte adverse (Préscience) ──────────
// Utilisé uniquement quand l'IA possède la Préscience (tuile ou jeton JP) ET
// que l'adversaire a déjà choisi sa carte combat. Calcule la force réelle des
// deux camps (unités + créatures + tuiles) et choisit la carte qui maximise la
// marge de victoire, en réservant une marge de sécurité pour d'éventuelles
// cartes ID "force" que l'adversaire pourrait encore jouer en phase ID.
// Si gagner n'est pas atteignable, bascule sur la limitation des pertes
// (privilégie les boucliers pour absorber le sang adverse).
export function aiChooseCombatCardKnowingOpponent(gameState, availableCards, opponentCardId, myPlayerId, opponentPlayerId, zoneId) {
  if (!availableCards || availableCards.length < 2) return null;

  const players = gameState?.players || {};
  const myColor = players[myPlayerId]?.color;
  const opponentColor = players[opponentPlayerId]?.color;
  const boardUnits = gameState?.boardUnits || {};
  const myUnits = boardUnits[zoneId]?.[myColor] || 0;
  const opponentUnits = boardUnits[zoneId]?.[opponentColor] || 0;

  const disabledTileIds = gameState?.disabledTileIds || {};
  const creatureAssignments  = gameState?.creatureAssignments  || {};
  const creatureAssignments2 = gameState?.creatureAssignments2 || {};

  const myCreatBonus  = getCombatCreatureBonus(myPlayerId, opponentPlayerId, zoneId, creatureAssignments, players, POWER_TILES, creatureAssignments2, disabledTileIds);
  const oppCreatBonus = getCombatCreatureBonus(opponentPlayerId, myPlayerId, zoneId, creatureAssignments, players, POWER_TILES, creatureAssignments2, disabledTileIds);
  const myTilesBonus  = getPowerTileCombatBonus(players[myPlayerId]?.ownedTileIds, true,  POWER_TILES, disabledTileIds);
  const oppTilesBonus = getPowerTileCombatBonus(players[opponentPlayerId]?.ownedTileIds, false, POWER_TILES, disabledTileIds);
  // Jetons JP des prêtres présents dans la zone de combat (force_attaque/force_defense)
  const myJpBonus  = getJpTokenCombatBonus(gameState?.boardPriests, zoneId, myColor, true);
  const oppJpBonus = getJpTokenCombatBonus(gameState?.boardPriests, zoneId, opponentColor, false);

  const opponentCard = COMBAT_CARDS.find(c => c.id === opponentCardId);
  const opponentBaseForce = opponentUnits + (opponentCard?.force ?? 0) + oppCreatBonus.force + oppTilesBonus.force + oppJpBonus.force;

  // Marge de sécurité : l'adversaire peut encore ajouter une carte ID "force"
  // (+1 à +2 en général) en phase ID — viser une marge au-dessus plutôt que
  // gagner "tout juste" et se faire renverser.
  const ID_FORCE_BUFFER = 2;
  const opponentPossibleForce = opponentBaseForce + ID_FORCE_BUFFER;

  const candidates = availableCards.map(id => {
    const card = COMBAT_CARDS.find(c => c.id === id);
    const myForce = myUnits + (card?.force ?? 0) + myCreatBonus.force + myTilesBonus.force + myJpBonus.force;
    const marginWithBuffer = myForce - opponentPossibleForce;
    const marginNoBuffer = myForce - opponentBaseForce;
    let weight = 1;
    if (marginWithBuffer >= 0) {
      // Gagne même si l'adversaire boost sa force au maximum attendu : la carte
      // la plus sobre suffisant à cette marge est privilégiée (garder les
      // meilleures cartes en réserve pour un futur combat).
      weight += 200 - (card?.force ?? 0) * 5;
    } else if (marginNoBuffer > 0) {
      // Gagne sans boost adverse, mais resterait à risque s'il en joue un :
      // préférer plus de force, boucliers en soutien pour amortir un sang boosté.
      weight += 100 + (card?.force ?? 0) * 10 + (card?.shields ?? 0) * 5;
    } else {
      // Ne peut probablement pas gagner : limiter les pertes — boucliers
      // d'abord (absorbe le sang adverse), force ensuite en solution de repli.
      weight += (card?.shields ?? 0) * 15 + (card?.force ?? 0) * 3;
    }
    return { id, weight };
  });

  const combatCardId = weightedSelect(candidates)?.id ?? candidates[0].id;

  // Défausse : la carte la plus faible parmi celles restantes
  const remaining = availableCards.filter(id => id !== combatCardId);
  const discardChoices = remaining.map(id => {
    const card = COMBAT_CARDS.find(c => c.id === id);
    let weight = 1;
    if ((card?.force ?? 0) <= 2)   weight += AI_WEIGHTS.discard_lowForce;
    if ((card?.force ?? 0) === 1)  weight += AI_WEIGHTS.discard_force1;
    if ((card?.shields ?? 0) >= 3) weight += AI_WEIGHTS.discard_highShields;
    return { id, weight };
  });
  const discardCardId = weightedSelect(discardChoices)?.id ?? remaining[0];

  return { combatCard: combatCardId, discardCard: discardCardId };
}

// ─── Combat : sélection de carte ID à jouer en phase ID ──────────────────────
// combatIdCards : cartes ID de timing "combat" ou "any" disponibles pour l'IA
// Retourne la meilleure carte à jouer ou null si passer est préférable.
export function aiSelectCombatIdCard(combatIdCards, combat, gameState, allPlayers, aiPlayerId) {
  if (!combatIdCards || combatIdCards.length === 0) return null;

  // Ne jouer qu'une seule carte ID par passage en id_phase pour rester raisonnable
  const alreadyPlayed = (combat.choices?.[aiPlayerId]?.idCards || []).length;
  if (alreadyPlayed >= 1) return null;

  const opponentId   = aiPlayerId === combat.attacker ? combat.defender : combat.attacker;
  const aiColor      = allPlayers.find(p => p.id === aiPlayerId)?.color;
  const opponentColor = allPlayers.find(p => p.id === opponentId)?.color;
  const aiState      = gameState?.players?.[aiPlayerId] || {};
  const opponentState = gameState?.players?.[opponentId] || {};
  const aiAnk        = aiState.ank ?? 7;

  const zoneUnits    = gameState?.boardUnits?.[combat.zoneId] || {};
  const myUnits      = zoneUnits[aiColor]      || 0;
  const opponentUnits = zoneUnits[opponentColor] || 0;

  // Préscience : la carte adverse est déjà connue avec certitude — utilisée
  // pour la force, le sang et les boucliers réels plutôt que d'estimer depuis
  // son pool de cartes disponibles.
  const opponentAvailable = opponentState.availableCombatCards || [1,2,3,4,5,6,7,8];
  const opponentCombatCardId = combat.choices?.[opponentId]?.combatCard;
  const knownOpponentCard = (combat.prescience === aiPlayerId) ? COMBAT_CARDS.find(c => c.id === opponentCombatCardId) : null;

  const opponentMaxBlood    = knownOpponentCard ? (knownOpponentCard.blood ?? 0)   : Math.max(0, ...opponentAvailable.map(id => COMBAT_CARDS.find(c => c.id === id)?.blood   ?? 0));
  const opponentMaxShields  = knownOpponentCard ? (knownOpponentCard.shields ?? 0) : Math.max(0, ...opponentAvailable.map(id => COMBAT_CARDS.find(c => c.id === id)?.shields ?? 0));
  const opponentHasBlood    = opponentMaxBlood >= 2;
  const opponentHasShields  = opponentMaxShields >= 2;

  // Jetons JP des prêtres présents dans la zone de combat (force_attaque/force_defense)
  const myJpForceCombat  = getJpTokenCombatBonus(gameState?.boardPriests, combat.zoneId, aiColor, aiPlayerId === combat.attacker).force;
  const oppJpForceCombat = getJpTokenCombatBonus(gameState?.boardPriests, combat.zoneId, opponentColor, opponentId === combat.attacker).force;

  // Force estimée de chaque camp (unités + carte combat choisie)
  const myCombatCardId    = combat.choices?.[aiPlayerId]?.combatCard;
  const myCombatCard      = COMBAT_CARDS.find(c => c.id === myCombatCardId);
  const myForce           = myUnits + (myCombatCard?.force ?? 0) + myJpForceCombat;
  const oppAvgForce = knownOpponentCard
    ? knownOpponentCard.force
    : (opponentAvailable.length > 0
        ? opponentAvailable.reduce((s, id) => s + (COMBAT_CARDS.find(c => c.id === id)?.force ?? 0), 0) / opponentAvailable.length
        : 3);
  const opponentEstimatedForce = opponentUnits + oppAvgForce + oppJpForceCombat;

  const candidates = [];

  for (const card of combatIdCards) {
    if (card.id === "la_fuite")      continue; // géré par FleeModal
    if (card.id === "annulation_id") continue; // géré par CancelIdModal

    const eff  = card.effect?.type;
    const cost = card.cost ?? 0;
    if (cost > 0 && aiAnk < cost) continue;

    let weight = 0;
    switch (eff) {
      case "force":
        // Jouer si je suis derrière ou à égalité
        if (myForce <= opponentEstimatedForce) {
          weight = 40 + (card.effect?.value ?? 1) * 15;
        }
        break;
      case "shields":
        // Jouer si l'adversaire a des cartes sang
        if (opponentHasBlood) {
          weight = 55 + (card.effect?.value ?? 1) * 20;
        } else if (myUnits < opponentUnits) {
          weight = 25;
        }
        break;
      case "blood":
        // Jouer sang si adversaire n'a pas de boucliers et je suis en position de gagner
        if (!opponentHasShields && myForce >= opponentEstimatedForce) {
          weight = 35 + (card.effect?.value ?? 1) * 10;
        }
        break;
      case "ank_if_win":
        // Butin de guerre si je gagne clairement et ank faible
        if (myForce > opponentEstimatedForce && aiAnk < 5) weight = 40;
        break;
      case "no_damage_if_win":
        // Aucun saignement si je gagne mais l'adversaire a du sang
        if (myForce >= opponentEstimatedForce && opponentHasBlood) weight = 50;
        break;
      case "units_if_win":
        // Recrutement victoire si je gagne clairement
        if (myForce > opponentEstimatedForce + 1) weight = 30;
        break;
      case "swap_combat_card": {
        // Changement de Stratégie : n'a d'intérêt que si la carte en défausse est
        // clairement meilleure que la carte choisie face à la force adverse estimée.
        const myDiscardCardId = combat.choices?.[aiPlayerId]?.discardCard;
        const myDiscardCard = COMBAT_CARDS.find(c => c.id === myDiscardCardId);
        if (myDiscardCard) {
          const discardForce = myUnits + (myDiscardCard.force ?? 0) + myJpForceCombat;
          if (discardForce > myForce && discardForce >= opponentEstimatedForce && myForce < opponentEstimatedForce) {
            weight = 45;
          }
        }
        break;
      }
      default:
        break;
    }

    if (weight > 0) candidates.push({ card, weight });
  }

  if (candidates.length === 0) return null;

  // Seuil minimal : ne jouer que si la raison est suffisamment forte
  const best = candidates.sort((a, b) => b.weight - a.weight)[0];
  if (best.weight < 35) return null;

  return weightedSelect(candidates)?.card ?? null;
}

function canReachEmptyTemple(zoneId, boardUnits) {
  return (ZONE_ADJACENCY[zoneId] || []).some(
    adj => TEMPLES.includes(adj) && !Object.values(boardUnits[adj] || {}).some(n => n > 0)
  );
}

// ─── Aube : choix de position dans l'ordre de jeu ────────────────────────────
// availablePositions : tableau de positions disponibles (ex: [1, 2, 3])
// takenPositions     : tableau de positions déjà prises
export function aiChooseDawnPosition(gameState, aiPlayerId, allPlayers, takenPositions, availablePositions) {
  if (!availablePositions || availablePositions.length === 0) return null;
  if (availablePositions.length === 1) return availablePositions[0];

  const boardUnits = gameState?.boardUnits || {};
  const aiPlayer   = allPlayers.find(p => p.id === aiPlayerId);
  const aiColor    = aiPlayer?.color;
  const myZones    = getMyZonesSorted(boardUnits, aiColor);

  const emptyTempleReachable = myZones.some(z => canReachEmptyTemple(z, boardUnits));
  const hasAttackTarget      = myZones.some(z =>
    (ZONE_ADJACENCY[z] || []).some(adj => getEnemyEntry(boardUnits, adj, aiColor))
  );
  const amLeader = isLeader(aiPlayerId, allPlayers, gameState);

  const sorted = [...availablePositions].sort((a, b) => a - b);
  const first  = sorted[0];
  const last   = sorted[sorted.length - 1];

  let wFirst = 1;
  let wLast  = 1;
  if (emptyTempleReachable) wFirst += AI_WEIGHTS.dawn_firstIfTemple;
  if (hasAttackTarget)      wFirst += AI_WEIGHTS.dawn_firstIfAttack;
  if (!emptyTempleReachable && !hasAttackTarget) wLast += AI_WEIGHTS.dawn_lastIfReactive;
  if (amLeader)             wLast  += AI_WEIGHTS.dawn_lastIfLeader;

  const posChoices = [
    { pos: first, weight: wFirst },
    { pos: last,  weight: wLast  },
  ];
  for (const pos of sorted.slice(1, -1)) {
    posChoices.push({ pos, weight: 1 });
  }

  return weightedSelect(posChoices)?.pos ?? availablePositions[0];
}

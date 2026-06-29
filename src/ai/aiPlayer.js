import { POWER_TILES, getPlayerPyramidColors, getPlayerPyramidLevel } from "../constants/powerTiles";
import { PYRAMID_SLOTS, PYRAMID_COLORS } from "../constants/pyramids";
import { ZONE_ADJACENCY, BOARD_ZONES, TELEPORT_TARGETS } from "../constants/board";
import { MAX_UNITS_PER_ZONE } from "../constants/game";
import { COMBAT_CARDS } from "../constants/cards";
import { getValidPriestDestinations } from "../constants/taSetiGraph";

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
  buy_creature:          40,   // tuile de type créature
  buy_vpImmediate:       50,   // tuile donne VP immédiat (Point Majeur)
  buy_combat:            35,   // tuile avec bonus de combat (force, bouclier)
  buy_movement:          25,   // tuile avec bonus de déplacement / téléportation
  buy_level3:            30,   // tuile de niveau 3
  buy_noTileInColor:     25,   // aucune tuile possédée de cette couleur
  buy_fewTiles:          20,   // moins de 2 tuiles au total
  buy_richEnough:        20,   // ank >= 7

  // ── Recrutement ─────────────────────────────────────────────────────────
  recruit_bigReserve:    30,   // réserve >= 3
  recruit_fewOnBoard:    40,   // total unités sur plateau < 5
  recruit_richEnough:    20,   // ank >= 3

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

  // ── Attaque ─────────────────────────────────────────────────────────────
  attack_base:           20,   // attaque légale (ratio >= 1:1)
  attack_ratio2to1:      70,   // ratio attaque >= 2:1
  attack_ratio1_5to1:    30,   // ratio attaque >= 1.5:1
  attack_ratio1to1:      20,   // ratio >= 1:1 (sans bonus ratio supérieur)
  attack_temple:         50,   // cible est un temple (T1, T2, T3, TB)
  attack_enemyCity:      30,   // cible est une cité ennemie
  attack_enemyAlone:     40,   // ennemi a 1 seule unité dans la cible
  attack_myUnits4plus:   20,   // j'ai >= 4 unités attaquantes
  attack_leaderEnemy:    30,   // adversaire leader au score est dans cette zone
  attack_myCreature:     20,   // j'ai une créature dans la zone source
  attack_myStrongCard:   15,   // j'ai une carte combat de force >= 4
  attack_enemyCreature:  -20,  // ennemi a une créature (risque élevé)
  attack_adjTemple:      25,   // cible adjacente à un temple vide (enchaîner)

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

// Capacité de déplacement max théorique :
// tuiles pouvoirs + cartes ID Marche Forcée en main + jetons JP sur les prêtres
function computeMaxMovePoints(aiPlayerId, gameState) {
  const myState = gameState.players?.[aiPlayerId] || {};
  const ownedTileIds = myState.ownedTileIds || [];

  let pts = 1 + ownedTileIds.filter(id => {
    const name = POWER_TILES.find(t => t.id === id)?.name;
    return name === "Déplacement" || name === "Furie Bestiale";
  }).length;

  // Cartes ID Marche Forcée en main
  pts += (myState.idCards || []).filter(c => c.id === "marche_forcee").length;

  // Jetons JP capacité déplacement portés par les prêtres sur le plateau
  const aiColor = myState.color;
  const boardPriests = gameState.boardPriests || {};
  Object.values(boardPriests).forEach(zoneColors => {
    const priest = zoneColors?.[aiColor];
    if (priest?.jpTokenIds) {
      pts += priest.jpTokenIds.filter(id => id === 'JP_capacite_deplacement').length;
    }
  });

  return pts;
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
        reachable.push(adj);
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
function selectBestDayIdCard(myState, boardUnits, aiColor) {
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
export function aiDecideAction(gameState, aiPlayerId, allPlayers) {
  const myState = gameState.players?.[aiPlayerId] || {};
  const aiPlayer = allPlayers.find(p => p.id === aiPlayerId);
  const aiColor = aiPlayer?.color;
  const joinOrder = aiPlayer?.joinOrder;

  if ((myState.actionsThisTurn ?? 0) >= 1 || (myState.tokens ?? 5) <= 0) {
    return { type: "endTurn" };
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

  // ── Prière ────────────────────────────────────────────────────────────────
  if (ank < 11) {
    let w2 = 1;
    if (ank <= 2) w2 += AI_WEIGHTS.prayer_urgentAnk;
    if (ank <= 5) w2 += AI_WEIGHTS.prayer_lowAnk;
    candidates.push({ type: "prayer2", weight: w2 });

    let w3 = 1;
    if (ank >= 7) w3 += AI_WEIGHTS.prayer_highAnk_niv3;
    if (ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Priere +1 ank"))
      w3 += AI_WEIGHTS.prayer_tile_niv3;
    candidates.push({ type: "prayer3", weight: w3 });
  }

  // ── Attaque ───────────────────────────────────────────────────────────────
  for (const fromZoneId of myZones) {
    const myUnits = boardUnits[fromZoneId]?.[aiColor] || 0;
    if (myUnits < 2) continue;
    const attackCount = Math.min(myUnits - 1, 5);

    for (const adjZoneId of (ZONE_ADJACENCY[fromZoneId] || [])) {
      const enemy = getEnemyEntry(boardUnits, adjZoneId, aiColor);
      if (!enemy) continue;
      if (attackCount < enemy.count) continue;

      const ratio     = attackCount / Math.max(1, enemy.count);
      const isTemple  = TEMPLES.includes(adjZoneId);
      const isCity    = /^J\d+C\d+$/.test(adjZoneId) && !adjZoneId.startsWith(`J${joinOrder}`);
      const myCreature    = getCreatureInZone(fromZoneId, aiColor, gameState);
      const enemyCreature = getCreatureInZone(adjZoneId, enemy.color, gameState);
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

      candidates.push({ type: "attack", fromZoneId, toZoneId: adjZoneId, count: attackCount, weight });
    }
  }

  // ── Achat de tuile ────────────────────────────────────────────────────────
  if (ank >= 5) {
    const myColors = getPlayerPyramidColors(aiPlayerId, pyramids);
    const hasCoutReduc = ownedTileIds.some(
      id => POWER_TILES.find(t => t.id === id)?.name === "Cout Pouvoir -1"
    );
    const colorToAction = { Rouge: "buy_red", Bleu: "buy_blue", Blanc: "buy_white", Noir: "buy_black" };

    const buyable = POWER_TILES.filter(t => {
      if (!availableIds.includes(t.id)) return false;
      const ownedNames = ownedTileIds.map(id => POWER_TILES.find(x => x.id === id)?.name).filter(Boolean);
      if (ownedNames.includes(t.name)) return false;
      if (!myColors.includes(t.color)) return false;
      if (usedActions.includes(colorToAction[t.color])) return false;
      if (getPlayerPyramidLevel(aiPlayerId, t.color, pyramids) < t.level) return false;
      if (t.secondaryColor && getPlayerPyramidLevel(aiPlayerId, t.secondaryColor, pyramids) < t.secondaryLevel) return false;
      const cost = Math.max(0, t.cost - (hasCoutReduc ? 1 : 0));
      return ank >= cost;
    });

    for (const tile of buyable) {
      const noTileInColor = !ownedTileIds.some(
        id => POWER_TILES.find(t2 => t2.id === id)?.color === tile.color
      );
      let weight = 1;
      if (tile.type === 'creature')          weight += AI_WEIGHTS.buy_creature;
      if ((tile.vpOnPurchase ?? 0) > 0)      weight += AI_WEIGHTS.buy_vpImmediate;
      if (tile.type === 'combat')            weight += AI_WEIGHTS.buy_combat;
      if (tile.type === 'movement')          weight += AI_WEIGHTS.buy_movement;
      if (tile.level >= 3)                   weight += AI_WEIGHTS.buy_level3;
      if (noTileInColor)                     weight += AI_WEIGHTS.buy_noTileInColor;
      if (ownedTileIds.length < 2)           weight += AI_WEIGHTS.buy_fewTiles;
      if (ank >= 7)                          weight += AI_WEIGHTS.buy_richEnough;

      candidates.push({ type: colorToAction[tile.color] || "buy_red", tileId: tile.id, weight });
    }
  }

  // ── Recrutement ───────────────────────────────────────────────────────────
  if (unitsReserve > 0 && joinOrder && ank >= 1) {
    const cityZoneIds = BOARD_ZONES.filter(z => z.id.startsWith(`J${joinOrder}C`)).map(z => z.id);
    const hasSpace = cityZoneIds.some(zId => (boardUnits[zId]?.[aiColor] || 0) < MAX_UNITS_PER_ZONE);
    if (hasSpace) {
      const myTotalOnBoard = Object.values(boardUnits).reduce((s, z) => s + (z?.[aiColor] || 0), 0);
      let weight = 1;
      if (unitsReserve >= 3)    weight += AI_WEIGHTS.recruit_bigReserve;
      if (myTotalOnBoard < 5)   weight += AI_WEIGHTS.recruit_fewOnBoard;
      if (ank >= 3)             weight += AI_WEIGHTS.recruit_richEnough;
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
  const maxMovePts = computeMaxMovePoints(aiPlayerId, gameState);
  const move1Used = usedActions.includes('move1');
  const move2Used = usedActions.includes('move2');

  // Pénalité à partir du jeton 3 : réserve les jetons 2 et 1 pour les déplacements
  const extraTokens = Math.max(0, tokensLeft - 2);
  const moveEarlyPenalty = extraTokens * AI_WEIGHTS.move_earlyPenalty;
  // Sur le dernier jeton, forcer l'utilisation du déplacement manquant
  const isLastToken = tokensLeft === 1;

  for (const moveType of ['move1', 'move2']) {
    if (moveType === 'move1' && move1Used) continue;
    if (moveType === 'move2' && move2Used) continue;

    // Bonus si le type complémentaire est déjà utilisé (encourage à faire les deux)
    const complementUsed = moveType === 'move1' ? move2Used : move1Used;
    const preferBothBonus = complementUsed ? AI_WEIGHTS.move_preferBoth : 0;
    // Bonus fort sur le dernier jeton pour ne pas le gaspiller sur une autre action
    const lastTokenBonus = isLastToken ? AI_WEIGHTS.move_lastToken : 0;

    for (const fromZoneId of myZones) {
      const myUnits = boardUnits[fromZoneId]?.[aiColor] || 0;
      if (myUnits < 1) continue;

      const sourceIsTemple = TEMPLES.includes(fromZoneId);
      const reachableEmptyTemples = (sourceIsTemple && isLastToPlay && hasOnlyOneGroup)
        ? getReachableEmptyTemples(fromZoneId, maxMovePts, boardUnits, aiColor)
        : [];
      const canSplitForTemple = reachableEmptyTemples.length > 0;

      const reachableZones = getReachableZonesForMove(fromZoneId, maxMovePts, boardUnits, aiColor);

      for (const adjZoneId of reachableZones) {
        const adjUnits = boardUnits[adjZoneId] || {};
        const existingFriendly = adjUnits[aiColor] || 0;

        const destIsEmptyTemple = TEMPLES.includes(adjZoneId) && !Object.values(adjUnits).some(n => n > 0);
        const keepBack = (canSplitForTemple && destIsEmptyTemple) ? 1 : 0;

        const intendedMove = myUnits - keepBack;
        const canAdd = Math.min(intendedMove, MAX_UNITS_PER_ZONE - existingFriendly);
        if (canAdd <= 0) continue;

        const isTemple   = TEMPLES.includes(adjZoneId);
        const zoneEmpty  = !Object.values(adjUnits).some(n => n > 0);
        const adjToEmpty = hasEmptyTempleAdjacent(adjZoneId, boardUnits);
        const newTemple  = isTemple && zoneEmpty ? 1 : 0;
        const wouldControl2 = (myTemples + newTemple) >= 2;

        // Opportunité d'attaque depuis la zone cible (ennemi faible = ratio >= 1.5:1)
        const unitsAfterMove = existingFriendly + canAdd;
        const hasAttackOpportunity = (ZONE_ADJACENCY[adjZoneId] || []).some(adj2 => {
          const enemy2 = getEnemyEntry(boardUnits, adj2, aiColor);
          return enemy2 && unitsAfterMove >= enemy2.count * 1.5;
        });

        let weight = 1 + moveEarlyPenalty + preferBothBonus + lastTokenBonus;
        if (isTemple && zoneEmpty) weight += AI_WEIGHTS.move_emptyTemple;
        if (adjToEmpty)            weight += AI_WEIGHTS.move_adjacentTemple;
        if (canAdvancePriest)      weight += AI_WEIGHTS.move_priestAdvance;
        if (existingFriendly > 0)  weight += AI_WEIGHTS.move_reinforce;
        if (wouldControl2)         weight += AI_WEIGHTS.move_control2temples;
        if (hasAttackOpportunity)  weight += AI_WEIGHTS.move_towardAttack;

        if (weight > 0) {
          candidates.push({ type: moveType, sourceZoneId: fromZoneId, targetZoneId: adjZoneId, count: canAdd, weight });
        }
      }
    }
  }

  // ── Téléportation vers temple vide inaccessible normalement ──────────────
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

        const reachableNormal = new Set(getReachableZonesForMove(fromZoneId, maxMovePts, boardUnits, aiColor));

        for (const teleTarget of TELEPORT_TARGETS) {
          if (reachableNormal.has(teleTarget)) continue; // déjà accessible sans payer
          if (!TEMPLES.includes(teleTarget)) continue;   // uniquement les temples

          const adjUnits = boardUnits[teleTarget] || {};
          const hasEnemy = Object.entries(adjUnits).some(([c, n]) => c !== aiColor && (n || 0) > 0);
          if (hasEnemy) continue;
          if (Object.values(adjUnits).some(n => n > 0)) continue; // temple non vide

          const existingFriendly = adjUnits[aiColor] || 0;
          const canAdd = Math.min(myUnits, MAX_UNITS_PER_ZONE - existingFriendly);
          if (canAdd <= 0) continue;

          const wouldControl2 = (myTemples + 1) >= 2;

          let weight = 1 + moveEarlyPenalty + preferBothBonus + lastTokenBonusTele;
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
      const cost = (to * (to + 1)) / 2 - (from * (from + 1)) / 2;
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

  // ── Sélection de la carte ID à jouer gratuitement avec l'action ──────────
  const idCardToPlay = selectBestDayIdCard(myState, boardUnits, aiColor);

  const decision = weightedSelect(candidates) ?? { type: "endTurn" };
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

  // Potentiel de l'adversaire (sang et boucliers depuis ses cartes disponibles)
  const opponentAvailable   = opponentState.availableCombatCards || [1,2,3,4,5,6,7,8];
  const opponentMaxBlood    = Math.max(0, ...opponentAvailable.map(id => COMBAT_CARDS.find(c => c.id === id)?.blood   ?? 0));
  const opponentMaxShields  = Math.max(0, ...opponentAvailable.map(id => COMBAT_CARDS.find(c => c.id === id)?.shields ?? 0));
  const opponentHasBlood    = opponentMaxBlood >= 2;
  const opponentHasShields  = opponentMaxShields >= 2;

  // Force estimée de chaque camp (unités + carte combat choisie)
  const myCombatCardId    = combat.choices?.[aiPlayerId]?.combatCard;
  const myCombatCard      = COMBAT_CARDS.find(c => c.id === myCombatCardId);
  const myForce           = myUnits + (myCombatCard?.force ?? 0);
  // Estimation prudente de la force adverse (unités + force médiane des cartes dispo)
  const oppAvgForce = opponentAvailable.length > 0
    ? opponentAvailable.reduce((s, id) => s + (COMBAT_CARDS.find(c => c.id === id)?.force ?? 0), 0) / opponentAvailable.length
    : 3;
  const opponentEstimatedForce = opponentUnits + oppAvgForce;

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

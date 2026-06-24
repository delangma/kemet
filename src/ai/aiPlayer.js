import { POWER_TILES, getPlayerPyramidColors, getPlayerPyramidLevel } from "../constants/powerTiles";
import { PYRAMID_SLOTS, PYRAMID_COLORS } from "../constants/pyramids";
import { ZONE_ADJACENCY, BOARD_ZONES } from "../constants/board";
import { MAX_UNITS_PER_ZONE } from "../constants/game";
import { COMBAT_CARDS } from "../constants/cards";
import { getValidPriestDestinations } from "../constants/taSetiGraph";

const TEMPLES = ["T1", "T2", "T3", "TB"];

// ─── Moteur de sélection pondérée ────────────────────────────────────────────
// Voir Project_Files/Rules_IA.txt pour la spécification complète des règles.
// Poids de base : 1 par candidat. Les règles valides s'additionnent.
function weightedSelect(candidates) {
  if (candidates.length === 0) return null;
  const total = candidates.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

// Setup : choisit 1 pyramide niveau 2 + 1 niveau 1 — déterministe selon joinOrder
export function aiChooseSetup(aiPlayer) {
  const joinOrder = aiPlayer.joinOrder;
  const slots = PYRAMID_SLOTS.filter(s => s.cityId === `J${joinOrder}`);
  const color1 = PYRAMID_COLORS[(joinOrder - 1) % PYRAMID_COLORS.length];
  const color2 = PYRAMID_COLORS[joinOrder % PYRAMID_COLORS.length];
  return [
    { slotId: slots[0].id, color: color1, level: 2 },
    { slotId: slots[1].id, color: color2, level: 1 },
  ];
}

// Draft : choisit la meilleure tuile niveau 1 disponible
export function aiChooseDraftTile(gameState, aiPlayerId) {
  const pyramids = gameState.pyramids || {};
  const myColors = getPlayerPyramidColors(aiPlayerId, pyramids);
  const availableTileIds = gameState.availableTileIds || [];

  const eligible = POWER_TILES.filter(
    t => t.level === 1 && myColors.includes(t.color) && availableTileIds.includes(t.id)
  );
  if (eligible.length === 0) {
    const fallback = POWER_TILES.filter(t => t.level === 1 && availableTileIds.includes(t.id));
    return fallback[0]?.id ?? null;
  }
  const priority = { creature: 4, combat: 3, movement: 2 };
  eligible.sort((a, b) => (priority[b.type] || 1) - (priority[a.type] || 1));
  return eligible[0].id;
}

// Placement : 2 premières zones de la cité
export function aiChoosePlacement(aiPlayer) {
  return [`J${aiPlayer.joinOrder}C1`, `J${aiPlayer.joinOrder}C2`];
}

// Helpers
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

// ─── Phase de jeu ────────────────────────────────────────────────────────────
export function aiDecideAction(gameState, aiPlayerId, allPlayers) {
  const myState = gameState.players?.[aiPlayerId] || {};
  const aiPlayer = allPlayers.find(p => p.id === aiPlayerId);
  const aiColor = aiPlayer?.color;
  const joinOrder = aiPlayer?.joinOrder;

  if ((myState.actionsThisTurn ?? 0) >= 1 || (myState.tokens ?? 5) <= 0) {
    return { type: "endTurn" };
  }

  const ank = myState.ank ?? 7;
  const ownedTileIds = myState.ownedTileIds || [];
  const usedActions = myState.usedActions || [];
  const unitsReserve = myState.unitsReserve ?? 0;
  const boardUnits = gameState.boardUnits || {};
  const pyramids = gameState.pyramids || {};
  const availableTileIds = gameState.availableTileIds || [];

  const myZones = getMyZonesSorted(boardUnits, aiColor);

  const priestPositions = gameState.taSetiPriestPositions?.[aiPlayerId] || {};
  const priestPos = [priestPositions['0'] ?? '', priestPositions['1'] ?? '', priestPositions['2'] ?? ''];
  const taSetiLayout = gameState.taSetiLayout;
  const canAdvancePriest = taSetiLayout && priestPos.some(p => getValidPriestDestinations(p, taSetiLayout).length > 0);

  const candidates = [];

  // ── Attaque ─────────────────────────────────────────────────────────────────
  for (const fromZoneId of myZones) {
    const myUnits = boardUnits[fromZoneId]?.[aiColor] || 0;
    if (myUnits < 2) continue;
    const attackCount = Math.min(myUnits - 1, 5);

    for (const adjZoneId of (ZONE_ADJACENCY[fromZoneId] || [])) {
      const enemy = getEnemyEntry(boardUnits, adjZoneId, aiColor);
      if (!enemy) continue;
      if (attackCount < enemy.count) continue;

      const ratio = attackCount / Math.max(1, enemy.count);
      const isTemple = TEMPLES.includes(adjZoneId);
      const isEnemyCity = /^J\d+C\d+$/.test(adjZoneId) && !adjZoneId.startsWith(`J${joinOrder}`);

      let weight = 1 + 20; // +20 : attaque légale
      if (ratio >= 2) weight += 70;
      else if (ratio >= 1.5) weight += 30;
      if (isTemple) weight += 50;
      if (isEnemyCity) weight += 30;
      if (enemy.count === 1) weight += 40;
      if (attackCount >= 4) weight += 20;

      candidates.push({ type: "attack", fromZoneId, toZoneId: adjZoneId, count: attackCount, weight });
    }
  }

  // ── Achat de tuile ───────────────────────────────────────────────────────────
  if (ank >= 5) {
    const myColors = getPlayerPyramidColors(aiPlayerId, pyramids);
    const hasCoutReduc = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Cout Pouvoir -1");
    const colorToAction = { Rouge: "buy_red", Bleu: "buy_blue", Blanc: "buy_white", Noir: "buy_black" };

    const buyable = POWER_TILES.filter(t => {
      if (!availableTileIds.includes(t.id)) return false;
      const ownedNames = ownedTileIds.map(id => POWER_TILES.find(x => x.id === id)?.name).filter(Boolean);
      if (ownedNames.includes(t.name)) return false;
      if (!myColors.includes(t.color)) return false;
      if (usedActions.includes(colorToAction[t.color])) return false;
      if (getPlayerPyramidLevel(aiPlayerId, t.color, pyramids) < t.level) return false;
      if (t.secondaryColor && getPlayerPyramidLevel(aiPlayerId, t.secondaryColor, pyramids) < t.secondaryLevel) return false;
      const effectiveCost = Math.max(0, t.cost - (hasCoutReduc ? 1 : 0));
      return ank >= effectiveCost;
    });

    for (const tile of buyable) {
      let weight = 1;
      if (ank >= 7) weight += 20;
      if (ownedTileIds.length < 2) weight += 30;
      if (tile.type === 'creature') weight += 40;
      else if (tile.type === 'combat') weight += 20;
      if (tile.level >= 3) weight += 30;

      candidates.push({ type: colorToAction[tile.color] || "buy_red", tileId: tile.id, weight });
    }
  }

  // ── Recrutement ──────────────────────────────────────────────────────────────
  if (unitsReserve > 0 && joinOrder && ank >= 1) {
    const cityZoneIds = BOARD_ZONES.filter(z => z.id.startsWith(`J${joinOrder}C`)).map(z => z.id);
    const hasSpace = cityZoneIds.some(zId => (boardUnits[zId]?.[aiColor] || 0) < MAX_UNITS_PER_ZONE);
    if (hasSpace) {
      const myTotalOnBoard = Object.values(boardUnits).reduce((sum, z) => sum + (z?.[aiColor] || 0), 0);
      let weight = 1;
      if (unitsReserve >= 3) weight += 30;
      if (myTotalOnBoard < 5) weight += 40;
      if (ank >= 3) weight += 20;
      candidates.push({ type: "recruit", weight });
    }
  }

  // ── Déplacement ──────────────────────────────────────────────────────────────
  for (const fromZoneId of myZones) {
    const myUnits = boardUnits[fromZoneId]?.[aiColor] || 0;
    if (myUnits < 2) continue;

    for (const adjZoneId of (ZONE_ADJACENCY[fromZoneId] || [])) {
      const adjUnits = boardUnits[adjZoneId] || {};
      const hasEnemies = Object.entries(adjUnits).some(([c, n]) => c !== aiColor && (n || 0) > 0);
      if (hasEnemies) continue;

      const existingFriendly = adjUnits[aiColor] || 0;
      const canAdd = Math.min(myUnits - 1, MAX_UNITS_PER_ZONE - existingFriendly);
      if (canAdd <= 0) continue;

      const isTemple = TEMPLES.includes(adjZoneId);
      const zoneEmpty = !Object.values(adjUnits).some(n => n > 0);
      const adjacentToEmptyTemple = TEMPLES.some(t =>
        (ZONE_ADJACENCY[adjZoneId] || []).includes(t) &&
        !Object.values(boardUnits[t] || {}).some(n => n > 0)
      );

      let weight = 1;
      if (isTemple && zoneEmpty) weight += 60;
      if (canAdvancePriest) weight += 30;
      if (existingFriendly > 0) weight += 10;
      if (adjacentToEmptyTemple) weight += 20;

      if (weight > 1) {
        candidates.push({ type: "move1", sourceZoneId: fromZoneId, targetZoneId: adjZoneId, count: canAdd, weight });
      }
    }
  }

  // ── Amélioration de pyramide ─────────────────────────────────────────────────
  const myPyramids = Object.entries(pyramids)
    .filter(([, p]) => p.controllerId === aiPlayerId)
    .map(([slotId, p]) => ({ slotId, ...p }));

  for (const pyr of myPyramids) {
    const currentLevel = pyr.level ?? 0;
    if (currentLevel >= 4) continue;
    const targetLevel = currentLevel + 1;
    const cost = targetLevel; // coût = niveau cible (0→1 = 1 ank, 1→2 = 2 ank, etc.)
    if (ank < cost) continue;

    const noTilesInColor = !ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.color === pyr.color);

    let weight = 1;
    if (targetLevel === 2) weight += 40;
    else if (targetLevel === 3) weight += 30;
    else if (targetLevel === 4) weight += 20;
    if (noTilesInColor) weight += 30;
    if (ank >= 8) weight += 20;

    candidates.push({ type: "upgradePyramid", slotId: pyr.slotId, targetLevel, color: pyr.color, weight });
  }

  // ── Prière (toujours disponible) ─────────────────────────────────────────────
  let prayWeight = 1;
  if (ank <= 4) prayWeight += 70;
  else if (ank <= 6) prayWeight += 40;
  else if (ank <= 8) prayWeight += 20;
  candidates.push({ type: ank <= 7 ? "prayer2" : "prayer3", weight: prayWeight });

  return weightedSelect(candidates) ?? { type: "endTurn" };
}

// ─── Combat : choisit les cartes ─────────────────────────────────────────────
// Voir Project_Files/Rules_IA.txt section 2 pour les règles détaillées.
export function aiChooseCombatCards(availableCards) {
  if (availableCards.length < 2) return null;

  // Carte de combat : préférer force élevée avec bonus pour boucliers et gouttes
  const combatChoices = availableCards.map(id => {
    const card = COMBAT_CARDS.find(c => c.id === id);
    let weight = 1;
    if ((card?.force ?? 0) >= 4) weight += 30;
    else if ((card?.force ?? 0) >= 3) weight += 15;
    if ((card?.shields ?? 0) >= 2) weight += 20;
    if ((card?.blood ?? 0) >= 2) weight += 15;
    return { id, weight };
  });

  const combatCardId = weightedSelect(combatChoices).id;

  // Carte à défausser : préférer force faible pour conserver les bonnes cartes
  const remaining = availableCards.filter(id => id !== combatCardId);
  const discardChoices = remaining.map(id => {
    const card = COMBAT_CARDS.find(c => c.id === id);
    let weight = 1;
    if ((card?.force ?? 0) <= 2) weight += 50;
    if ((card?.force ?? 0) === 1) weight += 30;
    if ((card?.shields ?? 0) >= 3) weight += 20;
    return { id, weight };
  });

  const discardCardId = weightedSelect(discardChoices).id;
  return { combatCard: combatCardId, discardCard: discardCardId };
}

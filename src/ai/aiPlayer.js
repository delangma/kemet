import { POWER_TILES, getPlayerPyramidColors } from "../constants/powerTiles";
import { PYRAMID_SLOTS, PYRAMID_COLORS } from "../constants/pyramids";
import { ZONE_ADJACENCY, BOARD_ZONES } from "../constants/board";
import { MAX_UNITS_PER_ZONE } from "../constants/game";
import { COMBAT_CARDS } from "../constants/cards";
import { getValidPriestDestinations } from "../constants/taSetiGraph";

const TEMPLES = ["T1", "T2", "T3", "TB"];

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

// Retourne toutes les zones de l'IA triées par nombre d'unités (desc)
function getMyZonesSorted(boardUnits, aiColor) {
  return Object.entries(boardUnits)
    .filter(([, c]) => (c?.[aiColor] || 0) > 0)
    .sort(([, ca], [, cb]) => (cb[aiColor] || 0) - (ca[aiColor] || 0))
    .map(([zId]) => zId);
}

// Retourne le nombre d'unités ennemies dans une zone
function getEnemyCount(boardUnits, zoneId, aiColor) {
  const zoneUnits = boardUnits[zoneId] || {};
  return Object.entries(zoneUnits)
    .filter(([c, n]) => c !== aiColor && (n || 0) > 0)
    .reduce((sum, [, n]) => sum + n, 0);
}

// Retourne la couleur et nombre ennemis dans une zone (pour le combat)
function getEnemyEntry(boardUnits, zoneId, aiColor) {
  const zoneUnits = boardUnits[zoneId] || {};
  const entry = Object.entries(zoneUnits).find(([c, n]) => c !== aiColor && (n || 0) > 0);
  return entry ? { color: entry[0], count: entry[1] } : null;
}

// Phase de jeu : décide de l'action à prendre
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
  const boardUnits = gameState.boardUnits || {};
  const pyramids = gameState.pyramids || {};
  const availableTileIds = gameState.availableTileIds || [];

  const myZones = getMyZonesSorted(boardUnits, aiColor);

  // ── 1. ATTAQUE ────────────────────────────────────────────────────────────
  // Cherche les combats favorables : priorité aux temples, ratio d'unités élevé
  {
    const candidates = [];
    for (const fromZoneId of myZones) {
      const myUnits = boardUnits[fromZoneId]?.[aiColor] || 0;
      if (myUnits < 2) continue;
      const attackCount = Math.min(myUnits - 1, 5);

      for (const adjZoneId of (ZONE_ADJACENCY[fromZoneId] || [])) {
        const enemy = getEnemyEntry(boardUnits, adjZoneId, aiColor);
        if (!enemy) continue;
        if (attackCount < enemy.count) continue; // n'attaque pas en infériorité

        const isTemple = TEMPLES.includes(adjZoneId);
        const ratio = attackCount / Math.max(1, enemy.count);
        const score = ratio * (isTemple ? 3 : 1) * (attackCount - enemy.count + 1);
        candidates.push({ fromZoneId, toZoneId: adjZoneId, count: attackCount, score });
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      return { type: "attack", fromZoneId: best.fromZoneId, toZoneId: best.toZoneId, count: best.count };
    }
  }

  // ── 2. ACHETER UNE TUILE ──────────────────────────────────────────────────
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
      const pyramidLevel = (Object.values(pyramids).find(p => p.controllerId === aiPlayerId && p.color === t.color)?.level) ?? 0;
      if (pyramidLevel < t.level) return false;
      if (t.secondaryColor) {
        const secLevel = (Object.values(pyramids).find(p => p.controllerId === aiPlayerId && p.color === t.secondaryColor)?.level) ?? 0;
        if (secLevel < t.secondaryLevel) return false;
      }
      const effectiveCost = Math.max(0, t.cost - (hasCoutReduc ? 1 : 0));
      return ank >= effectiveCost;
    }).sort((a, b) => b.level - a.level || b.cost - a.cost);

    if (buyable.length > 0) {
      const tile = buyable[0];
      return { type: colorToAction[tile.color] || "buy_red", tileId: tile.id };
    }
  }

  // ── 3. RECRUTER ───────────────────────────────────────────────────────────
  const unitsReserve = myState.unitsReserve ?? 0;
  if (unitsReserve > 0 && joinOrder) {
    const cityZoneIds = BOARD_ZONES.filter(z => z.id.startsWith(`J${joinOrder}C`)).map(z => z.id);
    const hasSpace = cityZoneIds.some(zId => (boardUnits[zId]?.[aiColor] || 0) < MAX_UNITS_PER_ZONE);
    if (hasSpace && ank >= 1) {
      return { type: "recruit" };
    }
  }

  // ── 4. DÉPLACEMENT ────────────────────────────────────────────────────────
  // Vérifie si un prêtre peut avancer sur Ta-Seti (abaisse le seuil de score)
  const priestPositions = gameState.taSetiPriestPositions?.[aiPlayerId] || {};
  const priestPos = [priestPositions['0'] ?? '', priestPositions['1'] ?? '', priestPositions['2'] ?? ''];
  const taSetiLayout = gameState.taSetiLayout;
  const canAdvancePriest = taSetiLayout && priestPos.some(p => getValidPriestDestinations(p, taSetiLayout).length > 0);

  {
    const moveCandidates = [];
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
        let score = 0;
        if (isTemple) score += 20;
        if (existingFriendly > 0) score += 3;
        for (const templeId of TEMPLES) {
          if ((ZONE_ADJACENCY[adjZoneId] || []).includes(templeId)) {
            const templeUnits = boardUnits[templeId] || {};
            const templeEmpty = !Object.values(templeUnits).some(n => n > 0);
            if (templeEmpty) score += 5;
          }
        }
        moveCandidates.push({ fromZoneId, toZoneId: adjZoneId, count: canAdd, score });
      }
    }
    if (moveCandidates.length > 0) {
      moveCandidates.sort((a, b) => b.score - a.score);
      const best = moveCandidates[0];
      // Si un prêtre peut avancer sur Ta-Seti, on se déplace même avec score=0
      if (best.score > 0 || canAdvancePriest) {
        return { type: "move1", sourceZoneId: best.fromZoneId, targetZoneId: best.toZoneId, count: best.count };
      }
    }
  }

  // ── 5. PRIÈRE (fallback) ──────────────────────────────────────────────────
  return { type: ank <= 7 ? "prayer2" : "prayer3" };
}

// Combat : choisit les cartes
export function aiChooseCombatCards(availableCards) {
  if (availableCards.length < 2) return null;
  const sorted = [...availableCards].sort((a, b) => {
    const ca = COMBAT_CARDS.find(c => c.id === a);
    const cb = COMBAT_CARDS.find(c => c.id === b);
    return (cb?.force ?? 0) - (ca?.force ?? 0);
  });
  // Utiliser la carte du 1er tiers (force élevée), défausser la plus faible
  const combatCard = sorted[Math.floor(sorted.length / 3)];
  const discardCard = sorted[sorted.length - 1];
  if (combatCard === discardCard) return { combatCard: sorted[0], discardCard: sorted[1] };
  return { combatCard, discardCard };
}

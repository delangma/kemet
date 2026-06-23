import { POWER_TILES, getPlayerPyramidLevel } from "../constants/powerTiles";

// C1 → Rouge pyramid, C2 → Bleu, C3 → Blanc (matches Lobby slot P1/P2/P3)
const CITY_SUFFIX_TO_COLOR = { C1: "Rouge", C2: "Bleu", C3: "Blanc" };

// Compute temporary VP for a player from current board state:
// +1 per non-blue temple controlled
// +1 per pyramid at or above threshold (4 normally, 3 with "Pyramide Niv.3"), if no enemy in city zone
export function computeTempVP(playerId, gameState, allPlayers) {
  const player = allPlayers.find(p => p.id === playerId);
  if (!player) return 0;

  const { color: playerColor, joinOrder } = player;
  const boardUnits = gameState?.boardUnits || {};
  const pyramids = gameState?.pyramids || {};
  const ownedTileIds = gameState?.players?.[playerId]?.ownedTileIds || [];

  let temp = 0;

  // Non-blue temples
  ["T1", "T2", "T3"].forEach(tid => {
    if ((boardUnits[tid]?.[playerColor] || 0) > 0) temp++;
  });

  // Pyramid VP threshold: 3 if player has "Pyramide Niv.3", otherwise 4
  const hasPyrNiv3 = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Pyramide Niv.3");
  const pyrVPThreshold = hasPyrNiv3 ? 3 : 4;

  Object.entries(CITY_SUFFIX_TO_COLOR).forEach(([suffix, color]) => {
    const level = getPlayerPyramidLevel(playerId, color, pyramids);
    if (level >= pyrVPThreshold) {
      const zoneId = `J${joinOrder}${suffix}`;
      const zoneUnits = boardUnits[zoneId] || {};
      const hasEnemy = Object.entries(zoneUnits).some(
        ([c, count]) => c !== playerColor && count > 0
      );
      if (!hasEnemy) temp++;
    }
  });

  return temp;
}

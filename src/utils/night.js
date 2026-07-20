// Détermine, pour la phase de nuit, quels joueurs contrôlent T3/TB et ont un
// sacrifice optionnel à décider. Partagé entre GameScreen (création du noeud
// Firebase rooms/{roomCode}/night) et NightModal (affichage/résolution) pour
// éviter que les deux calculs divergent.
export function getZoneController(boardUnits, zoneId, allPlayers) {
  const units = boardUnits?.[zoneId] || {};
  for (const p of allPlayers) {
    if ((units[p.color] || 0) > 0) return p;
  }
  return null;
}

export function computeNightTempleChoices(boardUnits, allPlayers) {
  const t3Controller = getZoneController(boardUnits, "T3", allPlayers);
  const tbController = getZoneController(boardUnits, "TB", allPlayers);
  const t3Units = t3Controller ? (boardUnits?.T3?.[t3Controller.color] || 0) : 0;
  const tbUnits = tbController ? (boardUnits?.TB?.[tbController.color] || 0) : 0;
  const canT3Sacrifice = t3Units >= 1;
  const canTbSacrifice = tbUnits >= 2;

  return {
    t3: t3Controller && canT3Sacrifice
      ? { controllerId: t3Controller.id, ready: false, sacrifice: false }
      : null,
    tb: tbController && canTbSacrifice
      ? { controllerId: tbController.id, ready: false, sacrifice: false }
      : null,
  };
}

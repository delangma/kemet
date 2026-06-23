import { RIVER_ZONES } from "./board";

// Pouvoirs des créatures. Ajoutez ici au fur et à mesure.
// Chaque entrée peut avoir :
//   combatForce    : bonus de force en combat (number)
//   movementBonus  : points de déplacement supplémentaires (number)
//   nullifiesEnemy : annule les capacités de la créature adverse en combat (bool)

// Bonus de combat apportés par les tuiles Pouvoir permanentes (non-créature).
// attackForce  : force supplémentaire uniquement quand le joueur est attaquant
// defenseForce : force supplémentaire uniquement quand le joueur est défenseur
// force        : force supplémentaire dans tous les combats
// shields      : boucliers supplémentaires dans tous les combats
// blood        : sang (dégâts) supplémentaires dans tous les combats
export const POWER_TILE_COMBAT_BONUSES = {
  "Force en attaque":    { attackForce: 1 },
  "Force en défense":    { defenseForce: 1 },
  "Goutte de sang":      { blood: 1 },
  "Force":               { force: 1 },
  "Force et Saignement": { attackForce: 1, blood: 1, unblockableBlood: 1 },
  "Bouclier":            { shields: 1 },
  "Defense Sang Noir":   { defenseForce: 1, defenseBlood: 1 },
  "Furie Bestiale":      { force: 1, blood: 1 },
  "Carte Sang 3*3":      { blood: 3 },
  "Carte Bouclier 3*3":  { shields: 3 },
};

export function getPowerTileCombatBonus(ownedTileIds, isAttacker, powerTiles) {
  let force = 0, shields = 0, blood = 0, unblockableBlood = 0;
  for (const id of (ownedTileIds || [])) {
    const tile = powerTiles.find(t => t.id === id);
    if (!tile) continue;
    const bonus = POWER_TILE_COMBAT_BONUSES[tile.name];
    if (!bonus) continue;
    if (bonus.force)          force           += bonus.force;
    if (bonus.attackForce  && isAttacker)  force   += bonus.attackForce;
    if (bonus.defenseForce && !isAttacker) force   += bonus.defenseForce;
    if (bonus.shields)        shields         += bonus.shields;
    if (bonus.blood)          blood           += bonus.blood;
    if (bonus.defenseBlood && !isAttacker) blood  += bonus.defenseBlood;
    if (bonus.unblockableBlood) unblockableBlood += bonus.unblockableBlood;
  }
  return { force, shields, blood, unblockableBlood };
}

export const CREATURE_POWERS = {
  "Serpent": {
    combatForce: 1,
    movementBonus: 1,
    nullifiesEnemy: true,
  },
  "Dévoreuse des Mondes": {
    combatForce: 2,
    movementBonus: 1,
    fireRainProtection: true,
    onWinBloodBonus: { minBlood: 2, vp: 1 },
  },
  "Bouliste": {
    combatForce: 1,
    movementBonus: 1,
    zoneMaxUnits: 7,
  },
  "Éléphant": {
    combatForce: 1,
    movementBonus: 1,
    combatShields: 1,
  },
  "Sphinx": {
    combatForce: 2,
    movementBonus: 1,
    vpOnPurchase: 1,
  },
  "Scorpion": {
    combatForce: 2,
    movementBonus: 2,
    combatBlood: 2,
  },
  "Scarabée": {
    combatForce: 2,
    movementBonus: 2,
  },
  "Momie": {
    combatForce: 2,
    movementBonus: 1,
    idCardsOnPurchase: 1,
    idCardsPerNight: 1,
  },
  "Sphinx Volant": {
    combatForce: 2,
    teleportFromObelisk: true,
  },
  "Meduse": {
    combatForce: 1,
    combatBlood: 1,
    nullifiesEnemyShields: true,
  },
  "Bouquetin": {
    combatForce: 1,
    movementBonus: 1,
    // L'attaquant doit payer 2 ank pour entrer dans la zone où le Bouquetin est présent
    attackerAnkCost: 2,
  },
  "Minotaure": {
    combatForce: 1,
    movementBonus: 1,
    nullifiesAllBloodExceptCards: true,
  },
  "Chiron": {
    combatForce: 1,
    movementBonus: 1,
    allowsSecondCreature: true,
  },
  "Kraken": {
    reserveOnly: true,
    riverBonus: true,
  },
  "Cerbère": {
    immovable: true,
    blockEnemyEntry: true,
    minUnitsInZone: 1,
    placeOnAnyZone: true,
    returnToMarketOnNight: true,
  },
  "Phoenix": {
    combatForce: 1,
    movementBonus: 1,
    wallPass: true,
  },
};

/**
 * Retourne les bonus de combat pour un joueur donné.
 * @param {string} playerId
 * @param {string} enemyPlayerId
 * @param {string} zoneId         - zone du combat
 * @param {object} creatureAssignments - gameState.creatureAssignments
 * @param {object} players        - gameState.players (pour récupérer la couleur)
 * @param {object} powerTiles     - tableau POWER_TILES
 * @returns {{ force: number, nullified: boolean }}
 *   force    = bonus total de force pour ce joueur dans ce combat
 *   nullified = true si la créature de ce joueur est annulée (par un Serpent adverse)
 */
export function getCombatCreatureBonus(playerId, enemyPlayerId, zoneId, creatureAssignments, players, powerTiles, creatureAssignments2 = {}) {
  const myColor    = players?.[playerId]?.color;
  const enemyColor = players?.[enemyPlayerId]?.color;

  const myTileId    = creatureAssignments?.[zoneId]?.[myColor];
  const myTileId2   = creatureAssignments2?.[zoneId]?.[myColor];
  const enemyTileId  = creatureAssignments?.[zoneId]?.[enemyColor];
  const enemyTileId2 = creatureAssignments2?.[zoneId]?.[enemyColor];

  const myCreatureName    = myTileId    ? powerTiles.find(t => t.id === myTileId)?.name    : null;
  const myCreatureName2   = myTileId2   ? powerTiles.find(t => t.id === myTileId2)?.name   : null;
  const enemyCreatureName = enemyTileId ? powerTiles.find(t => t.id === enemyTileId)?.name : null;
  const enemyCreatureName2 = enemyTileId2 ? powerTiles.find(t => t.id === enemyTileId2)?.name : null;

  const myPower    = myCreatureName    ? CREATURE_POWERS[myCreatureName]    : null;
  const myPower2   = myCreatureName2   ? CREATURE_POWERS[myCreatureName2]   : null;
  const enemyPower  = enemyCreatureName  ? CREATURE_POWERS[enemyCreatureName]  : null;
  const enemyPower2 = enemyCreatureName2 ? CREATURE_POWERS[enemyCreatureName2] : null;

  const nullified                    = !!(enemyPower?.nullifiesEnemy              || enemyPower2?.nullifiesEnemy);
  const shieldsNullifiedByEnemy      = !!(enemyPower?.nullifiesEnemyShields       || enemyPower2?.nullifiesEnemyShields);
  const allBloodNullifiedByEnemy     = !!(enemyPower?.nullifiesAllBloodExceptCards || enemyPower2?.nullifiesAllBloodExceptCards);
  const creatureBloodNullifiedByEnemy = !!(
    enemyPower?.nullifiesEnemyCreatureBlood || enemyPower2?.nullifiesEnemyCreatureBlood ||
    allBloodNullifiedByEnemy
  );

  // Kraken : +1 force si le joueur possède la tuile Kraken et combat en zone fleuve (non annulable)
  const myOwnedTileIds = players?.[playerId]?.ownedTileIds || [];
  const ownsKraken = myOwnedTileIds.some(id => powerTiles.find(t => t.id === id)?.name === "Kraken");
  const krakenBonus = (ownsKraken && RIVER_ZONES.has(zoneId)) ? 1 : 0;

  const force   = (nullified ? 0 : ((myPower?.combatForce   ?? 0) + (myPower2?.combatForce   ?? 0))) + krakenBonus;
  const shields = (nullified || shieldsNullifiedByEnemy) ? 0 : ((myPower?.combatShields ?? 0) + (myPower2?.combatShields ?? 0));
  const blood   = (nullified || creatureBloodNullifiedByEnemy) ? 0 : ((myPower?.combatBlood ?? 0) + (myPower2?.combatBlood ?? 0));

  return { force, shields, blood, nullified, shieldsNullifiedByEnemy, creatureBloodNullifiedByEnemy, allBloodNullifiedByEnemy, myCreatureName, myCreatureName2, enemyCreatureName, krakenBonus };
}

/**
 * Retourne true si la zone contient un Cerbère adverse (bloquant l'entrée ennemie).
 */
export function hasEnemyCerbereInZone(zoneId, myColor, creatureAssignments, powerTiles) {
  const colorMap = creatureAssignments?.[zoneId] || {};
  return Object.entries(colorMap).some(([color, tileId]) => {
    if (color === myColor) return false;
    const name = powerTiles.find(t => t.id === tileId)?.name;
    return !!(name && CREATURE_POWERS[name]?.blockEnemyEntry);
  });
}

/**
 * Retourne le bonus de déplacement lié à la créature qui accompagne les troupes.
 */
export function getMovementCreatureBonus(creatureName) {
  return CREATURE_POWERS[creatureName]?.movementBonus ?? 0;
}

/**
 * Retourne la capacité maximale d'unités pour un joueur dans une zone.
 * @param {string}  zoneId
 * @param {string}  playerColor
 * @param {object}  creatureAssignments  - gameState.creatureAssignments
 * @param {object}  players              - gameState.players
 * @param {Array}   powerTiles           - POWER_TILES
 * @param {string}  movingCreatureName   - nom de la créature en train de se déplacer vers cette zone (ou null)
 * @param {number}  defaultMax           - MAX_UNITS_PER_ZONE (5)
 */
export function getZoneMaxUnits(zoneId, playerColor, creatureAssignments, players, powerTiles, movingCreatureName, defaultMax) {
  // Bouliste déjà dans la zone ?
  const tileId = creatureAssignments?.[zoneId]?.[playerColor];
  const existingName = tileId ? powerTiles.find(t => t.id === tileId)?.name : null;
  const existing = existingName ? CREATURE_POWERS[existingName]?.zoneMaxUnits : null;
  if (existing) return existing;

  // Bouliste en train d'arriver dans la zone ?
  const arriving = movingCreatureName ? CREATURE_POWERS[movingCreatureName]?.zoneMaxUnits : null;
  if (arriving) return arriving;

  // Légion : +2 unités max pour ce joueur dans toutes ses zones
  const playerEntry = Object.values(players || {}).find(p => p.color === playerColor);
  const legionBonus = (playerEntry?.ownedTileIds || []).some(
    id => powerTiles.find(t => t.id === id)?.name === "Légion"
  ) ? 2 : 0;

  return defaultMax + legionBonus;
}

/**
 * Indique si une zone est protégée contre la pluie de feu pour un joueur donné.
 * Protection via tuile permanente (B_1_3) OU via Dévoreuse des Mondes dans la zone.
 */
export function hasFireRainProtection(targetZoneId, targetColor, creatureAssignments, players, powerTiles, ownedTileIds) {
  const hasTile = ownedTileIds?.some(id => powerTiles.find(t => t.id === id)?.name === "Protection pluie de feu");
  if (hasTile) return true;
  const tileId = creatureAssignments?.[targetZoneId]?.[targetColor];
  const name = tileId ? powerTiles.find(t => t.id === tileId)?.name : null;
  return !!(name && CREATURE_POWERS[name]?.fireRainProtection);
}

/**
 * Calcule le résultat complet d'un combat révélé.
 * combatCards : tableau COMBAT_CARDS (importé côté appelant).
 * Retourne toutes les valeurs utiles : vainqueur, dégâts, unités survivantes, forces.
 */
export function getCombatResult(combat, gameState, powerTiles, combatCards = []) {
  if (!combat) return null;
  const { attacker, defender, zoneId, choices } = combat;
  const players           = gameState?.players           || {};
  const creatureAssignments  = gameState?.creatureAssignments  || {};
  const creatureAssignments2 = gameState?.creatureAssignments2 || {};
  const boardUnits           = gameState?.boardUnits           || {};

  const bonusA = getCombatCreatureBonus(attacker, defender, zoneId, creatureAssignments, players, powerTiles, creatureAssignments2);
  const bonusD = getCombatCreatureBonus(defender, attacker, zoneId, creatureAssignments, players, powerTiles, creatureAssignments2);

  const tilesBonusA = getPowerTileCombatBonus(players[attacker]?.ownedTileIds, true,  powerTiles);
  const tilesBonusD = getPowerTileCombatBonus(players[defender]?.ownedTileIds, false, powerTiles);

  const cardA = combatCards.find(c => c.id === choices?.[attacker]?.combatCard) || null;
  const cardD = combatCards.find(c => c.id === choices?.[defender]?.combatCard) || null;

  // Bonus cartes ID (force / boucliers / sang)
  function idBonus(pid) {
    let force = 0, blood = 0, shields = 0;
    (choices?.[pid]?.idCards || []).forEach(card => {
      const e = card?.effect;
      if (!e) return;
      if (e.type === 'force')   force   += e.value || 0;
      if (e.type === 'blood')   blood   += e.value || 0;
      if (e.type === 'shields') shields += e.value || 0;
    });
    return { force, blood, shields };
  }

  const idA = idBonus(attacker);
  const idD = idBonus(defender);

  // Unités présentes dans la zone de combat
  const colorA = players?.[attacker]?.color;
  const colorD = players?.[defender]?.color;
  const unitsA = boardUnits[zoneId]?.[colorA] || 0;
  const unitsD = boardUnits[zoneId]?.[colorD] || 0;

  // Blessure Divine : cartes de main défaussées après révélation → +1 force/carte
  const blessureA = choices?.[attacker]?.blessureCards ?? 0;
  const blessureD = choices?.[defender]?.blessureCards ?? 0;

  // Bonus Ta-Seti (stockés dans le state joueur, consommés après combat)
  const tasetiForceA   = players[attacker]?.tasetiForce   ?? 0;
  const tasetiForceD   = players[defender]?.tasetiForce   ?? 0;
  const tasetiBloodA   = players[attacker]?.tasetiBlood   ?? 0;
  const tasetiBloodD   = players[defender]?.tasetiBlood   ?? 0;
  const tasetiShieldsA = players[attacker]?.tasetiShields ?? 0;
  const tasetiShieldsD = players[defender]?.tasetiShields ?? 0;

  // Force totale = unités + carte + créatures + cartes ID + tuiles permanentes + blessure divine + Ta-Seti
  const forceA = unitsA + (cardA?.force ?? 0) + bonusA.force + idA.force + tilesBonusA.force + blessureA + tasetiForceA;
  const forceD = unitsD + (cardD?.force ?? 0) + bonusD.force + idD.force + tilesBonusD.force + blessureD + tasetiForceD;

  // Égalité → défenseur gagne
  const winnerId = forceA > forceD ? attacker : defender;
  const loserId  = winnerId === attacker ? defender : attacker;
  const winnerBonus = winnerId === attacker ? bonusA : bonusD;

  // Calcul des dégâts
  // bonusA.blood est déjà 0 si creatureBloodNullifiedByEnemy (Minotaure côté D)
  // allBloodNullifiedByEnemy nullifie en plus le sang des tuiles permanentes
  const bloodA = (cardA?.blood ?? 0) + bonusA.blood + idA.blood + (bonusD.allBloodNullifiedByEnemy ? 0 : tilesBonusA.blood) + tasetiBloodA;
  const bloodD = (cardD?.blood ?? 0) + bonusD.blood + idD.blood + (bonusA.allBloodNullifiedByEnemy ? 0 : tilesBonusD.blood) + tasetiBloodD;
  const shieldsA = bonusA.shieldsNullifiedByEnemy ? 0 : (cardA?.shields ?? 0) + bonusA.shields + idA.shields + tilesBonusA.shields + tasetiShieldsA;
  const shieldsD = bonusD.shieldsNullifiedByEnemy ? 0 : (cardD?.shields ?? 0) + bonusD.shields + idD.shields + tilesBonusD.shields + tasetiShieldsD;

  // "Aucun Saignement" : aucune perte si le joueur QUI joue la carte gagne
  const noBloodA = winnerId === attacker && (choices?.[attacker]?.idCards || []).some(c => c?.effect?.type === 'no_damage_if_win');
  const noBloodD = winnerId === defender && (choices?.[defender]?.idCards || []).some(c => c?.effect?.type === 'no_damage_if_win');

  // Sang inévitable (sang noir) : bypass boucliers et cartes "aucun saignement"
  const unblockableBloodA = tilesBonusA.unblockableBlood ?? 0;
  const unblockableBloodD = tilesBonusD.unblockableBlood ?? 0;

  const attackerDamage = (noBloodA ? 0 : Math.max(0, bloodD - shieldsA)) + unblockableBloodD;
  const defenderDamage = (noBloodD ? 0 : Math.max(0, bloodA - shieldsD)) + unblockableBloodA;

  const attackerUnitsAfter = Math.max(0, unitsA - attackerDamage);
  const defenderUnitsAfter = Math.max(0, unitsD - defenderDamage);

  return {
    winnerId,
    loserId,
    winnerCreatureName: winnerBonus.myCreatureName,
    winnerCardId: choices?.[winnerId]?.combatCard,
    winnerNullified: winnerBonus.nullified,
    // Forces détaillées
    forceA, forceD,
    unitsA, unitsD,
    // Dégâts
    attackerDamage, defenderDamage,
    attackerUnitsAfter, defenderUnitsAfter,
    winnerBonus, loserBonus: winnerId === attacker ? bonusD : bonusA,
    colorA, colorD,
  };
}

import { POWER_TILES } from "../constants/powerTiles";
import { ref, update, get } from "firebase/database";

/**
 * Clé unique pour une combinaison de 2 tuiles (IDs triés pour éviter les doublons).
 */
export function comboPairKey(id1, id2) {
  return [id1, id2].sort().join("-");
}

/**
 * Génère toutes les combinaisons de 2 tuiles (sans répétition).
 * C(77, 2) = 2926 combinaisons.
 */
export function getAllCombinations() {
  const combos = [];
  for (let i = 0; i < POWER_TILES.length; i++) {
    for (let j = i + 1; j < POWER_TILES.length; j++) {
      const t1 = POWER_TILES[i];
      const t2 = POWER_TILES[j];
      combos.push({ id1: t1.id, id2: t2.id, key: comboPairKey(t1.id, t2.id) });
    }
  }
  return combos;
}

/**
 * Initialise les deux tables dans Firebase (une seule fois).
 * - tileRatings/   : une entrée par tuile (rating: null)
 * - tileCombinations/ : une entrée par paire (rating: null)
 *
 * Utilise update() pour ne pas écraser les notes déjà présentes.
 */
export async function initTileRatingsDB(db) {
  const snapshot = await get(ref(db, "tileRatings"));
  const existingTiles = snapshot.exists() ? snapshot.val() : {};

  const snapshot2 = await get(ref(db, "tileCombinations"));
  const existingCombos = snapshot2.exists() ? snapshot2.val() : {};

  const updates = {};

  // Tuiles
  for (const tile of POWER_TILES) {
    if (!existingTiles[tile.id]) {
      updates[`tileRatings/${tile.id}`] = {
        id: tile.id,
        name: tile.name,
        color: tile.color,
        level: tile.level,
        cost: tile.cost,
        type: tile.type,
        ratingEarly: 3,
        ratingLate: 3,
        temporality: 3,
      };
    }
  }

  // Combinaisons
  for (const { id1, id2, key } of getAllCombinations()) {
    if (!existingCombos[key]) {
      updates[`tileCombinations/${key}`] = {
        id1,
        id2,
        ratingEarly: 3,
        ratingLate: 3,
        temporality: 3,
        buyPriority: 3,
        priorityTile: 1,
      };
    }
  }

  if (Object.keys(updates).length === 0) {
    return { tilesAdded: 0, combosAdded: 0 };
  }

  await update(ref(db, "/"), updates);

  const tilesAdded = Object.keys(updates).filter(k => k.startsWith("tileRatings/")).length;
  const combosAdded = Object.keys(updates).filter(k => k.startsWith("tileCombinations/")).length;
  return { tilesAdded, combosAdded };
}

/**
 * Met à jour un champ de note d'une tuile.
 * @param {string} field - "ratingEarly" | "ratingLate" | "temporality"
 */
export async function setTileRating(db, tileId, field, value) {
  await update(ref(db, `tileRatings/${tileId}`), { [field]: value });
}

/**
 * Met à jour un champ d'une combinaison.
 * @param {string} field - "ratingEarly" | "ratingLate" | "temporality" | "buyPriority" | "priorityTile"
 */
export async function setComboField(db, id1, id2, field, value) {
  const key = comboPairKey(id1, id2);
  await update(ref(db, `tileCombinations/${key}`), { [field]: value });
}

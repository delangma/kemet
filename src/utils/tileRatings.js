import { POWER_TILES, isGrayTokenTile } from "../constants/powerTiles";
import { ref, update, get } from "firebase/database";

/**
 * Clé unique pour une combinaison de 2 tuiles (IDs triés pour éviter les doublons).
 */
export function comboPairKey(id1, id2) {
  return [id1, id2].sort().join("-");
}

/**
 * Paires de tuiles impossibles à posséder ensemble → combinaison sans objet :
 * - deux tuiles du même nom
 * - deux tuiles "Point Majeur" (type vp, une seule autorisée par joueur)
 * - deux "Jetons gris" (un seul autorisé par joueur)
 */
export function isExcludedComboPair(t1, t2) {
  if (!t1 || !t2) return false;
  if (t1.name === t2.name) return true;
  if (t1.type === "vp" && t2.type === "vp") return true;
  if (isGrayTokenTile(t1) && isGrayTokenTile(t2)) return true;
  return false;
}

/**
 * Génère toutes les combinaisons de 2 tuiles (sans répétition),
 * paires impossibles exclues (voir isExcludedComboPair).
 */
export function getAllCombinations() {
  const combos = [];
  for (let i = 0; i < POWER_TILES.length; i++) {
    for (let j = i + 1; j < POWER_TILES.length; j++) {
      const t1 = POWER_TILES[i];
      const t2 = POWER_TILES[j];
      if (isExcludedComboPair(t1, t2)) continue;
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

  // Combinaisons : une note unique + tuile prioritaire
  for (const { id1, id2, key } of getAllCombinations()) {
    if (!existingCombos[key]) {
      updates[`tileCombinations/${key}`] = {
        id1,
        id2,
        rating: 3,
        priorityTile: 1,
      };
    }
  }

  // Purge les combinaisons sans objet (même nom, deux Points Majeurs)
  for (const [key, c] of Object.entries(existingCombos)) {
    const t1 = POWER_TILES.find(t => t.id === c.id1);
    const t2 = POWER_TILES.find(t => t.id === c.id2);
    if (isExcludedComboPair(t1, t2)) updates[`tileCombinations/${key}`] = null;
  }

  if (Object.keys(updates).length === 0) {
    return { tilesAdded: 0, combosAdded: 0, combosRemoved: 0 };
  }

  await update(ref(db, "/"), updates);

  const tilesAdded = Object.keys(updates).filter(k => k.startsWith("tileRatings/")).length;
  const combosAdded = Object.entries(updates).filter(([k, v]) => k.startsWith("tileCombinations/") && v !== null).length;
  const combosRemoved = Object.entries(updates).filter(([k, v]) => k.startsWith("tileCombinations/") && v === null).length;
  return { tilesAdded, combosAdded, combosRemoved };
}

/**
 * Met à jour un champ de note d'une tuile.
 * Le flag `rated` marque la tuile comme renseignée (vs valeur par défaut).
 * Absence de flag = renseignée (les tuiles historiques l'étaient toutes).
 * @param {string} field - "ratingEarly" | "ratingLate" | "temporality"
 */
export async function setTileRating(db, tileId, field, value) {
  await update(ref(db, `tileRatings/${tileId}`), { [field]: value, rated: true });
}

/**
 * Remet une tuile à son paramétrage par défaut (notes 3, flag "par défaut").
 * `rated: false` doit être explicite : sans flag, une tuile est considérée renseignée.
 */
export async function resetTileRating(db, tileId) {
  await update(ref(db, `tileRatings/${tileId}`), {
    ratingEarly: 3,
    ratingLate: 3,
    temporality: 3,
    rated: false,
  });
}

/**
 * Remet une combinaison à son paramétrage par défaut, ainsi que toutes les
 * paires équivalentes par nom (même logique de propagation que setComboField).
 */
export async function resetCombo(db, id1, id2) {
  const tile1 = POWER_TILES.find(t => t.id === id1);
  const tile2 = POWER_TILES.find(t => t.id === id2);
  if (isExcludedComboPair(tile1, tile2)) return; // combo sans objet
  const name1 = tile1?.name;
  const name2 = tile2?.name;
  const ids1 = name1 ? POWER_TILES.filter(t => t.name === name1).map(t => t.id) : [id1];
  const ids2 = name2 ? POWER_TILES.filter(t => t.name === name2).map(t => t.id) : [id2];
  const orderIndex = id => POWER_TILES.findIndex(t => t.id === id);

  const updates = {};
  for (const a of ids1) {
    for (const b of ids2) {
      if (a === b) continue;
      const key = comboPairKey(a, b);
      const [first, second] = orderIndex(a) < orderIndex(b) ? [a, b] : [b, a];
      updates[`tileCombinations/${key}`] = {
        id1: first,
        id2: second,
        rating: 3,
        priorityTile: 1,
        rated: false,
      };
    }
  }
  await update(ref(db, "/"), updates);
}

/**
 * Met à jour un champ d'une combinaison, et propage la modification à toutes
 * les paires équivalentes par nom. Certaines tuiles existent en plusieurs
 * exemplaires avec le même nom (ex: "Force en attaque" = R_1_2 et R_1_3) :
 * noter "Déplacement – Force en attaque" doit remplir les combos avec chaque
 * exemplaire, sinon la combinaison apparaît vide vue depuis l'autre tuile.
 * @param {string} field - "rating" | "priorityTile"
 */
export async function setComboField(db, id1, id2, field, value) {
  const tile1 = POWER_TILES.find(t => t.id === id1);
  const tile2 = POWER_TILES.find(t => t.id === id2);
  if (isExcludedComboPair(tile1, tile2)) return; // combo sans objet
  const name1 = tile1?.name;
  const name2 = tile2?.name;
  const ids1 = name1 ? POWER_TILES.filter(t => t.name === name1).map(t => t.id) : [id1];
  const ids2 = name2 ? POWER_TILES.filter(t => t.name === name2).map(t => t.id) : [id2];

  // priorityTile vaut 1 (= id1) ou 2 (= id2) : pour les paires équivalentes, on
  // traduit par nom — la valeur désigne la même tuile logique dans chaque paire.
  const priorityName = field === "priorityTile" && value != null
    ? (value === 1 ? name1 : name2)
    : null;
  const orderIndex = id => POWER_TILES.findIndex(t => t.id === id);

  const updates = {};
  for (const a of ids1) {
    for (const b of ids2) {
      if (a === b) continue;
      const key = comboPairKey(a, b);
      // id1/id2 suivent l'ordre du tableau POWER_TILES (comme initTileRatingsDB)
      const [first, second] = orderIndex(a) < orderIndex(b) ? [a, b] : [b, a];
      let v = value;
      if (priorityName !== null && name1 !== name2) {
        v = POWER_TILES.find(t => t.id === first)?.name === priorityName ? 1 : 2;
      }
      updates[`tileCombinations/${key}/id1`] = first;
      updates[`tileCombinations/${key}/id2`] = second;
      updates[`tileCombinations/${key}/${field}`] = v;
      // Flag "renseignée" (vs valeur par défaut) — absence de flag = par défaut
      updates[`tileCombinations/${key}/rated`] = true;
    }
  }
  await update(ref(db, "/"), updates);
}

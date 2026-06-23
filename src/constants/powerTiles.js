export const POWER_TILES = [
  // Rouge Niveau 1
  { id: "R_1_1", name: "Déplacement",          color: "Rouge", level: 1, cost: 1, type: "permanant" },
  { id: "R_1_2", name: "Force en attaque",      color: "Rouge", level: 1, cost: 1, type: "permanent" },
  { id: "R_1_3", name: "Force en attaque",      color: "Rouge", level: 1, cost: 1, type: "permanent" },
  { id: "R_1_4", name: "Réduction Téléportation", color: "Rouge", level: 1, cost: 1, type: "permanent" },
  // Rouge Niveau 2
  { id: "R_2_2", name: "Passe muraille",        color: "Rouge", level: 2, cost: 2, type: "permanent" },
  { id: "R_2_3", name: "Goutte de sang",        color: "Rouge", level: 2, cost: 2, type: "permanent" },
  { id: "R_2_4", name: "Avancée sur taseti",    color: "Rouge", level: 2, cost: 2, type: "permanent" },
  { id: "R_2_5", name: "Carte Sang 3*3",        color: "Rouge", level: 2, cost: 2, type: "permanent" },
  { id: "R_2_6", name: "Téléportation facile",        color: "Rouge", level: 2, cost: 2, type: "permanent" },
  { id: "R_2_7", name: "Cerbère",        color: "Rouge", level: 2, cost: 2, type: "creature" },
  { id: "R_2_1", name: "Phoenix",        color: "Rouge", level: 2, cost: 2, type: "creature" },
  // Rouge Niveau 3s
  { id: "R_3_1", name: "Scarabée",              color: "Rouge", level: 3, cost: 3, type: "creature" },
  { id: "R_3_2", name: "Force",                 color: "Rouge", level: 3, cost: 3, type: "permanent" },
  { id: "R_3_3", name: "Point Rouge Majeur",    color: "Rouge", level: 3, cost: 3, type: "vp", vpOnPurchase: 1 },
  { id: "R_3_4", name: "Force par ID",          color: "Rouge", level: 3, cost: 3, type: "permanent" },
  { id: "R_3_5", name: "Meduse",                color: "Rouge", level: 3, cost: 3, type: "creature" },
  // Rouge Niveau 4
  { id: "R_4_1", name: "Déplacement Passe/Muraille", color: "Rouge", level: 4, cost: 4, type: "token" },
  { id: "R_4_2", name: "Scorpion",              color: "Rouge", level: 4, cost: 4, type: "creature" },
  { id: "R_4_3", name: "Jeton gris",            color: "Rouge", level: 4, cost: 4, type: "token" },
  { id: "R_4_4", name: "Force et Saignement",   color: "Rouge", level: 4, cost: 4, type: "permanent" },

  // Bleu Niveau 1
  { id: "B_1_1", name: "Force en défense",          color: "Bleu", level: 1, cost: 1, type: "permanent" },
  { id: "B_1_2", name: "Force en défense",           color: "Bleu", level: 1, cost: 1, type: "permanent" },
  { id: "B_1_3", name: "Protection pluie de feu",   color: "Bleu", level: 1, cost: 1, type: "permanent" },
  { id: "B_1_4", name: "Recrutement + 2",            color: "Bleu", level: 1, cost: 1, type: "permanent", unitsOnPurchase: 2 },
  { id: "B_1_5", name: "Recrutement + 2",            color: "Bleu", level: 1, cost: 1, type: "permanent", unitsOnPurchase: 2 },
  // Bleu Niveau 2
  { id: "B_2_1", name: "Éléphant",                  color: "Bleu", level: 2, cost: 2, type: "creature" },
  { id: "B_2_2", name: "Kraken",                    color: "Bleu", level: 2, cost: 2, type: "creature" },
  { id: "B_2_3", name: "Bouclier",                  color: "Bleu", level: 2, cost: 2, type: "permanent" },
  { id: "B_2_4", name: "Carte Bouclier 3*3",        color: "Bleu", level: 2, cost: 2, type: "permanent" },
  { id: "B_2_5", name: "Serpent",                   color: "Bleu", level: 2, cost: 2, type: "creature" },
  // Bleu Niveau 3
  { id: "B_3_1", name: "Préscience",                color: "Bleu", level: 3, cost: 3, type: "permanent" },
  { id: "B_3_2", name: "Victoire Défensive",        color: "Bleu", level: 3, cost: 3, type: "permanent" },
  { id: "B_3_3", name: "Point Bleu Majeur",         color: "Bleu", level: 3, cost: 3, type: "vp", vpOnPurchase: 1 },
  { id: "B_3_4", name: "Légion",                    color: "Bleu", level: 3, cost: 3, type: "permanent" },
  { id: "B_3_5", name: "Bouliste",                  color: "Bleu", level: 3, cost: 3, type: "creature" },
  // Bleu Niveau 4
  { id: "B_4_1", name: "Sphinx",                    color: "Bleu", level: 4, cost: 4, type: "creature" },
  { id: "B_4_2", name: "Jeton doré déplacement recrutement", color: "Bleu", level: 4, cost: 4, type: "token" },
  { id: "B_4_3", name: "Jeton gris Bleu",           color: "Bleu", level: 4, cost: 4, type: "token" },
  { id: "B_4_4", name: "Renforcement 4 unités",     color: "Bleu", level: 4, cost: 4, type: "permanent", unitsOnPurchase: 4 },

  // Blanc Niveau 1
  { id: "W_1_1", name: "Priere +1 ank",    color: "Blanc", level: 1, cost: 1, type: "permanent" },
  { id: "W_1_2", name: "Priere +1 ank",    color: "Blanc", level: 1, cost: 1, type: "permanent" },
  { id: "W_1_3", name: "Cout Pouvoir -1",  color: "Blanc", level: 1, cost: 1, type: "permanent" },
  { id: "W_1_4", name: "Cout Pouvoir -1",  color: "Blanc", level: 1, cost: 1, type: "permanent" },
  // Blanc Niveau 2
  { id: "W_2_1", name: "2 Ank",                color: "Blanc", level: 2, cost: 2, type: "permanent", ankOnPurchase: 2 },
  { id: "W_2_2", name: "Chiron",               color: "Blanc", level: 2, cost: 2, type: "creature" },
  { id: "W_2_3", name: "Minotaure",            color: "Blanc", level: 2, cost: 2, type: "creature" },
  { id: "W_2_4", name: "1 Ank par unité tué",  color: "Blanc", level: 2, cost: 2, type: "permanent" },
  { id: "W_2_5", name: "+1 carte ID",          color: "Blanc", level: 2, cost: 2, type: "permanent", idCardsOnPurchase: 1, idCardsPerNight: 1 },
  { id: "W_2_6", name: "Réduction pyramide",   color: "Blanc", level: 2, cost: 2, type: "permanent" },
  // Blanc Niveau 3
  { id: "W_3_1", name: "Augmentation pyramide",   color: "Blanc", level: 3, cost: 3, type: "permanent" },
  { id: "W_3_2", name: "Choix supplémentaire ID", color: "Blanc", level: 3, cost: 3, type: "permanent" },
  { id: "W_3_3", name: "Point Blanc Majeur",      color: "Blanc", level: 3, cost: 3, type: "vp", vpOnPurchase: 1 },
  { id: "W_3_4", name: "4 ank en cas de victoire", color: "Blanc", level: 3, cost: 3, type: "permanent" },
  // Blanc Niveau 4
  { id: "W_4_1", name: "Momie",          color: "Blanc", level: 4, cost: 4, type: "creature" },
  { id: "W_4_2", name: "Jeton Gris Blanc", color: "Blanc", level: 4, cost: 4, type: "token" },
  { id: "W_4_3", name: "5 ank",          color: "Blanc", level: 4, cost: 4, type: "permanent", ankOnPurchase: 5 },
  { id: "W_4_4", name: "Réduction d'ank", color: "Blanc", level: 4, cost: 4, type: "permanent" },

  // Noir Niveau 1
  { id: "N_1_1", name: "Unité supplémentaire", color: "Noir", level: 1, cost: 1, type: "permanent", reserveOnPurchase: 3 },
  { id: "N_1_2", name: "Unité supplémentaire", color: "Noir", level: 1, cost: 1, type: "permanent", reserveOnPurchase: 3 },
  { id: "N_1_3", name: "Recrutement Local",    color: "Noir", level: 1, cost: 1, type: "permanent" },
  { id: "N_1_4", name: "Jeton doré priére",    color: "Noir", level: 1, cost: 1, type: "token" },
  // Noir Niveau 2
  { id: "N_2_1", name: "Bouquetin",             color: "Noir", level: 2, cost: 2, type: "creature" },
  { id: "N_2_2", name: "Attaque 2 ank",         color: "Noir", level: 2, cost: 2, type: "permanent" },
  { id: "N_2_3", name: "1 ank par unité perdu", color: "Noir", level: 2, cost: 2, type: "permanent" },
  { id: "N_2_4", name: "Jeton doré achat *2",   color: "Noir", level: 2, cost: 2, type: "permanent" },
  { id: "N_2_5", name: "Double point temple",   color: "Noir", level: 2, cost: 2, type: "permanent" },
  // Noir Niveau 3
  { id: "N_3_1", name: "Point Noir Majeur",  color: "Noir", level: 3, cost: 3, type: "vp", vpOnPurchase: 1 },
  { id: "N_3_2", name: "Sphinx Volant",      color: "Noir", level: 3, cost: 3, type: "creature" },
  { id: "N_3_3", name: "Jeton Doré Déplacement", color: "Noir", level: 3, cost: 3, type: "token" },
  { id: "N_3_4", name: "Defense Sang Noir",  color: "Noir", level: 3, cost: 3, type: "permanent" },
  // Noir Niveau 4
  { id: "N_4_1", name: "Dévoreuse des Mondes", color: "Noir", level: 4, cost: 4, type: "creature" },
  { id: "N_4_2", name: "Jeton Gris Noir",      color: "Noir", level: 4, cost: 4, type: "token" },
  { id: "N_4_3", name: "Furie Bestiale",        color: "Noir", level: 4, cost: 4, type: "permanent" },
  { id: "N_4_4", name: "+1 d'Ank en journée",  color: "Noir", level: 4, cost: 4, type: "permanent" },

  // Tuiles bicolores
  { id: "BI_1", name: "Prescience des IDs", color: "Rouge", level: 1, cost: 2, type: "permanent", secondaryColor: "Bleu",  secondaryLevel: 1 },
  { id: "BI_2", name: "Draft ID",           color: "Blanc", level: 2, cost: 3, type: "permanent", secondaryColor: "Rouge", secondaryLevel: 1 },
  { id: "BI_3", name: "Pyramide Niv.3",     color: "Bleu",  level: 2, cost: 4, type: "permanent", secondaryColor: "Blanc", secondaryLevel: 2 },
];

export const TILE_COLOR_STYLE = {
  Rouge: { bg: "bg-red-900/30",  border: "border-red-700/60",  text: "text-red-300",  badge: "bg-red-800"  },
  Bleu:  { bg: "bg-blue-900/30", border: "border-blue-700/60", text: "text-blue-300", badge: "bg-blue-800" },
  Blanc: { bg: "bg-gray-700/30", border: "border-gray-500/60", text: "text-gray-200", badge: "bg-gray-600" },
  Noir:  { bg: "bg-gray-900/50", border: "border-gray-600/60", text: "text-gray-300", badge: "bg-gray-800" },
};

export const TYPE_LABEL = {
  creature:  { icon: "🐉", label: "Créature" },
  permanent: { icon: "⚡", label: "Permanent" },
  vp:        { icon: "⭐", label: "Point de victoire" },
  token:     { icon: "🪙", label: "Jeton" },
};

const TILE_IMAGES = {
  "R_2_1": "/Tile_R_2_8.jpeg",
  ...Object.fromEntries([
    // Bleu
    "B_1_1","B_1_2","B_1_4","B_1_5",
    "B_2_1","B_2_2","B_2_3","B_2_4","B_2_5",
    "B_3_1","B_3_2","B_3_3","B_3_4","B_3_5",
    "B_4_1","B_4_2","B_4_3","B_4_4",
    // Noir
    "N_1_1","N_1_2","N_1_3","N_1_4",
    "N_2_1","N_2_2","N_2_3","N_2_4",
    "N_3_1","N_3_2","N_3_3","N_3_4",
    "N_4_1","N_4_2","N_4_3","N_4_4",
    // Rouge
    "R_1_1","R_1_2","R_1_3","R_1_4",
    "R_2_2","R_2_3","R_2_5","R_2_6","R_2_7",
    "R_3_1","R_3_2","R_3_3","R_3_4","R_3_5",
    "R_4_2","R_4_3","R_4_4",
    // Blanc
    "W_1_1","W_1_2","W_1_3","W_1_4",
    "W_2_1","W_2_2","W_2_3","W_2_4","W_2_5","W_2_6",
    "W_3_1","W_3_2","W_3_3","W_3_4",
    "W_4_1","W_4_2","W_4_3","W_4_4",
  ].map(id => [id, `/Tile_${id}.jpeg`])),
};

export function getTileImageUrl(id) {
  return TILE_IMAGES[id] ?? null;
}

export function getPlayerPyramidLevel(playerId, color, pyramids) {
  let max = 0;
  for (const pyr of Object.values(pyramids || {})) {
    if (pyr.color === color && pyr.controllerId === playerId) {
      max = Math.max(max, pyr.level ?? 0);
    }
  }
  return max;
}

export function getPlayerPyramidColors(playerId, pyramids) {
  const colors = new Set();
  for (const pyr of Object.values(pyramids || {})) {
    if (pyr.controllerId === playerId && pyr.color) colors.add(pyr.color);
  }
  return [...colors];
}

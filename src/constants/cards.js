// Cartes Combat — identiques pour chaque joueur
export const COMBAT_CARDS = [
  { id: 1, force: 5, blood: 0, shields: 0, effect: "lose2units" },
  { id: 2, force: 4, blood: 1, shields: 0, effect: null },
  { id: 3, force: 3, blood: 2, shields: 0, effect: null },
  { id: 4, force: 3, blood: 0, shields: 1, effect: null },
  { id: 5, force: 2, blood: 0, shields: 2, effect: null },
  { id: 6, force: 2, blood: 2, shields: 1, effect: null },
  { id: 7, force: 1, blood: 3, shields: 0, effect: null },
  { id: 8, force: 1, blood: 1, shields: 3, effect: null },
];

// Cartes Intervention Divine — pioche commune
export const ID_CARDS = [
  // Combat
  { id: "renfort_divin", name: "Renfort Divin", cost: 0, timing: "combat", effect: { type: "force", value: 1 }, quantity: 3 },
  { id: "renfort_divin_majeur", name: "Renfort Divin Majeur", cost: 1, timing: "combat", effect: { type: "force", value: 2 }, quantity: 3 },
  { id: "protection_divine", name: "Protection Divine", cost: 0, timing: "combat", effect: { type: "shields", value: 1 }, quantity: 3 },
  { id: "protection_divine_majeure", name: "Protection Divine Majeure", cost: 1, timing: "combat", effect: { type: "shields", value: 2 }, quantity: 2 },
  { id: "sang_divin", name: "Sang Divin", cost: 0, timing: "combat", effect: { type: "blood", value: 1 }, quantity: 3 },
  { id: "sang_divin_majeur", name: "Sang Divin Majeur", cost: 1, timing: "combat", effect: { type: "blood", value: 2 }, quantity: 2 },
  { id: "butin_de_guerre", name: "Butin de Guerre", cost: 0, timing: "combat", effect: { type: "ank_if_win", value: 4 }, quantity: 2 },
  { id: "recrutement_victoire", name: "Recrutement de Victoire", cost: 0, timing: "combat", effect: { type: "units_if_win", value: 3 }, quantity: 2 },
  { id: "aucun_saignement", name: "Aucun Saignement", cost: 0, timing: "combat", effect: { type: "no_damage_if_win" }, quantity: 2 },
  { id: "changement_strategie", name: "Changement de Stratégie", cost: 0, timing: "combat", effect: { type: "swap_combat_card" }, quantity: 2 },
  // Hors combat
  { id: "gain_ank", name: "Gain de 2 Ank", cost: 0, timing: "day", effect: { type: "ank", value: 2 }, quantity: 2 },
  { id: "taxation_divine", name: "Taxation Divine", cost: 0, timing: "day", effect: { type: "taxation", value: 1 }, quantity: 2 },
  { id: "renforts", name: "Renforts", cost: 0, timing: "day", effect: { type: "units", value: 2 }, quantity: 3 },
  { id: "recuperation_id", name: "Récupération d'ID", cost: 1, timing: "day", effect: { type: "recover_id" }, quantity: 2 },
  { id: "marche_forcee", name: "Marche Forcée", cost: 0, timing: "day", effect: { type: "movement", value: 1 }, quantity: 2 },
  { id: "teleportation", name: "Téléportation", cost: 1, timing: "day", effect: { type: "teleport" }, quantity: 2 },
  { id: "passe_muraille", name: "Passe-Muraille", cost: 1, timing: "day", effect: { type: "wall_pass" }, quantity: 1 },
  { id: "pluie_de_feu", name: "Pluie de Feu", cost: 1, timing: "day", effect: { type: "destroy_unit" }, quantity: 3 },
  { id: "la_fuite", name: "La Fuite", cost: 0, timing: "combat", effect: { type: "flee" }, quantity: 1 },
  { id: "annulation_id", name: "Annulation d'ID", cost: 0, timing: "any", effect: { type: "cancel_id" }, quantity: 2 },
];
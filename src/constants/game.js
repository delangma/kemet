export const ACTIONS = {
  level1: [
    { id: "move1", label: "Déplacement", level: 1 },
    { id: "recruit", label: "Recrutement", level: 1 },
  ],
  level2: [
    { id: "pyramid", label: "Évol. Pyramide", level: 2 },
    { id: "move2", label: "Déplacement", level: 2 },
    { id: "prayer2", label: "Prière", level: 2 },
  ],
  level3: [
    { id: "buy_red", label: "Achat 🔴", level: 3 },
    { id: "buy_blue", label: "Achat 🔵", level: 3 },
    { id: "buy_white", label: "Achat ⬜", level: 3 },
    { id: "buy_black", label: "Achat ⬛", level: 3 },
    { id: "prayer3", label: "Prière", level: 3 },
  ],
};

export const MAX_TOKENS = 5;
export const MAX_UNITS_PER_ZONE = 5;

export const PYRAMID_COLORS = ["red", "blue", "white"];

export const INITIAL_PLAYER_STATE = {
  ank: 7,
  vpPermanent: 0,
  tokens: MAX_TOKENS,
  usedActions: [],
  actionsThisTurn: 0,
  pyramids: { red: 0, blue: 0, white: 0 },
  combatCardsCount: 8,
  idCardsCount: 2,
  unitsReserve: 12,
  dawnTokens: 0,
};
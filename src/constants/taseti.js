// Graphe Ta-Seti — liaisons officielles
export const TASETI_GRAPH = {
  N0:  { connections: ["N11", "N12", "N13"] },
  N11: { connections: ["N21", "N22"] },
  N12: { connections: ["N21", "N22", "N23", "N24"] },
  N13: { connections: ["N23", "N24"] },
  N21: { connections: ["N31", "N32", "N33"] },
  N22: { connections: ["N32", "N33"] },
  N23: { connections: ["N32", "N33"] },
  N24: { connections: ["N32", "N33", "N34"] },
  N31: { connections: ["N5"] },
  N32: { connections: ["N31", "N34", "N5"] },
  N33: { connections: ["N31", "N34", "N5"] },
  N34: { connections: ["N5"] },
  N5:  { connections: [] },
};

// Bonus de liaison
export const TASETI_BONUSES = {
  "N0-N11":  { ank: 1, shield: 1 },
  "N0-N12":  { ank: 1 },
  "N0-N13":  { ank: 1, blood: 1 },
  "N11-N21": { movement: 1 },
  "N11-N22": { movement: 1 },
  "N13-N23": { recruit: 1 },
  "N13-N24": { recruit: 1 },
  "N21-N31": { ank: 3 },
  "N24-N34": { recruit: 3 },
  "N32-N31": { ank: 2, force: 1 },
  "N33-N31": { ank: 2, force: 1 },
  "N32-N34": { ank: 1, fire: 1 },
  "N33-N34": { ank: 1, fire: 1 },
};

// Types de récompenses par nœud
export const TASETI_REWARD_TYPES = {
  N11: "immediate",
  N12: "none",
  N13: "immediate",
  N21: "immediate",
  N22: "permanent",
  N23: "permanent",
  N24: "immediate",
  N31: "immediate_and_single_use",
  N32: "permanent",
  N33: "permanent",
  N34: "immediate_and_single_use",
  N5:  "victory_point",
};
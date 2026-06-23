// Emplacements des pyramides sur le plateau
export const PYRAMID_SLOTS = [
  // Cité J1
  { id: "J1P1", cityId: "J1", slotIndex: 0, x: 40, y: 97 },
  { id: "J1P2", cityId: "J1", slotIndex: 1, x: 46, y: 97},
  { id: "J1P3", cityId: "J1", slotIndex: 2, x: 52, y: 97 },
  // Cité J2
  { id: "J2P1", cityId: "J2", slotIndex: 0, x: 37, y: 67 },
  { id: "J2P2", cityId: "J2", slotIndex: 1, x: 41, y: 73 },
  { id: "J2P3", cityId: "J2", slotIndex: 2, x: 44, y: 67 },
  // Cité J3
  { id: "J3P1", cityId: "J3", slotIndex: 0, x: 28,  y: 30 },
  { id: "J3P2", cityId: "J3", slotIndex: 1, x: 33, y: 32 },
  { id: "J3P3", cityId: "J3", slotIndex: 2, x: 35, y: 25 },
];

export const PYRAMID_COLORS = ["Rouge", "Bleu", "Blanc","Noir"];

export const COLOR_STYLE = {
  Rouge: { bg: "#dc2626", text: "#fff", border: "#f87171" },
  Bleu:  { bg: "#2563eb", text: "#fff", border: "#60a5fa" },
  Blanc: { bg: "#e5e7eb", text: "#111", border: "#fff" },
  Noir:  { bg: "#010101", text: "#fff", border: "#60a5fa" },  
  null:  { bg: "#374151", text: "#9ca3af", border: "#6b7280" },
};
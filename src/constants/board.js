export const BOARD_ZONES = [
  { id: "TB",   label: "Temple Bleu",    x: 37, y: 12 },
  { id: "DT3",  label: "Désert TB-T3",   x: 40, y: 20 },
  { id: "T3",   label: "Temple 3",       x: 48, y: 15 },
  { id: "J3C1", label: "Cité J3 - T1",   x: 29,  y: 36 },
  { id: "J3C2", label: "Cité J3 - T2",   x: 34, y: 37 },
  { id: "J3C3", label: "Cité J3 - T3",   x: 38, y: 31 },
  { id: "J1C1", label: "Cité J1 - T1",   x: 38, y: 98 },
  { id: "J1C2", label: "Cité J1 - T2",   x: 44, y: 95 },
  { id: "J1C3", label: "Cité J1 - T3",   x: 51, y: 96 },
  { id: "J2C1", label: "Cité J2 - T1",   x: 38, y: 73 },
  { id: "J2C2", label: "Cité J2 - T2",   x: 38, y: 64 },
  { id: "J2C3", label: "Cité J2 - T3",   x: 42, y: 66 },
  { id: "T1",   label: "Temple 1",       x: 28, y: 78 },
  { id: "T2",   label: "Temple 2",       x: 49, y: 51 },
  { id: "DJ1",  label: "Désert J1",      x: 31, y: 96 },
  { id: "DJ2",  label: "Désert J2",      x: 41, y: 58 },
  { id: "DJ3",  label: "Désert J3",      x: 31, y: 46 },
  { id: "DT2",  label: "Désert T2",      x: 56, y: 83 },
  { id: "D12",  label: "Désert J1-J2",   x: 35, y: 87.5 },
  { id: "D23",  label: "Désert J2-J3",   x: 40, y: 50 },
];

export const RIVER_ZONES = new Set(["TB", "T3", "DT3", "T2", "DT2"]);

export const TELEPORT_TARGETS = new Set([
  "TB", "T1", "T2", "T3",
  "D12", "D23",
]);

export function isCityZone(zoneId) {
  return /^J\dC\d$/.test(zoneId);
}

export const ZONE_ADJACENCY = {
  TB:   ["DT3"],
  DT3:  ["TB", "T3"],
  T3:   ["DT3"],
  J3C1: ["J3C2", "J3C3","DJ3"],
  J3C2: ["J3C1", "J3C3","DJ3"],
  J3C3: ["J3C1", "J3C2","DJ3"],
  DJ3:  ["J3C1","J3C2","J3C3", "D23","T1","DT2"],
  D23:  ["DJ3", "DJ2","T1","DT2"],
  DJ2:  ["D23", "J2C1", "J2C2", "J2C3", "D12", "T1", "DT2"],
  T2:   ["DT2"],
  DT2:  ["DJ2", "T2", "DJ1","DJ3","D12","D23"],
  J2C1: ["J2C2", "J2C3", "DJ2"],
  J2C2: ["J2C1", "J2C3", "DJ2"],
  J2C3: ["J2C1", "J2C2", "DJ2"],
  T1:   ["DJ1", "DJ2","DJ3","D12","D23"],
  D12:  ["DJ2", "DT2", "DJ1","T1"],
  J1C1: ["DJ1", "J1C2", "J1C3"],
  J1C2: ["J1C1", "J1C3", "DJ1"],
  J1C3: ["J1C1", "J1C2", "DJ1"],
  DJ1:  ["T1", "J1C1","J1C2","J1C3", "D12","DT2"],
};

export const COLOR_MAP = {
  Rouge: "#dc2626",
  Bleu: "#2563eb",
  Vert: "#16a34a",
  Blanc: "#e5e7eb",
  Noir: "#1f2937",
};
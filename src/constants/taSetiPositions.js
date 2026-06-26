/**
 * POSITIONS DES NŒUDS TA-SETI
 * ─────────────────────────────
 * Modifier x et y (0–100) pour repositionner chaque nœud.
 * Les coordonnées sont en pourcentage de la largeur/hauteur
 * de l'IMAGE de la section correspondante (pas du board entier).
 *
 * Types de nœuds affichés :
 *   E_s_n   →  Emplacement           — cercle doré
 *   C_s_n   →  Chemin intermédiaire  — cercle orange
 *   JI_s_n  →  Jeton instantané      — cercle violet
 *   JU_s_n  →  Jeton utilisable      — cercle cyan
 */

export const TASETI_NODE_POSITIONS = {

  // ── Section 1 face A ────────────────────────────────────────────────────
  '1A': {
    E_1_1:  { x: 52, y: 20 },
    JI_1_1: { x: 52, y: 10 },
    E_1_2:  { x: 47, y: 50 },
    JI_1_2: { x: 47, y: 40.5 },
    E_1_3:  { x: 50, y: 75 },
    JI_1_3: { x: 52, y: 87.3 },
    I_1_1:  { x: 85, y: 18 },
    I_1_3:  { x: 85, y: 77 },
  },

  // ── Section 1 face B ────────────────────────────────────────────────────
  '1B': {
    E_1_1:  { x: 52, y: 18 },
    JI_1_1: { x: 51, y: 10 },
    E_1_2:  { x: 52, y: 41 },
    JI_1_2: { x: 51, y: 33 },
    E_1_3:  { x: 52, y: 55 },
    JI_1_3: { x: 51, y: 67 },
    E_1_4:  { x: 52, y: 78 },
    JI_1_4: { x: 51, y: 90 },
    I_1_1:  { x: 85, y: 15 },
    I_1_4:  { x: 85, y: 80 },
  },

  // ── Section 2 face A ────────────────────────────────────────────────────
  '2A': {
    E_2_1:  { x: 50, y: 20 },
    JU_2_1: { x: 50, y: 9 },
    E_2_2:  { x: 48, y: 75 },
    JU_2_2: { x: 48, y: 87 },
  },

  // ── Section 2 face B ────────────────────────────────────────────────────
  '2B': {
    E_2_1:  { x: 77, y: 27 },
    JU_2_1: { x: 77, y: 10 },
    E_2_2:  { x: 42, y: 27 },
    JP_2_1: { x: 33.5, y: 38.5 },
    E_2_3:  { x: 36, y: 70 },
    JP_2_2: { x: 33, y: 59.5 },
    E_2_4:  { x: 77, y: 75 },
    JU_2_2: { x: 76, y: 90 },
  },

  // ── Section 3 face A ────────────────────────────────────────────────────
  '3A': {
    E_3_1:  { x: 65, y: 20 },
    I_3_1:  { x: 85, y: 18 },
    JI_3_1: { x: 42.5, y: 10 },
    JU_3_1: { x: 80, y: 10.1 },
    E_3_2:  { x: 22, y: 45 },
    JP_3_1: { x: 22, y: 34 },
    E_3_3:  { x: 51, y: 64 },
    JP_3_2: { x: 51.5, y: 52 },
    E_3_4:  { x: 63, y: 77 },
    JI_3_2: { x: 42.5, y: 90 },
    JU_3_2: { x: 80.3, y: 90.2 },
  },

  // ── Section 3 face B ────────────────────────────────────────────────────
  '3B': {
    E_3_1:  { x: 67, y: 18 },
    JU_3_1: { x: 67, y: 9 },
    E_3_2:  { x: 25, y: 37 },
    JP_3_1: { x: 28.5, y: 27 },
    E_3_3:  { x: 30, y: 51 },
    JP_3_2: { x: 29, y: 62.5 },
    E_3_4:  { x: 61, y: 76 },
    JU_3_2: { x: 61, y: 87 },
    C_3_1:  { x: 70, y: 35 },
    C_3_2:  { x: 70, y: 65 },
  },

  // ── Section 4 face A ────────────────────────────────────────────────────
  '4A': {
    E_4_2:  { x: 50, y: 50 },
  },

  // ── Section 4 face B ────────────────────────────────────────────────────
  '4B': {
    E_4_1:  { x: 37, y: 20 },
    JI_4_1: { x: 80, y: 9 },
    JP_4_1: { x: 40.5, y: 9 },
    E_4_2:  { x: 60, y: 50 },
    E_4_3:  { x: 23, y: 74 },
    JP_4_2: { x: 26, y: 87 },
    JU_4_1: { x: 75, y: 87 },
  },
};

// Taille des emplacements E_ (prêtres) affichés sur le board (en % de la largeur TOTALE de Ta-Seti, soit 95vw)
export const E_NODE_WIDTH_PCT = 7;

// Taille des cartes JU_ affichées sur le board (en % de la largeur TOTALE de Ta-Seti, soit 95vw)
export const JU_CARD_WIDTH_PCT = 10;

// Taille des jetons JI_ affichés sur le board (en % de la largeur TOTALE de Ta-Seti, soit 95vw)
export const JI_CARD_WIDTH_PCT = 9;

// Taille des jetons JP_ affichés sur le board (en % de la largeur TOTALE de Ta-Seti, soit 95vw)
export const JP_CARD_WIDTH_PCT = 10;

// Retourne les IDs des nœuds JP_ actifs pour un layout donné
export function getJpPositionsForLayout(layout) {
  const faces = Array.isArray(layout) ? layout : Object.values(layout || {});
  return faces.flatMap((face, i) => {
    const nodes = TASETI_NODE_POSITIONS[`${i + 1}${face}`] || {};
    return Object.keys(nodes).filter(id => id.startsWith('JP'));
  });
}

// Retourne les IDs des nœuds JI_ actifs pour un layout donné
export function getJiPositionsForLayout(layout) {
  const faces = Array.isArray(layout) ? layout : Object.values(layout || {});
  return faces.flatMap((face, i) => {
    const nodes = TASETI_NODE_POSITIONS[`${i + 1}${face}`] || {};
    return Object.keys(nodes).filter(id => id.startsWith('JI'));
  });
}

// Retourne les IDs des nœuds JU_ actifs pour un layout donné
export function getJuPositionsForLayout(layout) {
  const faces = Array.isArray(layout) ? layout : Object.values(layout || {});
  return faces.flatMap((face, i) => {
    const nodes = TASETI_NODE_POSITIONS[`${i + 1}${face}`] || {};
    return Object.keys(nodes).filter(id => id.startsWith('JU'));
  });
}

// Nœuds avec bonus quotidien (une fois par jour, premier passant seulement)
// sectionKey → { nodeId: cheminImage }
export const TASETI_DAILY_BONUS_NODES = {
  '1A': { 'I_1_1': '/TS_bouclier.jpeg', 'I_1_3': '/TS_goutte_sang.jpeg' },
  '1B': { 'I_1_1': '/TS_bouclier.jpeg', 'I_1_4': '/TS_goutte_sang.jpeg' },
  '3A': { 'I_3_1': '/TS_force.jpeg' },
  '3B': { 'C_3_1': '/TS_force.jpeg' },
  '4A': { 'E_4_2': '/TS_PV.jpeg' },
  '4B': { 'E_4_2': '/TS_PV.jpeg' },
};

// Retourne les E_ nodes dans l'ordre du parcours (section 1→4, nœud 1→N)
export function getENodeTrackForLayout(layout) {
  const faces = Array.isArray(layout) ? layout : Object.values(layout || {});
  const track = [];
  faces.forEach((face, i) => {
    const sectionNodes = TASETI_NODE_POSITIONS[`${i + 1}${face}`] || {};
    const eNodes = Object.keys(sectionNodes)
      .filter(id => id.startsWith('E'))
      .sort((a, b) => parseInt(a.split('_')[2] || '0') - parseInt(b.split('_')[2] || '0'));
    track.push(...eNodes);
  });
  return track;
}

// Association E_ → jetons présents à cet emplacement (par face)
export const E_TO_TOKENS = {
  '1A': { E_1_1: ['JI_1_1'], E_1_2: ['JI_1_2'], E_1_3: ['JI_1_3'] },
  '1B': { E_1_1: ['JI_1_1'], E_1_2: ['JI_1_2'], E_1_3: ['JI_1_3'], E_1_4: ['JI_1_4'] },
  '2A': { E_2_1: ['JU_2_1'], E_2_2: ['JU_2_2'] },
  '2B': { E_2_1: ['JU_2_1'], E_2_2: ['JP_2_1'], E_2_3: ['JP_2_2'], E_2_4: ['JU_2_2'] },
  '3A': { E_3_1: ['JI_3_1', 'JU_3_1'], E_3_2: ['JP_3_1'], E_3_3: ['JP_3_2'], E_3_4: ['JI_3_2', 'JU_3_2'] },
  '3B': { E_3_1: ['JU_3_1'], E_3_2: ['JP_3_1'], E_3_3: ['JP_3_2'], E_3_4: ['JU_3_2'] },
  '4A': {},
  '4B': { E_4_1: ['JI_4_1', 'JP_4_1'], E_4_2: [], E_4_3: ['JP_4_2', 'JU_4_1'] },
};

// Couleur par type de nœud
export const NODE_COLORS = {
  E:  { bg: '#78350f', border: '#C9973A', text: '#fde68a' }, // doré   — emplacement
  C:  { bg: '#7c2d12', border: '#f97316', text: '#fed7aa' }, // orange — chemin
  JI: { bg: '#4a1d96', border: '#a78bfa', text: '#ddd6fe' }, // violet — jeton instantané
  JU: { bg: '#164e63', border: '#22d3ee', text: '#a5f3fc' }, // cyan   — jeton utilisable
};

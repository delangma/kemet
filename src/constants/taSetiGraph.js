// Connexions E → S par face de section
const E_TO_S = {
  '1A': {
    E_1_1: ['S_1_1'],
    E_1_2: ['S_1_1', 'S_1_2', 'S_1_3'],
    E_1_3: ['S_1_3'],
  },
  '1B': {
    E_1_1: ['S_1_1'],
    E_1_2: ['S_1_2'],
    E_1_3: ['S_1_2'],
    E_1_4: ['S_1_3'],
  },
  '2A': {
    E_2_1: ['S_2_1', 'S_2_2'],
    E_2_2: ['S_2_2', 'S_2_3'],
  },
  '2B': {
    E_2_1: ['S_2_1', 'S_2_2'],
    E_2_2: ['S_2_2'],
    E_2_3: ['S_2_2'],
    E_2_4: ['S_2_2', 'S_2_3'],
  },
  '3A': {
    E_3_1: ['S_3_1', 'S_3_2'],
    E_3_2: ['S_3_2'],
    E_3_3: ['S_3_2', 'S_3_3'],
    E_3_4: [], // dead-end, pas de sortie
  },
  '3B': {
    E_3_1: ['S_3_1', 'S_3_2'],
    E_3_2: ['S_3_1', 'S_3_2', 'S_3_3'],
    E_3_3: ['S_3_2', 'S_3_3'],
    E_3_4: [], // dead-end
  },
  '4A': { E_4_2: [] },
  '4B': { E_4_1: [], E_4_2: [], E_4_3: [] },
};

// Connexions I → E par face de section (I de bypass omis)
const I_TO_E = {
  '1A': { I_1_1: ['E_1_1'], I_1_2: ['E_1_2'], I_1_3: ['E_1_3'] },
  '1B': { I_1_1: ['E_1_1'], I_1_2: ['E_1_2'], I_1_3: ['E_1_3'], I_1_4: ['E_1_4'] },
  '2A': { I_2_1: ['E_2_1'], I_2_3: ['E_2_2'] },                // I_2_2 = bypass
  '2B': { I_2_1: ['E_2_1', 'E_2_2'], I_2_3: ['E_2_3', 'E_2_4'] }, // I_2_2 = bypass
  '3A': { I_3_1: ['E_3_1'], I_3_2: ['E_3_2', 'E_3_3'], I_3_3: ['E_3_4'] },
  '3B': { I_3_1: ['E_3_1'], I_3_2: ['E_3_2', 'E_3_3'], I_3_3: ['E_3_4'] },
  '4A': { I_4_1: ['E_4_2'], I_4_2: ['E_4_2'], I_4_3: ['E_4_2'] },
  '4B': { I_4_1: ['E_4_1'], I_4_2: ['E_4_2'], I_4_3: ['E_4_3'] },
};

// Réserve → I_1_x selon la face de la section 1
const RESERVE_TO_I = {
  '1A': ['I_1_1', 'I_1_2', 'I_1_3'],
  '1B': ['I_1_1', 'I_1_2', 'I_1_3', 'I_1_4'],
};

// Connexions internes section 4B : E → E directement
const SECTION4B_INTERNAL = {
  E_4_1: ['E_4_2'],
  E_4_3: ['E_4_2'],
  E_4_2: [],
};

/**
 * Retourne le nœud I_ traversé pour aller de fromPos vers toPos.
 * Retourne null si aucun nœud I traversé (ex: mouvement interne section 4B).
 */
export function getTraversedINode(fromPos, toPos, layout) {
  const faces = Array.isArray(layout) ? layout : Object.values(layout);

  // Depuis la réserve → section 1
  if (!fromPos || fromPos === '') {
    const face1Key = `1${faces[0]}`;
    const iToE = I_TO_E[face1Key] || {};
    return Object.entries(iToE).find(([, dests]) => dests.includes(toPos))?.[0] ?? null;
  }

  const m = fromPos.match(/^E_(\d+)_/);
  if (!m) return null;
  const section = parseInt(m[1]);

  // Section 4 : mouvements internes E→E sans I intermédiaire
  if (section === 4) return null;

  const faceKey = `${section}${faces[section - 1]}`;
  const sNodes = (E_TO_S[faceKey] || {})[fromPos] || [];
  const nextSection = section + 1;
  const nextFaceKey = `${nextSection}${faces[nextSection - 1]}`;
  const iToE = I_TO_E[nextFaceKey] || {};

  for (const sNode of sNodes) {
    const num = sNode.split('_').pop();
    const iNode = `I_${nextSection}_${num}`;
    if ((iToE[iNode] || []).includes(toPos)) return iNode;
  }
  return null;
}

/**
 * Retourne les emplacements E_ valides où un prêtre peut avancer.
 * @param {string} currentPos  - ID du nœud E_ actuel, ou '' pour la réserve
 * @param {string[]} layout    - ex. ['A','A','B','B']
 * @returns {string[]}
 */
export function getValidPriestDestinations(currentPos, layout) {
  if (!layout || layout.length !== 4) return [];
  const faces = Array.isArray(layout) ? layout : Object.values(layout);

  // Depuis la réserve → emplacements de la section 1
  if (!currentPos || currentPos === '') {
    const face1Key = `1${faces[0]}`;
    const iNodes = RESERVE_TO_I[face1Key] || [];
    const iToE = I_TO_E[face1Key] || {};
    const dests = new Set();
    iNodes.forEach(i => (iToE[i] || []).forEach(e => dests.add(e)));
    return [...dests];
  }

  const m = currentPos.match(/^E_(\d+)_/);
  if (!m) return [];
  const section = parseInt(m[1]);
  const faceKey = `${section}${faces[section - 1]}`;

  // Section 4B : connexions internes E→E
  if (section === 4 && faces[3] === 'B') {
    return SECTION4B_INTERNAL[currentPos] || [];
  }

  // Section 4A ou dead-end : terminal
  if (section === 4) return [];

  // Sections 1-3 : E → S → I(section+1) → E(section+1)
  const sNodes = (E_TO_S[faceKey] || {})[currentPos] || [];
  const nextSection = section + 1;
  const nextFaceKey = `${nextSection}${faces[nextSection - 1]}`;
  const iToE = I_TO_E[nextFaceKey] || {};

  const dests = new Set();
  sNodes.forEach(sNode => {
    const num = sNode.split('_').pop();           // S_n_x → x
    const iNode = `I_${nextSection}_${num}`;      // → I_(n+1)_x
    (iToE[iNode] || []).forEach(e => dests.add(e));
  });
  return [...dests];
}

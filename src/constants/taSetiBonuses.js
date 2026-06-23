// Bonus des nœuds I_ (déclenchés en passant par ce chemin pour atteindre un E_)
// Clé : "<section><face>" ex: "1A", "2B"
export const TASETI_I_BONUSES = {
  '1A': {
    I_1_1: [{ type: 'ank', value: 1 }, { type: 'combatShields', value: 1 }],
    I_1_2: [{ type: 'ank', value: 1 }],
    I_1_3: [{ type: 'ank', value: 1 }, { type: 'combatBlood', value: 1 }],
  },
  '1B': {
    I_1_1: [{ type: 'ank', value: 1 }, { type: 'combatShields', value: 1 }],
    I_1_4: [{ type: 'ank', value: 1 }, { type: 'combatBlood', value: 1 }],
  },
  '2A': {
    I_2_1: [{ type: 'tasetiRecruit', value: 1 }],
    I_2_3: [{ type: 'idCard', value: 1 }],
  },
  '2B': {
    I_2_1: [{ type: 'moveBonus', value: 1 }],
    I_2_3: [{ type: 'tasetiRecruit', value: 1 }],
  },
  '3A': {
    I_3_1: [{ type: 'combatForce', value: 1 }],
    I_3_3: [{ type: 'tasetiRecruit', value: 2 }],
  },
  '3B': {
    I_3_1: [{ type: 'ank', value: 3 }],
    I_3_3: [{ type: 'tasetiRecruit', value: 3 }],
  },
  '4A': {},
  '4B': {
    I_4_1: [{ type: 'destroyUnit' }],
  },
};

// Bonus des nœuds E_ (déclenchés en arrivant sur ce nœud)
// Note : E_4_2 est géré séparément (1er prêtre du jour → +1 PV, retour en réserve)
export const TASETI_E_BONUSES = {};

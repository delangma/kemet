// Images statiques affichées sur le plateau, entre la carte et les unités.
//
// x, y      : position en % de l'image du plateau (même système que BOARD_ZONES, 0–100).
//             L'image est centrée sur ce point.
// widthPct  : largeur de l'image en % de la largeur affichée du plateau.

// minPlayers (optionnel) : l'image n'est affichée que si la partie a au moins ce nombre de joueurs.
export const BOARD_STATIC_IMAGES = [
  { id: 'temple_bleu',    src: '/Temple_Bleu.png',   x: 37,  y: 7,  widthPct: 8 },
  { id: 'temple_2anks_1', src: '/Temple_2anks.png',  x: 27,  y: 69,  widthPct: 7 },
  { id: 'temple_2anks_2', src: '/Temple_2anks.png',  x: 48,  y: 15,  widthPct: 7, minPlayers: 5 },
  { id: 'temple_3anks_1', src: '/Temple_3anks.png',  x: 48,  y: 47,  widthPct: 7 },
  { id: 'temple_3anks_2', src: '/Temple_3anks.png',  x: 35,  y: 50,  widthPct: 7, minPlayers: 5 },
  { id: 'temple_5anks',   src: '/Temple_5anks.png',  x: 49,  y: 8,  widthPct: 7 },
];

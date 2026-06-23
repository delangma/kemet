🏗️ Kemet — Architecture Technique

Stack technique



Framework : React (JSX)

Styling : CSS-in-JS (style inline) ou Tailwind — à décider en Phase 1

State management : React useState / useReducer (pas de Redux pour l'instant)

Backend : Aucun (Phase 1-3) → à introduire en Phase 4

Bundler : Vite (recommandé) ou Create React App





Structure des dossiers

kemet/

├── public/

│   └── assets/          # Images, sprites (Phase 2)

├── src/

│   ├── components/

│   │   ├── Board/       # Plateau de jeu

│   │   ├── City/        # Case cité

│   │   ├── Desert/      # Case désert

│   │   ├── Troops/      # Pions troupes

│   │   ├── Player/      # Panneau joueur (PV, ressources)

│   │   ├── PowerTile/   # Tuiles de pouvoir (Phase 3)

│   │   └── UI/          # Boutons, logs, modales

│   ├── state/

│   │   ├── gameState.js     # État global du jeu

│   │   ├── gameReducer.js   # Actions / mutations

│   │   └── initialState.js  # État initial configurable

│   ├── constants/

│   │   ├── board.js     # Définition du plateau (cités, connexions)

│   │   ├── rules.js     # Constantes des règles

│   │   └── players.js   # Couleurs, noms par défaut

│   ├── utils/

│   │   ├── combat.js    # Logique de résolution des batailles (Phase 3)

│   │   └── scoring.js   # Calcul des PV (Phase 3)

│   ├── App.jsx

│   └── main.jsx

├── phases.md

├── architecture.md

├── regles-kemet.md

├── assets-todo.md

└── package.json



Modèle de données — État global (gameState)

js{

&#x20; // Configuration de la partie

&#x20; config: {

&#x20;   playerCount: 2,        // 2 à 5

&#x20;   victoryPoints: 8,      // Seuil de victoire (8 ou 10)

&#x20;   variant: "base",       // "base" | "ta-seti" (extension)

&#x20; },



&#x20; // Phase de jeu

&#x20; phase: "night",          // "night" | "dawn" | "day" | "dusk"

&#x20; turn: 1,

&#x20; activePlayerIndex: 0,



&#x20; // Joueurs

&#x20; players: \[

&#x20;   {

&#x20;     id: 0,

&#x20;     name: "Joueur 1",

&#x20;     color: "#e53e3e",    // Rouge

&#x20;     vp: 0,               // Points de victoire

&#x20;     prayers: 3,          // Points de prières

&#x20;     troops: 5,           // Troupes disponibles (hors plateau)

&#x20;     powerTiles: \[],      // Tuiles achetées

&#x20;     creature: null,      // Créature recrutée

&#x20;   }

&#x20;   // ...

&#x20; ],



&#x20; // Plateau — cités

&#x20; cities: {

&#x20;   "heliopolis": {

&#x20;     id: "heliopolis",

&#x20;     owner: null,         // id joueur ou null

&#x20;     troops: {},          // { playerId: nb }

&#x20;     temple: true,

&#x20;     obelisk: 0,          // niveau 0-3

&#x20;     pyramid: { level: 0, color: null }, // blanc/rouge/bleu/noir

&#x20;   },

&#x20;   // ...

&#x20; },



&#x20; // Log des actions

&#x20; actionLog: \[

&#x20;   // { turn, player, action, details, timestamp }

&#x20; ],

}



Plateau — Carte des cités (à affiner)

Le plateau de Kemet comporte 10 cités (2 par joueur jusqu'à 5 joueurs) + cases désert.

Cités : Héliopolis (nord), Memphis (nord-est), Thèbes (est),

&#x20;       Abydos (sud-est), Karnak (sud), + cités joueurs

Connexions : définir les adjacences pour valider les mouvements

(Compléter avec la carte exacte en Phase 1)



Décisions techniques prises

DateDécisionRaison—Utiliser useReducer pour le stateMutations complexes, facilite le undo/redo futur—SVG pour le plateau Phase 1Flexible, responsive, facile à remplacer par images en Phase 2



Points d'attention pour les phases futures



Phase 2 : Prévoir un système de sprite sheets ou SVG inline pour les assets

Phase 3 : Le gameReducer doit être exhaustif — chaque règle = une action typée

Phase 4 : Le state devra être sérialisable JSON pour la sync WebSocket


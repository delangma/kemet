# Audit — Cartes ID (Interventions Divines)

## 1. Structure d'une carte

**Fichier :** `src/constants/cards.js`

| Champ | Type | Description |
|-------|------|-------------|
| `id` | string | Identifiant unique (`"renfort_divin"`, etc.) |
| `name` | string | Nom affiché |
| `cost` | number | Coût en Ank (0 ou 1) |
| `timing` | string | `"combat"`, `"day"`, ou `"any"` |
| `effect.type` | string | Type d'effet (voir §3) |
| `effect.value` | number | Valeur numérique de l'effet |
| `quantity` | number | Exemplaires dans la pioche (1–3) |
| `instanceId` | string | Généré à la création de la pioche : `"{id}_{i}"` |

---

## 2. Mécanique générale

### 2.1 Construction de la pioche
**`src/utils/deck.js` — `buildIdDeck()`**
- Crée `card.quantity` exemplaires de chaque carte définie dans `ID_CARDS`
- Assigne à chacun un `instanceId` unique
- Mélange avec Fisher-Yates
- Stockage Firebase : `gameState.idDeck` (pioche) / `gameState.idDiscard` (défausse)

**Taille totale de la pioche : ~45 cartes**

### 2.2 Distribution
- **Initialisation :** chaque joueur reçoit **2 cartes** via `dealCards(deck, 2)` — `GameScreen.jsx`
- **Chaque nuit (NightModal.jsx) :** chaque joueur reçoit **+1 carte** par défaut, augmenté par :
  - Tuiles pouvoir avec `idCardsPerNight`
  - Créatures avec bonus `idCardsPerNight`
  - Tuile "Choix supplémentaire ID" : pioche 5 cartes, garde 1, les 4 autres retournent
  - Tuile "Draft ID" : défausse N cartes, pioche N+1

### 2.3 Jouer une carte de JOUR (`timing: "day"`)
1. Joueur actif clique "🃏 Cartes ID" → `IdCardModal`
2. Sélectionne 1 carte → `handlePlayDayIdCard(card)` — `GameScreen.jsx`
3. Carte supprimée de la main immédiatement
4. Carte placée en `rooms/{roomCode}/pendingIdCard` avec timestamp
5. **Timer 5 secondes** — les adversaires peuvent jouer "Annulation d'ID"
6. Après 5s : `applyDayIdCardEffect()` exécute l'effet, carte envoyée en défausse

**Coût en Ank :** déduit au moment de `handlePlayDayIdCard` (si `card.cost > 0`)

### 2.4 Jouer une carte de COMBAT (`timing: "combat"`)
1. Après la sélection des cartes combat, status `"id_phase"` s'active
2. Tour alterné : chaque joueur peut jouer des cartes "combat" ou "any"
3. 2 passes consécutives sans jouer = fin de la phase ID
4. Les cartes jouées sont stockées dans `combat.choices[playerId].idCards`
5. À la fin du combat (`handleApplyResults`) : toutes les cartes ID jouées → défausse commune

### 2.5 Carte `timing: "any"` — Annulation d'ID
- Jouable en journée **ou** pendant le timer d'une carte adverse
- Ouvre `CancelIdModal` avec un countdown de 5s
- Annule la carte adverse en cours (`pendingIdCard`)
- Les deux cartes (annulation + carte annulée) partent en défausse

### 2.6 Rafraîchissement de la pioche
- La pioche **ne se recycle pas automatiquement**
- Si la pioche est vide lors d'une distribution nocturne : les cartes non distribuées sont simplement ignorées (pas de mélange de la défausse implémenté actuellement)

---

## 3. Catalogue des cartes

### CARTES DE COMBAT (`timing: "combat"`)

---

#### Renfort Divin
- **Coût :** 0 Ank | **Qté :** 3
- **Effet :** +1 Force au combat
- **Code :** `effect.type = "force", value = 1`
- **Implémentation :** additionné dans `getCombatResult()` (`creaturePowers.js`) sur la valeur totale de force de l'attaquant/défenseur

---

#### Renfort Divin Majeur
- **Coût :** 1 Ank | **Qté :** 3
- **Effet :** +2 Force au combat
- **Code :** `effect.type = "force", value = 2`
- **Implémentation :** identique à Renfort Divin, valeur 2

---

#### Protection Divine
- **Coût :** 0 Ank | **Qté :** 3
- **Effet :** +1 Bouclier au combat (réduit les dégâts sang reçus)
- **Code :** `effect.type = "shields", value = 1`
- **Implémentation :** `getCombatResult()` — soustrait des dégâts sang infligés à ce joueur

---

#### Protection Divine Majeure
- **Coût :** 1 Ank | **Qté :** 2
- **Effet :** +2 Boucliers au combat
- **Code :** `effect.type = "shields", value = 2`

---

#### Sang Divin
- **Coût :** 0 Ank | **Qté :** 3
- **Effet :** +1 Goutte de sang infligée à l'adversaire
- **Code :** `effect.type = "blood", value = 1`
- **Implémentation :** `getCombatResult()` — augmente le sang infligé à l'adversaire

---

#### Sang Divin Majeur
- **Coût :** 1 Ank | **Qté :** 2
- **Effet :** +2 Gouttes de sang infligées
- **Code :** `effect.type = "blood", value = 2`

---

#### Butin de Guerre
- **Coût :** 0 Ank | **Qté :** 2
- **Effet :** +4 Ank si victoire
- **Code :** `effect.type = "ank_if_win", value = 4`
- **Implémentation :** `CombatModal.jsx` — après résolution, si ce joueur est le vainqueur : `ank += 4`
- **Firebase :** `gameState/players/{playerId}/ank`

---

#### Recrutement de Victoire
- **Coût :** 0 Ank | **Qté :** 2
- **Effet :** +3 Unités à placer si victoire
- **Code :** `effect.type = "units_if_win", value = 3`
- **Implémentation :** `CombatModal.jsx` — si vainqueur : `victoryRecruitPending = 3`, active le mode `"victoryRecruit"` en journée
- **Firebase :** `gameState/players/{playerId}/victoryRecruitPending`

---

#### Aucun Saignement
- **Coût :** 0 Ank | **Qté :** 2
- **Effet :** Aucune perte de sang pour ce joueur si victoire
- **Code :** `effect.type = "no_damage_if_win"`
- **Implémentation :** `getCombatResult()` — si ce joueur gagne, son sang reçu est forcé à 0

---

#### Changement de Stratégie
- **Coût :** 0 Ank | **Qté :** 2
- **Effet :** Échanger sa carte combat contre la carte défaussée
- **Code :** `effect.type = "swap_combat_card"`
- **Implémentation :** `CombatModal.jsx` — status `"swap_phase"` : chaque joueur ayant la carte peut accepter ou refuser l'échange. La carte défaussée lors de la sélection combat revient en main, et la carte combat jouée part en défausse

---

#### La Fuite
- **Coût :** 0 Ank | **Qté :** 1
- **Effet :** Fuir le combat sans subir de pertes
- **Code :** `effect.type = "flee"`
- **Implémentation :** `GameScreen.jsx` — crée un `fleeOffer`, ouvre `FleeModal`. Le défenseur choisit une zone adjacente pour se retirer. Aucun combat résolu, aucune perte
- **Firebase :** unités du fuyant déplacées vers la zone choisie, carte en défausse

---

### CARTES DE JOUR (`timing: "day"`)

Toutes ces cartes passent par `applyDayIdCardEffect()` dans `GameScreen.jsx` après le timer de 5s.

---

#### Gain de 2 Ank
- **Coût :** 0 Ank | **Qté :** 2
- **Effet :** +2 Ank pour le joueur actif
- **Code :** `effect.type = "ank", value = 2`
- **Firebase :** `players/{playerId}/ank = Math.min(11, ank + 2)`

---

#### Taxation Divine
- **Coût :** 0 Ank | **Qté :** 2
- **Effet :** +1 Ank pour soi, -1 Ank pour chaque adversaire
- **Code :** `effect.type = "taxation", value = 1`
- **Firebase :** `players/{playerId}/ank += 1` + boucle sur adversaires : `ank = Math.max(0, ank - 1)`

---

#### Renforts
- **Coût :** 0 Ank | **Qté :** 3
- **Effet :** +2 Unités en réserve
- **Code :** `effect.type = "units", value = 2`
- **Firebase :** `players/{playerId}/unitsReserve += 2`

---

#### Récupération d'ID
- **Coût :** 1 Ank | **Qté :** 2
- **Effet :** Récupérer 1 carte de la défausse commune en main
- **Code :** `effect.type = "recover_id"`
- **Implémentation :** `applyDayIdCardEffect()` → `idRecoverPending = true` → ouvre `IdRecoverModal`
- **Firebase :** carte choisie supprimée de `idDiscard`, ajoutée à `players/{playerId}/idCards`

---

#### Marche Forcée
- **Coût :** 0 Ank | **Qté :** 2
- **Effet :** +1 point de mouvement pour la prochaine action déplacement
- **Code :** `effect.type = "movement", value = 1`
- **Firebase :** `players/{playerId}/pendingMoveBonus += 1` — consommé dans `computeMovePoints()`

---

#### Téléportation
- **Coût :** 1 Ank | **Qté :** 2
- **Effet :** Prochain téléport gratuit (coût 0 Ank)
- **Code :** `effect.type = "teleport"`
- **Firebase :** `players/{playerId}/pendingFreeAnyTeleport = true` — coût téléport forcé à 0

---

#### Passe-Muraille
- **Coût :** 1 Ank | **Qté :** 1
- **Effet :** Franchir les murs lors du prochain déplacement vers une cité
- **Code :** `effect.type = "wall_pass"`
- **Firebase :** `players/{playerId}/pendingWallPass = true` — désactive la restriction `wallPassActive` dans Board

---

#### Pluie de Feu
- **Coût :** 1 Ank | **Qté :** 3
- **Effet :** Détruire 1 unité ennemie dans n'importe quelle zone
- **Code :** `effect.type = "destroy_unit"`
- **Implémentation :** `applyDayIdCardEffect()` → `pendingDestroyUnit = true` → mode `"destroyUnit"` → joueur clique sur une zone ennemie
- **Firebase :** `boardUnits/{zoneId}/{enemyColor} -= 1`, `players/{enemyId}/unitsReserve += 1`

---

### CARTE `timing: "any"`

---

#### Annulation d'ID
- **Coût :** 0 Ank | **Qté :** 2
- **Effet :** Annuler une carte ID adverse en cours de jeu (pendant les 5s du timer)
- **Code :** `effect.type = "cancel_id"`
- **Implémentation :** `GameScreen.jsx` — quand `pendingIdCard` existe et que l'adversaire a cette carte, `CancelIdModal` s'ouvre automatiquement avec countdown
- **Firebase :** `pendingIdCard` supprimé, les deux cartes (annulation + carte annulée) ajoutées à `idDiscard`

---

## 4. Composants impliqués

| Fichier | Rôle |
|---------|------|
| `src/constants/cards.js` | Définition de toutes les cartes (`ID_CARDS`) |
| `src/utils/deck.js` | `buildIdDeck()`, `dealCards()`, `shuffle()` |
| `src/components/Cards/IdCard.jsx` | Affichage visuel d'une carte |
| `src/components/Cards/IdCardModal.jsx` | Modale "Mes cartes ID" : affichage, filtrage, sélection |
| `src/components/Cards/IdDraftModal.jsx` | Choix 1 parmi 5 (tuile "Choix supplémentaire ID") |
| `src/components/Cards/IdRefreshModal.jsx` | Draft ID : défausser N, piocher N+1 |
| `src/components/Game/GameScreen.jsx` | Logique centrale : init, distribution, jeu des cartes jour, timers, effets |
| `src/components/Game/MyZone.jsx` | Interface joueur : accès aux modales, bouton jouer carte |
| `src/components/Game/NightModal.jsx` | Distribution nocturne + tuiles spéciales |
| `src/components/Combat/CombatModal.jsx` | Jeu des cartes combat, phase ID, résolution, défausse |
| `src/components/Combat/CancelIdModal.jsx` | Countdown annulation (5s) |
| `src/components/Combat/IdRecoverModal.jsx` | Sélection d'une carte dans la défausse |
| `src/components/Combat/FleeModal.jsx` | Sélection de zone de fuite |

---

## 5. Points à vérifier / bugs potentiels

| Problème | Localisation | Notes |
|----------|--------------|-------|
| Coût Ank non vérifié avant de jouer | `handlePlayDayIdCard` | Une carte coûtant 1 Ank peut être jouée même sans Ank suffisant |
| Recyclage de la défausse absent | `NightModal.jsx` | Si la pioche est vide, les cartes ne sont pas redistribuées depuis la défausse |
| "Aucun Saignement" en cas d'égalité | `getCombatResult()` | Comportement indéfini si personne ne gagne |
| Timer 5s non synchronisé | `GameScreen.jsx` | Le timer est local (client-side), pas Firebase — un rechargement de page pendant les 5s peut bloquer l'effet |
| "La Fuite" jouée par l'attaquant | `CombatModal.jsx` | À vérifier si la restriction défenseur-only est bien appliquée |

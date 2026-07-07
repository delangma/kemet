import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { ref, onValue, update, remove, set } from "firebase/database";
import { COMBAT_CARDS, getPlayerCombatDeck } from "../../constants/cards";
import { POWER_TILES } from "../../constants/powerTiles";
import { getCombatCreatureBonus, getCombatResult, CREATURE_POWERS, getJpTokenFlags } from "../../constants/creaturePowers";
import { getCreatureSpriteStyle } from "../../constants/creatures";
import { ZONE_ADJACENCY } from "../../constants/board";
import { aiChooseCombatCards, aiSelectCombatIdCard } from "../../ai/aiPlayer";

export default function CombatModal({ onClose, session, gameState, effectivePlayerId: epId, isTestMode, testPlayers, testViewPlayerId, onSwitchTestPlayer, logAction }) {
  const { roomCode, playerId: sessionPlayerId, allPlayers } = session;
  const playerId = epId ?? sessionPlayerId;
  const [combat, setCombat] = useState(null);
  const [selectedCombat, setSelectedCombat] = useState(null);
  const [selectedDiscard, setSelectedDiscard] = useState(null);
  const [selectedIdCards, setSelectedIdCards] = useState([]);
  const [blessureCards, setBlessureCards] = useState([]);
  const [phase, setPhase] = useState("declare");
  const [sceauPickerToken, setSceauPickerToken] = useState(null); // jeton Sceau Divin en cours de ciblage

  const me = allPlayers.find(p => p.id === playerId);
  const myState = gameState?.players?.[playerId] || {};
  const availableCards = myState.availableCombatCards || [1,2,3,4,5,6,7,8];
  const myIdCards = myState.idCards || [];
  const myIdCombatCards = myIdCards.filter(c => c.timing === "combat" || c.timing === "any");

  // gameState.players ne contient pas la couleur (stockée dans session.allPlayers).
  // On l'enrichit ici pour que getCombatResult/getCombatCreatureBonus puissent
  // résoudre colorA/colorD correctement.
  const gameStateForCombat = {
    ...gameState,
    players: Object.fromEntries(
      allPlayers.map(p => [p.id, { ...(gameState?.players?.[p.id] || {}), color: p.color }])
    ),
  };

  useEffect(() => {
    const unsubscribe = onValue(ref(db, `rooms/${roomCode}/combat`), snapshot => {
      if (!snapshot.exists()) {
        setCombat(null);
        setPhase("declare");
        return;
      }
      const data = snapshot.val();
      setCombat(data);
      setPhase(
        data.status === "post_combat" ? "post_combat" :
        data.status === "revealed"    ? "revealed"    :
        data.status === "swap_phase"  ? "swap_phase"  :
        data.status === "id_phase"    ? "id_phase"    :
        data.status === "selecting"   ? "selecting"   : "declare"
      );
    });
    return () => unsubscribe();
  }, [roomCode]);

  // Vérifie si les 2 joueurs sont prêts → passe en phase ID
  useEffect(() => {
    if (!combat || combat.status !== "selecting") return;
    const choices = combat.choices || {};
    const attacker = combat.attacker;
    const defender = combat.defender;
    if (choices[attacker]?.ready && choices[defender]?.ready) {
      update(ref(db, `rooms/${roomCode}/combat`), {
        status: "id_phase",
        currentTurn: attacker,
        consecutivePasses: 0,
      });
    }
  }, [combat]);

  // Vérifie 2 passes consécutives → swap_phase ou révélation
  useEffect(() => {
    if (!combat || combat.status !== "id_phase") return;
    if (combat.consecutivePasses >= 2) {
      const swapPlayers = [combat.attacker, combat.defender].filter(pid =>
        (combat.choices?.[pid]?.idCards || []).some(c => c?.effect?.type === 'swap_combat_card')
      );
      if (swapPlayers.length > 0) {
        const swapPending = {};
        swapPlayers.forEach(pid => { swapPending[pid] = "pending"; });
        update(ref(db, `rooms/${roomCode}/combat`), { status: "swap_phase", swapPending });
      } else {
        update(ref(db, `rooms/${roomCode}/combat`), { status: "revealed" });
      }
    }
  }, [combat]);

  // Vérifie que tous les joueurs ont décidé du swap → révélation
  useEffect(() => {
    if (!combat || combat.status !== "swap_phase") return;
    const pending = combat.swapPending || {};
    if (Object.keys(pending).length > 0 && Object.values(pending).every(v => v === "done")) {
      update(ref(db, `rooms/${roomCode}/combat`), { status: "revealed" });
    }
  }, [combat]);

  // ── IA : sélection de cartes en phase "selecting" ──────────────────────────
  useEffect(() => {
    if (!combat || combat.status !== "selecting") return;
    [combat.attacker, combat.defender].forEach(pid => {
      const player = allPlayers.find(p => p.id === pid);
      if (!player?.isAI) return;
      if (combat.choices?.[pid]?.ready) return;
      const aiState = gameState?.players?.[pid] || {};
      const available = aiState.availableCombatCards || [1, 2, 3, 4, 5, 6, 7, 8];
      const opponentId = pid === combat.attacker ? combat.defender : combat.attacker;
      const opponentAvailable = (gameState?.players?.[opponentId] || {}).availableCombatCards || [1, 2, 3, 4, 5, 6, 7, 8];
      const cards = aiChooseCombatCards(available, opponentAvailable);
      if (!cards) return;
      setTimeout(() => {
        update(ref(db, `rooms/${roomCode}/combat/choices/${pid}`), {
          combatCard: cards.combatCard,
          discardCard: cards.discardCard,
          idCards: [],
          ready: true,
        });
        const cardDesc = (id) => { const c = COMBAT_CARDS.find(c => c.id === id); return c ? `#${id}[F${c.force}/${c.blood}sang/${c.shields}bou]` : `#${id}`; };
        const role = pid === combat.attacker ? "ATT" : "DEF";
        logAction?.(pid, `COMBAT (${role}) choisit carte:${cardDesc(cards.combatCard)} défausse:${cardDesc(cards.discardCard)} — dispo:${available.length} cartes — en ${combat.zoneId}`);
      }, 800);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.status, JSON.stringify(combat?.choices)]);

  // ── IA : phase "id_phase" — joue une carte ID si pertinent, sinon passe ────
  useEffect(() => {
    if (!combat || combat.status !== "id_phase") return;
    const currentPlayer = allPlayers.find(p => p.id === combat.currentTurn);
    if (!currentPlayer?.isAI) return;
    const t = setTimeout(async () => {
      const pid = combat.currentTurn;
      const aiIdCards = (gameState?.players?.[pid] || {}).idCards || [];
      const combatTimingCards = aiIdCards.filter(c => c.timing === "combat" || c.timing === "any");
      const cardToPlay = aiSelectCombatIdCard(combatTimingCards, combat, gameState, allPlayers, pid);
      const nextTurn = combat.currentTurn === combat.attacker ? combat.defender : combat.attacker;
      if (cardToPlay) {
        const existingIdCards = combat.choices?.[pid]?.idCards || [];
        await update(ref(db, `rooms/${roomCode}/combat/choices/${pid}`), {
          idCards: [...existingIdCards, cardToPlay],
        });
        await update(ref(db, `rooms/${roomCode}/gameState/players/${pid}`), {
          idCards: aiIdCards.filter(c => c.instanceId !== cardToPlay.instanceId),
        });
        await update(ref(db, `rooms/${roomCode}/combat`), {
          currentTurn: nextTurn,
          consecutivePasses: 0,
        });
        const role = pid === combat.attacker ? "ATT" : "DEF";
        const effDesc = cardToPlay.effect?.type === 'force' ? `+${cardToPlay.effect.value ?? 1} force`
          : cardToPlay.effect?.type === 'shields' ? `+${cardToPlay.effect.value ?? 1} boucliers`
          : cardToPlay.effect?.type === 'blood' ? `+${cardToPlay.effect.value ?? 1} sang`
          : cardToPlay.effect?.type ?? "effet";
        logAction?.(pid, `CARTE ID combat (${role}) joue "${cardToPlay.name}" [${effDesc}] en ${combat.zoneId}`);
      } else {
        update(ref(db, `rooms/${roomCode}/combat`), {
          currentTurn: nextTurn,
          consecutivePasses: (combat.consecutivePasses || 0) + 1,
        });
        const role = pid === combat.attacker ? "ATT" : "DEF";
        logAction?.(pid, `CARTE ID combat (${role}) passe (${combatTimingCards.length} cartes dispo) en ${combat.zoneId}`);
      }
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.currentTurn, combat?.status]);

  // ── IA : applique les résultats si les 2 sont IA en phase "revealed" ────────
  useEffect(() => {
    if (!combat || combat.status !== "revealed") return;
    const attackerIsAI = allPlayers.find(p => p.id === combat.attacker)?.isAI;
    const defenderIsAI = allPlayers.find(p => p.id === combat.defender)?.isAI;
    if (!attackerIsAI || !defenderIsAI) return;
    const t = setTimeout(() => handleApplyResults(), 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.status]);

  // ── IA : décisions post-combat (vaincu) ────────────────────────────────────
  useEffect(() => {
    if (!combat || combat.status !== "post_combat") return;
    const pc = combat.postCombat;
    if (!pc) return;
    const loserPlayer = allPlayers.find(p => p.id === pc.loserId);
    if (!loserPlayer?.isAI) return;
    if (pc.loserUnitsAfter === 0 || pc.loserChoice != null) return;
    // Attendre que le vainqueur ait proposé une zone (ou qu'il n'y en ait pas)
    const boardUnits = gameState?.boardUnits || {};
    const freeZones = (ZONE_ADJACENCY[combat.zoneId] || []).filter(z =>
      (boardUnits[z]?.[pc.winnerColor] ?? 0) === 0
    );
    if (freeZones.length > 0 && pc.retreatZoneId == null) return;
    const t = setTimeout(() => {
      update(ref(db, `rooms/${roomCode}/combat/postCombat`), { loserChoice: "recall" });
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.status, combat?.postCombat?.loserChoice, combat?.postCombat?.retreatZoneId]);

  // ── IA : place le perdant sur une zone adjacente libre ─────────────────────
  useEffect(() => {
    if (!combat || combat.status !== "post_combat") return;
    const pc = combat.postCombat;
    if (!pc) return;
    const winnerPlayer = allPlayers.find(p => p.id === pc.winnerId);
    if (!winnerPlayer?.isAI) return;
    if (pc.loserUnitsAfter === 0 || pc.retreatZoneId != null) return;
    const boardUnits = gameState?.boardUnits || {};
    const freeZones = (ZONE_ADJACENCY[combat.zoneId] || []).filter(z =>
      (boardUnits[z]?.[pc.winnerColor] ?? 0) === 0
    );
    if (freeZones.length === 0) return;
    const t = setTimeout(() => {
      update(ref(db, `rooms/${roomCode}/combat/postCombat`), { retreatZoneId: freeZones[0] });
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.status, combat?.postCombat?.retreatZoneId]);

  // ── IA : décisions post-combat (vainqueur) ─────────────────────────────────
  useEffect(() => {
    if (!combat || combat.status !== "post_combat") return;
    const pc = combat.postCombat;
    if (!pc) return;
    const winnerPlayer = allPlayers.find(p => p.id === pc.winnerId);
    if (!winnerPlayer?.isAI) return;
    if (pc.winnerUnitsAfter === 0 || pc.winnerRecall != null) return;
    const t = setTimeout(() => {
      // L'IA gagne → reste sur la zone pour contrôler le territoire
      update(ref(db, `rooms/${roomCode}/combat/postCombat`), { winnerRecall: false });
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.status, combat?.postCombat?.winnerRecall]);

  // ── IA : finalise le post-combat si les 2 sont IA ──────────────────────────
  useEffect(() => {
    if (!combat || combat.status !== "post_combat") return;
    const pc = combat.postCombat;
    if (!pc) return;
    const loserPlayer = allPlayers.find(p => p.id === pc.loserId);
    const winnerPlayer = allPlayers.find(p => p.id === pc.winnerId);
    if (!loserPlayer?.isAI || !winnerPlayer?.isAI) return;
    const canFinalize =
      (pc.loserUnitsAfter === 0 || pc.loserChoice != null) &&
      (pc.winnerUnitsAfter === 0 || pc.winnerRecall != null);
    if (!canFinalize) return;
    const t = setTimeout(() => handleFinalizePostCombat(), 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combat?.status, combat?.postCombat?.loserChoice, combat?.postCombat?.winnerRecall]);

  async function handleDeclare(defenderId) {
    const attackerColor = allPlayers.find(p => p.id === playerId)?.color;
    const defenderColor = allPlayers.find(p => p.id === defenderId)?.color;
    const boardUnits = gameState?.boardUnits || {};
    const combatZone = Object.entries(boardUnits).find(([, units]) =>
      (units[attackerColor] ?? 0) > 0 && (units[defenderColor] ?? 0) > 0
    )?.[0];
    if (!combatZone) return;
    await set(ref(db, `rooms/${roomCode}/combat`), {
      attacker: playerId,
      defender: defenderId,
      zoneId: combatZone,
      status: "selecting",
      choices: {},
    });
  }

  async function handleReady() {
    if (!selectedCombat || !selectedDiscard) return;
    if (selectedCombat === selectedDiscard) return;
    await update(ref(db, `rooms/${roomCode}/combat/choices/${playerId}`), {
      combatCard: selectedCombat,
      discardCard: selectedDiscard,
      idCards: [],
      ready: true,
    });
    setSelectedCombat(null);
    setSelectedDiscard(null);
  }

  // ── Jetons JU (Ta-Seti) jouables au démarrage du combat (attaquant) ────────
  async function playJuTokenInCombat(token, extraUpdates, logText) {
    const hand = myState.juTokenHand || [];
    const idx = hand.findIndex(t => t.nodeId === token.nodeId && t.cardId === token.cardId);
    if (idx === -1) return;
    const newHand = hand.filter((_, i) => i !== idx);
    await update(ref(db, "/"), {
      [`rooms/${roomCode}/gameState/players/${playerId}/juTokenHand`]: newHand.length > 0 ? newHand : null,
      ...extraUpdates,
    });
    if (logText) logAction?.(playerId, logText);
    setSceauPickerToken(null);
  }

  function handlePlayPointsToken(token) {
    playJuTokenInCombat(token, {
      [`rooms/${roomCode}/combat/pointsTokenPlayerId`]: playerId,
    }, `joue le jeton Points en ${combat?.zoneId} (+1 PV si victoire avec survivants, -1 PV si défaite)`);
  }

  function handlePlaySimpleToken(token) {
    playJuTokenInCombat(token, {
      [`rooms/${roomCode}/combat/simpleCombat`]: true,
    }, `joue le jeton Combat Simple en ${combat?.zoneId} : seules les unités et les cartes combat comptent`);
  }

  function handlePlaySceauToken(token, tileId, ownerPid) {
    const tileName = POWER_TILES.find(t => t.id === tileId)?.name ?? tileId;
    playJuTokenInCombat(token, {
      [`rooms/${roomCode}/gameState/disabledTileIds/${tileId}`]: ownerPid,
    }, `joue le Sceau Divin : annule "${tileName}" jusqu'au prochain tour de son propriétaire`);
  }

  async function handlePlayIdCards() {
    if (!combat) return;
    const currentIdCards = combat.choices?.[playerId]?.idCards || [];
    const newIdCards = [...currentIdCards, ...selectedIdCards];
    const myCurrentCards = myIdCards.filter(c => !selectedIdCards.find(s => s.instanceId === c.instanceId));

    await update(ref(db, `rooms/${roomCode}/combat/choices/${playerId}`), {
      idCards: newIdCards,
    });
    await update(ref(db, `rooms/${roomCode}/gameState/players/${playerId}`), {
      idCards: myCurrentCards,
    });
    setSelectedIdCards([]);
    await handlePass(false);
  }

  async function handlePass(isPass = true) {
    if (!combat) return;
    const attacker = combat.attacker;
    const defender = combat.defender;
    const nextTurn = combat.currentTurn === attacker ? defender : attacker;
    const consecutive = isPass ? (combat.consecutivePasses || 0) + 1 : 0;
    await update(ref(db, `rooms/${roomCode}/combat`), {
      currentTurn: nextTurn,
      consecutivePasses: consecutive,
    });
  }

  function hasBlessureDivine(pid) {
    const owned = gameState?.players?.[pid]?.ownedTileIds || [];
    return owned.some(id => POWER_TILES.find(t => t.id === id)?.name === "Force par ID");
  }

  async function handleConfirmBlessure() {
    if (!combat) return;
    const myAllIdCards = myState.idCards || [];
    const kept = myAllIdCards.filter(c => !blessureCards.find(b => b.instanceId === c.instanceId));
    await update(ref(db, `rooms/${roomCode}/combat/choices/${playerId}`), {
      blessureCards: blessureCards.length,
      blessureReady: true,
    });
    await update(ref(db, `rooms/${roomCode}/gameState/players/${playerId}`), {
      idCards: kept,
    });
    setBlessureCards([]);
  }

  // Applique les dégâts et passe en phase post_combat
  async function handleApplyResults() {
    if (!combat || combat.status !== "revealed") return; // guard anti-double-clic
    try {
    const result = getCombatResult(combat, gameStateForCombat, POWER_TILES, COMBAT_CARDS);
    if (!result) return;

    const {
      winnerId, loserId,
      attackerUnitsAfter, defenderUnitsAfter,
      attackerDamage, defenderDamage,
      unitsA, unitsD,
      colorA, colorD,
      winnerCreatureName, winnerNullified, winnerCardId,
      jpFlagsA, jpFlagsD,
    } = result;

    // Coût carte 1 (lose2units) : appliqué APRÈS le résultat, ne compte pas comme kills adverses
    const combatCardA = COMBAT_CARDS.find(c => c.id === combat.choices?.[combat.attacker]?.combatCard);
    const combatCardD = COMBAT_CARDS.find(c => c.id === combat.choices?.[combat.defender]?.combatCard);
    const lose2A = combatCardA?.effect === "lose2units" ? Math.min(2, attackerUnitsAfter) : 0;
    const lose2D = combatCardD?.effect === "lose2units" ? Math.min(2, defenderUnitsAfter) : 0;
    const finalAttackerUnits = attackerUnitsAfter - lose2A;
    const finalDefenderUnits = defenderUnitsAfter - lose2D;

    const winnerColor = winnerId === combat.attacker ? colorA : colorD;
    const loserColor  = loserId  === combat.attacker ? colorA : colorD;
    const winnerUnitsAfter = winnerId === combat.attacker ? finalAttackerUnits : finalDefenderUnits;
    const loserUnitsAfter  = loserId  === combat.attacker ? finalAttackerUnits : finalDefenderUnits;

    // Sceau Divin : les tuiles annulées ne donnent pas leurs bonus post-combat
    const disabledT = gameState?.disabledTileIds || {};
    const hasActiveTile = (pid, name) => (gameState?.players?.[pid]?.ownedTileIds || []).some(
      id => !disabledT[id] && POWER_TILES.find(t => t.id === id)?.name === name
    );

    const updates = {};

    // Appliquer dégâts sang + lose2units dans boardUnits
    updates[`rooms/${roomCode}/gameState/boardUnits/${combat.zoneId}/${colorA}`] = finalAttackerUnits;
    updates[`rooms/${roomCode}/gameState/boardUnits/${combat.zoneId}/${colorD}`] = finalDefenderUnits;

    // Lose2units → réserve (coût propre, pas kills adverses)
    if (lose2A > 0) {
      const ps = gameState?.players?.[combat.attacker] || {};
      const base = updates[`rooms/${roomCode}/gameState/players/${combat.attacker}/unitsReserve`] ?? (ps.unitsReserve ?? 0);
      updates[`rooms/${roomCode}/gameState/players/${combat.attacker}/unitsReserve`] = base + lose2A;
    }
    if (lose2D > 0) {
      const ps = gameState?.players?.[combat.defender] || {};
      const base = updates[`rooms/${roomCode}/gameState/players/${combat.defender}/unitsReserve`] ?? (ps.unitsReserve ?? 0);
      updates[`rooms/${roomCode}/gameState/players/${combat.defender}/unitsReserve`] = base + lose2D;
    }

    // Unités détruites par sang → réserve
    if (attackerDamage > 0) {
      const ps = gameState?.players?.[combat.attacker] || {};
      updates[`rooms/${roomCode}/gameState/players/${combat.attacker}/unitsReserve`] = (ps.unitsReserve ?? 0) + attackerDamage;
    }
    if (defenderDamage > 0) {
      const ps = gameState?.players?.[combat.defender] || {};
      updates[`rooms/${roomCode}/gameState/players/${combat.defender}/unitsReserve`] = (ps.unitsReserve ?? 0) + defenderDamage;
    }

    // Créature sans unités → retirer de la zone
    if (attackerUnitsAfter === 0) {
      const ca = gameState?.creatureAssignments;
      if (ca?.[combat.zoneId]?.[colorA]) updates[`rooms/${roomCode}/gameState/creatureAssignments/${combat.zoneId}/${colorA}`] = null;
      const ca2 = gameState?.creatureAssignments2;
      if (ca2?.[combat.zoneId]?.[colorA]) updates[`rooms/${roomCode}/gameState/creatureAssignments2/${combat.zoneId}/${colorA}`] = null;
    }
    if (defenderUnitsAfter === 0) {
      const ca = gameState?.creatureAssignments;
      if (ca?.[combat.zoneId]?.[colorD]) updates[`rooms/${roomCode}/gameState/creatureAssignments/${combat.zoneId}/${colorD}`] = null;
      const ca2 = gameState?.creatureAssignments2;
      if (ca2?.[combat.zoneId]?.[colorD]) updates[`rooms/${roomCode}/gameState/creatureAssignments2/${combat.zoneId}/${colorD}`] = null;
    }

    // Prêtre de plateau → retour en réserve si sa troupe est détruite
    const boardPriests = gameState?.boardPriests || {};
    if (attackerUnitsAfter === 0 && boardPriests[combat.zoneId]?.[colorA]) {
      const bpA = boardPriests[combat.zoneId][colorA];
      updates[`rooms/${roomCode}/gameState/boardPriests/${combat.zoneId}/${colorA}`] = null;
      updates[`rooms/${roomCode}/gameState/taSetiPriestPositions/${combat.attacker}/${bpA.priestIndex}`] = '';
    }
    if (defenderUnitsAfter === 0 && boardPriests[combat.zoneId]?.[colorD]) {
      const bpD = boardPriests[combat.zoneId][colorD];
      updates[`rooms/${roomCode}/gameState/boardPriests/${combat.zoneId}/${colorD}`] = null;
      updates[`rooms/${roomCode}/gameState/taSetiPriestPositions/${combat.defender}/${bpD.priestIndex}`] = '';
    }

    // PV : attaquant gagne 1 PV si et seulement s'il gagne ET a au moins 1 unité survivante
    if (winnerId === combat.attacker && attackerUnitsAfter > 0) {
      const ps = gameState?.players?.[winnerId] || {};
      const base = updates[`rooms/${roomCode}/gameState/players/${winnerId}/vpPermanent`] ?? (ps.vpPermanent ?? 0);
      updates[`rooms/${roomCode}/gameState/players/${winnerId}/vpPermanent`] = base + 1;
      const combatBase = updates[`rooms/${roomCode}/gameState/players/${winnerId}/vpCombat`] ?? (ps.vpCombat ?? 0);
      updates[`rooms/${roomCode}/gameState/players/${winnerId}/vpCombat`] = combatBase + 1;
    }

    // Victoire Défensive : +1 PV si le défenseur gagne (tuile pouvoir ou jeton JP)
    if (winnerId === combat.defender) {
      const defState = gameState?.players?.[winnerId] || {};
      const hasVictoireDefensive = hasActiveTile(winnerId, "Victoire Défensive") || jpFlagsD?.defenseVictoryVp;
      if (hasVictoireDefensive && defenderUnitsAfter > 0) {
        const base = updates[`rooms/${roomCode}/gameState/players/${winnerId}/vpPermanent`] ?? (defState.vpPermanent ?? 0);
        updates[`rooms/${roomCode}/gameState/players/${winnerId}/vpPermanent`] = base + 1;
        const combatBase = updates[`rooms/${roomCode}/gameState/players/${winnerId}/vpCombat`] ?? (defState.vpCombat ?? 0);
        updates[`rooms/${roomCode}/gameState/players/${winnerId}/vpCombat`] = combatBase + 1;
      }
    }

    // Jeton Points (Ta-Seti) : pari sur l'issue du combat
    // +1 PV si victoire avec au moins 1 unité survivante ; 0 si victoire sans
    // survivant ; -1 PV en cas de défaite.
    if (combat.pointsTokenPlayerId) {
      const pid = combat.pointsTokenPlayerId;
      const won = winnerId === pid;
      const myUnitsAfter = pid === combat.attacker ? attackerUnitsAfter : defenderUnitsAfter;
      let delta = 0;
      if (won && myUnitsAfter > 0) delta = 1;
      else if (!won) delta = -1;
      if (delta !== 0) {
        const ps = gameState?.players?.[pid] || {};
        const base = updates[`rooms/${roomCode}/gameState/players/${pid}/vpPermanent`] ?? (ps.vpPermanent ?? 0);
        updates[`rooms/${roomCode}/gameState/players/${pid}/vpPermanent`] = Math.max(0, base + delta);
      }
      logAction?.(pid, `jeton Points : ${delta > 0 ? "+1 PV (victoire avec survivants)" : delta < 0 ? "-1 PV (défaite)" : "aucun PV (victoire sans survivant)"}`);
    }

    function hasDayAnk(pid) {
      return hasActiveTile(pid, "+1 d'Ank en journée");
    }

    // 4 ank en cas de victoire
    if (winnerId) {
      const ws = gameState?.players?.[winnerId] || {};
      const has4AnkWin = hasActiveTile(winnerId, "4 ank en cas de victoire");
      if (has4AnkWin) {
        const gain = 4 + (hasDayAnk(winnerId) ? 4 : 0);
        const base = updates[`rooms/${roomCode}/gameState/players/${winnerId}/ank`] ?? (ws.ank ?? 7);
        updates[`rooms/${roomCode}/gameState/players/${winnerId}/ank`] = Math.min(11, base + gain);
      }
    }

    // 1 Ank par unité tuée
    const attackerKills = (unitsD ?? 0) - defenderUnitsAfter;
    const defenderKills = (unitsA ?? 0) - attackerUnitsAfter;
    if (attackerKills > 0) {
      const ps = gameState?.players?.[combat.attacker] || {};
      const hasAnkPerKill = hasActiveTile(combat.attacker, "1 Ank par unité tué");
      if (hasAnkPerKill) {
        const gain = attackerKills + (hasDayAnk(combat.attacker) ? attackerKills : 0);
        const base = updates[`rooms/${roomCode}/gameState/players/${combat.attacker}/ank`] ?? (ps.ank ?? 0);
        updates[`rooms/${roomCode}/gameState/players/${combat.attacker}/ank`] = Math.min(11, base + gain);
      }
    }
    if (defenderKills > 0) {
      const ps = gameState?.players?.[combat.defender] || {};
      const hasAnkPerKill = hasActiveTile(combat.defender, "1 Ank par unité tué");
      if (hasAnkPerKill) {
        const gain = defenderKills + (hasDayAnk(combat.defender) ? defenderKills : 0);
        const base = updates[`rooms/${roomCode}/gameState/players/${combat.defender}/ank`] ?? (ps.ank ?? 0);
        updates[`rooms/${roomCode}/gameState/players/${combat.defender}/ank`] = Math.min(11, base + gain);
      }
    }

    // 1 ank par unité perdue (N_2_3)
    const attackerLosses = defenderKills;
    const defenderLosses = attackerKills;
    if (attackerLosses > 0) {
      const ps = gameState?.players?.[combat.attacker] || {};
      if (hasActiveTile(combat.attacker, "1 ank par unité perdu")) {
        const gain = attackerLosses + (hasDayAnk(combat.attacker) ? attackerLosses : 0);
        const base = updates[`rooms/${roomCode}/gameState/players/${combat.attacker}/ank`] ?? (ps.ank ?? 0);
        updates[`rooms/${roomCode}/gameState/players/${combat.attacker}/ank`] = Math.min(11, base + gain);
      }
    }
    if (defenderLosses > 0) {
      const ps = gameState?.players?.[combat.defender] || {};
      if (hasActiveTile(combat.defender, "1 ank par unité perdu")) {
        const gain = defenderLosses + (hasDayAnk(combat.defender) ? defenderLosses : 0);
        const base = updates[`rooms/${roomCode}/gameState/players/${combat.defender}/ank`] ?? (ps.ank ?? 0);
        updates[`rooms/${roomCode}/gameState/players/${combat.defender}/ank`] = Math.min(11, base + gain);
      }
    }

    // Butin de Guerre (+ank si victoire) / Recrutement de Victoire (+unités si victoire)
    const winnerIdCards = combat.choices?.[winnerId]?.idCards || [];
    const ankIfWin = winnerIdCards.filter(c => c?.effect?.type === 'ank_if_win').reduce((s, c) => s + (c.effect.value || 0), 0);
    const unitsIfWin = winnerIdCards.filter(c => c?.effect?.type === 'units_if_win').reduce((s, c) => s + (c.effect.value || 0), 0);
    if (ankIfWin > 0) {
      const ws = gameState?.players?.[winnerId] || {};
      const base = updates[`rooms/${roomCode}/gameState/players/${winnerId}/ank`] ?? (ws.ank ?? 0);
      updates[`rooms/${roomCode}/gameState/players/${winnerId}/ank`] = Math.min(11, base + ankIfWin);
    }
    if (unitsIfWin > 0) {
      updates[`rooms/${roomCode}/gameState/players/${winnerId}/victoryRecruitPending`] = unitsIfWin;
    }

    // JP_replacement_unite : le gagnant récupère 1 unité perdue s'il en a encore
    {
      const winnerIsAttacker = winnerId === combat.attacker;
      const winnerLosses = winnerIsAttacker ? attackerDamage : defenderDamage;
      const winnerUnitsLeft = winnerIsAttacker ? attackerUnitsAfter : defenderUnitsAfter;
      const winnerJpFlags = winnerIsAttacker ? jpFlagsA : jpFlagsD;
      if (winnerJpFlags?.replacementUnit && winnerLosses > 0 && winnerUnitsLeft > 0) {
        const ws = gameState?.players?.[winnerId] || {};
        const base = updates[`rooms/${roomCode}/gameState/players/${winnerId}/victoryRecruitPending`] ?? (ws.victoryRecruitPending ?? 0);
        updates[`rooms/${roomCode}/gameState/players/${winnerId}/victoryRecruitPending`] = base + 1;
      }
    }

    // Bonus VP Dévoreuse des Mondes
    if (winnerCreatureName && !winnerNullified) {
      const power = CREATURE_POWERS[winnerCreatureName];
      if (power?.onWinBloodBonus) {
        const wCard = COMBAT_CARDS.find(c => c.id === winnerCardId);
        if (wCard && wCard.blood >= power.onWinBloodBonus.minBlood) {
          const ps = gameState?.players?.[winnerId] || {};
          const base = updates[`rooms/${roomCode}/gameState/players/${winnerId}/vpPermanent`] ?? (ps.vpPermanent ?? 0);
          updates[`rooms/${roomCode}/gameState/players/${winnerId}/vpPermanent`] = base + power.onWinBloodBonus.vp;
          const combatBase = updates[`rooms/${roomCode}/gameState/players/${winnerId}/vpCombat`] ?? (ps.vpCombat ?? 0);
          updates[`rooms/${roomCode}/gameState/players/${winnerId}/vpCombat`] = combatBase + power.onWinBloodBonus.vp;
        }
      }
    }

    // Effacer les bonus Ta-Seti utilisés dans ce combat
    [combat.attacker, combat.defender].forEach(pid => {
      if ((gameState?.players?.[pid]?.tasetiForce   ?? 0) > 0) updates[`rooms/${roomCode}/gameState/players/${pid}/tasetiForce`]   = null;
      if ((gameState?.players?.[pid]?.tasetiBlood   ?? 0) > 0) updates[`rooms/${roomCode}/gameState/players/${pid}/tasetiBlood`]   = null;
      if ((gameState?.players?.[pid]?.tasetiShields ?? 0) > 0) updates[`rooms/${roomCode}/gameState/players/${pid}/tasetiShields`] = null;
    });

    // Rotation des cartes combat
    [combat.attacker, combat.defender].forEach(pid => {
      const choice = combat.choices?.[pid];
      if (!choice) return;
      const ps = gameState?.players?.[pid] || {};
      const available = ps.availableCombatCards || [1,2,3,4,5,6,7,8];
      let next = available.filter(id => id !== choice.combatCard && id !== choice.discardCard);
      if (next.length < 2) next = getPlayerCombatDeck(ps);
      updates[`rooms/${roomCode}/gameState/players/${pid}/availableCombatCards`] = next;
    });

    // Cartes ID jouées → défausse partagée
    const allPlayedIdCards = [
      ...(combat.choices?.[combat.attacker]?.idCards || []),
      ...(combat.choices?.[combat.defender]?.idCards || []),
    ];
    if (allPlayedIdCards.length > 0) {
      const currentDiscard = gameState?.idDiscard || [];
      updates[`rooms/${roomCode}/gameState/idDiscard`] = [...currentDiscard, ...allPlayedIdCards];
    }

    // Phase post_combat — freeZones calculées en live dans l'UI depuis gameState courant
    updates[`rooms/${roomCode}/combat/status`] = "post_combat";
    updates[`rooms/${roomCode}/combat/postCombat`] = {
      winnerId, loserId, winnerColor, loserColor,
      winnerUnitsAfter, loserUnitsAfter,
      retreatZoneId: null,
      loserChoice: loserUnitsAfter === 0 ? "recall" : null,
      winnerRecall: null,
    };

    await update(ref(db, "/"), updates);

    const winnerName = allPlayers.find(p => p.id === winnerId)?.name || "?";
    const loserName  = allPlayers.find(p => p.id === loserId)?.name  || "?";
    const cardDesc = (id) => { const c = COMBAT_CARDS.find(c => c.id === id); return c ? `#${id}[F${c.force}/${c.blood}s/${c.shields}b]` : `#${id}`; };
    const attCard = cardDesc(combat.choices?.[combat.attacker]?.combatCard);
    const defCard = cardDesc(combat.choices?.[combat.defender]?.combatCard);
    const attIdPlayed = (combat.choices?.[combat.attacker]?.idCards || []).map(c => c.name).join(", ");
    const defIdPlayed = (combat.choices?.[combat.defender]?.idCards || []).map(c => c.name).join(", ");
    const attName = allPlayers.find(p => p.id === combat.attacker)?.name || "?";
    const defName = allPlayers.find(p => p.id === combat.defender)?.name || "?";
    // Reconstituer gains depuis updates
    const getAnkGain = (pid) => {
      const prev = gameState?.players?.[pid]?.ank ?? 0;
      const next = updates[`rooms/${roomCode}/gameState/players/${pid}/ank`];
      return next !== undefined ? next - prev : 0;
    };
    const getVpGain = (pid) => {
      const prev = gameState?.players?.[pid]?.vpPermanent ?? 0;
      const next = updates[`rooms/${roomCode}/gameState/players/${pid}/vpPermanent`];
      return next !== undefined ? next - prev : 0;
    };
    const buildGains = (pid) => {
      const parts = [];
      const vp = getVpGain(pid); if (vp > 0) parts.push(`+${vp}PV`);
      const ank = getAnkGain(pid); if (ank !== 0) parts.push(`${ank > 0 ? "+" : ""}${ank}Ank`);
      const unitsR = updates[`rooms/${roomCode}/gameState/players/${pid}/unitsReserve`];
      const prevR = gameState?.players?.[pid]?.unitsReserve ?? 0;
      if (unitsR !== undefined && unitsR !== prevR) parts.push(`${unitsR - prevR > 0 ? "+" : ""}${unitsR - prevR}u.réserve`);
      return parts.length ? ` [${parts.join(" ")}]` : "";
    };
    logAction?.(winnerId, `RÉSULTAT ${combat.zoneId} — ${winnerName} GAGNE${buildGains(winnerId)} (${winnerUnitsAfter} surv.) vs ${loserName}${buildGains(loserId)} (${loserUnitsAfter} surv.) | ${attName}:${attCard}${attIdPlayed ? "+" + attIdPlayed : ""} vs ${defName}:${defCard}${defIdPlayed ? "+" + defIdPlayed : ""} | sang ATT:${attackerDamage} DEF:${defenderDamage}`);
    } catch (err) {
      console.error("handleApplyResults error:", err);
    }
  }

  // Finalise le post-combat : applique retraite/rappel
  async function handleFinalizePostCombat() {
    const pc = combat?.postCombat;
    if (!pc) return;
    const { winnerId, loserId, winnerColor, loserColor, winnerUnitsAfter, loserUnitsAfter, loserChoice, retreatZoneId, winnerRecall } = pc;
    const zoneId = combat.zoneId;
    const updates = {};

    // Vaincu : rappel ou rester sur la zone choisie par le vainqueur
    if (loserUnitsAfter > 0) {
      if (loserChoice === "stay" && retreatZoneId) {
        const currentInRetZone = gameState?.boardUnits?.[retreatZoneId]?.[loserColor] || 0;
        updates[`rooms/${roomCode}/gameState/boardUnits/${zoneId}/${loserColor}`] = 0;
        updates[`rooms/${roomCode}/gameState/boardUnits/${retreatZoneId}/${loserColor}`] = currentInRetZone + loserUnitsAfter;
        const ca = gameState?.creatureAssignments;
        const cTile = ca?.[zoneId]?.[loserColor];
        if (cTile) {
          updates[`rooms/${roomCode}/gameState/creatureAssignments/${zoneId}/${loserColor}`] = null;
          updates[`rooms/${roomCode}/gameState/creatureAssignments/${retreatZoneId}/${loserColor}`] = cTile;
        }
        const ca2 = gameState?.creatureAssignments2;
        const cTile2 = ca2?.[zoneId]?.[loserColor];
        if (cTile2) {
          updates[`rooms/${roomCode}/gameState/creatureAssignments2/${zoneId}/${loserColor}`] = null;
          updates[`rooms/${roomCode}/gameState/creatureAssignments2/${retreatZoneId}/${loserColor}`] = cTile2;
        }
      } else {
        // Rappel (loserChoice === "recall")
        updates[`rooms/${roomCode}/gameState/boardUnits/${zoneId}/${loserColor}`] = 0;
        const ls = gameState?.players?.[loserId] || {};
        updates[`rooms/${roomCode}/gameState/players/${loserId}/unitsReserve`] = (ls.unitsReserve ?? 0) + loserUnitsAfter;
        updates[`rooms/${roomCode}/gameState/players/${loserId}/ank`] = Math.min(11, (ls.ank ?? 0) + loserUnitsAfter);
        const ca = gameState?.creatureAssignments;
        if (ca?.[zoneId]?.[loserColor]) updates[`rooms/${roomCode}/gameState/creatureAssignments/${zoneId}/${loserColor}`] = null;
        const ca2 = gameState?.creatureAssignments2;
        if (ca2?.[zoneId]?.[loserColor]) updates[`rooms/${roomCode}/gameState/creatureAssignments2/${zoneId}/${loserColor}`] = null;
      }
    }

    // Vainqueur : rappel optionnel (+1 Ank/unité)
    if (winnerUnitsAfter > 0 && winnerRecall === true) {
      updates[`rooms/${roomCode}/gameState/boardUnits/${zoneId}/${winnerColor}`] = 0;
      const ws = gameState?.players?.[winnerId] || {};
      updates[`rooms/${roomCode}/gameState/players/${winnerId}/unitsReserve`] = (ws.unitsReserve ?? 0) + winnerUnitsAfter;
      updates[`rooms/${roomCode}/gameState/players/${winnerId}/ank`] = Math.min(11, (ws.ank ?? 0) + winnerUnitsAfter);
      const ca = gameState?.creatureAssignments;
      if (ca?.[zoneId]?.[winnerColor]) updates[`rooms/${roomCode}/gameState/creatureAssignments/${zoneId}/${winnerColor}`] = null;
      const ca2 = gameState?.creatureAssignments2;
      if (ca2?.[zoneId]?.[winnerColor]) updates[`rooms/${roomCode}/gameState/creatureAssignments2/${zoneId}/${winnerColor}`] = null;
    }

    // Contrôle de pyramide : mettre à jour controllerId selon qui reste dans la zone de cité
    const pyrSlotM = zoneId.match(/^J(\d)C(\d)$/);
    if (pyrSlotM) {
      const pyrSlot = `J${pyrSlotM[1]}P${pyrSlotM[2]}`;
      const pyr = gameState?.pyramids?.[pyrSlot];
      if (pyr) {
        const winnerStays = winnerUnitsAfter > 0 && winnerRecall !== true;
        if (pyr.ownerId !== pc.winnerId && winnerStays) {
          updates[`rooms/${roomCode}/gameState/pyramids/${pyrSlot}/controllerId`] = pc.winnerId;
        } else if (!winnerStays) {
          updates[`rooms/${roomCode}/gameState/pyramids/${pyrSlot}/controllerId`] = pyr.ownerId;
        }
      }
    }

    // Jeton aube : perdant reçoit toujours 1, vainqueur aussi si toutes ses unités sont éliminées
    const loserState = gameState?.players?.[loserId] || {};
    updates[`rooms/${roomCode}/gameState/players/${loserId}/dawnTokens`] = (loserState.dawnTokens ?? 0) + 1;
    if (winnerUnitsAfter === 0) {
      const winnerState = gameState?.players?.[winnerId] || {};
      updates[`rooms/${roomCode}/gameState/players/${winnerId}/dawnTokens`] = (winnerState.dawnTokens ?? 0) + 1;
    }

    await update(ref(db, "/"), updates);
    await remove(ref(db, `rooms/${roomCode}/combat`));

    const loserName  = allPlayers.find(p => p.id === pc.loserId)?.name  || "?";
    const winnerName = allPlayers.find(p => p.id === pc.winnerId)?.name || "?";
    if (pc.loserChoice === "stay" && pc.retreatZoneId) {
      logAction?.(pc.loserId, `POST-COMBAT repli en ${pc.retreatZoneId} [${pc.loserUnitsAfter} u.]`);
    } else if (pc.loserUnitsAfter > 0) {
      const ls = gameState?.players?.[pc.loserId] || {};
      const ankAfterL = Math.min(11, (ls.ank ?? 0) + pc.loserUnitsAfter);
      logAction?.(pc.loserId, `POST-COMBAT rappel [+${pc.loserUnitsAfter} Ank → ${ankAfterL}, +${pc.loserUnitsAfter} réserve]`);
    }
    if (pc.winnerRecall === true && pc.winnerUnitsAfter > 0) {
      const ws = gameState?.players?.[pc.winnerId] || {};
      const ankAfterW = Math.min(11, (ws.ank ?? 0) + pc.winnerUnitsAfter);
      logAction?.(pc.winnerId, `POST-COMBAT rappel vainqueur [+${pc.winnerUnitsAfter} Ank → ${ankAfterW}, +${pc.winnerUnitsAfter} réserve]`);
    }

    setSelectedCombat(null);
    setSelectedDiscard(null);
    setSelectedIdCards([]);
  }

  const isAttacker = combat?.attacker === playerId;
  const isDefender = combat?.defender === playerId;
  const isParticipant = isAttacker || isDefender;
  const isMyTurn = combat?.currentTurn === playerId;
  const opponents = allPlayers.filter(p => p.id !== playerId);

  function getPlayerName(pid) {
    return allPlayers.find(p => p.id === pid)?.name || pid;
  }

  function getCard(id) {
    return COMBAT_CARDS.find(c => c.id === id);
  }

  function toggleIdCard(card) {
    setSelectedIdCards(prev =>
      prev.find(c => c.instanceId === card.instanceId)
        ? prev.filter(c => c.instanceId !== card.instanceId)
        : [...prev, card]
    );
  }

  const hasPrescience   = combat?.prescience   === playerId;
  const hasPrescienceId = combat?.prescienceId === playerId;

  return (
    <div className="overflow-y-auto p-4 flex flex-col gap-3 border-b border-red-900/40 max-h-[60vh] shrink-0">

        {/* Header */}
        <div className="flex items-center">
          <h2 className="text-lg font-bold text-red-400">⚔ Combat</h2>
        </div>

        {/* Sélecteur de joueur (mode test) — conservé pour activer les cartes de l'adversaire */}
        {isTestMode && testPlayers && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-950/60 border border-yellow-700/40 rounded-lg">
            <span className="text-yellow-400 text-xs font-bold shrink-0">Vue :</span>
            {testPlayers.map(p => {
              const isSelected = testViewPlayerId === p.id;
              const badges = {
                Rouge: isSelected ? "bg-red-600 text-white border-yellow-400" : "bg-red-900/50 text-red-300 border-transparent hover:bg-red-800/60",
                Bleu:  isSelected ? "bg-blue-600 text-white border-yellow-400" : "bg-blue-900/50 text-blue-300 border-transparent hover:bg-blue-800/60",
                Vert:  isSelected ? "bg-emerald-600 text-white border-yellow-400" : "bg-emerald-900/50 text-emerald-300 border-transparent hover:bg-emerald-800/60",
                Blanc: isSelected ? "bg-gray-300 text-gray-900 border-yellow-400" : "bg-gray-700/50 text-gray-300 border-transparent hover:bg-gray-600/60",
                Noir:  isSelected ? "bg-gray-600 text-white border-yellow-400" : "bg-gray-900/50 text-gray-400 border-transparent hover:bg-gray-800/60",
              };
              return (
                <button
                  key={p.id}
                  onClick={() => onSwitchTestPlayer(p.id)}
                  className={`px-3 py-0.5 rounded-full text-xs font-bold transition-all border ${badges[p.color] || "bg-gray-700 text-white border-transparent"}`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        )}

        {/* PHASE : DÉCLARER */}
        {phase === "declare" && (
          <div className="flex flex-col gap-4">
            <p className="text-gray-300">Déclare un combat contre :</p>
            {opponents.map(p => (
              <button
                key={p.id}
                onClick={() => handleDeclare(p.id)}
                className="bg-red-800 hover:bg-red-700 px-4 py-3 rounded-lg font-semibold text-left"
              >
                Attaquer {p.name} ({p.color})
              </button>
            ))}
          </div>
        )}

        {/* PHASE : SÉLECTION CARTE COMBAT */}
        {phase === "selecting" && (
          <div className="flex flex-col gap-4">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-sm">
                Combat : <span className="text-white font-bold">{getPlayerName(combat?.attacker)}</span>
                {" "}vs <span className="text-white font-bold">{getPlayerName(combat?.defender)}</span>
              </p>
            </div>

            {!isParticipant && (
              <div className="text-center py-8">
                <p className="text-gray-400 text-lg">Vous observez le combat</p>
                <div className="mt-4 flex justify-center gap-4">
                  {[combat?.attacker, combat?.defender].map(pid => (
                    <div key={pid} className="bg-gray-800 rounded-lg px-4 py-2 text-sm">
                      <p className="text-white font-bold">{getPlayerName(pid)}</p>
                      <p className={combat?.choices?.[pid]?.ready ? "text-green-400" : "text-yellow-400"}>
                        {combat?.choices?.[pid]?.ready ? "Pret" : "En attente..."}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isParticipant && (
              <div className="flex flex-col gap-4">
                {hasPrescience && combat?.choices?.[combat?.attacker === playerId ? combat?.defender : combat?.attacker]?.combatCard && (
                  <div className="bg-purple-900 border border-purple-600 rounded-lg p-3 text-center">
                    <p className="text-purple-300 text-sm font-bold">Prescience</p>
                    <p className="text-gray-300 text-xs mt-1">
                      Carte adverse : Force {getCard(combat.choices[combat.attacker === playerId ? combat.defender : combat.attacker].combatCard)?.force}
                    </p>
                  </div>
                )}

                {combat?.choices?.[playerId]?.ready ? (
                  <div className="text-center py-4">
                    <p className="text-green-400 text-lg">Choix confirme</p>
                    <p className="text-gray-400 text-sm mt-2">En attente de l'adversaire...</p>
                    {[combat?.attacker, combat?.defender].filter(pid => pid !== playerId).map(pid => (
                      <p key={pid} className={`mt-2 text-sm ${combat?.choices?.[pid]?.ready ? "text-green-400" : "text-yellow-400"}`}>
                        {getPlayerName(pid)} : {combat?.choices?.[pid]?.ready ? "Pret" : "En attente..."}
                      </p>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Jetons Ta-Seti jouables au démarrage du combat (attaquant uniquement) */}
                    {playerId === combat?.attacker && (() => {
                      const hand = myState.juTokenHand || [];
                      const pointsToken = !combat?.pointsTokenPlayerId ? hand.find(t => t.cardId === 'PU_points') : null;
                      const simpleToken = !combat?.simpleCombat ? hand.find(t => t.cardId === 'PU_combat_simple') : null;
                      const sceauToken  = hand.find(t => t.cardId === 'PU_sceau_divin');
                      if (!pointsToken && !simpleToken && !sceauToken) return null;
                      const defenderTiles = (gameState?.players?.[combat?.defender]?.ownedTileIds || [])
                        .map(id => POWER_TILES.find(t => t.id === id))
                        .filter(t => t && !(gameState?.disabledTileIds || {})[t.id]);
                      return (
                        <div className="bg-amber-950/40 border border-amber-800/50 rounded-lg p-3">
                          <p className="text-amber-300 text-xs font-bold mb-2">🪬 Jetons Ta-Seti (démarrage du combat)</p>
                          <div className="flex flex-wrap gap-2">
                            {pointsToken && (
                              <button
                                onClick={() => handlePlayPointsToken(pointsToken)}
                                title="+1 PV si victoire avec au moins 1 unité survivante · rien si victoire sans survivant · -1 PV si défaite"
                                className="text-xs px-2.5 py-1 rounded border font-semibold bg-yellow-800/70 text-yellow-100 border-yellow-600 hover:bg-yellow-700"
                              >
                                🪬 Points
                              </button>
                            )}
                            {simpleToken && (
                              <button
                                onClick={() => handlePlaySimpleToken(simpleToken)}
                                title="Seules les unités et les cartes combat comptent dans ce combat"
                                className="text-xs px-2.5 py-1 rounded border font-semibold bg-cyan-900/70 text-cyan-100 border-cyan-600 hover:bg-cyan-800"
                              >
                                🪬 Combat Simple
                              </button>
                            )}
                            {sceauToken && defenderTiles.length > 0 && (
                              <button
                                onClick={() => setSceauPickerToken(sceauPickerToken ? null : sceauToken)}
                                title="Annule une tuile pouvoir du défenseur jusqu'à son prochain tour"
                                className="text-xs px-2.5 py-1 rounded border font-semibold bg-purple-900/70 text-purple-100 border-purple-600 hover:bg-purple-800"
                              >
                                🪬 Sceau Divin{sceauPickerToken ? " ▲" : ""}
                              </button>
                            )}
                          </div>
                          {combat?.simpleCombat && (
                            <p className="text-cyan-300 text-[11px] mt-2">Combat simple actif : unités + cartes combat uniquement.</p>
                          )}
                          {sceauPickerToken && (
                            <div className="mt-2 flex flex-col gap-1">
                              <p className="text-purple-300 text-[11px]">Tuile du défenseur à annuler :</p>
                              {defenderTiles.map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => handlePlaySceauToken(sceauPickerToken, t.id, combat.defender)}
                                  className="text-left text-xs px-2 py-1 rounded border bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700"
                                >
                                  {t.name} <span className="text-gray-500">· {t.color} niv.{t.level}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div>
                      <p className="text-sm text-gray-400 mb-2">Choisis ta carte combat :</p>
                      <div className="flex gap-2 flex-wrap">
                        {availableCards.map(id => {
                          const card = getCard(id);
                          if (!card) return null;
                          const isSelected  = selectedCombat  === id;
                          const isDiscarded = selectedDiscard === id;
                          return (
                            <button
                              key={id}
                              onClick={() => setSelectedCombat(isSelected ? null : id)}
                              disabled={isDiscarded}
                              style={{
                                width: 96, padding: 0, borderRadius: 8, overflow: 'hidden',
                                cursor: isDiscarded ? 'not-allowed' : 'pointer',
                                border: `2px solid ${isSelected ? '#facc15' : isDiscarded ? '#374151' : '#4b5563'}`,
                                opacity: isDiscarded ? 0.3 : 1,
                                boxShadow: isSelected ? '0 0 8px rgba(250,204,21,0.6)' : 'none',
                                transition: 'border-color 0.15s, box-shadow 0.15s',
                                background: 'transparent',
                              }}
                            >
                              <img
                                src={`/Combat_${card.force}${card.blood}${card.shields}.png`}
                                alt={`F${card.force}`}
                                draggable={false}
                                style={{ width: '100%', height: 'auto', display: 'block' }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-400 mb-2">Choisis ta carte a defausser :</p>
                      <div className="flex gap-2 flex-wrap">
                        {availableCards.map(id => {
                          const card   = getCard(id);
                          if (!card) return null;
                          const isSelected = selectedDiscard === id;
                          const isCombat   = selectedCombat  === id;
                          return (
                            <button
                              key={id}
                              onClick={() => setSelectedDiscard(isSelected ? null : id)}
                              disabled={isCombat}
                              style={{
                                width: 96, padding: 0, borderRadius: 8, overflow: 'hidden',
                                cursor: isCombat ? 'not-allowed' : 'pointer',
                                border: `2px solid ${isSelected ? '#f87171' : isCombat ? '#374151' : '#4b5563'}`,
                                opacity: isCombat ? 0.3 : 1,
                                boxShadow: isSelected ? '0 0 8px rgba(248,113,113,0.6)' : 'none',
                                transition: 'border-color 0.15s, box-shadow 0.15s',
                                background: 'transparent',
                              }}
                            >
                              <img
                                src={`/Combat_${card.force}${card.blood}${card.shields}.png`}
                                alt={`F${card.force}`}
                                draggable={false}
                                style={{ width: '100%', height: 'auto', display: 'block' }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={handleReady}
                      disabled={!selectedCombat || !selectedDiscard}
                      className={`px-6 py-3 rounded-lg font-semibold ${
                        selectedCombat && selectedDiscard
                          ? "bg-green-600 hover:bg-green-500"
                          : "bg-gray-700 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      Confirmer
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* PHASE : ID */}
        {phase === "id_phase" && (
          <div className="flex flex-col gap-4">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-sm">
                Combat : <span className="text-white font-bold">{getPlayerName(combat?.attacker)}</span>
                {" "}vs <span className="text-white font-bold">{getPlayerName(combat?.defender)}</span>
              </p>
              <p className="text-yellow-400 text-sm mt-1">
                Tour de : <span className="font-bold">{getPlayerName(combat?.currentTurn)}</span>
              </p>
            </div>

            <div className="flex gap-4">
              {[combat?.attacker, combat?.defender].map(pid => {
                const idCards = combat?.choices?.[pid]?.idCards || [];
                return (
                  <div key={pid} className="flex-1 bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-2">{getPlayerName(pid)}</p>
                    {idCards.length === 0
                      ? <p className="text-xs text-gray-600">Aucune carte jouee</p>
                      : idCards.map((card, i) => (
                        <div key={i} className="bg-gray-700 rounded px-2 py-1 text-xs mb-1">
                          {pid === playerId || hasPrescienceId
                            ? <span className="text-white">{card.name}</span>
                            : <span className="text-gray-500">Carte cachee</span>
                          }
                        </div>
                      ))
                    }
                  </div>
                );
              })}
            </div>

            {!isParticipant && (
              <div className="text-center py-4">
                <p className="text-gray-400">Vous observez</p>
              </div>
            )}

            {isParticipant && isMyTurn && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-green-400 font-bold">C'est votre tour</p>
                {myIdCombatCards.length > 0 ? (
                  <>
                    <p className="text-sm text-gray-400">Selectionne tes cartes ID a jouer :</p>
                    <div className="flex gap-2 flex-wrap">
                      {myIdCombatCards.map(card => {
                        const isSelected = selectedIdCards.find(c => c.instanceId === card.instanceId);
                        return (
                          <button
                            key={card.instanceId}
                            onClick={() => toggleIdCard(card)}
                            className={`rounded-lg p-2 text-xs w-32 text-center border transition-all
                              ${isSelected
                                ? "border-purple-400 bg-purple-900"
                                : "border-gray-600 bg-gray-800 hover:border-gray-400"}`}
                          >
                            <p className="text-white font-semibold">{card.name}</p>
                            {card.cost > 0 && <p className="text-yellow-400">{card.cost} Ank</p>}
                            <p className="text-gray-400 text-xs mt-1">Combat</p>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handlePlayIdCards}
                        disabled={selectedIdCards.length === 0}
                        className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm ${
                          selectedIdCards.length > 0
                            ? "bg-purple-700 hover:bg-purple-600"
                            : "bg-gray-700 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        Jouer ({selectedIdCards.length})
                      </button>
                      <button
                        onClick={() => handlePass(true)}
                        className="flex-1 px-4 py-2 rounded-lg font-semibold text-sm bg-gray-700 hover:bg-gray-600"
                      >
                        Passer
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-gray-500 text-sm">Aucune carte ID combat disponible</p>
                    <button
                      onClick={() => handlePass(true)}
                      className="px-4 py-2 rounded-lg font-semibold text-sm bg-gray-700 hover:bg-gray-600"
                    >
                      Passer
                    </button>
                  </div>
                )}
              </div>
            )}

            {isParticipant && !isMyTurn && (
              <div className="text-center py-4">
                <p className="text-yellow-400">En attente de {getPlayerName(combat?.currentTurn)}...</p>
              </div>
            )}
          </div>
        )}

        {/* PHASE : ÉCHANGE (Changement de Stratégie) */}
        {phase === "swap_phase" && (() => {
          const swapPending = combat?.swapPending || {};
          const myStatus = swapPending[playerId];
          const myChoice = combat?.choices?.[playerId];

          async function handleSwapDecision(doSwap) {
            const updates = { [`swapPending/${playerId}`]: "done" };
            if (doSwap && myChoice) {
              updates[`choices/${playerId}/combatCard`]  = myChoice.discardCard;
              updates[`choices/${playerId}/discardCard`] = myChoice.combatCard;
            }
            await update(ref(db, `rooms/${roomCode}/combat`), updates);
          }

          const myCombatCard  = getCard(myChoice?.combatCard);
          const myDiscardCard = getCard(myChoice?.discardCard);

          return (
            <div className="flex flex-col gap-4">
              <p className="text-center text-purple-400 font-bold text-lg">Changement de Stratégie</p>
              {myStatus === "pending" ? (
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-white font-semibold mb-3">Échanger votre carte combat avec votre défausse ?</p>
                  <div className="flex gap-4 justify-center items-center mb-4">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">Combat</p>
                      {myCombatCard && (
                        <img
                          src={`/Combat_${myCombatCard.force}${myCombatCard.blood}${myCombatCard.shields}.png`}
                          alt="" draggable={false}
                          style={{ width: 112, height: 'auto', borderRadius: 8, border: '2px solid #b45309', display: 'block' }}
                        />
                      )}
                    </div>
                    <div className="text-gray-400 text-xl">⇄</div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">Défausse</p>
                      {myDiscardCard && (
                        <img
                          src={`/Combat_${myDiscardCard.force}${myDiscardCard.blood}${myDiscardCard.shields}.png`}
                          alt="" draggable={false}
                          style={{ width: 112, height: 'auto', borderRadius: 8, border: '2px solid #b91c1c', display: 'block' }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSwapDecision(true)}
                      className="flex-1 bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-lg text-sm font-semibold">
                      Échanger
                    </button>
                    <button onClick={() => handleSwapDecision(false)}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm">
                      Conserver
                    </button>
                  </div>
                </div>
              ) : myStatus === "done" ? (
                <p className="text-center text-green-400 py-4">Décision confirmée. En attente de l'adversaire...</p>
              ) : (
                <p className="text-center text-gray-400 py-4">En attente du joueur qui a joué Changement de Stratégie...</p>
              )}
            </div>
          );
        })()}

        {/* PHASE : RÉVÉLATION */}
        {phase === "revealed" && (() => {
          const attacker = combat?.attacker;
          const defender = combat?.defender;
          const zoneId   = combat?.zoneId;
          const players  = gameStateForCombat?.players || {};
          const creatureAssignments  = gameStateForCombat?.creatureAssignments  || {};
          const creatureAssignments2 = gameStateForCombat?.creatureAssignments2 || {};

          const bonusA = getCombatCreatureBonus(attacker, defender, zoneId, creatureAssignments, players, POWER_TILES, creatureAssignments2);
          const bonusD = getCombatCreatureBonus(defender, attacker, zoneId, creatureAssignments, players, POWER_TILES, creatureAssignments2);
          const bonusMap = { [attacker]: bonusA, [defender]: bonusD };

          const result = getCombatResult(combat, gameStateForCombat, POWER_TILES, COMBAT_CARDS);
          const { winnerId, forceA, forceD, unitsA, unitsD, attackerUnitsAfter, defenderUnitsAfter, attackerDamage, defenderDamage } = result || {};

          const forceMap    = { [attacker]: forceA,    [defender]: forceD    };
          const unitsMap    = { [attacker]: unitsA,    [defender]: unitsD    };
          const damageMap   = { [attacker]: attackerDamage, [defender]: defenderDamage };
          const survivorMap = { [attacker]: attackerUnitsAfter, [defender]: defenderUnitsAfter };

          let devoreusVPBonus = false;
          if (result && !result.winnerNullified && result.winnerCreatureName) {
            const power = CREATURE_POWERS[result.winnerCreatureName];
            if (power?.onWinBloodBonus) {
              const wCard = COMBAT_CARDS.find(c => c.id === result.winnerCardId);
              devoreusVPBonus = wCard && wCard.blood >= power.onWinBloodBonus.minBlood;
            }
          }

          const attackerWins = winnerId === attacker;
          const attackerHasSurvivors = (attackerUnitsAfter ?? 0) > 0;
          const combatVPAwarded = attackerWins && attackerHasSurvivors;

          return (
            <div className="flex flex-col gap-4">
              <p className="text-center text-yellow-400 font-bold text-lg">Revelation !</p>
              {winnerId && (
                <div className="text-center flex flex-col items-center gap-1">
                  <span className="bg-green-800 border border-green-500 text-green-200 font-bold px-4 py-1 rounded-full text-sm">
                    Victoire : {getPlayerName(winnerId)}
                  </span>
                  {combatVPAwarded && (
                    <p className="text-amber-300 text-xs">+1 PV combat (attaquant victorieux)</p>
                  )}
                  {attackerWins && !attackerHasSurvivors && (
                    <p className="text-red-400 text-xs">Pas de PV : aucun survivant pour l'attaquant</p>
                  )}
                  {devoreusVPBonus && (
                    <p className="text-amber-300 text-xs">+1 PV (Devoreuse — saignement &ge; 2)</p>
                  )}
                </div>
              )}

              <div className="flex gap-4 justify-center flex-wrap">
                {[attacker, defender].map(pid => {
                  const choice     = combat?.choices?.[pid];
                  const card       = getCard(choice?.combatCard);
                  const idCards    = choice?.idCards || [];
                  const bonus      = bonusMap[pid];
                  const units      = unitsMap[pid] ?? 0;
                  const force      = forceMap[pid] ?? 0;
                  const damage     = damageMap[pid] ?? 0;
                  const survivors  = survivorMap[pid] ?? 0;

                  const tasetiBloodPid = gameState?.players?.[pid]?.tasetiBlood ?? 0;
                  const totalShields = bonus?.shieldsNullifiedByEnemy ? 0 : (card?.shields ?? 0) + (bonus?.shields ?? 0);
                  const totalBlood   = (card?.blood ?? 0) + (bonus?.blood ?? 0) + tasetiBloodPid;

                  return (
                    <div key={pid} className={`bg-gray-800 border rounded-xl p-4 text-center w-48 ${pid === winnerId ? "border-green-500" : "border-gray-600"}`}>
                      <p className="font-bold text-white mb-1">{getPlayerName(pid)}</p>
                      <p className="text-gray-400 text-xs mb-3">{pid === attacker ? "Attaquant" : "Defenseur"}</p>

                      {/* Créatures */}
                      {[bonus?.myCreatureName, bonus?.myCreatureName2].filter(Boolean).map(name => (
                        <div key={name} className={`flex items-center gap-2 justify-center mb-1 px-2 py-1 rounded ${bonus?.nullified ? "opacity-40" : ""}`}>
                          <div style={getCreatureSpriteStyle(name, 28) || {}} />
                          <span className="text-xs text-amber-300">{name}</span>
                          {bonus?.nullified && <span className="text-red-400 text-xs">(annule)</span>}
                        </div>
                      ))}
                      {(bonus?.krakenBonus ?? 0) > 0 && (
                        <div className="flex items-center gap-2 justify-center mb-1">
                          <div style={getCreatureSpriteStyle("Kraken", 28) || {}} />
                          <span className="text-xs text-cyan-300">Kraken</span>
                        </div>
                      )}
                      {card && (
                        <div className="bg-gray-700 rounded-lg p-3 mb-2">
                          <img
                            src={`/Combat_${card.force}${card.blood}${card.shields}.png`}
                            alt="" draggable={false}
                            style={{ width: '100%', borderRadius: 6, marginBottom: 8, display: 'block' }}
                          />
                          {/* Force = unités + carte + créature */}
                          <p className="text-yellow-400 font-bold text-3xl">{force}</p>
                          <p className="text-gray-400 text-xs">
                            {units} unites + {card.force} carte
                            {(bonus?.force ?? 0) > 0 && !bonus?.nullified && ` + ${bonus.force} crea`}
                          </p>
                          <div className="mt-2 text-sm">
                            <p className="text-red-400">sang {totalBlood}{tasetiBloodPid > 0 && <span className="text-xs text-amber-300 ml-1">(+{tasetiBloodPid} Ta-Seti)</span>}</p>
                            <p className={bonus?.shieldsNullifiedByEnemy ? "text-red-400 line-through" : "text-blue-400"}>
                              boucliers {totalShields}
                              {bonus?.shieldsNullifiedByEnemy && <span className="text-xs ml-1">(Meduse)</span>}
                            </p>
                          </div>
                          {card.effect && <p className="text-orange-400 text-xs mt-1">Effet special</p>}
                        </div>
                      )}

                      {/* Dégâts et survivants */}
                      <div className="bg-gray-700 rounded p-2 text-xs">
                        <p className="text-red-400">Degats recus : {damage ?? 0}</p>
                        <p className={survivors > 0 ? "text-green-400" : "text-gray-500"}>
                          Survivants : {survivors ?? 0}
                        </p>
                      </div>

                      {pid === playerId && (
                        <p className="text-xs text-gray-500 mt-2">Defaussee : carte {choice?.discardCard}</p>
                      )}
                      {idCards.length > 0 && (
                        <div className="mt-2 text-left">
                          <p className="text-xs text-gray-400 mb-1">Cartes ID :</p>
                          {idCards.map((c, i) => (
                            <div key={i} className="bg-gray-700 rounded px-2 py-1 text-xs mb-1">
                              <p className="text-white">{c.name}</p>
                              {c.cost > 0 && <p className="text-yellow-400">{c.cost} Ank</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Blessure Divine : sélection des cartes à défausser pour +1 force */}
              {isParticipant && hasBlessureDivine(playerId) && !combat?.choices?.[playerId]?.blessureReady && (
                <div className="bg-orange-950 border border-orange-700 rounded-xl p-4">
                  <p className="text-orange-300 font-bold text-sm mb-2">Blessure Divine — défaussez des cartes pour +1 force/carte</p>
                  {(myState.idCards || []).length === 0 ? (
                    <p className="text-gray-500 text-xs">Aucune carte en main</p>
                  ) : (
                    <div className="flex gap-2 flex-wrap mb-3">
                      {(myState.idCards || []).map(card => {
                        const sel = blessureCards.find(c => c.instanceId === card.instanceId);
                        return (
                          <button
                            key={card.instanceId}
                            onClick={() => setBlessureCards(prev =>
                              sel ? prev.filter(c => c.instanceId !== card.instanceId) : [...prev, card]
                            )}
                            className={`rounded-lg p-2 text-xs w-32 text-center border transition-all
                              ${sel ? "border-orange-400 bg-orange-900" : "border-gray-600 bg-gray-800 hover:border-gray-400"}`}
                          >
                            <p className="text-white font-semibold">{card.name}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button
                    onClick={handleConfirmBlessure}
                    className="bg-orange-700 hover:bg-orange-600 px-4 py-2 rounded-lg text-sm font-semibold"
                  >
                    Confirmer ({blessureCards.length} carte{blessureCards.length !== 1 ? "s" : ""} → +{blessureCards.length} force)
                  </button>
                </div>
              )}
              {isParticipant && hasBlessureDivine(playerId) && combat?.choices?.[playerId]?.blessureReady && (
                <p className="text-orange-400 text-sm text-center">
                  Blessure Divine : +{combat.choices[playerId].blessureCards} force confirmé
                </p>
              )}

              {(() => {
                const blessuреOk = [combat?.attacker, combat?.defender].every(pid =>
                  !hasBlessureDivine(pid) || combat?.choices?.[pid]?.blessureReady === true
                );
                return isParticipant ? (
                  <button
                    onClick={handleApplyResults}
                    disabled={!blessuреOk}
                    className={`px-6 py-3 rounded-lg font-semibold mt-2 ${blessuреOk ? "bg-red-700 hover:bg-red-600" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
                  >
                    Appliquer les dégâts
                  </button>
                ) : null;
              })()}
            </div>
          );
        })()}

        {/* PHASE : POST-COMBAT */}
        {phase === "post_combat" && (() => {
          const pc = combat?.postCombat;
          if (!pc) return null;
          const { winnerId, loserId, winnerColor, loserColor, winnerUnitsAfter, loserUnitsAfter,
                  loserChoice, retreatZoneId, winnerRecall } = pc;
          const zoneId = combat.zoneId;
          const isWinner = playerId === winnerId;
          const isLoser  = playerId === loserId;
          // En mode test, tout participant peut agir pour n'importe quel rôle
          const canActAsWinner = isWinner || isTestMode;
          const canActAsLoser  = isLoser  || isTestMode;
          // Calculé en direct depuis gameState (évite le bug Firebase array et les valeurs périmées)
          const freeZones = (ZONE_ADJACENCY[zoneId] || []).filter(z =>
            (gameState?.boardUnits?.[z]?.[winnerColor] ?? 0) === 0
          );

          async function setRetreatZone(zId) {
            await update(ref(db, `rooms/${roomCode}/combat/postCombat`), { retreatZoneId: zId });
          }
          async function setLoserChoice(choice) {
            await update(ref(db, `rooms/${roomCode}/combat/postCombat`), { loserChoice: choice });
          }
          async function setWinnerRecall(val) {
            await update(ref(db, `rooms/${roomCode}/combat/postCombat`), { winnerRecall: val });
          }

          // Firebase supprime les null → ils reviennent undefined. != null attrape les deux.
          const retreatPickDone = freeZones.length === 0 || retreatZoneId != null;
          const loserDone  = loserChoice != null;
          const winnerDone = winnerRecall != null;

          return (
            <div className="flex flex-col gap-4">
              <p className="text-center text-green-400 font-bold text-lg">Après le combat</p>
              <div className="text-center">
                <span className="bg-green-800 border border-green-500 text-green-200 font-bold px-4 py-1 rounded-full text-sm">
                  Vainqueur : {getPlayerName(winnerId)}
                </span>
              </div>


              {/* ÉTAPE 1 : vainqueur place le perdant */}
              {!retreatPickDone && loserUnitsAfter > 0 && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-amber-300 text-xs font-bold uppercase mb-2">Action du vainqueur — {getPlayerName(winnerId)}</p>
                  <p className="text-white font-semibold mb-2">
                    Placer {getPlayerName(loserId)} ({loserUnitsAfter} unités) sur une zone adjacente libre :
                  </p>
                  {canActAsWinner ? (
                    <p className="text-orange-300 text-sm italic">→ Cliquez sur une zone orange sur le plateau.</p>
                  ) : (
                    <p className="text-yellow-400 text-sm">En attente du vainqueur...</p>
                  )}
                </div>
              )}

              {/* ÉTAPE 2 : perdant choisit rappel ou rester */}
              {retreatPickDone && !loserDone && loserUnitsAfter > 0 && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-blue-300 text-xs font-bold uppercase mb-2">Action du perdant — {getPlayerName(loserId)}</p>
                  {retreatZoneId
                    ? <p className="text-gray-300 text-sm mb-3">Le vainqueur vous propose la zone <span className="font-bold text-amber-300">{retreatZoneId}</span>.</p>
                    : <p className="text-gray-400 text-sm mb-3">Aucune zone libre — rappel obligatoire.</p>
                  }
                  {canActAsLoser ? (
                    <div className="flex flex-col gap-2">
                      <button onClick={() => setLoserChoice("recall")}
                        className="bg-blue-800 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm">
                        Rappel — {loserUnitsAfter} unité{loserUnitsAfter !== 1 ? "s" : ""} en réserve (+{loserUnitsAfter} Ank)
                      </button>
                      {retreatZoneId && (
                        <button onClick={() => setLoserChoice("stay")}
                          className="bg-orange-800 hover:bg-orange-700 px-4 py-2 rounded-lg text-sm">
                          Laisser les troupes en {retreatZoneId}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-yellow-400 text-sm">En attente du perdant...</p>
                  )}
                </div>
              )}

              {/* Résumé perdant */}
              {loserDone && loserUnitsAfter > 0 && (
                <div className="bg-gray-800 rounded-lg p-3 text-sm">
                  <span className="text-gray-400">{getPlayerName(loserId)} : </span>
                  {loserChoice === "stay"
                    ? <span className="text-orange-300">Troupes laissées en {retreatZoneId}</span>
                    : <span className="text-blue-300">Rappel (+{loserUnitsAfter} Ank)</span>
                  }
                </div>
              )}

              {/* ÉTAPE 3 : vainqueur choisit rappel ou rester */}
              {loserDone && winnerUnitsAfter > 0 && winnerRecall == null && (
                <div className="bg-gray-800 rounded-xl p-4">
                  <p className="text-amber-300 text-xs font-bold uppercase mb-2">Action du vainqueur — {getPlayerName(winnerId)}</p>
                  <p className="text-white font-semibold mb-1">
                    {winnerUnitsAfter} unité{winnerUnitsAfter !== 1 ? "s" : ""} en zone {zoneId}
                  </p>
                  {canActAsWinner ? (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setWinnerRecall(false)}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm">
                        Laisser en {zoneId}
                      </button>
                      <button onClick={() => setWinnerRecall(true)}
                        className="flex-1 bg-blue-800 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm">
                        Rappel (+{winnerUnitsAfter} Ank)
                      </button>
                    </div>
                  ) : (
                    <p className="text-yellow-400 text-sm">En attente du vainqueur...</p>
                  )}
                </div>
              )}

              {/* Finalisation automatique quand tout est décidé */}
              {loserDone && winnerDone && (isParticipant || isTestMode) && (
                <button onClick={handleFinalizePostCombat}
                  className="px-6 py-3 rounded-lg font-semibold bg-green-700 hover:bg-green-600">
                  Finaliser le combat
                </button>
              )}
            </div>
          );
        })()}

    </div>
  );
}

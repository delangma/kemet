import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { ref, onValue, update, get, remove } from "firebase/database";
import { dealCards, buildPuDeck, buildJiDeck, buildJpDeck } from "../../utils/deck";
import { getJuPositionsForLayout, getJiPositionsForLayout, getJpPositionsForLayout } from "../../constants/taSetiPositions";
import { POWER_TILES } from "../../constants/powerTiles";
import { CREATURE_POWERS, getMaxTotalUnits, getTotalTroopCount } from "../../constants/creaturePowers";
import { computeTempVP } from "../../utils/vp";
import { getZoneController } from "../../utils/night";

const PLAYER_COLOR_TEXT = {
  Rouge: "text-red-400", Bleu: "text-blue-400",
  Vert: "text-emerald-400", Blanc: "text-gray-200", Noir: "text-gray-400",
};

const TEST_BADGES = {
  Rouge: { on: "bg-red-600 text-white border-yellow-400", off: "bg-red-900/50 text-red-300 border-transparent hover:bg-red-800/60" },
  Bleu:  { on: "bg-blue-600 text-white border-yellow-400", off: "bg-blue-900/50 text-blue-300 border-transparent hover:bg-blue-800/60" },
  Vert:  { on: "bg-emerald-600 text-white border-yellow-400", off: "bg-emerald-900/50 text-emerald-300 border-transparent hover:bg-emerald-800/60" },
  Blanc: { on: "bg-gray-300 text-gray-900 border-yellow-400", off: "bg-gray-700/50 text-gray-300 border-transparent hover:bg-gray-600/60" },
  Noir:  { on: "bg-gray-600 text-white border-yellow-400", off: "bg-gray-900/50 text-gray-400 border-transparent hover:bg-gray-800/60" },
};

function PlayerName({ player }) {
  return <span className={`font-bold ${PLAYER_COLOR_TEXT[player?.color] || "text-white"}`}>{player?.name ?? "?"}</span>;
}

function TempleRow({ icon, label, controller, bonus }) {
  return (
    <div className={`flex items-center justify-between text-sm ${controller ? "text-gray-200" : "text-gray-600"}`}>
      <span>{icon} {label}</span>
      {controller
        ? <span><PlayerName player={controller} /> <span className="text-amber-400 font-semibold">{bonus}</span></span>
        : <span className="text-xs italic">Non contrôlé</span>
      }
    </div>
  );
}

export default function NightModal({ onClose, session, gameState, isTestMode, testPlayers, onSwitchTestPlayer, logAction }) {
  const { roomCode, playerId, allPlayers } = session;
  const [night, setNight] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [t3Checked, setT3Checked] = useState(false);
  const [tbChecked, setTbChecked] = useState(false);

  // La phase de nuit est pilotée par le noeud partagé rooms/{roomCode}/night —
  // exactement comme /dawn et /combat — pour que tous les clients voient les
  // mêmes choix (contrôleurs T3/TB) et la même résolution en même temps.
  useEffect(() => {
    const unsubscribe = onValue(ref(db, `rooms/${roomCode}/night`), snapshot => {
      setNight(snapshot.exists() ? snapshot.val() : null);
    });
    return () => unsubscribe();
  }, [roomCode]);

  const boardUnits = gameState?.boardUnits || {};

  const t1Controller = getZoneController(boardUnits, "T1", allPlayers);
  const t2Controller = getZoneController(boardUnits, "T2", allPlayers);
  const t3Controller = getZoneController(boardUnits, "T3", allPlayers);
  const tbController = getZoneController(boardUnits, "TB", allPlayers);

  const t3Units = t3Controller ? (boardUnits["T3"]?.[t3Controller.color] || 0) : 0;
  const tbUnits = tbController ? (boardUnits["TB"]?.[tbController.color] || 0) : 0;
  const canT3Sacrifice = t3Units >= 1;
  const canTbSacrifice = tbUnits >= 2;

  const t3Choice = night?.t3 || null;
  const tbChoice = night?.tb || null;
  const isT3Controller = !!t3Choice && playerId === t3Choice.controllerId;
  const isTbController = !!tbChoice && playerId === tbChoice.controllerId;

  // IA : sacrifie systématiquement (le gain en Ank/PV vaut toujours plus qu'une
  // unité) — le choix par case à cocher ne s'applique qu'aux joueurs humains.
  useEffect(() => {
    if (!t3Choice || t3Choice.ready || !t3Controller?.isAI) return;
    update(ref(db, `rooms/${roomCode}/night/t3`), { sacrifice: true, ready: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, t3Choice?.ready, t3Controller?.id, t3Controller?.isAI]);

  useEffect(() => {
    if (!tbChoice || tbChoice.ready || !tbController?.isAI) return;
    update(ref(db, `rooms/${roomCode}/night/tb`), { sacrifice: true, ready: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, tbChoice?.ready, tbController?.id, tbController?.isAI]);

  function get2TempleWinners(t3Sacrificed) {
    const t3After = (t3Sacrificed && t3Units <= 1) ? null : t3Controller;
    const ctrls = [t1Controller, t2Controller, t3After].filter(Boolean);
    const count = {};
    ctrls.forEach(p => { count[p.id] = (count[p.id] || 0) + 1; });
    return Object.entries(count)
      .filter(([, c]) => c >= 2)
      .map(([id]) => allPlayers.find(p => p.id === id))
      .filter(Boolean);
  }

  // Aperçu affiché avant résolution : la valeur en cours de saisie pour le
  // contrôleur qui décide, sinon le choix déjà confirmé.
  const t3PreviewSacrifice = !t3Choice ? false : (isT3Controller && !t3Choice.ready ? t3Checked : !!t3Choice.sacrifice);
  const twoTempleWinners = get2TempleWinners(t3PreviewSacrifice);

  async function handleValidateT3() {
    if (!isT3Controller || t3Choice.ready) return;
    await update(ref(db, `rooms/${roomCode}/night/t3`), { sacrifice: t3Checked, ready: true });
  }

  async function handleValidateTb() {
    if (!isTbController || tbChoice.ready) return;
    await update(ref(db, `rooms/${roomCode}/night/tb`), { sacrifice: tbChecked, ready: true });
  }

  async function handleNightPhase() {
    setLoading(true);

    // Verrou : seul le premier client à passer "open" → "resolving" effectue
    // le calcul (additif, doit s'exécuter une seule fois).
    const lockSnap = await get(ref(db, `rooms/${roomCode}/night/status`));
    if (!lockSnap.exists() || lockSnap.val() !== "open") { setLoading(false); return; }
    await update(ref(db, `rooms/${roomCode}/night`), { status: "resolving" });

    const snapshot = await get(ref(db, `rooms/${roomCode}/gameState`));
    if (!snapshot.exists()) { setLoading(false); return; }
    const state = snapshot.val();

    // Garde-fou supplémentaire : si un joueur a déjà des tokens > 0, la nuit a déjà été résolue
    const alreadyResolved = Object.values(state.players || {}).some(ps => (ps.tokens ?? 0) > 0);
    if (alreadyResolved) {
      await remove(ref(db, `rooms/${roomCode}/night`));
      setDone(true);
      setLoading(false);
      return;
    }

    const t3Effective = !!night?.t3 && !!night.t3.sacrifice;
    const tbEffective = !!night?.tb && !!night.tb.sacrifice;

    const updates = {};
    const deck = [...(state.idDeck || [])];
    const ankBonus = {};
    const vpBonus = {};
    allPlayers.forEach(p => { ankBonus[p.id] = 0; vpBonus[p.id] = 0; });

    allPlayers.forEach(p => {
      ankBonus[p.id] += 2;
      const ps = state.players?.[p.id] || {};

      // Nombre de cartes ID à piocher cette nuit (1 de base + bonus créatures + tuiles permanentes)
      const ownedTileIds = ps.ownedTileIds || [];
      const nightIdBonus = ownedTileIds.reduce((sum, id) => {
        const tile = POWER_TILES.find(t => t.id === id);
        if (!tile) return sum;
        if (tile.type === "creature") {
          const power = CREATURE_POWERS[tile.name];
          return sum + (power?.idCardsPerNight ?? 0);
        }
        return sum + (tile.idCardsPerNight ?? 0);
      }, 0);

      const hasChoixSuppl = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Choix supplémentaire ID");
      if (hasChoixSuppl) {
        if (deck.length > 0) {
          const draftCount = Math.min(5, deck.length);
          const { hand: draftCards, remaining } = dealCards(deck, draftCount);
          deck.splice(0, deck.length, ...remaining);
          updates[`rooms/${roomCode}/gameState/players/${p.id}/idDraftPending`] = draftCards;
        }
      } else if (deck.length > 0) {
        const cardsToDraw = 1 + nightIdBonus;
        const toDraw = Math.min(cardsToDraw, deck.length);
        const { hand, remaining } = dealCards(deck, toDraw);
        deck.splice(0, deck.length, ...remaining);
        updates[`rooms/${roomCode}/gameState/players/${p.id}/idCards`] = [...(ps.idCards || []), ...hand];
      }
      const ankTileBonus = ownedTileIds.filter(
        id => POWER_TILES.find(t => t.id === id)?.name === "2 Ank"
      ).length * 2;
      const ank5TileBonus = ownedTileIds.filter(
        id => POWER_TILES.find(t => t.id === id)?.name === "5 ank"
      ).length * 5;
      ankBonus[p.id] += ankTileBonus + ank5TileBonus;

      const hasGrayToken = ownedTileIds.some(id => {
        const n = POWER_TILES.find(t => t.id === id)?.name ?? "";
        return n.toLowerCase().startsWith("jeton gris");
      });
      updates[`rooms/${roomCode}/gameState/players/${p.id}/tokens`] = hasGrayToken ? 6 : 5;
      updates[`rooms/${roomCode}/gameState/players/${p.id}/usedActions`] = [];
      updates[`rooms/${roomCode}/gameState/players/${p.id}/actionsThisTurn`] = 0;
      updates[`rooms/${roomCode}/gameState/players/${p.id}/goldenTokenUsed`] = false;
      updates[`rooms/${roomCode}/gameState/players/${p.id}/goldenBuyBlockedThisTurn`] = false;
      // Jeton gris : la 2e action bonus (jouée dans le même tour qu'une action
      // classique) redevient disponible une fois par jour.
      updates[`rooms/${roomCode}/gameState/players/${p.id}/grayBonusUsed`] = false;
    });

    if (t1Controller) ankBonus[t1Controller.id] += 2;
    if (t2Controller) ankBonus[t2Controller.id] += 3;

    let t3CtrlAfter = t3Controller;
    if (t3Controller && t3Effective) {
      ankBonus[t3Controller.id] += 5;
      const newT3 = t3Units - 1;
      updates[`rooms/${roomCode}/gameState/boardUnits/T3/${t3Controller.color}`] = newT3;
      if (newT3 === 0) t3CtrlAfter = null;
      const ps = state.players?.[t3Controller.id] || {};
      updates[`rooms/${roomCode}/gameState/players/${t3Controller.id}/unitsReserve`] = (ps.unitsReserve ?? 2) + 1;
    }

    if (tbController && tbEffective) {
      vpBonus[tbController.id] += 1;
      updates[`rooms/${roomCode}/gameState/boardUnits/TB/${tbController.color}`] = tbUnits - 2;
      const ps = state.players?.[tbController.id] || {};
      updates[`rooms/${roomCode}/gameState/players/${tbController.id}/unitsReserve`] = (ps.unitsReserve ?? 2) + 2;
    }

    // Renforcement 4 unités : +4 unités à poser chaque nuit (après T3/TB pour cumuler correctement)
    allPlayers.forEach(p => {
      const ps = state.players?.[p.id] || {};
      const ownedIds = ps.ownedTileIds || [];
      if (ownedIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Renforcement 4 unités")) {
        const base = updates[`rooms/${roomCode}/gameState/players/${p.id}/unitsReserve`] ?? (ps.unitsReserve ?? 0);
        const maxTotal = getMaxTotalUnits(ownedIds, POWER_TILES);
        const onBoard = getTotalTroopCount(state.boardUnits, p.color, 0);
        const granted = Math.max(0, Math.min(4, maxTotal - onBoard - base));
        updates[`rooms/${roomCode}/gameState/players/${p.id}/unitsReserve`] = base + granted;
        updates[`rooms/${roomCode}/gameState/players/${p.id}/reinforcementPending`] = granted;
      }
    });

    // Augmentation pyramide : +1 amélioration gratuite chaque nuit
    allPlayers.forEach(p => {
      const ps = state.players?.[p.id] || {};
      const ownedIds = ps.ownedTileIds || [];
      if (ownedIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Augmentation pyramide")) {
        const base = updates[`rooms/${roomCode}/gameState/players/${p.id}/pyramidUpgradePending`] ?? (ps.pyramidUpgradePending ?? 0);
        updates[`rooms/${roomCode}/gameState/players/${p.id}/pyramidUpgradePending`] = base + 1;
      }
      // Draft ID : chaque nuit, peut défausser des cartes et piocher le même nombre +1
      if (ownedIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Draft ID")) {
        updates[`rooms/${roomCode}/gameState/players/${p.id}/idRefreshPending`] = true;
      }
    });

    const nonBlueCtrls = [t1Controller, t2Controller, t3CtrlAfter].filter(Boolean);
    const templeCount = {};
    nonBlueCtrls.forEach(p => { templeCount[p.id] = (templeCount[p.id] || 0) + 1; });
    Object.entries(templeCount).forEach(([id, c]) => {
      if (c >= 2) {
        const ps = state.players?.[id] || {};
        const hasDoubleTemple = (ps.ownedTileIds || []).some(
          i => POWER_TILES.find(t => t.id === i)?.name === "Double point temple"
        );
        vpBonus[id] += hasDoubleTemple ? 2 : 1;
      }
    });

    allPlayers.forEach(p => {
      const ps = state.players?.[p.id] || {};
      updates[`rooms/${roomCode}/gameState/players/${p.id}/ank`] = Math.min(11, (ps.ank ?? 7) + ankBonus[p.id]);
      if (vpBonus[p.id] > 0) {
        updates[`rooms/${roomCode}/gameState/players/${p.id}/vpPermanent`] = (ps.vpPermanent ?? 0) + vpBonus[p.id];
      }
    });

    // Avancée de nuit Ta-Seti
    allPlayers.forEach(p => {
      const ps = state.players?.[p.id] || {};
      const ownedIds = ps.ownedTileIds || [];
      const nightAdvCount = ownedIds.reduce((sum, id) => {
        const tile = POWER_TILES.find(t => t.id === id);
        return sum + (tile?.taSetiAdvancePerNight ?? 0);
      }, 0);
      if (nightAdvCount > 0) {
        const base = updates[`rooms/${roomCode}/gameState/players/${p.id}/taSetiNightAdvancePending`] ?? (ps.taSetiNightAdvancePending ?? 0);
        updates[`rooms/${roomCode}/gameState/players/${p.id}/taSetiNightAdvancePending`] = base + nightAdvCount;
      }
    });

    // Effacer les bonus Ta-Seti combat non utilisés + reset flags quotidiens
    updates[`rooms/${roomCode}/gameState/taSetiE4_2DailyVp`] = null;
    updates[`rooms/${roomCode}/gameState/taSetiDailyBonuses`] = null;
    allPlayers.forEach(p => {
      const ps = state.players?.[p.id] || {};
      if ((ps.tasetiForce   ?? 0) > 0) updates[`rooms/${roomCode}/gameState/players/${p.id}/tasetiForce`]   = null;
      if ((ps.tasetiBlood   ?? 0) > 0) updates[`rooms/${roomCode}/gameState/players/${p.id}/tasetiBlood`]   = null;
      if ((ps.tasetiShields ?? 0) > 0) updates[`rooms/${roomCode}/gameState/players/${p.id}/tasetiShields`] = null;
    });

    // Cerbère : retour au marché à chaque nuit
    const creatureAssignments = state.creatureAssignments || {};
    const availableTileIds = [...(state.availableTileIds || [])];
    const ownedTilesByPlayer = {};

    allPlayers.forEach(p => {
      const ps = state.players?.[p.id] || {};
      Object.entries(creatureAssignments).forEach(([zoneId, colorMap]) => {
        const tileId = colorMap?.[p.color];
        if (!tileId) return;
        const tile = POWER_TILES.find(t => t.id === tileId);
        const power = tile?.type === "creature" ? CREATURE_POWERS[tile.name] : null;
        if (!power?.returnToMarketOnNight) return;
        updates[`rooms/${roomCode}/gameState/creatureAssignments/${zoneId}/${p.color}`] = null;
        if (!ownedTilesByPlayer[p.id]) ownedTilesByPlayer[p.id] = [...(ps.ownedTileIds || [])];
        const idx = ownedTilesByPlayer[p.id].indexOf(tileId);
        if (idx >= 0) ownedTilesByPlayer[p.id].splice(idx, 1);
        if (!availableTileIds.includes(tileId)) availableTileIds.push(tileId);
      });
    });
    Object.entries(ownedTilesByPlayer).forEach(([pid, ids]) => {
      updates[`rooms/${roomCode}/gameState/players/${pid}/ownedTileIds`] = ids;
    });
    if (Object.keys(ownedTilesByPlayer).length > 0) {
      updates[`rooms/${roomCode}/gameState/availableTileIds`] = availableTileIds;
    }

    // Recharge les emplacements JU_ vides sur Ta-Seti
    const puAssignment = { ...(state.puAssignment || {}) };
    const juSlots = getJuPositionsForLayout(state.taSetiLayout || []);
    const emptyJu = juSlots.filter(juid => !puAssignment[juid]);
    if (emptyJu.length > 0) {
      const refill = buildPuDeck();
      emptyJu.forEach((juid, i) => { puAssignment[juid] = refill[i % refill.length]; });
      updates[`rooms/${roomCode}/gameState/puAssignment`] = puAssignment;
    }

    // Recharge les emplacements JI_ vides sur Ta-Seti
    const jiAssignment = { ...(state.jiAssignment || {}) };
    const jiSlots = getJiPositionsForLayout(state.taSetiLayout || []);
    const emptyJi = jiSlots.filter(jiid => !jiAssignment[jiid]);
    if (emptyJi.length > 0) {
      const refill = buildJiDeck();
      emptyJi.forEach((jiid, i) => { jiAssignment[jiid] = refill[i % refill.length]; });
      updates[`rooms/${roomCode}/gameState/jiAssignment`] = jiAssignment;
    }

    // Recharge les emplacements JP_ vides sur Ta-Seti
    const jpAssignment = { ...(state.jpAssignment || {}) };
    const jpSlots = getJpPositionsForLayout(state.taSetiLayout || []);
    const emptyJp = jpSlots.filter(jpid => !jpAssignment[jpid]);
    if (emptyJp.length > 0) {
      const refill = buildJpDeck();
      emptyJp.forEach((jpid, i) => { jpAssignment[jpid] = refill[i % refill.length]; });
      updates[`rooms/${roomCode}/gameState/jpAssignment`] = jpAssignment;
    }

    // currentTurnPlayerId n'est PAS fixé ici : l'Aube va déterminer l'ordre de jeu
    // du nouveau jour, et c'est elle qui doit désigner le premier joueur une fois
    // résolue (sinon un joueur IA se met à jouer son tour immédiatement, en
    // parallèle de l'Aube, avant même qu'elle ait déterminé le bon ordre).
    updates[`rooms/${roomCode}/gameState/currentTurnPlayerId`] = null;
    updates[`rooms/${roomCode}/gameState/idDeck`] = deck;
    updates[`rooms/${roomCode}/gameState/turn`] = (state.turn ?? 0) + 1;

    // Fin de partie différée : si pendingEndAtNight, le joueur avec le plus de PV gagne
    if (state.pendingEndAtNight) {
      const getScore = pid => ({
        total: (state.players?.[pid]?.vpPermanent ?? 0) + (vpBonus[pid] ?? 0) + computeTempVP(pid, state, allPlayers),
        combat: state.players?.[pid]?.vpCombat ?? 0,
      });
      const winner = allPlayers.reduce((best, p) => {
        const bs = getScore(best.id);
        const ps = getScore(p.id);
        if (ps.total !== bs.total) return ps.total > bs.total ? p : best;
        return ps.combat > bs.combat ? p : best;
      }, allPlayers[0]);
      updates[`rooms/${roomCode}/gameState/gameOver`] = { winnerId: winner.id };
      updates[`rooms/${roomCode}/gameState/pendingEndAtNight`] = null;
      await update(ref(db, "/"), updates);
      await remove(ref(db, `rooms/${roomCode}/night`));
      setDone(true);
      setLoading(false);
      return;
    }

    await update(ref(db, "/"), updates);

    // Message de fin de journée — séparateur visible dans les logs.
    // `gameState.turn` compte le nombre de journées déjà écoulées (0 avant la
    // 1ère nuit) : la journée qui se termine porte donc ce numéro une fois
    // incrémenté, et la nouvelle journée qui commence porte le numéro suivant.
    const completedDay = (state.turn ?? 0) + 1;
    const upcomingDay = completedDay + 1;
    await update(ref(db, `rooms/${roomCode}/actionLog`), {
      [Date.now()]: {
        playerName: "Nuit",
        color: null,
        text: `Fin de journée ${completedDay} — la journée ${upcomingDay} commence`,
        time: Date.now(),
        meta: { type: "dayEnd" },
      },
    });

    // Log résumé de nuit par joueur
    if (logAction) {
      for (const p of allPlayers) {
        const ps = state.players?.[p.id] || {};
        const parts = [];
        const ankGain = ankBonus[p.id] ?? 0;
        if (ankGain > 0) parts.push(`+${ankGain} Ank`);
        const vpGain = vpBonus[p.id] ?? 0;
        if (vpGain > 0) parts.push(`+${vpGain} PV`);
        const newCards = (updates[`rooms/${roomCode}/gameState/players/${p.id}/idCards`] ?? []).length - (ps.idCards ?? []).length;
        if (newCards > 0) parts.push(`+${newCards} carte${newCards > 1 ? "s" : ""} ID`);
        const ankAfter = updates[`rooms/${roomCode}/gameState/players/${p.id}/ank`] ?? (ps.ank ?? 0);
        const vpAfter = (ps.vpPermanent ?? 0) + vpGain;
        if (parts.length > 0) {
          await logAction(p.id, `NUIT — ${parts.join(", ")} [ank:${ankAfter} pv:${vpAfter}]`);
        }
      }
    }

    // Lance l'Aube automatiquement pour tous les clients via Firebase
    const dawnChoices = {};
    allPlayers.forEach(p => {
      dawnChoices[p.id] = { combatCard: null, discardCard: null, dawnTokens: 0, ready: false, tokensConfirmed: false };
    });
    await update(ref(db, "/"), {
      [`rooms/${roomCode}/dawn`]: { status: "selecting", currentTurn: null, choices: dawnChoices },
    });

    // Ferme la modale de nuit pour tous les clients — l'Aube prend le relais.
    await remove(ref(db, `rooms/${roomCode}/night`));

    setDone(true);
    setLoading(false);
  }

  // Résolution automatique dès que tous les choix requis (T3/TB) sont validés
  // — mirroir des useEffect "allReady" de DawnModal. Le verrou status "open" →
  // "resolving" (dans handleNightPhase) évite que plusieurs clients, dont cet
  // effet tourne simultanément, ne résolvent la nuit deux fois.
  useEffect(() => {
    if (!night || night.status !== "open" || done || loading) return;
    const t3Ready = !night.t3 || night.t3.ready;
    const tbReady = !night.tb || night.tb.ready;
    if (!t3Ready || !tbReady) return;
    const t = setTimeout(() => handleNightPhase(), 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [night?.status, night?.t3?.ready, night?.tb?.ready, done, loading]);

  if (!night || done) return null;

  return (
    <div className="kmt-overlay">
      <div className="kmt-panel w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800">
          <h2 className="kmt-title text-xl">🌙 Phase de Nuit</h2>
          <button onClick={onClose} className="kmt-close">✕</button>
        </div>

        {isTestMode && testPlayers && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-yellow-950/80 border-b border-yellow-700/40">
            <span className="text-yellow-400 text-xs font-bold shrink-0">Vue :</span>
            {testPlayers.map(p => {
              const b = TEST_BADGES[p.color] || TEST_BADGES.Noir;
              const isSelected = p.id === playerId;
              return (
                <button key={p.id} onClick={() => onSwitchTestPlayer(p.id)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all ${isSelected ? b.on : b.off}`}>
                  {p.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="px-6 py-5 space-y-4">
          {/* Effets automatiques */}
          <div className="kmt-section p-4 space-y-2">
            <p className="kmt-label mb-3">Effets automatiques</p>
            <p className="text-sm text-gray-300">🪙 +2 Or pour chaque joueur</p>
            <p className="text-sm text-gray-300">🃏 +1 carte ID pour chaque joueur</p>
            <p className="text-sm text-gray-300">🎯 Réinitialisation des jetons</p>
            {t1Controller && <TempleRow icon="🏛️" label="Temple 1 →" controller={t1Controller} bonus="+2 Ank" />}
            {t2Controller && <TempleRow icon="🏛️" label="Temple 2 →" controller={t2Controller} bonus="+3 Ank" />}
          </div>

          {/* T3 sacrifice */}
          <div className={`kmt-section p-4 ${!t3Controller ? "opacity-50" : ""}`}>
            <p className="kmt-label mb-3">Temple 3 — Sacrifice optionnel</p>
            {t3Controller ? (
              <>
                <p className="text-sm text-gray-300 mb-3">
                  <PlayerName player={t3Controller} /> contrôle T3 ({t3Units} unité{t3Units > 1 ? "s" : ""})
                </p>
                {!canT3Sacrifice ? (
                  <p className="text-red-400 text-xs">Il faut au moins 1 unité sur T3</p>
                ) : t3Choice?.ready ? (
                  <p className="text-sm text-amber-300">
                    {t3Choice.sacrifice ? "✅ Sacrifice → +5 Ank" : "❌ Pas de sacrifice"}
                  </p>
                ) : isT3Controller ? (
                  <>
                    <label className={`flex items-center gap-3 select-none ${t3Controller.isAI ? "cursor-default" : "cursor-pointer"}`}>
                      <input
                        type="checkbox" checked={t3Checked}
                        onChange={e => !t3Controller.isAI && setT3Checked(e.target.checked)}
                        disabled={t3Controller.isAI}
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                      <span className="text-sm text-amber-300">
                        Sacrifier 1 unité → <strong>+5 Ank</strong>
                        {t3Units === 1 && t3Checked && <span className="text-red-400 text-xs ml-2">(perd le contrôle)</span>}
                      </span>
                    </label>
                    <button
                      onClick={handleValidateT3}
                      className="mt-3 w-full py-2 rounded-lg font-semibold text-sm kmt-btn-gold"
                    >
                      ✅ Valider mon choix
                    </button>
                  </>
                ) : (
                  <p className="text-yellow-400 text-sm">⏳ En attente du choix de <PlayerName player={t3Controller} /></p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 italic">Aucun joueur ne contrôle T3</p>
            )}
          </div>

          {/* TB sacrifice */}
          <div className={`kmt-section p-4 ${!tbController ? "opacity-50" : ""}`}>
            <p className="kmt-label mb-3 text-blue-400/80">Temple Bleu — Sacrifice optionnel</p>
            {tbController ? (
              <>
                <p className="text-sm text-gray-300 mb-3">
                  <PlayerName player={tbController} /> contrôle TB ({tbUnits} unité{tbUnits > 1 ? "s" : ""})
                </p>
                {!canTbSacrifice ? (
                  <p className="text-red-400 text-xs">Il faut au moins 2 unités sur TB</p>
                ) : tbChoice?.ready ? (
                  <p className="text-sm text-blue-300">
                    {tbChoice.sacrifice ? "✅ Sacrifice → +1 PV permanent" : "❌ Pas de sacrifice"}
                  </p>
                ) : isTbController ? (
                  <>
                    <label className={`flex items-center gap-3 select-none ${tbController.isAI ? "cursor-default" : "cursor-pointer"}`}>
                      <input
                        type="checkbox" checked={tbChecked}
                        onChange={e => !tbController.isAI && setTbChecked(e.target.checked)}
                        disabled={tbController.isAI}
                        className="w-4 h-4 accent-blue-500 rounded"
                      />
                      <span className="text-sm text-blue-300">
                        Sacrifier 2 unités → <strong>+1 PV permanent</strong>
                      </span>
                    </label>
                    <button
                      onClick={handleValidateTb}
                      className="mt-3 w-full py-2 rounded-lg font-semibold text-sm kmt-btn-gold"
                    >
                      ✅ Valider mon choix
                    </button>
                  </>
                ) : (
                  <p className="text-yellow-400 text-sm">⏳ En attente du choix de <PlayerName player={tbController} /></p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 italic">Aucun joueur ne contrôle TB</p>
            )}
          </div>

          {/* Bonus 2 temples */}
          <div className="kmt-section p-3">
            <p className="kmt-label mb-2">Bonus contrôle — 2+ temples (hors TB)</p>
            {twoTempleWinners.length > 0
              ? twoTempleWinners.map(p => (
                  <p key={p.id} className="text-sm text-amber-300">
                    ⭐ <PlayerName player={p} /> → <strong>+1 PV permanent</strong>
                  </p>
                ))
              : <p className="text-sm text-gray-600 italic">Aucun joueur n'atteint le seuil</p>
            }
          </div>

          <p className="text-center text-sm text-gray-400">
            {loading || night.status === "resolving" ? "🌙 Résolution en cours…" : "⏳ En attente des choix restants…"}
          </p>
        </div>
      </div>
    </div>
  );
}

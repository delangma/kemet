import { useState } from "react";
import { db } from "../../firebase";
import { ref, update, get } from "firebase/database";
import { dealCards, buildPuDeck, buildJiDeck, buildJpDeck } from "../../utils/deck";
import { getJuPositionsForLayout, getJiPositionsForLayout, getJpPositionsForLayout } from "../../constants/taSetiPositions";
import { POWER_TILES } from "../../constants/powerTiles";
import { CREATURE_POWERS } from "../../constants/creaturePowers";
import { computeTempVP } from "../../utils/vp";

const PLAYER_COLOR_TEXT = {
  Rouge: "text-red-400", Bleu: "text-blue-400",
  Vert: "text-emerald-400", Blanc: "text-gray-200", Noir: "text-gray-400",
};

function PlayerName({ player }) {
  return <span className={`font-bold ${PLAYER_COLOR_TEXT[player?.color] || "text-white"}`}>{player?.name ?? "?"}</span>;
}

function TempleRow({ icon, label, controller, bonus, isBlue }) {
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

export default function NightModal({ onClose, session, gameState }) {
  const { roomCode, allPlayers } = session;
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [t3Sacrifice, setT3Sacrifice] = useState(false);
  const [tbSacrifice, setTbSacrifice] = useState(false);

  const boardUnits = gameState?.boardUnits || {};

  function getController(zoneId) {
    const units = boardUnits[zoneId] || {};
    for (const p of allPlayers) {
      if ((units[p.color] || 0) > 0) return p;
    }
    return null;
  }

  const t1Controller = getController("T1");
  const t2Controller = getController("T2");
  const t3Controller = getController("T3");
  const tbController = getController("TB");

  const t3Units = t3Controller ? (boardUnits["T3"]?.[t3Controller.color] || 0) : 0;
  const tbUnits = tbController ? (boardUnits["TB"]?.[tbController.color] || 0) : 0;
  const canT3Sacrifice = t3Units >= 1;
  const canTbSacrifice = tbUnits >= 2;

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

  const twoTempleWinners = get2TempleWinners(t3Sacrifice && canT3Sacrifice);

  async function handleNightPhase() {
    setLoading(true);
    const snapshot = await get(ref(db, `rooms/${roomCode}/gameState`));
    if (!snapshot.exists()) { setLoading(false); return; }
    const state = snapshot.val();

    // Guard : si un joueur a déjà des tokens > 0, la nuit a déjà été résolue
    const alreadyResolved = Object.values(state.players || {}).some(ps => (ps.tokens ?? 0) > 0);
    if (alreadyResolved) { setDone(true); setLoading(false); return; }

    const updates = {};
    const deck = [...(state.idDeck || [])];
    const sortedPlayers = [...allPlayers].sort((a, b) => a.order - b.order);
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
    });

    if (t1Controller) ankBonus[t1Controller.id] += 2;
    if (t2Controller) ankBonus[t2Controller.id] += 3;

    let t3CtrlAfter = t3Controller;
    if (t3Controller && t3Sacrifice && canT3Sacrifice) {
      ankBonus[t3Controller.id] += 5;
      const newT3 = t3Units - 1;
      updates[`rooms/${roomCode}/gameState/boardUnits/T3/${t3Controller.color}`] = newT3;
      if (newT3 === 0) t3CtrlAfter = null;
      const ps = state.players?.[t3Controller.id] || {};
      updates[`rooms/${roomCode}/gameState/players/${t3Controller.id}/unitsReserve`] = (ps.unitsReserve ?? 2) + 1;
    }

    if (tbController && tbSacrifice && canTbSacrifice) {
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
        updates[`rooms/${roomCode}/gameState/players/${p.id}/unitsReserve`] = base + 4;
        updates[`rooms/${roomCode}/gameState/players/${p.id}/reinforcementPending`] = 4;
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

    updates[`rooms/${roomCode}/gameState/currentTurnPlayerId`] = sortedPlayers[0].id;
    updates[`rooms/${roomCode}/gameState/idDeck`] = deck;

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
      setDone(true);
      setLoading(false);
      return;
    }

    await update(ref(db, "/"), updates);

    // Lance l'Aube automatiquement pour tous les clients via Firebase
    const dawnChoices = {};
    allPlayers.forEach(p => {
      dawnChoices[p.id] = { combatCard: null, discardCard: null, dawnTokens: 0, ready: false, tokensConfirmed: false };
    });
    await update(ref(db, "/"), {
      [`rooms/${roomCode}/dawn`]: { status: "selecting", currentTurn: null, choices: dawnChoices },
    });

    setDone(true);
    setLoading(false);
  }

  return (
    <div className="kmt-overlay">
      <div className="kmt-panel w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800">
          <h2 className="kmt-title text-xl">🌙 Phase de Nuit</h2>
          <button onClick={onClose} className="kmt-close">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!done ? (
            <>
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
                    <label className={`flex items-center gap-3 cursor-pointer select-none ${!canT3Sacrifice ? "opacity-40" : ""}`}>
                      <input
                        type="checkbox" checked={t3Sacrifice}
                        onChange={e => canT3Sacrifice && setT3Sacrifice(e.target.checked)}
                        disabled={!canT3Sacrifice}
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                      <span className="text-sm text-amber-300">
                        Sacrifier 1 unité → <strong>+5 Ank</strong>
                        {t3Units === 1 && t3Sacrifice && <span className="text-red-400 text-xs ml-2">(perd le contrôle)</span>}
                      </span>
                    </label>
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
                    <label className={`flex items-center gap-3 cursor-pointer select-none ${!canTbSacrifice ? "opacity-40" : ""}`}>
                      <input
                        type="checkbox" checked={tbSacrifice}
                        onChange={e => canTbSacrifice && setTbSacrifice(e.target.checked)}
                        disabled={!canTbSacrifice}
                        className="w-4 h-4 accent-blue-500 rounded"
                      />
                      <span className="text-sm text-blue-300">
                        Sacrifier 2 unités → <strong>+1 PV permanent</strong>
                      </span>
                    </label>
                    {!canTbSacrifice && (
                      <p className="text-red-400 text-xs mt-2">Il faut au moins 2 unités sur TB</p>
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

              <button
                onClick={handleNightPhase}
                disabled={loading}
                className={`w-full py-3 rounded-lg font-bold transition-colors ${
                  loading ? "kmt-btn-disabled" : "kmt-btn-gold"
                }`}
              >
                {loading ? "Résolution en cours…" : "✅ Résoudre la nuit"}
              </button>
            </>
          ) : (
            <>
              <div className="kmt-section p-5 text-center space-y-2">
                <p className="text-green-400 font-bold text-lg">✅ Nuit résolue</p>
                <p className="text-gray-400 text-sm">Chaque joueur a reçu +2 Ank et +1 carte ID.</p>
                {(t1Controller || t2Controller) && <p className="text-amber-300 text-sm">Bonus temples T1/T2 distribués.</p>}
                {t3Sacrifice && canT3Sacrifice && t3Controller && (
                  <p className="text-amber-300 text-sm">{t3Controller.name} a sacrifié sur T3 → +5 Ank.</p>
                )}
                {tbSacrifice && canTbSacrifice && tbController && (
                  <p className="text-blue-300 text-sm">{tbController.name} a sacrifié sur TB → +1 PV.</p>
                )}
                {twoTempleWinners.length > 0 && (
                  <p className="text-amber-300 text-sm">{twoTempleWinners.map(p => p.name).join(", ")} → +1 PV (2 temples).</p>
                )}
              </div>

              <p className="text-orange-300 text-sm text-center">🌅 Phase de l'Aube lancée automatiquement…</p>
              <button onClick={onClose} className="w-full text-center text-gray-500 hover:text-gray-300 text-sm transition-colors py-1">
                Fermer sans lancer l'Aube
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

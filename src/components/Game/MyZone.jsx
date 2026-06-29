import { useState } from "react";
import { ACTIONS } from "../../constants/game";
import { COMBAT_CARDS as CARDS } from "../../constants/cards";
import IdCardModal from "../Cards/IdCardModal";
import IdDraftModal from "../Cards/IdDraftModal";
import IdRefreshModal from "../Cards/IdRefreshModal";
import PyramidEvolveModal from "./PyramidEvolveModal";
import PowerTileModal from "./PowerTileModal";
import CreatureEquipModal from "./CreatureEquipModal";
import { POWER_TILES, TILE_COLOR_STYLE, TYPE_LABEL, getTileImageUrl } from "../../constants/powerTiles";
import { getCreatureSpriteStyle } from "../../constants/creatures";
import { BOARD_ZONES } from "../../constants/board";
import { db } from "../../firebase";
import { ref, update, get } from "firebase/database";
import { dealCards } from "../../utils/deck";
import { computeTempVP } from "../../utils/vp";
import { CREATURE_POWERS } from "../../constants/creaturePowers";
import { PU_CARDS } from "../../constants/puCards";

const PLAYER_BADGE = {
  Rouge: { bg: '#7f1d1d', text: '#fca5a5', border: '#dc2626' },
  Bleu:  { bg: '#1e3a8a', text: '#93c5fd', border: '#3b82f6' },
  Vert:  { bg: '#14532d', text: '#86efac', border: '#22c55e' },
  Blanc: { bg: '#d1d5db', text: '#111827', border: '#9ca3af' },
  Noir:  { bg: '#1f2937', text: '#d1d5db', border: '#4b5563' },
};

const BUY_COLOR_MAP = {
  buy_red:   "Rouge",
  buy_blue:  "Bleu",
  buy_white: "Blanc",
  buy_black: "Noir",
};

const BUY_CIRCLE_STYLE = {
  Rouge: { bg: "bg-red-600",    border: "border-red-500",    active: "hover:bg-red-500"    },
  Bleu:  { bg: "bg-blue-600",   border: "border-blue-500",   active: "hover:bg-blue-500"   },
  Blanc: { bg: "bg-gray-200",   border: "border-gray-300",   active: "hover:bg-white"      },
  Noir:  { bg: "bg-neutral-900", border: "border-yellow-600", active: "hover:bg-neutral-800" },
};

const ACTION_IMG = {
  move1:   "/Action_Deplacement.png",
  move2:   "/Action_Deplacement.png",
  recruit: "/Action_Recrutement.png",
  pyramid: "/Action_Evolution_Pyramide.png",
  prayer2: "/Action_Priere.png",
  prayer3: "/Action_Priere.png",
  buy_red:   "/Action_Achat_Rouge.png",
  buy_blue:  "/Action_Achat_Bleu.png",
  buy_white: "/Action_Achat_Blanc.png",
  buy_black: "/Action_Achat_Noir.png",
};

export default function MyZone({
  player, gameState, onActionActivate, onSetActionMode, actionMode,
  onEndTurn, canEndTurn: canEndTurnProp, onOpenTaSeti, onOpenCombat, onOpenDawn, onOpenNight, session,
  onMoveCancel, onGoldenTokenMoveActivate, onGoldenTokenRecruitActivate,
  onGoldenTokenPrayerActivate, onGoldenTokenBuyActivate, onRenforcementActivate,
  onNightTaSetiAdvance, onUseJuToken,
  onPlayDayIdCard, onCancelTurn, canCancelTurn, onInfoEvent, onViewMyTiles,
}) {
  const [showCombat, setShowCombat] = useState(false);
  const [showIdModal, setShowIdModal] = useState(false);
  const [localModal, setLocalModal] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const state   = gameState?.players?.[player.id] || {};
  const usedActions = state.usedActions || [];
  const tokens  = state.tokens ?? 5;
  const actionsThisTurn = state.actionsThisTurn ?? 0;
  const pyramids = state.pyramids || { red: 0, blue: 0, white: 0 };
  const myIdCards = state.idCards || [];
  const ownedTileIds = state.ownedTileIds || [];

  const vpPermanent = state.vpPermanent ?? 0;
  const vpTemp = computeTempVP(player.id, gameState, session.allPlayers ?? []);
  const vpTotal = vpPermanent + vpTemp;

  // Creatures
  const creatureAssignments  = gameState?.creatureAssignments  || {};
  const creatureAssignments2 = gameState?.creatureAssignments2 || {};
  const creatureIds = ownedTileIds.filter(id => POWER_TILES.find(t => t.id === id)?.type === "creature");
  const creatureZoneMap = {}; // { creatureId: zoneId }
  Object.entries(creatureAssignments).forEach(([zoneId, colorMap]) => {
    if (colorMap[player.color]) creatureZoneMap[colorMap[player.color]] = zoneId;
  });
  Object.entries(creatureAssignments2).forEach(([zoneId, colorMap]) => {
    if (colorMap[player.color]) creatureZoneMap[colorMap[player.color]] = zoneId;
  });
  const reserveCreatureIds = creatureIds.filter(id => !creatureZoneMap[id]);
  const myJoinOrder = session.allPlayers?.find(p => p.id === player.id)?.joinOrder;
  const cityZonesAvailable = BOARD_ZONES.filter(z => {
    if (!z.id.startsWith(`J${myJoinOrder}C`)) return false;
    if ((gameState?.boardUnits?.[z.id]?.[player.color] || 0) === 0) return false;
    const slot1Id = creatureAssignments[z.id]?.[player.color];
    if (!slot1Id) return true;
    const slot1Name = POWER_TILES.find(t => t.id === slot1Id)?.name;
    return !!(CREATURE_POWERS[slot1Name]?.allowsSecondCreature && !creatureAssignments2[z.id]?.[player.color]);
  });
  // Exclut Kraken (réserve permanente) et Cerbère (placement via achat uniquement)
  const equippableReserveIds = reserveCreatureIds.filter(id => {
    const name = POWER_TILES.find(t => t.id === id)?.name;
    const power = name ? CREATURE_POWERS[name] : null;
    return !power?.reserveOnly && !power?.placeOnAnyZone;
  });
  const canEquipCreature = equippableReserveIds.length > 0 && cityZonesAvailable.length > 0;

  const currentTurnPlayerId = gameState?.currentTurnPlayerId;
  const isMyTurn  = currentTurnPlayerId === player.id;
  const canPlayAction = isMyTurn && actionsThisTurn < 1 && tokens > 0 && !actionMode;
  const canEndTurn = canEndTurnProp !== undefined ? canEndTurnProp : (isMyTurn && actionsThisTurn >= 1);

  // Couleurs d'achat disponibles : pyramides possédées + pyramides adverses sur nos zones
  const allPyramids = gameState?.pyramids || {};
  const boardUnits = gameState?.boardUnits || {};
  const ownPyramidColors = new Set(
    Object.values(allPyramids)
      .filter(p => p.controllerId === player.id)
      .map(p => p.color)
  );
  const enemyPyramidColors = new Set();
  Object.entries(boardUnits).forEach(([zoneId, units]) => {
    if (!/^J\dC\d$/.test(zoneId) || (units[player.color] || 0) <= 0) return;
    const pyramid = allPyramids[zoneId.replace('C', 'P')];
    if (pyramid?.controllerId && pyramid.controllerId !== player.id) {
      enemyPyramidColors.add(pyramid.color);
    }
  });
  const availableBuyColors = new Set([...ownPyramidColors, ...enemyPyramidColors]);

  // Jeton doré — R_4_1 "Déplacement Passe/Muraille"
  const goldenTokenUsed = state.goldenTokenUsed ?? false;
  const hasGoldenTokenMove = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Déplacement Passe/Muraille");
  const canUseGoldenToken = isMyTurn && hasGoldenTokenMove && !goldenTokenUsed && !actionMode;
  // Jeton doré — B_4_2 "Jeton doré déplacement recrutement"
  const hasGoldenTokenMoveRecruit = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Jeton doré déplacement recrutement");
  const canUseGoldenTokenMR = isMyTurn && hasGoldenTokenMoveRecruit && !goldenTokenUsed && !actionMode;
  // Jeton doré — N_1_4 "Jeton doré priére"
  const hasGoldenTokenPrayer = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Jeton doré priére");
  const canUseGoldenTokenPrayer = isMyTurn && hasGoldenTokenPrayer && !goldenTokenUsed && !actionMode;
  // Jeton doré — N_3_3 "Jeton Doré Déplacement"
  const hasGoldenTokenMove3 = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Jeton Doré Déplacement");
  const canUseGoldenTokenMove3 = isMyTurn && hasGoldenTokenMove3 && !goldenTokenUsed && !actionMode;
  // Jeton doré — N_2_4 "Jeton doré achat ×2"
  // Disponible pour la (les) couleur(s) d'achat sur lesquelles un jeton a été posé ce jour
  const hasGoldenTokenBuy = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Jeton doré achat *2");
  const boughtColorsToday = usedActions.filter(a => a.startsWith("buy_"));
  const goldenBuyBlockedThisTurn = state.goldenBuyBlockedThisTurn ?? false;
  const canUseGoldenTokenBuy = isMyTurn && hasGoldenTokenBuy && !goldenTokenUsed && !goldenBuyBlockedThisTurn && !actionMode && boughtColorsToday.length > 0;
  const hasGoldenToken = hasGoldenTokenMove || hasGoldenTokenMoveRecruit || hasGoldenTokenPrayer || hasGoldenTokenMove3 || hasGoldenTokenBuy;
  const hasGrayToken   = ownedTileIds.some(id => (POWER_TILES.find(t => t.id === id)?.name ?? "").toLowerCase().startsWith("jeton gris"));
  // Renforcement
  const reinforcementPending = state.reinforcementPending ?? 0;
  const canRenforce = isMyTurn && reinforcementPending > 0 && !actionMode;
  // Augmentation pyramide
  const pyramidUpgradePending = state.pyramidUpgradePending ?? 0;
  const canUpgradeFree = isMyTurn && pyramidUpgradePending > 0 && !actionMode;
  // Avancée de nuit Ta-Seti
  const taSetiNightAdvancePending = state.taSetiNightAdvancePending ?? 0;
  const canNightTaSetiAdvance = isMyTurn && taSetiNightAdvancePending > 0 && !actionMode;
  // Draft ID (Choix supplémentaire)
  const idDraftPending = state.idDraftPending || null;
  const hasIdDraft = Array.isArray(idDraftPending) && idDraftPending.length > 0;
  // Draft ID BI_2 (refresh)
  const idRefreshPending = state.idRefreshPending ?? false;
  // Jetons JU (PU cards) en main
  const juTokenHand = state.juTokenHand || [];
  const canUseJuToken = isMyTurn && !actionMode;
  const currentTurnPlayer = session.allPlayers?.find(p => p.id === currentTurnPlayerId);

  function handleActionClick(action) {
    if (actionMode === "buy_golden") {
      // Restreint au(x) couleur(s) sur lesquelles un jeton a été posé ce jour
      if (BUY_COLOR_MAP[action.id] && boughtColorsToday.includes(action.id)) setLocalModal(action.id);
      return;
    }
    if (!canPlayAction) return;
    if (BUY_COLOR_MAP[action.id] && isUsed(action.id)) return;
    if (action.id === "prayer2" || action.id === "prayer3") {
      onActionActivate(action.id);
    } else if (action.id === "pyramid") {
      setLocalModal("pyramid");
    } else if (action.id === "recruit") {
      onSetActionMode("recruit");
    } else if (action.id === "move1" || action.id === "move2") {
      onSetActionMode(action.id);
    } else if (BUY_COLOR_MAP[action.id]) {
      setLocalModal(action.id);
    }
  }

  function isUsed(actionId) { return usedActions.includes(actionId); }

  async function handlePlayIdCard(instanceId) {
    const card = myIdCards.find(c => c.instanceId === instanceId);
    if (!card) return;
    if ((card.timing === "day" || card.timing === "any") && onPlayDayIdCard) {
      await onPlayDayIdCard(card);
    }
  }

  async function handleEquipCreatures(assignments) {
    const updates = {};
    Object.entries(assignments).forEach(([creatureId, zoneId]) => {
      const slot1 = creatureAssignments[zoneId]?.[player.color];
      if (slot1 && slot1 !== creatureId) {
        updates[`rooms/${session.roomCode}/gameState/creatureAssignments2/${zoneId}/${player.color}`] = creatureId;
      } else {
        updates[`rooms/${session.roomCode}/gameState/creatureAssignments/${zoneId}/${player.color}`] = creatureId;
      }
    });
    await update(ref(db, "/"), updates);
  }

  async function handlePickDraftCard(card) {
    const snapshot = await get(ref(db, `rooms/${session.roomCode}/gameState`));
    if (!snapshot.exists()) return;
    const s = snapshot.val();
    const ps = s.players?.[player.id] || {};
    const draft = ps.idDraftPending || [];
    const rest = draft.filter(c => c.instanceId !== card.instanceId);
    const deck = [...(s.idDeck || []), ...rest];
    await update(ref(db, "/"), {
      [`rooms/${session.roomCode}/gameState/players/${player.id}/idCards`]: [...(ps.idCards || []), card],
      [`rooms/${session.roomCode}/gameState/players/${player.id}/idDraftPending`]: null,
      [`rooms/${session.roomCode}/gameState/idDeck`]: deck,
    });
    setLocalModal(null);
    await onInfoEvent?.();
  }

  async function handleIdRefresh(discardedCards) {
    const snapshot = await get(ref(db, `rooms/${session.roomCode}/gameState`));
    if (!snapshot.exists()) return;
    const s = snapshot.val();
    const ps = s.players?.[player.id] || {};
    const discardedIds = new Set(discardedCards.map(c => c.instanceId));
    const keptCards = (ps.idCards || []).filter(c => !discardedIds.has(c.instanceId));
    const drawCount = discardedCards.length + 1;
    const deck = [...(s.idDeck || [])];
    const toDraw = Math.min(drawCount, deck.length);
    const { hand, remaining } = toDraw > 0 ? dealCards(deck, toDraw) : { hand: [], remaining: deck };
    await update(ref(db, "/"), {
      [`rooms/${session.roomCode}/gameState/players/${player.id}/idCards`]: [...keptCards, ...hand],
      [`rooms/${session.roomCode}/gameState/players/${player.id}/idRefreshPending`]: null,
      [`rooms/${session.roomCode}/gameState/idDeck`]: remaining,
    });
    setLocalModal(null);
    await onInfoEvent?.();
  }



  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="text-white select-none" style={{ background: '#08060400', borderTop: '1px solid #4a3410' }}>

      {/* ── Bande 1 Mobile : version compacte ── */}
      <div
        className="md:hidden"
        style={{
          backgroundImage: `linear-gradient(${isMyTurn ? 'rgba(28,16,2,0.82)' : 'rgba(8,6,2,0.80)'},${isMyTurn ? 'rgba(28,16,2,0.82)' : 'rgba(8,6,2,0.80)'}),url(/ui/backend.png)`,
          backgroundRepeat: 'repeat',
          backgroundSize: 'auto',
          borderBottom: '1px solid #3a2a0c',
        }}
      >
        {/* Ligne 1 : badge + stats + fin de tour */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          {(() => {
            const b = PLAYER_BADGE[player.color] || PLAYER_BADGE.Noir;
            return (
              <span className="shrink-0 font-bold" style={{ background: b.bg, color: b.text, border: `1px solid ${b.border}`, padding: '2px 7px', borderRadius: 3, fontSize: 10, letterSpacing: '0.04em' }}>
                {player.name}
              </span>
            );
          })()}
          <span className="flex items-center gap-0.5 text-xs shrink-0">
            <span style={{ color: '#C9973A' }}>🪙</span>
            <span style={{ color: '#e5d5b0', fontWeight: 600 }}>{state.ank ?? 7}</span>
          </span>
          <span className="flex items-center gap-0.5 text-xs shrink-0" title={`${vpPermanent}p+${vpTemp}t`}>
            <span style={{ color: '#fbbf24' }}>☀</span>
            <span style={{ color: '#e5d5b0', fontWeight: 600 }}>{vpTotal}</span>
          </span>
          <div className="flex gap-0.5 shrink-0 items-center">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full border" style={{ background: i < tokens ? '#C9973A' : '#1a1508', borderColor: i < tokens ? '#8B6014' : '#3a2a0c' }} />
            ))}
            {(hasGrayToken || hasGoldenToken) && <div style={{ width: 1, height: 10, background: '#3a2a0c', margin: '0 2px' }} />}
            {hasGrayToken && <div title="Jeton gris" className="w-2.5 h-2.5 rounded-full border" style={{ background: tokens >= 6 ? '#9ca3af' : '#1a1508', borderColor: tokens >= 6 ? '#6b7280' : '#3a2a0c' }} />}
            {hasGoldenToken && <div title="Jeton doré" className="w-2.5 h-2.5 rounded-full border" style={{ background: !goldenTokenUsed ? '#fbbf24' : '#1a1508', borderColor: !goldenTokenUsed ? '#b45309' : '#3a2a0c' }} />}
          </div>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {canCancelTurn && (
              <button
                onClick={() => {
                  if (confirmCancel) { onCancelTurn?.(); setConfirmCancel(false); }
                  else { setConfirmCancel(true); setTimeout(() => setConfirmCancel(false), 3000); }
                }}
                style={{ padding: '4px 8px', borderRadius: 3, fontWeight: 700, fontSize: 10, border: confirmCancel ? '1px solid #dc2626' : '1px solid #4a3410', background: confirmCancel ? '#7f1d1d' : '#1a1508', color: confirmCancel ? '#fca5a5' : '#a88a40' }}
              >
                {confirmCancel ? 'OK?' : '↩'}
              </button>
            )}
            <button
              onClick={onEndTurn}
              disabled={!canEndTurn}
              style={{ padding: '5px 12px', borderRadius: 3, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', border: canEndTurn ? '1px solid #3b82f6' : '1px solid #1e3a8a', background: canEndTurn ? '#1d4ed8' : '#172554', color: canEndTurn ? '#fff' : '#4b5563', boxShadow: canEndTurn ? '0 0 8px rgba(59,130,246,0.35)' : 'none', cursor: canEndTurn ? 'pointer' : 'not-allowed' }}
            >
              FIN →
            </button>
          </div>
        </div>
        {/* Ligne 2 : boutons spéciaux + rapides (défilement horizontal) */}
        <div className="flex items-center gap-1.5 px-2 pb-1.5 overflow-x-auto" style={{ borderTop: '1px solid #2a1e08' }}>
          {/* Jetons dorés */}
          {hasGoldenTokenMove && (
            <button onClick={onGoldenTokenMoveActivate} disabled={!canUseGoldenToken} className={`text-[10px] px-2 py-1 rounded border font-semibold shrink-0 ${canUseGoldenToken ? 'bg-yellow-700/80 text-yellow-100 border-yellow-500' : 'bg-gray-800/50 text-gray-600 border-gray-700'}`}>⭐ Dépl.PM</button>
          )}
          {hasGoldenTokenMoveRecruit && !goldenTokenUsed && (
            <>
              <button onClick={onGoldenTokenMoveActivate} disabled={!canUseGoldenTokenMR} className={`text-[10px] px-2 py-1 rounded border font-semibold shrink-0 ${canUseGoldenTokenMR ? 'bg-yellow-700/80 text-yellow-100 border-yellow-500' : 'bg-gray-800/50 text-gray-600 border-gray-700'}`}>⭐ Dépl.</button>
              <button onClick={onGoldenTokenRecruitActivate} disabled={!canUseGoldenTokenMR} className={`text-[10px] px-2 py-1 rounded border font-semibold shrink-0 ${canUseGoldenTokenMR ? 'bg-yellow-700/80 text-yellow-100 border-yellow-500' : 'bg-gray-800/50 text-gray-600 border-gray-700'}`}>⭐ Recr.</button>
            </>
          )}
          {hasGoldenTokenMove3 && (
            <button onClick={onGoldenTokenMoveActivate} disabled={!canUseGoldenTokenMove3} className={`text-[10px] px-2 py-1 rounded border font-semibold shrink-0 ${canUseGoldenTokenMove3 ? 'bg-yellow-700/80 text-yellow-100 border-yellow-500' : 'bg-gray-800/50 text-gray-600 border-gray-700'}`}>⭐ Dépl.</button>
          )}
          {hasGoldenTokenBuy && (
            <button onClick={onGoldenTokenBuyActivate} disabled={!canUseGoldenTokenBuy} className={`text-[10px] px-2 py-1 rounded border font-semibold shrink-0 ${canUseGoldenTokenBuy ? 'bg-yellow-700/80 text-yellow-100 border-yellow-500' : 'bg-gray-800/50 text-gray-600 border-gray-700'}`}>⭐ Achat</button>
          )}
          {hasGoldenTokenPrayer && (
            <button onClick={onGoldenTokenPrayerActivate} disabled={!canUseGoldenTokenPrayer} className={`text-[10px] px-2 py-1 rounded border font-semibold shrink-0 ${canUseGoldenTokenPrayer ? 'bg-yellow-700/80 text-yellow-100 border-yellow-500' : 'bg-gray-800/50 text-gray-600 border-gray-700'}`}>⭐ Prière</button>
          )}
          {/* Pending actions */}
          {reinforcementPending > 0 && (
            <button onClick={onRenforcementActivate} disabled={!canRenforce} className={`text-[10px] px-2 py-1 rounded border font-semibold shrink-0 ${canRenforce ? 'bg-cyan-700/80 text-cyan-100 border-cyan-500' : 'bg-gray-800/50 text-gray-600 border-gray-700'}`}>🔰 Renf.({reinforcementPending})</button>
          )}
          {pyramidUpgradePending > 0 && (
            <button onClick={() => canUpgradeFree && setLocalModal('pyramid_free')} disabled={!canUpgradeFree} className={`text-[10px] px-2 py-1 rounded border font-semibold shrink-0 ${canUpgradeFree ? 'bg-indigo-700/80 text-indigo-100 border-indigo-500' : 'bg-gray-800/50 text-gray-600 border-gray-700'}`}>🏛️ Pyr.({pyramidUpgradePending})</button>
          )}
          {taSetiNightAdvancePending > 0 && (
            <button onClick={() => canNightTaSetiAdvance && onNightTaSetiAdvance?.()} disabled={!canNightTaSetiAdvance} className={`text-[10px] px-2 py-1 rounded border font-semibold shrink-0 ${canNightTaSetiAdvance ? 'bg-red-900/80 text-red-200 border-red-700' : 'bg-gray-800/50 text-gray-600 border-gray-700'}`}>🌙 TS({taSetiNightAdvancePending})</button>
          )}
          {juTokenHand.map((token, idx) => {
            const puCard = PU_CARDS.find(c => c.id === token.cardId);
            return (
              <button key={`m-${token.nodeId}-${idx}`} onClick={() => canUseJuToken && onUseJuToken?.(token.nodeId, token.cardId)} disabled={!canUseJuToken} className={`text-[10px] px-2 py-1 rounded border font-semibold shrink-0 ${canUseJuToken ? 'bg-yellow-700/80 text-yellow-100 border-yellow-500' : 'bg-gray-800/50 text-gray-600 border-gray-700'}`}>🪬 {puCard?.label ?? token.cardId}</button>
            );
          })}
          {hasIdDraft && (
            <button onClick={() => setLocalModal('id_draft')} className="text-[10px] px-2 py-1 rounded border font-semibold shrink-0 bg-purple-700/80 text-purple-100 border-purple-500">🃏 Choisir({idDraftPending.length})</button>
          )}
          {idRefreshPending && (
            <button onClick={() => setLocalModal('id_refresh')} className="text-[10px] px-2 py-1 rounded border font-semibold shrink-0 bg-teal-700/80 text-teal-100 border-teal-500">🔄 Draft ID</button>
          )}
          {/* Boutons rapides */}
          <div className="w-px h-4 bg-gray-700 shrink-0" />
          {onViewMyTiles && <button onClick={onViewMyTiles} className="text-[10px] px-2 py-1 rounded border font-semibold shrink-0 bg-gray-800/60 text-amber-400 border-gray-700">📜 Tuiles</button>}
          <button onClick={() => setShowIdModal(true)} className="shrink-0 relative" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <img src="/ID_dos.png" alt="Cartes ID" style={{ width: 20, height: 28, objectFit: 'cover', borderRadius: 3, display: 'block' }} />
            {myIdCards.length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -5, background: '#b45309', color: '#fff', fontSize: 8, fontWeight: 700, borderRadius: '50%', width: 13, height: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                {myIdCards.length}
              </span>
            )}
          </button>
          {creatureIds.length > 0 && (
            <button onClick={() => setLocalModal('creatures')} className={`text-[10px] px-2 py-1 rounded border font-semibold shrink-0 bg-gray-800/60 border-gray-700 ${canEquipCreature ? 'text-amber-400' : 'text-gray-400'}`}>
              🐉{equippableReserveIds.length > 0 && <span className="ml-1 bg-amber-700 text-white text-[9px] font-bold px-1 rounded-full">{equippableReserveIds.length}</span>}
            </button>
          )}
        </div>
      </div>

      {/* ── Bande 1 Desktop : infos joueur + ressources + contrôles ── */}
      <div
        className="hidden md:flex items-center gap-3 px-4 py-2 flex-wrap"
        style={{
          background: isMyTurn ? 'rgba(30,18,4,0.95)' : 'rgba(12,10,6,0.97)',
          borderBottom: '1px solid #3a2a0c',
        }}
      >

        {/* Badge joueur */}
        {(() => {
          const b = PLAYER_BADGE[player.color] || PLAYER_BADGE.Noir;
          return (
            <span
              className="shrink-0 font-bold text-sm"
              style={{
                background: b.bg,
                color: b.text,
                border: `1px solid ${b.border}`,
                padding: '3px 12px',
                borderRadius: 4,
                letterSpacing: '0.06em',
              }}
            >
              {player.name}
            </span>
          );
        })()}

        {/* Ressources */}
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <span className="flex items-center gap-1">
            <span style={{ color: '#C9973A', fontWeight: 700 }}>🪙</span>
            <span style={{ color: '#e5d5b0', fontWeight: 600 }}>{state.ank ?? 7}</span>
          </span>
          <span
            className="flex items-center gap-1"
            title={`Permanent: ${vpPermanent} | Temporaire: ${vpTemp}`}
          >
            <span style={{ color: '#fbbf24' }}>☀</span>
            <span style={{ color: '#e5d5b0', fontWeight: 600 }}>{vpTotal}</span>
            <span style={{ color: '#6B4C1E', fontSize: 10 }}>({vpPermanent}+{vpTemp})</span>
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: '#f97316' }}>🏆</span>
            <span style={{ color: '#e5d5b0', fontWeight: 600 }}>{state.dawnTokens ?? 0}</span>
          </span>
        </div>

        <div className="w-px h-4 shrink-0" style={{ background: '#3a2a0c' }} />

        {/* Jetons action */}
        <div className="flex gap-1 shrink-0 items-center">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 rounded-full border" style={{ background: i < tokens ? '#C9973A' : '#1a1508', borderColor: i < tokens ? '#8B6014' : '#3a2a0c' }} />
          ))}
          {(hasGrayToken || hasGoldenToken) && <div style={{ width: 1, height: 12, background: '#3a2a0c', margin: '0 2px' }} />}
          {hasGrayToken && <div title="Jeton gris" className="w-3.5 h-3.5 rounded-full border" style={{ background: tokens >= 6 ? '#9ca3af' : '#1a1508', borderColor: tokens >= 6 ? '#6b7280' : '#3a2a0c' }} />}
          {hasGoldenToken && <div title="Jeton doré" className="w-3.5 h-3.5 rounded-full border" style={{ background: !goldenTokenUsed ? '#fbbf24' : '#1a1508', borderColor: !goldenTokenUsed ? '#b45309' : '#3a2a0c' }} />}
        </div>
        {/* Jeton doré R_4_1 — Déplacement Passe/Muraille */}
        {hasGoldenTokenMove && (
          <div className={`flex items-center gap-1 shrink-0 ${goldenTokenUsed ? "opacity-30" : ""}`}>
            <button
              onClick={onGoldenTokenMoveActivate}
              disabled={!canUseGoldenToken}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${
                canUseGoldenToken
                  ? "bg-yellow-700/80 hover:bg-yellow-600 text-yellow-100 border-yellow-500"
                  : "bg-gray-800/50 text-gray-600 border-gray-700 cursor-not-allowed"
              }`}
            >
              ⭐ Dépl. (Passe Muraille)
            </button>
          </div>
        )}
        {/* Jeton doré B_4_2 — Déplacement ou Recrutement */}
        {hasGoldenTokenMoveRecruit && (
          <div className={`flex items-center gap-1 shrink-0 ${goldenTokenUsed ? "opacity-30" : ""}`}>
            <button
              onClick={onGoldenTokenMoveActivate}
              disabled={!canUseGoldenTokenMR}
              className={`text-xs px-2 py-1 rounded-md font-semibold border transition-all ${
                canUseGoldenTokenMR
                  ? "bg-yellow-700/80 hover:bg-yellow-600 text-yellow-100 border-yellow-500"
                  : "bg-gray-800/50 text-gray-600 border-gray-700 cursor-not-allowed"
              }`}
            >
              ⭐ Dépl.
            </button>
            <button
              onClick={onGoldenTokenRecruitActivate}
              disabled={!canUseGoldenTokenMR}
              className={`text-xs px-2 py-1 rounded-md font-semibold border transition-all ${
                canUseGoldenTokenMR
                  ? "bg-yellow-700/80 hover:bg-yellow-600 text-yellow-100 border-yellow-500"
                  : "bg-gray-800/50 text-gray-600 border-gray-700 cursor-not-allowed"
              }`}
            >
              ⭐ Recr.
            </button>
          </div>
        )}
        {/* Jeton Doré Déplacement N_3_3 */}
        {hasGoldenTokenMove3 && (
          <div className={`flex items-center gap-1 shrink-0 ${goldenTokenUsed ? "opacity-30" : ""}`}>
            <button
              onClick={onGoldenTokenMoveActivate}
              disabled={!canUseGoldenTokenMove3}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${
                canUseGoldenTokenMove3
                  ? "bg-yellow-700/80 hover:bg-yellow-600 text-yellow-100 border-yellow-500"
                  : "bg-gray-800/50 text-gray-600 border-gray-700 cursor-not-allowed"
              }`}
            >
              ⭐ Dépl.
            </button>
          </div>
        )}
        {/* Jeton doré achat N_2_4 */}
        {hasGoldenTokenBuy && (
          <div className={`flex items-center gap-1 shrink-0 ${goldenTokenUsed ? "opacity-30" : ""}`}>
            <button
              onClick={onGoldenTokenBuyActivate}
              disabled={!canUseGoldenTokenBuy}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${
                canUseGoldenTokenBuy
                  ? "bg-yellow-700/80 hover:bg-yellow-600 text-yellow-100 border-yellow-500"
                  : "bg-gray-800/50 text-gray-600 border-gray-700 cursor-not-allowed"
              }`}
            >
              ⭐ Achat (+1)
            </button>
          </div>
        )}
        {/* Jeton doré priére N_1_4 */}
        {hasGoldenTokenPrayer && (
          <div className={`flex items-center gap-1 shrink-0 ${goldenTokenUsed ? "opacity-30" : ""}`}>
            <button
              onClick={onGoldenTokenPrayerActivate}
              disabled={!canUseGoldenTokenPrayer}
              title="Jeton doré : déclenche une prière gratuite (hors action)"
              className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all ${
                canUseGoldenTokenPrayer
                  ? "bg-yellow-700/80 hover:bg-yellow-600 text-yellow-100 border-yellow-500"
                  : "bg-gray-800/50 text-gray-600 border-gray-700 cursor-not-allowed"
              }`}
            >
              ⭐ Prière gratuite
            </button>
          </div>
        )}
        {/* Renforcement B_4_4 */}
        {reinforcementPending > 0 && (
          <button
            onClick={onRenforcementActivate}
            disabled={!canRenforce}
            className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all shrink-0 ${
              canRenforce
                ? "bg-cyan-700/80 hover:bg-cyan-600 text-cyan-100 border-cyan-500"
                : "bg-gray-800/50 text-gray-600 border-gray-700 cursor-not-allowed"
            }`}
          >
            🔰 Renforcer ({reinforcementPending})
          </button>
        )}
        {/* Augmentation pyramide W_3_1 */}
        {pyramidUpgradePending > 0 && (
          <button
            onClick={() => canUpgradeFree && setLocalModal("pyramid_free")}
            disabled={!canUpgradeFree}
            className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all shrink-0 ${
              canUpgradeFree
                ? "bg-indigo-700/80 hover:bg-indigo-600 text-indigo-100 border-indigo-500"
                : "bg-gray-800/50 text-gray-600 border-gray-700 cursor-not-allowed"
            }`}
          >
            🏛️ Améliorer pyramide ({pyramidUpgradePending})
          </button>
        )}
        {/* Avancée de nuit Ta-Seti R_2_4 */}
        {taSetiNightAdvancePending > 0 && (
          <button
            onClick={() => canNightTaSetiAdvance && onNightTaSetiAdvance?.()}
            disabled={!canNightTaSetiAdvance}
            className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all shrink-0 ${
              canNightTaSetiAdvance
                ? "bg-red-900/80 hover:bg-red-800 text-red-200 border-red-700"
                : "bg-gray-800/50 text-gray-600 border-gray-700 cursor-not-allowed"
            }`}
          >
            🌙 Avancée Ta-Seti ({taSetiNightAdvancePending})
          </button>
        )}
        {/* Jetons JU (PU) : utilisables à tout moment pendant son tour */}
        {juTokenHand.map((token, idx) => {
          const puCard = PU_CARDS.find(c => c.id === token.cardId);
          return (
            <button
              key={`${token.nodeId}-${idx}`}
              onClick={() => canUseJuToken && onUseJuToken?.(token.nodeId, token.cardId)}
              disabled={!canUseJuToken}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold border transition-all shrink-0 ${
                canUseJuToken
                  ? "bg-yellow-700/80 hover:bg-yellow-600 text-yellow-100 border-yellow-500"
                  : "bg-gray-800/50 text-gray-600 border-gray-700 cursor-not-allowed"
              }`}
            >
              🪬 {puCard?.label ?? token.cardId}
            </button>
          );
        })}
        {/* Choix supplémentaire ID W_3_2 */}
        {hasIdDraft && (
          <button
            onClick={() => setLocalModal("id_draft")}
            className="text-xs px-2.5 py-1 rounded-md font-semibold border transition-all shrink-0 bg-purple-700/80 hover:bg-purple-600 text-purple-100 border-purple-500"
          >
            🃏 Choisir carte ({idDraftPending.length})
          </button>
        )}
        {/* Draft ID BI_2 */}
        {idRefreshPending && (
          <button
            onClick={() => setLocalModal("id_refresh")}
            className="text-xs px-2.5 py-1 rounded-md font-semibold border transition-all shrink-0 bg-teal-700/80 hover:bg-teal-600 text-teal-100 border-teal-500"
          >
            🔄 Draft ID
          </button>
        )}

        <div className="w-px h-4 bg-gray-700 shrink-0" />

        {/* Boutons rapides */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {onViewMyTiles && (
            <button onClick={onViewMyTiles} className="kmt-btn-ghost">📜 Mes tuiles</button>
          )}

          <button onClick={() => setShowIdModal(true)} className="relative" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <img src="/ID_dos.png" alt="Cartes ID" style={{ width: 26, height: 36, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
            {myIdCards.length > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -6, background: '#b45309', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: '50%', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                {myIdCards.length}
              </span>
            )}
          </button>
          {creatureIds.length > 0 && (
            <button
              onClick={() => setLocalModal("creatures")}
              className={`kmt-btn-ghost ${canEquipCreature ? "text-amber-400" : ""}`}
            >
              🐉 Créatures
              {equippableReserveIds.length > 0 && (
                <span className="ml-1 bg-amber-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {equippableReserveIds.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Fin de tour + Annuler */}
        <div className="ml-auto shrink-0 flex items-center gap-2">
          {canCancelTurn && (
            <button
              onClick={() => {
                if (confirmCancel) {
                  onCancelTurn?.();
                  setConfirmCancel(false);
                } else {
                  setConfirmCancel(true);
                  setTimeout(() => setConfirmCancel(false), 3000);
                }
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                fontWeight: 700,
                fontSize: 12,
                border: confirmCancel ? '1px solid #dc2626' : '1px solid #4a3410',
                background: confirmCancel ? '#7f1d1d' : '#1a1508',
                color: confirmCancel ? '#fca5a5' : '#a88a40',
                transition: 'all 0.15s',
              }}
            >
              {confirmCancel ? "Confirmer ?" : "↩ Annuler"}
            </button>
          )}
          <button
            onClick={onEndTurn}
            disabled={!canEndTurn}
            style={{
              padding: '6px 20px',
              borderRadius: 4,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.08em',
              border: canEndTurn ? '1px solid #3b82f6' : '1px solid #1e3a8a',
              background: canEndTurn ? '#1d4ed8' : '#172554',
              color: canEndTurn ? '#ffffff' : '#4b5563',
              boxShadow: canEndTurn ? '0 0 12px rgba(59,130,246,0.4)' : 'none',
              cursor: canEndTurn ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            FIN DE TOUR →
          </button>
        </div>
      </div>

      {/* ── Bande recrutement (conditionnelle) ── */}
      {(actionMode === "recruit" || actionMode === "recruit_golden") && (
        <div className="flex items-center justify-between px-4 py-1.5" style={{ background: actionMode === "recruit_golden" ? '#1a1200' : '#0a1a0e', borderBottom: `1px solid ${actionMode === "recruit_golden" ? '#3d2e00' : '#14532d'}` }}>
          <span className={`text-xs font-semibold ${actionMode === "recruit_golden" ? "text-yellow-300" : "text-emerald-300"}`}>
            {actionMode === "recruit_golden"
              ? "⭐ Jeton doré Recrutement — cliquez sur vos zones de cité"
              : "🏹 Mode recrutement — cliquez sur vos zones de cité"
            }
          </span>
          <button onClick={() => onActionActivate("recruit")} className="kmt-btn-gold-sm">
            Terminer
          </button>
        </div>
      )}

      {/* ── Bande déplacement (conditionnelle) ── */}
      {(actionMode === "move1" || actionMode === "move2" || actionMode === "move_golden") && (
        <div className={`flex items-center justify-between px-4 py-1.5 border-b ${
          actionMode === "move_golden"
            ? "bg-yellow-950/60 border-yellow-800/40"
            : "bg-blue-950/60 border-blue-800/40"
        }`}>
          <span className={`text-xs font-semibold ${actionMode === "move_golden" ? "text-yellow-300" : "text-blue-300"}`}>
            {actionMode === "move_golden"
              ? "⭐ Jeton doré — sélectionnez votre troupe"
              : "🏃 Mode déplacement — cliquez sur une troupe sur le plateau"
            }
          </span>
          <button onClick={onMoveCancel} className="kmt-btn-ghost text-xs">
            Annuler
          </button>
        </div>
      )}

      {/* ── Bande achat jeton doré (conditionnelle) ── */}
      {actionMode === "buy_golden" && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-yellow-950/60 border-b border-yellow-800/40">
          <span className="text-yellow-300 text-xs font-semibold">
            ⭐ Jeton doré Achat — choisissez une couleur (tuile coûte +1)
          </span>
          <button onClick={() => onSetActionMode(null)} className="kmt-btn-ghost text-xs">
            Annuler
          </button>
        </div>
      )}

      {/* ── Bande renforcement (conditionnelle) ── */}
      {actionMode === "renforcement" && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-cyan-950/60 border-b border-cyan-800/40">
          <span className="text-cyan-300 text-xs font-semibold">
            🔰 Renforcement — cliquez sur vos zones ({reinforcementPending} unité{reinforcementPending !== 1 ? "s" : ""} restante{reinforcementPending !== 1 ? "s" : ""})
          </span>
          <button onClick={() => onActionActivate("renforcement")} className="kmt-btn-gold-sm">
            Terminer
          </button>
        </div>
      )}

      {/* ── Bande 2 : actions + tuiles ── */}
      <div className="flex items-center gap-1 px-2 md:px-4 py-1 md:py-1.5 overflow-x-auto md:flex-wrap" style={{ backgroundImage: 'linear-gradient(rgba(6,4,2,0.85),rgba(6,4,2,0.85)),url(/ui/backend.png)', backgroundRepeat: 'repeat', backgroundSize: 'auto', borderTop: '1px solid #2a1e08' }}>

        {/* Groupes d'actions */}
        {[
          { label: "N1", actions: ACTIONS.level1 },
          { label: "N2", actions: ACTIONS.level2 },
          { label: "N3", actions: ACTIONS.level3 },
        ].map(({ label, actions }, gi) => (
          <div key={label} className="flex items-center gap-1 shrink-0">
            {gi > 0 && <div className="w-px h-5 mx-1.5" style={{ background: '#3a2a0c' }} />}
            <span className="mr-1" style={{ color: '#6B4C1E', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600 }}>{label}</span>
            {actions.map(a => {
              const used     = isUsed(a.id);
              const isBuy    = !!BUY_COLOR_MAP[a.id];
              const buyColor = BUY_COLOR_MAP[a.id];
              const img      = ACTION_IMG[a.id];
              if (isBuy) {
                if (!availableBuyColors.has(buyColor)) return null;
                const buyClickable = (actionMode === "buy_golden" && used) || (canPlayAction && !used);
                return (
                  <button
                    key={a.id}
                    onClick={() => handleActionClick(a)}
                    disabled={!buyClickable}
                    title={`Achat ${buyColor}`}
                    style={{
                      padding: 0, background: 'none', border: 'none', borderRadius: 4,
                      cursor: buyClickable ? 'pointer' : 'not-allowed',
                      opacity: used ? 0.2 : buyClickable ? 1 : 0.3,
                      filter: used ? 'grayscale(1)' : 'none',
                      transition: 'opacity 0.15s, filter 0.15s',
                    }}
                  >
                    <img src={img} alt={`Achat ${buyColor}`} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
                  </button>
                );
              }
              const clickable = canPlayAction && !used;
              return (
                <button
                  key={a.id}
                  onClick={() => handleActionClick(a)}
                  disabled={!clickable && !used}
                  title={a.label}
                  style={{
                    padding: 0, background: 'none', border: 'none', borderRadius: 4,
                    cursor: clickable ? 'pointer' : 'not-allowed',
                    opacity: used ? 0.2 : clickable ? 1 : 0.3,
                    filter: used ? 'grayscale(1)' : 'none',
                    transition: 'opacity 0.15s, filter 0.15s',
                  }}
                >
                  <img src={img} alt={a.label} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
                </button>
              );
            })}
          </div>
        ))}

        {/* Tuiles possédées (hors créatures) — masquées sur mobile */}
        {ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.type !== "creature") && (
          <>
            <div className="hidden md:block w-px h-5 mx-1" style={{ background: '#3a2a0c' }} />
            <div className="hidden md:flex gap-1 flex-wrap">
              {ownedTileIds.map(id => {
                const tile = POWER_TILES.find(t => t.id === id);
                if (!tile || tile.type === "creature") return null;
                const style = TILE_COLOR_STYLE[tile.color] || TILE_COLOR_STYLE.Noir;
                const typeInfo = TYPE_LABEL[tile.type] || { icon: "?" };
                return (
                  <div
                    key={id}
                    title={`${tile.name} — Niv.${tile.level}`}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold ${style.bg} ${style.border} ${style.text}`}
                  >
                    {getTileImageUrl(id)
                      ? <img src={getTileImageUrl(id)} alt={tile.name} className="w-5 h-5 object-cover rounded" />
                      : <span>{typeInfo.icon}</span>
                    }
                    <span className="max-w-[80px] truncate">{tile.name}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Créatures — masquées sur mobile */}
        {creatureIds.length > 0 && (
          <>
            <div className="hidden md:block w-px h-5 mx-1" style={{ background: '#3a2a0c' }} />
            <div className="hidden md:flex gap-1 flex-wrap">
              {creatureIds.map(id => {
                const tile = POWER_TILES.find(t => t.id === id);
                if (!tile) return null;
                const style = TILE_COLOR_STYLE[tile.color] || TILE_COLOR_STYLE.Noir;
                const zoneId = creatureZoneMap[id];
                const zone = zoneId ? BOARD_ZONES.find(z => z.id === zoneId) : null;
                return (
                  <div
                    key={id}
                    title={zone ? `${tile.name} @ ${zone.label}` : `${tile.name} — en réserve`}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold ${style.bg} ${style.border} ${style.text}`}
                  >
                    <div style={getCreatureSpriteStyle(tile.name, 20) || {}} />
                    <span className="max-w-[70px] truncate">{tile.name}</span>
                    {zone
                      ? <span className="text-gray-400 font-normal">@{zoneId}</span>
                      : <span className="text-amber-400 font-normal">réserve</span>
                    }
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Modaux locaux ── */}
      {showIdModal && (
        <IdCardModal
          cards={myIdCards}
          playableTimings={isMyTurn ? ["day", "any"] : []}
          onClose={() => setShowIdModal(false)}
          onPlay={isMyTurn ? handlePlayIdCard : undefined}
        />
      )}

      {localModal === "pyramid" && (
        <PyramidEvolveModal
          player={player}
          gameState={gameState}
          onConfirm={params => { onActionActivate("pyramid", params); setLocalModal(null); }}
          onClose={() => setLocalModal(null)}
        />
      )}

      {BUY_COLOR_MAP[localModal] && (
        <PowerTileModal
          color={BUY_COLOR_MAP[localModal]}
          gameState={gameState}
          session={session}
          isGoldenBuy={actionMode === "buy_golden"}
          onBuy={tileId => { onActionActivate(localModal, { tileId }); setLocalModal(null); }}
          onClose={() => setLocalModal(null)}
        />
      )}

      {localModal === "pyramid_free" && (
        <PyramidEvolveModal
          player={player}
          gameState={gameState}
          free={true}
          onConfirm={params => { onActionActivate("pyramid_free", params); setLocalModal(null); }}
          onClose={() => setLocalModal(null)}
        />
      )}

      {localModal === "id_draft" && hasIdDraft && (
        <IdDraftModal
          cards={idDraftPending}
          onPick={handlePickDraftCard}
          onClose={() => setLocalModal(null)}
        />
      )}

      {localModal === "id_refresh" && idRefreshPending && (
        <IdRefreshModal
          currentCards={myIdCards}
          onConfirm={handleIdRefresh}
          onClose={() => setLocalModal(null)}
        />
      )}

      {localModal === "creatures" && (
        <CreatureEquipModal
          playerId={player.id}
          playerColor={player.color}
          joinOrder={myJoinOrder}
          gameState={gameState}
          onConfirm={async assignments => {
            await handleEquipCreatures(assignments);
            setLocalModal(null);
          }}
          onClose={() => setLocalModal(null)}
        />
      )}
    </div>
  );
}

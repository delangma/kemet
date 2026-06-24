import { useState, useEffect, useRef } from "react";
import { db } from "../../firebase";
import { ref, onValue, update, get, set, onDisconnect, remove } from "firebase/database";
import PlayerSummary from "./PlayerSummary";
import PlayerTilesModal from "./PlayerTilesModal";
import MyZone from "./MyZone";
import { INITIAL_PLAYER_STATE, MAX_UNITS_PER_ZONE } from "../../constants/game";
import CombatModal from "../Combat/CombatModal";
import { buildIdDeck, buildPuDeck, buildJiDeck, buildJpDeck, dealCards } from "../../utils/deck";
import { getJuPositionsForLayout, getJiPositionsForLayout, getJpPositionsForLayout, E_TO_TOKENS } from "../../constants/taSetiPositions";
import { JI_CARDS } from "../../constants/jiCards";
import { PU_CARDS } from "../../constants/puCards";
import { JP_CARDS } from "../../constants/jpCards";
import TaSetiTokenModal from "./TaSetiTokenModal";
import { getValidPriestDestinations, getTraversedINode } from "../../constants/taSetiGraph";
import { TASETI_I_BONUSES, TASETI_E_BONUSES } from "../../constants/taSetiBonuses";
import DawnModal from "../Combat/DawnModal";
import NightModal from "./NightModal";
import Board from "../Board/board";
import SetupPhaseModal from "./SetupPhaseModal";
import DraftPhaseModal from "./DraftPhaseModal";
import PlacementPhaseModal from "./PlacementPhaseModal";
import MoveConfigModal from "./MoveConfigModal";
import CreatureEquipModal from "./CreatureEquipModal";
import { POWER_TILES, getPlayerPyramidLevel, TILE_COLOR_STYLE, TYPE_LABEL, getTileImageUrl } from "../../constants/powerTiles";
import { ZONE_ADJACENCY } from "../../constants/board";
import { getMovementCreatureBonus, getZoneMaxUnits, CREATURE_POWERS, hasEnemyCerbereInZone } from "../../constants/creaturePowers";
import TaSetiBoard from "./TaSetiBoard";
import ActionLogPanel from "./ActionLogPanel";
import FleeModal from "../Combat/FleeModal";
import CancelIdModal from "../Combat/CancelIdModal";
import IdRecoverModal from "../Combat/IdRecoverModal";
import { BOARD_ZONES } from "../../constants/board";
import { useSyncedMusic } from "../../hooks/useSyncedMusic";
import { useVolume } from "../../hooks/useVolume";
import VolumeControl from "../ui/VolumeControl";
import { aiChooseSetup, aiChooseDraftTile, aiChoosePlacement, aiDecideAction } from "../../ai/aiPlayer";

const GAME_MUSIC = [
  "/MP3/Ancient Egyptian Music - Valley of the Kings.mp3",
  "/MP3/Ancient Egyptian Music – Horus.mp3",
  "/MP3/Ancient Egyptian Music – Ra.mp3",
];

const PLAYER_COLOR_BG = {
  Rouge: "bg-red-600", Bleu: "bg-blue-600", Vert: "bg-emerald-600",
  Blanc: "bg-gray-200", Noir: "bg-gray-700",
};

const ACTION_TOAST_STYLE = {
  tile:    { borderColor: "rgba(217,119,6,0.7)",  glow: "rgba(217,119,6,0.18)",  icon: "🏛",  label: null        },
  attack:  { borderColor: "rgba(220,38,38,0.7)",  glow: "rgba(220,38,38,0.18)",  icon: "⚔",  label: "Attaque"   },
  move:    { borderColor: "rgba(37,99,235,0.7)",  glow: "rgba(37,99,235,0.18)",  icon: "→",  label: "Déplacement" },
  recruit: { borderColor: "rgba(22,163,74,0.7)",  glow: "rgba(22,163,74,0.18)",  icon: "⬆",  label: "Recrutement" },
  prayer:  { borderColor: "rgba(202,138,4,0.7)",  glow: "rgba(202,138,4,0.18)",  icon: "☀",  label: "Prière"    },
  default: { borderColor: "rgba(100,100,100,0.5)", glow: "transparent",           icon: "⚡", label: null        },
};
const PLAYER_DOT_CSS = {
  Rouge: "#ef4444", Bleu: "#3b82f6", Vert: "#22c55e", Blanc: "#e5e7eb", Noir: "#6b7280",
};

function ActionToast({ notif }) {
  const meta = notif.meta || {};
  const s = ACTION_TOAST_STYLE[meta.type] || ACTION_TOAST_STYLE.default;
  const dot = PLAYER_DOT_CSS[notif.color] || "#6b7280";
  const baseStyle = {
    minWidth: 280, maxWidth: 420, background: "rgba(8,6,3,0.97)",
    borderColor: s.borderColor, boxShadow: `0 0 28px ${s.glow}, 0 4px 24px rgba(0,0,0,0.7)`,
  };

  if (meta.type === "tile" && meta.tileId) {
    const tile = POWER_TILES.find(t => t.id === meta.tileId);
    const tileStyle = TILE_COLOR_STYLE[tile?.color] || TILE_COLOR_STYLE.Noir;
    const typeInfo = TYPE_LABEL[tile?.type] || { icon: "✦" };
    const imgUrl = getTileImageUrl(meta.tileId);
    return (
      <div className="fixed top-16 left-1/2 z-50 pointer-events-none"
        style={{ transform: "translateX(-50%)", animation: "fadeSlideDown 0.35s ease-out" }}>
        <div className="flex items-center gap-3 rounded-xl border shadow-2xl px-3 py-3" style={baseStyle}>
          {imgUrl
            ? <img src={imgUrl} alt={tile?.name} className="w-16 h-16 object-cover rounded-lg shrink-0 border border-gray-700" />
            : <div className={`w-14 h-14 flex items-center justify-center rounded-lg border shrink-0 text-2xl ${tileStyle.bg} ${tileStyle.border}`}>{typeInfo.icon}</div>
          }
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dot }} />
              <span className="font-bold text-white text-sm">{notif.playerName}</span>
              <span className="text-gray-500 text-xs">acquiert</span>
            </div>
            <p className={`font-bold text-base leading-tight ${tileStyle.text}`}>{tile?.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{typeInfo.icon} {tile?.color} · Niv.{tile?.level} · {tile?.cost} Ank</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-16 left-1/2 z-50 pointer-events-none"
      style={{ transform: "translateX(-50%)", animation: "fadeSlideDown 0.35s ease-out" }}>
      <div className="flex items-center gap-3 rounded-xl border shadow-2xl px-4 py-3" style={baseStyle}>
        <span className="text-2xl shrink-0 select-none">{s.icon}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dot }} />
            <span className="font-bold text-white text-sm">{notif.playerName}</span>
          </div>
          <p className="text-gray-300 text-xs leading-snug">{notif.text}</p>
        </div>
      </div>
    </div>
  );
}

export default function GameScreen({ session }) {
  const { roomCode, playerId, allPlayers, isTestMode } = session;
  const [volume, setVolume] = useVolume();
  useSyncedMusic(GAME_MUSIC, `rooms/${roomCode}/gameMusic`, volume);
  const [gameState, setGameState] = useState(null);
  const [showTaSeti, setShowTaSeti] = useState(false);
  const [showCombat, setShowCombat] = useState(false);
  const [combatData, setCombatData] = useState(null);
  const [showDawn, setShowDawn] = useState(false);
  const [currentPlayers, setCurrentPlayers] = useState(allPlayers);
  const [showNight, setShowNight] = useState(false);
  const [actionMode, setActionMode] = useState(null);
  const [moveConfig, setMoveConfig] = useState(null);
  const [moveState, setMoveState] = useState(null);
  const [pendingCerbereId, setPendingCerbereId] = useState(null); // placement immédiat après achat
  const [testViewPlayerId, setTestViewPlayerId] = useState(playerId);
  const [pendingMoveAction, setPendingMoveAction] = useState(null);
  const [selectedPriestIndex, setSelectedPriestIndex] = useState(null);
  const [fleeOffer, setFleeOffer] = useState(null);
  const [pendingIdCard, setPendingIdCard] = useState(null);
  const [localTurnHistory, setLocalTurnHistory] = useState(null);
  const [viewTilesPlayer, setViewTilesPlayer] = useState(null);
  const [actionNotif, setActionNotif] = useState(null); // { playerName, color, text, meta }
  const [pendingTokenPickup, setPendingTokenPickup] = useState(null); // { priestIndex, tokens: [{nodeId, cardId}] }
  const prevCombatRef = useRef(null);
  const prevTurnPlayerIdRef = useRef(null);
  const latestActionKeyRef = useRef(null);
  const aiTurnInProgressRef = useRef(false);

  const effectivePlayerId = isTestMode ? testViewPlayerId : playerId;
  const me = currentPlayers.find(p => p.id === effectivePlayerId) ?? allPlayers.find(p => p.id === effectivePlayerId);

  // Auto-efface la notification d'action
  useEffect(() => {
    if (!actionNotif) return;
    const duration = actionNotif.meta?.type === "tile" ? 4500 : 3200;
    const t = setTimeout(() => setActionNotif(null), duration);
    return () => clearTimeout(t);
  }, [actionNotif]);

  // Écoute actionLog Firebase → affiche un toast pour les nouvelles actions avec meta
  useEffect(() => {
    const logRef = ref(db, `rooms/${roomCode}/actionLog`);
    let initialized = false;
    const unsubscribe = onValue(logRef, snapshot => {
      if (!snapshot.exists()) { initialized = true; return; }
      const data = snapshot.val();
      const entries = Object.entries(data).sort(([a], [b]) => Number(a) - Number(b));
      const [latestKey, latestEntry] = entries[entries.length - 1];
      if (!initialized) {
        latestActionKeyRef.current = latestKey;
        initialized = true;
        return;
      }
      if (latestKey === latestActionKeyRef.current) return;
      latestActionKeyRef.current = latestKey;
      if (latestEntry?.meta) setActionNotif(latestEntry);
    });
    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);
  const opponents = currentPlayers.filter(p => p.id !== effectivePlayerId);

	useEffect(() => {
	  // Annule la suppression automatique à la déconnexion
	  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
	  onDisconnect(playerRef).cancel();
	}, []);

  // Initialise l'état du jeu si pas encore fait
	useEffect(() => {
	  const stateRef = ref(db, `rooms/${roomCode}/gameState`);
	  get(stateRef).then(snapshot => {
		if (!snapshot.exists()) {
		  const deck = buildIdDeck();
		  const sortedPlayers = [...allPlayers].sort((a, b) => a.order - b.order);
		  const initialState = {
			players: {},
			idDeck: deck,
			idDiscard: [],
			currentTurnPlayerId: sortedPlayers[0].id,
			phase: "setup",
			setupOrder: sortedPlayers.map(p => p.id),
			setupIndex: 0,
			availableTileIds: POWER_TILES.map(t => t.id),
			taSetiPriests: {},
		  };
		  const taSetiLayout = isTestMode ? ['A', 'A', 'B', 'B'] : [1,2,3,4].map(() => Math.random() < 0.5 ? 'A' : 'B');
		  initialState.taSetiLayout = taSetiLayout;
		  const puDeck = buildPuDeck();
		  const juSlots = getJuPositionsForLayout(taSetiLayout);
		  const puAssignment = {};
		  juSlots.forEach((juid, idx) => { puAssignment[juid] = puDeck[idx]; });
		  initialState.puAssignment = puAssignment;
		  initialState.puSupply = puDeck.slice(juSlots.length);

		  const jiDeck = buildJiDeck();
		  const jiSlots = getJiPositionsForLayout(taSetiLayout);
		  const jiAssignment = {};
		  jiSlots.forEach((jiid, idx) => { jiAssignment[jiid] = jiDeck[idx]; });
		  initialState.jiAssignment = jiAssignment;
		  initialState.jiSupply = jiDeck.slice(jiSlots.length);

		  const jpDeck = buildJpDeck();
		  const jpSlots = getJpPositionsForLayout(taSetiLayout);
		  const jpAssignment = {};
		  jpSlots.forEach((jpid, idx) => { jpAssignment[jpid] = jpDeck[idx]; });
		  initialState.jpAssignment = jpAssignment;
		  initialState.jpSupply = jpDeck.slice(jpSlots.length);
		  let remaining = deck;

		  allPlayers.forEach(p => {
			const { hand, remaining: newRemaining } = dealCards(remaining, 2);
			remaining = newRemaining;
			initialState.players[p.id] = {
			  ...INITIAL_PLAYER_STATE,
			  idCards: hand,
			  availableCombatCards: [1,2,3,4,5,6,7,8],
			};
			initialState.idDeck = remaining;
		  });

		  update(ref(db, `rooms/${roomCode}`), { gameState: initialState });
		}
	  });
	}, []);

  // Migration : initialise ou complète les assignments manquants selon le layout actuel
  useEffect(() => {
    if (!gameState || !gameState.taSetiLayout) return;
    const patch = {};

    const juSlots = getJuPositionsForLayout(gameState.taSetiLayout);
    const puAssignment = { ...(gameState.puAssignment || {}) };
    const puMissing = juSlots.filter(id => !puAssignment[id]);
    if (puMissing.length > 0) {
      const puDeck = buildPuDeck();
      puMissing.forEach((id, idx) => { puAssignment[id] = puDeck[idx % puDeck.length]; });
      patch.puAssignment = puAssignment;
    }

    const jiSlots = getJiPositionsForLayout(gameState.taSetiLayout);
    const jiAssignment = { ...(gameState.jiAssignment || {}) };
    const jiMissing = jiSlots.filter(id => !jiAssignment[id]);
    if (jiMissing.length > 0) {
      const jiDeck = buildJiDeck();
      jiMissing.forEach((id, idx) => { jiAssignment[id] = jiDeck[idx % jiDeck.length]; });
      patch.jiAssignment = jiAssignment;
    }

    const jpSlots = getJpPositionsForLayout(gameState.taSetiLayout);
    const jpAssignment = { ...(gameState.jpAssignment || {}) };
    const jpMissing = jpSlots.filter(id => !jpAssignment[id]);
    if (jpMissing.length > 0) {
      const jpDeck = buildJpDeck();
      jpMissing.forEach((id, idx) => { jpAssignment[id] = jpDeck[idx % jpDeck.length]; });
      patch.jpAssignment = jpAssignment;
    }

    if (Object.keys(patch).length > 0) update(ref(db, `rooms/${roomCode}/gameState`), patch);
  }, [gameState?.taSetiLayout, JSON.stringify(gameState?.puAssignment), JSON.stringify(gameState?.jiAssignment), JSON.stringify(gameState?.jpAssignment)]);

  // Migration : initialise taSetiPriestPositions si absent
  useEffect(() => {
    if (!gameState || gameState.taSetiPriestPositions) return;
    const positions = {};
    currentPlayers.forEach(p => {
      positions[p.id] = { '0': '', '1': '', '2': '' };
    });
    update(ref(db, `rooms/${roomCode}/gameState`), { taSetiPriestPositions: positions });
  }, [!!gameState, !!gameState?.taSetiPriestPositions]);

  // Migration : ajoute taSetiLayout si absent + force BBAA en mode test
  useEffect(() => {
    if (!gameState) return;
    const current = gameState.taSetiLayout;
    const testLayout = ['A', 'A', 'B', 'B'];
    const needsInit = !current;
    const needsTestOverride = isTestMode && JSON.stringify(current) !== JSON.stringify(testLayout);
    if (!needsInit && !needsTestOverride) return;
    update(ref(db, `rooms/${roomCode}/gameState`), {
      taSetiLayout: isTestMode ? testLayout : [1,2,3,4].map(() => Math.random() < 0.5 ? 'A' : 'B'),
    });
  }, [!!gameState, JSON.stringify(gameState?.taSetiLayout)]);

  // Écoute l'état du jeu en temps réel
  useEffect(() => {
    const unsubscribe = onValue(ref(db, `rooms/${roomCode}/gameState`), snapshot => {
      if (snapshot.exists()) setGameState(snapshot.val());
    });
    return () => unsubscribe();
  }, [roomCode]);

	// Ouvre/ferme automatiquement la modale combat
	useEffect(() => {
	  const unsubscribe = onValue(ref(db, `rooms/${roomCode}/combat`), snapshot => {
		if (snapshot.exists()) {
		  const data = snapshot.val();
		  prevCombatRef.current = data;
		  setCombatData(data);
		  setShowCombat(true);
		} else {
		  if (prevCombatRef.current !== null) markInfoEvent();
		  prevCombatRef.current = null;
		  setCombatData(null);
		  setShowCombat(false);
		}
	  });
	  return () => unsubscribe();
	}, [roomCode]);

	// Offre de fuite secrète
	useEffect(() => {
	  const unsubscribe = onValue(ref(db, `rooms/${roomCode}/fleeOffer`), snapshot => {
	    setFleeOffer(snapshot.exists() ? snapshot.val() : null);
	  });
	  return () => unsubscribe();
	}, [roomCode]);

	// Résultat de fuite — restaure le moveState de l'attaquant
	useEffect(() => {
	  const unsubscribe = onValue(ref(db, `rooms/${roomCode}/fleeResult`), snapshot => {
	    if (!snapshot.exists()) return;
	    const result = snapshot.val();
	    if (result.attackerId !== effectivePlayerId) return;
	    if (result.attackerPointsRemaining > 0) {
	      const md = result.attackerMoveData || {};
	      setActionMode("move");
	      setMoveState({
	        currentZoneId: result.zoneId,
	        pointsRemaining: result.attackerPointsRemaining,
	        count: md.count ?? 1,
	        creatureId: md.creatureId ?? null,
	        creatureGoes: md.creatureGoes ?? false,
	        creatureId2: md.creatureId2 ?? null,
	        creatureGoes2: md.creatureGoes2 ?? false,
	        sourceZoneId: md.sourceZoneId ?? result.zoneId,
	        forbiddenZoneId: result.forbiddenZoneId ?? null,
	      });
	    }
	    update(ref(db, "/"), { [`rooms/${roomCode}/fleeResult`]: null });
	  });
	  return () => unsubscribe();
	}, [roomCode, effectivePlayerId]);

	// Carte ID en attente (pour annulation)
	useEffect(() => {
	  const unsubscribe = onValue(ref(db, `rooms/${roomCode}/pendingIdCard`), snapshot => {
	    setPendingIdCard(snapshot.exists() ? snapshot.val() : null);
	  });
	  return () => unsubscribe();
	}, [roomCode]);

	// Côté acteur : applique l'effet dès que tous les adversaires ont répondu
	useEffect(() => {
	  if (!pendingIdCard) return;
	  // En mode test un seul client gère tous les joueurs — pas de restriction sur effectivePlayerId
	  if (!isTestMode && pendingIdCard.actorId !== effectivePlayerId) return;
	  if (pendingIdCard.cancelled) {
	    update(ref(db, "/"), { [`rooms/${roomCode}/pendingIdCard`]: null });
	    return;
	  }
	  const responses = Object.values(pendingIdCard.pendingResponses || {});
	  if (responses.length > 0 && responses.every(v => v === "pass")) {
	    applyDayIdCardEffect(pendingIdCard.cardData, pendingIdCard.actorId).then(() => {
	      update(ref(db, "/"), { [`rooms/${roomCode}/pendingIdCard`]: null });
	    });
	  }
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [JSON.stringify(pendingIdCard)]);

  // Marche Forcée : ajoute le bonus de mouvement au moveState dès qu'il apparaît
  useEffect(() => {
    const bonus = gameState?.players?.[effectivePlayerId]?.pendingMoveBonus ?? 0;
    if (bonus > 0 && moveState) {
      setMoveState(prev => prev ? { ...prev, pointsRemaining: prev.pointsRemaining + bonus } : prev);
      update(ref(db, "/"), { [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/pendingMoveBonus`]: null });
    }
  }, [gameState?.players?.[effectivePlayerId]?.pendingMoveBonus]);

  // Recrutement de Victoire : entre en mode placement si des unités restent à déployer
  useEffect(() => {
    const pending = gameState?.players?.[effectivePlayerId]?.victoryRecruitPending ?? 0;
    if (pending > 0 && actionMode !== "victoryRecruit") setActionMode("victoryRecruit");
    else if (pending <= 0 && actionMode === "victoryRecruit") setActionMode(null);
  }, [gameState?.players?.[effectivePlayerId]?.victoryRecruitPending]);

  // Ta-Seti recrutement bonus : entre en mode placement
  useEffect(() => {
    const pending = gameState?.players?.[effectivePlayerId]?.tasetiRecruitPending ?? 0;
    if (pending > 0 && actionMode !== "tasetiRecruit") setActionMode("tasetiRecruit");
    else if (pending <= 0 && actionMode === "tasetiRecruit") setActionMode(null);
  }, [gameState?.players?.[effectivePlayerId]?.tasetiRecruitPending]);

  // Pluie de Feu : entre en mode ciblage ennemi
  useEffect(() => {
    const pending = gameState?.players?.[effectivePlayerId]?.pendingDestroyUnit ?? false;
    if (pending && actionMode !== "destroyUnit") setActionMode("destroyUnit");
    else if (!pending && actionMode === "destroyUnit") setActionMode(null);
  }, [gameState?.players?.[effectivePlayerId]?.pendingDestroyUnit]);

  // Retourne le prêtre en réserve quand sa troupe est complètement éliminée
  useEffect(() => {
    if (!gameState?.boardPriests) return;
    const bu = gameState.boardUnits || {};
    const bp = gameState.boardPriests || {};
    const updates = {};
    Object.entries(bp).forEach(([zoneId, colorMap]) => {
      Object.entries(colorMap || {}).forEach(([color, priestData]) => {
        if (!priestData) return;
        if ((bu[zoneId]?.[color] || 0) > 0) return;
        const player = currentPlayers.find(p => p.color === color);
        if (!player) return;
        const { priestIndex } = priestData;
        if (gameState?.taSetiPriestPositions?.[player.id]?.[priestIndex] !== 'BOARD') return;
        updates[`rooms/${roomCode}/gameState/boardPriests/${zoneId}/${color}`] = null;
        updates[`rooms/${roomCode}/gameState/taSetiPriestPositions/${player.id}/${priestIndex}`] = '';
      });
    });
    if (Object.keys(updates).length > 0) update(ref(db, "/"), updates);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(gameState?.boardUnits), JSON.stringify(gameState?.boardPriests)]);


	// Ouvre/ferme automatiquement la modale Aube
	useEffect(() => {
	  const unsubscribe = onValue(ref(db, `rooms/${roomCode}/dawn`), snapshot => {
		if (snapshot.exists()) {
		  setShowDawn(true);
		} else {
		  setShowDawn(false);
		}
	  });
	  return () => unsubscribe();
	}, [roomCode]);

	useEffect(() => {
	  const unsubscribe = onValue(ref(db, `rooms/${roomCode}/players`), snapshot => {
		if (!snapshot.exists()) return;
		const players = snapshot.val();
		const updated = Object.values(players).sort((a, b) => a.order - b.order);
		setCurrentPlayers(updated);
	  });
	  return () => unsubscribe();
	}, [roomCode]);

  // Sauvegarde un snapshot au début du tour — en Firebase pour survivre aux rechargements
  useEffect(() => {
    if (!gameState) return;
    let cancelled = false;
    const currentTurnId = gameState.currentTurnPlayerId;
    if (currentTurnId === prevTurnPlayerIdRef.current) return;
    prevTurnPlayerIdRef.current = currentTurnId;
    if (currentTurnId !== effectivePlayerId) {
      setLocalTurnHistory(null);
      return;
    }
    // Vérifie si un snapshot existe déjà (rechargement de page en cours de tour)
    get(ref(db, `rooms/${roomCode}/turnSnapshot`)).then(snap => {
      if (cancelled) return;
      const existing = snap.exists() ? snap.val() : null;
      if (existing?.playerId === effectivePlayerId) {
        // Rechargement : restaure le snapshot existant
        setLocalTurnHistory({
          startState: existing.startState,
          lastInfoState: existing.lastInfoState || null,
        });
      } else {
        // Nouveau tour : crée le snapshot
        set(ref(db, `rooms/${roomCode}/turnSnapshot`), {
          playerId: effectivePlayerId,
          startState: gameState,
          lastInfoState: null,
        });
        setLocalTurnHistory({ startState: gameState, lastInfoState: null });
      }
    });
    return () => { cancelled = true; };
  }, [gameState?.currentTurnPlayerId, effectivePlayerId]);

  function canTakeAction() {
    if (!gameState) return false;
    const s = gameState.players?.[effectivePlayerId] || {};
    if ((s.actionsThisTurn ?? 0) >= 1) return false;
    if ((s.tokens ?? 5) <= 0) return false;
    return true;
  }

  async function handleSetActionMode(mode) {
    if (!canTakeAction()) return;
    if (mode === "recruit") {
      const myState = gameState?.players?.[effectivePlayerId] || {};
      const hasRecruitBonus = (myState.ownedTileIds || []).some(
        id => POWER_TILES.find(t => t.id === id)?.name === "Recrutement + 2"
      );
      if (hasRecruitBonus) {
        await update(ref(db, `rooms/${roomCode}/gameState/players/${effectivePlayerId}`), {
          recruitFreeRemaining: 2,
        });
      }
    }
    if ((mode === "move1" || mode === "move2") && gameState?.taSetiLayout) {
      const positions = getPriestPositions(effectivePlayerId);
      const layout = gameState.taSetiLayout;
      const canAdvance = positions.some(pos => getValidPriestDestinations(pos, layout).length > 0);
      if (canAdvance) {
        setPendingMoveAction(mode);
        setShowTaSeti(true);
        return;
      }
    }
    setActionMode(mode);
  }

  async function handleActionActivate(actionId, params = {}) {
    if (actionId === "recruit" && actionMode === "recruit_golden") {
      setActionMode(null);
      await update(ref(db, `rooms/${roomCode}/gameState/players/${effectivePlayerId}`), {
        recruitFreeRemaining: 0,
      });
      return;
    }
    if (actionId === "renforcement") {
      setActionMode(null);
      return;
    }
    if (["buy_red", "buy_blue", "buy_white", "buy_black"].includes(actionId) && actionMode === "buy_golden") {
      setActionMode(null);
      const myState = gameState.players?.[effectivePlayerId] || {};
      const { tileId } = params;
      const tile = POWER_TILES.find(t => t.id === tileId);
      if (!tile) return;
      const currentAnk = myState.ank ?? 7;
      const availableTileIds = gameState.availableTileIds || [];
      if (!availableTileIds.includes(tileId)) return;
      const ownedTileIds = myState.ownedTileIds || [];
      const ownedNames = ownedTileIds.map(id => POWER_TILES.find(t => t.id === id)?.name).filter(Boolean);
      if (ownedNames.includes(tile.name)) return;
      const pyramidLevel = getPlayerPyramidLevel(effectivePlayerId, tile.color, gameState.pyramids || {});
      if (pyramidLevel < tile.level) return;
      if (tile.secondaryColor) {
        const secLevel = getPlayerPyramidLevel(effectivePlayerId, tile.secondaryColor, gameState.pyramids || {});
        if (secLevel < tile.secondaryLevel) return;
      }
      const hasCoutReducG = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Cout Pouvoir -1");
      const hasAnkReducG = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Réduction d'ank");
      const effectiveCost = Math.max(0, tile.cost + 1 - (hasCoutReducG ? 1 : 0) - (hasAnkReducG ? 1 : 0));
      if (currentAnk < effectiveCost) return;
      const gbUpdates = {};
      gbUpdates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/usedActions`] = [...(myState.usedActions || []), actionId];
      gbUpdates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] = currentAnk - effectiveCost;
      gbUpdates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ownedTileIds`] = [...ownedTileIds, tileId];
      gbUpdates[`rooms/${roomCode}/gameState/availableTileIds`] = availableTileIds.filter(id => id !== tileId);
      const creaturePowerG = tile.type === "creature" ? CREATURE_POWERS[tile.name] : null;
      const vpGainG = creaturePowerG?.vpOnPurchase ?? tile.vpOnPurchase ?? 0;
      if (vpGainG > 0) {
        gbUpdates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/vpPermanent`] = (myState.vpPermanent ?? 0) + vpGainG;
      }
      const ankOnPurchaseG = tile.ankOnPurchase ?? 0;
      if (ankOnPurchaseG > 0) {
        const base = gbUpdates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] ?? (currentAnk - effectiveCost);
        gbUpdates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] = Math.min(11, base + ankOnPurchaseG);
      }
      if (tile.name.toLowerCase().includes('doré') || tile.id === 'R_4_1') {
        gbUpdates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/goldenTokenUsed`] = true;
      }
      await update(ref(db, "/"), gbUpdates);
      await logTileBuy(effectivePlayerId, tile);
      return;
    }
    if (actionId === "pyramid_free") {
      const myState = gameState.players?.[effectivePlayerId] || {};
      const pendingCount = myState.pyramidUpgradePending ?? 0;
      if (pendingCount <= 0) return;
      const { slotId } = params;
      const pyr = gameState.pyramids?.[slotId] || {};
      if (!pyr.color || (pyr.level ?? 0) >= 4) return;
      const newLvlFree = (pyr.level ?? 0) + 1;
      const freeUpdates = {
        [`rooms/${roomCode}/gameState/pyramids/${slotId}/level`]: newLvlFree,
        [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/pyramidUpgradePending`]: pendingCount - 1,
      };
      if (newLvlFree === 4) {
        freeUpdates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/vpPermanent`] = (myState.vpPermanent ?? 0) + 1;
      }
      await update(ref(db, "/"), freeUpdates);
      return;
    }
    if (actionId === "recruit") setActionMode(null);
    if (!canTakeAction()) return;
    const myState = gameState.players?.[effectivePlayerId] || {};
    const usedActions = myState.usedActions || [];
    const myColor = me?.color ?? session.playerColor;

    const updates = {
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/usedActions`]: [...usedActions, actionId],
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/tokens`]: (myState.tokens ?? 5) - 1,
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/actionsThisTurn`]: (myState.actionsThisTurn ?? 0) + 1,
    };

    // Fin d'action recruter : reset unités gratuites restantes
    if (actionId === "recruit") {
      updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/recruitFreeRemaining`] = 0;
    }

    const prayerBonus = (myState.ownedTileIds || []).filter(
      id => POWER_TILES.find(t => t.id === id)?.name === "Priere +1 ank"
    ).length;
    const hasDayAnk = (myState.ownedTileIds || []).some(
      id => POWER_TILES.find(t => t.id === id)?.name === "+1 d'Ank en journée"
    );
    if (actionId === "prayer2") {
      const gain = 2 + prayerBonus;
      updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] = Math.min(11, (myState.ank ?? 7) + gain + (hasDayAnk ? gain : 0));
    } else if (actionId === "prayer3") {
      const gain = 3 + prayerBonus;
      updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] = Math.min(11, (myState.ank ?? 7) + gain + (hasDayAnk ? gain : 0));
    } else if (actionId === "pyramid") {
      const { slotId, color: newColor } = params;
      const pyr = gameState.pyramids?.[slotId] || {};
      const currentAnk = myState.ank ?? 7;
      const pyramidCost = (from, to) => (to * (to + 1)) / 2 - (from * (from + 1)) / 2;
      const hasReductionPyramide = (myState.ownedTileIds || []).some(
        id => POWER_TILES.find(t => t.id === id)?.name === "Réduction pyramide"
      );
      const hasAnkReducPyr = (myState.ownedTileIds || []).some(
        id => POWER_TILES.find(t => t.id === id)?.name === "Réduction d'ank"
      );
      const currentTokens = myState.tokens ?? 5;
      if (!pyr.color) {
        if (!newColor || !params.level) return;
        const levelsUp = params.level; // depuis 0
        if (currentTokens < levelsUp) return;
        const rawCost = pyramidCost(0, params.level);
        const cost = Math.max(0, rawCost - (hasReductionPyramide ? params.level : 0) - (hasAnkReducPyr ? 1 : 0));
        if (currentAnk < cost) return;
        updates[`rooms/${roomCode}/gameState/pyramids/${slotId}/color`] = newColor;
        updates[`rooms/${roomCode}/gameState/pyramids/${slotId}/level`] = params.level;
        updates[`rooms/${roomCode}/gameState/pyramids/${slotId}/ownerId`] = effectivePlayerId;
        updates[`rooms/${roomCode}/gameState/pyramids/${slotId}/controllerId`] = effectivePlayerId;
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] = currentAnk - cost;
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/tokens`] = currentTokens - levelsUp;
        if (params.level === 4) {
          updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/vpPermanent`] = (myState.vpPermanent ?? 0) + 1;
        }
      } else {
        const newLevel = params.level ?? (pyr.level ?? 0) + 1;
        if (newLevel > 4 || newLevel <= (pyr.level ?? 0)) return;
        const levelsUp = newLevel - (pyr.level ?? 0);
        if (currentTokens < levelsUp) return;
        const rawCost = pyramidCost(pyr.level ?? 0, newLevel);
        const cost = Math.max(0, rawCost - (hasReductionPyramide ? 1 : 0) - (hasAnkReducPyr ? 1 : 0));
        if (currentAnk < cost) return;
        updates[`rooms/${roomCode}/gameState/pyramids/${slotId}/level`] = newLevel;
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] = currentAnk - cost;
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/tokens`] = currentTokens - levelsUp;
        if (newLevel === 4) {
          updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/vpPermanent`] = (myState.vpPermanent ?? 0) + 1;
        }
      }
    } else if (actionId === "move1" || actionId === "move2") {
      const { fromZone, toZone, count, creatureGoesWithMove } = params;
      const col = me?.color ?? session.playerColor;
      const fromCurrent = gameState.boardUnits?.[fromZone]?.[col] || 0;
      if (count > fromCurrent) return;
      const newFromCount = fromCurrent - count;
      updates[`rooms/${roomCode}/gameState/boardUnits/${fromZone}/${col}`] = newFromCount;
      updates[`rooms/${roomCode}/gameState/boardUnits/${toZone}/${col}`] = (gameState.boardUnits?.[toZone]?.[col] || 0) + count;

      // Creature movement
      const creatureId = gameState.creatureAssignments?.[fromZone]?.[col];
      if (creatureId) {
        const allMoved = newFromCount === 0;
        const creatureGoes = allMoved || creatureGoesWithMove === true;
        if (creatureGoes) {
          updates[`rooms/${roomCode}/gameState/creatureAssignments/${fromZone}/${col}`] = null;
          updates[`rooms/${roomCode}/gameState/creatureAssignments/${toZone}/${col}`] = creatureId;
        } else if (newFromCount === 0) {
          // Creature can't stay — no troops left — returns to reserve
          updates[`rooms/${roomCode}/gameState/creatureAssignments/${fromZone}/${col}`] = null;
        }
      }
    } else if (["buy_red", "buy_blue", "buy_white", "buy_black"].includes(actionId)) {
      const { tileId } = params;
      const tile = POWER_TILES.find(t => t.id === tileId);
      if (!tile) return;
      const currentAnk = myState.ank ?? 7;
      const availableTileIds = gameState.availableTileIds || [];
      if (!availableTileIds.includes(tileId)) return;
      const ownedTileIds = myState.ownedTileIds || [];
      const ownedNames = ownedTileIds.map(id => POWER_TILES.find(t => t.id === id)?.name).filter(Boolean);
      if (ownedNames.includes(tile.name)) return;
      const pyramidLevel = getPlayerPyramidLevel(effectivePlayerId, tile.color, gameState.pyramids || {});
      if (pyramidLevel < tile.level) return;
      if (tile.secondaryColor) {
        const secLevel = getPlayerPyramidLevel(effectivePlayerId, tile.secondaryColor, gameState.pyramids || {});
        if (secLevel < tile.secondaryLevel) return;
      }
      const hasCoutReduc = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Cout Pouvoir -1");
      const hasAnkReduc = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Réduction d'ank");
      const effectiveCost = Math.max(0, tile.cost - (hasCoutReduc ? 1 : 0) - (hasAnkReduc ? 1 : 0));
      if (currentAnk < effectiveCost) return;
      updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] = currentAnk - effectiveCost;
      updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ownedTileIds`] = [...ownedTileIds, tileId];
      updates[`rooms/${roomCode}/gameState/availableTileIds`] = availableTileIds.filter(id => id !== tileId);

      // Unités gratuites à l'achat (ex : Recrutement +2) — placées dans la cité
      if (tile.unitsOnPurchase) {
        const joinOrder = allPlayers.find(p => p.id === effectivePlayerId)?.joinOrder;
        if (joinOrder) {
          let reserve = myState.unitsReserve ?? 0;
          let toPlace = Math.min(tile.unitsOnPurchase, reserve);
          for (const n of ['1', '2', '3']) {
            if (toPlace <= 0) break;
            const zid = `J${joinOrder}C${n}`;
            const current = updates[`rooms/${roomCode}/gameState/boardUnits/${zid}/${myColor}`]
              ?? (gameState.boardUnits?.[zid]?.[myColor] || 0);
            if (current < MAX_UNITS_PER_ZONE) {
              updates[`rooms/${roomCode}/gameState/boardUnits/${zid}/${myColor}`] = current + 1;
              reserve--;
              toPlace--;
            }
          }
          updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/unitsReserve`] = reserve;
        }
      }

      // Unités supplémentaires en réserve à l'achat (ex : Unité supplémentaire)
      if (tile.reserveOnPurchase) {
        const base = updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/unitsReserve`] ?? (myState.unitsReserve ?? 0);
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/unitsReserve`] = base + tile.reserveOnPurchase;
      }

      // Bonus VP à l'achat (créatures ex: Sphinx, ou tuiles vp ex: Point Rouge Majeur)
      const creaturePower = tile.type === "creature" ? CREATURE_POWERS[tile.name] : null;
      const vpGain = creaturePower?.vpOnPurchase ?? tile.vpOnPurchase ?? 0;
      if (vpGain > 0) {
        const currentVP = myState.vpPermanent ?? 0;
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/vpPermanent`] = currentVP + vpGain;
      }

      // Bonus Ank à l'achat (ex : "2 Ank")
      const ankOnPurchase = tile.ankOnPurchase ?? 0;
      if (ankOnPurchase > 0) {
        const baseAnk = updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] ?? (currentAnk - effectiveCost);
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] = Math.min(11, baseAnk + ankOnPurchase);
      }

      // Bonus cartes ID à l'achat (ex : Momie, +1 carte ID)
      const idCardsOnPurchase = creaturePower?.idCardsOnPurchase ?? tile.idCardsOnPurchase ?? 0;
      if (idCardsOnPurchase > 0) {
        const deck = [...(gameState.idDeck || [])];
        if (deck.length > 0) {
          const { hand, remaining } = dealCards(deck, idCardsOnPurchase);
          updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/idCards`] = [...(myState.idCards || []), ...hand];
          updates[`rooms/${roomCode}/gameState/idDeck`] = remaining;
        }
      }

      // Augmentation pyramide : +1 amélioration gratuite à l'achat
      if (tile.name === "Augmentation pyramide") {
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/pyramidUpgradePending`] =
          (myState.pyramidUpgradePending ?? 0) + 1;
      }

      // Draft ID : à l'achat, peut défausser des cartes et piocher le même nombre +1
      if (tile.name === "Draft ID") {
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/idRefreshPending`] = true;
      }

      // Jeton doré : interdit de l'utiliser le tour même de l'achat
      if (tile.name.toLowerCase().includes('doré') || tile.id === 'R_4_1') {
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/goldenTokenUsed`] = true;
      }

      // Cerbère : placement immédiat sur n'importe quelle troupe en jeu
      if (creaturePower?.placeOnAnyZone) {
        await update(ref(db, "/"), updates);
        await logTileBuy(effectivePlayerId, tile);
        setPendingCerbereId(tileId);
        return;
      }
    }

    await update(ref(db, "/"), updates);
    if (["buy_red", "buy_blue", "buy_white", "buy_black"].includes(actionId)) {
      const boughtTile = POWER_TILES.find(t => t.id === params.tileId);
      if (boughtTile) await logTileBuy(effectivePlayerId, boughtTile);
    }
  }

  function computeMovePoints(pid) {
    const ownedTileIds = gameState?.players?.[pid]?.ownedTileIds || [];
    return 1 + ownedTileIds.filter(id => {
      const name = POWER_TILES.find(t => t.id === id)?.name;
      return name === "Déplacement" || name === "Furie Bestiale";
    }).length;
  }

  function computeTeleportCost(pid, currentZoneId = null) {
    const col = me?.color ?? session.playerColor;
    if (currentZoneId) {
      const tileId = gameState?.creatureAssignments?.[currentZoneId]?.[col];
      if (tileId) {
        const name = POWER_TILES.find(t => t.id === tileId)?.name;
        if (CREATURE_POWERS[name]?.teleportFromObelisk) return 4;
      }
    }
    const ownedTileIds = gameState?.players?.[pid]?.ownedTileIds || [];
    const hasReduction = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Réduction Téléportation");
    const hasAnkReduc = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Réduction d'ank");
    const hasTeleFacile = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Téléportation facile");
    return Math.max(0, (hasReduction ? 1 : 2) - (hasAnkReduc ? 1 : 0) - (hasTeleFacile ? 1 : 0));
  }

  function handleBoardZoneClick(zoneId) {
    const col = me?.color;
    if (moveState?.teleportPending) {
      handleTeleportHop(zoneId);
      return;
    }
    if (!moveState) {
      const myUnits = gameState?.boardUnits?.[zoneId]?.[col] || 0;
      if (myUnits === 0) return;
      setMoveConfig({ zoneId });
    } else if (moveState.phase === "moving") {
      const adj = ZONE_ADJACENCY[moveState.currentZoneId] || [];
      if (!adj.includes(zoneId)) return;
      handleMoveHop(zoneId);
    }
  }

  function handleTeleportStart() {
    setMoveState(prev => ({ ...prev, teleportPending: true }));
  }

  function handleTeleportCancel() {
    setMoveState(prev => ({ ...prev, teleportPending: false }));
  }


  async function handleTeleportHop(toZoneId) {
    if (!moveState?.teleportPending) return;
    const { sourceZoneId, currentZoneId, count, col, creatureId, creatureGoes, creatureId2, creatureGoes2, pointsRemaining } = moveState;

    const boardUnits = gameState?.boardUnits || {};
    const creatureAssignments = gameState?.creatureAssignments || {};

    // Blocage Cerbère adverse
    if (hasEnemyCerbereInZone(toZoneId, col, creatureAssignments, POWER_TILES)) return;

    const hasFreeAnyTeleport = gameState?.players?.[effectivePlayerId]?.pendingFreeAnyTeleport ?? false;
    const hasWallPass = gameState?.players?.[effectivePlayerId]?.pendingWallPass ?? false;

    const existingAtDest = boardUnits[toZoneId]?.[col] || 0;
    const movingCreatureName = creatureGoes && creatureId ? POWER_TILES.find(t => t.id === creatureId)?.name : null;
    const destMax = getZoneMaxUnits(toZoneId, col, creatureAssignments, gameState?.players || {}, POWER_TILES, movingCreatureName, MAX_UNITS_PER_ZONE);
    if (!hasWallPass && existingAtDest + count > destMax) return;

    const fromCount = Math.max(0, (boardUnits[currentZoneId]?.[col] || 0) - count);
    const toCount = existingAtDest + count;
    const currentAnk = gameState?.players?.[effectivePlayerId]?.ank ?? 7;
    const cost = hasFreeAnyTeleport ? 0 : computeTeleportCost(effectivePlayerId, currentZoneId);

    // Coût Bouquetin : l'attaquant paie 2 ank s'il entre dans une zone avec Bouquetin adverse
    const bouquetinCost = getBouquetinAnkCost(toZoneId, col);
    if (bouquetinCost > 0 && currentAnk - cost < bouquetinCost) return;

    const updates = {
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`]: currentAnk - cost - bouquetinCost,
      [`rooms/${roomCode}/gameState/boardUnits/${currentZoneId}/${col}`]: fromCount,
      [`rooms/${roomCode}/gameState/boardUnits/${toZoneId}/${col}`]: toCount,
    };
    if (hasFreeAnyTeleport) updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/pendingFreeAnyTeleport`] = null;

    // Prêtre suit la troupe via téléportation quand toutes les unités bougent
    if (fromCount === 0) {
      const priestAtFromT = gameState?.boardPriests?.[currentZoneId]?.[col];
      if (priestAtFromT) {
        updates[`rooms/${roomCode}/gameState/boardPriests/${currentZoneId}/${col}`] = null;
        updates[`rooms/${roomCode}/gameState/boardPriests/${toZoneId}/${col}`] = priestAtFromT;
      }
    }

    if (creatureId) {
      if (creatureGoes) {
        updates[`rooms/${roomCode}/gameState/creatureAssignments/${currentZoneId}/${col}`] = null;
        updates[`rooms/${roomCode}/gameState/creatureAssignments/${toZoneId}/${col}`] = creatureId;
      } else if (currentZoneId === sourceZoneId && fromCount === 0) {
        updates[`rooms/${roomCode}/gameState/creatureAssignments/${sourceZoneId}/${col}`] = null;
      }
    }

    if (creatureId2) {
      if (creatureGoes2) {
        updates[`rooms/${roomCode}/gameState/creatureAssignments2/${currentZoneId}/${col}`] = null;
        updates[`rooms/${roomCode}/gameState/creatureAssignments2/${toZoneId}/${col}`] = creatureId2;
      } else if (currentZoneId === sourceZoneId && fromCount === 0) {
        updates[`rooms/${roomCode}/gameState/creatureAssignments2/${sourceZoneId}/${col}`] = null;
      }
    }

    // Contrôle pyramide : quitter une cité ennemie via téléport (restaurer si plus d'unités)
    const fromPyrSlotT = getPyramidSlotForZone(currentZoneId);
    if (fromPyrSlotT && gameState?.pyramids?.[fromPyrSlotT] && fromCount === 0) {
      const pyr = gameState.pyramids[fromPyrSlotT];
      if (pyr.ownerId !== effectivePlayerId && pyr.controllerId === effectivePlayerId) {
        updates[`rooms/${roomCode}/gameState/pyramids/${fromPyrSlotT}/controllerId`] = pyr.ownerId;
      }
    }

    const toZoneUnits = boardUnits[toZoneId] || {};
    const hasEnemy = Object.entries(toZoneUnits).some(([color, cnt]) => color !== col && (cnt || 0) > 0);

    // Attaque 2 ank : +2 ank au moment d'attaquer
    if (hasEnemy) {
      const myIds = gameState?.players?.[effectivePlayerId]?.ownedTileIds || [];
      if (myIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Attaque 2 ank")) {
        const baseAnk = updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] ?? currentAnk;
        const dayAnkA = myIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "+1 d'Ank en journée") ? 2 : 0;
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] = Math.min(11, baseAnk + 2 + dayAnkA);
      }
    }

    if (hasEnemy) {
      const enemyColor = Object.keys(toZoneUnits).find(c => c !== col && (toZoneUnits[c] || 0) > 0);
      const enemyPlayerId = currentPlayers.find(p => p.color === enemyColor)?.id;
      if (enemyPlayerId) {
        const hasTileT = (pid, name) => (gameState?.players?.[pid]?.ownedTileIds || []).some(id => POWER_TILES.find(t => t.id === id)?.name === name);
        const prescienceT = [effectivePlayerId, enemyPlayerId].find(pid => hasTileT(pid, "Préscience")) ?? null;
        const prescienceIdT = [effectivePlayerId, enemyPlayerId].find(pid => hasTileT(pid, "Prescience des IDs")) ?? null;
        updates[`rooms/${roomCode}/combat`] = {
          attacker: effectivePlayerId,
          defender: enemyPlayerId,
          zoneId: toZoneId,
          status: "selecting",
          choices: {},
          ...(prescienceT && { prescience: prescienceT }),
          ...(prescienceIdT && { prescienceId: prescienceIdT }),
        };
        const defIdCards = gameState?.players?.[enemyPlayerId]?.idCards || [];
        if (defIdCards.some(c => c.id === "la_fuite")) {
          updates[`rooms/${roomCode}/fleeOffer`] = {
            defenderId: enemyPlayerId,
            attackerId: effectivePlayerId,
            zoneId: toZoneId,
            attackerPointsRemaining: newPoints,
            attackerMoveData: {
              count: moveState?.count ?? 1,
              creatureId: moveState?.creatureId ?? null,
              creatureGoes: moveState?.creatureGoes ?? false,
              creatureId2: moveState?.creatureId2 ?? null,
              creatureGoes2: moveState?.creatureGoes2 ?? false,
              sourceZoneId: moveState?.sourceZoneId ?? currentZoneId,
            },
            timestamp: Date.now(),
          };
        }
      }
    }

    await update(ref(db, "/"), updates);

    if (hasEnemy) {
      const enemyName = currentPlayers.find(p => p.color === Object.keys(toZoneUnits).find(c => c !== col && (toZoneUnits[c] || 0) > 0))?.name || "?";
      await logAction(effectivePlayerId, `attaque ${enemyName} en ${toZoneId}`, { type: "attack" });
      setMoveState(null);
      setActionMode(null);
    } else if (pointsRemaining <= 0) {
      await logAction(effectivePlayerId, `déplace des troupes vers ${toZoneId}`, { type: "move" });
      setMoveState(null);
      setActionMode(null);
    } else {
      setMoveState(prev => ({ ...prev, currentZoneId: toZoneId, teleportPending: false }));
    }
  }

  async function handleMoveStart(sourceZoneId, count, creatureGoes, creatureId, creatureGoes2, creatureId2) {
    const isGoldenToken = actionMode === "move_golden";
    if (!isGoldenToken && !canTakeAction()) return;
    const myState = gameState.players?.[effectivePlayerId] || {};
    if (isGoldenToken && myState.goldenTokenUsed) return;

    const col = me?.color;
    const usedActions = myState.usedActions || [];
    const basePts = computeMovePoints(effectivePlayerId);
    const creatureName  = creatureGoes  && creatureId  ? POWER_TILES.find(t => t.id === creatureId)?.name  : null;
    const creatureName2 = creatureGoes2 && creatureId2 ? POWER_TILES.find(t => t.id === creatureId2)?.name : null;
    const pts = basePts + getMovementCreatureBonus(creatureName) + getMovementCreatureBonus(creatureName2);

    const fbUpdates = {};
    if (isGoldenToken) {
      fbUpdates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/goldenTokenUsed`] = true;
    } else {
      fbUpdates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/usedActions`] = [...usedActions, actionMode];
      fbUpdates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/tokens`] = (myState.tokens ?? 5) - 1;
      fbUpdates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/actionsThisTurn`] = (myState.actionsThisTurn ?? 0) + 1;
    }
    await update(ref(db, "/"), fbUpdates);

    setMoveConfig(null);
    setMoveState({
      phase: "moving",
      sourceZoneId,
      currentZoneId: sourceZoneId,
      col,
      count,
      creatureGoes,
      creatureId,
      creatureGoes2,
      creatureId2,
      pointsRemaining: pts,
      forcePaseMuraille: isGoldenToken && (myState.ownedTileIds || []).some(
        id => POWER_TILES.find(t => t.id === id)?.name === "Déplacement Passe/Muraille"
      ),
    });
  }

  // Retourne le coût ank dû au Bouquetin adverse dans une zone, ou 0
  function getBouquetinAnkCost(toZoneId, attackerColor) {
    const zoneUnits = gameState?.boardUnits?.[toZoneId] || {};
    const enemyColor = Object.keys(zoneUnits).find(c => c !== attackerColor && (zoneUnits[c] || 0) > 0);
    if (!enemyColor) return 0;
    const tileId = gameState?.creatureAssignments?.[toZoneId]?.[enemyColor];
    const name = tileId ? POWER_TILES.find(t => t.id === tileId)?.name : null;
    return name ? (CREATURE_POWERS[name]?.attackerAnkCost ?? 0) : 0;
  }

  // Retourne true si zoneId est une cité appartenant à un adversaire
  function isEnemyCityZone(zoneId) {
    const m = zoneId.match(/^J(\d)C\d$/);
    if (!m) return false;
    return parseInt(m[1]) !== (me?.joinOrder);
  }

  // Retourne l'identifiant du slot pyramide correspondant à une zone de cité, ou null
  function getPyramidSlotForZone(zoneId) {
    const m = zoneId.match(/^J(\d)C(\d)$/);
    if (!m) return null;
    return `J${m[1]}P${m[2]}`;
  }

  // Retourne true si le joueur possède "Passe muraille" ou si le déplacement courant est un jeton doré R_4_1
  function hasParseMuraille() {
    if (moveState?.forcePaseMuraille) return true;
    const ownedTileIds = gameState?.players?.[effectivePlayerId]?.ownedTileIds || [];
    return ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Passe muraille");
  }

  // Active le jeton doré "Déplacement Passe/Muraille" (R_4_1)
  function handleGoldenTokenMoveActivate() {
    const myState = gameState?.players?.[effectivePlayerId] || {};
    if (myState.goldenTokenUsed) return;
    if (moveState) return;
    setActionMode("move_golden");
  }

  // Active le jeton doré en mode recrutement (B_4_2 "Jeton doré déplacement recrutement")
  async function handleGoldenTokenRecruitActivate() {
    const myState = gameState?.players?.[effectivePlayerId] || {};
    if (myState.goldenTokenUsed) return;
    if (actionMode) return;
    const fbUpdates = { [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/goldenTokenUsed`]: true };
    if ((myState.ownedTileIds || []).some(id => POWER_TILES.find(t => t.id === id)?.name === "Recrutement + 2")) {
      fbUpdates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/recruitFreeRemaining`] = 2;
    }
    await update(ref(db, "/"), fbUpdates);
    setActionMode("recruit_golden");
  }

  // Jeton doré achat ×2 (N_2_4) — acheter une tuile supplémentaire (+1 coût)
  async function handleGoldenTokenBuyActivate() {
    const myState = gameState?.players?.[effectivePlayerId] || {};
    if (myState.goldenTokenUsed) return;
    if (actionMode) return;
    await update(ref(db, "/"), {
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/goldenTokenUsed`]: true,
    });
    setActionMode("buy_golden");
  }

  // Jeton doré priére (N_1_4) — prayer2 gratuite
  async function handleGoldenTokenPrayerActivate() {
    const myState = gameState?.players?.[effectivePlayerId] || {};
    if (myState.goldenTokenUsed) return;
    if (actionMode) return;
    const prayerBonus = (myState.ownedTileIds || []).filter(
      id => POWER_TILES.find(t => t.id === id)?.name === "Priere +1 ank"
    ).length;
    const hasDayAnkPr = (myState.ownedTileIds || []).some(
      id => POWER_TILES.find(t => t.id === id)?.name === "+1 d'Ank en journée"
    );
    const pGain = 2 + prayerBonus;
    const newAnk = Math.min(11, (myState.ank ?? 7) + pGain + (hasDayAnkPr ? pGain : 0));
    await update(ref(db, "/"), {
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/goldenTokenUsed`]: true,
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`]: newAnk,
    });
  }

  // Active le mode renforcement (B_4_4) — placement gratuit des 4 unités nuit
  function handleRenforcementActivate() {
    if (actionMode) return;
    setActionMode("renforcement");
  }

  async function handleMoveHop(toZoneId) {
    if (!moveState || moveState.phase !== "moving") return;
    if (moveState.forbiddenZoneId && toZoneId === moveState.forbiddenZoneId) return;
    const { sourceZoneId, currentZoneId, count, col, creatureId, creatureGoes, creatureId2, creatureGoes2, pointsRemaining } = moveState;

    const boardUnits = gameState?.boardUnits || {};
    const creatureAssignments = gameState?.creatureAssignments || {};

    // Blocage Cerbère adverse
    if (hasEnemyCerbereInZone(toZoneId, col, creatureAssignments, POWER_TILES)) return;

    const movingCreatureName = creatureGoes && creatureId ? POWER_TILES.find(t => t.id === creatureId)?.name : null;

    // Muraille : entrée en cité ennemie uniquement depuis une case adjacente dès le premier hop
    if (isEnemyCityZone(toZoneId) && !hasParseMuraille()) {
      const movingCreaturePower = movingCreatureName ? CREATURE_POWERS[movingCreatureName] : null;
      if (!movingCreaturePower?.wallPass) {
        const comingFromInsideEnemy = isEnemyCityZone(currentZoneId);
        if (!comingFromInsideEnemy && currentZoneId !== sourceZoneId) return;
      }
    }

    // Min unités si Cerbère dans la zone source
    const sourceTileId = creatureAssignments[currentZoneId]?.[col];
    const sourcePower = sourceTileId ? CREATURE_POWERS[POWER_TILES.find(t => t.id === sourceTileId)?.name] : null;
    if (sourcePower?.minUnitsInZone) {
      const total = boardUnits[currentZoneId]?.[col] || 0;
      if (total - count < sourcePower.minUnitsInZone) return;
    }

    const hasWallPassMove = gameState?.players?.[effectivePlayerId]?.pendingWallPass ?? false;

    const existingAtDest = boardUnits[toZoneId]?.[col] || 0;
    const destMax = getZoneMaxUnits(toZoneId, col, creatureAssignments, gameState?.players || {}, POWER_TILES, movingCreatureName, MAX_UNITS_PER_ZONE);
    if (!hasWallPassMove && existingAtDest + count > destMax) return;

    // Coût Bouquetin : l'attaquant paie 2 ank s'il entre dans une zone avec Bouquetin adverse
    const bouquetinCost = getBouquetinAnkCost(toZoneId, col);
    const currentAnk = gameState?.players?.[effectivePlayerId]?.ank ?? 0;
    if (bouquetinCost > 0 && currentAnk < bouquetinCost) return;

    const fromCount = Math.max(0, (boardUnits[currentZoneId]?.[col] || 0) - count);
    const toCount = existingAtDest + count;

    const updates = {
      [`rooms/${roomCode}/gameState/boardUnits/${currentZoneId}/${col}`]: fromCount,
      [`rooms/${roomCode}/gameState/boardUnits/${toZoneId}/${col}`]: toCount,
    };
    if (bouquetinCost > 0) {
      updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] = currentAnk - bouquetinCost;
    }

    // Prêtre suit la troupe quand toutes les unités bougent
    if (fromCount === 0) {
      const priestAtFrom = gameState?.boardPriests?.[currentZoneId]?.[col];
      if (priestAtFrom) {
        updates[`rooms/${roomCode}/gameState/boardPriests/${currentZoneId}/${col}`] = null;
        updates[`rooms/${roomCode}/gameState/boardPriests/${toZoneId}/${col}`] = priestAtFrom;
      }
    }

    if (creatureId) {
      if (creatureGoes) {
        updates[`rooms/${roomCode}/gameState/creatureAssignments/${currentZoneId}/${col}`] = null;
        updates[`rooms/${roomCode}/gameState/creatureAssignments/${toZoneId}/${col}`] = creatureId;
      } else if (currentZoneId === sourceZoneId && fromCount === 0) {
        updates[`rooms/${roomCode}/gameState/creatureAssignments/${sourceZoneId}/${col}`] = null;
      }
    }

    if (creatureId2) {
      if (creatureGoes2) {
        updates[`rooms/${roomCode}/gameState/creatureAssignments2/${currentZoneId}/${col}`] = null;
        updates[`rooms/${roomCode}/gameState/creatureAssignments2/${toZoneId}/${col}`] = creatureId2;
      } else if (currentZoneId === sourceZoneId && fromCount === 0) {
        updates[`rooms/${roomCode}/gameState/creatureAssignments2/${sourceZoneId}/${col}`] = null;
      }
    }

    // Contrôle de pyramide : quitter une cité ennemie (restaurer le propriétaire si plus d'unités)
    const fromPyrSlot = getPyramidSlotForZone(currentZoneId);
    if (fromPyrSlot && gameState?.pyramids?.[fromPyrSlot] && fromCount === 0) {
      const pyr = gameState.pyramids[fromPyrSlot];
      if (pyr.ownerId !== effectivePlayerId && pyr.controllerId === effectivePlayerId) {
        updates[`rooms/${roomCode}/gameState/pyramids/${fromPyrSlot}/controllerId`] = pyr.ownerId;
      }
    }

    const toZoneUnits = boardUnits[toZoneId] || {};
    const hasEnemy = Object.entries(toZoneUnits).some(([color, cnt]) => color !== col && (cnt || 0) > 0);
    const newPoints = pointsRemaining - 1;

    // Attaque 2 ank : +2 ank au moment d'attaquer
    if (hasEnemy) {
      const myIds = gameState?.players?.[effectivePlayerId]?.ownedTileIds || [];
      if (myIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Attaque 2 ank")) {
        const baseAnk = updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] ?? (gameState?.players?.[effectivePlayerId]?.ank ?? 7);
        const dayAnkB = myIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "+1 d'Ank en journée") ? 2 : 0;
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ank`] = Math.min(11, baseAnk + 2 + dayAnkB);
      }
    }

    // Contrôle de pyramide : entrée dans une cité ennemie sans combat
    if (!hasEnemy) {
      const toPyrSlot = getPyramidSlotForZone(toZoneId);
      if (toPyrSlot && gameState?.pyramids?.[toPyrSlot]) {
        const pyr = gameState.pyramids[toPyrSlot];
        if (pyr.ownerId !== effectivePlayerId) {
          updates[`rooms/${roomCode}/gameState/pyramids/${toPyrSlot}/controllerId`] = effectivePlayerId;
        }
      }
    }

    if (hasEnemy) {
      const enemyColor = Object.keys(toZoneUnits).find(c => c !== col && (toZoneUnits[c] || 0) > 0);
      const enemyPlayerId = currentPlayers.find(p => p.color === enemyColor)?.id;
      if (enemyPlayerId) {
        const hasTile = (pid, name) => (gameState?.players?.[pid]?.ownedTileIds || []).some(id => POWER_TILES.find(t => t.id === id)?.name === name);
        const prescience = [effectivePlayerId, enemyPlayerId].find(pid => hasTile(pid, "Préscience")) ?? null;
        const prescienceId = [effectivePlayerId, enemyPlayerId].find(pid => hasTile(pid, "Prescience des IDs")) ?? null;
        updates[`rooms/${roomCode}/combat`] = {
          attacker: effectivePlayerId,
          defender: enemyPlayerId,
          zoneId: toZoneId,
          status: "selecting",
          choices: {},
          ...(prescience && { prescience }),
          ...(prescienceId && { prescienceId }),
        };
        const defIdCards = gameState?.players?.[enemyPlayerId]?.idCards || [];
        if (defIdCards.some(c => c.id === "la_fuite")) {
          updates[`rooms/${roomCode}/fleeOffer`] = {
            defenderId: enemyPlayerId,
            attackerId: effectivePlayerId,
            zoneId: toZoneId,
            attackerPointsRemaining: newPoints,
            attackerMoveData: {
              count: moveState?.count ?? 1,
              creatureId: moveState?.creatureId ?? null,
              creatureGoes: moveState?.creatureGoes ?? false,
              creatureId2: moveState?.creatureId2 ?? null,
              creatureGoes2: moveState?.creatureGoes2 ?? false,
              sourceZoneId: moveState?.sourceZoneId ?? currentZoneId,
            },
            timestamp: Date.now(),
          };
        }
      }
    }

    await update(ref(db, "/"), updates);

    if (hasEnemy) {
      const enemyName = currentPlayers.find(p => p.color === Object.keys(toZoneUnits).find(c => c !== col && (toZoneUnits[c] || 0) > 0))?.name || "?";
      await logAction(effectivePlayerId, `attaque ${enemyName} en ${toZoneId}`, { type: "attack" });
      setMoveState(null);
      setActionMode(null);
    } else if (newPoints <= 0) {
      await logAction(effectivePlayerId, `se téléporte vers ${toZoneId}`, { type: "move" });
      setMoveState(null);
      setActionMode(null);
    } else {
      setMoveState(prev => ({ ...prev, currentZoneId: toZoneId, pointsRemaining: newPoints }));
    }
  }

  async function handleMoveDone() {
    const ps = gameState?.players?.[effectivePlayerId] || {};
    const updates = {};
    if (ps.pendingWallPass) updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/pendingWallPass`] = null;
    if (ps.pendingFreeAnyTeleport) updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/pendingFreeAnyTeleport`] = null;
    // Garde défensive : si l'action n'a pas été comptabilisée (race condition Firebase), la compter maintenant
    const currentMode = actionMode;
    if (currentMode !== "move_golden" && (ps.actionsThisTurn ?? 0) < 1) {
      updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/actionsThisTurn`] = 1;
      if (!(ps.usedActions || []).includes(currentMode)) {
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/usedActions`] = [...(ps.usedActions || []), currentMode];
      }
      if ((ps.tokens ?? 5) > 0) {
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/tokens`] = (ps.tokens ?? 5) - 1;
      }
    }
    if (Object.keys(updates).length > 0) await update(ref(db, "/"), updates);
    setMoveState(null);
    setActionMode(null);
  }

  function handleMoveCancel() {
    setMoveConfig(null);
    setMoveState(null);
    setActionMode(null);
  }

  async function handleSetupConfirm(choices) {
    const setupOrder = gameState?.setupOrder || [];
    const setupIndex = gameState?.setupIndex ?? 0;
    const setupPlayerId = setupOrder[setupIndex];
    if (!isTestMode && setupPlayerId !== playerId) return;

    const updates = {};
    choices.forEach(({ slotId, color, level }) => {
      updates[`rooms/${roomCode}/gameState/pyramids/${slotId}`] = {
        color, level, ownerId: setupPlayerId, controllerId: setupPlayerId,
      };
    });
    const nextIndex = setupIndex + 1;
    updates[`rooms/${roomCode}/gameState/setupIndex`] = nextIndex;
    if (nextIndex >= setupOrder.length) {
      updates[`rooms/${roomCode}/gameState/phase`] = "draft";
      updates[`rooms/${roomCode}/gameState/draftOrder`] = [...setupOrder].reverse();
      updates[`rooms/${roomCode}/gameState/draftIndex`] = 0;
    }
    await update(ref(db, "/"), updates);
  }

  async function handleDraftPick(tileId) {
    const draftOrder = gameState?.draftOrder || [];
    const draftIndex = gameState?.draftIndex ?? 0;
    if (!isTestMode && draftOrder[draftIndex] !== playerId) return;
    const tile = POWER_TILES.find(t => t.id === tileId);
    if (!tile) return;
    const availableTileIds = gameState?.availableTileIds || [];
    if (!availableTileIds.includes(tileId)) return;
    const ownedTileIds = gameState?.players?.[effectivePlayerId]?.ownedTileIds || [];
    const nextDraftIndex = draftIndex + 1;
    const updates = {
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/ownedTileIds`]: [...ownedTileIds, tileId],
      [`rooms/${roomCode}/gameState/availableTileIds`]: availableTileIds.filter(id => id !== tileId),
      [`rooms/${roomCode}/gameState/draftIndex`]: nextDraftIndex,
    };
    if (nextDraftIndex >= draftOrder.length) {
      updates[`rooms/${roomCode}/gameState/phase`] = "placement";
    }
    await update(ref(db, "/"), updates);
  }

  async function handlePlacementConfirm(selectedZones) {
    const playerColor = me?.color ?? session.playerColor;
    // Re-read placements for race-condition safety
    const snap = await get(ref(db, `rooms/${roomCode}/gameState/placements`));
    const currentPlacements = snap.exists() ? snap.val() : {};

    const allPlacements = {
      ...currentPlacements,
      [effectivePlayerId]: { zones: selectedZones, confirmed: true },
    };

    const updates = {
      [`rooms/${roomCode}/gameState/placements/${effectivePlayerId}`]: {
        zones: selectedZones,
        confirmed: true,
      },
    };

    const allConfirmed = currentPlayers.every(p => allPlacements[p.id]?.confirmed);
    if (allConfirmed) {
      currentPlayers.forEach(p => {
        const pPlacement = allPlacements[p.id];
        pPlacement.zones.forEach(zoneId => {
          updates[`rooms/${roomCode}/gameState/boardUnits/${zoneId}/${p.color}`] = 5;
        });
        updates[`rooms/${roomCode}/gameState/players/${p.id}/unitsReserve`] = 2;
      });
      updates[`rooms/${roomCode}/gameState/phase`] = "playing";
    }

    await update(ref(db, "/"), updates);
  }

  // ── IA : fonctions d'exécution ─────────────────────────────────────────────

  async function executeAISetup(aiId) {
    if (!gameState) return;
    const setupOrder = gameState.setupOrder || [];
    const setupIndex = gameState.setupIndex ?? 0;
    if (setupOrder[setupIndex] !== aiId) return;
    const aiPlayer = currentPlayers.find(p => p.id === aiId);
    if (!aiPlayer) return;
    const choices = aiChooseSetup(aiPlayer);
    const updates = {};
    choices.forEach(({ slotId, color, level }) => {
      updates[`rooms/${roomCode}/gameState/pyramids/${slotId}`] = { color, level, ownerId: aiId, controllerId: aiId };
    });
    const nextIndex = setupIndex + 1;
    updates[`rooms/${roomCode}/gameState/setupIndex`] = nextIndex;
    if (nextIndex >= setupOrder.length) {
      updates[`rooms/${roomCode}/gameState/phase`] = "draft";
      updates[`rooms/${roomCode}/gameState/draftOrder`] = [...setupOrder].reverse();
      updates[`rooms/${roomCode}/gameState/draftIndex`] = 0;
    }
    await update(ref(db, "/"), updates);
  }

  async function executeAIDraft(aiId) {
    if (!gameState) return;
    const draftOrder = gameState.draftOrder || [];
    const draftIndex = gameState.draftIndex ?? 0;
    if (draftOrder[draftIndex] !== aiId) return;
    const tileId = aiChooseDraftTile(gameState, aiId);
    if (!tileId) return;
    const availableTileIds = gameState.availableTileIds || [];
    if (!availableTileIds.includes(tileId)) return;
    const ownedTileIds = gameState.players?.[aiId]?.ownedTileIds || [];
    const nextDraftIndex = draftIndex + 1;
    const updates = {
      [`rooms/${roomCode}/gameState/players/${aiId}/ownedTileIds`]: [...ownedTileIds, tileId],
      [`rooms/${roomCode}/gameState/availableTileIds`]: availableTileIds.filter(id => id !== tileId),
      [`rooms/${roomCode}/gameState/draftIndex`]: nextDraftIndex,
    };
    if (nextDraftIndex >= draftOrder.length) updates[`rooms/${roomCode}/gameState/phase`] = "placement";
    await update(ref(db, "/"), updates);
  }

  async function executeAIPlacement(aiId) {
    if (!gameState) return;
    const aiPlayer = currentPlayers.find(p => p.id === aiId);
    if (!aiPlayer) return;
    const aiColor = aiPlayer.color;
    const snap = await get(ref(db, `rooms/${roomCode}/gameState/placements`));
    const currentPlacements = snap.exists() ? snap.val() : {};
    if (currentPlacements[aiId]?.confirmed) return;
    const zones = aiChoosePlacement(aiPlayer);
    const allPlacements = { ...currentPlacements, [aiId]: { zones, confirmed: true } };
    const updates = { [`rooms/${roomCode}/gameState/placements/${aiId}`]: { zones, confirmed: true } };
    const allConfirmed = currentPlayers.every(p => allPlacements[p.id]?.confirmed);
    if (allConfirmed) {
      currentPlayers.forEach(p => {
        const pp = currentPlayers.find(pl => pl.id === p.id);
        const pPlacement = allPlacements[p.id];
        if (!pPlacement) return;
        pPlacement.zones.forEach(zoneId => {
          updates[`rooms/${roomCode}/gameState/boardUnits/${zoneId}/${pp.color}`] = 5;
        });
        updates[`rooms/${roomCode}/gameState/players/${p.id}/unitsReserve`] = 2;
      });
      updates[`rooms/${roomCode}/gameState/phase`] = "playing";
    }
    await update(ref(db, "/"), updates);
  }

  async function aiEndTurn(aiId) {
    const sorted = [...currentPlayers].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(p => p.id === aiId);
    const next = sorted[(idx + 1) % sorted.length];
    await update(ref(db, `rooms/${roomCode}/gameState`), {
      currentTurnPlayerId: next.id,
      [`players/${next.id}/actionsThisTurn`]: 0,
    });
    await logAction(aiId, `termine son tour → ${next.name} joue`);

    const snap = await get(ref(db, `rooms/${roomCode}/gameState/players`));
    if (snap.exists()) {
      const players = snap.val();
      const allDone = currentPlayers.every(p => (players[p.id]?.tokens ?? 5) === 0);
      if (allDone) setShowNight(true);
    }
  }

  async function executeAITurn(aiId) {
    if (aiTurnInProgressRef.current) return;
    aiTurnInProgressRef.current = true;
    try {
      await _executeAITurnInner(aiId);
    } finally {
      aiTurnInProgressRef.current = false;
    }
  }

  async function _executeAITurnInner(aiId) {
    if (!gameState) return;
    const aiPlayer = currentPlayers.find(p => p.id === aiId);
    if (!aiPlayer) return;
    const myState = gameState.players?.[aiId] || {};
    const aiColor = aiPlayer.color;
    const decision = aiDecideAction(gameState, aiId, currentPlayers);

    if (decision.type === "endTurn") {
      await aiEndTurn(aiId);
      return;
    }

    const ank = myState.ank ?? 7;
    const tokens = myState.tokens ?? 5;
    const usedActions = myState.usedActions || [];
    const ownedTileIds = myState.ownedTileIds || [];
    const boardUnits = gameState.boardUnits || {};

    const baseUpdates = {
      [`rooms/${roomCode}/gameState/players/${aiId}/usedActions`]: [...usedActions, decision.type],
      [`rooms/${roomCode}/gameState/players/${aiId}/tokens`]: tokens - 1,
      [`rooms/${roomCode}/gameState/players/${aiId}/actionsThisTurn`]: (myState.actionsThisTurn ?? 0) + 1,
    };

    let logText = "";
    let logMeta = null;

    switch (decision.type) {
      case "prayer2": {
        const prayerBonus = ownedTileIds.filter(id => POWER_TILES.find(t => t.id === id)?.name === "Priere +1 ank").length;
        const gain = 2 + prayerBonus;
        baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/ank`] = Math.min(11, ank + gain);
        logText = `prie et gagne ${gain} Ank`;
        logMeta = { type: "prayer" };
        break;
      }
      case "prayer3": {
        const prayerBonus3 = ownedTileIds.filter(id => POWER_TILES.find(t => t.id === id)?.name === "Priere +1 ank").length;
        const gain3 = 3 + prayerBonus3;
        baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/ank`] = Math.min(11, ank + gain3);
        logText = `prie et gagne ${gain3} Ank`;
        logMeta = { type: "prayer" };
        break;
      }
      case "recruit": {
        baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/recruitFreeRemaining`] = 0;
        const joinOrder = aiPlayer.joinOrder;
        const cityZones = BOARD_ZONES.filter(z => z.id.startsWith(`J${joinOrder}C`)).map(z => z.id);
        let reserve = myState.unitsReserve ?? 0;
        let ankLeft = ank;
        let totalPlaced = 0;
        for (const zId of cityZones) {
          const current = boardUnits[zId]?.[aiColor] || 0;
          const space = MAX_UNITS_PER_ZONE - current;
          const toPlace = Math.min(reserve, space, Math.floor(ankLeft));
          if (toPlace <= 0) continue;
          baseUpdates[`rooms/${roomCode}/gameState/boardUnits/${zId}/${aiColor}`] = current + toPlace;
          reserve -= toPlace;
          ankLeft -= toPlace;
          totalPlaced += toPlace;
        }
        const ankSpent = (myState.unitsReserve ?? 0) - reserve;
        if (ankSpent > 0) baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/ank`] = Math.max(0, ank - ankSpent);
        baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/unitsReserve`] = reserve;
        logText = `recrute ${totalPlaced} unité${totalPlaced > 1 ? "s" : ""} dans sa cité`;
        logMeta = { type: "recruit" };
        break;
      }
      case "buy_red":
      case "buy_blue":
      case "buy_white":
      case "buy_black": {
        const tile = POWER_TILES.find(t => t.id === decision.tileId);
        if (!tile) return;
        const availableTileIds = gameState.availableTileIds || [];
        if (!availableTileIds.includes(decision.tileId)) return;
        const aiPyramids = gameState.pyramids || {};
        if (getPlayerPyramidLevel(aiId, tile.color, aiPyramids) < tile.level) return;
        if (tile.secondaryColor && getPlayerPyramidLevel(aiId, tile.secondaryColor, aiPyramids) < tile.secondaryLevel) return;
        const hasCoutReduc = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Cout Pouvoir -1");
        const effectiveCost = Math.max(0, tile.cost - (hasCoutReduc ? 1 : 0));
        if (ank < effectiveCost) return;
        baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/ank`] = ank - effectiveCost;
        baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/ownedTileIds`] = [...ownedTileIds, decision.tileId];
        baseUpdates[`rooms/${roomCode}/gameState/availableTileIds`] = availableTileIds.filter(id => id !== decision.tileId);
        const creaturePower = tile.type === "creature" ? CREATURE_POWERS?.[tile.name] : null;
        const vpGain = creaturePower?.vpOnPurchase ?? tile.vpOnPurchase ?? 0;
        if (vpGain > 0) baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/vpPermanent`] = (myState.vpPermanent ?? 0) + vpGain;
        const ankGain = tile.ankOnPurchase ?? 0;
        if (ankGain > 0) {
          const baseAnk = baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/ank`] ?? (ank - effectiveCost);
          baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/ank`] = Math.min(11, baseAnk + ankGain);
        }
        logText = `acquiert la tuile "${tile.name}" (${tile.color} niv.${tile.level}) pour ${effectiveCost} Ank`;
        logMeta = { type: "tile", tileId: tile.id };
        break;
      }
      case "move1": {
        // Ta-Seti : avancer un prêtre si possible (même règle que pour le joueur humain)
        const layout = gameState.taSetiLayout;
        if (layout) {
          const pRaw = gameState.taSetiPriestPositions?.[aiId] || {};
          const pPos = [pRaw['0'] ?? '', pRaw['1'] ?? '', pRaw['2'] ?? ''];
          const faces = Array.isArray(layout) ? layout : Object.values(layout);
          for (let pi = 0; pi < pPos.length; pi++) {
            const dests = getValidPriestDestinations(pPos[pi], layout);
            if (dests.length === 0) continue;
            // Priorité aux emplacements avec jetons disponibles
            const chosenDest = dests.find(d => {
              const m = d.match(/^E_(\d+)_/);
              if (!m) return false;
              const fk = `${m[1]}${faces[parseInt(m[1]) - 1]}`;
              return (E_TO_TOKENS[fk]?.[d] ?? []).some(tid =>
                (tid.startsWith('JI') && gameState.jiAssignment?.[tid]) ||
                (tid.startsWith('JU') && gameState.puAssignment?.[tid]) ||
                (tid.startsWith('JP') && gameState.jpAssignment?.[tid])
              );
            }) || dests[0];

            baseUpdates[`rooms/${roomCode}/gameState/taSetiPriestPositions/${aiId}/${pi}`] = chosenDest;

            // Bonus du nœud I traversé
            const iNode = getTraversedINode(pPos[pi], chosenDest, layout);
            if (iNode) {
              const im = iNode.match(/^I_(\d+)_/);
              if (im) {
                const iFk = `${im[1]}${faces[parseInt(im[1]) - 1]}`;
                (TASETI_I_BONUSES[iFk]?.[iNode] ?? []).forEach(b => applyTaSetiBonusToUpdates(b, aiId, myState, baseUpdates));
              }
            }

            // Fin de piste E_4_2 : +1 PV (premier prêtre du jour) puis retour réserve
            if (chosenDest === 'E_4_2') {
              if (!gameState.taSetiE4_2DailyVp) {
                const vpBase = baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/vpPermanent`] ?? (myState.vpPermanent ?? 0);
                baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/vpPermanent`] = vpBase + 1;
                baseUpdates[`rooms/${roomCode}/gameState/taSetiE4_2DailyVp`] = true;
              }
              baseUpdates[`rooms/${roomCode}/gameState/taSetiPriestPositions/${aiId}/${pi}`] = '';
            } else {
              // Bonus du nœud E_ d'arrivée
              const em = chosenDest.match(/^E_(\d+)_/);
              if (em) {
                const eFk = `${em[1]}${faces[parseInt(em[1]) - 1]}`;
                (TASETI_E_BONUSES[eFk]?.[chosenDest] ?? []).forEach(b => applyTaSetiBonusToUpdates(b, aiId, myState, baseUpdates));
                // Jetons : prise automatique
                (E_TO_TOKENS[eFk]?.[chosenDest] ?? []).forEach(tid => {
                  if (tid.startsWith('JI') && gameState.jiAssignment?.[tid]) {
                    const effect = JI_EFFECT_MAP[gameState.jiAssignment[tid]];
                    if (effect) applyTaSetiBonusToUpdates(effect, aiId, myState, baseUpdates);
                    baseUpdates[`rooms/${roomCode}/gameState/jiAssignment/${tid}`] = null;
                  } else if (tid.startsWith('JU') && gameState.puAssignment?.[tid]) {
                    const cardId = gameState.puAssignment[tid];
                    const hand = baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/juTokenHand`] ?? (myState.juTokenHand || []);
                    baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/juTokenHand`] = [...hand, { nodeId: tid, cardId }];
                    baseUpdates[`rooms/${roomCode}/gameState/puAssignment/${tid}`] = null;
                  } else if (tid.startsWith('JP') && gameState.jpAssignment?.[tid]) {
                    // Jeton Pouvoir : stocké en main pour simplifier
                    const cardId = gameState.jpAssignment[tid];
                    const jpHand = baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/jpTokenHand`] ?? (myState.jpTokenHand || []);
                    baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/jpTokenHand`] = [...jpHand, cardId];
                    baseUpdates[`rooms/${roomCode}/gameState/jpAssignment/${tid}`] = null;
                  }
                });
              }
            }
            break; // un seul prêtre par action de déplacement
          }
        }

        // Déplacement sur le plateau principal
        const { sourceZoneId, targetZoneId, count } = decision;
        const sourceUnits = boardUnits[sourceZoneId]?.[aiColor] || 0;
        const targetUnits = boardUnits[targetZoneId]?.[aiColor] || 0;
        if (count > sourceUnits) return;
        baseUpdates[`rooms/${roomCode}/gameState/boardUnits/${sourceZoneId}/${aiColor}`] = sourceUnits - count;
        baseUpdates[`rooms/${roomCode}/gameState/boardUnits/${targetZoneId}/${aiColor}`] = targetUnits + count;
        if (sourceUnits - count === 0) {
          const aiPriestData = gameState?.boardPriests?.[sourceZoneId]?.[aiColor];
          if (aiPriestData) {
            baseUpdates[`rooms/${roomCode}/gameState/boardPriests/${sourceZoneId}/${aiColor}`] = null;
            baseUpdates[`rooms/${roomCode}/gameState/boardPriests/${targetZoneId}/${aiColor}`] = aiPriestData;
          }
        }
        const zoneName = BOARD_ZONES.find(z => z.id === targetZoneId)?.label || targetZoneId;
        logText = `déplace ${count} unité${count > 1 ? "s" : ""} vers ${zoneName}`;
        logMeta = { type: "move" };
        break;
      }
      case "attack": {
        const { fromZoneId, toZoneId, count: attackCount } = decision;
        const sourceUnits = boardUnits[fromZoneId]?.[aiColor] || 0;
        if (attackCount > sourceUnits) return;

        const toZoneUnits = boardUnits[toZoneId] || {};
        const enemyColor = Object.keys(toZoneUnits).find(c => c !== aiColor && (toZoneUnits[c] || 0) > 0);
        const enemyPlayerId = currentPlayers.find(p => p.color === enemyColor)?.id;
        if (!enemyPlayerId) return;

        // Déplacer les unités
        baseUpdates[`rooms/${roomCode}/gameState/boardUnits/${fromZoneId}/${aiColor}`] = sourceUnits - attackCount;
        baseUpdates[`rooms/${roomCode}/gameState/boardUnits/${toZoneId}/${aiColor}`] = (toZoneUnits[aiColor] || 0) + attackCount;

        // Déclencher le combat
        const hasTileAI = (pid, name) => (gameState?.players?.[pid]?.ownedTileIds || []).some(
          id => POWER_TILES.find(t => t.id === id)?.name === name
        );
        const prescience = [aiId, enemyPlayerId].find(pid => hasTileAI(pid, "Préscience")) ?? null;
        const prescienceId = [aiId, enemyPlayerId].find(pid => hasTileAI(pid, "Prescience des IDs")) ?? null;
        baseUpdates[`rooms/${roomCode}/combat`] = {
          attacker: aiId,
          defender: enemyPlayerId,
          zoneId: toZoneId,
          status: "selecting",
          choices: {},
          ...(prescience && { prescience }),
          ...(prescienceId && { prescienceId }),
        };

        // Fuite : si le défenseur a la carte La Fuite
        const defIdCards = gameState?.players?.[enemyPlayerId]?.idCards || [];
        if (defIdCards.some(c => c.id === "la_fuite")) {
          baseUpdates[`rooms/${roomCode}/fleeOffer`] = {
            defenderId: enemyPlayerId,
            attackerId: aiId,
            zoneId: toZoneId,
            attackerPointsRemaining: 0,
            attackerMoveData: { count: attackCount, creatureId: null, creatureGoes: false, creatureId2: null, creatureGoes2: false, sourceZoneId: fromZoneId },
            timestamp: Date.now(),
          };
        }

        const enemyName = currentPlayers.find(p => p.id === enemyPlayerId)?.name ?? "?";
        const targetLabel = BOARD_ZONES.find(z => z.id === toZoneId)?.label || toZoneId;
        logText = `attaque ${enemyName} en ${targetLabel} avec ${attackCount} unité${attackCount > 1 ? "s" : ""}`;
        logMeta = { type: "attack" };
        break;
      }
      case "upgradePyramid": {
        if (usedActions.includes('upgradePyramid') || usedActions.includes('pyramid')) return;
        if (tokens <= 0) return;
        const { slotId, targetLevel } = decision;
        const pyr = gameState.pyramids?.[slotId];
        if (!pyr || pyr.controllerId !== aiId) return;
        const fromLevel = pyr.level ?? 0;
        const pyramidCost = (from, to) => (to * (to + 1)) / 2 - (from * (from + 1)) / 2;
        const cost = pyramidCost(fromLevel, targetLevel);
        if (ank < cost) return;
        baseUpdates[`rooms/${roomCode}/gameState/pyramids/${slotId}/level`] = targetLevel;
        baseUpdates[`rooms/${roomCode}/gameState/players/${aiId}/ank`] = ank - cost;
        logText = `améliore sa pyramide ${pyr.color} au niveau ${targetLevel} pour ${cost} Ank`;
        logMeta = { type: "pyramid" };
        break;
      }
      default:
        return;
    }

    await update(ref(db, "/"), baseUpdates);
    if (logText) await logAction(aiId, logText, logMeta);
    await new Promise(res => setTimeout(res, 1500));
    await aiEndTurn(aiId);
  }

  // ── IA : effets de détection de tour ───────────────────────────────────────

  // Setup phase IA
  useEffect(() => {
    if (!gameState || gameState.phase !== "setup") return;
    const setupOrder = gameState.setupOrder || [];
    const setupIndex = gameState.setupIndex ?? 0;
    const currentSetupId = setupOrder[setupIndex];
    const currentSetupPlayer = currentPlayers.find(p => p.id === currentSetupId);
    if (!currentSetupPlayer?.isAI) return;
    const t = setTimeout(() => executeAISetup(currentSetupId), 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.phase, gameState?.setupIndex]);

  // Draft phase IA
  useEffect(() => {
    if (!gameState || gameState.phase !== "draft") return;
    const draftOrder = gameState.draftOrder || [];
    const draftIndex = gameState.draftIndex ?? 0;
    const currentDraftId = draftOrder[draftIndex];
    const currentDraftPlayer = currentPlayers.find(p => p.id === currentDraftId);
    if (!currentDraftPlayer?.isAI) return;
    const t = setTimeout(() => executeAIDraft(currentDraftId), 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.phase, gameState?.draftIndex]);

  // Placement phase IA (tous les IA simultanément)
  useEffect(() => {
    if (!gameState || gameState.phase !== "placement") return;
    const aiPlayers = currentPlayers.filter(p => p.isAI);
    if (aiPlayers.length === 0) return;
    const placements = gameState.placements || {};
    const unconfirmedAI = aiPlayers.filter(p => !placements[p.id]?.confirmed);
    if (unconfirmedAI.length === 0) return;
    const t = setTimeout(() => {
      unconfirmedAI.forEach(p => executeAIPlacement(p.id));
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.phase, JSON.stringify(gameState?.placements)]);

  // IA : auto-pass pour les cartes ID (les IA ne cancellent jamais)
  useEffect(() => {
    if (!pendingIdCard || pendingIdCard.cancelled) return;
    const responses = pendingIdCard.pendingResponses || {};
    const aiWaiting = Object.entries(responses).filter(([pid, status]) => {
      return status === "waiting" && currentPlayers.find(p => p.id === pid)?.isAI;
    });
    if (aiWaiting.length === 0) return;
    const t = setTimeout(() => {
      const updates = {};
      aiWaiting.forEach(([pid]) => {
        updates[`rooms/${roomCode}/pendingIdCard/pendingResponses/${pid}`] = "pass";
      });
      update(ref(db, "/"), updates);
    }, 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pendingIdCard?.pendingResponses)]);

  // Playing phase IA
  useEffect(() => {
    if (!gameState || gameState.phase !== "playing") return;
    if (combatData) return;
    const currentTurnPlayer = currentPlayers.find(p => p.id === gameState.currentTurnPlayerId);
    if (!currentTurnPlayer?.isAI) return;
    const t = setTimeout(() => executeAITurn(currentTurnPlayer.id), 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.currentTurnPlayerId, gameState?.phase, combatData]);

  async function handleActionToggle(pid, actionId) {
    // Conservé pour PlayerSummary (lecture seule côté adversaires)
    if (pid !== playerId) return;
  }

  async function markInfoEvent() {
    const snap = await get(ref(db, `rooms/${roomCode}/gameState`));
    if (!snap.exists()) return;
    const currentGs = snap.val();
    if (currentGs.currentTurnPlayerId !== effectivePlayerId) return;
    setLocalTurnHistory(prev => prev ? { ...prev, lastInfoState: currentGs } : null);
    update(ref(db, `rooms/${roomCode}/turnSnapshot`), { lastInfoState: currentGs });
  }

  async function handleCancelTurn() {
    let history = localTurnHistory;
    if (!history) {
      // Rechargement de page : récupère le snapshot depuis Firebase
      const snap = await get(ref(db, `rooms/${roomCode}/turnSnapshot`));
      if (!snap.exists()) return;
      const { startState, lastInfoState, playerId } = snap.val();
      if (playerId !== effectivePlayerId) return;
      history = { startState, lastInfoState: lastInfoState || null };
      setLocalTurnHistory(history);
    }
    const restoreState = history.lastInfoState || history.startState;
    if (!restoreState) return;
    await set(ref(db, `rooms/${roomCode}/gameState`), restoreState);
    setLocalTurnHistory({ startState: restoreState, lastInfoState: null });
    await update(ref(db, `rooms/${roomCode}/turnSnapshot`), { lastInfoState: null });
    setActionMode(null);
    setMoveState(null);
    setMoveConfig(null);
    await logAction(effectivePlayerId, "a annulé ses actions de ce tour");
  }

  function getPriestPositions(pid) {
    const raw = gameState?.taSetiPriestPositions?.[pid] || {};
    return [raw['0'] ?? '', raw['1'] ?? '', raw['2'] ?? ''];
  }

  function getPriestAllDests() {
    const positions = getPriestPositions(effectivePlayerId);
    const layout = gameState?.taSetiLayout;
    return positions.map(pos => getValidPriestDestinations(pos, layout));
  }

  function getPriestValidDestinations() {
    if (!pendingMoveAction) return [];
    const allDests = getPriestAllDests();
    if (selectedPriestIndex !== null) return allDests[selectedPriestIndex];
    // Destinations identiques pour tous → pas besoin de choisir
    const ref0 = JSON.stringify(allDests[0].slice().sort());
    if (allDests.every(d => JSON.stringify(d.slice().sort()) === ref0)) return allDests[0];
    return [];
  }

  function needsPriestSelection() {
    if (!pendingMoveAction || selectedPriestIndex !== null) return false;
    const allDests = getPriestAllDests();
    const ref0 = JSON.stringify(allDests[0].slice().sort());
    return !allDests.every(d => JSON.stringify(d.slice().sort()) === ref0);
  }

  const JI_EFFECT_MAP = {
    'JI_bouclier':    { type: 'combatShields', value: 1 },
    'JI_deplacement': { type: 'moveBonus', value: 1 },
    'JI_force':       { type: 'combatForce', value: 1 },
    'JI_ID':          { type: 'idCard', value: 1 },
  };

  async function handlePriestDestinationClick(nodeId) {
    const positions = getPriestPositions(effectivePlayerId);
    let priestIndex = selectedPriestIndex;
    const layout = gameState?.taSetiLayout;
    if (priestIndex === null) {
      priestIndex = positions.findIndex(pos =>
        getValidPriestDestinations(pos, layout).includes(nodeId)
      );
      if (priestIndex < 0) priestIndex = 0;
    }
    const oldPos = positions[priestIndex];
    const newPositions = [...positions];
    newPositions[priestIndex] = nodeId;

    const faces = Array.isArray(layout) ? layout : Object.values(layout);
    const myState = gameState?.players?.[effectivePlayerId] || {};
    const updates = {
      [`rooms/${roomCode}/gameState/taSetiPriestPositions/${effectivePlayerId}/0`]: newPositions[0],
      [`rooms/${roomCode}/gameState/taSetiPriestPositions/${effectivePlayerId}/1`]: newPositions[1],
      [`rooms/${roomCode}/gameState/taSetiPriestPositions/${effectivePlayerId}/2`]: newPositions[2],
    };

    // Nœud I traversé → appliquer ses bonus
    const iNode = getTraversedINode(oldPos, nodeId, layout);
    if (iNode) {
      const iMatch = iNode.match(/^I_(\d+)_/);
      if (iMatch) {
        const iSection = parseInt(iMatch[1]);
        const iFaceKey = `${iSection}${faces[iSection - 1]}`;
        const iBonuses = TASETI_I_BONUSES[iFaceKey]?.[iNode] ?? [];
        iBonuses.forEach(b => applyTaSetiBonusToUpdates(b, effectivePlayerId, myState, updates));
      }
    }

    // E_4_2 : bout de piste → 1er prêtre du jour +1 PV, prêtre retourne en réserve
    if (nodeId === 'E_4_2') {
      if (!gameState?.taSetiE4_2DailyVp) {
        const base = updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/vpPermanent`] ?? (myState.vpPermanent ?? 0);
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/vpPermanent`] = base + 1;
        updates[`rooms/${roomCode}/gameState/taSetiE4_2DailyVp`] = true;
      }
      updates[`rooms/${roomCode}/gameState/taSetiPriestPositions/${effectivePlayerId}/${priestIndex}`] = '';
      await update(ref(db, "/"), updates);
      setActionMode(pendingMoveAction);
      setPendingMoveAction(null);
      setSelectedPriestIndex(null);
      setShowTaSeti(false);
      return;
    }

    // Nœud E_ de destination → appliquer ses bonus
    const eMatch = nodeId.match(/^E_(\d+)_/);
    if (eMatch) {
      const eSection = parseInt(eMatch[1]);
      const eFaceKey = `${eSection}${faces[eSection - 1]}`;
      const eBonuses = TASETI_E_BONUSES[eFaceKey]?.[nodeId] ?? [];
      eBonuses.forEach(b => applyTaSetiBonusToUpdates(b, effectivePlayerId, myState, updates));

      // Vérifier les jetons disponibles à cet emplacement
      const tokenNodeIds = E_TO_TOKENS[eFaceKey]?.[nodeId] ?? [];
      const availableTokens = tokenNodeIds
        .map(tid => {
          let cardId = null;
          if (tid.startsWith('JI')) cardId = gameState?.jiAssignment?.[tid];
          else if (tid.startsWith('JU')) cardId = gameState?.puAssignment?.[tid];
          else if (tid.startsWith('JP')) cardId = gameState?.jpAssignment?.[tid];
          return cardId ? { nodeId: tid, cardId } : null;
        })
        .filter(Boolean);

      await update(ref(db, "/"), updates);
      setActionMode(pendingMoveAction);
      setPendingMoveAction(null);
      setSelectedPriestIndex(null);

      if (availableTokens.length > 0) {
        setPendingTokenPickup({ priestIndex, tokens: availableTokens });
        // showTaSeti reste ouvert, le modal s'affiche par-dessus
      } else {
        setShowTaSeti(false);
      }
      return;
    }

    await update(ref(db, "/"), updates);
    setActionMode(pendingMoveAction);
    setPendingMoveAction(null);
    setSelectedPriestIndex(null);
    setShowTaSeti(false);
  }

  async function handleTokenPickup({ jpToken, zoneId }) {
    if (!pendingTokenPickup) return;
    const myState = gameState?.players?.[effectivePlayerId] || {};
    const col = me?.color;
    const updates = {};
    const { priestIndex, tokens } = pendingTokenPickup;

    const jiTokens = tokens.filter(t => t.nodeId.startsWith('JI'));
    const juTokens = tokens.filter(t => t.nodeId.startsWith('JU'));

    // JI → effet immédiat
    jiTokens.forEach(token => {
      const effect = JI_EFFECT_MAP[token.cardId];
      if (effect) applyTaSetiBonusToUpdates(effect, effectivePlayerId, myState, updates);
      updates[`rooms/${roomCode}/gameState/jiAssignment/${token.nodeId}`] = null;
    });

    // JU → main du joueur
    if (juTokens.length > 0) {
      const existingHand = myState.juTokenHand || [];
      updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/juTokenHand`] =
        [...existingHand, ...juTokens.map(t => ({ nodeId: t.nodeId, cardId: t.cardId }))];
      juTokens.forEach(t => { updates[`rooms/${roomCode}/gameState/puAssignment/${t.nodeId}`] = null; });
    }

    if (jpToken) {
      updates[`rooms/${roomCode}/gameState/jpAssignment/${jpToken.nodeId}`] = null;

      if (zoneId && (gameState?.boardUnits?.[zoneId]?.[col] || 0) > 0) {
        // Prêtre rejoint la troupe (s'ajoute aux unités existantes sans en retirer)
        const existingPriest = gameState?.boardPriests?.[zoneId]?.[col] || {};
        const jpTokenIds = [...(existingPriest.jpTokenIds || []), jpToken.cardId];
        updates[`rooms/${roomCode}/gameState/boardPriests/${zoneId}/${col}`] = { priestIndex, jpTokenIds };
        updates[`rooms/${roomCode}/gameState/taSetiPriestPositions/${effectivePlayerId}/${priestIndex}`] = 'BOARD';
      } else {
        // Pas de troupe disponible → prêtre devient une unité en réserve, jeton stocké
        const jpHand = myState.jpTokenHand || [];
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/jpTokenHand`] = [...jpHand, jpToken.cardId];
        updates[`rooms/${roomCode}/gameState/players/${effectivePlayerId}/unitsReserve`] = (myState.unitsReserve ?? 0) + 1;
        updates[`rooms/${roomCode}/gameState/taSetiPriestPositions/${effectivePlayerId}/${priestIndex}`] = '';
      }
    } else {
      // JI et/ou JU uniquement → prêtre retourne dans la réserve des prêtres
      updates[`rooms/${roomCode}/gameState/taSetiPriestPositions/${effectivePlayerId}/${priestIndex}`] = '';
    }

    await update(ref(db, "/"), updates);
    setPendingTokenPickup(null);
    setShowTaSeti(false);
  }

  function handleTokenLeave() {
    setPendingTokenPickup(null);
    setShowTaSeti(false);
  }

  function applyTaSetiBonusToUpdates(bonus, pid, playerState, updates) {
    const base = `rooms/${roomCode}/gameState/players/${pid}`;
    switch (bonus.type) {
      case 'ank':
        updates[`${base}/ank`] = Math.min(11, (updates[`${base}/ank`] ?? playerState.ank ?? 7) + bonus.value);
        break;
      case 'tasetiRecruit':
        updates[`${base}/tasetiRecruitPending`] = (updates[`${base}/tasetiRecruitPending`] ?? playerState.tasetiRecruitPending ?? 0) + bonus.value;
        break;
      case 'moveBonus':
        updates[`${base}/pendingMoveBonus`] = (updates[`${base}/pendingMoveBonus`] ?? playerState.pendingMoveBonus ?? 0) + bonus.value;
        break;
      case 'combatShields':
        updates[`${base}/tasetiShields`] = (updates[`${base}/tasetiShields`] ?? playerState.tasetiShields ?? 0) + bonus.value;
        break;
      case 'combatBlood':
        updates[`${base}/tasetiBlood`] = (updates[`${base}/tasetiBlood`] ?? playerState.tasetiBlood ?? 0) + bonus.value;
        break;
      case 'combatForce':
        updates[`${base}/tasetiForce`] = (updates[`${base}/tasetiForce`] ?? playerState.tasetiForce ?? 0) + bonus.value;
        break;
      case 'destroyUnit':
        updates[`${base}/pendingDestroyUnit`] = true;
        break;
      case 'vp':
        updates[`${base}/vpPermanent`] = (updates[`${base}/vpPermanent`] ?? playerState.vpPermanent ?? 0) + bonus.value;
        break;
      case 'idCard': {
        const deck = [...(gameState?.idDeck || [])];
        if (deck.length > 0) {
          const { hand, remaining } = dealCards(deck, bonus.value);
          const currentCards = playerState.idCards || [];
          updates[`rooms/${roomCode}/gameState/idDeck`] = remaining;
          updates[`${base}/idCards`] = [...currentCards, ...hand];
        }
        break;
      }
      default: break;
    }
  }

  async function handleEndTurn() {
    if (!gameState) return;
    const myState = gameState.players?.[effectivePlayerId] || {};
    if ((myState.actionsThisTurn ?? 0) < 1) return;

    const sorted = [...currentPlayers].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(p => p.id === effectivePlayerId);
    const next = sorted[(idx + 1) % sorted.length];

    await update(ref(db, `rooms/${roomCode}/gameState`), {
      currentTurnPlayerId: next.id,
      [`players/${next.id}/actionsThisTurn`]: 0,
    });
    await logAction(effectivePlayerId, `a terminé son tour → ${next.name} joue`);

    const allDone = currentPlayers.every(p => (gameState.players?.[p.id]?.tokens ?? 5) === 0);
    if (allDone) setShowNight(true);
  }

  const effectiveSession = {
    ...session,
    playerId: effectivePlayerId,
    playerColor: me?.color ?? session.playerColor,
    allPlayers: currentPlayers,
  };

  async function logTileBuy(actorId, tile) {
    if (!tile) return;
    await logAction(actorId, `acquiert la tuile "${tile.name}"`, { type: "tile", tileId: tile.id });
  }

  async function logAction(actorId, text, meta = null) {
    const actor = currentPlayers.find(p => p.id === actorId);
    if (!actor) return;
    await update(ref(db, `rooms/${roomCode}/actionLog`), {
      [Date.now()]: { playerName: actor.name, color: actor.color, text, time: Date.now(), ...(meta && { meta }) },
    });
  }

  // ── Fuite ──────────────────────────────────────────────────────────────────
  async function handleFleeAccept(chosenZoneId) {
    const offer = fleeOffer;
    if (!offer) return;
    const defColor = currentPlayers.find(p => p.id === offer.defenderId)?.color;
    const defUnits = gameState?.boardUnits?.[offer.zoneId]?.[defColor] || 0;
    const defIdCards = gameState?.players?.[offer.defenderId]?.idCards || [];
    const fuiteCard = defIdCards.find(c => c.id === "la_fuite");
    const updates = {};
    if (defUnits > 0) {
      const existing = gameState?.boardUnits?.[chosenZoneId]?.[defColor] || 0;
      updates[`rooms/${roomCode}/gameState/boardUnits/${offer.zoneId}/${defColor}`] = 0;
      updates[`rooms/${roomCode}/gameState/boardUnits/${chosenZoneId}/${defColor}`] = existing + defUnits;
      const ca = gameState?.creatureAssignments;
      if (ca?.[offer.zoneId]?.[defColor]) {
        updates[`rooms/${roomCode}/gameState/creatureAssignments/${offer.zoneId}/${defColor}`] = null;
        updates[`rooms/${roomCode}/gameState/creatureAssignments/${chosenZoneId}/${defColor}`] = ca[offer.zoneId][defColor];
      }
      const ca2 = gameState?.creatureAssignments2;
      if (ca2?.[offer.zoneId]?.[defColor]) {
        updates[`rooms/${roomCode}/gameState/creatureAssignments2/${offer.zoneId}/${defColor}`] = null;
        updates[`rooms/${roomCode}/gameState/creatureAssignments2/${chosenZoneId}/${defColor}`] = ca2[offer.zoneId][defColor];
      }
    }
    if (fuiteCard) {
      updates[`rooms/${roomCode}/gameState/players/${offer.defenderId}/idCards`] = defIdCards.filter(c => c.instanceId !== fuiteCard.instanceId);
    }
    updates[`rooms/${roomCode}/combat`] = null;
    updates[`rooms/${roomCode}/fleeOffer`] = null;
    updates[`rooms/${roomCode}/fleeResult`] = {
      attackerId: offer.attackerId,
      zoneId: offer.zoneId,
      attackerPointsRemaining: offer.attackerPointsRemaining,
      forbiddenZoneId: chosenZoneId,
      attackerMoveData: offer.attackerMoveData,
    };
    await update(ref(db, "/"), updates);
    await logAction(offer.defenderId, `joue La Fuite et se replie en ${chosenZoneId}`);
    await logAction(offer.attackerId, `prend ${offer.zoneId} sans combat (fuite)`);
  }

  async function handleFleeDecline() {
    await update(ref(db, "/"), { [`rooms/${roomCode}/fleeOffer`]: null });
  }

  // ── Cartes ID de jour ──────────────────────────────────────────────────────
  async function applyDayIdCardEffect(cardData, actorId) {
    const effect = cardData?.effect;
    if (!effect) return;
    // Lecture fraîche depuis Firebase pour éviter les valeurs périmées de la closure
    const snap = await get(ref(db, `rooms/${roomCode}/gameState`));
    const freshState = snap.exists() ? snap.val() : {};
    const ps = freshState?.players?.[actorId] || {};
    const updates = {};
    switch (effect.type) {
      case 'ank':
        updates[`rooms/${roomCode}/gameState/players/${actorId}/ank`] = Math.min(11, (ps.ank ?? 0) + (effect.value || 0));
        break;
      case 'units':
        updates[`rooms/${roomCode}/gameState/players/${actorId}/unitsReserve`] = (ps.unitsReserve ?? 0) + (effect.value || 0);
        break;
      case 'taxation':
        updates[`rooms/${roomCode}/gameState/players/${actorId}/ank`] = Math.min(11, (ps.ank ?? 0) + 1);
        currentPlayers.filter(p => p.id !== actorId).forEach(p => {
          const ops = freshState?.players?.[p.id] || {};
          updates[`rooms/${roomCode}/gameState/players/${p.id}/ank`] = Math.max(0, (ops.ank ?? 0) - 1);
        });
        break;
      case 'recover_id':
        updates[`rooms/${roomCode}/gameState/players/${actorId}/idRecoverPending`] = true;
        break;
      case 'movement':
        updates[`rooms/${roomCode}/gameState/players/${actorId}/pendingMoveBonus`] = (ps.pendingMoveBonus ?? 0) + (effect.value || 1);
        break;
      case 'teleport':
        updates[`rooms/${roomCode}/gameState/players/${actorId}/pendingFreeAnyTeleport`] = true;
        break;
      case 'wall_pass':
        updates[`rooms/${roomCode}/gameState/players/${actorId}/pendingWallPass`] = true;
        break;
      case 'destroy_unit':
        updates[`rooms/${roomCode}/gameState/players/${actorId}/pendingDestroyUnit`] = true;
        break;
      default: break;
    }
    const currentDiscard = freshState?.idDiscard || [];
    updates[`rooms/${roomCode}/gameState/idDiscard`] = [...currentDiscard, cardData];
    await update(ref(db, "/"), updates);
    await logAction(actorId, `effet de ${cardData.name} appliqué`);
  }

  async function handlePlayDayIdCard(card) {
    const myCards = gameState?.players?.[effectivePlayerId]?.idCards || [];
    const filteredCards = myCards.filter(c => c.instanceId !== card.instanceId);
    const opponentsWithCancel = card.timing === "day" ? currentPlayers
      .filter(p => p.id !== effectivePlayerId)
      .filter(p => !p.isAI)
      .filter(p => (gameState?.players?.[p.id]?.idCards || []).some(c => c.id === "annulation_id")) : [];

    if (opponentsWithCancel.length === 0) {
      await update(ref(db, "/"), {
        [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/idCards`]: filteredCards,
      });
      await applyDayIdCardEffect(card, effectivePlayerId);
    } else {
      const pendingResponses = {};
      opponentsWithCancel.forEach(p => { pendingResponses[p.id] = "waiting"; });
      await update(ref(db, "/"), {
        [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/idCards`]: filteredCards,
        [`rooms/${roomCode}/pendingIdCard`]: { actorId: effectivePlayerId, cardData: card, cancelled: false, pendingResponses },
      });
    }
    await logAction(effectivePlayerId, `joue ${card.name}`);
  }

  async function handleCancelIdCard() {
    if (!pendingIdCard || pendingIdCard.cancelled) return;
    const myCards = gameState?.players?.[effectivePlayerId]?.idCards || [];
    const annulCard = myCards.find(c => c.id === "annulation_id");
    if (!annulCard) return;
    const currentDiscard = gameState?.idDiscard || [];
    const newDiscard = [...currentDiscard, annulCard, pendingIdCard.cardData].filter(Boolean);
    await update(ref(db, "/"), {
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/idCards`]: myCards.filter(c => c.instanceId !== annulCard.instanceId),
      [`rooms/${roomCode}/gameState/idDiscard`]: newDiscard,
      [`rooms/${roomCode}/pendingIdCard/cancelled`]: true,
    });
    await logAction(effectivePlayerId, `annule ${pendingIdCard.cardData?.name} de ${currentPlayers.find(p => p.id === pendingIdCard.actorId)?.name ?? "?"}`);
    if (isTestMode) setTestViewPlayerId(pendingIdCard.actorId);
  }

  async function handlePassCancelId() {
    if (!pendingIdCard) return;
    await update(ref(db, "/"), {
      [`rooms/${roomCode}/pendingIdCard/pendingResponses/${effectivePlayerId}`]: "pass",
    });
    if (isTestMode) {
      const responses = pendingIdCard.pendingResponses || {};
      const nextWaiting = Object.entries(responses)
        .find(([pid, status]) => pid !== effectivePlayerId && status === "waiting");
      if (nextWaiting) setTestViewPlayerId(nextWaiting[0]);
      else setTestViewPlayerId(pendingIdCard.actorId);
    }
  }

  async function handleIdRecoverPick(card) {
    const myCards = gameState?.players?.[effectivePlayerId]?.idCards || [];
    const idDiscard = gameState?.idDiscard || [];
    let removed = false;
    const newDiscard = idDiscard.filter(c => {
      if (!removed && c.instanceId === card.instanceId) { removed = true; return false; }
      return true;
    });
    await update(ref(db, "/"), {
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/idCards`]: [...myCards, { ...card, instanceId: `${card.id}_rec_${Date.now()}` }],
      [`rooms/${roomCode}/gameState/idDiscard`]: newDiscard,
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/idRecoverPending`]: null,
    });
  }

  async function handleVictoryRecruitClick(zoneId) {
    const pending = gameState?.players?.[effectivePlayerId]?.victoryRecruitPending ?? 0;
    if (pending <= 0) return;
    const col = me?.color;
    const current = gameState?.boardUnits?.[zoneId]?.[col] || 0;
    await update(ref(db, "/"), {
      [`rooms/${roomCode}/gameState/boardUnits/${zoneId}/${col}`]: current + 1,
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/victoryRecruitPending`]: pending - 1,
    });
  }

  async function handleTasetiRecruitClick(zoneId) {
    const pending = gameState?.players?.[effectivePlayerId]?.tasetiRecruitPending ?? 0;
    if (pending <= 0) return;
    const col = me?.color;
    const reserve = gameState?.players?.[effectivePlayerId]?.unitsReserve ?? 0;
    if (reserve <= 0) {
      // Plus d'unités en réserve : annuler le pending restant
      await update(ref(db, "/"), {
        [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/tasetiRecruitPending`]: null,
      });
      return;
    }
    const current = gameState?.boardUnits?.[zoneId]?.[col] || 0;
    await update(ref(db, "/"), {
      [`rooms/${roomCode}/gameState/boardUnits/${zoneId}/${col}`]: current + 1,
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/unitsReserve`]: reserve - 1,
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/tasetiRecruitPending`]: pending - 1,
    });
  }

  async function handleDestroyUnitClick(zoneId) {
    if (!gameState?.players?.[effectivePlayerId]?.pendingDestroyUnit) return;
    const col = me?.color;
    const units = gameState?.boardUnits?.[zoneId] || {};
    const enemyEntry = Object.entries(units).find(([c, cnt]) => c !== col && (cnt || 0) > 0);
    if (!enemyEntry) return;
    const [enemyColor, enemyCount] = enemyEntry;
    const enemyPlayerId = currentPlayers.find(p => p.color === enemyColor)?.id;
    const updates = {
      [`rooms/${roomCode}/gameState/boardUnits/${zoneId}/${enemyColor}`]: enemyCount - 1,
      [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/pendingDestroyUnit`]: null,
    };
    if (enemyPlayerId) {
      const epsReserve = gameState?.players?.[enemyPlayerId]?.unitsReserve ?? 0;
      updates[`rooms/${roomCode}/gameState/players/${enemyPlayerId}/unitsReserve`] = epsReserve + 1;
    }
    await update(ref(db, "/"), updates);
    setActionMode(null);
  }

  // Zones de recrutement de victoire (Recrutement de Victoire)
  const myJoinOrderForRecruit = currentPlayers.find(p => p.id === effectivePlayerId)?.joinOrder;
  const victoryRecruitPending = gameState?.players?.[effectivePlayerId]?.victoryRecruitPending ?? 0;
  const victoryRecruitZones = (actionMode === "victoryRecruit" && myJoinOrderForRecruit && victoryRecruitPending > 0)
    ? BOARD_ZONES.filter(z =>
        z.id.startsWith(`J${myJoinOrderForRecruit}C`) ||
        (gameState?.boardUnits?.[z.id]?.[me?.color] || 0) > 0
      ).map(z => z.id)
    : [];

  // Zones de recrutement Ta-Seti (cité + troupes existantes partout, sans coût ank)
  const tasetiRecruitPending = gameState?.players?.[effectivePlayerId]?.tasetiRecruitPending ?? 0;
  const tasetiRecruitZones = (actionMode === "tasetiRecruit" && myJoinOrderForRecruit && tasetiRecruitPending > 0)
    ? BOARD_ZONES.filter(z =>
        z.id.startsWith(`J${myJoinOrderForRecruit}C`) ||
        (gameState?.boardUnits?.[z.id]?.[me?.color] || 0) > 0
      ).map(z => z.id)
    : [];

  // Zones de destruction (Pluie de Feu)
  const destroyUnitZones = actionMode === "destroyUnit"
    ? Object.keys(gameState?.boardUnits || {}).filter(zId => {
        const units = gameState.boardUnits[zId] || {};
        return Object.entries(units).some(([c, cnt]) => c !== me?.color && (cnt || 0) > 0);
      })
    : [];

  // Zones de retraite post-combat : cliquables directement sur le plateau
  const retreatZones = (() => {
    if (!combatData || combatData.status !== "post_combat") return [];
    const pc = combatData.postCombat;
    if (!pc || pc.retreatZoneId != null || pc.loserChoice != null) return [];
    const canAct = effectivePlayerId === pc.winnerId || isTestMode;
    if (!canAct) return [];
    return (ZONE_ADJACENCY[combatData.zoneId] || []).filter(z =>
      (gameState?.boardUnits?.[z]?.[pc.winnerColor] ?? 0) === 0
    );
  })();

  async function handleRetreatZoneSelect(zoneId) {
    await update(ref(db, "/"), {
      [`rooms/${roomCode}/combat/postCombat/retreatZoneId`]: zoneId,
    });
  }

  return (
  <div
    className="h-screen text-white flex flex-col overflow-hidden"
    style={{ backgroundImage: 'url(/ui/backend.png)', backgroundRepeat: 'repeat', backgroundSize: 'auto' }}
  >


    {/* Barre sélecteur de joueur (mode test uniquement) */}
    {isTestMode && (
      <div className="flex items-center gap-2 px-4 py-1.5 bg-yellow-950/80 border-b border-yellow-700/40 shrink-0">
        <span className="text-yellow-400 text-xs font-bold shrink-0">Vue :</span>
        {currentPlayers.map(p => {
          const isSelected = testViewPlayerId === p.id;
          const isCurrentTurn = gameState?.currentTurnPlayerId === p.id;
          const badges = {
            Rouge: isSelected ? "bg-red-600 text-white" : "bg-red-900/50 text-red-300 hover:bg-red-800/60",
            Bleu:  isSelected ? "bg-blue-600 text-white" : "bg-blue-900/50 text-blue-300 hover:bg-blue-800/60",
            Vert:  isSelected ? "bg-emerald-600 text-white" : "bg-emerald-900/50 text-emerald-300 hover:bg-emerald-800/60",
            Blanc: isSelected ? "bg-gray-300 text-gray-900" : "bg-gray-700/50 text-gray-300 hover:bg-gray-600/60",
            Noir:  isSelected ? "bg-gray-600 text-white" : "bg-gray-900/50 text-gray-400 hover:bg-gray-800/60",
          };
          return (
            <button
              key={p.id}
              onClick={() => { setTestViewPlayerId(p.id); setActionMode(null); setMoveState(null); setMoveConfig(null); }}
              className={`px-3 py-0.5 rounded-full text-xs font-bold transition-all border ${
                isSelected ? "border-yellow-400" : "border-transparent"
              } ${badges[p.color] || "bg-gray-700 text-white"}`}
            >
              {p.name}{isCurrentTurn ? " ⚡" : ""}
            </button>
          );
        })}
        {combatData && (
          <button
            onClick={() => remove(ref(db, `rooms/${roomCode}/combat`))}
            className="ml-auto px-2 py-0.5 rounded text-[10px] font-bold bg-red-900/60 hover:bg-red-800 text-red-300 border border-red-700/40"
          >
            ✕ Reset combat
          </button>
        )}
      </div>
    )}

    {/* Header principal — KEMET + ordre + décorations */}
    <div className="flex items-center shrink-0 select-none" style={{ height: 62, background: '#080604', borderBottom: '1px solid #4a3410' }}>

      {/* Logo KEMET avec ailes */}
      <div className="flex items-center h-full px-4 shrink-0" style={{ borderRight: '1px solid #3a2a0c' }}>
        <img src="/ui/logo_wings.png" alt="KEMET" className="h-9 object-contain" style={{ filter: 'brightness(1.1) drop-shadow(0 0 6px rgba(180,120,20,0.4))' }} />
      </div>

      {/* ORDRE + badges joueurs */}
      <div className="flex items-center gap-2 px-5 flex-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] shrink-0" style={{ color: '#6B4C1E' }}>ORDRE</span>
        <span className="shrink-0" style={{ color: '#3a2a0c', fontSize: 14 }}>|</span>
        {currentPlayers.map(p => {
          const isActive = gameState?.currentTurnPlayerId === p.id;
          const badges = {
            Rouge: { bg: '#7f1d1d', hover: '#991b1b', text: '#fca5a5', border: '#dc2626' },
            Bleu:  { bg: '#1e3a8a', hover: '#1d4ed8', text: '#93c5fd', border: '#3b82f6' },
            Vert:  { bg: '#14532d', hover: '#166534', text: '#86efac', border: '#22c55e' },
            Blanc: { bg: '#d1d5db', hover: '#e5e7eb', text: '#111827', border: '#9ca3af' },
            Noir:  { bg: '#1f2937', hover: '#374151', text: '#d1d5db', border: '#4b5563' },
          };
          const b = badges[p.color] || badges.Noir;
          return (
            <button
              key={p.id}
              onClick={() => setViewTilesPlayer(p)}
              title={`Voir les tuiles de ${p.name}`}
              style={{
                background: b.bg,
                border: `1px solid ${isActive ? b.border : b.bg}`,
                color: b.text,
                boxShadow: isActive ? `0 0 8px ${b.border}66` : 'none',
                opacity: isActive ? 1 : 0.65,
                padding: '3px 14px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                transition: 'all 0.15s',
              }}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Volume */}
      <div className="flex items-center px-3 h-full shrink-0" style={{ borderLeft: '1px solid #3a2a0c', minWidth: 150 }}>
        <VolumeControl volume={volume} onChange={setVolume} />
      </div>

      {/* Ta-Seti miniature (droite) */}
      <div className="flex items-center px-3 h-full shrink-0" style={{ borderLeft: '1px solid #3a2a0c' }}>
        {gameState?.taSetiLayout ? (
          <button
            onClick={() => setShowTaSeti(true)}
            title="Voir le plateau Ta-Seti"
            style={{ border: '1px solid #C9973A', borderRadius: 4, background: 'rgba(0,0,0,0.5)', padding: '2px 4px', boxShadow: '0 0 10px rgba(201,151,58,0.5), 0 0 24px rgba(201,151,58,0.2)' }}
          >
            <TaSetiBoard layout={gameState.taSetiLayout} height="48px" />
          </button>
        ) : (
          <span style={{ color: '#4a3410', fontSize: 24 }}>𓂀</span>
        )}
      </div>
    </div>

    {/* Zone principale */}
    <div className="flex-1 relative overflow-hidden">

	  {/* Plateau Kemet — fond plein écran */}
	  <div className="absolute inset-0">
	    <Board
		  session={effectiveSession}
		  gameState={gameState}
		  actionMode={actionMode}
		  moveState={moveState}
		  onBoardZoneClick={handleBoardZoneClick}
		  onMoveDone={handleMoveDone}
		  onMoveCancel={handleMoveCancel}
		  onTeleportStart={handleTeleportStart}
		  onTeleportCancel={handleTeleportCancel}
		  teleportCost={gameState?.players?.[effectivePlayerId]?.pendingFreeAnyTeleport ? 0 : computeTeleportCost(effectivePlayerId, moveState?.currentZoneId)}
		  retreatZones={retreatZones}
		  onRetreatZoneClick={handleRetreatZoneSelect}
		  wallPassActive={!!(gameState?.players?.[effectivePlayerId]?.pendingWallPass)}
		  freeAnyTeleportActive={!!(gameState?.players?.[effectivePlayerId]?.pendingFreeAnyTeleport)}
		  teleportFacileActive={!!(gameState?.players?.[effectivePlayerId]?.ownedTileIds || []).some(id => POWER_TILES.find(t => t.id === id)?.name === "Téléportation facile")}
		  victoryRecruitZones={victoryRecruitZones}
		  onVictoryRecruitClick={handleVictoryRecruitClick}
		  tasetiRecruitZones={tasetiRecruitZones}
		  onTasetiRecruitClick={handleTasetiRecruitClick}
		  destroyUnitZones={destroyUnitZones}
		  onDestroyUnitClick={handleDestroyUnitClick}
	    />
	  </div>

      {/* Cadres adversaires à gauche — superposés */}
      <div className="absolute top-0 left-0 flex flex-col gap-3 z-10 p-4">
        {opponents.map(p => (
          <div key={p.id} onClick={() => setViewTilesPlayer(p)} className="cursor-pointer">
            <PlayerSummary
              player={p}
              gameState={gameState}
              onActionToggle={handleActionToggle}
              currentTurnPlayerId={gameState?.currentTurnPlayerId}
              allPlayers={session.allPlayers}
            />
          </div>
        ))}
      </div>

	  {/* Panneau latéral droit — combat + journal — superposé */}
	  <div className="absolute top-0 right-0 w-72 h-full overflow-hidden flex flex-col z-10" style={{ background: 'rgba(8,6,4,0.93)', borderLeft: '1px solid #4a3410' }}>
	    {/* Header JOURNAL */}
	    <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #4a3410', background: '#0a0806' }}>
	      <span style={{ color: '#C9973A', fontSize: 18, lineHeight: 1 }}>𓂀</span>
	      <span style={{ color: '#C9973A', fontWeight: 700, fontSize: 13, letterSpacing: '0.25em', textTransform: 'uppercase' }}>Journal</span>
	    </div>
	    {showCombat && (
		  <CombatModal
		    session={effectiveSession}
		    effectivePlayerId={effectivePlayerId}
		    gameState={gameState}
		    isTestMode={isTestMode}
		    testPlayers={isTestMode ? currentPlayers : null}
		    testViewPlayerId={testViewPlayerId}
		    onSwitchTestPlayer={id => setTestViewPlayerId(id)}
		    logAction={logAction}
		  />
	    )}
	    <ActionLogPanel roomCode={roomCode} />
	  </div>

    </div>

    {/* Ma zone en bas */}
    {me && (
      <div className="shrink-0">
        <MyZone
          player={me}
          gameState={gameState}
          onActionActivate={handleActionActivate}
          onSetActionMode={handleSetActionMode}
          actionMode={actionMode}
          onEndTurn={handleEndTurn}
          onOpenTaSeti={() => setShowTaSeti(true)}
          onOpenCombat={() => setShowCombat(true)}
		  onOpenNight={() => setShowNight(true)}
		  onOpenDawn={() => setShowDawn(true)}
		  session={effectiveSession}
		  onMoveCancel={handleMoveCancel}
          onGoldenTokenMoveActivate={handleGoldenTokenMoveActivate}
          onGoldenTokenRecruitActivate={handleGoldenTokenRecruitActivate}
          onGoldenTokenPrayerActivate={handleGoldenTokenPrayerActivate}
          onGoldenTokenBuyActivate={handleGoldenTokenBuyActivate}
          onRenforcementActivate={handleRenforcementActivate}
          onPlayDayIdCard={handlePlayDayIdCard}
          onViewMyTiles={() => setViewTilesPlayer(me)}
          onCancelTurn={handleCancelTurn}
          canCancelTurn={
            gameState?.currentTurnPlayerId === effectivePlayerId &&
            !!localTurnHistory?.startState &&
            !combatData &&
            !actionMode &&
            (gameState?.players?.[effectivePlayerId]?.actionsThisTurn ?? 0) > 0
          }
          onInfoEvent={markInfoEvent}
        />
      </div>
    )}

    {gameState?.phase === "setup" && (
      <SetupPhaseModal
        session={effectiveSession}
        gameState={gameState}
        onConfirm={handleSetupConfirm}
        isTestMode={isTestMode}
        testPlayers={isTestMode ? currentPlayers : null}
        onSwitchTestPlayer={id => { setTestViewPlayerId(id); setActionMode(null); setMoveState(null); setMoveConfig(null); }}
      />
    )}

    {gameState?.phase === "draft" && (
      <DraftPhaseModal
        session={effectiveSession}
        gameState={gameState}
        onPick={handleDraftPick}
        isTestMode={isTestMode}
        testPlayers={isTestMode ? currentPlayers : null}
        onSwitchTestPlayer={id => { setTestViewPlayerId(id); setActionMode(null); setMoveState(null); setMoveConfig(null); }}
      />
    )}

    {gameState?.phase === "placement" && (
      <PlacementPhaseModal
        session={effectiveSession}
        gameState={gameState}
        onConfirm={handlePlacementConfirm}
        isTestMode={isTestMode}
        testPlayers={isTestMode ? currentPlayers : null}
        onSwitchTestPlayer={id => { setTestViewPlayerId(id); setActionMode(null); setMoveState(null); setMoveConfig(null); }}
      />
    )}

    {/* Modale config déplacement */}
    {moveConfig && (
      <MoveConfigModal
        zoneId={moveConfig.zoneId}
        playerColor={me?.color}
        gameState={gameState}
        movePoints={computeMovePoints(effectivePlayerId)}
        onConfirm={(count, creatureGoes, creatureId, creatureGoes2, creatureId2) => handleMoveStart(moveConfig.zoneId, count, creatureGoes, creatureId, creatureGoes2, creatureId2)}
        onClose={handleMoveCancel}
      />
    )}

    {/* Placement Cerbère après achat */}
    {pendingCerbereId && (
      <CreatureEquipModal
        playerId={effectivePlayerId}
        playerColor={me?.color}
        joinOrder={allPlayers.find(p => p.id === effectivePlayerId)?.joinOrder}
        gameState={gameState}
        anyZone={true}
        specificCreatureId={pendingCerbereId}
        onConfirm={async assignments => {
          const updates = {};
          Object.entries(assignments).forEach(([creatureId, zoneId]) => {
            updates[`rooms/${roomCode}/gameState/creatureAssignments/${zoneId}/${me?.color}`] = creatureId;
          });
          await update(ref(db, "/"), updates);
          setPendingCerbereId(null);
        }}
        onClose={() => setPendingCerbereId(null)}
      />
    )}

    {/* Modale Ta-Seti — zoom plein écran */}
    {showTaSeti && gameState?.taSetiLayout && (() => {
      const PRIEST_IMGS = { Rouge: 'Pretre_rouge', Bleu: 'Pretre_bleu', Vert: 'Pretre_vert', Blanc: 'Pretre_jaune', Noir: 'Pretre_noir' };
      const PRIEST_H = 120;
      const OFFSET = 10;
      const myPositions = getPriestPositions(effectivePlayerId);
      const selectMode = pendingMoveAction && needsPriestSelection();
      const validDestinations = getPriestValidDestinations();
      const mePlayer = currentPlayers.find(p => p.id === effectivePlayerId);
      const meImgFile = PRIEST_IMGS[mePlayer?.color] || 'Pretre_noir';
      const layout = gameState.taSetiLayout;

      // Prêtres de réserve (in reserve = position vide) du joueur actif
      const myReservePriests = myPositions
        .map((pos, i) => ({ pos, i }))
        .filter(({ pos }) => !pos || pos === '');

      function handleReservePriestClick(priestIndex) {
        const dests = getValidPriestDestinations('', layout);
        if (dests.length === 0) return;
        setSelectedPriestIndex(priestIndex);
      }

      return (
        <div
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 cursor-pointer"
          onClick={() => { setShowTaSeti(false); setPendingMoveAction(null); setSelectedPriestIndex(null); }}
        >
          <div
            className="flex flex-col items-center gap-3"
            onClick={e => e.stopPropagation()}
          >
            {pendingMoveAction && (
              <div style={{ color: '#C9973A', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {selectMode
                  ? 'Cliquez sur le prêtre à avancer'
                  : selectedPriestIndex !== null
                    ? `Prêtre ${selectedPriestIndex + 1} — Cliquez sur un emplacement doré`
                    : 'Cliquez sur un emplacement doré pour avancer'}
              </div>
            )}

            <div className="flex flex-row items-stretch gap-3">

              {/* Panneau prêtres — gauche */}
              <div style={{
                background: 'rgba(8,6,4,0.92)',
                border: '1px solid #4a3410',
                borderRadius: 6,
                padding: '12px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                minWidth: 130,
                alignItems: 'center',
              }}>
                <div style={{ color: '#C9973A', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  {pendingMoveAction ? 'Prêtres' : 'Réserve'}
                </div>

                {pendingMoveAction ? (
                  // Mode avancement — réserve du joueur actif (prêtres cliquables si sélection nécessaire)
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
                    {/* Prêtres en réserve */}
                    {myReservePriests.length > 0 && (() => {
                      const canSelect = selectMode || selectedPriestIndex === null;
                      const reserveDests = getValidPriestDestinations('', layout);
                      const isSelectable = selectMode && reserveDests.length > 0;
                      const imgW = PRIEST_H * 0.6;
                      const stackW = imgW + OFFSET * Math.min(myReservePriests.length - 1, 2);
                      const stackH = PRIEST_H + OFFSET * Math.min(myReservePriests.length - 1, 2);
                      return (
                        <div
                          onClick={isSelectable ? () => handleReservePriestClick(myReservePriests[0].i) : undefined}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            cursor: isSelectable ? 'pointer' : 'default',
                          }}
                        >
                          <div style={{ position: 'relative', width: stackW, height: stackH }}>
                            {myReservePriests.map(({ i }, stackIdx) => (
                              <img
                                key={i}
                                src={`/${meImgFile}.png`}
                                alt="prêtre en réserve"
                                draggable={false}
                                style={{
                                  position: 'absolute',
                                  bottom: stackIdx * OFFSET, left: stackIdx * OFFSET,
                                  width: imgW, height: 'auto', zIndex: stackIdx,
                                  filter: isSelectable
                                    ? 'drop-shadow(0 0 6px #c084fc) brightness(1.2)'
                                    : 'drop-shadow(0 2px 4px rgba(0,0,0,0.7))',
                                  outline: isSelectable ? '2px solid #c084fc' : 'none',
                                  borderRadius: 4,
                                  pointerEvents: 'none',
                                }}
                              />
                            ))}
                          </div>
                          <div style={{ color: '#a88a40', fontSize: 9 }}>
                            Réserve ({myReservePriests.length})
                            {isSelectable && <span style={{ color: '#c084fc' }}> ← cliquer</span>}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Bouton "Changer" si prêtre sélectionné */}
                    {selectedPriestIndex !== null && (
                      <button
                        onClick={() => setSelectedPriestIndex(null)}
                        style={{ fontSize: 9, color: '#666', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        ← Changer de prêtre
                      </button>
                    )}
                  </div>
                ) : (
                  // Mode normal : réserve par joueur
                  currentPlayers.map(p => {
                    const positions = getPriestPositions(p.id);
                    const reserve = positions.filter(pos => !pos || pos === '').length;
                    const imgFile = PRIEST_IMGS[p.color] || 'Pretre_noir';
                    const imgW = PRIEST_H * 0.6;
                    const stackW = imgW + OFFSET * 2;
                    const stackH = PRIEST_H + OFFSET * 2;
                    return (
                      <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ position: 'relative', width: reserve > 0 ? stackW : imgW, height: reserve > 0 ? stackH : 24 }}>
                          {reserve === 0 ? (
                            <div style={{ color: '#3a2a0c', fontSize: 10, textAlign: 'center', paddingTop: 4 }}>—</div>
                          ) : (
                            Array.from({ length: reserve }).map((_, i) => (
                              <img
                                key={i}
                                src={`/${imgFile}.png`}
                                alt={`prêtre ${p.color}`}
                                style={{
                                  position: 'absolute',
                                  bottom: i * OFFSET, left: i * OFFSET,
                                  width: imgW, height: 'auto', zIndex: i,
                                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.7))',
                                }}
                                draggable={false}
                              />
                            ))
                          )}
                        </div>
                        <div style={{ color: '#a88a40', fontSize: 10, fontWeight: 600 }}>{p.name}</div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Plateau Ta-Seti */}
              <TaSetiBoard
                layout={gameState.taSetiLayout}
                zoom={true}
                puAssignment={gameState.puAssignment}
                jiAssignment={gameState.jiAssignment}
                jpAssignment={gameState.jpAssignment}
                priestPositions={gameState.taSetiPriestPositions}
                players={currentPlayers}
                validDestinations={validDestinations}
                onDestinationClick={pendingMoveAction && !selectMode ? handlePriestDestinationClick : null}
                selectablePlayerId={selectMode ? effectivePlayerId : null}
                onPriestSelect={selectMode ? setSelectedPriestIndex : null}
              />
            </div>

            <button
              onClick={() => { setShowTaSeti(false); setPendingMoveAction(null); setSelectedPriestIndex(null); }}
              className="text-gray-400 hover:text-white text-sm px-4 py-1 border border-gray-600 rounded"
            >
              {pendingMoveAction ? 'Annuler le déplacement' : 'Fermer'}
            </button>
          </div>
        </div>
      );
    })()}

	{showDawn && (
	  <DawnModal
		onClose={() => setShowDawn(false)}
		session={effectiveSession}
		gameState={gameState}
		isTestMode={isTestMode}
		testPlayers={isTestMode ? currentPlayers : null}
		onSwitchTestPlayer={id => { setTestViewPlayerId(id); setActionMode(null); setMoveState(null); setMoveConfig(null); }}
	  />
	)}
	
	{showNight && (
	  <NightModal
		onClose={() => setShowNight(false)}
		session={effectiveSession}
		gameState={gameState}
	  />
	)}

    {/* Fuite secrète — visible uniquement au défenseur */}
    {fleeOffer && fleeOffer.defenderId === effectivePlayerId && (
      <FleeModal
        fleeOffer={fleeOffer}
        gameState={gameState}
        currentPlayers={currentPlayers}
        onAccept={handleFleeAccept}
        onDecline={handleFleeDecline}
      />
    )}

    {/* Annulation d'ID — attente côté acteur */}
    {pendingIdCard &&
     !pendingIdCard.cancelled &&
     pendingIdCard.actorId === effectivePlayerId &&
     Object.values(pendingIdCard.pendingResponses || {}).some(v => v === "waiting") && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
        <div className="bg-gray-900 border border-amber-600 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
          {isTestMode && (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-yellow-950/80 border-b border-yellow-700/40">
              <span className="text-yellow-400 text-xs font-bold shrink-0">Vue :</span>
              {currentPlayers.map(p => {
                const isSelected = testViewPlayerId === p.id;
                const badges = {
                  Rouge: isSelected ? "bg-red-600 text-white border-yellow-400" : "bg-red-900/50 text-red-300 border-transparent hover:bg-red-800/60",
                  Bleu:  isSelected ? "bg-blue-600 text-white border-yellow-400" : "bg-blue-900/50 text-blue-300 border-transparent hover:bg-blue-800/60",
                  Vert:  isSelected ? "bg-emerald-600 text-white border-yellow-400" : "bg-emerald-900/50 text-emerald-300 border-transparent hover:bg-emerald-800/60",
                  Blanc: isSelected ? "bg-gray-300 text-gray-900 border-yellow-400" : "bg-gray-700/50 text-gray-300 border-transparent hover:bg-gray-600/60",
                  Noir:  isSelected ? "bg-gray-600 text-white border-yellow-400" : "bg-gray-900/50 text-gray-400 border-transparent hover:bg-gray-800/60",
                };
                return (
                  <button key={p.id} onClick={() => setTestViewPlayerId(p.id)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all ${badges[p.color] || "bg-gray-700 text-white border-transparent"}`}>
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-amber-400 font-bold text-lg">🃏 {pendingIdCard.cardData?.name}</h2>
              <button
                onClick={() => update(ref(db, "/"), { [`rooms/${roomCode}/pendingIdCard`]: null })}
                className="text-gray-500 hover:text-gray-300 text-xl leading-none"
                title="Annuler"
              >✕</button>
            </div>
            <p className="text-gray-400 text-sm mb-4">En attente de la réponse des adversaires…</p>
            <div className="space-y-2">
              {Object.entries(pendingIdCard.pendingResponses || {}).map(([pid, status]) => {
                const player = currentPlayers.find(p => p.id === pid);
                return (
                  <div key={pid} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-200">{player?.name ?? pid}</span>
                    {status === "waiting"
                      ? <span className="text-yellow-400 animate-pulse">En attente…</span>
                      : <span className="text-green-400">Passé ✓</span>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Annulation d'ID — modale adversaire */}
    {pendingIdCard &&
     !pendingIdCard.cancelled &&
     pendingIdCard.actorId !== effectivePlayerId &&
     pendingIdCard.pendingResponses?.[effectivePlayerId] === "waiting" && (
      <CancelIdModal
        pendingIdCard={pendingIdCard}
        allPlayers={currentPlayers}
        hasAnnulCard={(gameState?.players?.[effectivePlayerId]?.idCards || []).some(c => c.id === "annulation_id")}
        onCancel={handleCancelIdCard}
        onIgnore={handlePassCancelId}
        isTestMode={isTestMode}
        testPlayers={isTestMode ? currentPlayers : null}
        activeTestPlayerId={testViewPlayerId}
        onSwitchTestPlayer={id => setTestViewPlayerId(id)}
      />
    )}

    {/* Récupération d'ID depuis la défausse */}
    {gameState?.players?.[effectivePlayerId]?.idRecoverPending && (
      <IdRecoverModal
        idDiscard={gameState?.idDiscard || []}
        onPick={handleIdRecoverPick}
        onClose={() => update(ref(db, "/"), { [`rooms/${roomCode}/gameState/players/${effectivePlayerId}/idRecoverPending`]: null })}
      />
    )}

    {/* Jetons Ta-Seti — choix prendre/laisser */}
    {pendingTokenPickup && (
      <TaSetiTokenModal
        tokens={pendingTokenPickup.tokens}
        troopZones={
          Object.entries(gameState?.boardUnits || {})
            .filter(([, colors]) => (colors?.[me?.color] || 0) > 0)
            .map(([zid, colors]) => ({ id: zid, units: colors[me.color] }))
        }
        onTake={handleTokenPickup}
        onLeave={handleTokenLeave}
      />
    )}

    {/* Recrutement de Victoire — bandeau info */}
    {actionMode === "victoryRecruit" && victoryRecruitPending > 0 && (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-green-900/95 border border-green-400 rounded-xl px-6 py-3 shadow-2xl">
        <p className="text-green-200 font-semibold text-sm">
          Recrutement de Victoire — placez {victoryRecruitPending} unité{victoryRecruitPending !== 1 ? "s" : ""} sur le plateau
        </p>
      </div>
    )}

    {/* Ta-Seti recrutement — bandeau info */}
    {actionMode === "tasetiRecruit" && tasetiRecruitPending > 0 && (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-amber-900/95 border border-amber-400 rounded-xl px-6 py-3 shadow-2xl">
        <p className="text-amber-200 font-semibold text-sm">
          Ta-Seti — recrutez {tasetiRecruitPending} unité{tasetiRecruitPending !== 1 ? "s" : ""} (cité ou troupe existante)
        </p>
      </div>
    )}

    {/* Tuiles d'un joueur */}
    {viewTilesPlayer && (
      <PlayerTilesModal
        player={viewTilesPlayer}
        gameState={gameState}
        onClose={() => setViewTilesPlayer(null)}
      />
    )}

    {/* Pluie de Feu — bandeau info */}
    {actionMode === "destroyUnit" && (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-red-900/95 border border-red-400 rounded-xl px-6 py-3 shadow-2xl">
        <p className="text-red-200 font-semibold text-sm">
          Pluie de Feu — cliquez sur une zone ennemie pour détruire 1 unité
        </p>
      </div>
    )}

    {/* Toast d'action — tuile, attaque, déplacement, recrutement, prière */}
    {actionNotif && <ActionToast notif={actionNotif} />}

  </div>
);
}
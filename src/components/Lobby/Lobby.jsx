import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { ref, set, get, update, onValue, remove, onDisconnect } from "firebase/database";
import { buildIdDeck, dealCards } from "../../utils/deck";
import { INITIAL_PLAYER_STATE } from "../../constants/game";
import { POWER_TILES } from "../../constants/powerTiles";
import { useSyncedMusic } from "../../hooks/useSyncedMusic";

const LOBBY_MUSIC = ["/MP3/Ancient Egyptian Music – Thoth.mp3"];

const COLORS = ["Rouge", "Bleu", "Vert", "Blanc", "Noir"];
const AI_NAMES = ["Anubis", "Râ", "Osiris", "Seth"];

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function saveSession(data) {
  localStorage.setItem("kemet_session", JSON.stringify(data));
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem("kemet_session"));
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem("kemet_session");
}

export default function Lobby({ onGameStart }) {
  useSyncedMusic(LOBBY_MUSIC, "globalMusic/lobby");
  const [screen, setScreen] = useState("home");
  const [playerName, setPlayerName] = useState("");
  const [playerColor, setPlayerColor] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(3);
  const [aiCount, setAiCount] = useState(0);
  const [error, setError] = useState("");
  const [rooms, setRooms] = useState({});
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);

  // Restaure la session au chargement
	useEffect(() => {
	  const session = loadSession();
	  if (!session) return;

	  get(ref(db, `rooms/${session.roomCode}`)).then(snapshot => {
		if (!snapshot.exists()) { clearSession(); return; }
		const room = snapshot.val();
		if (!room.players?.[session.playerId]) { clearSession(); return; }

		if (room.status === "playing") {
		  // Partie en cours → retourne directement dans le jeu
		  const player = room.players[session.playerId];
		  onGameStart({
			roomCode: session.roomCode,
			playerId: session.playerId,
			playerName: session.playerName,
			playerColor: player.color,
			order: player.order,
			allPlayers: Object.values(room.players).sort((a, b) => a.order - b.order),
			  isTestMode: session.isTestMode ?? false,
		  });
		} else {
		  // Partie en attente → retourne dans la salle d'attente
		  setCurrentRoom(session.roomCode);
		  setCurrentPlayerId(session.playerId);
		  setPlayerName(session.playerName);
		  setScreen("waiting");
		  setupDisconnect(session.roomCode, session.playerId);
		}
	  });
	}, []);


	// Nettoie les rooms expirées (> 10 minutes) uniquement en attente
	useEffect(() => {
	  const cleanup = async () => {
		const snapshot = await get(ref(db, "rooms"));
		if (!snapshot.exists()) return;
		const allRooms = snapshot.val();
		const now = Date.now();
		const TEN_MINUTES = 10 * 60 * 1000;
		for (const room of Object.values(allRooms)) {
		  if (room.status === "waiting" && room.createdAt && now - room.createdAt > TEN_MINUTES) {
			await remove(ref(db, `rooms/${room.code}`));
		  }
		}
	  };
	  cleanup();
	  const interval = setInterval(cleanup, 60 * 1000);
	  return () => clearInterval(interval);
	}, []);

  // Écoute toutes les rooms
  useEffect(() => {
    const unsubscribe = onValue(ref(db, "rooms"), snapshot => {
      setRooms(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, []);

  // Écoute la room courante — détecte suppression
  useEffect(() => {
    if (!currentRoom) return;
    const unsubscribe = onValue(ref(db, `rooms/${currentRoom}`), snapshot => {
      if (!snapshot.exists()) {
        clearSession();
        setCurrentRoom(null);
        setCurrentPlayerId(null);
        setScreen("home");
      }
    });
    return () => unsubscribe();
  }, [currentRoom]);

  // Détecte le lancement de la partie
  useEffect(() => {
    if (!currentRoom || !currentPlayerId) return;
    const room = rooms[currentRoom];
    if (room?.status === "playing") {
      const player = room.players?.[currentPlayerId];
      onGameStart({
        roomCode: currentRoom,
        playerId: currentPlayerId,
        playerName,
        playerColor: player?.color,
        order: player?.order,
        allPlayers: Object.values(room.players).sort((a, b) => a.order - b.order),
      });
    }
  }, [rooms, currentRoom]);

	function setupDisconnect(roomCode, playerId) {
	  // Le timer de 10 minutes gère le nettoyage
	  // Pas de suppression automatique à la déconnexion
	}

  function getAvailableColors(players = {}) {
    const taken = Object.values(players).map(p => p.color);
    return COLORS.filter(c => !taken.includes(c));
  }

  async function handleCreate() {
    if (!playerName.trim()) return setError("Entre ton nom.");
    const code = generateRoomCode();
    const pid = crypto.randomUUID();
    const color = playerColor || COLORS[0];

    // Créer les joueurs IA avec les couleurs restantes
    const usedColors = [color];
    const aiPlayers = Array.from({ length: aiCount }, (_, i) => {
      const available = COLORS.filter(c => !usedColors.includes(c));
      const aiColor = available[0];
      usedColors.push(aiColor);
      return { id: crypto.randomUUID(), name: AI_NAMES[i] || `IA${i + 1}`, color: aiColor, isAI: true };
    });

    const humanPlayer = { id: pid, name: playerName, color };
    const allPlayersArr = [humanPlayer, ...aiPlayers];
    const allSlotsFull = allPlayersArr.length === maxPlayers;

    if (allSlotsFull) {
      // Démarrer la partie immédiatement
      const shuffled = [...allPlayersArr].sort(() => Math.random() - 0.5);
      const playersMap = {};
      shuffled.forEach((p, i) => {
        playersMap[p.id] = { ...p, order: i + 1, joinOrder: i + 1 };
      });

      await set(ref(db, `rooms/${code}`), {
        code, status: "playing", maxPlayers, hostId: pid,
        createdAt: Date.now(), players: playersMap,
      });

      const me = playersMap[pid];
      saveSession({ roomCode: code, playerId: pid, playerName, playerColor: color });
      onGameStart({
        roomCode: code, playerId: pid, playerName, playerColor: color,
        order: me.order, allPlayers: Object.values(playersMap).sort((a, b) => a.order - b.order),
      });
    } else {
      // Attendre d'autres joueurs humains
      const playersMap = { [pid]: humanPlayer };
      aiPlayers.forEach(p => { playersMap[p.id] = p; });

      await set(ref(db, `rooms/${code}`), {
        code, status: "waiting", maxPlayers, hostId: pid,
        createdAt: Date.now(), players: playersMap,
      });

      saveSession({ roomCode: code, playerId: pid, playerName, playerColor: color });
      setupDisconnect(code, pid);
      setCurrentRoom(code);
      setCurrentPlayerId(pid);
      setScreen("waiting");
    }
  }

  async function handleJoin(code) {
    if (!playerName.trim()) return setError("Entre ton nom d'abord.");
    const snapshot = await get(ref(db, `rooms/${code}`));
    if (!snapshot.exists()) return setError("Partie introuvable.");
    const room = snapshot.val();
    if (room.status !== "waiting") return setError("La partie a déjà commencé.");
    const players = room.players || {};
    if (Object.keys(players).length >= room.maxPlayers) return setError("La partie est complète.");
    const available = getAvailableColors(players);
    if (available.length === 0) return setError("Plus de couleur disponible.");
    const color = playerColor && available.includes(playerColor) ? playerColor : available[0];
    const playerId = crypto.randomUUID();

    await set(ref(db, `rooms/${code}/players/${playerId}`), {
      id: playerId, name: playerName, color, order: 0
    });

    setupDisconnect(code, playerId);
    saveSession({ roomCode: code, playerId, playerName, playerColor: color });
    setCurrentRoom(code);
    setCurrentPlayerId(playerId);
    setScreen("waiting");
  }

  async function handleStart() {
    if (!currentRoom) return;
    const players = Object.values(rooms[currentRoom]?.players || {});
    if (players.length < rooms[currentRoom]?.maxPlayers) return;
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const updates = {};
    shuffled.forEach((p, i) => {
      updates[`rooms/${currentRoom}/players/${p.id}/order`] = i + 1;
    });
    // Stable city assignment (J1/J2/J3) — based on Firebase insertion order, never changes
    players.forEach((p, i) => {
      updates[`rooms/${currentRoom}/players/${p.id}/joinOrder`] = i + 1;
    });
    updates[`rooms/${currentRoom}/status`] = "playing";
    await update(ref(db, "/"), updates);
  }

  async function handleQuickTest() {
    const code = generateRoomCode();
    const players = [
      { name: "Maxime",   color: "Bleu",  order: 1, joinOrder: 1 },
      { name: "Toinou",   color: "Rouge", order: 2, joinOrder: 2 },
      { name: "François", color: "Vert",  order: 3, joinOrder: 3 },
    ].map(p => ({ ...p, id: crypto.randomUUID() }));

    const playersMap = {};
    players.forEach(p => { playersMap[p.id] = p; });

    // Deal ID cards
    let deck = buildIdDeck();
    const playerStates = {};
    players.forEach(p => {
      const { hand, remaining } = dealCards(deck, 2);
      deck = remaining;
      playerStates[p.id] = { ...INITIAL_PLAYER_STATE, color: p.color, idCards: hand, availableCombatCards: [1,2,3,4,5,6,7,8], unitsReserve: 2 };
    });

    // Default pyramids: Rouge/1, Bleu/1, Blanc/1 per player
    const pyramids = {};
    players.forEach(p => {
      [["Rouge", `J${p.joinOrder}P1`], ["Bleu", `J${p.joinOrder}P2`], ["Noir", `J${p.joinOrder}P3`]].forEach(([color, slotId]) => {
        pyramids[slotId] = { color, level: 1, ownerId: p.id, controllerId: p.id };
      });
    });

    // Draft defaults: one level-1 tile per player (reverse setup order: François, Toinou, Maxime)
    const availableTileIds = POWER_TILES.map(t => t.id);
    const defaultDraftTiles = ["R_1_1", "B_1_1", "W_1_1"];
    [...players].reverse().forEach((p, i) => {
      const tileId = defaultDraftTiles[i];
      playerStates[p.id].ownedTileIds = [tileId];
      availableTileIds.splice(availableTileIds.indexOf(tileId), 1);
    });

    // Placement defaults: 5 units in the first 2 city zones per player
    const boardUnits = {};
    players.forEach(p => {
      [`J${p.joinOrder}C1`, `J${p.joinOrder}C2`].forEach(zoneId => {
        boardUnits[zoneId] = { ...(boardUnits[zoneId] || {}), [p.color]: 5 };
      });
    });

    const gameState = {
      players: playerStates,
      idDeck: deck,
      idDiscard: [],
      currentTurnPlayerId: players[0].id,
      phase: "playing",
      availableTileIds,
      pyramids,
      boardUnits,
      placements: Object.fromEntries(players.map(p => [
        p.id,
        { zones: [`J${p.joinOrder}C1`, `J${p.joinOrder}C2`], confirmed: true },
      ])),
      taSetiLayout: [1,2,3,4].map(() => Math.random() < 0.5 ? 'A' : 'B'),
    };

    await set(ref(db, `rooms/${code}`), {
      code,
      status: "playing",
      maxPlayers: 3,
      hostId: players[0].id,
      createdAt: Date.now(),
      players: playersMap,
      gameState,
    });

    const me = players[0]; // Maxime
    saveSession({ roomCode: code, playerId: me.id, playerName: me.name, playerColor: me.color, isTestMode: true });
    onGameStart({
      roomCode: code,
      playerId: me.id,
      playerName: me.name,
      playerColor: me.color,
      order: me.order,
      allPlayers: players,
      isTestMode: true,
    });
  }

	async function handleLeave() {
	  if (!currentRoom || !currentPlayerId) return;

	  const snapshot = await get(ref(db, `rooms/${currentRoom}`));
	  if (snapshot.exists()) {
		const room = snapshot.val();
		const players = room.players || {};
		const remaining = Object.keys(players).filter(id => id !== currentPlayerId);

		if (remaining.length === 0) {
		  // Plus personne → supprime la room
		  await remove(ref(db, `rooms/${currentRoom}`));
		} else {
		  await remove(ref(db, `rooms/${currentRoom}/players/${currentPlayerId}`));
		  // Si le joueur était host → transfère au premier joueur restant
		  if (room.hostId === currentPlayerId) {
			await update(ref(db, `rooms/${currentRoom}`), { hostId: remaining[0] });
		  }
		}
	  }

	  clearSession();
	  setCurrentRoom(null);
	  setCurrentPlayerId(null);
	  setScreen("home");
	}

  const waitingRooms = Object.values(rooms).filter(r => r.status === "waiting");

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center justify-center gap-8 p-4 relative"
      style={{ backgroundImage: "url('/background.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="absolute inset-0 bg-black/38 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-md">

        {/* TITRE */}
        <div className="flex flex-col items-center gap-3">
          <h1
            className="text-7xl text-yellow-300 tracking-[0.18em] select-none"
            style={{
              fontFamily: "'Cinzel Decorative', serif",
              textShadow: [
                "2px 2px 0 #000",
                "-2px -2px 0 #000",
                "2px -2px 0 #000",
                "-2px 2px 0 #000",
                "0 4px 14px rgba(0,0,0,0.95)",
              ].join(", "),
            }}
          >
            KEMET
          </h1>
          <div className="flex items-center gap-3 w-full px-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-yellow-500/50 to-yellow-400/70" />
            <span className="text-yellow-300/90 text-[10px] tracking-[0.35em] uppercase font-semibold whitespace-nowrap"
              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
            >
              Maîtres du Nil
            </span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-yellow-500/50 to-yellow-400/70" />
          </div>
        </div>

        {/* HOME */}
        {screen === "home" && (
          <div className="flex flex-col items-center gap-4 w-full">

            <div className="bg-black/35 backdrop-blur-sm border border-yellow-800/55 p-5 rounded-xl w-full flex flex-col gap-3">
              <h2 className="text-[10px] font-bold text-yellow-400 uppercase tracking-[0.3em]">Ton nom</h2>
              <input
                type="text"
                placeholder="Entre ton nom..."
                value={playerName}
                onChange={e => { setPlayerName(e.target.value); setError(""); }}
                className="bg-black/30 border border-yellow-800/50 focus:border-yellow-600/70 px-4 py-2.5 rounded-lg outline-none text-yellow-100 placeholder-yellow-900/50 transition-colors duration-200 w-full text-sm"
              />
              {error && <p className="text-red-400/90 text-xs tracking-wide">{error}</p>}
            </div>

            <div className="bg-black/35 backdrop-blur-sm border border-yellow-800/55 p-5 rounded-xl w-full flex flex-col gap-3">
              <h2 className="text-[10px] font-bold text-yellow-400 uppercase tracking-[0.3em]">Parties en attente</h2>
              {waitingRooms.length === 0 && (
                <p className="text-yellow-200/55 text-xs italic py-1">Aucune partie disponible.</p>
              )}
              {waitingRooms.map(room => {
                const players = Object.values(room.players || {});
                const isFull = players.length >= room.maxPlayers;
                return (
                  <div key={room.code} className="bg-black/25 border border-yellow-800/35 rounded-lg p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-yellow-400 text-sm tracking-widest">{room.code}</p>
                      <p className="text-xs text-white/70 mt-0.5 truncate">
                        {players.map(p => <span key={p.id} className="mr-2">{p.name} ({p.color})</span>)}
                      </p>
                      <p className="text-[10px] text-white/45 mt-0.5">
                        {players.length}/{room.maxPlayers} · expire dans {Math.max(0, Math.round((10 * 60 * 1000 - (Date.now() - room.createdAt)) / 60000))} min
                      </p>
                    </div>
                    <button
                      onClick={() => handleJoin(room.code)}
                      disabled={isFull}
                      className={`shrink-0 px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
                        isFull
                          ? "bg-black/30 text-yellow-900/40 border border-yellow-900/20 cursor-not-allowed"
                          : "bg-gradient-to-b from-yellow-600 to-yellow-800 hover:from-yellow-500 hover:to-yellow-700 border border-yellow-500/40 text-yellow-100 shadow-md shadow-yellow-950/60"
                      }`}
                    >
                      {isFull ? "Complet" : "Rejoindre"}
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => { if (!playerName.trim()) return setError("Entre ton nom."); setScreen("create"); }}
              className="bg-gradient-to-b from-yellow-600 to-yellow-800 hover:from-yellow-500 hover:to-yellow-700 border border-yellow-500/40 text-yellow-100 px-6 py-3.5 rounded-xl font-bold uppercase tracking-[0.2em] text-xs w-full shadow-lg shadow-yellow-950/60 transition-all duration-200"
            >
              Créer une partie
            </button>

            <button
              onClick={handleQuickTest}
              className="bg-gradient-to-b from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 border border-gray-500/40 text-gray-300 px-6 py-2.5 rounded-xl font-bold uppercase tracking-[0.2em] text-xs w-full shadow-lg transition-all duration-200"
            >
              ⚡ Test rapide — Toinou / Maxime / François
            </button>
          </div>
        )}

        {/* CRÉATION */}
        {screen === "create" && (
          <div className="bg-black/35 backdrop-blur-sm border border-yellow-800/55 p-6 rounded-xl flex flex-col gap-5 w-full">
            <h2 className="text-[10px] font-bold text-yellow-400 uppercase tracking-[0.3em]">Nouvelle partie</h2>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-yellow-400/80 uppercase tracking-[0.3em]">Couleur</label>
              <select
                value={playerColor || COLORS[0]}
                onChange={e => setPlayerColor(e.target.value)}
                className="bg-black/30 border border-yellow-800/50 focus:border-yellow-600/70 px-4 py-2.5 rounded-lg outline-none text-yellow-100 text-sm transition-colors duration-200"
              >
                {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-yellow-400/80 uppercase tracking-[0.3em]">Nombre de joueurs</label>
              <select
                value={maxPlayers}
                onChange={e => { setMaxPlayers(Number(e.target.value)); setAiCount(0); }}
                className="bg-black/30 border border-yellow-800/50 focus:border-yellow-600/70 px-4 py-2.5 rounded-lg outline-none text-yellow-100 text-sm transition-colors duration-200"
              >
                <option value={3}>3 joueurs</option>
                <option value={4}>4 joueurs</option>
                <option value={5}>5 joueurs</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] text-yellow-400/80 uppercase tracking-[0.3em]">Adversaires IA</label>
              <select
                value={aiCount}
                onChange={e => setAiCount(Number(e.target.value))}
                className="bg-black/30 border border-yellow-800/50 focus:border-yellow-600/70 px-4 py-2.5 rounded-lg outline-none text-yellow-100 text-sm transition-colors duration-200"
              >
                {Array.from({ length: maxPlayers }, (_, i) => (
                  <option key={i} value={i}>{i === 0 ? "Aucun (multijoueur)" : `${i} IA (${AI_NAMES.slice(0, i).join(", ")})`}</option>
                ))}
              </select>
            </div>

            {aiCount > 0 && (
              <div className="bg-amber-950/40 border border-amber-700/40 rounded-lg px-3 py-2 text-xs text-amber-300/80">
                {aiCount === maxPlayers - 1
                  ? "La partie démarre immédiatement contre les IA."
                  : `${maxPlayers - 1 - aiCount} joueur(s) humain(s) supplémentaire(s) requis.`}
              </div>
            )}

            {error && <p className="text-red-400/90 text-xs tracking-wide">{error}</p>}

            <button
              onClick={handleCreate}
              className="bg-gradient-to-b from-yellow-600 to-yellow-800 hover:from-yellow-500 hover:to-yellow-700 border border-yellow-500/40 text-yellow-100 px-6 py-3.5 rounded-xl font-bold uppercase tracking-[0.2em] text-xs shadow-lg shadow-yellow-950/60 transition-all duration-200"
            >
              {aiCount === maxPlayers - 1 ? "Lancer contre les IA" : "Créer"}
            </button>
            <button
              onClick={() => { setScreen("home"); setError(""); }}
              className="text-yellow-400/65 hover:text-yellow-300 text-[10px] uppercase tracking-[0.3em] transition-colors duration-200 text-center py-1"
            >
              ← Retour
            </button>
          </div>
        )}

        {/* SALLE D'ATTENTE */}
        {screen === "waiting" && currentRoom && (
          <div className="bg-black/35 backdrop-blur-sm border border-yellow-800/55 p-6 rounded-xl flex flex-col gap-5 w-full">
            <div>
              <h2 className="text-[10px] font-bold text-yellow-400 uppercase tracking-[0.3em]">Salle d'attente</h2>
              <p className="text-yellow-200/70 text-[10px] mt-2 uppercase tracking-widest">
                Code · <span className="font-mono text-yellow-400 text-sm tracking-[0.3em]">{currentRoom}</span>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {Object.values(rooms[currentRoom]?.players || {}).map(p => (
                <div key={p.id} className="bg-black/20 border border-yellow-800/30 rounded-lg px-4 py-2.5 flex justify-between items-center">
                  <span className="text-white/90 text-sm">
                    {p.name}
                    {p.id === (currentPlayerId || loadSession()?.playerId) && (
                      <span className="text-[10px] text-yellow-400/85 ml-2 uppercase tracking-widest">(toi)</span>
                    )}
                    {p.id === rooms[currentRoom]?.hostId && (
                      <span className="ml-1.5 text-xs">👑</span>
                    )}
                  </span>
                  <span className="text-yellow-300/70 text-[10px] uppercase tracking-widest">{p.color}</span>
                </div>
              ))}
            </div>

            <p className="text-yellow-300/60 text-[10px] text-center uppercase tracking-[0.3em]">
              {Object.keys(rooms[currentRoom]?.players || {}).length} / {rooms[currentRoom]?.maxPlayers} joueurs
            </p>

            {rooms[currentRoom]?.hostId === (currentPlayerId || loadSession()?.playerId) && (
              <button
                onClick={handleStart}
                disabled={Object.keys(rooms[currentRoom]?.players || {}).length < rooms[currentRoom]?.maxPlayers}
                className={`px-6 py-3.5 rounded-xl font-bold uppercase tracking-[0.2em] text-xs transition-all duration-200 ${
                  Object.keys(rooms[currentRoom]?.players || {}).length >= rooms[currentRoom]?.maxPlayers
                    ? "bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 border border-emerald-500/40 text-emerald-100 shadow-lg shadow-emerald-950/60"
                    : "bg-black/40 border border-yellow-900/20 text-yellow-900/40 cursor-not-allowed"
                }`}
              >
                {Object.keys(rooms[currentRoom]?.players || {}).length >= rooms[currentRoom]?.maxPlayers
                  ? "Lancer la partie"
                  : `En attente... ${Object.keys(rooms[currentRoom]?.players || {}).length} / ${rooms[currentRoom]?.maxPlayers}`}
              </button>
            )}

            <button
              onClick={handleLeave}
              className="bg-gradient-to-b from-red-800/80 to-red-950/80 hover:from-red-700 hover:to-red-900 border border-red-700/40 text-red-200/80 px-6 py-3.5 rounded-xl font-bold uppercase tracking-[0.2em] text-xs shadow-lg shadow-red-950/50 transition-all duration-200"
            >
              Quitter
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
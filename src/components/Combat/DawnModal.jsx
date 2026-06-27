import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { ref, onValue, update, remove, set, get } from "firebase/database";
import { COMBAT_CARDS } from "../../constants/cards";
import { aiChooseCombatCards, aiChooseDawnPosition } from "../../ai/aiPlayer";

const TEST_BADGES = {
  Rouge: { on: "bg-red-600 text-white border-yellow-400", off: "bg-red-900/50 text-red-300 border-transparent hover:bg-red-800/60" },
  Bleu:  { on: "bg-blue-600 text-white border-yellow-400", off: "bg-blue-900/50 text-blue-300 border-transparent hover:bg-blue-800/60" },
  Vert:  { on: "bg-emerald-600 text-white border-yellow-400", off: "bg-emerald-900/50 text-emerald-300 border-transparent hover:bg-emerald-800/60" },
  Blanc: { on: "bg-gray-300 text-gray-900 border-yellow-400", off: "bg-gray-700/50 text-gray-300 border-transparent hover:bg-gray-600/60" },
  Noir:  { on: "bg-gray-600 text-white border-yellow-400", off: "bg-gray-900/50 text-gray-400 border-transparent hover:bg-gray-800/60" },
};

export default function DawnModal({ onClose, session, gameState, isTestMode, testPlayers, onSwitchTestPlayer }) {
  const { roomCode, playerId, allPlayers } = session;
  const [dawn, setDawn] = useState(null);
  const [selectedCombat, setSelectedCombat] = useState(null);
  const [selectedDiscard, setSelectedDiscard] = useState(null);
  const [dawnTokens, setDawnTokens] = useState(0);
  const [phase, setPhase] = useState("waiting");

  const myState = gameState?.players?.[playerId] || {};
  const availableCards = myState.availableCombatCards || [1,2,3,4,5,6,7,8];
  const myDawnTokens = myState.dawnTokens || 0;

  // Ordre inversé pour la phase jetons (dernier → premier)
  const reversedPlayers = [...allPlayers].sort((a, b) => b.order - a.order);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, `rooms/${roomCode}/dawn`), snapshot => {
      if (!snapshot.exists()) {
        setDawn(null);
        setPhase("waiting");
        return;
      }
      const data = snapshot.val();
      setDawn(data);
      if (data.status === "revealed") setPhase("revealed");
	  else if (data.status === "choosing") setPhase("choosing");
      else if (data.status === "tokens_phase") setPhase("tokens_phase");
      else if (data.status === "selecting") setPhase("selecting");
      else setPhase("waiting");
    });
    return () => unsubscribe();
  }, [roomCode]);

	// Tous prêts → passe en phase jetons
	useEffect(() => {
	  if (!dawn || dawn.status !== "selecting") return;
	  const choices = dawn.choices || {};
	  const allReady = allPlayers.every(p => choices[p.id]?.ready);
	  if (allReady) {
		update(ref(db, `rooms/${roomCode}/dawn`), {
		  status: "tokens_phase",
		  currentTurn: reversedPlayers[0].id,
		  chosenPositions: {},
		});
	  }
	}, [dawn]);

	// Auto-confirme les jetons si le joueur en a 0 (humain ou IA)
	useEffect(() => {
	  if (!dawn || dawn.status !== "tokens_phase") return;
	  const currentPlayer = allPlayers.find(p => p.id === dawn.currentTurn);
	  if (!currentPlayer) return;
	  const isHuman = currentPlayer.id === playerId;
	  const isAI = currentPlayer.isAI === true;
	  if (!isHuman && !isAI) return;

	  const playerDawnTokens = gameState?.players?.[currentPlayer.id]?.dawnTokens || 0;
	  // Humain sans jetons ou IA → auto-confirm
	  if (!isAI && playerDawnTokens > 0) return;
	  if (dawn.choices?.[currentPlayer.id]?.tokensConfirmed) return;

	  const autoConfirm = async () => {
		await update(ref(db, `rooms/${roomCode}/dawn/choices/${currentPlayer.id}`), {
		  dawnTokens: 0,
		  tokensConfirmed: true,
		});

		const currentIndex = reversedPlayers.findIndex(p => p.id === currentPlayer.id);
		const nextPlayer = reversedPlayers[currentIndex + 1];
		if (nextPlayer) {
		  await update(ref(db, `rooms/${roomCode}/dawn`), {
			currentTurn: nextPlayer.id,
		  });
		}
	  };
	  autoConfirm();
	}, [dawn?.currentTurn, dawn?.status]);

  // Vérifie si tous ont confirmé leurs jetons → révélation
  useEffect(() => {
    if (!dawn || dawn.status !== "tokens_phase") return;
    const choices = dawn.choices || {};
    const allTokensConfirmed = allPlayers.every(p => choices[p.id]?.tokensConfirmed);
    if (allTokensConfirmed) {
      update(ref(db, `rooms/${roomCode}/dawn`), { status: "revealed" });
    }
  }, [dawn]);

  // ── IA : sélection de cartes en phase "selecting" ──────────────────────────
  useEffect(() => {
    if (!dawn || dawn.status !== "selecting") return;
    allPlayers.forEach(p => {
      if (!p.isAI) return;
      if (dawn.choices?.[p.id]?.ready) return;
      const aiState = gameState?.players?.[p.id] || {};
      const available = aiState.availableCombatCards || [1, 2, 3, 4, 5, 6, 7, 8];
      const cards = aiChooseCombatCards(available);
      if (!cards) return;
      setTimeout(() => {
        update(ref(db, `rooms/${roomCode}/dawn/choices/${p.id}`), {
          combatCard: cards.combatCard,
          discardCard: cards.discardCard,
          dawnTokens: 0,
          ready: true,
          tokensConfirmed: false,
        });
      }, 800);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dawn?.status, JSON.stringify(dawn?.choices)]);

  // ── IA : choisit sa position en phase "choosing" ───────────────────────────
  useEffect(() => {
    if (!dawn || dawn.status !== "choosing") return;
    const currentPlayer = allPlayers.find(p => p.id === dawn.currentTurn);
    if (!currentPlayer?.isAI) return;
    if (dawn.chosenPositions?.[currentPlayer.id]) return;
    const taken = Object.values(dawn.chosenPositions || {});
    const available = [1, 2, 3, 4, 5].slice(0, allPlayers.length).filter(pos => !taken.includes(pos));
    if (available.length === 0) return;
    const chosen = aiChooseDawnPosition(gameState, currentPlayer.id, allPlayers, taken, available);
    const t = setTimeout(async () => {
      const snapshot = await get(ref(db, `rooms/${roomCode}/dawn`));
      if (!snapshot.exists()) return;
      const freshDawn = snapshot.val();
      const chosenPositions = freshDawn.chosenPositions || {};
      const newChosenPositions = { ...chosenPositions, [currentPlayer.id]: chosen };
      const ranked = freshDawn.rankedPlayers || [];
      const nextPlayer = ranked.find(pid => !newChosenPositions[pid]);
      const updates = {
        [`rooms/${roomCode}/dawn/chosenPositions/${currentPlayer.id}`]: chosen,
      };
      if (nextPlayer) {
        updates[`rooms/${roomCode}/dawn/currentTurn`] = nextPlayer;
        await update(ref(db, "/"), updates);
      } else {
        // Tous ont choisi → applique l'ordre et termine
        Object.entries(newChosenPositions).forEach(([pid, pos]) => {
          updates[`rooms/${roomCode}/players/${pid}/order`] = pos;
          updates[`rooms/${roomCode}/gameState/players/${pid}/order`] = pos;
        });
        allPlayers.forEach(p => {
          const choice = freshDawn.choices?.[p.id];
          const playerState = gameState?.players?.[p.id] || {};
          const avail = playerState.availableCombatCards || [1, 2, 3, 4, 5, 6, 7, 8];
          let newAvail = avail.filter(id => id !== choice?.combatCard && id !== choice?.discardCard);
          if (newAvail.length < 2) newAvail = [1, 2, 3, 4, 5, 6, 7, 8];
          updates[`rooms/${roomCode}/gameState/players/${p.id}/availableCombatCards`] = newAvail;
        });
        await update(ref(db, "/"), updates);
        await remove(ref(db, `rooms/${roomCode}/dawn`));
      }
    }, 700);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dawn?.currentTurn, dawn?.status]);

  async function handleStartDawn() {
    const choices = {};
    allPlayers.forEach(p => {
      choices[p.id] = {
        combatCard: null,
        discardCard: null,
        dawnTokens: 0,
        ready: false,
        tokensConfirmed: false,
      };
    });
    await set(ref(db, `rooms/${roomCode}/dawn`), {
      status: "selecting",
      currentTurn: null,
      choices,
    });
  }

  async function handleReady() {
    if (!selectedCombat || !selectedDiscard) return;
    if (selectedCombat === selectedDiscard) return;
    await update(ref(db, `rooms/${roomCode}/dawn/choices/${playerId}`), {
      combatCard: selectedCombat,
      discardCard: selectedDiscard,
      dawnTokens: 0,
      ready: true,
      tokensConfirmed: false,
    });
  }

  async function handleConfirmTokens() {
    if (!dawn) return;

    // Dépense les jetons
    await update(ref(db, `rooms/${roomCode}/gameState/players/${playerId}`), {
      dawnTokens: myDawnTokens - dawnTokens,
    });

    await update(ref(db, `rooms/${roomCode}/dawn/choices/${playerId}`), {
      dawnTokens,
      tokensConfirmed: true,
    });

    // Passe au joueur suivant dans l'ordre inversé
    const currentIndex = reversedPlayers.findIndex(p => p.id === playerId);
    const nextPlayer = reversedPlayers[currentIndex + 1];
    if (nextPlayer) {
      await update(ref(db, `rooms/${roomCode}/dawn`), {
        currentTurn: nextPlayer.id,
      });
    }

    setDawnTokens(0);
  }

async function handleStartChoosing() {
  if (!dawn) return;
  const ranked = allPlayers
    .map(p => {
      const choice = dawn.choices?.[p.id];
      const card = COMBAT_CARDS.find(c => c.id === choice?.combatCard);
      const score = (card?.force || 0) + (choice?.dawnTokens || 0);
      return { ...p, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.order - b.order;
    });
  if (!ranked.length) return;
  try {
    await update(ref(db, `rooms/${roomCode}/dawn`), {
      status: "choosing",
      currentTurn: ranked[0].id,
      rankedPlayers: ranked.map(p => p.id),
      chosenPositions: {},
    });
  } catch (err) {
    console.error("handleStartChoosing error:", err);
  }
}

async function handleChoosePosition(position) {
  if (!dawn) return;
  try {
    const snapshot = await get(ref(db, `rooms/${roomCode}/dawn`));
    if (!snapshot.exists()) return;
    const freshDawn = snapshot.val();

    const chosenPositions = freshDawn.chosenPositions || {};
    const newChosenPositions = { ...chosenPositions, [playerId]: position };

    const ranked = freshDawn.rankedPlayers || [];
    const nextPlayer = ranked.find(pid => !newChosenPositions[pid]);

    if (nextPlayer) {
      await update(ref(db, `rooms/${roomCode}/dawn`), {
        [`chosenPositions/${playerId}`]: position,
        currentTurn: nextPlayer,
      });
    } else {
      // Tous ont choisi → applique l'ordre et termine
      const finalUpdates = {};
      Object.entries(newChosenPositions).forEach(([pid, pos]) => {
        finalUpdates[`rooms/${roomCode}/players/${pid}/order`] = pos;
        finalUpdates[`rooms/${roomCode}/gameState/players/${pid}/order`] = pos;
      });

      allPlayers.forEach(p => {
        const choice = freshDawn.choices?.[p.id];
        const playerState = gameState?.players?.[p.id] || {};
        const available = playerState.availableCombatCards || [1,2,3,4,5,6,7,8];
        let newAvailable = available.filter(id => id !== choice?.combatCard && id !== choice?.discardCard);
        if (newAvailable.length < 2) newAvailable = [1,2,3,4,5,6,7,8];
        finalUpdates[`rooms/${roomCode}/gameState/players/${p.id}/availableCombatCards`] = newAvailable;
      });

      finalUpdates[`rooms/${roomCode}/dawn/chosenPositions/${playerId}`] = position;
      await update(ref(db, "/"), finalUpdates);
      await remove(ref(db, `rooms/${roomCode}/dawn`));
      setSelectedCombat(null);
      setSelectedDiscard(null);
      setDawnTokens(0);
    }
  } catch (err) {
    console.error("handleChoosePosition error:", err);
  }
}
  
  
  
  
  function getCard(id) {
    return COMBAT_CARDS.find(c => c.id === id);
  }

  function getDawnScore(pid) {
    const choice = dawn?.choices?.[pid];
    const card = getCard(choice?.combatCard);
    return (card?.force || 0) + (choice?.dawnTokens || 0);
  }

  const myChoice = dawn?.choices?.[playerId];
  const isReady = myChoice?.ready;
  const isMyTokenTurn = dawn?.currentTurn === playerId;
  const hasConfirmedTokens = myChoice?.tokensConfirmed;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-screen overflow-y-auto">

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

        <div className="p-6">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-orange-400">🌅 Phase d'Aube</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        {/* ATTENTE */}
        {phase === "waiting" && (
          <div className="flex flex-col gap-4 items-center">
            <p className="text-gray-300">Lancer la phase d'Aube pour déterminer l'ordre du tour.</p>
            <button
              onClick={handleStartDawn}
              className="bg-orange-600 hover:bg-orange-500 px-6 py-3 rounded-lg font-semibold"
            >
              🌅 Commencer l'Aube
            </button>
          </div>
        )}

        {/* SÉLECTION CARTES */}
        {phase === "selecting" && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2 justify-center flex-wrap">
              {allPlayers.map(p => (
                <div key={p.id} className="bg-gray-800 rounded-lg px-3 py-2 text-center text-sm">
                  <p className="font-bold text-white">{p.name}</p>
                  <p className={dawn?.choices?.[p.id]?.ready ? "text-green-400" : "text-yellow-400"}>
                    {dawn?.choices?.[p.id]?.ready ? "✅ Prêt" : "⏳ En attente"}
                  </p>
                </div>
              ))}
            </div>

            {isReady ? (
              <div className="text-center py-4">
                <p className="text-green-400 text-lg">✅ Choix confirmé</p>
                <p className="text-gray-400 text-sm mt-2">En attente des autres joueurs...</p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm text-gray-400 mb-2">Choisis ta carte d'Aube :</p>
                  <div className="flex gap-2 flex-wrap">
                    {availableCards.map(id => {
                      const card = getCard(id);
                      if (!card) return null;
                      const isSelected = selectedCombat === id;
                      const isDiscarded = selectedDiscard === id;
                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedCombat(isSelected ? null : id)}
                          disabled={isDiscarded}
                          style={{
                            width: 96, padding: 0, borderRadius: 8, overflow: 'hidden',
                            cursor: isDiscarded ? 'not-allowed' : 'pointer',
                            border: `2px solid ${isSelected ? '#fb923c' : isDiscarded ? '#374151' : '#4b5563'}`,
                            opacity: isDiscarded ? 0.3 : 1,
                            boxShadow: isSelected ? '0 0 8px rgba(251,146,60,0.6)' : 'none',
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
                  <p className="text-sm text-gray-400 mb-2">Choisis ta carte à défausser :</p>
                  <div className="flex gap-2 flex-wrap">
                    {availableCards.map(id => {
                      const card = getCard(id);
                      if (!card) return null;
                      const isSelected = selectedDiscard === id;
                      const isCombat = selectedCombat === id;
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
                  ✅ Confirmer
                </button>
              </>
            )}
          </div>
        )}

        {/* PHASE JETONS */}
        {phase === "tokens_phase" && (
          <div className="flex flex-col gap-4">
            <p className="text-center text-orange-400 font-bold">
              Phase Jetons Aube — ordre : {reversedPlayers.map(p => p.name).join(" → ")}
            </p>

            {/* Statut */}
            <div className="flex gap-2 justify-center flex-wrap">
              {reversedPlayers.map(p => (
                <div key={p.id} className="bg-gray-800 rounded-lg px-3 py-2 text-center text-sm">
                  <p className="font-bold text-white">{p.name}</p>
                  <p className={
                    dawn?.choices?.[p.id]?.tokensConfirmed ? "text-green-400" :
                    dawn?.currentTurn === p.id ? "text-orange-400" :
                    "text-gray-500"
                  }>
                    {dawn?.choices?.[p.id]?.tokensConfirmed ? `✅ ${dawn.choices[p.id].dawnTokens} 🌅` :
                     dawn?.currentTurn === p.id ? "🎯 Son tour" :
                     "⏳ En attente"}
                  </p>
                </div>
              ))}
            </div>

            {/* Mon tour */}
            {isMyTokenTurn && !hasConfirmedTokens && (
              <div className="flex flex-col gap-3">
                <p className="text-green-400 font-bold text-sm">C'est votre tour</p>
                <p className="text-sm text-gray-400">
                  Jetons Aube disponibles : <span className="text-white font-bold">{myDawnTokens}</span>
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDawnTokens(Math.max(0, dawnTokens - 1))}
                    className="bg-gray-700 hover:bg-gray-600 w-8 h-8 rounded-full font-bold"
                  >
                    -
                  </button>
                  <span className="text-xl font-bold text-orange-400">{dawnTokens}</span>
                  <button
                    onClick={() => setDawnTokens(Math.min(myDawnTokens, dawnTokens + 1))}
                    className="bg-gray-700 hover:bg-gray-600 w-8 h-8 rounded-full font-bold"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleConfirmTokens}
                  className="bg-orange-600 hover:bg-orange-500 px-6 py-3 rounded-lg font-semibold"
                >
                  ✅ Confirmer ({dawnTokens} jeton{dawnTokens > 1 ? "s" : ""})
                </button>
              </div>
            )}

            {/* Attente */}
            {!isMyTokenTurn && !hasConfirmedTokens && (
              <div className="text-center py-4">
                <p className="text-yellow-400">⏳ En attente de {allPlayers.find(p => p.id === dawn?.currentTurn)?.name}...</p>
              </div>
            )}

            {hasConfirmedTokens && (
              <div className="text-center py-4">
                <p className="text-green-400">✅ Jetons confirmés</p>
              </div>
            )}
          </div>
        )}

      {/* RÉVÉLATION */}
{phase === "revealed" && (
  <div className="flex flex-col gap-4">
    <p className="text-center text-orange-400 font-bold text-lg">🌅 Résultats !</p>

    <div className="flex gap-3 justify-center flex-wrap">
      {allPlayers
        .map(p => ({
          ...p,
          score: getDawnScore(p.id),
          choice: dawn?.choices?.[p.id],
        }))
        .sort((a, b) => b.score - a.score)
        .map((p, i) => {
          const card = getCard(p.choice?.combatCard);
          return (
            <div key={p.id} className="bg-gray-800 border border-gray-600 rounded-xl p-4 text-center w-40">
              <p className="text-xs text-gray-400 mb-1">#{i + 1}</p>
              <p className="font-bold text-white mb-2">{p.name}</p>
              {card && (
                <img
                  src={`/Combat_${card.force}${card.blood}${card.shields}.png`}
                  alt="" draggable={false}
                  style={{ width: '100%', borderRadius: 6, display: 'block', marginBottom: 8 }}
                />
              )}
              {p.choice?.dawnTokens > 0 && (
                <p className="text-orange-400 text-sm">+{p.choice.dawnTokens} 🌅</p>
              )}
              <p className="text-white font-bold text-lg mt-1">= {p.score}</p>
            </div>
          );
        })}
    </div>

    <button
      onClick={handleStartChoosing}
      className="bg-orange-600 hover:bg-orange-500 px-6 py-3 rounded-lg font-semibold"
    >
      ➡️ Choisir les positions
    </button>
  </div>
)}

{/* CHOIX DE POSITION */}
{phase === "choosing" && (
  <div className="flex flex-col gap-4">
    <p className="text-center text-orange-400 font-bold text-lg">🎯 Choix des positions</p>

    {/* Classement */}
    <div className="flex gap-2 justify-center flex-wrap">
      {(dawn?.rankedPlayers || []).map((pid, i) => {
        const p = allPlayers.find(p => p.id === pid);
        const chosen = dawn?.chosenPositions?.[pid];
        return (
          <div key={pid} className="bg-gray-800 rounded-lg px-3 py-2 text-center text-sm">
            <p className="text-xs text-gray-500">Score #{i + 1}</p>
            <p className="font-bold text-white">{p?.name}</p>
            <p className={chosen ? "text-green-400" : dawn?.currentTurn === pid ? "text-orange-400" : "text-gray-500"}>
              {chosen ? `✅ Position ${chosen}` : dawn?.currentTurn === pid ? "🎯 Choisit..." : "⏳ Attend"}
            </p>
          </div>
        );
      })}
    </div>

    {/* Mon choix */}
    {dawn?.currentTurn === playerId && (
      <div className="flex flex-col gap-3">
        <p className="text-green-400 font-bold">C'est votre tour — choisissez votre position :</p>
        <div className="flex gap-3 justify-center">
          {[1, 2, 3].filter(pos => {
            const taken = Object.values(dawn?.chosenPositions || {});
            return !taken.includes(pos);
          }).map(pos => (
            <button
              key={pos}
              onClick={() => handleChoosePosition(pos)}
              className="bg-orange-700 hover:bg-orange-600 px-6 py-4 rounded-lg font-bold text-xl"
            >
              {pos}
            </button>
          ))}
        </div>
      </div>
    )}

    {dawn?.currentTurn !== playerId && !dawn?.chosenPositions?.[playerId] && (
      <div className="text-center py-4">
        <p className="text-yellow-400">⏳ En attente de {allPlayers.find(p => p.id === dawn?.currentTurn)?.name}...</p>
      </div>
    )}

    {dawn?.chosenPositions?.[playerId] && (
      <div className="text-center py-4">
        <p className="text-green-400">✅ Position {dawn.chosenPositions[playerId]} choisie</p>
        <p className="text-gray-400 text-sm mt-1">En attente des autres...</p>
      </div>
    )}
  </div>
)}

        </div>
      </div>
    </div>
  );
}
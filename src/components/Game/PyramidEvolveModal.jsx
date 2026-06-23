import { useState } from "react";
import { PYRAMID_SLOTS, PYRAMID_COLORS, COLOR_STYLE } from "../../constants/pyramids";

export default function PyramidEvolveModal({ player, gameState, onConfirm, onClose, free = false }) {
  const cityId = `J${player.joinOrder}`;
  const mySlots = PYRAMID_SLOTS.filter(s => s.cityId === cityId);
  const pyramids = gameState?.pyramids || {};
  const ank = gameState?.players?.[player.id]?.ank ?? 7;

  const [pendingSlot, setPendingSlot] = useState(null);
  const [chosenColor, setChosenColor] = useState(null);
  const [chosenLevel, setChosenLevel] = useState(null);

  function evolCost(from, to) {
    return (to * (to + 1)) / 2 - (from * (from + 1)) / 2;
  }

  function getUsedColors(slotId) {
    return mySlots
      .filter(s => s.id !== slotId && pyramids[s.id]?.color)
      .map(s => pyramids[s.id].color);
  }

  function handleSlotClick(slot) {
    const pyramid = pyramids[slot.id];
    const color = pyramid?.color;
    const level = pyramid?.level ?? 0;
    if (free) {
      if (color && level < 4) onConfirm({ slotId: slot.id });
      return;
    }
    if (color && level < 4 && ank >= evolCost(level, level + 1)) {
      // Existing pyramid — show target level chooser
      setPendingSlot(slot);
      setChosenColor(null);
      setChosenLevel(null);
    } else if (!color) {
      // Empty slot — show color chooser
      setPendingSlot(slot);
      setChosenColor(null);
      setChosenLevel(null);
    }
  }

  function handleConfirmExistingLevel() {
    if (!pendingSlot || !chosenLevel) return;
    onConfirm({ slotId: pendingSlot.id, level: chosenLevel });
  }

  function handleConfirmNewLevel() {
    if (!pendingSlot || !chosenColor || !chosenLevel) return;
    onConfirm({ slotId: pendingSlot.id, color: chosenColor, level: chosenLevel });
  }

  const allUnavailable = free
    ? mySlots.every(s => { const p = pyramids[s.id]; return !p?.color || (p.level ?? 0) >= 4; })
    : mySlots.every(s => {
        const p = pyramids[s.id];
        if (!p?.color) return ank < 1;
        return (p.level ?? 0) >= 4 || ank < evolCost(p.level ?? 0, (p.level ?? 0) + 1);
      });

  // Determine which UI state we're in
  const pendingPyramid = pendingSlot ? pyramids[pendingSlot.id] : null;
  const pendingHasColor = !!pendingPyramid?.color;
  const pendingCurrentLevel = pendingPyramid?.level ?? 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold text-white">{free ? "Amélioration Gratuite" : "Évolution de Pyramide"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>
        {free
          ? <p className="text-green-400 text-xs mb-4">Choisissez une pyramide à améliorer gratuitement d'1 niveau.</p>
          : <p className="text-yellow-400 text-xs mb-4">Ank disponible : <strong>{ank}</strong> — coût = niveau cible</p>
        }

        {pendingSlot && pendingHasColor ? (
          // Existing pyramid — choose target level
          <>
            <p className="text-gray-400 text-sm mb-4">
              Choisissez le niveau cible <span className="text-white font-semibold">(actuel : {pendingCurrentLevel})</span> :
            </p>
            <div className="flex gap-2 mb-4 justify-center">
              {[1, 2, 3, 4].filter(lvl => lvl > pendingCurrentLevel).map(lvl => {
                const cost = evolCost(pendingCurrentLevel, lvl);
                const canAfford = ank >= cost;
                return (
                  <button
                    key={lvl}
                    disabled={!canAfford}
                    onClick={() => canAfford && setChosenLevel(lvl)}
                    className={`w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                      !canAfford
                        ? "border-gray-700 bg-gray-900 opacity-30 cursor-not-allowed"
                        : chosenLevel === lvl
                          ? "border-yellow-500 bg-yellow-600 text-white"
                          : "border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <span className="text-xl font-bold">{lvl}</span>
                    <span className="text-[10px] text-yellow-300">🪙{cost}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setPendingSlot(null); setChosenLevel(null); }} className="flex-1 px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm">
                Retour
              </button>
              <button
                onClick={handleConfirmExistingLevel}
                disabled={!chosenLevel}
                className={`flex-1 px-3 py-2 rounded text-sm font-bold ${
                  chosenLevel ? "bg-yellow-600 hover:bg-yellow-500 text-white" : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
              >
                Confirmer
              </button>
            </div>
          </>
        ) : pendingSlot && !chosenColor ? (
          // New pyramid — choose color
          <>
            <p className="text-gray-400 text-sm mb-4">Choisissez la couleur de la pyramide :</p>
            <div className="flex flex-col gap-2 mb-4">
              {PYRAMID_COLORS.filter(c => !getUsedColors(pendingSlot.id).includes(c)).map(c => {
                const style = COLOR_STYLE[c];
                return (
                  <button
                    key={c}
                    onClick={() => { setChosenColor(c); setChosenLevel(null); }}
                    className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-600 hover:border-gray-400 bg-gray-800 transition-all"
                  >
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: style.bg, border: `2px solid ${style.border}` }} />
                    <span className="text-white text-sm font-semibold">{c}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setPendingSlot(null)} className="w-full px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm">
              Retour
            </button>
          </>
        ) : pendingSlot && chosenColor ? (
          // New pyramid — choose starting level
          <>
            <p className="text-gray-400 text-sm mb-4">Choisissez le niveau de départ :</p>
            <div className="flex gap-2 mb-4 justify-center">
              {[1, 2, 3, 4].map(lvl => {
                const cost = evolCost(0, lvl);
                const canAfford = ank >= cost;
                return (
                  <button
                    key={lvl}
                    disabled={!canAfford}
                    onClick={() => canAfford && setChosenLevel(lvl)}
                    className={`w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center transition-all ${
                      !canAfford
                        ? "border-gray-700 bg-gray-900 opacity-30 cursor-not-allowed"
                        : chosenLevel === lvl
                          ? "border-yellow-500 bg-yellow-600 text-white"
                          : "border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <span className="text-xl font-bold">{lvl}</span>
                    <span className="text-[10px] text-yellow-300">🪙{cost}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setChosenColor(null)} className="flex-1 px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm">
                Retour
              </button>
              <button
                onClick={handleConfirmNewLevel}
                disabled={!chosenLevel}
                className={`flex-1 px-3 py-2 rounded text-sm font-bold ${
                  chosenLevel ? "bg-yellow-600 hover:bg-yellow-500 text-white" : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
              >
                Confirmer
              </button>
            </div>
          </>
        ) : (
          // Default — list of pyramid slots
          <>
            <p className="text-gray-400 text-sm mb-4">
              {free ? "Choisissez une pyramide existante :" : "Choisissez une pyramide à faire évoluer ou un emplacement vide :"}
            </p>
            <div className="flex flex-col gap-3">
              {mySlots.filter(slot => !free || pyramids[slot.id]?.color).map(slot => {
                const pyramid = pyramids[slot.id];
                const level = pyramid?.level ?? 0;
                const color = pyramid?.color;
                const cost = evolCost(level, level + 1);
                const canEvolve = free ? (color && level < 4) : (color && level < 4 && ank >= cost);
                const tooExpensive = !free && color && level < 4 && ank < cost;
                const isEmpty = !color;
                const isClickable = canEvolve || (!free && isEmpty);
                const style = COLOR_STYLE[color] || COLOR_STYLE[null];
                return (
                  <button
                    key={slot.id}
                    disabled={!isClickable}
                    onClick={() => isClickable && handleSlotClick(slot)}
                    className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                      isClickable
                        ? "border-gray-600 hover:border-yellow-500 bg-gray-800 cursor-pointer"
                        : "border-gray-700 bg-gray-900 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded" style={{ backgroundColor: style.bg, border: `2px solid ${style.border}` }} />
                      <span className="text-white text-sm font-semibold">{color || "Vide"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[1,2,3,4].map(lvl => (
                        <div key={lvl} className={`w-4 h-4 rounded-sm border ${lvl <= level ? "bg-yellow-500 border-yellow-400" : "bg-gray-700 border-gray-600"}`} />
                      ))}
                      {canEvolve && free && <span className="text-green-400 text-xs ml-1 font-bold">→{level+1} Gratuit</span>}
                      {canEvolve && !free && <span className="text-yellow-400 text-xs ml-1 font-bold">→{level+1}+ 🪙{cost}</span>}
                      {tooExpensive && <span className="text-red-400 text-xs ml-1">🪙{cost} manque</span>}
                      {isEmpty && ank >= 1 && <span className="text-green-400 text-xs ml-1 font-bold">+ Placer</span>}
                      {isEmpty && ank < 1 && <span className="text-red-400 text-xs ml-1">🪙 insuffisant</span>}
                    </div>
                  </button>
                );
              })}
              {allUnavailable && (
                <p className="text-red-400 text-sm text-center py-2">
                  {free ? "Aucune pyramide disponible à améliorer." : "Ank insuffisant pour toute action."}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

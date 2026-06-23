import { useState } from "react";
import { BOARD_ZONES } from "../../constants/board";
import { POWER_TILES } from "../../constants/powerTiles";

export default function MoveModal({ playerColor, gameState, actionId, onConfirm, onClose }) {
  const boardUnits = gameState?.boardUnits || {};
  const creatureAssignments = gameState?.creatureAssignments || {};

  const myZones = BOARD_ZONES.filter(z => (boardUnits[z.id]?.[playerColor] || 0) > 0);

  const [fromZone, setFromZone] = useState(myZones[0]?.id || "");
  const [toZone, setToZone] = useState("");
  const [count, setCount] = useState(1);
  const [creatureGoesWithMove, setCreatureGoesWithMove] = useState(true);

  const maxUnits = boardUnits[fromZone]?.[playerColor] || 0;
  const isPartialMove = count < maxUnits;

  const creatureId = creatureAssignments[fromZone]?.[playerColor];
  const creature = creatureId ? POWER_TILES.find(t => t.id === creatureId) : null;
  const showCreatureChoice = !!creature && isPartialMove;

  const canConfirm = fromZone && toZone && fromZone !== toZone && count >= 1 && count <= maxUnits;

  function handleFromChange(val) {
    setFromZone(val);
    setCount(1);
    setCreatureGoesWithMove(true);
    if (val === toZone) setToZone("");
  }

  function handleConfirm() {
    if (!canConfirm) return;
    const resolvedCreatureGoes = creature
      ? (isPartialMove ? creatureGoesWithMove : true)
      : undefined;
    onConfirm({ fromZone, toZone, count, creatureGoesWithMove: resolvedCreatureGoes });
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">
            Déplacement {actionId === "move2" ? "(Niv. 2)" : "(Niv. 1)"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        {myZones.length === 0 ? (
          <p className="text-red-400 text-sm text-center py-4">Aucune unité sur le plateau.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block uppercase tracking-wider">Zone source</label>
              <select
                value={fromZone}
                onChange={e => handleFromChange(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white w-full text-sm outline-none"
              >
                <option value="">— Choisir —</option>
                {myZones.map(z => {
                  const hasCreature = !!creatureAssignments[z.id]?.[playerColor];
                  return (
                    <option key={z.id} value={z.id}>
                      {z.label} ({boardUnits[z.id]?.[playerColor] || 0} unités{hasCreature ? " 🐉" : ""})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block uppercase tracking-wider">Zone destination</label>
              <select
                value={toZone}
                onChange={e => setToZone(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white w-full text-sm outline-none"
              >
                <option value="">— Choisir —</option>
                {BOARD_ZONES.filter(z => z.id !== fromZone).map(z => (
                  <option key={z.id} value={z.id}>{z.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1.5 block uppercase tracking-wider">
                Nombre d'unités {fromZone ? `(max ${maxUnits})` : ""}
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCount(c => Math.max(1, c - 1))}
                  className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 text-white font-bold flex-shrink-0"
                >−</button>
                <span className="text-white font-bold text-lg w-8 text-center">{count}</span>
                <button
                  onClick={() => setCount(c => Math.min(maxUnits, c + 1))}
                  className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 text-white font-bold flex-shrink-0"
                >+</button>
                <button
                  onClick={() => setCount(maxUnits)}
                  className="text-xs text-gray-400 hover:text-white ml-1"
                >Tout</button>
              </div>
            </div>

            {/* Choix créature (seulement pour déplacement partiel) */}
            {creature && (
              <div className={`rounded-lg p-3 border text-sm ${
                showCreatureChoice
                  ? "bg-amber-950/40 border-amber-700/50"
                  : "bg-gray-800/50 border-gray-700/50"
              }`}>
                <p className="text-amber-300 font-semibold text-xs mb-1">🐉 {creature.name}</p>
                {showCreatureChoice ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={creatureGoesWithMove}
                      onChange={e => setCreatureGoesWithMove(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span className="text-gray-300 text-xs">Emmener la créature</span>
                  </label>
                ) : (
                  <p className="text-gray-400 text-xs">Suit toutes les troupes</p>
                )}
              </div>
            )}

            <button
              disabled={!canConfirm}
              onClick={handleConfirm}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                canConfirm
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
            >
              ✅ Confirmer le déplacement
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

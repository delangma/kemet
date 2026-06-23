import { useState, useEffect } from "react";
import { ZONE_ADJACENCY } from "../../constants/board";

export default function FleeModal({ fleeOffer, gameState, currentPlayers, onAccept, onDecline }) {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [selectedZone, setSelectedZone] = useState(null);

  const defenderColor = currentPlayers.find(p => p.id === fleeOffer.defenderId)?.color;

  const adjacentZones = ZONE_ADJACENCY[fleeOffer.zoneId] || [];
  const boardUnits = gameState?.boardUnits || {};

  const fleeZones = adjacentZones.filter(zId => {
    const units = boardUnits[zId] || {};
    return !Object.entries(units).some(([color, cnt]) => color !== defenderColor && (cnt || 0) > 0);
  });

  useEffect(() => {
    if (secondsLeft <= 0) { onDecline(); return; }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100]">
      <div className="bg-gray-900 border border-orange-500 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-orange-400 font-bold text-lg">🏃 La Fuite</h2>
          <span className={`text-2xl font-bold tabular-nums ${secondsLeft <= 2 ? "text-red-400 animate-pulse" : "text-yellow-400"}`}>
            {secondsLeft}s
          </span>
        </div>

        <p className="text-gray-300 text-sm mb-4">
          Vous êtes attaqué en <span className="font-bold text-white">{fleeOffer.zoneId}</span>.
          Voulez-vous jouer <span className="font-bold text-orange-400">La Fuite</span> ?
        </p>

        {fleeZones.length > 0 ? (
          <>
            <p className="text-gray-400 text-xs mb-2">Choisissez une zone de repli :</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {fleeZones.map(zId => (
                <button
                  key={zId}
                  onClick={() => setSelectedZone(zId === selectedZone ? null : zId)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                    selectedZone === zId
                      ? "bg-orange-700 border-orange-400 text-white"
                      : "bg-gray-800 border-gray-600 text-gray-300 hover:border-orange-400"
                  }`}
                >
                  {zId}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => selectedZone && onAccept(selectedZone)}
                disabled={!selectedZone}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold ${
                  selectedZone
                    ? "bg-orange-700 hover:bg-orange-600 text-white"
                    : "bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
              >
                Fuir → {selectedZone || "..."}
              </button>
              <button onClick={onDecline}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm">
                Affronter
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-red-400 text-sm mb-4">Aucune zone libre adjacente pour fuir.</p>
            <button onClick={onDecline}
              className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600">
              Affronter le combat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

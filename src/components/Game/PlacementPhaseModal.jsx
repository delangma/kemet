import { useState } from "react";
import { BOARD_ZONES } from "../../constants/board";
import { COLOR_STYLE } from "../../constants/pyramids";

const TEST_BADGES = {
  Rouge: { on: "bg-red-600 text-white border-yellow-400", off: "bg-red-900/50 text-red-300 border-transparent hover:bg-red-800/60" },
  Bleu:  { on: "bg-blue-600 text-white border-yellow-400", off: "bg-blue-900/50 text-blue-300 border-transparent hover:bg-blue-800/60" },
  Vert:  { on: "bg-emerald-600 text-white border-yellow-400", off: "bg-emerald-900/50 text-emerald-300 border-transparent hover:bg-emerald-800/60" },
  Blanc: { on: "bg-gray-300 text-gray-900 border-yellow-400", off: "bg-gray-700/50 text-gray-300 border-transparent hover:bg-gray-600/60" },
  Noir:  { on: "bg-gray-600 text-white border-yellow-400", off: "bg-gray-900/50 text-gray-400 border-transparent hover:bg-gray-800/60" },
};

export default function PlacementPhaseModal({ session, gameState, onConfirm, isTestMode, testPlayers, onSwitchTestPlayer }) {
  const { playerId, allPlayers } = session;
  const myJoinOrder = allPlayers.find(p => p.id === playerId)?.joinOrder;
  const myCityZones = BOARD_ZONES.filter(z => z.id.startsWith(`J${myJoinOrder}C`));

  const placements = gameState?.placements || {};
  const alreadyConfirmed = placements[playerId]?.confirmed === true;
  const pyramids = gameState?.pyramids || {};

  function getPyramidForZone(zoneId) {
    const slotId = zoneId.replace('C', 'P');
    return pyramids[slotId] ?? null;
  }

  const [selected, setSelected] = useState([]);

  function toggleZone(zoneId) {
    if (alreadyConfirmed) return;
    setSelected(prev => {
      if (prev.includes(zoneId)) return prev.filter(z => z !== zoneId);
      if (prev.length >= 2) return prev;
      return [...prev, zoneId];
    });
  }

  const canConfirm = selected.length === 2 && !alreadyConfirmed;

  return (
    <div className="kmt-overlay">
      <div className="kmt-panel w-96">

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

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800">
          <h2 className="kmt-title text-lg">Déploiement Initial</h2>
          <span className="text-xs text-gray-600 bg-gray-800 px-2.5 py-1 rounded-full">
            {allPlayers.filter(p => placements[p.id]?.confirmed).length}/{allPlayers.length}
          </span>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-gray-400 text-sm">
            Choisissez <span className="text-amber-400 font-bold">2 zones</span> de votre cité —{" "}
            <span className="text-amber-400 font-bold">5 unités</span> par zone.
            Tous les joueurs choisissent simultanément.
          </p>

          {!alreadyConfirmed ? (
            <>
              <div className="space-y-2">
                {myCityZones.map((zone, i) => {
                  const isSelected = selected.includes(zone.id);
                  const isDisabled = !isSelected && selected.length >= 2;
                  return (
                    <button
                      key={zone.id}
                      onClick={() => toggleZone(zone.id)}
                      disabled={isDisabled}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-amber-500 bg-amber-900/20 text-white"
                          : isDisabled
                            ? "border-gray-800 bg-gray-800/20 text-gray-600 cursor-not-allowed"
                            : "border-gray-700 bg-gray-800/30 text-gray-300 hover:border-gray-500 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {(() => {
                          const pyr = getPyramidForZone(zone.id);
                          if (pyr) {
                            const s = COLOR_STYLE[pyr.color] || {};
                            return (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded border"
                                style={{ backgroundColor: s.bg + '33', color: s.text, borderColor: s.border }}>
                                {pyr.color} Niv.{pyr.level}
                              </span>
                            );
                          }
                          return <span className="text-xs text-gray-600 w-20">Sans pyramide</span>;
                        })()}
                        <span className="font-semibold text-sm">Zone {i + 1}</span>
                      </div>
                      {isSelected
                        ? <span className="text-amber-400 text-xs font-bold">5 unités ✓</span>
                        : <span className="text-gray-600 text-xs">Sélectionner</span>
                      }
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => canConfirm && onConfirm(selected)}
                disabled={!canConfirm}
                className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all ${canConfirm ? "kmt-btn-gold" : "kmt-btn-disabled"}`}
              >
                {selected.length < 2
                  ? `Sélectionner encore ${2 - selected.length} zone${2 - selected.length > 1 ? "s" : ""}`
                  : "Confirmer le déploiement"}
              </button>
            </>
          ) : (
            <div className="kmt-section p-4 text-sm text-center space-y-2">
              <p className="text-green-400 font-bold">✓ Déploiement confirmé</p>
              {placements[playerId]?.zones?.map(zoneId => {
                const zone = BOARD_ZONES.find(z => z.id === zoneId);
                return (
                  <p key={zoneId} className="text-gray-400">
                    <span className="font-mono text-xs text-gray-600">{zoneId}</span> — 5 unités
                  </p>
                );
              })}
            </div>
          )}

          {/* Statut des joueurs */}
          <div className="kmt-section p-3 space-y-2">
            <p className="kmt-label mb-2">Statut des joueurs</p>
            {allPlayers.map(p => {
              const confirmed = placements[p.id]?.confirmed;
              const isMe = p.id === playerId;
              return (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className={isMe ? "text-white font-semibold" : "text-gray-400"}>
                    {p.name}{isMe ? " (vous)" : ""}
                  </span>
                  <span className={`text-xs font-semibold ${confirmed ? "text-green-400" : "text-gray-600"}`}>
                    {confirmed ? "✓ Prêt" : "⏳ En attente"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { POWER_TILES, TILE_COLOR_STYLE, TYPE_LABEL, getPlayerPyramidLevel, getTileImageUrl } from "../../constants/powerTiles";

const COLORS = ["Rouge", "Bleu", "Blanc", "Noir"];

export default function AllTilesModal({ gameState, session, onClose }) {
  const [activeColor, setActiveColor] = useState("Rouge");
  const { playerId } = session;

  const pyramids       = gameState?.pyramids || {};
  const playerState    = gameState?.players?.[playerId] || {};
  const ank            = playerState.ank ?? 0;
  const ownedTileIds   = playerState.ownedTileIds || [];
  const availableIds   = gameState?.availableTileIds || [];

  const ownedNames = new Set(
    ownedTileIds.map(id => POWER_TILES.find(t => t.id === id)?.name).filter(Boolean)
  );
  const hasCoutReduc = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Cout Pouvoir -1");
  const hasAnkReduc  = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Réduction d'ank");

  // Tuiles visibles : disponibles à l'achat et pas doublon d'une tuile possédée
  const visibleTiles = POWER_TILES.filter(t =>
    availableIds.includes(t.id) && !ownedNames.has(t.name)
  );

  function effectiveCost(tile) {
    return Math.max(0, tile.cost - (hasCoutReduc ? 1 : 0) - (hasAnkReduc ? 1 : 0));
  }

  function blockReason(tile) {
    const myLevel = getPlayerPyramidLevel(playerId, tile.color, pyramids);
    if (myLevel < tile.level) return `Pyramide ${tile.color} niv.${tile.level} requise`;
    if (tile.secondaryColor) {
      const secLevel = getPlayerPyramidLevel(playerId, tile.secondaryColor, pyramids);
      if (secLevel < tile.secondaryLevel) return `+ ${tile.secondaryColor} niv.${tile.secondaryLevel} requise`;
    }
    return null;
  }

  const colorTiles = visibleTiles.filter(t => t.color === activeColor);
  const style = TILE_COLOR_STYLE[activeColor] || TILE_COLOR_STYLE.Noir;

  return (
    <div className="kmt-overlay">
      <div className="kmt-panel w-[600px] max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800 shrink-0">
          <h2 className="kmt-title text-lg">Toutes les tuiles disponibles</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              🪙 <span className="text-amber-400 font-bold">{ank}</span> Or
            </span>
            <button onClick={onClose} className="kmt-close">✕</button>
          </div>
        </div>

        {/* Onglets couleur */}
        <div className="flex border-b border-gray-800 shrink-0">
          {COLORS.map(color => {
            const count = visibleTiles.filter(t => t.color === color).length;
            const cs = TILE_COLOR_STYLE[color];
            return (
              <button
                key={color}
                onClick={() => setActiveColor(color)}
                className={`flex-1 py-2.5 text-sm font-semibold transition-all border-b-2 ${
                  activeColor === color
                    ? `${cs.text} border-current`
                    : "text-gray-500 border-transparent hover:text-gray-300"
                }`}
              >
                {color}
                <span className="ml-1 text-xs opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Contenu */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {[1, 2, 3, 4].map(lvl => {
            const group = colorTiles.filter(t => t.level === lvl);
            if (group.length === 0) return null;
            const myLevel = getPlayerPyramidLevel(playerId, activeColor, pyramids);
            const levelUnlocked = myLevel >= lvl;
            const baseCost = Math.max(0, lvl - (hasCoutReduc ? 1 : 0) - (hasAnkReduc ? 1 : 0));
            return (
              <div key={lvl}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${style.badge || "bg-gray-700"} text-white`}>
                    Niveau {lvl}
                  </span>
                  <span className="text-gray-500 text-xs">— {baseCost} 🪙{hasCoutReduc || hasAnkReduc ? " (réduit)" : ""}</span>
                  {!levelUnlocked && (
                    <span className="text-red-400 text-xs">🔒 pyramide niv.{lvl} requise</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {group.map(tile => {
                    const reason   = blockReason(tile);
                    const blocked  = !!reason;
                    const cost     = effectiveCost(tile);
                    const canAfford = ank >= cost;
                    const typeInfo  = TYPE_LABEL[tile.type] || { icon: "?", label: tile.type };
                    return (
                      <div
                        key={tile.id}
                        className={`rounded-lg border-2 overflow-hidden transition-all ${
                          blocked
                            ? "bg-gray-800/20 border-gray-700/20 opacity-40"
                            : `${style.bg} ${style.border}`
                        }`}
                      >
                        {getTileImageUrl(tile.id) && (
                          <div className="w-full bg-gray-950 flex items-center justify-center">
                            <img
                              src={getTileImageUrl(tile.id)}
                              alt={tile.name}
                              className="max-h-32 w-full object-contain"
                            />
                          </div>
                        )}
                        <div className="p-3">
                        <div className="flex items-start justify-between gap-1">
                          <span className={`text-sm font-bold leading-tight ${blocked ? "text-gray-500" : style.text}`}>
                            {tile.name}
                          </span>
                          <span className={`text-xs font-bold shrink-0 mt-0.5 ${!blocked && canAfford ? "text-amber-400" : "text-gray-500"}`}>
                            {cost} 🪙
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-xs">{typeInfo.icon}</span>
                          <span className="text-xs text-gray-400">{typeInfo.label}</span>
                          {tile.secondaryColor && (
                            <span className="text-xs text-purple-400 font-semibold">
                              + {tile.secondaryColor} niv.{tile.secondaryLevel}
                            </span>
                          )}
                        </div>
                        {reason && (
                          <p className="text-xs text-red-400 mt-1.5">{reason}</p>
                        )}
                        {!blocked && !canAfford && (
                          <p className="text-xs text-orange-400 mt-1.5">
                            Manque {cost - ank} 🪙
                          </p>
                        )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {colorTiles.length === 0 && (
            <div className="kmt-section p-8 text-center">
              <p className="text-gray-500 text-sm">
                Toutes les tuiles {activeColor} ont été achetées ou retirées
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

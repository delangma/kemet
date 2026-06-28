import { POWER_TILES, TILE_COLOR_STYLE, TYPE_LABEL, getPlayerPyramidLevel, getTileImageUrl } from "../../constants/powerTiles";

const COLOR_META = {
  Rouge: { emoji: "🔴", title: "Pouvoirs Rouges" },
  Bleu:  { emoji: "🔵", title: "Pouvoirs Bleus"  },
  Blanc: { emoji: "⬜", title: "Pouvoirs Blancs" },
  Noir:  { emoji: "⬛", title: "Pouvoirs Noirs"  },
};

export default function PowerTileModal({ color, gameState, session, isGoldenBuy = false, onBuy, onClose }) {
  const { playerId } = session;
  const pyramids = gameState?.pyramids || {};
  const playerState = gameState?.players?.[playerId] || {};
  const ank = playerState.ank ?? 7;
  const ownedTileIds = playerState.ownedTileIds || [];
  const availableTileIds = gameState?.availableTileIds || [];

  const ownedNames = ownedTileIds
    .map(id => POWER_TILES.find(t => t.id === id)?.name)
    .filter(Boolean);

  const maxPyramidLevel = getPlayerPyramidLevel(playerId, color, pyramids);
  const tiles = POWER_TILES.filter(t => t.color === color && availableTileIds.includes(t.id));
  const style = TILE_COLOR_STYLE[color] || TILE_COLOR_STYLE.Noir;
  const meta  = COLOR_META[color] || { emoji: "", title: color };

  // Avec le jeton doré, le coût est majoré de +1
  const costSurcharge = isGoldenBuy ? 1 : 0;
  const hasAnkReduc = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Réduction d'ank");
  const hasCoutReduc = ownedTileIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Cout Pouvoir -1");

  function effectiveCost(tile) {
    return Math.max(0, tile.cost + costSurcharge - (hasCoutReduc ? 1 : 0) - (hasAnkReduc ? 1 : 0));
  }

  function secondaryOk(tile) {
    if (!tile.secondaryColor) return true;
    return getPlayerPyramidLevel(playerId, tile.secondaryColor, pyramids) >= tile.secondaryLevel;
  }

  function canBuy(tile) {
    if (ank < effectiveCost(tile)) return false;
    if (ownedNames.includes(tile.name)) return false;
    if (maxPyramidLevel < tile.level) return false;
    if (!secondaryOk(tile)) return false;
    return true;
  }

  function blockReason(tile) {
    if (ownedNames.includes(tile.name)) return "Déjà possédée";
    if (maxPyramidLevel < tile.level) return `Pyramide ${color} niv.${tile.level} requise`;
    if (!secondaryOk(tile)) return `Pyramide ${tile.secondaryColor} niv.${tile.secondaryLevel} requise`;
    if (ank < effectiveCost(tile)) return `${effectiveCost(tile)} 🪙 requis`;
    return null;
  }

  return (
    <div className="kmt-overlay">
      <div className="kmt-panel w-[580px] max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800 shrink-0">
          <h2 className={`kmt-title text-lg`}>{meta.emoji} {meta.title}</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              🪙 <span className="text-amber-400 font-bold">{ank}</span> Or disponible
            </span>
            <span className={`text-xs font-semibold px-2 py-1 rounded ${style.bg} ${style.border} border ${style.text}`}>
              Pyramide max : {maxPyramidLevel > 0 ? `Niv. ${maxPyramidLevel}` : "aucune"}
            </span>
            <button onClick={onClose} className="kmt-close">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {[1, 2, 3, 4].map(lvl => {
            const group = tiles.filter(t => t.level === lvl);
            if (group.length === 0) return null;
            const levelUnlocked = color === "Noir" || maxPyramidLevel >= lvl;
            return (
              <div key={lvl}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${style.badge || "bg-gray-700"} text-white`}>
                    Niveau {lvl}
                  </span>
                  <span className="text-gray-500 text-xs">— coût : {lvl + costSurcharge} 🪙{isGoldenBuy ? " (+1 jeton doré)" : ""}</span>
                  {!levelUnlocked && (
                    <span className="text-red-400 text-xs">🔒 pyramide niv.{lvl} requise</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.map(tile => {
                    const buyable = canBuy(tile);
                    const reason  = blockReason(tile);
                    const typeInfo = TYPE_LABEL[tile.type] || { icon: "?", label: tile.type };
                    return (
                      <button
                        key={tile.id}
                        disabled={!buyable}
                        onClick={() => buyable && onBuy(tile.id)}
                        className={`text-left rounded-lg border-2 transition-all overflow-hidden ${
                          buyable
                            ? `${style.bg} ${style.border} hover:brightness-110 hover:scale-[1.01] cursor-pointer`
                            : "bg-gray-800/30 border-gray-700/30 opacity-40 cursor-not-allowed"
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
                        <div className="p-3.5">
                          <div className="flex items-start justify-between gap-1">
                            <span className={`text-sm font-bold leading-tight ${buyable ? style.text : "text-gray-500"}`}>
                              {tile.name}
                            </span>
                            <span className="text-amber-400 text-xs font-bold shrink-0 mt-0.5">{tile.cost} 🪙</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span>{typeInfo.icon}</span>
                            <span className="text-xs text-gray-400">{typeInfo.label}</span>
                            {tile.secondaryColor && (
                              <span className="text-xs text-purple-400 font-semibold ml-1">
                                + {tile.secondaryColor} niv.{tile.secondaryLevel}
                              </span>
                            )}
                          </div>
                          {reason && <p className="text-xs text-red-400 mt-1">{reason}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {tiles.length === 0 && (
            <div className="kmt-section p-8 text-center">
              <p className="text-gray-500 text-sm">Aucune tuile disponible</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

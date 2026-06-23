import { POWER_TILES, TILE_COLOR_STYLE, TYPE_LABEL, getTileImageUrl } from "../../constants/powerTiles";
import { CREATURE_POWERS } from "../../constants/creaturePowers";
import { getCreatureSpriteStyle } from "../../constants/creatures";

const PLAYER_BADGE = {
  Rouge: "bg-red-700 text-white",
  Bleu:  "bg-blue-700 text-white",
  Vert:  "bg-emerald-700 text-white",
  Blanc: "bg-gray-100 text-gray-900",
  Noir:  "bg-gray-800 text-gray-200 border border-gray-600",
};

const COLOR_ORDER = ["Rouge", "Bleu", "Blanc", "Noir"];

export default function PlayerTilesModal({ player, gameState, onClose }) {
  const state = gameState?.players?.[player.id] || {};
  const ownedTileIds = state.ownedTileIds || [];

  const tiles = ownedTileIds
    .map(id => POWER_TILES.find(t => t.id === id))
    .filter(Boolean);

  const creatures = tiles.filter(t => t.type === "creature");
  const nonCreatures = tiles.filter(t => t.type !== "creature");

  // Group non-creatures by color
  const byColor = {};
  COLOR_ORDER.forEach(c => {
    const group = nonCreatures.filter(t => t.color === c);
    if (group.length) byColor[c] = group;
  });
  // Bicolor tiles (color not in COLOR_ORDER)
  const bicolor = nonCreatures.filter(t => !COLOR_ORDER.includes(t.color));

  if (tiles.length === 0) {
    return (
      <div className="kmt-overlay" onClick={onClose}>
        <div className="kmt-panel w-96 p-8 text-center" onClick={e => e.stopPropagation()}>
          <div className={`inline-block px-3 py-1 rounded-lg text-sm font-bold mb-4 ${PLAYER_BADGE[player.color] || "bg-gray-700 text-white"}`}>
            {player.name}
          </div>
          <p className="text-gray-500 text-sm">Aucune tuile possédée</p>
          <button onClick={onClose} className="mt-4 kmt-btn-ghost text-xs">Fermer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="kmt-overlay" onClick={onClose}>
      <div className="kmt-panel w-[640px] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${PLAYER_BADGE[player.color] || "bg-gray-700 text-white"}`}>
              {player.name}
            </span>
            <span className="text-gray-400 text-sm">{tiles.length} tuile{tiles.length > 1 ? "s" : ""}</span>
          </div>
          <button onClick={onClose} className="kmt-close">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Tuiles par couleur */}
          {Object.entries(byColor).map(([color, group]) => {
            const style = TILE_COLOR_STYLE[color] || TILE_COLOR_STYLE.Noir;
            return (
              <div key={color}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${style.badge || "bg-gray-700"} text-white`}>
                    {color}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.map(tile => {
                    const typeInfo = TYPE_LABEL[tile.type] || { icon: "?", label: tile.type };
                    const imgUrl = getTileImageUrl(tile.id);
                    return (
                      <div
                        key={tile.id}
                        className={`rounded-lg border-2 overflow-hidden ${style.bg} ${style.border}`}
                      >
                        {imgUrl && (
                          <div className="w-full bg-gray-950 flex items-center justify-center">
                            <img src={imgUrl} alt={tile.name} className="max-h-28 w-full object-contain" />
                          </div>
                        )}
                        <div className="p-2.5">
                          <div className="flex items-start justify-between gap-1">
                            <span className={`text-sm font-bold leading-tight ${style.text}`}>{tile.name}</span>
                            <span className="text-amber-400 text-xs font-bold shrink-0">Niv.{tile.level}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[11px]">{typeInfo.icon}</span>
                            <span className="text-[11px] text-gray-400">{typeInfo.label}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Tuiles bicolores */}
          {bicolor.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-800 text-white">Bicolores</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {bicolor.map(tile => {
                  const style = TILE_COLOR_STYLE[tile.color] || TILE_COLOR_STYLE.Noir;
                  const typeInfo = TYPE_LABEL[tile.type] || { icon: "?", label: tile.type };
                  return (
                    <div key={tile.id} className={`rounded-lg border-2 p-2.5 ${style.bg} ${style.border}`}>
                      <span className={`text-sm font-bold ${style.text}`}>{tile.name}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[11px]">{typeInfo.icon}</span>
                        <span className="text-[11px] text-gray-400">{typeInfo.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Créatures */}
          {creatures.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-800 text-white">Créatures</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {creatures.map(tile => {
                  const style = TILE_COLOR_STYLE[tile.color] || TILE_COLOR_STYLE.Noir;
                  const power = CREATURE_POWERS[tile.name];
                  const spriteStyle = getCreatureSpriteStyle(tile.name, 48);
                  return (
                    <div key={tile.id} className={`rounded-lg border-2 p-2.5 flex items-start gap-3 ${style.bg} ${style.border}`}>
                      {spriteStyle && (
                        <div style={spriteStyle} className="shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className={`text-sm font-bold ${style.text}`}>{tile.name}</span>
                        {power && (
                          <div className="mt-1 space-y-0.5">
                            {power.attack  != null && <p className="text-[11px] text-red-400">⚔️ +{power.attack} attaque</p>}
                            {power.defense != null && <p className="text-[11px] text-blue-400">🛡 +{power.defense} défense</p>}
                            {power.shield  != null && <p className="text-[11px] text-cyan-400">💠 {power.shield} bouclier</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

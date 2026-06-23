import { POWER_TILES, TILE_COLOR_STYLE, TYPE_LABEL, getPlayerPyramidColors } from "../../constants/powerTiles";

const PLAYER_COLOR_TEXT = {
  Rouge: "text-red-400", Bleu: "text-blue-400",
  Vert: "text-emerald-400", Blanc: "text-gray-200", Noir: "text-gray-400",
};

const TEST_BADGES = {
  Rouge: { on: "bg-red-600 text-white border-yellow-400", off: "bg-red-900/50 text-red-300 border-transparent hover:bg-red-800/60" },
  Bleu:  { on: "bg-blue-600 text-white border-yellow-400", off: "bg-blue-900/50 text-blue-300 border-transparent hover:bg-blue-800/60" },
  Vert:  { on: "bg-emerald-600 text-white border-yellow-400", off: "bg-emerald-900/50 text-emerald-300 border-transparent hover:bg-emerald-800/60" },
  Blanc: { on: "bg-gray-300 text-gray-900 border-yellow-400", off: "bg-gray-700/50 text-gray-300 border-transparent hover:bg-gray-600/60" },
  Noir:  { on: "bg-gray-600 text-white border-yellow-400", off: "bg-gray-900/50 text-gray-400 border-transparent hover:bg-gray-800/60" },
};

export default function DraftPhaseModal({ session, gameState, onPick, isTestMode, testPlayers, onSwitchTestPlayer }) {
  const { playerId, allPlayers } = session;
  const draftOrder = gameState?.draftOrder || [];
  const draftIndex = gameState?.draftIndex ?? 0;
  const currentDraftPlayerId = draftOrder[draftIndex];
  const isMyTurn = currentDraftPlayerId === playerId;

  const currentDraftPlayer = allPlayers.find(p => p.id === currentDraftPlayerId);
  const pyramids = gameState?.pyramids || {};
  const availableTileIds = gameState?.availableTileIds || [];

  const myColors = isMyTurn ? getPlayerPyramidColors(playerId, pyramids) : [];
  const eligibleTiles = POWER_TILES.filter(
    t => t.level === 1 && myColors.includes(t.color) && availableTileIds.includes(t.id)
  );

  const progress = `${draftIndex + 1} / ${draftOrder.length}`;

  const pickedByPlayers = draftOrder.slice(0, draftIndex).map(pid => {
    const player = allPlayers.find(p => p.id === pid);
    const tileIds = gameState?.players?.[pid]?.ownedTileIds || [];
    const tiles = tileIds.map(tid => POWER_TILES.find(t => t.id === tid)).filter(Boolean);
    return { player, tiles };
  }).filter(e => e.player && e.tiles.length > 0);

  return (
    <div className="kmt-overlay">
      <div className="kmt-panel w-[540px] max-h-[85vh] flex flex-col">

        {isTestMode && testPlayers && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-yellow-950/80 border-b border-yellow-700/40 shrink-0">
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

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800 shrink-0">
          <h2 className="kmt-title text-lg">Tuile de Départ</h2>
          <span className="text-xs text-gray-600 bg-gray-800 px-2.5 py-1 rounded-full">{progress}</span>
        </div>

        <div className="px-6 py-5 flex-1 flex flex-col overflow-hidden">
          <p className={`text-sm font-semibold mb-4 ${isMyTurn ? "text-amber-400" : "text-gray-400"}`}>
            {isMyTurn ? "⚡ Choisissez votre tuile pouvoir gratuite (Niveau 1)" : `⏳ ${currentDraftPlayer?.name ?? "..."} choisit…`}
          </p>

          {pickedByPlayers.length > 0 && (
            <div className="mb-4 shrink-0">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Déjà choisi</p>
              <div className="space-y-1.5">
                {pickedByPlayers.map(({ player, tiles }) => (
                  <div key={player.id} className="flex items-center gap-2 flex-wrap bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className={`text-xs font-bold w-16 shrink-0 ${PLAYER_COLOR_TEXT[player.color] || 'text-gray-400'}`}>
                      {player.name}
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      {tiles.map(tile => {
                        const style = TILE_COLOR_STYLE[tile.color] || TILE_COLOR_STYLE.Noir;
                        return (
                          <span key={tile.id}
                            className={`text-xs px-2 py-0.5 rounded border font-medium ${style.text} ${style.border} ${style.bg}`}>
                            {tile.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isMyTurn ? (
            <div className="kmt-section p-8 text-center">
              <p className="text-gray-400 text-sm">
                <span className={`font-bold ${PLAYER_COLOR_TEXT[currentDraftPlayer?.color]}`}>{currentDraftPlayer?.name}</span>{" "}
                choisit sa tuile de départ…
              </p>
              <p className="text-gray-600 text-xs mt-2">Ordre inverse de setup — le dernier choisit en premier</p>
            </div>
          ) : (
            <>
              {myColors.length === 0 && (
                <div className="kmt-section p-6 text-center">
                  <p className="text-red-400 text-sm">Aucune pyramide — vous ne pouvez pas choisir de tuile.</p>
                </div>
              )}
              {myColors.length > 0 && eligibleTiles.length === 0 && (
                <div className="kmt-section p-6 text-center">
                  <p className="text-gray-500 text-sm">Aucune tuile de niveau 1 disponible.</p>
                </div>
              )}
              <div className="overflow-y-auto flex-1 space-y-5">
                {myColors.map(color => {
                  const group = eligibleTiles.filter(t => t.color === color);
                  if (group.length === 0) return null;
                  const style = TILE_COLOR_STYLE[color] || TILE_COLOR_STYLE.Noir;
                  return (
                    <div key={color}>
                      <p className={`kmt-label mb-2 ${style.text}`}>{color}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {group.map(tile => {
                          const typeInfo = TYPE_LABEL[tile.type] || { icon: "?", label: tile.type };
                          return (
                            <button
                              key={tile.id}
                              onClick={() => onPick(tile.id)}
                              className={`text-left p-3.5 rounded-lg border-2 transition-all hover:scale-[1.02] hover:brightness-110 ${style.bg} ${style.border}`}
                            >
                              <p className={`text-sm font-bold ${style.text}`}>{tile.name}</p>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="text-sm">{typeInfo.icon}</span>
                                <span className="text-xs text-gray-400">{typeInfo.label}</span>
                              </div>
                              <p className="text-xs text-green-400 font-semibold mt-1.5">✦ Gratuit</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

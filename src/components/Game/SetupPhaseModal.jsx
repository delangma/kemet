import { useState } from "react";
import { PYRAMID_SLOTS, PYRAMID_COLORS, COLOR_STYLE } from "../../constants/pyramids";

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

export default function SetupPhaseModal({ session, gameState, onConfirm, isTestMode, testPlayers, onSwitchTestPlayer }) {
  const { playerId, allPlayers } = session;
  const setupOrder = gameState?.setupOrder || [];
  const setupIndex = gameState?.setupIndex ?? 0;
  const currentSetupPlayerId = setupOrder[setupIndex];
  const isMyTurn = currentSetupPlayerId === playerId;

  const currentSetupPlayer = allPlayers.find(p => p.id === currentSetupPlayerId);
  const mySlots = PYRAMID_SLOTS.filter(s => s.cityId === `J${currentSetupPlayer?.joinOrder}`);

  const [option, setOption] = useState(null);
  const [colors, setColors] = useState([null, null, null]);

  const pyramidDefs = option === "A"
    ? [{ level: 1 }, { level: 1 }, { level: 1 }]
    : option === "B" ? [{ level: 2 }, { level: 1 }] : [];

  function setColor(index, color) {
    setColors(prev => { const n = [...prev]; n[index] = color; return n; });
  }

  function getAvailableColors(currentIndex) {
    const taken = colors.filter((c, i) => i !== currentIndex && c !== null);
    return PYRAMID_COLORS.filter(c => !taken.includes(c));
  }

  function handleOptionChange(opt) { setOption(opt); setColors([null, null, null]); }

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm(pyramidDefs.map((def, i) => ({ slotId: mySlots[i].id, color: colors[i], level: def.level })));
  }

  const canConfirm = option && pyramidDefs.every((_, i) => colors[i] !== null);
  const progress = `${setupIndex + 1} / ${setupOrder.length}`;

  const chosenByPlayers = setupOrder.slice(0, setupIndex).map(pid => {
    const player = allPlayers.find(p => p.id === pid);
    const playerPyramids = Object.values(gameState?.pyramids || {})
      .filter(pyr => pyr.controllerId === pid)
      .sort((a, b) => b.level - a.level);
    return { player, pyramids: playerPyramids };
  }).filter(e => e.player && e.pyramids.length > 0);

  return (
    <div className="kmt-overlay">
      <div className="kmt-panel w-96 max-h-[90vh] overflow-y-auto">

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
          <h2 className="kmt-title text-lg">Phase de Préparation</h2>
          <span className="text-xs text-gray-600 bg-gray-800 px-2.5 py-1 rounded-full">{progress}</span>
        </div>

        <div className="px-6 py-5">
          <p className={`text-sm font-semibold mb-4 ${isMyTurn ? "text-amber-400" : "text-gray-400"}`}>
            {isMyTurn ? "⚡ À votre tour de choisir" : `⏳ ${currentSetupPlayer?.name ?? "..."} choisit ses pyramides…`}
          </p>

          {chosenByPlayers.length > 0 && (
            <div className="mb-5">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Déjà choisi</p>
              <div className="space-y-1.5">
                {chosenByPlayers.map(({ player, pyramids }) => (
                  <div key={player.id} className="flex items-center gap-2 flex-wrap bg-gray-800/50 rounded-lg px-3 py-2">
                    <span className={`text-xs font-bold w-16 shrink-0 ${PLAYER_COLOR_TEXT[player.color] || 'text-gray-400'}`}>
                      {player.name}
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      {pyramids.map((pyr, idx) => {
                        const style = COLOR_STYLE[pyr.color] || {};
                        return (
                          <span key={idx}
                            className="text-xs px-2 py-0.5 rounded border font-medium"
                            style={{ backgroundColor: style.bg + '33', color: style.text, borderColor: style.border }}>
                            Niv.{pyr.level} {pyr.color}
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
              <p className="text-gray-400 text-sm">En attente de <span className="text-amber-400 font-bold">{currentSetupPlayer?.name}</span></p>
            </div>
          ) : !option ? (
            <div className="space-y-3">
              <p className="text-gray-400 text-sm mb-4">Choisissez votre formation de départ :</p>
              <div className="flex gap-3">
                {[
                  { id: "A", title: "3 × Niveau 1", sub: "Flexibilité maximale", dots: [1,1,1] },
                  { id: "B", title: "Niv. 2 + Niv. 1", sub: "Démarrage puissant", dots: [2,1] },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleOptionChange(opt.id)}
                    className="flex-1 kmt-section p-4 text-center hover:border-amber-700/50 transition-all group"
                  >
                    <p className="text-amber-400 font-bold text-sm mb-3 group-hover:text-amber-300">{opt.title}</p>
                    <div className="flex justify-center items-end gap-1.5 mb-3">
                      {opt.dots.map((lvl, i) => (
                        <div key={i} className={`rounded bg-gray-600 border border-gray-500 ${lvl === 2 ? "w-7 h-7" : "w-5 h-5"}`} />
                      ))}
                    </div>
                    <p className="text-gray-500 text-xs">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <button onClick={() => setOption(null)} className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1 transition-colors">
                ← Retour
              </button>
              <p className="text-gray-400 text-sm">
                {option === "A" ? "Choisissez une couleur pour chacune des 3 pyramides :" : "Choisissez les couleurs de vos 2 pyramides :"}
              </p>

              {pyramidDefs.map((def, i) => (
                <div key={i} className="kmt-section p-3">
                  <p className="text-gray-300 text-sm mb-3">
                    Pyramide {i + 1} — <span className="text-amber-400 font-bold">Niveau {def.level}</span>
                    {colors[i] && <span className="text-gray-400 ml-2">→ {colors[i]}</span>}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {getAvailableColors(i).map(c => {
                      const style = COLOR_STYLE[c];
                      const selected = colors[i] === c;
                      return (
                        <button
                          key={c}
                          onClick={() => setColor(i, selected ? null : c)}
                          className={`px-3 py-2 rounded-lg border-2 transition-all text-sm font-semibold ${
                            selected ? "scale-105 shadow-md" : "opacity-70 hover:opacity-100"
                          }`}
                          style={{
                            backgroundColor: style.bg + "cc",
                            color: style.text,
                            borderColor: selected ? style.border : "transparent",
                          }}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all ${canConfirm ? "kmt-btn-gold" : "kmt-btn-disabled"}`}
              >
                Confirmer les pyramides
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

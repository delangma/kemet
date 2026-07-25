import { useState, useId } from "react";
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

// Pyramide en triangle plein — le chiffre au centre indique le niveau,
// la couleur (ou le gris neutre si pas encore choisie) l'appartenance.
function PyramidTriangle({ level, color, size = 64, selected = false, muted = false }) {
  const gradId = useId();
  const style = COLOR_STYLE[color] || COLOR_STYLE.null;
  const w = size;
  const h = Math.round(size * 0.88);
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 100 88"
      style={{
        display: "block",
        opacity: muted ? 0.4 : 1,
        filter: selected
          ? `drop-shadow(0 0 7px ${style.border}) drop-shadow(0 2px 3px rgba(0,0,0,0.6))`
          : "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
        transition: "all 0.15s",
      }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={style.bg} stopOpacity="1" />
          <stop offset="100%" stopColor={style.bg} stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <polygon
        points="50,5 96,84 4,84"
        fill={`url(#${gradId})`}
        stroke={selected ? "#fbbf24" : style.border}
        strokeWidth={selected ? 4.5 : 2.5}
        strokeLinejoin="round"
      />
      <line x1="50" y1="5" x2="50" y2="84" stroke={style.border} strokeOpacity="0.3" strokeWidth="1.5" />
      <text x="50" y="68" textAnchor="middle" fontSize="38" fontWeight="800" fill={style.text}>
        {level}
      </text>
    </svg>
  );
}

// Nuance cliquable pour le choix de couleur — même forme triangulaire, sans
// niveau, pour rester cohérent visuellement avec les pyramides déjà posées.
function ColorSwatchTriangle({ color, selected, onClick, size = 52 }) {
  const style = COLOR_STYLE[color] || COLOR_STYLE.null;
  return (
    <button
      onClick={onClick}
      title={color}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
      className="flex flex-col items-center gap-1.5 group"
    >
      <svg
        width={size}
        height={size * 0.88}
        viewBox="0 0 100 88"
        style={{
          filter: selected
            ? `drop-shadow(0 0 8px ${style.border}) drop-shadow(0 2px 3px rgba(0,0,0,0.6))`
            : "drop-shadow(0 2px 3px rgba(0,0,0,0.4))",
          transform: selected ? "scale(1.08) translateY(-2px)" : "scale(1)",
          transition: "all 0.15s",
        }}
        className={selected ? "" : "group-hover:opacity-100 opacity-80"}
      >
        <polygon
          points="50,5 96,84 4,84"
          fill={style.bg}
          stroke={selected ? "#fbbf24" : style.border}
          strokeWidth={selected ? 4.5 : 2.5}
          strokeLinejoin="round"
        />
      </svg>
      <span className={`text-[11px] font-semibold transition-colors ${selected ? "text-amber-300" : "text-gray-500 group-hover:text-gray-300"}`}>
        {color}
      </span>
    </button>
  );
}

export default function SetupPhaseModal({ session, gameState, onConfirm, isTestMode, testPlayers, onSwitchTestPlayer, onShowTaSeti, onShowIdCards }) {
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

  const chosenByPlayers = setupOrder.slice(0, setupIndex).map(pid => {
    const player = allPlayers.find(p => p.id === pid);
    const playerPyramids = Object.values(gameState?.pyramids || {})
      .filter(pyr => pyr.controllerId === pid)
      .sort((a, b) => b.level - a.level);
    return { player, pyramids: playerPyramids };
  }).filter(e => e.player && e.pyramids.length > 0);

  return (
    <div className="kmt-overlay">
      <div
        className="kmt-panel w-[640px] max-w-[95vw] max-h-[92vh] overflow-y-auto"
        style={{
          background: "radial-gradient(ellipse at top, rgba(120,84,20,0.14), transparent 60%), #111827",
          border: "1px solid rgba(180,130,40,0.35)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 20px 60px rgba(0,0,0,0.65), 0 0 90px rgba(180,130,40,0.08)",
        }}
      >

        {isTestMode && testPlayers && (
          <div className="flex items-center gap-2 px-5 py-2 bg-yellow-950/80 border-b border-yellow-700/40">
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

        <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-amber-900/25">
          <h2 className="kmt-title text-2xl tracking-wide">Phase de Préparation</h2>
          <div className="flex items-center gap-2.5">
            {onShowTaSeti && (
              <button onClick={onShowTaSeti} title="Voir le plateau Ta-Seti" className="kmt-btn-ghost text-xs px-3 py-1.5">
                𓂀 Ta-Seti
              </button>
            )}
            {onShowIdCards && (
              <button onClick={onShowIdCards} title="Voir mes cartes ID" className="kmt-btn-ghost text-xs px-3 py-1.5">
                🃏 Mes ID
              </button>
            )}
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="flex items-center justify-between mb-5">
            <p className={`text-base font-semibold ${isMyTurn ? "text-amber-400" : "text-gray-400"}`}>
              {isMyTurn ? "⚡ À votre tour de choisir" : `⏳ ${currentSetupPlayer?.name ?? "..."} choisit ses pyramides…`}
            </p>
            {isMyTurn && option && (
              <button
                onClick={() => setOption(null)}
                className="text-amber-400 hover:text-amber-300 text-xs font-bold px-3 py-1.5 rounded-md border border-amber-700/40 bg-amber-900/20 hover:bg-amber-900/30 transition-all flex items-center gap-1 shrink-0"
              >
                ← Retour
              </button>
            )}
          </div>

          {chosenByPlayers.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-2.5">Déjà choisi</p>
              <div className="space-y-2">
                {chosenByPlayers.map(({ player, pyramids }) => (
                  <div key={player.id} className="flex items-center gap-4 flex-wrap bg-gray-800/40 border border-gray-700/30 rounded-xl px-4 py-3">
                    <span className={`text-sm font-bold w-20 shrink-0 ${PLAYER_COLOR_TEXT[player.color] || 'text-gray-400'}`}>
                      {player.name}
                    </span>
                    <div className="flex gap-3 flex-wrap">
                      {pyramids.map((pyr, idx) => (
                        <PyramidTriangle key={idx} level={pyr.level} color={pyr.color} size={48} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isMyTurn ? (
            <div className="kmt-section p-10 text-center">
              <p className="text-gray-400 text-base">En attente de <span className="text-amber-400 font-bold">{currentSetupPlayer?.name}</span></p>
            </div>
          ) : !option ? (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm mb-1">Choisissez votre formation de départ :</p>
              <div className="flex gap-4">
                {[
                  { id: "A", title: "3 × Niveau 1", sub: "Flexibilité maximale", levels: [1, 1, 1] },
                  { id: "B", title: "Niv. 2 + Niv. 1", sub: "Démarrage puissant", levels: [2, 1] },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleOptionChange(opt.id)}
                    className="flex-1 kmt-section p-6 text-center hover:border-amber-600/60 hover:bg-gray-800/60 transition-all group"
                  >
                    <p className="text-amber-400 font-bold text-base mb-4 group-hover:text-amber-300">{opt.title}</p>
                    <div className="flex justify-center items-end gap-3 mb-4">
                      {opt.levels.map((lvl, i) => (
                        <PyramidTriangle key={i} level={lvl} color={null} size={lvl === 2 ? 60 : 46} />
                      ))}
                    </div>
                    <p className="text-gray-500 text-xs">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-amber-400 text-sm">
                {option === "A" ? "Choisissez une couleur pour chacune des 3 pyramides :" : "Choisissez les couleurs de vos 2 pyramides :"}
              </p>

              <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: pyramidDefs.length === 3 ? "repeat(3, 1fr)" : "repeat(2, 1fr)" }}>
                {pyramidDefs.map((def, i) => (
                  <div key={i} className="kmt-section p-4 flex flex-col items-center gap-3">
                    <PyramidTriangle level={def.level} color={colors[i]} size={56} selected={!!colors[i]} muted={!colors[i]} />
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Pyramide {i + 1}</p>
                    <div className="flex gap-2 flex-wrap justify-center pt-1">
                      {getAvailableColors(i).map(c => (
                        <ColorSwatchTriangle
                          key={c}
                          color={c}
                          selected={colors[i] === c}
                          onClick={() => setColor(i, colors[i] === c ? null : c)}
                          size={38}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className={`w-full py-3 rounded-lg font-bold text-base transition-all ${canConfirm ? "kmt-btn-gold" : "kmt-btn-disabled"}`}
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

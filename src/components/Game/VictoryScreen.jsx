import { computeTempVP } from "../../utils/vp";

const COLOR_STYLE = {
  Rouge: { text: "text-red-400",     bg: "bg-red-900/40",     border: "border-red-500/70"     },
  Bleu:  { text: "text-blue-400",    bg: "bg-blue-900/40",    border: "border-blue-500/70"    },
  Vert:  { text: "text-emerald-400", bg: "bg-emerald-900/40", border: "border-emerald-500/70" },
  Blanc: { text: "text-gray-200",    bg: "bg-gray-700/40",    border: "border-gray-400/70"    },
  Noir:  { text: "text-gray-400",    bg: "bg-gray-800/40",    border: "border-gray-500/70"    },
};

export default function VictoryScreen({ winnerId, allPlayers, gameState }) {
  const winner = allPlayers.find(p => p.id === winnerId);
  const ws = COLOR_STYLE[winner?.color] || COLOR_STYLE.Blanc;

  const scores = allPlayers
    .map(p => {
      const perm = gameState?.players?.[p.id]?.vpPermanent ?? 0;
      const temp = computeTempVP(p.id, gameState, allPlayers);
      const combat = gameState?.players?.[p.id]?.vpCombat ?? 0;
      return { ...p, perm, temp, combat, total: perm + temp };
    })
    .sort((a, b) => b.total - a.total);

  const winnerScore = scores.find(s => s.id === winnerId);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.93)", backdropFilter: "blur(6px)" }}
    >
      <div className="flex flex-col items-center gap-6 w-full max-w-sm px-4">

        <div className="text-5xl select-none">𓂀</div>
        <h1 className="text-3xl font-bold tracking-widest text-amber-400 uppercase">Victoire !</h1>

        {/* Carte vainqueur */}
        <div className={`w-full rounded-xl border-2 ${ws.border} ${ws.bg} p-5 text-center`}>
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Vainqueur</p>
          <p className={`text-2xl font-bold ${ws.text}`}>{winner?.name ?? "?"}</p>
          <p className="text-amber-400 text-lg font-bold mt-1">
            {winnerScore?.total ?? 0} points de victoire
          </p>
        </div>

        {/* Classement */}
        <div className="w-full space-y-2">
          {scores.map((p, i) => {
            const s = COLOR_STYLE[p.color] || COLOR_STYLE.Blanc;
            const isWinner = p.id === winnerId;
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${s.bg} ${
                  isWinner ? `${s.border} border-2` : "border-gray-700/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm w-4">{i + 1}.</span>
                  <span className={`font-semibold ${s.text}`}>{p.name}</span>
                  {isWinner && <span className="text-amber-400 text-xs">★</span>}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 text-xs">{p.perm}+{p.temp} · ⚔{p.combat}</span>
                  <span className={`font-bold text-base ${isWinner ? "text-amber-400" : "text-white"}`}>
                    {p.total} PV
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-colors tracking-wide"
        >
          Retour à l'accueil
        </button>
      </div>
    </div>
  );
}

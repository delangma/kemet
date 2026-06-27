import { BOARD_ZONES } from "../../constants/board";

const TEST_BADGES = {
  Rouge: { on: "bg-red-600 text-white border-yellow-400", off: "bg-red-900/50 text-red-300 border-transparent hover:bg-red-800/60" },
  Bleu:  { on: "bg-blue-600 text-white border-yellow-400", off: "bg-blue-900/50 text-blue-300 border-transparent hover:bg-blue-800/60" },
  Vert:  { on: "bg-emerald-600 text-white border-yellow-400", off: "bg-emerald-900/50 text-emerald-300 border-transparent hover:bg-emerald-800/60" },
  Blanc: { on: "bg-gray-300 text-gray-900 border-yellow-400", off: "bg-gray-700/50 text-gray-300 border-transparent hover:bg-gray-600/60" },
  Noir:  { on: "bg-gray-600 text-white border-yellow-400", off: "bg-gray-900/50 text-gray-400 border-transparent hover:bg-gray-800/60" },
};

export default function PlacementPhaseModal({ session, gameState, isTestMode, testPlayers, onSwitchTestPlayer }) {
  const { playerId, allPlayers } = session;
  const placements = gameState?.placements || {};
  const alreadyConfirmed = placements[playerId]?.confirmed === true;
  const confirmedCount = allPlayers.filter(p => placements[p.id]?.confirmed).length;

  return (
    <div className="fixed bottom-4 right-4 z-20 flex flex-col gap-2 items-end pointer-events-auto">

      {/* Sélecteur joueur test */}
      {isTestMode && testPlayers && (
        <div className="flex items-center gap-2 bg-yellow-950/90 border border-yellow-700/50 rounded-lg px-3 py-1.5">
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

      {/* Statut des joueurs */}
      <div className="bg-gray-900/95 border border-gray-700 rounded-lg px-4 py-3 min-w-[200px]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Déploiement</span>
          <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{confirmedCount}/{allPlayers.length}</span>
        </div>
        {alreadyConfirmed && (
          <p className="text-green-400 text-xs font-semibold mb-2">✓ Votre déploiement est confirmé</p>
        )}
        <div className="space-y-1">
          {allPlayers.map(p => {
            const confirmed = placements[p.id]?.confirmed;
            const isMe = p.id === playerId;
            return (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className={isMe ? "text-white font-semibold" : "text-gray-400"}>
                  {p.name}{isMe ? " (vous)" : ""}
                </span>
                <span className={confirmed ? "text-green-400" : "text-gray-600"}>
                  {confirmed ? "✓" : "⏳"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const TEST_BADGES = {
  Rouge: { on: "bg-red-600 text-white border-yellow-400", off: "bg-red-900/50 text-red-300 border-transparent hover:bg-red-800/60" },
  Bleu:  { on: "bg-blue-600 text-white border-yellow-400", off: "bg-blue-900/50 text-blue-300 border-transparent hover:bg-blue-800/60" },
  Vert:  { on: "bg-emerald-600 text-white border-yellow-400", off: "bg-emerald-900/50 text-emerald-300 border-transparent hover:bg-emerald-800/60" },
  Blanc: { on: "bg-gray-300 text-gray-900 border-yellow-400", off: "bg-gray-700/50 text-gray-300 border-transparent hover:bg-gray-600/60" },
  Noir:  { on: "bg-gray-600 text-white border-yellow-400", off: "bg-gray-900/50 text-gray-400 border-transparent hover:bg-gray-800/60" },
};

export default function CancelIdModal({ pendingIdCard, allPlayers, hasAnnulCard, onCancel, onIgnore, isTestMode, testPlayers, activeTestPlayerId, onSwitchTestPlayer }) {
  const actor = allPlayers.find(p => p.id === pendingIdCard.actorId);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100]">
      <div className="bg-gray-900 border border-purple-500 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        {isTestMode && testPlayers && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-yellow-950/80 border-b border-yellow-700/40">
            <span className="text-yellow-400 text-xs font-bold shrink-0">Vue :</span>
            {testPlayers.map(p => {
              const b = TEST_BADGES[p.color] || TEST_BADGES.Noir;
              const isSelected = p.id === activeTestPlayerId;
              return (
                <button key={p.id} onClick={() => onSwitchTestPlayer(p.id)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all ${isSelected ? b.on : b.off}`}>
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
        <div className="p-6">
        <h2 className="text-purple-400 font-bold text-lg mb-4">🃏 Carte ID jouée</h2>

        <p className="text-gray-300 text-sm mb-5">
          <span className="font-bold text-white">{actor?.name ?? "?"}</span> joue{" "}
          <span className="font-bold text-amber-300">{pendingIdCard.cardData?.name}</span>.
          {hasAnnulCard
            ? <> Voulez-vous utiliser votre <span className="font-bold text-purple-400">Annulation d'ID</span> ?</>
            : <> Vous n'avez pas de carte Annulation d'ID.</>
          }
        </p>

        <div className="flex gap-3">
          {hasAnnulCard && (
            <button onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 font-semibold">
              Annuler la carte
            </button>
          )}
          <button onClick={onIgnore}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm">
            Laisser passer
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

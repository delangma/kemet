export default function IdRecoverModal({ idDiscard, onPick, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-purple-500 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-purple-400 font-bold text-lg mb-1">Récupération d'ID</h2>
        <p className="text-gray-400 text-sm mb-4">Choisissez une carte dans la défausse.</p>

        {idDiscard.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 text-sm mb-4">La défausse est vide.</p>
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm">
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-5 max-h-64 overflow-y-auto">
              {idDiscard.map((card, i) => (
                <button
                  key={card.instanceId ?? i}
                  onClick={() => onPick(card)}
                  className="rounded-lg p-2 text-xs w-32 text-center border border-gray-600 bg-gray-800 hover:border-purple-400 hover:bg-purple-900 transition-all"
                >
                  <p className="text-white font-semibold">{card.name}</p>
                  {card.cost > 0 && <p className="text-yellow-400">{card.cost} Ank</p>}
                  <p className="text-gray-400 mt-1 capitalize">{card.timing}</p>
                </button>
              ))}
            </div>
            <button onClick={onClose} className="w-full px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm">
              Annuler
            </button>
          </>
        )}
      </div>
    </div>
  );
}

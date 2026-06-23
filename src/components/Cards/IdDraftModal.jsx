import { useState } from "react";
import IdCard from "./IdCard";

const TIMING_META = {
  combat: { label: "⚔️ Combat", color: "text-red-400" },
  day:    { label: "☀️ Jour",   color: "text-amber-400" },
  any:    { label: "🔄 Toutes phases", color: "text-purple-400" },
};

export default function IdDraftModal({ cards, onPick, onClose }) {
  const [selected, setSelected] = useState(null);

  const timing = selected ? TIMING_META[selected.timing] : null;

  return (
    <div className="kmt-overlay">
      <div className="kmt-panel w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800">
          <h2 className="kmt-title text-xl">🃏 Choix supplémentaire — Gardez 1 carte</h2>
          <button onClick={onClose} className="kmt-close">✕</button>
        </div>

        <div className="flex gap-4 px-6 py-5">
          <div className="flex-1">
            <p className="text-gray-400 text-xs mb-4">Cliquez sur une carte pour la sélectionner, puis confirmez.</p>
            <div className="flex flex-wrap gap-3">
              {cards.map(card => (
                <IdCard
                  key={card.instanceId}
                  card={card}
                  size="md"
                  selected={selected?.instanceId === card.instanceId}
                  onClick={() => setSelected(prev => prev?.instanceId === card.instanceId ? null : card)}
                />
              ))}
            </div>
          </div>

          <div className="w-44 shrink-0 flex flex-col gap-3">
            {selected ? (
              <>
                <IdCard card={selected} size="lg" />
                {timing && (
                  <p className={`text-xs ${timing.color}`}>{timing.label}</p>
                )}
                <button
                  onClick={() => onPick(selected)}
                  className="w-full py-2 rounded-lg font-bold text-sm bg-purple-700 hover:bg-purple-600 text-white transition-colors"
                >
                  Garder cette carte
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="text-gray-600 hover:text-gray-400 text-xs text-center transition-colors"
                >
                  Désélectionner
                </button>
              </>
            ) : (
              <div className="kmt-section p-4 flex-1 flex items-center justify-center">
                <p className="text-gray-600 text-xs text-center leading-relaxed">
                  Sélectionnez une carte à garder
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

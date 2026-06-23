import { useState } from "react";
import IdCard from "./IdCard";

export default function IdRefreshModal({ currentCards, onConfirm, onClose }) {
  const [toDiscard, setToDiscard] = useState(new Set());

  function toggleDiscard(instanceId) {
    setToDiscard(prev => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  }

  const discardCount = toDiscard.size;
  const drawCount = discardCount + 1;

  return (
    <div className="kmt-overlay">
      <div className="kmt-panel w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800">
          <h2 className="kmt-title text-xl">🔄 Draft ID</h2>
          <button onClick={onClose} className="kmt-close">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-gray-400 text-sm">
            Cliquez sur les cartes à défausser, puis confirmez. Vous piochez <span className="text-amber-300 font-bold">{drawCount}</span> carte{drawCount > 1 ? "s" : ""}.
          </p>

          {currentCards.length === 0 ? (
            <div className="kmt-section p-6 text-center">
              <p className="text-gray-500 text-sm italic">Aucune carte ID en main — vous piochez 1 carte.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {currentCards.map(card => (
                <div key={card.instanceId} className="relative">
                  <IdCard
                    card={card}
                    size="md"
                    selected={toDiscard.has(card.instanceId)}
                    onClick={() => toggleDiscard(card.instanceId)}
                  />
                  {toDiscard.has(card.instanceId) && (
                    <div className="absolute inset-0 rounded-lg bg-red-900/50 flex items-center justify-center pointer-events-none">
                      <span className="text-red-300 text-xs font-bold">Défausser</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => onConfirm(currentCards.filter(c => toDiscard.has(c.instanceId)))}
            className="w-full py-3 rounded-lg font-bold kmt-btn-gold"
          >
            Défausser {discardCount} → Piocher {drawCount}
          </button>
        </div>
      </div>
    </div>
  );
}

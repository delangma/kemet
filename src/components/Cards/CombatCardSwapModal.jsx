import { useState } from "react";
import { COMBAT_CARDS } from "../../constants/cards";

export default function CombatCardSwapModal({ deckIds, newCardId, onConfirm, onClose }) {
  const [selected, setSelected] = useState(null);

  const newCard = COMBAT_CARDS.find(c => c.id === newCardId);
  const cards = (deckIds || [])
    .map(id => COMBAT_CARDS.find(c => c.id === id))
    .filter(Boolean);

  return (
    <div className="kmt-overlay">
      <div className="kmt-panel w-full max-w-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800 shrink-0">
          <h2 className="kmt-title text-xl">🔄 Échanger une carte combat</h2>
          <button onClick={onClose} className="kmt-close">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0 space-y-5">
          <div className="flex items-center gap-4">
            {newCard && (
              <img
                src={`/Combat_${newCard.force}${newCard.blood}${newCard.shields}.png`}
                alt={`Force ${newCard.force}`}
                draggable={false}
                style={{ width: 110, height: 'auto', display: 'block', borderRadius: 8, border: '2px solid #b45309' }}
              />
            )}
            <p className="text-gray-400 text-sm">
              Choisissez la carte de votre deck combat à remplacer définitivement par cette carte spéciale.
              La carte remplacée est retirée de la partie.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {cards.map((card, idx) => (
              <button
                key={`${card.id}-${idx}`}
                onClick={() => setSelected(idx)}
                style={{
                  width: 96, padding: 0, borderRadius: 8, overflow: 'hidden',
                  border: `2px solid ${selected === idx ? '#facc15' : '#4b5563'}`,
                  boxShadow: selected === idx ? '0 0 8px rgba(250,204,21,0.6)' : 'none',
                  background: 'transparent', cursor: 'pointer',
                }}
              >
                <img
                  src={`/Combat_${card.force}${card.blood}${card.shields}.png`}
                  alt={`Force ${card.force}`}
                  draggable={false}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </button>
            ))}
          </div>

          <button
            onClick={() => selected !== null && onConfirm(cards[selected].id)}
            disabled={selected === null}
            className={`w-full py-3 rounded-lg font-bold ${selected !== null ? "kmt-btn-gold" : "bg-gray-800 text-gray-600 cursor-not-allowed"}`}
          >
            Remplacer
          </button>
        </div>
      </div>
    </div>
  );
}

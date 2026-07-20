import { COMBAT_CARDS } from "../../constants/cards";
import HoverZoomImage from "../ui/HoverZoomImage";

export default function CombatCardsModal({ cardIds, onClose }) {
  const cards = (cardIds || [])
    .map(id => COMBAT_CARDS.find(c => c.id === id))
    .filter(Boolean)
    .sort((a, b) => b.force - a.force);

  return (
    <div className="kmt-overlay">
      <div className="kmt-panel w-full max-w-6xl h-[92vh] flex flex-col">

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800 shrink-0">
          <h2 className="kmt-title text-xl">⚔️ Mes cartes combat</h2>
          <div className="flex items-center gap-3">
            <span className="text-gray-600 text-sm">{cards.length} carte{cards.length > 1 ? "s" : ""}</span>
            <button onClick={onClose} className="kmt-close">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
          {cards.length === 0 ? (
            <div className="kmt-section p-10 text-center">
              <p className="text-gray-500 text-sm">Aucune carte combat restante</p>
            </div>
          ) : (
            <div
              className="grid gap-4 h-full"
              style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 220px), 1fr))`, alignContent: 'center' }}
            >
              {cards.map(card => (
                <div key={card.id} className="flex items-center justify-center">
                  <HoverZoomImage
                    src={`/Combat_${card.force}${card.blood}${card.shields}.png`}
                    alt={`Force ${card.force}`}
                    style={{ width: '100%', maxHeight: '38vh' }}
                  >
                    <img
                      src={`/Combat_${card.force}${card.blood}${card.shields}.png`}
                      alt={`Force ${card.force}`}
                      draggable={false}
                      style={{ width: '100%', height: 'auto', maxHeight: '38vh', objectFit: 'contain', display: 'block', borderRadius: 10, border: '3px solid #4b5563' }}
                    />
                  </HoverZoomImage>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import IdCard from "./IdCard";

const TIMING_META = {
  combat: { label: "⚔️ Combat", color: "text-red-400" },
  day:    { label: "☀️ Jour",   color: "text-amber-400" },
  any:    { label: "🔄 Toutes phases", color: "text-purple-400" },
};

const TABS = [
  { id: "all",    label: "Toutes"     },
  { id: "combat", label: "⚔️ Combat" },
  { id: "day",    label: "☀️ Jour"   },
  { id: "any",    label: "🔄 Autres"  },
];

function EffectText({ effect }) {
  if (!effect) return null;
  const e = effect;
  switch (e.type) {
    case "force":          return "+{v} Force au combat".replace("{v}", e.value);
    case "shields":        return `+${e.value} Bouclier(s) au combat`;
    case "blood":          return `+${e.value} Goutte(s) de sang`;
    case "ank_if_win":     return `+${e.value} 🪙 si victoire`;
    case "units_if_win":   return `+${e.value} unités si victoire`;
    case "no_damage_if_win": return "0 perte si victoire";
    case "swap_combat_card": return "Remplacer votre carte combat";
    case "ank":            return `+${e.value} 🪙`;
    case "taxation":       return `+${e.value} 🪙, adversaires −1 🪙`;
    case "units":          return `+${e.value} unités en réserve`;
    case "recover_id":     return "Récupérer une carte ID défaussée";
    case "movement":       return `+${e.value} déplacement`;
    case "teleport":       return "Téléporter un groupe";
    case "wall_pass":      return "Franchir les murs d'une cité";
    case "destroy_unit":   return "Détruire 1 unité adverse";
    case "flee":           return "Fuir le combat sans perte";
    case "cancel_id":      return "Annuler une carte ID adverse";
    default:               return e.type;
  }
}

export default function IdCardModal({ cards, playableTimings, onClose, onPlay }) {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const isPlayable = (card) => !playableTimings || playableTimings.includes(card.timing);

  const filtered = filter === "all" ? cards : cards.filter(c => c.timing === filter);
  const tabCount = id => id === "all" ? cards.length : cards.filter(c => c.timing === id).length;

  function handleCardClick(card) {
    if (!isPlayable(card)) return;
    setSelected(prev => prev?.instanceId === card.instanceId ? null : card);
  }

  function handlePlay() {
    if (!selected || !onPlay || !isPlayable(selected)) return;
    onPlay(selected.instanceId);
    setSelected(null);
  }

  const timing = selected ? TIMING_META[selected.timing] : null;

  return (
    <div className="kmt-overlay">
      <div className="kmt-panel w-full max-w-3xl max-h-[88vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800 shrink-0">
          <h2 className="kmt-title text-xl">🃏 Mes cartes ID</h2>
          <div className="flex items-center gap-3">
            <span className="text-gray-600 text-sm">{cards.length} carte{cards.length > 1 ? "s" : ""}</span>
            <button onClick={onClose} className="kmt-close">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 px-6 py-3 border-b border-gray-800/50 shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setFilter(tab.id); setSelected(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === tab.id
                  ? "bg-amber-700 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-[10px] ${filter === tab.id ? "text-amber-200" : "text-gray-600"}`}>
                ({tabCount(tab.id)})
              </span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex gap-4 flex-1 overflow-hidden px-6 py-5 min-h-0">

          {/* Grille cartes */}
          <div className="flex-1 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="kmt-section p-10 text-center">
                <p className="text-gray-500 text-sm">Aucune carte dans cette catégorie</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 content-start">
                {filtered.map(card => (
                  <div
                    key={card.instanceId}
                    style={{ opacity: isPlayable(card) ? 1 : 0.35, cursor: isPlayable(card) ? "pointer" : "not-allowed" }}
                  >
                    <IdCard
                      card={card}
                      size="md"
                      selected={selected?.instanceId === card.instanceId}
                      onClick={() => handleCardClick(card)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Panneau détail */}
          <div className="w-48 shrink-0 flex flex-col gap-3">
            {selected ? (
              <>
                <IdCard card={selected} size="lg" />
                <div className="kmt-section p-3 space-y-1.5 text-xs">
                  <p className="font-bold text-gray-100 text-sm">{selected.name}</p>
                  {selected.cost > 0 && (
                    <p className="text-amber-400">🪙 Coût : {selected.cost} Or</p>
                  )}
                  {timing && <p className={timing.color}>{timing.label}</p>}
                  <p className="text-gray-300 pt-0.5">
                    <EffectText effect={selected.effect} />
                  </p>
                </div>
                {onPlay && isPlayable(selected) && (
                  <button onClick={handlePlay} className="kmt-btn-danger w-full text-center">
                    Jouer
                  </button>
                )}
                {onPlay && !isPlayable(selected) && (
                  <p className="text-gray-500 text-xs text-center italic">Non jouable dans cette phase</p>
                )}
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
                  Cliquez sur une carte pour voir le détail
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

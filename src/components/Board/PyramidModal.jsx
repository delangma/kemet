import { PYRAMID_COLORS, COLOR_STYLE } from "../../constants/pyramids";
import { useState } from "react";

export default function PyramidModal({ slot, pyramid, isOwner, usedColors = [], onSave, onClose }) {
  const firstAvailable = PYRAMID_COLORS.find(c => !usedColors.includes(c));
  const [selectedColor, setSelectedColor] = useState(pyramid?.color || firstAvailable || null);
  const [selectedLevel, setSelectedLevel] = useState(pyramid?.level ?? 0);

  // A color is "taken" if another slot in the same city already has it.
  // Exception: the current pyramid's own color is not considered taken (you can keep it).
  function isColorTaken(color) {
    if (pyramid?.color === color) return false;
    return usedColors.includes(color);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">Pyramide — {slot.id}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {!isOwner && (
          <p className="text-yellow-400 text-sm mb-4">⚔️ Pyramide adverse capturée</p>
        )}

        {/* Choix couleur */}
        <div className="mb-4">
          <p className="text-sm text-gray-400 mb-2">Couleur :</p>
          <div className="flex gap-2">
            {PYRAMID_COLORS.map(color => {
              const style = COLOR_STYLE[color];
              const taken = isColorTaken(color);
              const isSelected = selectedColor === color;
              return (
                <button
                  key={color}
                  onClick={() => !taken && setSelectedColor(color)}
                  disabled={taken}
                  title={taken ? "Déjà utilisée dans cette cité" : color}
                  className={`relative px-3 py-2 rounded-lg text-xs font-bold border-2 transition-all ${
                    taken
                      ? "opacity-40 cursor-not-allowed"
                      : "cursor-pointer hover:opacity-90"
                  }`}
                  style={{
                    backgroundColor: isSelected ? style.bg : "transparent",
                    color: isSelected ? style.text : style.bg,
                    borderColor: style.border,
                  }}
                >
                  {color}
                  {taken && (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-red-400 font-bold text-sm pointer-events-none"
                      aria-hidden="true"
                    >
                      ✕
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {usedColors.length > 0 && (
            <p className="text-gray-500 text-xs mt-2">
              Déjà placées dans cette cité : {usedColors.join(", ")}
            </p>
          )}
        </div>

        {/* Choix niveau */}
        <div className="mb-6">
          <p className="text-sm text-gray-400 mb-2">Niveau :</p>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map(level => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`w-10 h-10 rounded-lg font-bold border-2 transition-all ${
                  selectedLevel === level
                    ? "bg-yellow-600 border-yellow-400 text-white"
                    : "bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-400"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
          {selectedLevel === 4 && (
            <p className="text-yellow-400 text-xs mt-2">⭐ Niveau 4 — rapporte 1 PV temporaire</p>
          )}
        </div>

        <button
          onClick={() => selectedColor && onSave({ color: selectedColor, level: selectedLevel })}
          disabled={!selectedColor}
          className={`w-full px-6 py-3 rounded-lg font-semibold ${
            selectedColor
              ? "bg-green-600 hover:bg-green-500 text-white cursor-pointer"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          }`}
        >
          ✅ Confirmer
        </button>
      </div>
    </div>
  );
}

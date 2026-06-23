import { COLOR_MAP } from "../../constants/board";

export default function UnitModal({ zone, units, playerColor, onAdd, onRemove, onClose }) {
  const myUnits = units?.[playerColor] || 0;
  const others = Object.entries(units || {}).filter(([color]) => color !== playerColor);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-72">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">{zone.label}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {/* Mes unités */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-400 mb-3">Mes unités :</p>
          <div className="flex items-center justify-between">
            <button
              onClick={onRemove}
              disabled={myUnits <= 0}
              className={`w-10 h-10 rounded-full font-bold text-xl ${
                myUnits > 0 ? "bg-red-700 hover:bg-red-600" : "bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
            >
              -
            </button>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 border-white border-opacity-50"
              style={{
                backgroundColor: COLOR_MAP[playerColor] || "#666",
                color: playerColor === "Blanc" ? "#111" : "#fff",
              }}
            >
              {myUnits}
            </div>
            <button
              onClick={onAdd}
              className="w-10 h-10 rounded-full font-bold text-xl bg-green-700 hover:bg-green-600"
            >
              +
            </button>
          </div>
        </div>

        {/* Autres joueurs */}
        {others.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-3">Autres joueurs :</p>
            <div className="flex gap-2 flex-wrap">
              {others.map(([color, count]) => (
                <div
                  key={color}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 border-white border-opacity-30"
                  style={{
                    backgroundColor: COLOR_MAP[color] || "#666",
                    color: color === "Blanc" ? "#111" : "#fff",
                  }}
                >
                  {count}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
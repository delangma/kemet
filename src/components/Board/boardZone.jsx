import { COLOR_MAP } from "../../constants/board";

export default function BoardZone({ zone, units, currentPlayerColor, onClick, imgWidth, imgHeight }) {
  const playersWithUnits = Object.entries(units || {}).filter(([, count]) => count > 0);

  const left = (zone.x / 100) * imgWidth;
  const top = (zone.y / 100) * imgHeight;

  return (
	<div
	  onClick={onClick}
	  className="absolute cursor-pointer group pointer-events-auto"
	  style={{ left: `${left}px`, top: `${top}px`, transform: "translate(-50%, -50%)" }}
	>
      {/* Tooltip */}
      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black bg-opacity-80 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 z-20 pointer-events-none">
        {zone.label}
      </div>

      {/* Unités */}
      <div className="flex gap-0.5 flex-wrap justify-center max-w-16">
		{playersWithUnits.length === 0 ? (
		  <div className="w-7 h-7 rounded-full border-2 border-yellow-400 border-opacity-70 bg-black bg-opacity-40 hover:border-opacity-100 hover:bg-opacity-60 transition-all" />
        ) : (
          playersWithUnits.map(([color, count]) => (
            <div
              key={color}
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white border-opacity-50 shadow"
              style={{
                backgroundColor: COLOR_MAP[color] || "#666",
                color: color === "Blanc" ? "#111" : "#fff",
              }}
            >
              {count}
            </div>
          ))
        )}
      </div>
    </div>
  );
}


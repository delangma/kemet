import { COLOR_STYLE } from "../../constants/pyramids";

export default function PyramidMarker({ slot, pyramid, canInteract, ownerColor, onClick, size = 32 }) {
  const color = pyramid?.color || null;
  const level = pyramid?.level ?? 0;
  const isCaptured = pyramid?.controllerId && pyramid?.ownerId && pyramid.controllerId !== pyramid.ownerId;
  const style = COLOR_STYLE[color] || COLOR_STYLE[null];

  // drop-shadow follows the clip-path triangle shape when applied on a parent of the clipped element
  const ownerGlow = ownerColor
    ? `drop-shadow(0 0 3px ${ownerColor}) drop-shadow(0 0 5px ${ownerColor})`
    : undefined;

  return (
    <div
      onClick={onClick}
      className={`absolute group ${canInteract ? "cursor-pointer" : "pointer-events-none"}`}
      style={{ left: slot.displayLeft, top: slot.displayTop, transform: "translate(-50%, -50%)" }}
    >
      {/* Tooltip */}
      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black bg-opacity-80 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 z-20 pointer-events-none">
        {slot.id} {color ? `— ${color} Niv.${level}` : "— Vide"}
        {isCaptured && " ⚔️"}
        {!canInteract && " (non contrôlée)"}
      </div>

      {/* Wrapper : drop-shadow sur ce div suit la forme du clip-path de l'enfant */}
      <div
        className={`transition-transform ${canInteract ? "hover:scale-110" : "opacity-70"}`}
        style={{ filter: ownerGlow }}
      >
        <div
          className="flex items-center justify-center font-bold border-2"
          style={{
            width: size,
            height: size,
            fontSize: Math.max(8, Math.round(12 * (size / 32))),
            backgroundColor: style.bg,
            color: style.text,
            borderColor: isCaptured ? "#f59e0b" : style.border,
            clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
          }}
        >
          {color ? level : "?"}
        </div>
      </div>

      {/* Point jaune si capturée */}
      {isCaptured && (
        <div className="absolute -top-0.5 -right-0.5 rounded-full bg-yellow-400 border border-gray-900" style={{ width: Math.max(6, Math.round(10 * (size / 32))), height: Math.max(6, Math.round(10 * (size / 32))) }} />
      )}
    </div>
  );
}

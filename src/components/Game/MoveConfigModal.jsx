import { useState } from "react";
import { BOARD_ZONES } from "../../constants/board";
import { POWER_TILES } from "../../constants/powerTiles";
import { getCreatureSpriteStyle } from "../../constants/creatures";
import { CREATURE_POWERS } from "../../constants/creaturePowers";

export default function MoveConfigModal({ zoneId, playerColor, gameState, movePoints, onConfirm, onClose }) {
  const zone = BOARD_ZONES.find(z => z.id === zoneId);
  const boardUnits = gameState?.boardUnits || {};
  const creatureAssignments  = gameState?.creatureAssignments  || {};
  const creatureAssignments2 = gameState?.creatureAssignments2 || {};
  const maxUnits = boardUnits[zoneId]?.[playerColor] || 0;
  const creatureId  = creatureAssignments[zoneId]?.[playerColor]  || null;
  const creatureId2 = creatureAssignments2[zoneId]?.[playerColor] || null;
  const creature  = creatureId  ? POWER_TILES.find(t => t.id === creatureId)  : null;
  const creature2 = creatureId2 ? POWER_TILES.find(t => t.id === creatureId2) : null;

  const creaturePower  = creature  ? CREATURE_POWERS[creature.name]  : null;
  const creaturePower2 = creature2 ? CREATURE_POWERS[creature2.name] : null;
  const isImmovable  = !!creaturePower?.immovable;
  const isImmovable2 = !!creaturePower2?.immovable;
  // Si Cerbère est présent, doit laisser au moins 1 unité dans la zone
  const minRemaining = (creaturePower?.minUnitsInZone ?? 0);
  const maxAllowed   = Math.max(1, maxUnits - minRemaining);

  const [count, setCount] = useState(maxAllowed);
  const [creatureGoes, setCreatureGoes]   = useState(!isImmovable);
  const [creatureGoes2, setCreatureGoes2] = useState(!isImmovable2);

  const isPartialMove = count < maxUnits;
  const showCreatureChoice  = !!creature  && !isImmovable  && isPartialMove;
  const showCreatureChoice2 = !!creature2 && !isImmovable2 && isPartialMove;
  const resolvedCreatureGoes  = isImmovable  ? false : (creature  ? (isPartialMove ? creatureGoes  : true) : false);
  const resolvedCreatureGoes2 = isImmovable2 ? false : (creature2 ? (isPartialMove ? creatureGoes2 : true) : false);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-80">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">Déplacement</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <p className="text-blue-300 font-semibold mb-1">Depuis : {zone?.label}</p>
        <p className="text-gray-400 text-xs mb-4">
          {movePoints} point(s) — cliquez les zones sur le plateau après confirmation
        </p>

        <div className="mb-4">
          <label className="text-xs text-gray-400 mb-1.5 block uppercase tracking-wider">
            Unités à déplacer (max {maxUnits})
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCount(c => Math.max(1, c - 1))}
              className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 text-white font-bold"
            >−</button>
            <span className="text-white font-bold text-lg w-8 text-center">{count}</span>
            <button
              onClick={() => setCount(c => Math.min(maxAllowed, c + 1))}
              className="w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 text-white font-bold"
            >+</button>
            <button onClick={() => setCount(maxAllowed)} className="text-xs text-gray-400 hover:text-white ml-1">
              Tout
            </button>
            {minRemaining > 0 && (
              <span className="text-xs text-amber-400 ml-1">(Cerbère : 1 unité doit rester)</span>
            )}
          </div>
        </div>

        {[{ c: creature, goes: creatureGoes, setGoes: setCreatureGoes, show: showCreatureChoice },
           { c: creature2, goes: creatureGoes2, setGoes: setCreatureGoes2, show: showCreatureChoice2 }]
          .filter(({ c }) => !!c)
          .map(({ c, goes, setGoes, show }) => (
          <div key={c.id} className={`rounded-lg p-3 border text-sm mb-2 ${
            show ? "bg-amber-950/40 border-amber-700/50" : "bg-gray-800/50 border-gray-700/50"
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <div style={getCreatureSpriteStyle(c.name, 24) || {}} />
              <p className="text-amber-300 font-semibold text-xs">{c.name}</p>
            </div>
            {CREATURE_POWERS[c.name]?.immovable ? (
              <p className="text-red-400 text-xs">Immobile — reste dans la zone</p>
            ) : show ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={goes} onChange={e => setGoes(e.target.checked)} className="accent-amber-500" />
                <span className="text-gray-300 text-xs">Emmener la créature</span>
              </label>
            ) : (
              <p className="text-gray-400 text-xs">Suit toutes les troupes</p>
            )}
          </div>
        ))}

        <button
          onClick={() => onConfirm(count, resolvedCreatureGoes, creatureId, resolvedCreatureGoes2, creatureId2)}
          className="w-full px-6 py-3 rounded-lg font-semibold bg-blue-600 hover:bg-blue-500 text-white"
        >
          ✅ Lancer le déplacement
        </button>
      </div>
    </div>
  );
}

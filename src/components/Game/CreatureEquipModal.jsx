import { useState } from "react";
import { POWER_TILES, TILE_COLOR_STYLE } from "../../constants/powerTiles";
import { getCreatureSpriteStyle } from "../../constants/creatures";
import { BOARD_ZONES } from "../../constants/board";
import { CREATURE_POWERS } from "../../constants/creaturePowers";

export default function CreatureEquipModal({ playerId, playerColor, joinOrder, gameState, onConfirm, onClose, anyZone = false, specificCreatureId = null }) {
  const ownedTileIds = gameState?.players?.[playerId]?.ownedTileIds || [];
  const creatureAssignments  = gameState?.creatureAssignments  || {};
  const creatureAssignments2 = gameState?.creatureAssignments2 || {};
  const boardUnits = gameState?.boardUnits || {};

  // Creatures already on the field for this player (both slots)
  const assignedIds = new Set([
    ...Object.values(creatureAssignments).map(c => c[playerColor]).filter(Boolean),
    ...Object.values(creatureAssignments2).map(c => c[playerColor]).filter(Boolean),
  ]);

  const reserveCreatures = ownedTileIds
    .map(id => POWER_TILES.find(t => t.id === id))
    .filter(t => {
      if (!t || t.type !== "creature") return false;
      if (assignedIds.has(t.id)) return false;
      if (CREATURE_POWERS[t.name]?.reserveOnly) return false;
      if (CREATURE_POWERS[t.name]?.placeOnAnyZone && !specificCreatureId) return false;
      if (specificCreatureId && t.id !== specificCreatureId) return false;
      return true;
    });

  function isChironZone(zoneId) {
    const slot1Id = creatureAssignments[zoneId]?.[playerColor];
    const slot1Name = slot1Id ? POWER_TILES.find(t => t.id === slot1Id)?.name : null;
    return !!(slot1Name && CREATURE_POWERS[slot1Name]?.allowsSecondCreature && !creatureAssignments2[zoneId]?.[playerColor]);
  }

  const validZones = BOARD_ZONES.filter(z => {
    if ((boardUnits[z.id]?.[playerColor] || 0) === 0) return false;
    if (anyZone) {
      // Cerbère : toutes les zones avec des troupes alliées, slot1 libre
      return !creatureAssignments[z.id]?.[playerColor];
    }
    return z.id.startsWith(`J${joinOrder}C`) &&
      (!creatureAssignments[z.id]?.[playerColor] || isChironZone(z.id));
  });

  const [assignments, setAssignments] = useState({});

  function assign(creatureId, zoneId) {
    setAssignments(prev => {
      const next = { ...prev };
      if (!zoneId) {
        delete next[creatureId];
      } else {
        Object.keys(next).forEach(k => { if (next[k] === zoneId) delete next[k]; });
        next[creatureId] = zoneId;
      }
      return next;
    });
  }

  const hasAssignments = Object.keys(assignments).length > 0;

  return (
    <div className="kmt-overlay">
      <div className="kmt-panel w-96 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800">
          <h2 className="kmt-title text-lg">🐉 Équiper des Créatures</h2>
          <button onClick={onClose} className="kmt-close">✕</button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {reserveCreatures.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Aucune créature en réserve.</p>
          ) : validZones.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              Aucune troupe disponible dans votre cité sans créature assignée.
            </p>
          ) : (
            <>
              <p className="text-gray-400 text-xs">
                Assignez chaque créature à une troupe de votre cité. Gratuit, sans action.
              </p>

              {reserveCreatures.map(tile => {
                const style = TILE_COLOR_STYLE[tile.color] || TILE_COLOR_STYLE.Noir;
                const assigned = assignments[tile.id];
                return (
                  <div key={tile.id} className={`kmt-section p-3 border ${style.bg} ${style.border}`}>
                    <div className="flex items-center gap-2">
                      <div style={getCreatureSpriteStyle(tile.name, 32) || {}} />
                      <p className={`font-bold text-sm ${style.text}`}>{tile.name}</p>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">{tile.color} · Niv.{tile.level}</p>
                    <select
                      value={assigned || ""}
                      onChange={e => assign(tile.id, e.target.value || null)}
                      className="mt-2 w-full bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1.5 outline-none"
                    >
                      <option value="">— Réserve (non équipée) —</option>
                      {validZones.map(z => {
                        const takenByOther = Object.entries(assignments).some(
                          ([cId, zId]) => zId === z.id && cId !== tile.id
                        );
                        return (
                          <option key={z.id} value={z.id} disabled={takenByOther}>
                            {z.label} ({boardUnits[z.id]?.[playerColor] ?? 0} troupes)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              })}

              {hasAssignments && (
                <button onClick={() => onConfirm(assignments)} className="kmt-btn-gold w-full mt-2">
                  ✓ Confirmer l'équipement
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

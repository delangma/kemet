import { useState, useRef, useEffect } from "react";
import { db } from "../../firebase";
import { ref, update, get } from "firebase/database";
import { BOARD_ZONES, COLOR_MAP, ZONE_ADJACENCY, TELEPORT_TARGETS, isCityZone } from "../../constants/board";
import { MAX_UNITS_PER_ZONE } from "../../constants/game";
import { POWER_TILES } from "../../constants/powerTiles";
import { getCreatureSpriteStyle } from "../../constants/creatures";
import { getZoneMaxUnits, CREATURE_POWERS, hasEnemyCerbereInZone } from "../../constants/creaturePowers";
import UnitModal from "./UnitModal";
import { PYRAMID_SLOTS } from "../../constants/pyramids";
import PyramidMarker from "./PyramidMarker";

export default function Board({ session, gameState, actionMode, moveState, onBoardZoneClick, onMoveDone, onMoveCancel, onTeleportStart, onTeleportCancel, teleportCost, retreatZones = [], onRetreatZoneClick, wallPassActive = false, freeAnyTeleportActive = false, teleportFacileActive = false, victoryRecruitZones = [], onVictoryRecruitClick, tasetiRecruitZones = [], onTasetiRecruitClick, destroyUnitZones = [], onDestroyUnitClick }) {
  const { roomCode, playerId } = session;
  const [selectedZone, setSelectedZone] = useState(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);

  const playerColor = session.playerColor;
  const boardUnits = gameState?.boardUnits || {};
  const creatureAssignments  = gameState?.creatureAssignments  || {};
  const creatureAssignments2 = gameState?.creatureAssignments2 || {};

  function getCreatureNameAt(zoneId, color) {
    const tileId = creatureAssignments[zoneId]?.[color];
    if (!tileId) return null;
    return POWER_TILES.find(t => t.id === tileId)?.name || null;
  }

  function getCreatureNameAt2(zoneId, color) {
    const tileId = creatureAssignments2[zoneId]?.[color];
    if (!tileId) return null;
    return POWER_TILES.find(t => t.id === tileId)?.name || null;
  }

  const myJoinOrder = session.allPlayers.find(p => p.id === playerId)?.joinOrder;
  const isMyTurn = gameState?.currentTurnPlayerId === playerId;

  const hasRecrutementLocal = (gameState?.players?.[playerId]?.ownedTileIds || []).some(
    id => POWER_TILES.find(t => t.id === id)?.name === "Recrutement Local"
  );
  const recruitZones = (actionMode === "recruit" || actionMode === "recruit_golden") && myJoinOrder && isMyTurn
    ? BOARD_ZONES.filter(z =>
        z.id.startsWith(`J${myJoinOrder}C`) ||
        (hasRecrutementLocal && (boardUnits[z.id]?.[playerColor] || 0) > 0)
      )
    : [];

  const renforcementZones = actionMode === "renforcement" && myJoinOrder && isMyTurn
    ? BOARD_ZONES.filter(z =>
        z.id.startsWith(`J${myJoinOrder}C`) || (boardUnits[z.id]?.[playerColor] || 0) > 0
      )
    : [];

  const isMoveMode = (actionMode === "move1" || actionMode === "move2") && isMyTurn;
  const isMoveSourcePhase = isMoveMode && !moveState;
  const isMoveMovingPhase = isMoveMode && moveState?.phase === "moving";
  const teleportPending = moveState?.teleportPending || false;
  const adjToCurrentZone = ZONE_ADJACENCY[moveState?.currentZoneId] || [];
  const playerAnk = gameState?.players?.[playerId]?.ank ?? 7;
  const movingCreatureName = moveState?.creatureGoes && moveState?.creatureId
    ? POWER_TILES.find(t => t.id === moveState.creatureId)?.name : null;
  const movingCreaturePower = movingCreatureName ? CREATURE_POWERS[movingCreatureName] : null;
  const canTeleportFromHere = freeAnyTeleportActive || isCityZone(moveState?.currentZoneId)
    || ((movingCreaturePower?.teleportFromObelisk || teleportFacileActive) && TELEPORT_TARGETS.has(moveState?.currentZoneId));
  const canTeleport = isMoveMovingPhase && !teleportPending && canTeleportFromHere && (freeAnyTeleportActive || playerAnk >= (teleportCost ?? 2));

  useEffect(() => {
    if (actionMode !== "recruit") setSelectedZone(null);
  }, [actionMode]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  function getZonePosition(zone) {
    const { width: containerWidth, height: containerHeight } = containerSize;
    if (!containerWidth || !containerHeight) return { left: 0, top: 0 };

    const imgNaturalRatio = 1619 / 972;
    const containerRatio = containerWidth / containerHeight;

    let displayWidth, displayHeight, offsetX, offsetY;

    if (imgNaturalRatio < containerRatio) {
      displayHeight = containerHeight;
      displayWidth = containerHeight * imgNaturalRatio;
      offsetX = (containerWidth - displayWidth) / 2;
      offsetY = 0;
    } else {
      displayWidth = containerWidth;
      displayHeight = containerWidth / imgNaturalRatio;
      offsetX = 0;
      offsetY = (containerHeight - displayHeight) / 2;
    }

    return {
      left: offsetX + (zone.x / 100) * displayWidth,
      top: offsetY + (zone.y / 100) * displayHeight,
    };
  }

  function getPyramidData(slot) {
    const pyramids = gameState?.pyramids || {};
    return pyramids[slot.id] || null;
  }

  function getCityOwnerColor(cityId) {
    const player = session.allPlayers.find(p => `J${p.joinOrder}` === cityId);
    return player ? (COLOR_MAP[player.color] || null) : null;
  }

  async function handleAdd(zoneId) {
    if (!isMyTurn) return;
    const snapshot = await get(ref(db, `rooms/${roomCode}/gameState`));
    if (!snapshot.exists()) return;
    const state = snapshot.val();
    const currentUnits = state.boardUnits?.[zoneId]?.[playerColor] || 0;
    const reserveUnits = state.players?.[playerId]?.unitsReserve ?? 0;

    if (actionMode === "recruit" || actionMode === "recruit_golden") {
      const cityZoneIds = BOARD_ZONES.filter(z => z.id.startsWith(`J${myJoinOrder}C`)).map(z => z.id);
      const ownedIds = state.players?.[playerId]?.ownedTileIds || [];
      const hasRecrutLocal = ownedIds.some(id => POWER_TILES.find(t => t.id === id)?.name === "Recrutement Local");
      const alreadyHereUnits = state.boardUnits?.[zoneId]?.[playerColor] || 0;
      const isValidZone = cityZoneIds.includes(zoneId) || (hasRecrutLocal && alreadyHereUnits > 0);
      if (!isValidZone) return;
      const ank = state.players?.[playerId]?.ank ?? 7;
      const recruitFree = state.players?.[playerId]?.recruitFreeRemaining ?? 0;
      const unitCost = recruitFree > 0 ? 0 : 1;
      if (reserveUnits <= 0 || (unitCost > 0 && ank < 1)) return;
      const u = {
        [`rooms/${roomCode}/gameState/boardUnits/${zoneId}/${playerColor}`]: currentUnits + 1,
        [`rooms/${roomCode}/gameState/players/${playerId}/unitsReserve`]: reserveUnits - 1,
      };
      if (unitCost > 0) u[`rooms/${roomCode}/gameState/players/${playerId}/ank`] = ank - 1;
      if (recruitFree > 0) u[`rooms/${roomCode}/gameState/players/${playerId}/recruitFreeRemaining`] = recruitFree - 1;
      await update(ref(db, "/"), u);
    } else if (actionMode === "renforcement") {
      const reinforcementPending = state.players?.[playerId]?.reinforcementPending ?? 0;
      if (reinforcementPending <= 0 || reserveUnits <= 0) return;
      await update(ref(db, "/"), {
        [`rooms/${roomCode}/gameState/boardUnits/${zoneId}/${playerColor}`]: currentUnits + 1,
        [`rooms/${roomCode}/gameState/players/${playerId}/unitsReserve`]: reserveUnits - 1,
        [`rooms/${roomCode}/gameState/players/${playerId}/reinforcementPending`]: reinforcementPending - 1,
      });
    }
  }

  async function handleRemove(zoneId) {
    if (actionMode !== "recruit" || !isMyTurn) return;
    const cityZoneIds = BOARD_ZONES.filter(z => z.id.startsWith(`J${myJoinOrder}C`)).map(z => z.id);
    if (!cityZoneIds.includes(zoneId)) return;
    const snapshot = await get(ref(db, `rooms/${roomCode}/gameState`));
    if (!snapshot.exists()) return;
    const state = snapshot.val();
    const currentUnits = state.boardUnits?.[zoneId]?.[playerColor] || 0;
    if (currentUnits <= 0) return;
    const reserveUnits = state.players?.[playerId]?.unitsReserve ?? 12;
    await update(ref(db, "/"), {
      [`rooms/${roomCode}/gameState/boardUnits/${zoneId}/${playerColor}`]: currentUnits - 1,
      [`rooms/${roomCode}/gameState/players/${playerId}/unitsReserve`]: reserveUnits + 1,
    });
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <img
        src="/map_V2.png"
        alt="Plateau Kemet"
        className="h-full w-full object-contain object-center"
      />

      {/* Retreat zone selection HUD */}
      {retreatZones.length > 0 && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-gray-900/90 border border-orange-500/60 rounded-lg px-4 py-2 pointer-events-none">
          <span className="text-orange-300 text-sm font-semibold">Cliquez sur une zone orange pour placer le perdant</span>
        </div>
      )}

      {/* Move mode HUD */}
      {isMoveSourcePhase && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-gray-900/90 border border-blue-500/60 rounded-lg px-4 py-2 flex items-center gap-3 pointer-events-auto">
          <span className="text-blue-300 text-sm font-semibold">Cliquez sur une troupe à déplacer</span>
          <button onClick={onMoveCancel} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded">
            Annuler
          </button>
        </div>
      )}
      {isMoveMovingPhase && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-gray-900/90 border border-amber-500/60 rounded-lg px-4 py-2 flex items-center gap-3 pointer-events-auto">
          {teleportPending ? (
            <>
              <span className="text-purple-300 text-sm font-semibold">
                Choisissez un temple ou désert (obelisque)
              </span>
              <button onClick={onTeleportCancel} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded">
                Annuler
              </button>
            </>
          ) : (
            <>
              <span className="text-amber-300 text-sm font-semibold">
                Déplacement : {moveState.pointsRemaining} point(s) restant(s)
              </span>
              {canTeleport && (
                <button onClick={onTeleportStart} className="px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold rounded">
                  Téléportation ({teleportCost ?? 2}🪙)
                </button>
              )}
              <button onClick={onMoveDone} className="px-3 py-1 bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold rounded">
                Terminer
              </button>
            </>
          )}
        </div>
      )}

      {containerSize.width > 0 && BOARD_ZONES.map(zone => {
        const zoneUnits = boardUnits[zone.id] || {};
        const entries = Object.entries(zoneUnits).filter(([, count]) => count > 0);
        const isRecruitZone = recruitZones.some(rz => rz.id === zone.id);
        const isRenforcementZone = renforcementZones.some(rz => rz.id === zone.id);
        const isRetreatZone = retreatZones.includes(zone.id);
        const isVictoryRecruitZone = victoryRecruitZones.includes(zone.id);
        const isTasetiRecruitZone = tasetiRecruitZones.includes(zone.id);
        const isDestroyUnitZone = destroyUnitZones.includes(zone.id);

        const myUnitsHere = boardUnits[zone.id]?.[playerColor] || 0;
        const isMoveSourceZone = isMoveSourcePhase && myUnitsHere > 0;
        const isMoveCurrentZone = isMoveMovingPhase && zone.id === moveState?.currentZoneId;
        const existingPlayerUnits = boardUnits[zone.id]?.[playerColor] || 0;
        const moveCount = moveState?.count || 0;
        const movingCreatureId = moveState?.creatureGoes ? moveState?.creatureId : null;
        const movingCreatureName = movingCreatureId ? POWER_TILES.find(t => t.id === movingCreatureId)?.name : null;
        const destMax = getZoneMaxUnits(zone.id, playerColor, creatureAssignments, gameState?.players || {}, POWER_TILES, movingCreatureName, MAX_UNITS_PER_ZONE);
        const enemyCerbereHere = hasEnemyCerbereInZone(zone.id, playerColor, creatureAssignments, POWER_TILES);
        const isMoveDestZone = isMoveMovingPhase && !teleportPending && adjToCurrentZone.includes(zone.id)
          && (wallPassActive || existingPlayerUnits + moveCount <= destMax) && !enemyCerbereHere;
        const isTeleportTarget = teleportPending && TELEPORT_TARGETS.has(zone.id) && !enemyCerbereHere;

        if (entries.length === 0 && !isRecruitZone && !isRenforcementZone && !isMoveDestZone && !isTeleportTarget && !isRetreatZone && !isVictoryRecruitZone && !isTasetiRecruitZone && !isDestroyUnitZone) return null;

        const { left, top } = getZonePosition(zone);

        let ringClass = "";
        if (isDestroyUnitZone) ringClass = "outline outline-2 outline-red-400 rounded-full p-0.5 animate-pulse";
        else if (isTasetiRecruitZone) ringClass = "outline outline-2 outline-amber-400 rounded-full p-0.5 animate-pulse";
        else if (isVictoryRecruitZone) ringClass = "outline outline-2 outline-lime-400 rounded-full p-0.5 animate-pulse";
        else if (isRetreatZone) ringClass = "outline outline-2 outline-orange-400 rounded-full p-0.5 animate-pulse";
        else if (isRecruitZone) ringClass = "outline outline-2 outline-green-400 rounded-full p-0.5";
        else if (isRenforcementZone) ringClass = "outline outline-2 outline-cyan-400 rounded-full p-0.5";
        else if (isMoveCurrentZone) ringClass = "outline outline-2 outline-amber-400 rounded-full p-0.5";
        else if (isTeleportTarget) ringClass = "outline outline-2 outline-purple-400 rounded-full p-0.5 animate-pulse";
        else if (isMoveDestZone) ringClass = "outline outline-2 outline-blue-400 rounded-full p-0.5 animate-pulse";
        else if (isMoveSourceZone) ringClass = "outline outline-2 outline-cyan-400 rounded-full p-0.5";

        const isClickable = isRecruitZone || isRenforcementZone || isMoveSourceZone || isMoveDestZone || isTeleportTarget || isRetreatZone || isVictoryRecruitZone || isTasetiRecruitZone || isDestroyUnitZone;

        function handleClick() {
          if (isDestroyUnitZone && onDestroyUnitClick) onDestroyUnitClick(zone.id);
          else if (isTasetiRecruitZone && onTasetiRecruitClick) onTasetiRecruitClick(zone.id);
          else if (isVictoryRecruitZone && onVictoryRecruitClick) onVictoryRecruitClick(zone.id);
          else if (isRetreatZone) onRetreatZoneClick(zone.id);
          else if (isRecruitZone || isRenforcementZone) setSelectedZone(zone);
          else if (isClickable) onBoardZoneClick(zone.id);
        }

        return (
          <div
            key={zone.id}
            className={`absolute group ${isClickable ? "cursor-pointer" : "pointer-events-none"}`}
            style={{ left, top, transform: "translate(-50%, -50%)" }}
            onClick={isClickable ? handleClick : undefined}
          >
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 z-20 pointer-events-none">
              {zone.label}
            </div>
            {isMoveDestZone && entries.length > 0 && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-blue-300 text-xs font-bold pointer-events-none select-none animate-bounce">
                ▼
              </div>
            )}
            <div className={`flex gap-0.5 ${ringClass}`}>
              {entries.length > 0 ? (
                entries.map(([color, count]) => {
                  const creatureName  = getCreatureNameAt(zone.id, color);
                  const creatureName2 = getCreatureNameAt2(zone.id, color);
                  const creatureStyle  = creatureName  ? getCreatureSpriteStyle(creatureName,  28) : null;
                  const creatureStyle2 = creatureName2 ? getCreatureSpriteStyle(creatureName2, 28) : null;
                  return (
                    <div key={color} className="flex items-center gap-0.5">
                      <div
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shadow-lg ${
                          isMoveCurrentZone && color === playerColor ? "ring-2 ring-amber-300 ring-offset-1" : ""
                        }`}
                        style={{
                          backgroundColor: (COLOR_MAP[color] || "#666") + "cc",
                          borderColor: COLOR_MAP[color] || "#666",
                          color: color === "Blanc" ? "#111" : "#fff",
                        }}
                      >
                        {count}
                      </div>
                      {creatureStyle && (
                        <div
                          style={{
                            borderRadius: 4,
                            boxShadow: `0 0 0 2px ${COLOR_MAP[color] || "#888"}, 0 0 8px 2px ${(COLOR_MAP[color] || "#888") + "99"}`,
                          }}
                          title={creatureName}
                        >
                          <div className="drop-shadow" style={creatureStyle} />
                        </div>
                      )}
                      {creatureStyle2 && (
                        <div
                          style={{
                            borderRadius: 4,
                            boxShadow: `0 0 0 2px ${COLOR_MAP[color] || "#888"}, 0 0 8px 2px ${(COLOR_MAP[color] || "#888") + "99"}`,
                          }}
                          title={creatureName2}
                        >
                          <div className="drop-shadow" style={creatureStyle2} />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : isDestroyUnitZone ? (
                <div
                  className="w-8 h-8 rounded-full border-2 border-red-400 flex items-center justify-center text-xs font-bold shadow-lg"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#f87171" }}
                >
                  ✕
                </div>
              ) : isTasetiRecruitZone ? (
                <div
                  className="w-8 h-8 rounded-full border-2 border-amber-400 flex items-center justify-center text-xs font-bold shadow-lg"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fbbf24" }}
                >
                  +
                </div>
              ) : isVictoryRecruitZone ? (
                <div
                  className="w-8 h-8 rounded-full border-2 border-lime-400 flex items-center justify-center text-xs font-bold shadow-lg"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#a3e635" }}
                >
                  ★
                </div>
              ) : isRetreatZone ? (
                <div
                  className="w-8 h-8 rounded-full border-2 border-orange-400 flex items-center justify-center text-xs font-bold shadow-lg"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fb923c" }}
                >
                  ↩
                </div>
              ) : isRecruitZone ? (
                <div
                  className="w-8 h-8 rounded-full border-2 border-green-400 flex items-center justify-center text-xs font-bold shadow-lg"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#86efac" }}
                >
                  +
                </div>
              ) : isTeleportTarget ? (
                <div
                  className="w-8 h-8 rounded-full border-2 border-purple-400 flex items-center justify-center text-xs font-bold shadow-lg"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#c084fc" }}
                >
                  ✦
                </div>
              ) : (
                <div
                  className="w-8 h-8 rounded-full border-2 border-blue-400 flex items-center justify-center text-xs font-bold shadow-lg"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#93c5fd" }}
                >
                  ›
                </div>
              )}
            </div>
          </div>
        );
      })}

      {selectedZone && (
        <UnitModal
          zone={selectedZone}
          units={boardUnits[selectedZone.id] || {}}
          playerColor={playerColor}
          onAdd={() => handleAdd(selectedZone.id)}
          onRemove={() => handleRemove(selectedZone.id)}
          onClose={() => setSelectedZone(null)}
        />
      )}

      {/* Pyramides */}
      {containerSize.width > 0 && PYRAMID_SLOTS.map(slot => {
        const { left, top } = getZonePosition(slot);
        const slotWithPos = { ...slot, displayLeft: left, displayTop: top };
        const pyramid = getPyramidData(slot);
        const ownerColor = getCityOwnerColor(slot.cityId);
        return (
          <PyramidMarker
            key={slot.id}
            slot={slotWithPos}
            pyramid={pyramid}
            canInteract={false}
            ownerColor={ownerColor}
            onClick={undefined}
          />
        );
      })}
    </div>
  );
}

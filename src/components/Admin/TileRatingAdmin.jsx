import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { ref, onValue } from "firebase/database";
import { POWER_TILES } from "../../constants/powerTiles";
import { initTileRatingsDB, setTileRating, setComboField, resetTileRating, resetCombo, getAllCombinations, isExcludedComboPair } from "../../utils/tileRatings";

const TOTAL_COMBOS = getAllCombinations().length;

const COLORS = ["Rouge", "Bleu", "Blanc", "Noir"];
const COLOR_STYLE = {
  Rouge: { bg: "#7f1d1d", text: "#fca5a5", border: "#dc2626" },
  Bleu:  { bg: "#1e3a8a", text: "#93c5fd", border: "#3b82f6" },
  Blanc: { bg: "#374151", text: "#f3f4f6", border: "#9ca3af" },
  Noir:  { bg: "#111827", text: "#d1d5db", border: "#4b5563" },
};

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(null);
  const display = hovered ?? value;
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={() => onChange(value === n ? null : n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          style={{
            fontSize: 16, cursor: "pointer",
            color: n <= (display ?? 0) ? "#f59e0b" : "#374151",
            lineHeight: 1,
          }}
        >★</span>
      ))}
      {value !== null && value !== undefined && (
        <span
          onClick={() => onChange(null)}
          style={{ fontSize: 10, color: "#6b7280", cursor: "pointer", marginLeft: 2 }}
          title="Effacer"
        >✕</span>
      )}
    </div>
  );
}

export default function TileRatingAdmin() {
  const [tab, setTab] = useState("tiles");
  const [initStatus, setInitStatus] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [tileRatings, setTileRatings] = useState({});
  const [comboRatings, setComboRatings] = useState({});
  const [selectedTile, setSelectedTile] = useState(null);
  const [filterColor, setFilterColor] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterRated, setFilterRated] = useState("all");         // tuiles : all | rated | default
  const [filterComboRated, setFilterComboRated] = useState("all"); // combos : all | rated | default

  // Absence de flag : tuiles historiques toutes renseignées, combos toutes par défaut
  const isTileRated  = stored => stored?.rated ?? true;
  const isComboRated = combo  => combo?.rated ?? false;

  useEffect(() => {
    const unsub1 = onValue(ref(db, "tileRatings"), snap => {
      setTileRatings(snap.exists() ? snap.val() : {});
    });
    const unsub2 = onValue(ref(db, "tileCombinations"), snap => {
      setComboRatings(snap.exists() ? snap.val() : {});
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  async function handleInit() {
    setInitializing(true);
    setInitStatus(null);
    try {
      const result = await initTileRatingsDB(db);
      setInitStatus(`✓ ${result.tilesAdded} tuiles et ${result.combosAdded} combinaisons ajoutées, ${result.combosRemoved} combinaisons même nom supprimées.`);
    } catch (e) {
      setInitStatus(`Erreur : ${e.message}`);
    }
    setInitializing(false);
  }

  // Combinaisons du tile sélectionné (paires impossibles exclues : même nom, deux Points Majeurs)
  const combosForSelected = selectedTile
    ? Object.values(comboRatings).filter(c => {
        if (c.id1 !== selectedTile && c.id2 !== selectedTile) return false;
        if (isExcludedComboPair(POWER_TILES.find(t => t.id === c.id1), POWER_TILES.find(t => t.id === c.id2))) return false;
        if (filterComboRated === "rated" && !isComboRated(c)) return false;
        if (filterComboRated === "default" && isComboRated(c)) return false;
        return true;
      })
    : [];

  const filteredTiles = POWER_TILES.filter(t => {
    if (filterColor !== "all" && t.color !== filterColor) return false;
    if (filterLevel !== "all" && t.level !== parseInt(filterLevel)) return false;
    if (filterRated === "rated" && !isTileRated(tileRatings[t.id])) return false;
    if (filterRated === "default" && isTileRated(tileRatings[t.id])) return false;
    return true;
  });

  const totalRatedTiles = POWER_TILES.filter(t => isTileRated(tileRatings[t.id])).length;
  const totalRatedCombos = Object.values(comboRatings).filter(isComboRated).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0806", color: "#e5d5b0", fontFamily: "sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#1a1008", borderBottom: "1px solid #3a2a0c", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, color: "#C9973A", fontWeight: 700, letterSpacing: 2 }}>
          𓂀 KEMET — Notation des tuiles
        </h1>
        <span style={{ fontSize: 12, color: "#6B4C1E" }}>
          {totalRatedTiles}/{POWER_TILES.length} tuiles notées · {totalRatedCombos}/{TOTAL_COMBOS} combos notés
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={handleInit}
            disabled={initializing}
            style={{ padding: "6px 14px", background: "#1d4ed8", border: "1px solid #3b82f6", color: "#fff", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
          >
            {initializing ? "Initialisation…" : "Initialiser la base"}
          </button>
          {initStatus && <span style={{ fontSize: 11, color: initStatus.startsWith("✓") ? "#4ade80" : "#f87171" }}>{initStatus}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #3a2a0c", background: "#120d06" }}>
        {[
          { key: "tiles", label: `Tuiles (${POWER_TILES.length})` },
          { key: "combos", label: `Combinaisons (${TOTAL_COMBOS})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 24px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
              background: tab === t.key ? "#1a1008" : "transparent",
              color: tab === t.key ? "#C9973A" : "#6B4C1E",
              borderBottom: tab === t.key ? "2px solid #C9973A" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Tuiles ── */}
      {tab === "tiles" && (
        <div style={{ padding: 24 }}>
          {/* Filtres */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <select
              value={filterColor}
              onChange={e => setFilterColor(e.target.value)}
              style={{ padding: "5px 10px", background: "#1a1008", border: "1px solid #3a2a0c", color: "#e5d5b0", borderRadius: 4, fontSize: 13 }}
            >
              <option value="all">Toutes couleurs</option>
              {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
              style={{ padding: "5px 10px", background: "#1a1008", border: "1px solid #3a2a0c", color: "#e5d5b0", borderRadius: 4, fontSize: 13 }}
            >
              <option value="all">Tous niveaux</option>
              {[1, 2, 3, 4].map(l => <option key={l} value={l}>Niveau {l}</option>)}
            </select>
            <select
              value={filterRated}
              onChange={e => setFilterRated(e.target.value)}
              style={{ padding: "5px 10px", background: "#1a1008", border: "1px solid #3a2a0c", color: "#e5d5b0", borderRadius: 4, fontSize: 13 }}
            >
              <option value="all">Renseignées et par défaut</option>
              <option value="rated">Renseignées</option>
              <option value="default">Par défaut</option>
            </select>
          </div>

          {/* Grille par couleur */}
          {COLORS.filter(c => filterColor === "all" || c === filterColor).map(color => {
            const tiles = filteredTiles.filter(t => t.color === color);
            if (tiles.length === 0) return null;
            const cs = COLOR_STYLE[color];
            return (
              <div key={color} style={{ marginBottom: 28 }}>
                <h3 style={{ color: cs.text, borderBottom: `1px solid ${cs.border}33`, paddingBottom: 6, marginBottom: 12, fontSize: 14, fontWeight: 700 }}>
                  {color}
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
                  {[1, 2, 3, 4].filter(l => filterLevel === "all" || parseInt(filterLevel) === l).map(level => {
                    const lvlTiles = tiles.filter(t => t.level === level);
                    if (lvlTiles.length === 0) return null;
                    return lvlTiles.map(tile => {
                      const stored = tileRatings[tile.id];
                      return (
                        <div
                          key={tile.id}
                          style={{
                            background: "#120d06", border: `1px solid ${cs.border}44`,
                            borderRadius: 6, padding: "10px 12px",
                            display: "flex", flexDirection: "column", gap: 6,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: cs.text, fontWeight: 600, fontSize: 13 }}>{tile.name}</span>
                            {isTileRated(stored) && (
                              <button
                                onClick={() => resetTileRating(db, tile.id)}
                                title="Remettre au paramétrage par défaut"
                                style={{ fontSize: 10, padding: "2px 7px", borderRadius: 3, cursor: "pointer", background: "#1a1008", border: "1px solid #3a2a0c", color: "#6B4C1E" }}
                              >
                                ↺ Défaut
                              </button>
                            )}
                          </div>
                          <div style={{ color: "#6B4C1E", fontSize: 11, marginBottom: 4 }}>
                            Niv.{tile.level} · {tile.cost}🪙 · {tile.type} · {tile.id}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: "#6B4C1E", fontSize: 10, width: 70, flexShrink: 0 }}>Début</span>
                              <StarRating
                                value={stored?.ratingEarly ?? null}
                                onChange={r => setTileRating(db, tile.id, "ratingEarly", r)}
                              />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: "#6B4C1E", fontSize: 10, width: 70, flexShrink: 0 }}>Fin</span>
                              <StarRating
                                value={stored?.ratingLate ?? null}
                                onChange={r => setTileRating(db, tile.id, "ratingLate", r)}
                              />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: "#6B4C1E", fontSize: 10, width: 70, flexShrink: 0 }} title="À quel point le moment d'achat est critique pour cette tuile">Temporalité</span>
                              <StarRating
                                value={stored?.temporality ?? null}
                                onChange={r => setTileRating(db, tile.id, "temporality", r)}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab Combinaisons ── */}
      {tab === "combos" && (
        <div style={{ padding: 24 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <select
              value={filterComboRated}
              onChange={e => setFilterComboRated(e.target.value)}
              style={{ padding: "5px 10px", background: "#1a1008", border: "1px solid #3a2a0c", color: "#e5d5b0", borderRadius: 4, fontSize: 13 }}
            >
              <option value="all">Renseignées et par défaut</option>
              <option value="rated">Renseignées</option>
              <option value="default">Par défaut</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            {/* Colonne de sélection de tuile */}
            <div style={{ width: 220, flexShrink: 0 }}>
              <div style={{ color: "#6B4C1E", fontSize: 11, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                Choisir une tuile
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: "80vh", overflowY: "auto" }}>
                {POWER_TILES.map(tile => {
                  const cs = COLOR_STYLE[tile.color];
                  const isSelected = selectedTile === tile.id;
                  // Combos de la tuile (paires impossibles exclues) : renseignées vs par défaut
                  const combosOfTile = Object.values(comboRatings).filter(c => {
                    if (c.id1 !== tile.id && c.id2 !== tile.id) return false;
                    return !isExcludedComboPair(POWER_TILES.find(t => t.id === c.id1), POWER_TILES.find(t => t.id === c.id2));
                  });
                  const ratedCount = combosOfTile.filter(isComboRated).length;
                  const defaultCount = combosOfTile.length - ratedCount;
                  return (
                    <button
                      key={tile.id}
                      onClick={() => setSelectedTile(isSelected ? null : tile.id)}
                      style={{
                        textAlign: "left", padding: "6px 10px", borderRadius: 4, cursor: "pointer",
                        background: isSelected ? cs.bg : "#120d06",
                        border: `1px solid ${isSelected ? cs.border : "#2a1e08"}`,
                        color: isSelected ? cs.text : "#a88a40",
                        fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <span style={{ fontWeight: isSelected ? 700 : 400 }}>{tile.name}</span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {ratedCount > 0 && (
                          <span style={{ fontSize: 10, color: "#f59e0b" }} title="Combos renseignées">{ratedCount}</span>
                        )}
                        {defaultCount > 0 && (
                          <span style={{ fontSize: 10, color: "#6b7280" }} title="Combos par défaut">{defaultCount}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Liste des combinaisons pour la tuile sélectionnée */}
            <div style={{ flex: 1 }}>
              {!selectedTile ? (
                <div style={{ color: "#6B4C1E", padding: 24, textAlign: "center" }}>
                  ← Sélectionnez une tuile pour voir ses combinaisons
                </div>
              ) : (
                <>
                  {(() => {
                    const tile = POWER_TILES.find(t => t.id === selectedTile);
                    const cs = COLOR_STYLE[tile.color];
                    return (
                      <h3 style={{ color: cs.text, marginBottom: 16, fontSize: 15, fontWeight: 700 }}>
                        Combinaisons avec <span style={{ color: "#C9973A" }}>{tile.name}</span>
                        <span style={{ color: "#6B4C1E", fontSize: 12, marginLeft: 8, fontWeight: 400 }}>
                          ({combosForSelected.length} combos)
                        </span>
                      </h3>
                    );
                  })()}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 6 }}>
                    {COLORS.map(color => {
                      const group = combosForSelected.filter(c => {
                        const otherId = c.id1 === selectedTile ? c.id2 : c.id1;
                        return POWER_TILES.find(t => t.id === otherId)?.color === color;
                      });
                      if (group.length === 0) return null;
                      const cs = COLOR_STYLE[color];
                      return group.map(combo => {
                        const otherId = combo.id1 === selectedTile ? combo.id2 : combo.id1;
                        const other = POWER_TILES.find(t => t.id === otherId);
                        if (!other) return null;
                        const ocs = COLOR_STYLE[other.color];
                        const tile1 = POWER_TILES.find(t => t.id === combo.id1);
                        const tile2 = POWER_TILES.find(t => t.id === combo.id2);
                        const isPrio1 = combo.id1 === selectedTile ? 1 : 2;
                        const isPrio2 = combo.id1 === selectedTile ? 2 : 1;
                        return (
                          <div
                            key={combo.key || [combo.id1, combo.id2].sort().join("-")}
                            style={{
                              background: "#120d06", border: `1px solid #2a1e08`,
                              borderRadius: 6, padding: "10px 12px",
                              display: "flex", flexDirection: "column", gap: 6,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div>
                                <span style={{ color: ocs.text, fontSize: 12, fontWeight: 600 }}>{other.name}</span>
                                <div style={{ color: "#6B4C1E", fontSize: 10, marginTop: 1 }}>
                                  {other.color} · Niv.{other.level}
                                </div>
                              </div>
                              {/* Tuile prioritaire */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                                <span style={{ color: "#6B4C1E", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>Priorité d'achat</span>
                                <div style={{ display: "flex", gap: 4 }}>
                                  {[
                                    { val: isPrio1, label: POWER_TILES.find(t => t.id === selectedTile)?.name },
                                    { val: isPrio2, label: other.name },
                                  ].map(({ val, label }) => (
                                    <button
                                      key={val}
                                      onClick={() => setComboField(db, combo.id1, combo.id2, "priorityTile", combo.priorityTile === val ? null : val)}
                                      title={`Acheter ${label} en premier`}
                                      style={{
                                        fontSize: 10, padding: "2px 7px", borderRadius: 3, cursor: "pointer",
                                        fontWeight: combo.priorityTile === val ? 700 : 400,
                                        background: combo.priorityTile === val ? "#92400e" : "#1a1008",
                                        border: `1px solid ${combo.priorityTile === val ? "#f59e0b" : "#3a2a0c"}`,
                                        color: combo.priorityTile === val ? "#fde68a" : "#6B4C1E",
                                      }}
                                    >
                                      {val === isPrio1 ? "1ère" : "2ème"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: "#6B4C1E", fontSize: 10, width: 70, flexShrink: 0 }}>Note</span>
                              <StarRating
                                value={combo.rating ?? null}
                                onChange={r => setComboField(db, combo.id1, combo.id2, "rating", r)}
                              />
                            </div>
                            {isComboRated(combo) && (
                              <button
                                onClick={() => resetCombo(db, combo.id1, combo.id2)}
                                title="Remettre au paramétrage par défaut (et ses paires équivalentes)"
                                style={{ alignSelf: "flex-end", fontSize: 10, padding: "2px 7px", borderRadius: 3, cursor: "pointer", background: "#1a1008", border: "1px solid #3a2a0c", color: "#6B4C1E" }}
                              >
                                ↺ Défaut
                              </button>
                            )}
                          </div>
                        );
                      });
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

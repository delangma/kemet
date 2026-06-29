import { ACTIONS } from "../../constants/game";
import { computeTempVP } from "../../utils/vp";
import { POWER_TILES } from "../../constants/powerTiles";

const HEADER_BG = {
  Rouge: { bg: '#6b1414', border: '#dc2626', text: '#fca5a5' },
  Bleu:  { bg: '#172554', border: '#3b82f6', text: '#93c5fd' },
  Vert:  { bg: '#14532d', border: '#22c55e', text: '#86efac' },
  Blanc: { bg: '#d1d5db', border: '#9ca3af', text: '#111827' },
  Noir:  { bg: '#111827', border: '#4b5563', text: '#d1d5db' },
};

const ACTION_IMG = {
  move1:   "/Action_Deplacement.png",
  move2:   "/Action_Deplacement.png",
  recruit: "/Action_Recrutement.png",
  pyramid: "/Action_Evolution_Pyramide.png",
  prayer2: "/Action_Priere.png",
  prayer3: "/Action_Priere.png",
  buy_red:   "/Action_Achat_Rouge.png",
  buy_blue:  "/Action_Achat_Bleu.png",
  buy_white: "/Action_Achat_Blanc.png",
  buy_black: "/Action_Achat_Noir.png",
};

export default function PlayerSummary({ player, gameState, currentTurnPlayerId, isHighlighted, allPlayers, compact = false }) {
  const state       = gameState?.players?.[player.id] || {};
  const usedActions = state.usedActions || [];
  const tokens      = state.tokens ?? 5;
  const ank         = state.ank ?? 7;
  const dawnTokens  = state.dawnTokens ?? 0;
  const vpPermanent = state.vpPermanent ?? 0;
  const vpTemp      = computeTempVP(player.id, gameState, allPlayers ?? []);
  const vpTotal     = vpPermanent + vpTemp;
  const idCards     = state.idCards || [];
  const combatCards = state.availableCombatCards || [1,2,3,4,5,6,7,8];
  const isActive    = isHighlighted !== undefined ? isHighlighted : currentTurnPlayerId === player.id;
  const ownedTileIds   = state.ownedTileIds || [];
  const goldenTokenUsed = state.goldenTokenUsed ?? false;
  const hasGrayToken   = ownedTileIds.some(id => (POWER_TILES.find(t => t.id === id)?.name ?? "").toLowerCase().startsWith("jeton gris"));
  const hasGoldenToken = ownedTileIds.some(id => {
    const n = POWER_TILES.find(t => t.id === id)?.name ?? "";
    return n.toLowerCase().startsWith("jeton doré") || n === "Déplacement Passe/Muraille";
  });

  const hdr = HEADER_BG[player.color] || HEADER_BG.Noir;

  const COLOR_TO_BUY_ID = { Rouge: "buy_red", Bleu: "buy_blue", Blanc: "buy_white", Noir: "buy_black" };
  const ALL_BUY_COLORS  = ["Rouge", "Bleu", "Blanc", "Noir"];
  const allPyramids = gameState?.pyramids || {};
  const ownedPyramidColors = new Set(
    Object.values(allPyramids).filter(p => p.ownerId === player.id).map(p => p.color)
  );
  const activeBuyColors  = ALL_BUY_COLORS.filter(c => ownedPyramidColors.has(c));
  const missingBuyColors = ALL_BUY_COLORS.filter(c => !ownedPyramidColors.has(c));
  const level3Displayed = [
    ...ACTIONS.level3.filter(a => !a.id.startsWith("buy_")),
    ...activeBuyColors.map(c => ({ id: COLOR_TO_BUY_ID[c], label: `Achat ${c}`, locked: false })),
    ...(missingBuyColors.length > 0 ? [{ id: COLOR_TO_BUY_ID[missingBuyColors[0]], label: `Achat ${missingBuyColors[0]}`, locked: true }] : []),
  ];

  const LEVEL_ACTIONS = [
    { label: "NIV. 1", actions: ACTIONS.level1 },
    { label: "NIV. 2", actions: ACTIONS.level2 },
    { label: "NIV. 3", actions: level3Displayed },
  ];

  if (compact) {
    return (
      <div
        style={{
          background: 'rgba(10,8,4,0.90)',
          border: isActive ? `1px solid ${hdr.border}` : '1px solid #4a3410',
          borderRadius: 5,
          boxShadow: isActive ? `0 0 10px ${hdr.border}55` : '0 2px 8px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header coloré */}
        <div style={{ background: hdr.bg, borderBottom: `1px solid ${hdr.border}33`, padding: '3px 7px', borderRadius: '4px 4px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: hdr.text, fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }}>
            {player.name}
          </span>
          {isActive && <span style={{ color: '#fbbf24', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>⚡</span>}
        </div>

        <div style={{ padding: '3px 7px 4px', display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* Ressources */}
          <div style={{ display: 'flex', gap: 6, color: '#e5d5b0', fontSize: 11, fontWeight: 600 }}>
            <span title="Or">🪙{ank}</span>
            <span title={`${vpPermanent}p+${vpTemp}t`}>☀{vpTotal}</span>
            {dawnTokens > 0 && <span title="Jetons aube">🏆{dawnTokens}</span>}
          </div>

          {/* Jetons action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid', background: i < tokens ? '#C9973A' : '#1a1508', borderColor: i < tokens ? '#8B6014' : '#3a2a0c' }} />
            ))}
            {(hasGrayToken || hasGoldenToken) && <div style={{ width: 1, height: 8, background: '#3a2a0c', margin: '0 1px' }} />}
            {hasGrayToken && <div title="Jeton gris" style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid', background: tokens >= 6 ? '#9ca3af' : '#1a1508', borderColor: tokens >= 6 ? '#6b7280' : '#3a2a0c' }} />}
            {hasGoldenToken && <div title="Jeton doré" style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid', background: !goldenTokenUsed ? '#fbbf24' : '#1a1508', borderColor: !goldenTokenUsed ? '#b45309' : '#3a2a0c' }} />}
            <span style={{ fontSize: 8, color: '#6B4C1E', marginLeft: 1 }}>{tokens}/{hasGrayToken ? 6 : 5}</span>
          </div>

          {/* Actions par niveau */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
            {[ACTIONS.level1, ACTIONS.level2, level3Displayed].map((lvlActions, gi) => (
              <div key={gi} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '100%' }}>
                {gi > 0 && <div style={{ width: '60%', height: 1, background: 'linear-gradient(to right, transparent, #6B4C1E, transparent)' }} />}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                  {lvlActions.map(a => {
                    const used   = usedActions.includes(a.id);
                    const locked = !!a.locked;
                    const img    = ACTION_IMG[a.id];
                    return (
                      <img key={a.id} src={img} alt={a.label} title={locked ? `${a.label} (pyramide requise)` : a.label} style={{
                        width: 24, height: 24, borderRadius: 3, objectFit: 'cover', flexShrink: 0,
                        opacity: locked ? 0.35 : used ? 0.5 : 1,
                        filter: (locked || used) ? 'grayscale(1)' : 'none',
                      }} />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Cartes */}
          <div style={{ display: 'flex', gap: 8, color: '#6B4C1E', fontSize: 9 }}>
            <span>✗<strong style={{ color: '#a88a40' }}>{combatCards.length}</strong></span>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <img src="/ID_dos.png" alt="Cartes ID" style={{ width: 16, height: 22, objectFit: 'cover', borderRadius: 2 }} />
              {idCards.length > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -5, background: '#b45309', color: '#fff', fontSize: 7, fontWeight: 700, borderRadius: '50%', width: 11, height: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                  {idCards.length}
                </span>
              )}
            </span>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div
      className="shadow-2xl"
      style={{
        width: 240,
        background: 'rgba(13, 10, 6, 0.78)',
        border: isActive ? '1px solid #C9973A' : '1px solid #4a3410',
        boxShadow: isActive
          ? `0 0 0 1px #C9973A, 0 0 16px rgba(201,151,58,0.25)`
          : '0 4px 24px rgba(0,0,0,0.7)',
      }}
    >
      {/* Header coloré avec nom */}
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{ background: hdr.bg, borderBottom: `1px solid ${hdr.border}33` }}
      >
        <span style={{ color: hdr.text, fontWeight: 700, fontSize: 13, letterSpacing: '0.06em' }}>
          {player.name}
        </span>
        {isActive && (
          <span style={{ color: '#fbbf24', fontSize: 10, fontWeight: 700, animation: 'pulse 2s infinite' }}>
            ⚡ TOUR
          </span>
        )}
      </div>

      <div className="px-3 py-2 space-y-2">

        {/* Ressources */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span style={{ color: '#C9973A' }}>🪙</span>
            <span style={{ color: '#e5d5b0', fontWeight: 600 }}>{ank}</span>
            <span style={{ color: '#6B4C1E', fontSize: 10 }}>Or</span>
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: '#fbbf24' }}>☀</span>
            <span style={{ color: '#e5d5b0', fontWeight: 600 }}>{dawnTokens}</span>
          </span>
          <span className="flex items-center gap-1" title={`${vpPermanent} perm + ${vpTemp} temp`}>
            <span style={{ color: '#f97316' }}>🏆</span>
            <span style={{ color: '#e5d5b0', fontWeight: 600 }}>{vpTotal}</span>
            <span style={{ color: '#6B4C1E', fontSize: 10 }}>PV</span>
          </span>
        </div>

        {/* Jetons */}
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 rounded-full border" style={{ background: i < tokens ? '#C9973A' : '#1a1508', borderColor: i < tokens ? '#8B6014' : '#3a2a0c' }} />
          ))}
          {(hasGrayToken || hasGoldenToken) && <div style={{ width: 1, height: 12, background: '#3a2a0c', margin: '0 2px' }} />}
          {hasGrayToken && <div title="Jeton gris" className="w-3.5 h-3.5 rounded-full border" style={{ background: tokens >= 6 ? '#9ca3af' : '#1a1508', borderColor: tokens >= 6 ? '#6b7280' : '#3a2a0c' }} />}
          {hasGoldenToken && <div title="Jeton doré" className="w-3.5 h-3.5 rounded-full border" style={{ background: !goldenTokenUsed ? '#fbbf24' : '#1a1508', borderColor: !goldenTokenUsed ? '#b45309' : '#3a2a0c' }} />}
          <span style={{ color: '#6B4C1E', fontSize: 10, marginLeft: 4 }}>{tokens}/{hasGrayToken ? 6 : 5}</span>
        </div>

        {/* Groupes d'actions par niveau */}
        <div style={{ borderTop: '1px solid #2a1e08', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          {LEVEL_ACTIONS.map(({ label, actions }, gi) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%' }}>
              {gi > 0 && (
                <div style={{ width: '55%', height: 1, background: 'linear-gradient(to right, transparent, #8B6014, transparent)' }} />
              )}
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 4 }}>
                {actions.map(a => {
                  const used   = usedActions.includes(a.id);
                  const locked = !!a.locked;
                  const img    = ACTION_IMG[a.id];
                  return (
                    <img
                      key={a.id + (locked ? '_locked' : '')}
                      src={img}
                      alt={a.label}
                      title={locked ? `${a.label} (pyramide requise)` : a.label}
                      style={{
                        width: 44, height: 44, borderRadius: 6, objectFit: 'cover', flexShrink: 0,
                        opacity: locked ? 0.35 : used ? 0.5 : 1,
                        filter: (locked || used) ? 'grayscale(1)' : 'none',
                        border: '1px solid #3a2a0c',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bas : cartes */}
        <div className="flex justify-between pt-1.5" style={{ borderTop: '1px solid #2a1e08', fontSize: 10 }}>
          <span style={{ color: '#6B4C1E' }}>
            ✗ Combat : <strong style={{ color: '#a88a40' }}>{combatCards.length}</strong>
          </span>
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <img src="/ID_dos.png" alt="Cartes ID" style={{ width: 22, height: 30, objectFit: 'cover', borderRadius: 3 }} />
            {idCards.length > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -6, background: '#b45309', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                {idCards.length}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

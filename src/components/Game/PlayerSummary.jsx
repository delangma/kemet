import { ACTIONS } from "../../constants/game";
import { computeTempVP } from "../../utils/vp";

const HEADER_BG = {
  Rouge: { bg: '#6b1414', border: '#dc2626', text: '#fca5a5' },
  Bleu:  { bg: '#172554', border: '#3b82f6', text: '#93c5fd' },
  Vert:  { bg: '#14532d', border: '#22c55e', text: '#86efac' },
  Blanc: { bg: '#d1d5db', border: '#9ca3af', text: '#111827' },
  Noir:  { bg: '#111827', border: '#4b5563', text: '#d1d5db' },
};

const BUY_CIRCLES = {
  buy_red:   { bg: '#7f1d1d', border: '#dc2626', title: 'Achat Rouge' },
  buy_blue:  { bg: '#1e3a8a', border: '#3b82f6', title: 'Achat Bleu'  },
  buy_white: { bg: '#e5e7eb', border: '#9ca3af', title: 'Achat Blanc' },
  buy_black: { bg: '#111111', border: '#C9973A', title: 'Achat Noir'  },
};

export default function PlayerSummary({ player, gameState, currentTurnPlayerId, allPlayers, compact = false }) {
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
  const isActive    = currentTurnPlayerId === player.id;

  const hdr = HEADER_BG[player.color] || HEADER_BG.Noir;

  const LEVEL_ACTIONS = [
    { label: "NIV. 1", actions: ACTIONS.level1 },
    { label: "NIV. 2", actions: ACTIONS.level2 },
    { label: "NIV. 3", actions: ACTIONS.level3 },
  ];

  if (compact) {
    const BUY_DOT = { buy_red: '#ef4444', buy_blue: '#3b82f6', buy_white: '#d1d5db', buy_black: '#4b5563' };
    const allActions = [...ACTIONS.level1, ...ACTIONS.level2, ...ACTIONS.level3];
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
            <span style={{ fontSize: 8, color: '#6B4C1E', marginLeft: 1 }}>{tokens}/5</span>
          </div>

          {/* Actions par niveau */}
          {[
            { label: 'N1', actions: ACTIONS.level1 },
            { label: 'N2', actions: ACTIONS.level2 },
            { label: 'N3', actions: ACTIONS.level3 },
          ].map(({ label, actions: lvlActions }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 7, color: '#6B4C1E', minWidth: 12, fontWeight: 700 }}>{label}</span>
              {lvlActions.map(a => {
                const used = usedActions.includes(a.id);
                const buyC = BUY_DOT[a.id];
                return (
                  <div key={a.id} title={a.label} style={{
                    width: 7, height: 7, borderRadius: 2, flexShrink: 0,
                    background: buyC ? (used ? buyC : '#1a1200') : (used ? '#C9973A' : '#1a1508'),
                    border: `1px solid ${buyC ? (used ? buyC + 'aa' : '#4a3410') : (used ? '#8B6014' : '#3a2a0c')}`,
                  }} />
                );
              })}
            </div>
          ))}

          {/* Cartes */}
          <div style={{ display: 'flex', gap: 8, color: '#6B4C1E', fontSize: 9 }}>
            <span>✗<strong style={{ color: '#a88a40' }}>{combatCards.length}</strong></span>
            <span>🃏<strong style={{ color: '#a88a40' }}>{idCards.length}</strong></span>
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
          <span className="flex items-center gap-1" title={`${vpPermanent} perm + ${vpTemp} temp`}>
            <span style={{ color: '#f97316' }}>🏆</span>
            <span style={{ color: '#e5d5b0', fontWeight: 600 }}>{vpTotal}</span>
            <span style={{ color: '#6B4C1E', fontSize: 10 }}>PV</span>
          </span>
          <span className="flex items-center gap-1">
            <span style={{ color: '#fbbf24' }}>☀</span>
            <span style={{ color: '#e5d5b0', fontWeight: 600 }}>{dawnTokens}</span>
          </span>
        </div>

        {/* Jetons */}
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-3.5 h-3.5 rounded-full border"
              style={{
                background: i < tokens ? '#C9973A' : '#1a1508',
                borderColor: i < tokens ? '#8B6014' : '#3a2a0c',
              }}
            />
          ))}
          <span style={{ color: '#6B4C1E', fontSize: 10, marginLeft: 4 }}>{tokens}/5</span>
        </div>

        {/* Groupes d'actions par niveau */}
        <div style={{ borderTop: '1px solid #2a1e08', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {LEVEL_ACTIONS.map(({ label, actions }) => (
            <div key={label}>
              <div style={{ color: '#6B4C1E', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 3 }}>
                {label}
              </div>
              <div className="flex flex-wrap gap-1">
                {actions.map(a => {
                  const used = usedActions.includes(a.id);
                  const isBuy = a.id in BUY_CIRCLES;
                  if (isBuy) {
                    const c = BUY_CIRCLES[a.id];
                    return (
                      <div
                        key={a.id}
                        title={c.title}
                        className="w-4 h-4 rounded-full border-2"
                        style={{
                          background: c.bg,
                          borderColor: c.border,
                          opacity: used ? 0.2 : 0.85,
                        }}
                      />
                    );
                  }
                  return (
                    <span
                      key={a.id}
                      className="kmt-action-tile"
                      style={used ? {
                        background: '#1a1200',
                        borderColor: '#3a2800',
                        color: '#6B4C1E',
                        textDecoration: 'line-through',
                        opacity: 0.45,
                      } : {}}
                    >
                      {a.label}
                    </span>
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
          <span style={{ color: '#6B4C1E' }}>
            🃏 ID : <strong style={{ color: '#a88a40' }}>{idCards.length}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

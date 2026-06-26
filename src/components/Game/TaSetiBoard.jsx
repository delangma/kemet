import { TASETI_NODE_POSITIONS, NODE_COLORS, E_NODE_WIDTH_PCT, JU_CARD_WIDTH_PCT, JI_CARD_WIDTH_PCT, JP_CARD_WIDTH_PCT, TASETI_DAILY_BONUS_NODES } from '../../constants/taSetiPositions';
import { PU_CARDS } from '../../constants/puCards';
import { JI_CARDS } from '../../constants/jiCards';
import { JP_CARDS } from '../../constants/jpCards';

const NATURAL_WIDTHS = [550, 520, 580, 521];

const PRIEST_IMG = {
  Rouge: 'Pretre_rouge', Bleu: 'Pretre_bleu',
  Vert: 'Pretre_vert',  Blanc: 'Pretre_jaune', Noir: 'Pretre_noir',
};

function buildPriestsAtNode(priestPositions, players) {
  const map = {};
  if (!priestPositions || !players) return map;
  players.forEach(p => {
    const raw = priestPositions[p.id];
    if (!raw) return;
    const positions = Array.isArray(raw) ? raw : [raw['0'] ?? '', raw['1'] ?? '', raw['2'] ?? ''];
    positions.forEach((pos, idx) => {
      if (pos && pos !== '') {
        if (!map[pos]) map[pos] = [];
        map[pos].push({ playerId: p.id, priestIndex: idx, color: p.color });
      }
    });
  });
  return map;
}

const DAILY_BONUS_IMG_STYLE = {
  width: `calc(95vw * 6.5 / 100)`,
  height: 'auto',
  display: 'block',
  pointerEvents: 'none',
  mixBlendMode: 'multiply',
  borderRadius: 3,
};

function NodeOverlay({
  sectionKey, puAssignment, jiAssignment, jpAssignment,
  priestsAtNode, validDestinations, onDestinationClick,
  selectablePlayerId, onPriestSelect,
  dailyBonuses,
}) {
  const nodes = TASETI_NODE_POSITIONS[sectionKey];
  if (!nodes) return null;
  const validSet = new Set(validDestinations || []);
  const sectionBonusNodes = TASETI_DAILY_BONUS_NODES[sectionKey] || {};

  return (
    <>
      {Object.entries(nodes).map(([id, pos]) => {
        const dailyBonusImg = sectionBonusNodes[id];

        // ── Nœuds E_ ──────────────────────────────────────────────────────
        if (id.startsWith('E')) {
          const priestsHere = priestsAtNode?.[id] || [];
          const isValidDest = validSet.has(id);
          const hasDailyBonus = dailyBonusImg && !dailyBonuses?.[id];
          const selectablePriestsHere = selectablePlayerId
            ? priestsHere.filter(p => p.playerId === selectablePlayerId)
            : [];
          const isSelectable = selectablePriestsHere.length > 0;

          if (priestsHere.length === 0 && !isValidDest && !hasDailyBonus) return null;

          return (
            <div
              key={id}
              onClick={
                isValidDest && onDestinationClick
                  ? (e) => { e.stopPropagation(); onDestinationClick(id); }
                  : isSelectable && onPriestSelect
                    ? (e) => { e.stopPropagation(); onPriestSelect(selectablePriestsHere[0].priestIndex); }
                    : undefined
              }
              style={{
                position: 'absolute',
                left: `${pos.x}%`, top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                width: `calc(95vw * ${E_NODE_WIDTH_PCT} / 100)`,
                zIndex: 20,
                cursor: (isValidDest && onDestinationClick) || (isSelectable && onPriestSelect) ? 'pointer' : 'default',
                pointerEvents: (isValidDest && onDestinationClick) || (isSelectable && onPriestSelect) ? 'auto' : 'none',
              }}
            >
              {/* Emplacement valide vide → cercle doré */}
              {isValidDest && priestsHere.length === 0 && (
                <div style={{
                  width: '100%', aspectRatio: '1', borderRadius: '50%',
                  background: 'rgba(255,215,0,0.12)',
                  border: '2px solid gold',
                  boxShadow: '0 0 10px 2px rgba(255,215,0,0.5)',
                }} />
              )}

              {/* Halo doré sur emplacement valide occupé */}
              {isValidDest && priestsHere.length > 0 && (
                <div style={{
                  position: 'absolute', inset: '-5px', borderRadius: 6,
                  border: '2px solid gold',
                  boxShadow: '0 0 10px 2px rgba(255,215,0,0.6)',
                  pointerEvents: 'none', zIndex: 25,
                }} />
              )}

              {/* Halo violet pour prêtre sélectionnable */}
              {isSelectable && !isValidDest && (
                <div style={{
                  position: 'absolute', inset: '-5px', borderRadius: 6,
                  border: '2px solid #c084fc',
                  boxShadow: '0 0 10px 2px rgba(192,132,252,0.6)',
                  pointerEvents: 'none', zIndex: 25,
                }} />
              )}

              {priestsHere.map(({ color }, i) => (
                <img
                  key={i}
                  src={`/${PRIEST_IMG[color] || 'Pretre_noir'}.png`}
                  alt="prêtre"
                  draggable={false}
                  style={{
                    width: '100%', height: 'auto', display: 'block',
                    marginTop: i > 0 ? '-60%' : 0,
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.7))',
                    pointerEvents: 'none',
                  }}
                />
              ))}

              {hasDailyBonus && (
                <img
                  src={dailyBonusImg}
                  alt=""
                  draggable={false}
                  style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    ...DAILY_BONUS_IMG_STYLE,
                    width: '130%',
                  }}
                />
              )}
            </div>
          );
        }

        // ── Nœuds JU_ ────────────────────────────────────────────────────
        if (id.startsWith('JU')) {
          const cardId = puAssignment?.[id];
          const card = cardId ? PU_CARDS.find(c => c.id === cardId) : null;
          return (
            <div key={id} title={card?.label ?? id} style={{
              position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)',
              width: `calc(95vw * ${JU_CARD_WIDTH_PCT} / 100)`,
              borderRadius: 5, overflow: 'hidden', border: 'none',
              background: 'transparent', pointerEvents: 'none', zIndex: 10,
              boxShadow: card ? '0 2px 8px rgba(0,0,0,0.6)' : 'none',
            }}>
              {card && <img src={card.img} alt={card.label} style={{ width: '100%', height: 'auto', display: 'block' }} />}
            </div>
          );
        }

        // ── Nœuds JI_ ────────────────────────────────────────────────────
        if (id.startsWith('JI')) {
          const cardId = jiAssignment?.[id];
          const card = cardId ? JI_CARDS.find(c => c.id === cardId) : null;
          return (
            <div key={id} title={card?.label ?? id} style={{
              position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)',
              width: `calc(95vw * ${JI_CARD_WIDTH_PCT} / 100)`,
              borderRadius: 5, overflow: 'hidden', border: 'none',
              background: 'transparent', pointerEvents: 'none', zIndex: 10,
              boxShadow: card ? '0 2px 8px rgba(0,0,0,0.6)' : 'none',
            }}>
              {card && <img src={card.img} alt={card.label} style={{ width: '100%', height: 'auto', display: 'block' }} />}
            </div>
          );
        }

        // ── Nœuds JP_ ────────────────────────────────────────────────────
        if (id.startsWith('JP')) {
          const cardId = jpAssignment?.[id];
          const card = cardId ? JP_CARDS.find(c => c.id === cardId) : null;
          return (
            <div key={id} title={card?.label ?? id} style={{
              position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)',
              width: `calc(95vw * ${JP_CARD_WIDTH_PCT} / 100)`,
              borderRadius: 5, overflow: 'hidden', border: 'none',
              background: 'transparent', pointerEvents: 'none', zIndex: 10,
              boxShadow: card ? '0 2px 8px rgba(0,0,0,0.6)' : 'none',
            }}>
              {card && <img src={card.img} alt={card.label} style={{ width: '100%', height: 'auto', display: 'block' }} />}
            </div>
          );
        }

        // ── Nœuds I_ (chemins d'entrée) — uniquement si bonus quotidien disponible
        if (id.startsWith('I')) {
          if (!dailyBonusImg || dailyBonuses?.[id]) return null;
          return (
            <img
              key={id}
              src={dailyBonusImg}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: `${pos.x}%`, top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 8,
                ...DAILY_BONUS_IMG_STYLE,
              }}
            />
          );
        }

        // ── Nœuds C_ — affichés si bonus quotidien disponible
        if (id.startsWith('C')) {
          if (!dailyBonusImg || dailyBonuses?.[id]) return null;
          return (
            <img
              key={id}
              src={dailyBonusImg}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: `${pos.x}%`, top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 8,
                ...DAILY_BONUS_IMG_STYLE,
              }}
            />
          );
        }

        return null;
      })}
    </>
  );
}

export default function TaSetiBoard({
  layout,
  height = "12vh",
  zoom = false,
  puAssignment,
  jiAssignment,
  jpAssignment,
  priestPositions,
  players,
  validDestinations,
  onDestinationClick,
  selectablePlayerId,   // prêtres de ce joueur sont cliquables pour sélection
  onPriestSelect,       // (priestIndex) => void
  dailyBonuses,         // { nodeId: true } → true = bonus déjà pris aujourd'hui
}) {
  if (!layout) return null;
  const faces = Array.isArray(layout) ? layout : Object.values(layout);
  if (faces.length !== 4) return null;

  const priestsAtNode = buildPriestsAtNode(priestPositions, players);

  if (zoom) {
    return (
      <div style={{ width: "95vw", display: "flex", flexDirection: "row", alignItems: "flex-start" }}>
        {faces.map((face, i) => {
          const sectionKey = `${i + 1}${face}`;
          return (
            <div key={i} style={{ flex: NATURAL_WIDTHS[i], minWidth: 0, position: 'relative' }}>
              <img
                src={`/Ta-seti_${i + 1}_${face}.png`}
                alt={`Ta-Seti ${i + 1}${face}`}
                style={{ width: '100%', height: 'auto', display: 'block' }}
                draggable={false}
              />
              <NodeOverlay
                sectionKey={sectionKey}
                puAssignment={puAssignment}
                jiAssignment={jiAssignment}
                jpAssignment={jpAssignment}
                priestsAtNode={priestsAtNode}
                validDestinations={validDestinations}
                onDestinationClick={onDestinationClick}
                selectablePlayerId={selectablePlayerId}
                onPriestSelect={onPriestSelect}
                dailyBonuses={dailyBonuses}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-row items-center">
      {faces.map((face, i) => (
        <img
          key={i}
          src={`/Ta-seti_${i + 1}_${face}.png`}
          alt={`Ta-Seti ${i + 1}${face}`}
          style={{ height, width: "auto" }}
          draggable={false}
        />
      ))}
    </div>
  );
}

import { useState } from "react";
import { JI_CARDS } from "../../constants/jiCards";
import { PU_CARDS } from "../../constants/puCards";
import { JP_CARDS } from "../../constants/jpCards";

const ALL_TOKEN_CARDS = [...JI_CARDS, ...PU_CARDS, ...JP_CARDS];

const TOKEN_TYPE_LABEL = {
  JI: { label: 'Instantané', color: 'text-violet-400', border: 'border-violet-600' },
  JU: { label: 'Utilisable', color: 'text-cyan-400',   border: 'border-cyan-600'   },
  JP: { label: 'Pouvoir',    color: 'text-amber-400',  border: 'border-amber-600'  },
};

function TokenCard({ token }) {
  const card = ALL_TOKEN_CARDS.find(c => c.id === token.cardId);
  const type = token.nodeId.startsWith('JI') ? 'JI' : token.nodeId.startsWith('JU') ? 'JU' : 'JP';
  const style = TOKEN_TYPE_LABEL[type];
  if (!card) return null;
  return (
    <div className={`flex flex-col items-center gap-1 p-2 rounded-lg border ${style.border} bg-gray-800`}>
      <img src={card.img} alt={card.label} className="w-14 h-auto rounded" />
      <span className={`text-xs font-semibold ${style.color}`}>{style.label}</span>
      <span className="text-xs text-gray-300 text-center leading-tight">{card.label}</span>
    </div>
  );
}

export default function TaSetiTokenModal({ tokens, troopZones, onTake, onLeave }) {
  const [step, setStep] = useState('choose');

  const jpToken = tokens.find(t => t.nodeId.startsWith('JP'));
  const jiTokens = tokens.filter(t => t.nodeId.startsWith('JI'));
  const juTokens = tokens.filter(t => t.nodeId.startsWith('JU'));

  function handleConfirmTake() {
    if (jpToken && troopZones.length > 0) {
      setStep('place_priest');
    } else {
      onTake({ jpToken: jpToken || null, zoneId: null });
    }
  }

  if (step === 'place_priest') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[120]">
        <div className="bg-gray-900 border border-amber-600 rounded-xl p-6 max-w-sm w-full shadow-2xl">
          <h2 className="text-amber-400 font-bold text-lg mb-1">Jeton Pouvoir — Placer le prêtre</h2>
          <p className="text-gray-400 text-sm mb-4">
            Choisissez une troupe. Le prêtre remplace une unité et lui confère ses pouvoirs.
          </p>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {troopZones.map(z => (
              <button key={z.id}
                onClick={() => onTake({ jpToken, zoneId: z.id })}
                className="w-full px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-amber-500 rounded-lg text-left text-sm text-white transition-colors">
                <span className="font-semibold">{z.id}</span>
                <span className="text-gray-400 ml-2">— {z.units} unité{z.units !== 1 ? 's' : ''}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setStep('choose')}
            className="mt-3 w-full text-gray-500 text-xs hover:text-gray-300 transition-colors">
            ← Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[120]">
      <div className="bg-gray-900 border border-amber-600 rounded-xl p-6 max-w-sm w-full shadow-2xl">
        <h2 className="text-amber-400 font-bold text-lg mb-1">Jetons disponibles</h2>

        <p className="text-gray-400 text-sm mb-3">
          Votre prêtre arrive sur un emplacement avec des jetons. Voulez-vous les prendre ?
        </p>

        {jpToken && troopZones.length > 0 && (
          <p className="text-amber-300 text-xs mb-3 bg-amber-950/50 border border-amber-700/40 rounded px-3 py-1.5">
            ⚠ Jeton Pouvoir — votre prêtre rejoindra une troupe et remplacera 1 unité.
          </p>
        )}
        {jpToken && troopZones.length === 0 && (
          <p className="text-amber-300 text-xs mb-3 bg-amber-950/50 border border-amber-700/40 rounded px-3 py-1.5">
            ⚠ Aucune troupe en jeu — votre prêtre deviendra une unité en réserve.
          </p>
        )}
        {!jpToken && (
          <p className="text-gray-500 text-xs mb-3">
            Votre prêtre retournera dans la réserve des prêtres.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-5 justify-center">
          {tokens.map(t => <TokenCard key={t.nodeId} token={t} />)}
        </div>

        <div className="flex gap-3">
          <button onClick={handleConfirmTake}
            className="flex-1 px-4 py-2 bg-amber-700 hover:bg-amber-600 rounded-lg font-semibold text-white text-sm transition-colors">
            Prendre
          </button>
          <button onClick={onLeave}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 text-sm transition-colors">
            Laisser
          </button>
        </div>
      </div>
    </div>
  );
}

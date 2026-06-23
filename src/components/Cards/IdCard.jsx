export const CARD_BACK = "/ID_dos.png";

const CARD_IMAGE = {
  gain_ank:                  "/ID_ankX2.png",
  annulation_id:             "/ID_annulation_ID.png",
  aucun_saignement:          "/ID_anti_goutte.png",
  protection_divine:         "/ID_defense.png",
  protection_divine_majeure: "/ID_defenseX2.png",
  marche_forcee:             "/ID_deplacement.png",
  changement_strategie:      "/ID_echange_carte_combat.png",
  renfort_divin:             "/ID_force.png",
  renfort_divin_majeur:      "/ID_forceX2.png",
  la_fuite:                  "/ID_fuite.png",
  passe_muraille:            "/ID_passe_muraille.png",
  taxation_divine:           "/ID_perdez1ank.png",
  pluie_de_feu:              "/ID_pluie_de_feu.png",
  recuperation_id:           "/ID_recherche_defausse.png",
  renforts:                  "/ID_recrutement.png",
  recrutement_victoire:      "/ID_victoire_recrutement.png",
  sang_divin:                "/ID_sang.png",
  sang_divin_majeur:         "/ID_sangX2.png",
  teleportation:             "/ID_teleportation.png",
  butin_de_guerre:           "/ID_victoire_ank..png",
};

// size: "sm" | "md" | "lg"
export default function IdCard({ card, size = "md", onClick, selected, faceDown }) {
  const imageSrc = faceDown ? CARD_BACK : (CARD_IMAGE[card?.id] ?? null);

  const widthClass = size === "sm" ? "w-16" : size === "lg" ? "w-44" : "w-28";

  return (
    <div
      onClick={onClick}
      className={`
        relative ${widthClass} aspect-[2/3] rounded-lg overflow-hidden border-2 shrink-0
        transition-all duration-150 select-none bg-gray-900
        ${onClick ? "cursor-pointer" : "cursor-default"}
        ${selected
          ? "border-yellow-400 shadow-[0_0_14px_rgba(234,179,8,0.7)] scale-105 z-10"
          : onClick
            ? "border-gray-600 hover:border-gray-300 hover:scale-[1.03]"
            : "border-gray-700"}
      `}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={faceDown ? "Carte ID" : card?.name}
          className="w-full h-full object-contain"
          draggable={false}
        />
      ) : (
        /* Fallback text card for cards without a PNG */
        <div className="w-full h-full bg-gray-800 flex flex-col p-2 gap-1">
          <p className="text-white text-xs font-bold leading-tight flex-1">{card?.name}</p>
          <p className={`text-[10px] font-semibold ${
            card?.timing === "combat" ? "text-red-400"
            : card?.timing === "any" ? "text-purple-400"
            : "text-yellow-400"
          }`}>
            {card?.timing === "combat" ? "⚔️" : card?.timing === "day" ? "☀️" : "🔄"}
          </p>
          {card?.cost > 0 && (
            <p className="text-yellow-300 text-[10px]">{card.cost} 🪙</p>
          )}
        </div>
      )}
    </div>
  );
}

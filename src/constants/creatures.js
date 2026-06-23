// Images individuelles découpées et détourées depuis Creature.png (voir scripts/extract_creatures.py).
const CREATURE_FILE_SLUGS = {
  "Serpent": "Serpent",
  "Dévoreuse des Mondes": "Devoreuse-des-Mondes",
  "Bouliste": "Bouliste",
  "Éléphant": "Elephant",
  "Scorpion": "Scorpion",
  "Scarabée": "Scarabee",
  "Momie": "Momie",
  "Sphinx": "Sphinx",
  "Sphinx Volant": "Sphinx-Volant",
  "Bouquetin": "Bouquetin",
  "Minotaure": "Minotaure",
  "Cerbère": "Cerbere",
  "Chiron": "Chiron",
  "Meduse": "Meduse",
  "Kraken": "Kraken",
};

export const CREATURE_NAMES = Object.keys(CREATURE_FILE_SLUGS);

export function getCreatureImageUrl(name) {
  const slug = CREATURE_FILE_SLUGS[name];
  return slug ? `/creatures/${slug}.png` : null;
}

export function getCreatureSpriteStyle(name, size = 32) {
  const url = getCreatureImageUrl(name);
  if (!url) return null;
  return {
    width: size,
    height: size,
    backgroundImage: `url('${url}')`,
    backgroundSize: "contain",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    borderRadius: "9999px",
    flexShrink: 0,
  };
}

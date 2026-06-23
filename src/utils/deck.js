import { ID_CARDS } from "../constants/cards";
import { PU_CARDS } from "../constants/puCards";
import { JI_CARDS } from "../constants/jiCards";
import { JP_CARDS } from "../constants/jpCards";

// Construit la pioche PU (2 exemplaires de chaque, mélangés)
export function buildPuDeck() {
  const deck = [
    ...PU_CARDS.map(c => c.id),
    ...PU_CARDS.map(c => c.id),
  ];
  return shuffle(deck);
}

// Construit la pioche JP (1 exemplaire de chaque, mélangés)
export function buildJpDeck() {
  return shuffle(JP_CARDS.map(c => c.id));
}

// Construit la pioche JI (3 exemplaires de chaque, mélangés)
export function buildJiDeck() {
  const deck = [
    ...JI_CARDS.map(c => c.id),
    ...JI_CARDS.map(c => c.id),
    ...JI_CARDS.map(c => c.id),
  ];
  return shuffle(deck);
}

// Construit la pioche complète avec les quantités
export function buildIdDeck() {
  const deck = [];
  ID_CARDS.forEach(card => {
    for (let i = 0; i < card.quantity; i++) {
      deck.push({ ...card, instanceId: `${card.id}_${i}` });
    }
  });
  return shuffle(deck);
}

export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Distribue n cartes depuis la pioche
export function dealCards(deck, n) {
  const hand = deck.slice(0, n);
  const remaining = deck.slice(n);
  return { hand, remaining };
}
/**
 * Les Cryptes Oubliées — Salle funéraire de Varyn (zone de départ).
 *
 * Légende :
 *   #  mur            T  mur + torche       B  mur + bannière profanée
 *   D  grande porte scellée (2 tuiles)
 *   .  dalle          :  dalle fissurée     ,  dalle moussue   *  glyphe effacé
 *   P  pilier         K  statue d'un roi    S  sarcophage (2 tuiles)
 *   V  sarcophage de Varyn (2 tuiles)       A  autel abyssal
 *   c  bougies        b  ossements          s  point d'apparition ennemi
 *   @  réveil de Varyn
 *
 * La caméra regarde depuis le sud-est : la rangée du bas et la colonne de
 * droite sont rendues en murs « coupés » pour ne jamais masquer l'action.
 */
export const FORGOTTEN_CRYPTS_LAYOUT = [
  '##T###B###T##DD##T###B###T##',
  '#K..c...K....::....K...c..K#',
  '#.......,.........,........#',
  '#..P....P....**....P....P..#',
  '#.....c.....cVVc.....c.....#',
  '#..........b......b........#',
  '#..P....P..........P....P..#',
  '#..........,..@............#',
  '#.SS..s.......:......s..SS.#',
  '#.A.......................b#',
  '#..P....P....,.....P....P..#',
  '#.SS......s.......s.....SS.#',
  '#......b......*.......,....#',
  '#...c.......s.......c......#',
  '############################',
];

export interface LoreEntry {
  title: string;
  text: string;
}

/** Textes d'ambiance des objets examinables (touche Interagir). */
export const CRYPT_LORE: Record<string, LoreEntry> = {
  tomb: {
    title: 'Sarcophage de Varyn',
    text:
      "Le couvercle a éclaté de l'intérieur. Sur la pierre, une inscription grattée à la hâte : « Ici repose le Monstre. Que nul ne prononce son nom. » Mille ans… et pourtant ton nom te revient comme une lame que l'on dégaine.",
  },
  statue: {
    title: "Statue d'un roi oublié",
    text:
      "Un des sept « héros » qui t'ont enchaîné. Le sculpteur lui a donné un visage noble — mais son épée est pointée vers ta tombe, et son socle porte une seconde inscription, plus ancienne, effacée au burin.",
  },
  altar: {
    title: 'Autel abyssal',
    text: "Le cristal reconnaît ton sang. L'énergie de l'Abîme afflue dans tes veines — ta mana est restaurée.",
  },
  door: {
    title: 'La Grande Porte scellée',
    text:
      "Sept chaînes de lumière morte verrouillent la porte. Le sceau se fissure à ton approche, mais tient encore. Il te faudra davantage de puissance… (Exploration des salles suivantes : Étape 4 du développement.)",
  },
  banner: {
    title: 'Bannière profanée',
    text: "Ton propre étendard : la couronne brisée sur l'œil de l'Abîme. Quelqu'un l'a lacéré, mais n'a pas osé le décrocher.",
  },
};

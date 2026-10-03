# Assets

Les visuels sont **générés procéduralement** en pixel art, sauf Varyn, construit
à partir des packs « Knight » fournis (exports PixelOver, voir plus bas) :

| Fichier | Contenu |
| --- | --- |
| `pixel/PixelCanvas.ts` | Toile pixel art : primitives, contour automatique, conversion en texture « nearest » |
| `palette.ts` | Palette maîtresse (armure, cape, énergie abyssale, os, pierre, feu…) |
| `sprites/chibi/chibiKit.ts` | Outils chibi : frames 64×64, directions, volumes ombrés, lame d'épée, traînées de taille, rotation, poses clés (`sampleKeys`), traînées automatiques (`addTrails`), rémanences, éclats, impact au sol |
| `character/knight/` | **Varyn** : atlas `knight_<n>.png` (+ `_e` émission) et `knight.json`, générés par `tools/build_knight.py` |
| `sprites/chibi/chibiRig.ts` | Rig 2D : cinématique inverse à deux os (`ik2`), raccourci de face (`foreshorten`), segments et rotules ombrés, cycle de marche (`gait`) |
| `sprites/chibi/skeletonChibi.ts` | Squelette chibi, 4 directions — idle, walk, windup, attack, recover, block, hurt, death, rise |
| `sprites/propSprites.ts` | Statues des rois, flammes, bougies, ossements, bannières, cristal, orbe de sang |
| `textures/cryptTextures.ts` | Dalles, briques, piliers, sarcophages, porte scellée (couleur + émission) |

Visualiser les planches : `npm run dev` puis ouvrir `/?debug=sprites`
(une seule planche agrandie : `/?debug=sprites&who=varyn&zoom=6`, un clip : `&clip=attack3`).

Les directions sont des variantes de clip : `AnimationPlayer.variant` choisit
`nom@down|up|side` (repli sur `nom` seul), et `SpriteActor.setFacing` sélectionne
la direction selon le déplacement à l'écran (miroir pour la gauche).

## Remplacer par des sprites dessinés à la main

`SpriteActor` ne dépend que de l'interface `SpriteSheet`
(`entities/animation/SpriteSheet.ts`) : une texture couleur, une texture
d'émission, la taille des frames, le pivot et la table des clips. Charger un PNG
et construire un `SpriteSheet` équivalent suffit — le reste du jeu est inchangé.

## Varyn : packs « Knight »

Sources : trois archives fournies (`KnightBasic`, `KnightAdvCombat`,
`KnightExMovement`), exports PixelOver en frames 256×256 et 8 directions. Les
archives ne contenaient pas de licence : **vérifier les droits d'utilisation**
avant toute diffusion du jeu. Les sources brutes ne sont pas versionnées.

`tools/build_knight.py <dossier extrait>` :
- retient 19 animations (combo, bond, tour complet, coup de pied, uppercut, sort,
  garde, glissade, roulade, impact, mort, toquer, victoire…) ;
- mesure sur chaque frame l'allonge et la hauteur du poing / pied et en déduit
  les fenêtres actives (`moves` dans `knight.json`) ;
- garde 5 directions (e, ne, n, se, s) ; o, no et so sont les miroirs ;
- recolore la palette (30 couleurs) : plaques en noir violacé, sous-tenue
  pourpre, éclats violets, visière orange → yeux rouges émissifs ;
- aligne l'appui au sol : par direction (l'origine du modèle n'est pas sous les
  pieds dans toutes les vues), puis par animation (un clip qui reste au-dessus
  du sol est redescendu, jamais remonté) ;
- recadre autour du pivot (pieds) et range les frames en pages ≤ 4096 px.

En jeu, `AtlasSheet.loadAtlasSheet` charge les pages et `SpriteActor` choisit
la direction parmi 8 secteurs (avec hystérésis) et change de page de texture
selon le clip.

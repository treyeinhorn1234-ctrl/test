# Assets

Tous les visuels du prototype sont **générés procéduralement** en pixel art
(aucun fichier tiers, aucune question de droits) :

| Fichier | Contenu |
| --- | --- |
| `pixel/PixelCanvas.ts` | Toile pixel art : primitives, contour automatique, conversion en texture « nearest » |
| `palette.ts` | Palette maîtresse (armure, cape, énergie abyssale, os, pierre, feu…) |
| `sprites/varynSprite.ts` | Varyn 64×64 — 13 animations pilotées par des poses (idle, walk, run, 3 attaques de combo, heavy, dodge, hurt, death, cast, interact, victory) |
| `sprites/skeletonSprite.ts` | Squelette gardien 48×48 — idle, walk, windup, attack, recover, block, hurt, death, rise |
| `sprites/propSprites.ts` | Statues des rois, flammes, bougies, ossements, bannières, cristal, orbe de sang |
| `textures/cryptTextures.ts` | Dalles, briques, piliers, sarcophages, porte scellée (couleur + émission) |

Visualiser les planches : `npm run dev` puis ouvrir `/?debug=sprites`.

## Remplacer par des sprites dessinés à la main

`SpriteActor` ne dépend que de l'interface `SpriteSheet`
(`entities/animation/SpriteSheet.ts`) : une texture couleur, une texture
d'émission, la taille des frames, le pivot et la table des clips. Charger un PNG
et construire un `SpriteSheet` équivalent suffit — le reste du jeu est inchangé.

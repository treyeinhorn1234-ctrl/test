# Assets

Tous les visuels du prototype sont **générés procéduralement** en pixel art
(aucun fichier tiers, aucune question de droits) :

| Fichier | Contenu |
| --- | --- |
| `pixel/PixelCanvas.ts` | Toile pixel art : primitives, contour automatique, conversion en texture « nearest » |
| `palette.ts` | Palette maîtresse (armure, cape, énergie abyssale, os, pierre, feu…) |
| `sprites/frontRig.ts` | Outils : plaques d'armure ombrées et gravées, volutes, gemmes, flammes animées, traînées, rotation, poses clés |
| `images/varyn.png` | Sprite dessiné de Varyn (106×121, grille native récupérée depuis la référence ×6) |
| `sprites/boneRig.ts` | Rig squelettique 2D générique : segmentation par os, sous-couche reconstituée, transformations hiérarchiques, rendu par transformation inverse |
| `sprites/varynSprite.ts` | Squelette de Varyn (17 os) et ses poses articulaires — idle, walk, run, 3 attaques, heavy, dodge, roll, hurt, death, cast, interact, victory (`?debug=sprites&rig=1` montre les os) |
| `sprites/skeletonSprite.ts` | Squelette gardien 192×176 (rig ×2), face + dos — idle, walk, windup, attack, recover, block, hurt, death, rise |
| `sprites/propSprites.ts` | Statues des rois, flammes, bougies, ossements, bannières, cristal, orbe de sang |
| `textures/cryptTextures.ts` | Dalles, briques, piliers, sarcophages, porte scellée (couleur + émission) |

Visualiser les planches : `npm run dev` puis ouvrir `/?debug=sprites`
(un clip agrandi : `/?debug=sprites&who=varyn&clip=heavy&zoom=6`).

## Remplacer par des sprites dessinés à la main

`SpriteActor` ne dépend que de l'interface `SpriteSheet`
(`entities/animation/SpriteSheet.ts`) : une texture couleur, une texture
d'émission, la taille des frames, le pivot et la table des clips. Charger un PNG
et construire un `SpriteSheet` équivalent suffit — le reste du jeu est inchangé.

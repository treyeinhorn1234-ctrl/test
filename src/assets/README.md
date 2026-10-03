# Assets

Tous les visuels du prototype sont **générés procéduralement** en pixel art
(aucun fichier tiers, aucune question de droits) :

| Fichier | Contenu |
| --- | --- |
| `pixel/PixelCanvas.ts` | Toile pixel art : primitives, contour automatique, conversion en texture « nearest » |
| `palette.ts` | Palette maîtresse (armure, cape, énergie abyssale, os, pierre, feu…) |
| `sprites/frontRig.ts` | Outils : plaques d'armure ombrées et gravées, volutes, gemmes, flammes animées, traînées, rotation, poses clés |
| `character/varyn/` | Sprite source de Varyn (106×121) découpé en calques : `body/`, `head/`, `arms/`, `legs/`, `cape/`, `weapon/` + `rig.json` (pivots, hiérarchie, ordre des calques). Régénérer : `python3 tools/build_varyn_parts.py` |
| `character/varynCharacter.ts` | Rig, poses articulaires, 8 directions, rendu en direct avec cache |
| `sprites/boneRig.ts` | Outils de rig 2D : transformations affines, segmentation, sous-couche |
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

# Assets

Tous les visuels du prototype sont **générés procéduralement** en pixel art
(aucun fichier tiers, aucune question de droits) :

| Fichier | Contenu |
| --- | --- |
| `pixel/PixelCanvas.ts` | Toile pixel art : primitives, contour automatique, conversion en texture « nearest » |
| `palette.ts` | Palette maîtresse (armure, cape, énergie abyssale, os, pierre, feu…) |
| `sprites/chibi/chibiKit.ts` | Outils chibi : frames 64×64, directions, volumes ombrés, lame d'épée, traînées de taille, rotation, poses clés (`sampleKeys`), traînées automatiques (`addTrails`), rémanences, éclats, impact au sol |
| `sprites/chibi/chibiRig.ts` | Rig 2D : cinématique inverse à deux os (`ik2`), raccourci de face (`foreshorten`), segments et rotules ombrés, cycle de marche (`gait`) |
| `sprites/chibi/varynChibi.ts` | Varyn chibi, 4 directions (`clip@down`, `clip@up`, `clip@side`) — idle, walk, run, attack1-3, heavy, cast, dodge, roll, hurt, death, interact, victory |
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

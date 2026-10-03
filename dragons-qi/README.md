# DRAGON'S QI

Platformer / side-scroller 2D en pixel art, inspiré de la Chine mythologique
(wuxia, dragons, temples, montagnes sacrées). Rendu **Three.js (WebGL)** en
320×180 agrandi sans interpolation.

> Le royaume est plongé dans le chaos après la chute d'un ancien dragon céleste.
> Le héros doit traverser les terres sacrées pour récupérer quatre fragments de Qi
> et empêcher le Roi Dragon Déchu d'ouvrir la Porte des Esprits.

## Lancer le jeu

Ouvrez `index.html` dans un navigateur (double-clic, aucun serveur nécessaire).
Three.js est chargé depuis un CDN (jsDelivr, puis unpkg en secours) : une
connexion internet est nécessaire au premier lancement.

Fichiers :

| Fichier | Rôle |
| --- | --- |
| `index.html` | page minimale (canvas créé par le script) |
| `index.js` | **tout le jeu** : moteur, rendu, IA, niveaux, menus, audio |
| `sprites.js` | planches du héros encodées en data-URI (généré) |
| `assets/samurai/` | planches d'origine « FREE Samurai 2D Pixel Art v1.2 » + licence |
| `tools/embed_sprites.py` | régénère `sprites.js` à partir des PNG |

## Commandes

| Action | Touche |
| --- | --- |
| Déplacement | ← → ou A / D (Q / D en AZERTY) |
| Saut, double saut, saut mural | Espace |
| Descendre d'un pont | ↓ + Espace |
| Attaque (combo 3 coups) | J |
| Vague de Qi | K |
| Dash (invincible) | Shift |
| Lire / parler | E ou ↑ |
| Pause | Échap ou P |
| Couper le son | M |

## Contenu

- **4 niveaux** : Forêt de bambous, Temple oublié, Montagne céleste, Royaume du dragon,
  chacun avec ses ennemis, ses pièges, ses secrets, un PNJ et un boss.
- **Boss** (système générique `IDLE → CHASE → ATTACK / SPECIAL_ATTACK → DAMAGED →
  PHASE_2 → DEAD`) : le Général Corrompu, le Gardien de Jade, le Seigneur des Vents
  et le Roi Dragon Déchu (corps segmenté, éclairs, souffle, pluie de météores,
  invocations, phase 2 violette, mort en explosions successives).
- **Ennemis** : `Enemy` → `BasicDemon`, `Warrior` (soldats, fantômes qui se
  téléportent, statues dormantes, moines et sorciers à distance, gardes célestes),
  `FlyingSpirit` (plongeon ou tir).
- **Plateformes** : sol, ponts, plateformes suspendues, mobiles (horizontales et
  verticales), qui s'effondrent, rebondissantes (tambours), murs à lianes, murs
  fissurés cachant des salles secrètes ; pics, marais, lave, eau maudite, néant.
- **Objets** : pièces de jade, orbes de Qi, pêches d'immortalité, fleurs spirituelles
  (rares), reliques (points d'amélioration), vases destructibles, cloches de bronze.
- **Progression** : points de contrôle, réapparition, score et combo, écran de fin de
  niveau, autel d'amélioration (vie, force, esprit, flux, vent), meilleur score sauvegardé.
- **Direction artistique** : lavis à l'encre (shan shui) décliné par niveau — montagnes
  peintes au pinceau avec dégradé tramé vers la brume, ciel en papier de riz, nuages
  découpés, terrain de pierres moussues (ou briques laquées, roche enneigée, dalles d'or),
  pins tordus, bosquets de bambous, pavillons et sanctuaires aux toits de tuiles,
  ponts de pierre en arche, escaliers, cascades.
- **Animations et effets** : végétation et lanternes qui ondulent au vent (décalage par
  rangée de pixels dans un shader, rafales), nuages et vols d'oiseaux qui dérivent,
  rayons de lumière, deux bancs de brume, eau à reflets animés, écume et embruns au
  pied des cascades, pétales qui virevoltent, météo par niveau.
- **Post-traitement WebGL** : ondes de choc (vague de Qi, impacts, boss), aberration
  chromatique quand on est touché, bloom, étalonnage par niveau, vignette, grain,
  désaturation à la mort ; plus halos additifs, particules, traînée du dash, arrêt sur
  image et tremblement de caméra.
- **Audio** : effets et musique pentatonique générés par la Web Audio API.

## Crédits

Sprite du héros : « FREE Samurai 2D Pixel Art v1.2 » (voir `assets/samurai/License.txt`).
Tout le reste (décors, ennemis, boss, interface, sons, musique) est généré par le code.

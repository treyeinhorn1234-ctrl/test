# ASHEN CROWN

Action-RPG dark fantasy en **2.5D pixel art**, jouable dans le navigateur
(Three.js · TypeScript · Vite · GLSL · Web Audio).

> Il y a mille ans, Varyn, dernier Seigneur des Abysses, fut vaincu par sept
> héros et scellé sous les ruines de son royaume. Le sceau se brise.
> **Vous êtes Varyn.**

## Lancer le jeu

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # vérification TypeScript + build de production (dist/)
npm run preview    # sert le build de production
```

## Commandes

| Action | Touche par défaut |
| --- | --- |
| Déplacement | ZQSD (AZERTY) / WASD (QWERTY) — touches physiques |
| Courir | Maj (consomme l'endurance) |
| Attaque légère (combo 3 coups) | Clic gauche |
| Attaque lourde (brise la garde, onde de choc) | Clic droit |
| Roulade (invulnérabilité) | Espace |
| Pas de l'ombre (esquive rapide) | Maj + Espace en courant |
| Griffe abyssale (sort, 18 mana) | Q (QWERTY) / A (AZERTY) |
| Interagir / examiner | F |
| Zoom | Molette |
| Pause | Échap |

Toutes les touches sont reconfigurables (Paramètres → Commandes) et sauvegardées.

## État du projet — Étape 1 : prototype jouable ✅

**Rendu pixel art**
- Rendu dans une cible basse résolution puis agrandissement au plus proche voisin
  (aucun flou) ; marge d'un texel + décalage sous-pixel et alignement de la
  caméra sur la grille de texels → défilement fluide sans scintillement.
- Post-traitement GLSL : halo lumineux, tonemapping, étalonnage dark fantasy,
  vignette, flash de dégâts, tramage Bayer aligné sur les pixels du jeu.
- Réglages : qualité (basse/moyenne/élevée), taille des pixels (= résolution
  interne), niveau de post-traitement, brouillard, luminosité, saturation, IPS.
- Caméra isométrique en perspective légère : suivi lissé, anticipation vers la
  visée, zoom, tremblement à l'impact, cadrage élargi quand le combat s'intensifie.
- Sprites en panneaux verticaux éclairés (torches, magie) avec carte d'émission
  (yeux, runes), flash d'impact, dissolution pixel par pixel à la mort.
- Murs « coupés » côté caméra et piliers/statues tramés quand ils masquent Varyn.

**Les Cryptes Oubliées — Salle funéraire** : sol et murs instanciés, piliers,
statues des rois, sarcophages, tombeau brisé de Varyn, autel abyssal, grande porte
scellée, bannières profanées, torches vacillantes (lumières dynamiques), brume
rampante, poussière, braises, ombres pixelisées de la lune, objets examinables.

**Personnages** : Varyn et les squelettes sont dessinés en vue de face 3/4 (et de dos)
dans un style pixel art détaillé : plaques d'armure biseautées et gravées, épaulières
à pointes, couronne de cornes, flammes abyssales animées (bleues spectrales pour les
squelettes). Animations à poses clés interpolées (8 à 10 images), roulade.

**Combat** : PV / mana / endurance, dégâts physiques et magiques, résistances,
critiques, hitboxes en arc vs hurtboxes circulaires, recul, étourdissement,
gel d'impact (hitstop), mémoire tampon des actions, annulation de la récupération,
assistance de visée, i-frames d'esquive, super-armure de l'attaque lourde,
images rémanentes, étincelles, éclats d'os, ondes de choc, nombres de dégâts,
arcs de taille au sol, éclats d'impact, fissures lumineuses, braises sur le tranchant,
zoom d'impact, zones d'attaque ennemies télégraphiées, âmes absorbées (+mana).

**IA des squelettes** : surgissent du sol, poursuivent, contournent, télégraphient
(yeux qui brillent), frappent, reculent, lèvent le bouclier (parade de face — l'attaque
lourde et la Griffe brisent la garde) ; jetons limitant les attaquants simultanés.
Vagues croissantes, orbes de sang (soin), XP et montée de niveau.

**Interface** : HUD pixel art (portrait, PV/mana/endurance/XP, niveau, capacités avec
recharge, objectif), barres de vie ennemies, bannières, menus titre / pause /
paramètres / mort. Cadres et icônes générés procéduralement.

**Audio** : bus Maître / Musique / Effets / Ambiance, réverbération de crypte,
spatialisation simple, musique exploration ↔ combat, ambiance (souffle, gouttes).
Tous les sons sont des **placeholders procéduraux** remplaçables (voir
`src/audio/README.md`).

## Architecture

```
src/
  core/         Game (boucle, états, routage d'événements), EventBus, Settings, GameContext
  engine/       Input (actions reconfigurables), StateMachine générique
  rendering/    PixelRenderer, IsoCamera, SpriteMaterial, ParticleSystem (pool), GroundMist
  shaders/      post-traitement GLSL
  entities/     Entity, SpriteActor, animation/ (SpriteSheet, AnimationPlayer)
  player/       Player (machine à états), PlayerAttacks (données)
  enemies/      Enemy (base), Skeleton (IA)
  combat/       Stats, Damage, CombatSystem (hitboxes, séparation), VFX (pool)
  world/        Level (construction depuis carte ASCII), CollisionWorld, Pickups, EncounterDirector
  maps/         forgottenCrypts (carte + textes d'ambiance)
  progression/  Experience
  ui/           HUD, Menus, SettingsMenu, pixelArt, styles/
  audio/        AudioManager, sfx/, music/
  assets/       palette, pixel/, sprites/, textures/ (tout procédural)
  quests/ dialogue/ inventory/ factions/   → modules des étapes suivantes (README)
  utils/        math
```

Principes : systèmes découplés par événements typés, entités pilotées par des
machines à états, données d'attaques séparées de la logique, objets en pool
(particules, effets), instanciation des éléments répétés.

## Feuille de route

| Étape | Contenu | État |
| --- | --- | --- |
| 1 | Prototype jouable | ✅ |
| 2 | Direction artistique des Cryptes (éclairage, shaders, particules, animations) | à venir |
| 3 | Combat complet : sorts (Chaînes, Frappe d'Eclipse, Téléportation, Dévoration, Tempête du Néant), nouveaux ennemis | à venir |
| 4 | Exploration : salles interconnectées, passages secrets, trésors, carte | à venir |
| 5 | RPG : inventaire, équipement, raretés, arbre de compétences, quêtes, sauvegarde de partie | à venir |
| 6 | Univers : PNJ, dialogues, factions, conquête | à venir |
| 7 | Boss (Gardien des Cryptes…), cinématiques, fins alternatives | à venir |
| 8 | Finition : optimisation, sons définitifs, polish | à venir |

Les fonctionnalités à venir sont signalées en jeu (E, R, I, J, M affichent un
message explicite ; les emplacements de capacités verrouillés indiquent l'étape).

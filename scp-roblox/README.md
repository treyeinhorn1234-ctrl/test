# SCP – Containment Breach → Roblox

Portage en cours de [SCP – Containment Breach](https://github.com/Regalis11/scpcb)
(Regalis, Blitz3D) vers Roblox Studio, en Luau.

Le jeu d'origine, code et contenus compris, est sous licence
**Creative Commons Attribution-ShareAlike 3.0**. Ce portage l'est aussi : voir
[LICENSE.md](LICENSE.md) et [CREDITS.md](CREDITS.md).

## Avancement

| Étape | État |
| --- | --- |
| 1. Conversion des salles et des modèles (`.rmesh`, `.b3d`, `.x` → `.obj`) | ✅ |
| 2. Génération de la carte (zones, placement aléatoire des salles) | à faire |
| 3. Joueur : déplacement, sprint, endurance, clignement, inventaire | à faire |
| 4. SCP-173 | à faire |
| 5. Portes, cartes d'accès, autres SCP, événements, fins | à faire |

## Ce que fait l'étape 1

`tools/convert_scpcb.py` lit directement les fichiers du jeu, sans dépendance
(Python 3.10 ou plus, bibliothèque standard uniquement) :

- **96 salles** (`GFX/map/*.rmesh`, listées dans `Data/rooms.ini`) → un `.obj`
  par salle, découpé en une MeshPart par texture, avec ses textures ;
- **17 props** posés dans les salles (bureaux, moniteurs, chaises…) ;
- **148 modèles** (`.b3d` et `.x` : portes, SCP, objets) ;
- les **données de chaque salle** en Luau (`src/shared/Generated/RoomTemplates.luau`) :
  forme, zone, fréquence, lumières, spots, props (position, rotation, échelle),
  points de passage, sons d'ambiance, écrans, zones de déclenchement ;
- les **collisions de chaque salle** (`src/server/Generated/RoomColliders/`), en
  boîtes invisibles : un maillage creux comme une pièce entière collisionne mal
  dans Roblox, alors on reconstruit les murs, sols et obstacles avec des Parts,
  en gardant les ouvertures des portes.

Conversions de repère : Blitz3D est en main gauche, Roblox en main droite (Z
inversé, ordre des triangles inversé). Échelle : 1 stud = 40 unités Blitz3D, soit
une salle de 51,2 studs et une porte de 7,8 studs.

## Installation

### 1. Installer le code dans Studio (un seul script)

1. Ouvre une place vide dans Roblox Studio.
2. *Voir* → *Sortie* (pour lire les messages), puis *Voir* → *Barre de commande*.
3. Copie tout le contenu de [`tools/studio/Install.luau`](tools/studio/Install.luau)
   (bouton *Copy raw file* sur GitHub), colle-le dans la barre de commande et clique
   sur **▶ Exécuter**. Dans la nouvelle barre de commande, Entrée ajoute seulement
   une ligne, elle ne lance pas le code.

Le script active les requêtes HTTP de la place, télécharge le code depuis GitHub
et l'installe dans `ReplicatedStorage.Shared`, `ServerScriptService.Server` et
`ServerStorage.SCPTools`. Il règle aussi l'éclairage sur `Future`, active la galerie
de test et prépare les modèles déjà importés. Relance-le quand le code change sur
GitHub : il remplace seulement ce qu'il a installé lui-même.

Si tu préfères [Rojo](https://rojo.space/) : `rojo serve` dans `scp-roblox/`
fait la même installation du code, synchronisée en direct.

### 2. Récupérer les modèles convertis

**Sans rien installer** : onglet *Actions* du dépôt GitHub → *SCP Roblox -
conversion des modèles* → dernière exécution → télécharger l'artefact
`scp-roblox-modeles` et le décompresser.

**Ou sur ton PC** (Python 3.10+) :

```bash
git clone --depth 1 https://github.com/Regalis11/scpcb.git
cd scp-roblox
python tools/convert_scpcb.py --game ../scpcb --out build
```

Résultat dans `build/` : `rooms/<salle>/<salle>.obj`, `props/<prop>/<prop>.obj`,
`models/…`, et `report.json` (ce qui a été converti ou ignoré).

### 3. Importer les salles

Roblox ne permet pas à un script d'importer des fichiers 3D : cette étape se fait
à la main avec l'importateur de Studio.

1. *Accueil* → *Importer 3D*, puis choisis un `.obj` de `build/rooms/<salle>/`.
   Laisse le dossier `textures/` à côté du `.obj` pour que les textures suivent.
   Commence par quelques salles, par exemple `lockroom`, `room2offices`, `room2`.
2. Importe aussi les props de `build/props/` (17 fichiers).
3. Dans la barre de commande (puis *Exécuter*) :

   ```lua
   require(game.ServerStorage.SCPTools.PrepareAssets)()
   ```

   Les modèles sont rangés dans `ServerStorage.SCPAssets`, avec leur pivot et leur
   échelle corrigés, et le script affiche ce qu'il reste à importer.

### 4. Tester

Appuie sur *Jouer* : toutes les salles importées s'affichent côte à côte, avec leurs
props, leurs lumières et leurs collisions. Pour désactiver la galerie, décoche
l'attribut `SCP_RoomGallery` de *Workspace*.

## Organisation

```
scp-roblox/
  default.project.json        projet Rojo
  src/shared/Generated/       données des salles (généré)
  src/server/RoomBuilder.luau construit une salle : modèle, collisions, props, lumières
  src/server/RoomGallery…     galerie de test
  src/server/Generated/       collisions des salles (généré)
  src/studio/PrepareAssets    préparation des modèles importés (ServerStorage.SCPTools)
  manifest.txt                liste des scripts, lue par l'installateur (généré)
  tools/convert_scpcb.py      convertisseur
  tools/scpcb/                lecteurs RMesh, B3D, DirectX .x ; export OBJ ; collisions
  tools/studio/Install.luau   installateur à coller dans la barre de commande
```

Pour régénérer les données Luau après une modification du convertisseur, relance
`convert_scpcb.py` : il réécrit `src/*/Generated/` et `manifest.txt`.

## Limites connues

- **Éclairage** : le jeu utilise des lightmaps précalculées, que Roblox ne sait pas
  afficher sur des MeshParts. Les salles sont éclairées par des PointLight et
  SpotLight placés comme les lumières du jeu.
- **Modèles animés** (46 modèles, dont 106, 049, 096, les gardes, le MTF) : exportés
  en pose de repos, sans squelette ni animation. Certains sont donc couchés ou
  déformés. Il faudra un export FBX avec os pour les animer (étape des PNJ).
- **Échelle des modèles** : les modèles hors salles gardent leurs unités
  d'origine. Le jeu les met à l'échelle dans son code, et ce sera fait pour chacun
  lors de son étape.
- `GFX/items/Battery/Battery.x` est compressé (`xof 0303bzip`) et n'est pas
  converti. Sept textures référencées par le jeu n'existent pas dans son dépôt.
- Les zones extérieures (`gatea`, `exit1`, `dimension1499`) ont beaucoup de
  boîtes de collision (8 000 à 12 000), car leur terrain est irrégulier.
- **SCP-173** : son apparence vient d'une sculpture d'Izumi Kato, qui n'est pas
  sous licence libre (le wiki SCP a retiré l'image). Il faudra lui donner un
  nouveau modèle avant de publier le jeu.

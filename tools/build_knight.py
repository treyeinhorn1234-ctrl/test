#!/usr/bin/env python3
"""
Convertit les packs « Knight » (exports PixelOver : frames 256×256, 8 directions)
en atlas pour le jeu : Varyn recoloré (armure noire, reflets violets, visière
rouge incandescente), appui au sol aligné par direction, et données de combat (frames actives, allonge, hauteur
du poing) mesurées sur le sprite.

Usage : python3 tools/build_knight.py <dossier des packs extraits>
  (le dossier contient KnightBasic/, KnightAdvCombat/, KnightExMovement/)

Sorties (src/assets/character/knight/) :
  knight_<n>.png       pages d'atlas couleur (≤ 4096×4096)
  knight_<n>_e.png     pages d'émission (même disposition, mi-résolution)
  knight.json          taille des frames, pivot, clips (page, cellule de départ, nombre, fps, événements),
                       données de combat (moves : fenêtres actives et allonge par frame)

Directions : on garde E, NE, N, SE, S ; O, NO et SO sont obtenues en miroir.
Numérotation des exports (sens horaire depuis le sud-ouest, vérifiée par la visière et
l'inclinaison en course) : dir1=SO, dir2=O, dir3=NO, dir4=N, dir5=NE, dir6=E, dir7=SE, dir8=S.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

SRC = sys.argv[1] if len(sys.argv) > 1 else 'knight'
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'character', 'knight')

DIRS = {'e': 6, 'ne': 5, 'n': 4, 'se': 7, 's': 8}

# Clip du jeu ← (pack, animation, frames source, fps, boucle, événements, données de combat).
# Données de combat (None pour les clips sans coup) :
#   mode  : mesure de l'allonge — 'forward' (bras tendu vers l'avant, au-dessus des genoux),
#           'any' (n'importe quel membre vers l'avant : coups de pied, uppercut),
#           'radial' (de part et d'autre : attaque tournoyante),
#           'land' (frappe au sol : active à la réception d'un saut) ;
# Les frames actives (hitbox) et l'allonge de chaque frame sont mesurées sur le sprite.
FD = lambda mode: {'mode': mode}  # noqa: E731
CLIPS = [
    ('idle', 'KnightBasic', 'Idle', list(range(0, 17, 2)), 4, True, {}, None),
    ('walk', 'KnightBasic', 'Walk', list(range(11)), 10, True, {0: 'step', 5: 'step'}, None),
    ('run', 'KnightBasic', 'Run', list(range(8)), 12, True, {0: 'step', 4: 'step'}, None),
    # Combo du pack : 5 frappes (frames 3, 7, 12, 17, 21) → coup 1, coup 2, final en rafale (3 impacts).
    ('attack1', 'KnightAdvCombat', 'ComboAttack', [0, 1, 2, 3, 4, 5, 6], 14, False, {}, FD('forward')),
    ('attack2', 'KnightAdvCombat', 'ComboAttack', [6, 7, 8, 9, 10, 33, 34], 14, False, {}, FD('forward')),
    ('attack3', 'KnightAdvCombat', 'ComboAttack', [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 32, 33, 34], 16, False, {}, FD('any')),
    # Attaque en course : bond, impact à la réception.
    ('leap', 'KnightAdvCombat', 'JumpAttack', [0, 2, 4, 6, 8, 10, 11, 12, 13, 14, 16, 18, 20, 22], 16, False, {}, FD('land')),
    # Attaque lourde : tour complet, deux balayages.
    ('heavy', 'KnightAdvCombat', 'SpinAttack', list(range(17)), 16, False, {}, FD('radial')),
    # Coup de pied brise-garde (bifurcation du combo).
    ('kick', 'KnightAdvCombat', 'Kick', [0, 2, 3, 4, 5, 6, 7, 8, 9, 11], 16, False, {}, FD('any')),
    # Uppercut en sortie de roulade.
    ('uppercut', 'KnightAdvCombat', 'CrouchAttack', [0, 2, 3, 5, 6, 7, 8, 9, 11, 12], 16, False, {}, FD('any')),
    ('cast', 'KnightAdvCombat', 'Cast', list(range(10)), 16, False, {}, FD('forward')),
    # Garde (tenue sur la dernière frame) et garde frappée.
    ('guard', 'KnightAdvCombat', 'Block', [0, 1, 2, 3, 4, 5], 18, False, {}, None),
    ('guardHit', 'KnightAdvCombat', 'Block2', [0, 1, 2, 3, 4, 5, 6, 7], 18, False, {}, None),
    ('dodge', 'KnightExMovement', 'Slide', [2, 3, 4, 5, 6, 7, 8, 9, 10], 24, False, {}, None),
    ('roll', 'KnightAdvCombat', 'ComboAttack', [24, 25, 26, 27, 28, 29, 30, 31], 16, False, {}, None),
    ('hurt', 'KnightAdvCombat', 'Impact', [0, 1, 2, 3, 4, 6, 8], 20, False, {}, None),
    ('death', 'KnightBasic', 'Die', [0, 3, 6, 9, 12, 15, 18, 20, 21, 22, 24, 26], 8, False, {}, None),
    ('interact', 'KnightAdvCombat', 'Knock', [0, 2, 3, 4, 5, 6, 8], 12, False, {}, None),
    ('victory', 'KnightExMovement', 'PowerUp', [0, 2, 4, 6, 8, 10, 12, 14], 6, True, {}, None),
]

# Marge du poing (gantelet, recul de l'impact) en px et densité du sprite (px par unité monde).
FIST_MARGIN = 10
PPU = 32

FRAME = 256
PIVOT_SRC = (128, 141)  # pieds du modèle dans une frame source


def load_frames(pack, anim, d):
    base = os.path.join(SRC, pack, anim, f'Knight_{anim}_dir{d}')
    meta = json.load(open(base + '.json'))
    im = Image.open(base + '.png').convert('RGBA')
    return [im.crop((f['frame']['x'], f['frame']['y'], f['frame']['x'] + FRAME, f['frame']['y'] + FRAME)) for f in meta['frames']]


# ------------------------------------------------------------- données de combat

def reach_px(img, mode, with_height=False):
    """Allonge (px) d'une frame vue de profil (direction est), depuis le pivot (pieds).
    Avec `with_height`, renvoie aussi la hauteur (px au-dessus des pieds) du point le plus avancé."""
    a = np.asarray(img)[..., 3] > 0
    ys, xs = np.nonzero(a)
    if not len(xs):
        return (0, 0) if with_height else 0
    px, py = PIVOT_SRC
    if mode == 'forward':
        m = ys < py - 22  # au-dessus des genoux : bras et buste
    elif mode in ('any', 'land'):
        m = ys < py - 6  # tout sauf le pied d'appui
    else:
        m = np.ones_like(xs, dtype=bool)
    if not m.any():
        return (0, 0) if with_height else 0
    d = np.abs(xs[m] - px) if mode == 'radial' else xs[m] - px
    k = int(np.argmax(d))
    return (int(d[k]), int(py - ys[m][k])) if with_height else int(d[k])


def frame_data(pack, anim, idx, fd, baseline):
    """Frames actives et allonge mesurées sur le profil est (dir6) du sprite source."""
    src = load_frames(pack, anim, DIRS['e'])
    rh = [reach_px(src[i], fd['mode'], True) for i in idx]
    reach = [r for r, _ in rh]
    if fd['mode'] == 'land':
        # Impact à la réception : premières frames où les pieds retouchent le sol après le saut.
        bottoms = [src[i].getbbox()[3] for i in idx]
        airborne = False
        active = [False] * len(idx)
        for k, bot in enumerate(bottoms):
            if bot < PIVOT_SRC[1] - 15:
                airborne = True
            elif airborne and bot >= PIVOT_SRC[1] - 4:
                active[k] = True
                if k + 1 < len(idx):
                    active[k + 1] = True
                break
    else:
        base = baseline[fd['mode']]
        peak = max(reach)
        active = [r >= base + 7 and r >= peak * 0.8 for r in reach]
    windows = []
    for i, on in enumerate(active):
        if on and (not windows or windows[-1][1] != i - 1):
            windows.append([i, i])
        elif on:
            windows[-1][1] = i
    units = [round((r + FIST_MARGIN) / PPU, 2) for r in reach]
    # Hauteur du poing / pied (unités, avant correction de l'étirement vertical) : place les impacts.
    heights = [round(h / PPU, 2) for _, h in rh]
    return {'windows': windows, 'reach': units, 'height': heights}


# ------------------------------------------------------------- recoloration

def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def hexrgb(h):
    return ((h >> 16) & 255, (h >> 8) & 255, h & 255)


# Armure (plaques bleu acier) : rampe sombre, du noir violacé au gris-mauve.
# (sombre : l'éclairage de la scène et la lumière d'appoint remontent ces valeurs)
ARMOR_RAMP = [hexrgb(h) for h in (0x110e17, 0x18131f, 0x1f1928, 0x272032, 0x30283d, 0x3a3049, 0x453956, 0x524465)]
# Sous-vêtement (gris neutres) : tissu pourpre très sombre.
CLOTH_RAMP = [hexrgb(h) for h in (0x0b0710, 0x140b1c, 0x1e1029, 0x2a1638, 0x381d4a)]
# Reflets les plus clairs : éclats violets (non émissifs, pour ne pas éblouir).
GLINT = [hexrgb(h) for h in (0x6a48a8, 0x8460c8, 0xa07ee0)]
# Visière orange → yeux rouges incandescents.
VISOR = {'dark': hexrgb(0x8a1418), 'mid': hexrgb(0xe02828), 'hi': hexrgb(0xff8a70)}
INK = hexrgb(0x07050b)


def build_palette(colors):
    """Associe chaque couleur source à (couleur, émission ou None)."""
    armor = sorted({c for c in colors if classify(c) == 'armor'}, key=lum)
    cloth = sorted({c for c in colors if classify(c) == 'cloth'}, key=lum)
    glint = sorted({c for c in colors if classify(c) == 'glint'}, key=lum)
    visor = sorted({c for c in colors if classify(c) == 'visor'}, key=lum)
    m = {}
    for group, ramp in ((armor, ARMOR_RAMP), (cloth, CLOTH_RAMP), (glint, GLINT)):
        for i, c in enumerate(group):
            t = i / max(1, len(group) - 1)
            m[c] = (ramp[round(t * (len(ramp) - 1))], None)
    for i, c in enumerate(visor):
        col = [VISOR['dark'], VISOR['mid'], VISOR['hi']][min(2, round(i / max(1, len(visor) - 1) * 2))]
        m[c] = (col, col)
    m[(0, 0, 0)] = (INK, None)
    return m


def classify(c):
    r, g, b = c
    if (r, g, b) == (0, 0, 0):
        return 'ink'
    if r > b + 40:
        return 'visor'
    if max(c) - min(c) < 22:
        return 'cloth'
    if lum(c) > 200:
        return 'glint'
    return 'armor'


# ------------------------------------------------------------- assemblage

def main():
    os.makedirs(OUT, exist_ok=True)
    # 1. Charge toutes les frames retenues.
    cells = []  # (clip, dir, frame index, image)
    colors = set()
    idle_e = load_frames('KnightBasic', 'Idle', DIRS['e'])[0]
    baseline = {m: reach_px(idle_e, m) for m in ('forward', 'any', 'radial', 'land')}
    moves = {}
    for name, pack, anim, idx, fps, loop, ev, fd in CLIPS:
        if fd:
            moves[name] = frame_data(pack, anim, idx, fd, baseline)
            print(f'{name:9} fenêtres {moves[name]["windows"]} allonge {moves[name]["reach"]}')
        for dname, d in DIRS.items():
            src = load_frames(pack, anim, d)
            for k, i in enumerate(idx):
                f = src[i]
                a = np.asarray(f)
                colors.update(map(tuple, np.unique(a[a[..., 3] > 0][:, :3], axis=0).tolist()))
                cells.append((name, dname, i, f))
    pal = build_palette(colors)
    # Appui au sol par direction : dans certaines vues, l'origine du modèle 3D n'est pas sous
    # les pieds (vue est : 6 px trop haut). On aligne le bas des pieds au repos sur le pivot.
    ground = {}
    for dname, d in DIRS.items():
        bottoms = [f.getbbox()[3] - 1 for f in load_frames('KnightBasic', 'Idle', d)]
        ground[dname] = PIVOT_SRC[1] - max(bottoms)
    print('correction d\'appui (px)', ground)
    # Puis par animation : si le point le plus bas d'un clip reste au-dessus du sol (marche,
    # course vues de dos…), on le descend jusqu'au contact. On ne remonte jamais un clip.
    lowest = {}
    for (name, dname, _, f) in cells:
        key = (name, dname)
        lowest[key] = max(lowest.get(key, 0), f.getbbox()[3] - 1 + ground[dname])
    shift = {key: ground[key[1]] + max(0, PIVOT_SRC[1] - low) for key, low in lowest.items()}
    floating = {f'{k[0]}@{k[1]}': v - ground[k[1]] for k, v in shift.items() if v != ground[k[1]]}
    print('clips redescendus (px)', floating)
    lut = {(c[0] << 16) | (c[1] << 8) | c[2]: v for c, v in pal.items()}

    # 2. Boîte commune, centrée sur le pivot (le miroir garde les pieds en place).
    x0 = y0 = FRAME
    x1 = y1 = 0
    for c in cells:
        bb = c[3].getbbox()
        if bb:
            dy = shift[(c[0], c[1])]  # boîte après l'alignement au sol
            x0, y0, x1, y1 = min(x0, bb[0]), min(y0, bb[1] + dy), max(x1, bb[2]), max(y1, bb[3] + dy)
    half = min(max(PIVOT_SRC[0] - x0, x1 - PIVOT_SRC[0]) + 2, 128)
    top = max(0, min(y0, PIVOT_SRC[1] - 1) - 2)
    bottom = min(FRAME, y1 + 2)
    fw = half * 2
    fh = bottom - top
    print('union', (x0, y0, x1, y1), 'frame', fw, fh, 'cells', len(cells))
    crop = (PIVOT_SRC[0] - half, top, PIVOT_SRC[0] + half, bottom)

    # 3. Disposition en pages ≤ 4096×4096 (limite de texture courante) ; un clip ne
    #    chevauche jamais deux pages.
    cols = 4096 // fw
    rows_max = 4096 // fh
    per_page = cols * rows_max
    pages = []  # [(atlas, emission)]
    clips = {}
    slot = per_page  # force une nouvelle page au départ
    groups = []
    for c in cells:
        key = f'{c[0]}@{c[1]}'
        if not groups or groups[-1][0] != key:
            groups.append((key, []))
        groups[-1][1].append(c)

    def new_page():
        pages.append((Image.new('RGBA', (cols * fw, rows_max * fh), (0, 0, 0, 0)), Image.new('RGBA', (cols * fw, rows_max * fh), (0, 0, 0, 0))))

    for key, group in groups:
        if slot + len(group) > per_page:
            new_page()
            slot = 0
        name = key.split('@')[0]
        spec = next(c for c in CLIPS if c[0] == name)
        clips[key] = {'page': len(pages) - 1, 'start': slot, 'count': len(group), 'fps': spec[4], 'loop': spec[5],
                      'events': {str(a): b for a, b in spec[6].items()}}
        for (_, dname, i, f) in group:
        # Recoloration par table de correspondance.
            a = np.asarray(f, dtype=np.uint8)
            key_px = (a[..., 0].astype(np.int32) << 16) | (a[..., 1].astype(np.int32) << 8) | a[..., 2]
            out = np.zeros_like(a)
            eo = np.zeros_like(a)
            for src_key, (col, glow) in lut.items():
                m = (key_px == src_key) & (a[..., 3] > 0)
                if not m.any():
                    continue
                out[m, :3] = col
                out[m, 3] = a[m, 3]
                if glow:
                    eo[m, :3] = glow
                    eo[m, 3] = 255
            img = Image.fromarray(out, 'RGBA').copy()
            emi = Image.fromarray(eo, 'RGBA').copy()
            dy = shift[(name, dname)]
            img = img.crop((crop[0], crop[1] - dy, crop[2], crop[3] - dy))
            emi = emi.crop((crop[0], crop[1] - dy, crop[2], crop[3] - dy))
            cx, cy = (slot % cols) * fw, (slot // cols) * fh
            pages[-1][0].paste(img, (cx, cy))
            pages[-1][1].paste(emi, (cx, cy))
            slot += 1

    for n, (atlas, emis) in enumerate(pages):
        # Rogne la page à la dernière ligne utilisée.
        bb = atlas.getbbox() or (0, 0, 1, 1)
        h = math.ceil(bb[3] / fh) * fh
        atlas.crop((0, 0, atlas.width, h)).save(os.path.join(OUT, f'knight_{n}.png'), optimize=True)
        # L'émission est échantillonnée à mi-résolution (mêmes UV) : texture 4× plus légère.
        e = emis.crop((0, 0, emis.width, h)).filter(ImageFilter.MaxFilter(3))
        e.resize((e.width // 2, e.height // 2), Image.NEAREST).save(os.path.join(OUT, f'knight_{n}_e.png'), optimize=True)
        print('page', n, atlas.width, h)

    meta = {
        'frameW': fw, 'frameH': fh, 'cols': cols,
        'pages': [{'h': math.ceil(((p[0].getbbox() or (0, 0, 1, 1))[3]) / fh) * fh} for p in pages],
        'pivotX': PIVOT_SRC[0] - crop[0], 'pivotY': PIVOT_SRC[1] - crop[1],
        'directions': list(DIRS.keys()),
        'clips': clips,
        # Données de combat par animation : fenêtres actives (indices de frame) et allonge (unités).
        'moves': moves,
    }
    json.dump(meta, open(os.path.join(OUT, 'knight.json'), 'w'), indent=1)
    print('pages', len(pages), 'clips', len(clips))


if __name__ == '__main__':
    main()

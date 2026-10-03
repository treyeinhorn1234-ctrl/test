#!/usr/bin/env python3
"""
Convertit les packs « Knight » (exports PixelOver : frames 256×256, 8 directions)
en atlas pour le jeu : Varyn recoloré (armure noire, reflets violets, visière
rouge incandescente), épée Eclipse ajoutée au poing sur les frames d'impact.

Usage : python3 tools/build_knight.py <dossier des packs extraits>
  (le dossier contient KnightBasic/, KnightAdvCombat/, KnightExMovement/)

Sorties (src/assets/character/knight/) :
  knight_<n>.png       pages d'atlas couleur (≤ 4096×4096)
  knight_<n>_e.png     pages d'émission (même disposition, mi-résolution)
  knight.json          taille des frames, pivot, clips (page, cellule de départ, nombre, fps, événements)

Directions : on garde E, NE, N, SE, S ; O, NO et SO sont obtenues en miroir.
Numérotation des exports : dir1=E, dir2=NE, dir3=N, dir4=NO, dir5=O, dir6=SO, dir7=S, dir8=SE.
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

SRC = sys.argv[1] if len(sys.argv) > 1 else 'knight'
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'character', 'knight')

DIRS = {'e': 1, 'ne': 2, 'n': 3, 'se': 8, 's': 7}
# Vecteur « avant » à l'écran de chaque direction (pour placer l'épée).
FWD = {'e': (1, 0), 'ne': (0.8, -0.6), 'n': (0, -1), 'se': (0.8, 0.6), 's': (0, 1)}

# Clip du jeu ← (pack, animation, frames source, fps, boucle, événements, frames d'impact pour l'épée).
# Les frames sont choisies pour que l'impact tombe au moment où le coup touche dans le jeu.
CLIPS = [
    ('idle', 'KnightBasic', 'Idle', list(range(17)), 7, True, {}, []),
    ('walk', 'KnightBasic', 'Walk', list(range(11)), 10, True, {0: 'step', 5: 'step'}, []),
    ('run', 'KnightBasic', 'Run', list(range(8)), 12, True, {0: 'step', 4: 'step'}, []),
    ('attack1', 'KnightAdvCombat', 'ComboAttack', [3, 5, 6, 7, 8, 9, 10], 16, False, {}, [5, 6, 7]),
    ('attack2', 'KnightAdvCombat', 'ComboAttack', [12, 13, 14, 15, 16, 33, 34], 16, False, {}, [13, 14, 15]),
    ('attack3', 'KnightAdvCombat', 'JumpAttack', [2, 5, 8, 11, 13, 14, 15, 16, 17, 18, 19, 21, 22], 20, False, {}, [13, 14, 15, 16]),
    ('heavy', 'KnightAdvCombat', 'SpinAttack', list(range(17)), 18, False, {}, [7, 8, 9, 10]),
    ('cast', 'KnightAdvCombat', 'Cast', list(range(10)), 20, False, {}, []),
    ('dodge', 'KnightExMovement', 'Slide', [2, 3, 4, 5, 6, 7, 8, 9, 10], 24, False, {}, []),
    ('roll', 'KnightAdvCombat', 'ComboAttack', [24, 25, 26, 27, 28, 29, 30, 31], 16, False, {}, []),
    ('hurt', 'KnightAdvCombat', 'Impact', [0, 1, 2, 3, 4, 6, 8], 20, False, {}, []),
    ('death', 'KnightBasic', 'Die', [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 19, 20, 21, 22, 23, 24, 26], 9, False, {}, []),
    ('interact', 'KnightAdvCombat', 'Knock', [0, 2, 3, 4, 5, 6, 8], 12, False, {}, []),
    ('victory', 'KnightExMovement', 'PowerUp', [0, 2, 4, 6, 8, 10, 12, 14], 6, True, {}, []),
]

FRAME = 256
PIVOT_SRC = (128, 141)  # pieds du modèle dans une frame source


def load_frames(pack, anim, d):
    base = os.path.join(SRC, pack, anim, f'Knight_{anim}_dir{d}')
    meta = json.load(open(base + '.json'))
    im = Image.open(base + '.png').convert('RGBA')
    return [im.crop((f['frame']['x'], f['frame']['y'], f['frame']['x'] + FRAME, f['frame']['y'] + FRAME)) for f in meta['frames']]


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


# ------------------------------------------------------------- épée Eclipse

STEEL = {'edge': hexrgb(0xd0c8dc), 'mid': hexrgb(0x8a8296), 'dark': hexrgb(0x3a3542), 'guard': hexrgb(0x6c607a), 'rune': hexrgb(0xb27cff)}


def find_fist(img, fwd):
    """Poing tendu : pixel opaque le plus avancé dans la direction regardée (au-dessus des genoux)."""
    px = img.load()
    pts = [(x, y) for y in range(img.height) for x in range(img.width) if px[x, y][3] > 0]
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    shoulder = (cx, cy - 12)
    if abs(fwd[0]) < 0.1:
        # De face / de dos, le poing tendu vers (ou loin de) la caméra se confond avec
        # le buste : on prend la main la plus écartée latéralement, à hauteur de bras.
        band = [p for p in pts if cy - 14 < p[1] < cy + 10]
        best = max(band, key=lambda p: abs(p[0] - cx))
        return best, shoulder
    upper = [p for p in pts if p[1] < cy + 14]
    best = max(upper, key=lambda p: (p[0] - cx) * fwd[0] + (p[1] - cy) * fwd[1])
    return best, shoulder


def draw_line(px, w, h, a, b, col, size=1):
    steps = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
    for i in range(steps + 1):
        t = i / max(1, steps)
        x = a[0] + (b[0] - a[0]) * t
        y = a[1] + (b[1] - a[1]) * t
        for dx in range(size):
            for dy in range(size):
                xx, yy = round(x - (size - 1) / 2 + dx), round(y - (size - 1) / 2 + dy)
                if 0 <= xx < w and 0 <= yy < h:
                    px[xx, yy] = col + (255,)


def add_sword(img, emi, fwd, strength):
    """Lame dans le prolongement du bras, garde perpendiculaire au poing, runes émissives."""
    fist, sh = find_fist(img, fwd)
    dx, dy = fist[0] - sh[0], fist[1] - sh[1]
    n = math.hypot(dx, dy) or 1
    ux, uy = dx / n, dy / n
    # Mélange avec la direction regardée pour une lame franche.
    ux, uy = ux * 0.6 + fwd[0] * 0.4, uy * 0.6 + fwd[1] * 0.4
    n = math.hypot(ux, uy) or 1
    ux, uy = ux / n, uy / n
    L = 30
    base = (fist[0] + ux * 2, fist[1] + uy * 2)
    tip = (fist[0] + ux * L, fist[1] + uy * L)
    px = img.load()
    ep = emi.load()
    w, h = img.size
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    lp = lay.load()
    draw_line(lp, w, h, base, tip, STEEL['mid'], 3)
    nx, ny = -uy, ux
    draw_line(lp, w, h, (base[0] + nx, base[1] + ny), tip, STEEL['edge'], 1)
    draw_line(lp, w, h, (base[0] - nx, base[1] - ny), (tip[0] - ux * 2 - nx, tip[1] - uy * 2 - ny), STEEL['dark'], 1)
    g = (fist[0] + ux, fist[1] + uy)
    draw_line(lp, w, h, (g[0] - nx * 4, g[1] - ny * 4), (g[0] + nx * 4, g[1] + ny * 4), STEEL['guard'], 2)
    # Contour de la lame.
    outline = []
    for y in range(h):
        for x in range(w):
            if lp[x, y][3]:
                continue
            for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + ox, y + oy
                if 0 <= xx < w and 0 <= yy < h and lp[xx, yy][3]:
                    outline.append((x, y))
                    break
    for x, y in outline:
        lp[x, y] = INK + (255,)
    img.alpha_composite(lay)
    # Runes et fil incandescents (plus vifs à l'impact).
    for k in range(5, L - 3, 4):
        x, y = round(fist[0] + ux * k), round(fist[1] + uy * k)
        if 0 <= x < w and 0 <= y < h:
            px[x, y] = STEEL['rune'] + (255,)
            ep[x, y] = STEEL['rune'] + (255,)
    if strength > 0.5:
        for k in range(4, L):
            x, y = round(fist[0] + ux * k + nx), round(fist[1] + uy * k + ny)
            if 0 <= x < w and 0 <= y < h:
                ep[x, y] = (150, 100, 255, 255)


# ------------------------------------------------------------- assemblage

def main():
    os.makedirs(OUT, exist_ok=True)
    # 1. Charge toutes les frames retenues.
    cells = []  # (clip, dir, frame index, image, impact?)
    colors = set()
    for name, pack, anim, idx, fps, loop, ev, strikes in CLIPS:
        for dname, d in DIRS.items():
            src = load_frames(pack, anim, d)
            for i in idx:
                f = src[i]
                a = np.asarray(f)
                colors.update(map(tuple, np.unique(a[a[..., 3] > 0][:, :3], axis=0).tolist()))
                cells.append((name, dname, i, f, i in strikes))
    pal = build_palette(colors)
    lut = {(c[0] << 16) | (c[1] << 8) | c[2]: v for c, v in pal.items()}

    # 2. Boîte commune, centrée sur le pivot (le miroir garde les pieds en place).
    x0 = y0 = FRAME
    x1 = y1 = 0
    for c in cells:
        bb = c[3].getbbox()
        if bb:
            x0, y0, x1, y1 = min(x0, bb[0]), min(y0, bb[1]), max(x1, bb[2]), max(y1, bb[3])
    # Marge pour l'épée tendue au-delà de la silhouette.
    half = min(max(PIVOT_SRC[0] - x0, x1 - PIVOT_SRC[0]) + 14, 128)
    top = max(0, min(y0, PIVOT_SRC[1] - 1) - 6)
    bottom = min(FRAME, y1 + 4)
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
        for (_, dname, i, f, strike) in group:
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
            if strike:
                add_sword(img, emi, FWD[dname], 1.0)
            img = img.crop(crop)
            emi = emi.crop(crop)
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
    }
    json.dump(meta, open(os.path.join(OUT, 'knight.json'), 'w'), indent=1)
    print('pages', len(pages), 'clips', len(clips))


if __name__ == '__main__':
    main()

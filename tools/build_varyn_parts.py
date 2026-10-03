#!/usr/bin/env python3
"""
Découpe le sprite source de Varyn en parties (calques) prêtes à être riggées.

Entrée  : src/assets/character/varyn/source.png (106×121, pixel art natif)
Sorties : src/assets/character/varyn/<dossier>/<partie>.png + rig.json

Chaque partie est une image de la taille de la source (mêmes coordonnées que
les pivots) contenant :
  - ses propres pixels ;
  - les pixels « cachés » reconstitués là où un membre la recouvrait
    (parties du corps : buste, bassin, cape) ;
  - un « capuchon » d'articulation : les pixels voisins autour de ses pivots,
    pour qu'aucune fissure n'apparaisse quand l'os tourne.
Génère aussi deux calques dédiés aux vues de dos : la cape drapée vue de dos
et l'arrière du heaume.

Usage : python3 tools/build_varyn_parts.py
"""
import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / 'src/assets/character/varyn'

P = {
    'waist': (60, 62), 'neck': (61, 24),
    'nShoulder': (46, 33), 'nElbow': (39, 48), 'nWrist': (42, 57), 'nHand': (44, 61),
    'fShoulder': (73, 34), 'fElbow': (77, 50), 'fWrist': (79, 61), 'fHand': (80, 64),
    'nHip': (51, 67), 'nKnee': (49, 82), 'nAnkle': (45, 103), 'nToe': (42, 112),
    'fHip': (64, 70), 'fKnee': (67, 87), 'fAnkle': (71, 102), 'fToe': (80, 109),
    'pelvis': (60, 66), 'neckBase': (61, 27), 'capeFront': (59, 89),
}
SWORD_TIP = (98.6, 107.3)

# id, parent, pivot, fichier, partie « corps » (reçoit la sous-couche)
BONES = [
    ('pelvis', None, 'pelvis', 'body/pelvis.png', True),
    ('cape', None, 'pelvis', 'cape/cape_rear.png', True),
    ('torso', 'pelvis', 'waist', 'body/torso.png', True),
    ('capeFront', 'pelvis', 'capeFront', 'cape/cape_front.png', False),
    ('neck', 'torso', 'neckBase', 'body/neck.png', False),
    ('head', 'neck', 'neck', 'head/head.png', False),
    ('nPad', 'torso', 'nShoulder', 'body/shoulder_near.png', False),
    ('fPad', 'torso', 'fShoulder', 'body/shoulder_far.png', False),
    ('nUpper', 'torso', 'nShoulder', 'arms/near_upper.png', False),
    ('nFore', 'nUpper', 'nElbow', 'arms/near_fore.png', False),
    ('nHand', 'nFore', 'nWrist', 'arms/near_hand.png', False),
    ('sword', 'nHand', 'nHand', 'weapon/eclipse.png', False),
    ('fUpper', 'torso', 'fShoulder', 'arms/far_upper.png', False),
    ('fFore', 'fUpper', 'fElbow', 'arms/far_fore.png', False),
    ('fHand', 'fFore', 'fWrist', 'arms/far_hand.png', False),
    ('nThigh', 'pelvis', 'nHip', 'legs/near_thigh.png', False),
    ('nShin', 'nThigh', 'nKnee', 'legs/near_shin.png', False),
    ('nFoot', 'nShin', 'nAnkle', 'legs/near_foot.png', False),
    ('fThigh', 'pelvis', 'fHip', 'legs/far_thigh.png', False),
    ('fShin', 'fThigh', 'fKnee', 'legs/far_shin.png', False),
    ('fFoot', 'fShin', 'fAnkle', 'legs/far_foot.png', False),
]
CHILD_PIVOTS = {}
for bid, parent, piv, _, _ in BONES:
    if parent:
        CHILD_PIVOTS.setdefault(parent, []).append(piv)

src = Image.open(DIR / 'source.png').convert('RGBA')
W, H = src.size
px = src.load()


def opaque(x, y):
    return 0 <= x < W and 0 <= y < H and px[x, y][3] >= 128


# --- Épée -------------------------------------------------------------------
REST_A = 0.7008
D = (math.cos(REST_A), math.sin(REST_A))
N = (-D[1], D[0])
GUARD = (48, 65)
sword = [[False] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        if not opaque(x, y):
            continue
        dx, dy = x - GUARD[0], y - GUARD[1]
        t = dx * D[0] + dy * D[1]
        p = dx * N[0] + dy * N[1]
        bw = 4.3 if t < 56 else 4.3 - (t - 56) / 12 * 2.4
        blade = 0.5 < t < 69 and abs(p) <= bw
        guard = abs(t) <= 2.2 and abs(p) <= 11.5
        hilt = -27 < t <= 0.5 and abs(p) <= 2.8 and math.hypot(x - P['nHand'][0], y - P['nHand'][1]) > 5
        sword[y][x] = blade or guard or hilt
for _ in range(2):
    grab = []
    for y in range(H):
        for x in range(W):
            if not opaque(x, y) or sword[y][x]:
                continue
            touch, body = False, 0
            for j in (-1, 0, 1):
                for k in (-1, 0, 1):
                    if j == 0 and k == 0:
                        continue
                    xx, yy = x + k, y + j
                    if not opaque(xx, yy):
                        continue
                    if sword[yy][xx]:
                        touch = True
                    else:
                        body += 1
            if touch and body <= 3:
                grab.append((x, y))
    for x, y in grab:
        sword[y][x] = True


# --- Segmentation -------------------------------------------------------------
def seg_dist(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    l2 = dx * dx + dy * dy or 1
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2))
    return math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t))


N_ARM = [('nUpper', (45, 37), P['nElbow'], 5.5), ('nFore', P['nElbow'], P['nWrist'], 5), ('nHand', P['nHand'], P['nHand'], 5.2)]
F_ARM = [('fUpper', (74, 37), P['fElbow'], 6), ('fFore', P['fElbow'], P['fWrist'], 6), ('fHand', P['fHand'], P['fHand'], 5.5)]
N_LEG = [('nThigh', (51, 72), P['nKnee'], 6), ('nShin', P['nKnee'], P['nAnkle'], 5.5), ('nFoot', P['nAnkle'], P['nToe'], 6.5)]
F_LEG = [('fThigh', (64, 76), P['fKnee'], 6), ('fShin', P['fKnee'], P['fAnkle'], 6), ('fFoot', P['fAnkle'], P['fToe'], 8)]


def nearest(p, lst):
    best, bd = None, 0
    for bid, a, b, r in lst:
        d = seg_dist(p, a, b) - r
        if d <= 0 and (best is None or d < bd):
            best, bd = bid, d
    return best


def classify(x, y):
    if sword[y][x]:
        return 'sword'
    p = (x + 0.5, y + 0.5)
    if y < 24 and 50 <= x <= 74:
        return 'head'
    if x < 52 and 38 <= y <= 68:
        n = nearest(p, N_ARM)
        if n:
            return n
    if x >= 70 and 36 <= y <= 70:
        n = nearest(p, F_ARM)
        if n:
            return n
    if x <= 56 and y >= 74:
        n = nearest(p, N_LEG)
        if n and (n != 'nFoot' or y >= 100):
            return n
    if x >= 58 and y >= 80:
        n = nearest(p, F_LEG)
        if n and (n != 'fFoot' or y >= 99):
            return n
    if (x < 40 and y >= 50) or (x < 44 and y >= 88):
        return 'cape'
    return 'torso' if y < 63 else 'pelvis'


def refine(x, y, pid):
    """Épaulières, cou et pan de cape avant : découpés dans le buste / bassin."""
    if pid == 'torso':
        if 54 <= x <= 68 and 22 <= y <= 27:
            return 'neck'
        if x <= 56 and y <= 40 and math.hypot((x - 46) / 1.15, y - 30) <= 10.5:
            return 'nPad'
        if x >= 68 and y <= 44 and math.hypot(x - 75, y - 32) <= 9:
            return 'fPad'
    if pid == 'pelvis' and 52 <= x <= 66 and y >= 90:
        return 'capeFront'
    return pid


part = [[None] * W for _ in range(H)]
for y in range(H):
    for x in range(W):
        if opaque(x, y):
            part[y][x] = refine(x, y, classify(x, y))

CORE = {b[0] for b in BONES if b[4]}


def lum(c):
    return c[0] + c[1] + c[2]


# --- Pixels cachés : sous-couche des parties du corps --------------------------
def enclosed(x, y):
    for ax, ay in ((1, 0), (0, 1), (1, 1), (1, -1)):
        sides = 0
        for s in (-1, 1):
            for k in range(1, 15):
                xx, yy = x + ax * k * s, y + ay * k * s
                if not opaque(xx, yy):
                    break
                if part[yy][xx] in CORE:
                    sides += 1
                    break
        if sides == 2:
            return True
    return False


under = {}
pending = [(x, y) for y in range(H) for x in range(W) if part[y][x] and part[y][x] not in CORE and enclosed(x, y)]
for _ in range(40):
    if not pending:
        break
    nxt, adds = [], []
    for x, y in pending:
        best = None
        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            xx, yy = x + ox, y + oy
            if not (0 <= xx < W and 0 <= yy < H):
                continue
            cand = under.get((xx, yy))
            if cand is None and part[yy][xx] in CORE:
                cand = (part[yy][xx], px[xx, yy])
            if cand and (best is None or lum(cand[1]) < lum(best[1])):
                best = cand
        if best:
            adds.append(((x, y), best))
        else:
            nxt.append((x, y))
    for k, v in adds:
        under[k] = v
    pending = nxt

# --- Écriture des calques -----------------------------------------------------
layers = {b[0]: Image.new('RGBA', (W, H), (0, 0, 0, 0)) for b in BONES}
for y in range(H):
    for x in range(W):
        pid = part[y][x]
        if pid:
            layers[pid].putpixel((x, y), px[x, y])
for (x, y), (pid, col) in under.items():
    if layers[pid].getpixel((x, y))[3] == 0:
        layers[pid].putpixel((x, y), col)

# Capuchons d'articulation : chaque os reçoit les pixels voisins (r ≤ 3) autour
# de son pivot et des pivots de ses enfants, sans écraser ses propres pixels.
CAP_R = 3
for bid, parent, piv, _, core in BONES:
    if core or bid == 'sword':
        continue
    lay = layers[bid]
    for name in [piv] + CHILD_PIVOTS.get(bid, []):
        cx, cy = P[name]
        for y in range(cy - CAP_R, cy + CAP_R + 1):
            for x in range(cx - CAP_R, cx + CAP_R + 1):
                if not opaque(x, y) or math.hypot(x - cx, y - cy) > CAP_R:
                    continue
                if lay.getpixel((x, y))[3] == 0 and part[y][x] not in ('sword', 'cape'):
                    lay.putpixel((x, y), px[x, y])

# --- Vues de dos : arrière du heaume ---------------------------------------
head_back = layers['head'].copy()
hb = head_back.load()
for y in range(H):
    for x in range(W):
        r, g, b, a = hb[x, y]
        if not a:
            continue
        # La fente du visage et les reflets disparaissent : métal sombre uniforme.
        if lum((r, g, b)) > 150 or (b > 110 and b > g + 45):
            hb[x, y] = (34, 30, 40, 255)
        elif lum((r, g, b)) > 90:
            hb[x, y] = (46, 42, 54, 255)

# --- Vues de dos : cape drapée ------------------------------------------------
cape_cols = sorted({px[x, y][:3] for y in range(H) for x in range(W) if part[y][x] == 'cape'}, key=lum)
ramp = [cape_cols[int(i * (len(cape_cols) - 1) / 5)] for i in range(6)]
cape_back = Image.new('RGBA', (W, H), (0, 0, 0, 0))
cb = cape_back.load()
import random
rng = random.Random(7)
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
# Ourlet déchiré : profondeur des lambeaux variable par colonne.
hem = []
v = 0
for x in range(W):
    v += rng.randint(-2, 2)
    v = max(-4, min(4, v))
    hem.append(106 + v + (rng.randint(3, 8) if rng.random() < 0.18 else 0))
# Plis : quelques creux à positions irrégulières qui s'élargissent vers le bas.
folds = [(rng.uniform(-0.8, 0.8), rng.uniform(0.6, 1.3)) for _ in range(6)]
for y in range(27, H):
    t = (y - 27) / 80
    half = 10 + t * 19
    cx = 61 - t * 5
    for x in range(W):
        u = (x - cx) / half
        if abs(u) > 1 or y > hem[x]:
            continue
        shade_v = 0.55 - 0.3 * abs(u) ** 2 - t * 0.12
        for pos, width in folds:
            d = abs(u - pos * (0.4 + t * 0.6)) / (0.12 * width)
            if d < 1:
                shade_v -= 0.22 * (1 - d)
            elif d < 1.6:
                shade_v += 0.08 * (1.6 - d)
        shade_v += (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.18
        idx = max(0, min(5, int(shade_v * 6)))
        cb[x, y] = ramp[idx] + (255,)
# Lisière : bords et ourlet un ton plus sombre, col plus clair.
for y in range(27, H):
    for x in range(W):
        if not cb[x, y][3]:
            continue
        if not cb[x - 1, y][3] or not cb[x + 1, y][3] or y + 1 >= H or not cb[x, y + 1][3]:
            cb[x, y] = ramp[0] + (255,)
        elif y < 30:
            cb[x, y] = ramp[4] + (255,)

# --- Sauvegarde -----------------------------------------------------------------
files = {}
for bid, parent, piv, f, core in BONES:
    path = DIR / f
    path.parent.mkdir(parents=True, exist_ok=True)
    layers[bid].save(path)
    files[bid] = f
(DIR / 'head').mkdir(exist_ok=True)
head_back.save(DIR / 'head/head_back.png')
(DIR / 'cape').mkdir(exist_ok=True)
cape_back.save(DIR / 'cape/cape_drape_back.png')

rig = {
    'source': 'source.png',
    'width': W,
    'height': H,
    'pivots': {k: list(v) for k, v in P.items()},
    'swordTip': list(SWORD_TIP),
    'bones': [
        {'id': bid, 'parent': parent, 'pivot': piv, 'file': f, 'core': core}
        for bid, parent, piv, f, core in BONES
    ],
    'backViewLayers': {'head': 'head/head_back.png', 'capeDrape': 'cape/cape_drape_back.png'},
    'layerOrder': {
        'front': ['cape', 'fUpper', 'fFore', 'fHand', 'fThigh', 'fShin', 'fFoot', 'pelvis', 'capeFront', 'nThigh', 'nShin', 'nFoot',
                  'torso', 'fPad', 'neck', 'head', 'nUpper', 'nFore', 'sword', 'nHand', 'nPad'],
        'back': ['sword', 'nHand', 'capeFront', 'fThigh', 'fShin', 'fFoot', 'nThigh', 'nShin', 'nFoot', 'pelvis',
                 'torso', 'neck', 'capeDrape', 'fUpper', 'fFore', 'fHand', 'fPad', 'head', 'nUpper', 'nFore', 'nPad'],
    },
}
(DIR / 'rig.json').write_text(json.dumps(rig, indent=2, ensure_ascii=False) + '\n')
print('Parties écrites :', len(files) + 2)

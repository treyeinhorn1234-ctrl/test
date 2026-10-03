"""Collisions des salles sous forme de boîtes (Parts) pour Roblox.

Un maillage creux comme une pièce entière se décompose mal en enveloppes convexes
dans Roblox (murs traversables, portes bouchées). On regroupe donc les triangles
par plan, on les rastérise sur une grille fine dans ce plan, puis on fusionne les
cellules pleines en rectangles. Chaque rectangle devient une boîte fine centrée
sur le plan. Les ouvertures (portes, couloirs) restent ouvertes.
"""

from __future__ import annotations

import math

Vec = tuple[float, float, float]

RESOLUTION = 0.5  # taille d'une cellule de grille, en studs
THICKNESS = 0.5  # épaisseur des boîtes, en studs
MIN_PLANE_AREA = 2.0  # studs² : on ignore les petits détails (vis, poignées…)
PLANE_MERGE = 0.25  # studs : les plans parallèles plus proches que ça sont fusionnés
AXIS_SNAP = 0.999


def _sub(a: Vec, b: Vec) -> Vec:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _dot(a: Vec, b: Vec) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a: Vec, b: Vec) -> Vec:
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _norm(a: Vec) -> float:
    return math.sqrt(_dot(a, a))


def _basis(n: Vec) -> tuple[Vec, Vec, Vec]:
    """Repère (u, v, n) du plan. Pour un plan aligné sur les axes, u et v sont des axes du monde."""
    ax = max(range(3), key=lambda i: abs(n[i]))
    if abs(n[ax]) >= AXIS_SNAP:
        # u × v = n, pour que le CFrame soit une vraie rotation
        if ax == 1:  # sol ou plafond
            return (0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)
        if ax == 0:
            return (0.0, 1.0, 0.0), (0.0, 0.0, 1.0), (1.0, 0.0, 0.0)
        return (1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)
    up = (0.0, 1.0, 0.0) if abs(n[1]) < 0.9 else (1.0, 0.0, 0.0)
    u = _cross(up, n)
    lu = _norm(u)
    u = (u[0] / lu, u[1] / lu, u[2] / lu)
    v = _cross(n, u)
    return u, v, n


def _plane_key(n: Vec, d: float) -> tuple:
    # Normale « canonique » (on ignore le sens : les collisions sont des deux côtés)
    ax = max(range(3), key=lambda i: abs(n[i]))
    if n[ax] < 0:
        n, d = (-n[0], -n[1], -n[2]), -d
    if abs(n[ax]) >= AXIS_SNAP:
        n = tuple(1.0 if i == ax else 0.0 for i in range(3))  # type: ignore[assignment]
        return ("axis", ax, round(d / PLANE_MERGE)), n
    return ("plane", round(n[0] * 20), round(n[1] * 20), round(n[2] * 20), round(d / PLANE_MERGE)), n


def _rasterize(tris2d: list, res: float) -> set[tuple[int, int]]:
    cells: set[tuple[int, int]] = set()
    eps = 0.3 * res
    for (ax, ay), (bx, by), (cx, cy) in tris2d:
        det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(det) < 1e-9:
            continue
        # Agrandit légèrement le triangle pour ne pas perdre les bords fins
        i0 = math.floor((min(ax, bx, cx) - eps) / res)
        i1 = math.floor((max(ax, bx, cx) + eps) / res)
        j0 = math.floor((min(ay, by, cy) - eps) / res)
        j1 = math.floor((max(ay, by, cy) + eps) / res)
        edges = []
        for (px, py), (qx, qy) in (((ax, ay), (bx, by)), ((bx, by), (cx, cy)), ((cx, cy), (ax, ay))):
            ex, ey = qx - px, qy - py
            length = math.hypot(ex, ey) or 1.0
            sign = 1.0 if det > 0 else -1.0
            edges.append((px, py, ex * sign, ey * sign, length))
        for i in range(i0, i1 + 1):
            x = (i + 0.5) * res
            for j in range(j0, j1 + 1):
                y = (j + 0.5) * res
                inside = True
                for px, py, ex, ey, length in edges:
                    # distance signée au bord (positive à l'intérieur)
                    if (ex * (y - py) - ey * (x - px)) / length < -eps:
                        inside = False
                        break
                if inside:
                    cells.add((i, j))
    return cells


def _rectangles(cells: set[tuple[int, int]]) -> list[tuple[int, int, int, int]]:
    """Fusion gloutonne des cellules en rectangles (i, j, largeur, hauteur)."""
    left = set(cells)
    rects = []
    for i, j in sorted(cells, key=lambda c: (c[1], c[0])):
        if (i, j) not in left:
            continue
        w = 1
        while (i + w, j) in left:
            w += 1
        h = 1
        while all((i + k, j + h) in left for k in range(w)):
            h += 1
        for dj in range(h):
            for di in range(w):
                left.discard((i + di, j + dj))
        rects.append((i, j, w, h))
    return rects


def build_colliders(triangles: list[tuple[Vec, Vec, Vec]], res: float = RESOLUTION,
                    thickness: float = THICKNESS) -> list[dict]:
    """triangles : en studs, repère Roblox.

    Retourne des boîtes {position, size} alignées sur les axes, ou {position, size, rotation}.
    """
    planes: dict[tuple, dict] = {}
    for a, b, c in triangles:
        n = _cross(_sub(b, a), _sub(c, a))
        ln = _norm(n)
        if ln < 1e-6:
            continue
        n = (n[0] / ln, n[1] / ln, n[2] / ln)
        key, canon = _plane_key(n, _dot(n, a))
        group = planes.setdefault(key, {"normal": canon, "tris": [], "area": 0.0, "d": []})
        group["tris"].append((a, b, c))
        group["area"] += ln / 2
        group["d"].append(_dot(canon, a))

    boxes = []
    for group in planes.values():
        if group["area"] < MIN_PLANE_AREA:
            continue
        u, v, n = _basis(group["normal"])
        d = sum(group["d"]) / len(group["d"])
        tris2d = [tuple((_dot(p, u), _dot(p, v)) for p in tri) for tri in group["tris"]]
        aligned = all(abs(c) in (0.0, 1.0) for c in (*u, *v, *n))
        for i, j, w, h in _rectangles(_rasterize(tris2d, res)):
            cu = (i + w / 2) * res
            cv = (j + h / 2) * res
            pos = [round(u[k] * cu + v[k] * cv + n[k] * d, 3) for k in range(3)]
            size = (w * res, h * res, thickness)
            if aligned:
                # Boîte alignée sur les axes du monde : pas besoin de rotation
                world = [abs(u[k]) * size[0] + abs(v[k]) * size[1] + abs(n[k]) * size[2] for k in range(3)]
                boxes.append({"position": pos, "size": [round(x, 3) for x in world]})
            else:
                boxes.append({
                    "position": pos,
                    "size": [round(x, 3) for x in size],
                    # Colonnes de la matrice : axes u, v, n (ordre R00…R22 d'un CFrame)
                    "rotation": [round(x, 5) for x in (u[0], v[0], n[0], u[1], v[1], n[1], u[2], v[2], n[2])],
                })
    return boxes

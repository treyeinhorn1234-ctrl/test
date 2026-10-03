"""Écriture des modèles convertis en OBJ/MTL pour l'importateur 3D de Roblox Studio.

Passage du repère Blitz3D (main gauche) au repère Roblox (main droite) : on inverse Z.
Dans les fichiers du jeu, la face avant d'un triangle est dans le sens trigonométrique
vue en main gauche ; après la symétrie elle passerait en sens horaire. On inverse donc
l'ordre des indices pour garder des faces avant dans le sens trigonométrique (OBJ, Roblox).
"""

from __future__ import annotations

import math
import os
import shutil

from .model import Mat4, Model, Part

# Roblox refuse les MeshParts de plus de 20 000 triangles ; on garde une marge.
MAX_TRIANGLES = 18000


def to_roblox(p, scale: float) -> tuple[float, float, float]:
    return (p[0] * scale, p[1] * scale, -p[2] * scale)


def rotation_to_roblox(m: Mat4) -> list[float]:
    """Matrice 3x3 Blitz3D (vecteur-ligne, main gauche) → composantes R00..R22 d'un CFrame Roblox."""
    flip = (1.0, 1.0, -1.0)
    # R_rh = F · R_lh · F, puis transposition pour passer en vecteur-colonne
    return [m[j][i] * flip[i] * flip[j] for i in range(3) for j in range(3)]


def _normals(positions, triangles):
    acc = [[0.0, 0.0, 0.0] for _ in positions]
    for a, b, c in triangles:
        pa, pb, pc = positions[a], positions[b], positions[c]
        u = [pb[i] - pa[i] for i in range(3)]
        v = [pc[i] - pa[i] for i in range(3)]
        # Repère main droite, triangles dans le sens trigonométrique
        n = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
        for i in (a, b, c):
            for k in range(3):
                acc[i][k] += n[k]
    out = []
    for n in acc:
        length = math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) or 1.0
        out.append((n[0] / length, n[1] / length, n[2] / length))
    return out


def _split(part: Part) -> list[Part]:
    """Découpe une partie trop lourde pour Roblox en plusieurs morceaux."""
    if len(part.triangles) <= MAX_TRIANGLES:
        return [part]
    pieces = []
    for start in range(0, len(part.triangles), MAX_TRIANGLES):
        tris = part.triangles[start:start + MAX_TRIANGLES]
        used = sorted({i for t in tris for i in t})
        remap = {old: new for new, old in enumerate(used)}
        piece = Part(part.texture, alpha=part.alpha)
        piece.extend(
            [part.positions[i] for i in used],
            [part.uvs[i] for i in used],
            [(remap[a], remap[b], remap[c]) for a, b, c in tris],
        )
        pieces.append(piece)
    return pieces


def _material_name(texture: str | None, alpha: bool) -> str:
    base = os.path.splitext(texture)[0] if texture else "blanc"
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in base)
    return safe + ("_alpha" if alpha else "")


def write_obj(
    model: Model,
    path: str,
    scale: float,
    textures: "TextureStore | None" = None,
    texture_near: str | None = None,
) -> dict:
    """Écrit `path` (.obj) et son .mtl. Retourne des statistiques et la boîte englobante (en studs)."""
    base = os.path.splitext(path)[0]
    name = os.path.basename(base)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)

    objects: list[tuple[str, Part]] = []
    counters: dict[str, int] = {}
    for part in model.parts:
        if not part.triangles:
            continue
        for piece in _split(part):
            mat = _material_name(piece.texture, piece.alpha)
            counters[mat] = counters.get(mat, 0) + 1
            suffix = f"_{counters[mat]}" if counters[mat] > 1 else ""
            objects.append((f"{mat}{suffix}", piece))

    lo = [math.inf] * 3
    hi = [-math.inf] * 3
    materials: dict[str, str | None] = {}
    tri_count = 0
    # Centre et taille de chaque objet (= chaque MeshPart dans Roblox), pour que Studio
    # puisse retrouver comment l'importateur a placé le modèle
    parts: dict[str, list[float]] = {}
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(f"# Converti depuis SCP - Containment Breach (CC BY-SA 3.0)\nmtllib {name}.mtl\n")
        v_off = 1
        for obj_name, part in objects:
            pts = [to_roblox(p, scale) for p in part.positions]
            tris = [(a, c, b) for a, b, c in part.triangles]
            for p in pts:
                for i in range(3):
                    lo[i] = min(lo[i], p[i])
                    hi[i] = max(hi[i], p[i])
            plo = [min(p[i] for p in pts) for i in range(3)]
            phi = [max(p[i] for p in pts) for i in range(3)]
            parts[obj_name] = [round((plo[i] + phi[i]) / 2, 3) for i in range(3)] + \
                [round(phi[i] - plo[i], 3) for i in range(3)]
            normals = _normals(pts, tris)
            mat = _material_name(part.texture, part.alpha)
            materials[mat] = part.texture
            # L'importateur de Roblox découpe le fichier selon les groupes « g » (pas les objets « o »)
            f.write(f"o {obj_name}\ng {obj_name}\n")
            f.writelines(f"v {x:.5f} {y:.5f} {z:.5f}\n" for x, y, z in pts)
            f.writelines(f"vt {u:.5f} {1.0 - v:.5f}\n" for u, v in part.uvs)
            f.writelines(f"vn {x:.4f} {y:.4f} {z:.4f}\n" for x, y, z in normals)
            f.write(f"usemtl {mat}\n")
            for a, b, c in tris:
                a, b, c = a + v_off, b + v_off, c + v_off
                f.write(f"f {a}/{a}/{a} {b}/{b}/{b} {c}/{c}/{c}\n")
            v_off += len(pts)
            tri_count += len(part.triangles)

    with open(base + ".mtl", "w", encoding="utf-8", newline="\n") as f:
        for mat, texture in materials.items():
            f.write(f"newmtl {mat}\nKd 1.000 1.000 1.000\n")
            if texture and textures is not None:
                copied = textures.copy(texture, os.path.dirname(path), texture_near)
                if copied:
                    f.write(f"map_Kd {copied}\n")
            f.write("\n")

    if tri_count == 0:
        lo = hi = [0.0, 0.0, 0.0]
    return {"triangles": tri_count, "objects": len(objects), "min": lo, "max": hi, "parts": parts}


class TextureStore:
    """Retrouve les textures du jeu sans tenir compte de la casse (le jeu vient de Windows)."""

    def __init__(self, game_dir: str, search_dirs: list[str]):
        self.game_dir = game_dir
        self.search_dirs = search_dirs
        self.index: dict[str, dict[str, str]] = {}
        self.missing: set[str] = set()

    def _dir_index(self, d: str) -> dict[str, str]:
        if d not in self.index:
            try:
                self.index[d] = {n.lower(): n for n in os.listdir(d)}
            except FileNotFoundError:
                self.index[d] = {}
        return self.index[d]

    def find(self, name: str, near: str | None = None) -> str | None:
        name = os.path.basename(name.replace("\\", "/"))
        dirs = ([near] if near else []) + self.search_dirs
        for d in dirs:
            real = self._dir_index(d).get(name.lower())
            if real:
                return os.path.join(d, real)
        return None

    def copy(self, name: str, dest_dir: str, near: str | None = None) -> str | None:
        src = self.find(name, near)
        if src is None:
            self.missing.add(name)
            return None
        tex_dir = os.path.join(dest_dir, "textures")
        os.makedirs(tex_dir, exist_ok=True)
        dest = os.path.join(tex_dir, os.path.basename(src))
        if not os.path.exists(dest):
            shutil.copyfile(src, dest)
        return "textures/" + os.path.basename(src)

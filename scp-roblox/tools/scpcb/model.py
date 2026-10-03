"""Représentation commune des modèles convertis, et mathématiques de base.

Toutes les coordonnées restent dans le repère de Blitz3D (main gauche, Y vers le haut)
jusqu'à l'écriture du fichier : c'est l'exportateur qui fait le passage en main droite.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

Vec3 = tuple[float, float, float]
Mat4 = list[list[float]]  # 4x4, convention vecteur-ligne (p' = p * M), comme DirectX/Blitz3D


@dataclass
class Part:
    """Un morceau de maillage avec une seule texture (= une MeshPart dans Roblox)."""

    texture: str | None
    positions: list[Vec3] = field(default_factory=list)
    uvs: list[tuple[float, float]] = field(default_factory=list)
    triangles: list[tuple[int, int, int]] = field(default_factory=list)
    alpha: bool = False

    def extend(self, positions, uvs, triangles) -> None:
        base = len(self.positions)
        self.positions.extend(positions)
        self.uvs.extend(uvs)
        self.triangles.extend((a + base, b + base, c + base) for a, b, c in triangles)


@dataclass
class Model:
    parts: list[Part] = field(default_factory=list)

    def part_for(self, texture: str | None, alpha: bool = False) -> Part:
        for p in self.parts:
            if p.texture == texture and p.alpha == alpha:
                return p
        p = Part(texture, alpha=alpha)
        self.parts.append(p)
        return p

    def bounds(self) -> tuple[Vec3, Vec3]:
        pts = [v for p in self.parts for v in p.positions]
        if not pts:
            return (0.0, 0.0, 0.0), (0.0, 0.0, 0.0)
        lo = tuple(min(v[i] for v in pts) for i in range(3))
        hi = tuple(max(v[i] for v in pts) for i in range(3))
        return lo, hi  # type: ignore[return-value]


def identity() -> Mat4:
    return [[1.0 if i == j else 0.0 for j in range(4)] for i in range(4)]


def matmul(a: Mat4, b: Mat4) -> Mat4:
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def transform_point(p: Vec3, m: Mat4) -> Vec3:
    x, y, z = p
    return (
        x * m[0][0] + y * m[1][0] + z * m[2][0] + m[3][0],
        x * m[0][1] + y * m[1][1] + z * m[2][1] + m[3][1],
        x * m[0][2] + y * m[1][2] + z * m[2][2] + m[3][2],
    )


def trs(position: Vec3, rotation: Mat4, scale: Vec3) -> Mat4:
    """Échelle, puis rotation, puis translation (vecteur-ligne)."""
    s = identity()
    s[0][0], s[1][1], s[2][2] = scale
    m = matmul(s, rotation)
    m[3][0], m[3][1], m[3][2] = position
    return m


def quat_matrix(w: float, x: float, y: float, z: float) -> Mat4:
    """Matrice de rotation (vecteur-ligne) d'un quaternion unitaire."""
    n = math.sqrt(w * w + x * x + y * y + z * z) or 1.0
    w, x, y, z = w / n, x / n, y / n, z / n
    # Matrice colonne standard, transposée pour la convention vecteur-ligne
    c = [
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ]
    m = identity()
    for i in range(3):
        for j in range(3):
            m[i][j] = c[j][i]
    return m


def euler_matrix(pitch: float, yaw: float, roll: float) -> Mat4:
    """RotateEntity de Blitz3D : roulis (Z), puis tangage (X), puis lacet (Y), en degrés.

    Lacet positif = tourne à gauche ; tangage positif = regarde vers le bas.
    """
    p, y, r = (math.radians(a) for a in (pitch, yaw, roll))
    rz = identity()
    rz[0][0], rz[0][1], rz[1][0], rz[1][1] = math.cos(r), math.sin(r), -math.sin(r), math.cos(r)
    rx = identity()
    rx[1][1], rx[1][2], rx[2][1], rx[2][2] = math.cos(p), math.sin(p), -math.sin(p), math.cos(p)
    ry = identity()
    ry[0][0], ry[0][2], ry[2][0], ry[2][2] = math.cos(y), math.sin(y), -math.sin(y), math.cos(y)
    return matmul(matmul(rz, rx), ry)

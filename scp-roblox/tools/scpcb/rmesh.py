"""Lecteur des salles .rmesh de SCP - Containment Breach.

Format reconstitué à partir de LoadRMesh() dans MapSystem.bb (scpcb, Regalis11).
Les chaînes Blitz3D sont un int32 (longueur) suivi des octets ; tout est little-endian.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .binreader import BinReader


@dataclass
class RMeshSurface:
    # (flag, nom) pour les deux couches de texture ; flag 3 = transparence
    textures: list[tuple[int, str] | None]
    positions: list[tuple[float, float, float]]
    uv0: list[tuple[float, float]]
    uv1: list[tuple[float, float]]
    colors: list[tuple[int, int, int]]
    triangles: list[tuple[int, int, int]]

    @property
    def is_alpha(self) -> bool:
        return any(t is not None and t[0] == 3 for t in self.textures)

    def _diffuse_layer(self) -> int | None:
        """Couche de couleur (hors lightmap). On préfère la couche 1, comme le jeu."""
        for layer in (1, 0):
            t = self.textures[layer]
            if t is not None and "_lm" not in t[1].lower():
                return layer
        return None

    @property
    def diffuse(self) -> str | None:
        layer = self._diffuse_layer()
        return None if layer is None else self.textures[layer][1]

    @property
    def diffuse_uvs(self) -> list[tuple[float, float]]:
        # TextureCoords tex[j], 1-j : la couche j lit le jeu d'UV 1-j
        return self.uv1 if self._diffuse_layer() == 0 else self.uv0


@dataclass
class RMeshCollision:
    positions: list[tuple[float, float, float]]
    triangles: list[tuple[int, int, int]]


@dataclass
class RMesh:
    surfaces: list[RMeshSurface] = field(default_factory=list)
    collision: list[RMeshCollision] = field(default_factory=list)
    trigger_boxes: list[dict] = field(default_factory=list)
    entities: list[dict] = field(default_factory=list)


def _read_geometry(r: BinReader) -> RMeshCollision:
    positions = [r.vec3() for _ in range(r.int())]
    triangles = [(r.int(), r.int(), r.int()) for _ in range(r.int())]
    return RMeshCollision(positions, triangles)


def _floats(s: str) -> list[float]:
    return [float(p) for p in s.split()]


def load_rmesh(path: str) -> RMesh:
    with open(path, "rb") as fh:
        r = BinReader(fh.read())

    header = r.string()
    if header not in ("RoomMesh", "RoomMesh.HasTriggerBox"):
        raise ValueError(f"{path} n'est pas un RMESH ({header!r})")
    has_trigger_box = header == "RoomMesh.HasTriggerBox"

    mesh = RMesh()

    for _ in range(r.int()):
        textures: list[tuple[int, str] | None] = []
        for _layer in range(2):
            flag = r.byte()
            textures.append((flag, r.string()) if flag != 0 else None)
        positions, uv0, uv1, colors = [], [], [], []
        for _ in range(r.int()):
            positions.append(r.vec3())
            uv0.append((r.float(), r.float()))
            uv1.append((r.float(), r.float()))
            colors.append((r.byte(), r.byte(), r.byte()))
        triangles = [(r.int(), r.int(), r.int()) for _ in range(r.int())]
        mesh.surfaces.append(RMeshSurface(textures, positions, uv0, uv1, colors, triangles))

    for _ in range(r.int()):
        mesh.collision.append(_read_geometry(r))

    if has_trigger_box:
        for _ in range(r.int()):
            parts = [_read_geometry(r) for _ in range(r.int())]
            mesh.trigger_boxes.append({"name": r.string(), "parts": parts})

    for _ in range(r.int()):
        kind = r.string()
        e: dict = {"type": kind}
        if kind == "screen":
            e["position"] = r.vec3()
            e["image"] = r.string()
        elif kind == "waypoint":
            e["position"] = r.vec3()
        elif kind == "light":
            e["position"] = r.vec3()
            e["range"] = r.float()
            e["color"] = _floats(r.string())
            e["intensity"] = r.float()
        elif kind == "spotlight":
            e["position"] = r.vec3()
            e["range"] = r.float()
            e["color"] = _floats(r.string())
            e["intensity"] = r.float()
            e["angles"] = _floats(r.string())
            e["inner_cone"] = r.int()
            e["outer_cone"] = r.int()
        elif kind == "soundemitter":
            e["position"] = r.vec3()
            e["sound"] = r.int()
            e["range"] = r.float()
        elif kind == "playerstart":
            e["position"] = r.vec3()
            e["angles"] = _floats(r.string())
        elif kind == "model":
            e["file"] = r.string()
            e["position"] = r.vec3()
            if e["file"]:
                e["rotation"] = r.vec3()
                e["scale"] = r.vec3()
        else:
            raise ValueError(f"{path} : entité inconnue {kind!r} à l'octet {r.pos}")
        mesh.entities.append(e)

    return mesh

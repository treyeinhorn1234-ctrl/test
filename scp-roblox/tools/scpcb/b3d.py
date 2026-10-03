"""Lecteur des modèles .b3d (format natif de Blitz3D).

Exporte la géométrie statique en pose de repos ; les os et les animations
(BONE, KEYS, ANIM) sont ignorés pour l'instant.
"""

from __future__ import annotations

import os

from .binreader import BinReader
from .model import Mat4, Model, identity, matmul, quat_matrix, transform_point, trs


def _chunks(r: BinReader, end: int):
    while r.pos + 8 <= end:
        tag = r.raw(4).decode("latin-1")
        size = r.int()
        start = r.pos
        yield tag, start, start + size
        r.pos = start + size


def load_b3d(path: str) -> Model:
    with open(path, "rb") as fh:
        r = BinReader(fh.read())

    tag = r.raw(4)
    if tag != b"BB3D":
        raise ValueError(f"{path} n'est pas un B3D")
    end = 8 + r.int()
    r.int()  # version

    textures: list[str] = []
    brushes: list[dict] = []
    model = Model()

    def read_mesh(start: int, stop: int, world: Mat4) -> None:
        r.pos = start
        mesh_brush = r.int()
        positions: list = []
        uvs: list = []
        for tag, cstart, cend in _chunks(r, stop):
            r.pos = cstart
            if tag == "VRTS":
                flags, sets, size = r.int(), r.int(), r.int()
                stride = 3 + (3 if flags & 1 else 0) + (4 if flags & 2 else 0) + sets * size
                count = (cend - cstart - 12) // (stride * 4)
                for _ in range(count):
                    pos = r.vec3()
                    if flags & 1:
                        r.vec3()
                    if flags & 2:
                        r.vec4()
                    coords = [r.float() for _ in range(sets * size)]
                    positions.append(transform_point(pos, world))
                    uvs.append((coords[0], coords[1]) if sets and size >= 2 else (0.0, 0.0))
            elif tag == "TRIS":
                brush = r.int()
                if brush < 0:
                    brush = mesh_brush
                tris = []
                while r.pos + 12 <= cend:
                    tris.append((r.int(), r.int(), r.int()))
                tex, alpha = None, False
                if 0 <= brush < len(brushes):
                    b = brushes[brush]
                    alpha = b["alpha"] < 1.0 or b["blend"] == 3
                    for t in b["textures"]:
                        if 0 <= t < len(textures):
                            tex = textures[t]
                            break
                used = sorted({i for tri in tris for i in tri})
                remap = {old: new for new, old in enumerate(used)}
                model.part_for(tex, alpha).extend(
                    [positions[i] for i in used],
                    [uvs[i] for i in used],
                    [(remap[a], remap[b], remap[c]) for a, b, c in tris],
                )

    def read_node(start: int, stop: int, parent: Mat4) -> None:
        r.pos = start
        r.cstring()  # nom
        pos = r.vec3()
        scale = r.vec3()
        w, x, y, z = r.vec4()
        # Les quaternions B3D sont conjugués par rapport à la convention usuelle
        world = matmul(trs(pos, quat_matrix(w, -x, -y, -z), scale), parent)
        for tag, cstart, cend in _chunks(r, stop):
            if tag == "MESH":
                read_mesh(cstart, cend, world)
            elif tag == "NODE":
                read_node(cstart, cend, world)

    for tag, start, stop in _chunks(r, end):
        r.pos = start
        if tag == "TEXS":
            while r.pos < stop:
                textures.append(os.path.basename(r.cstring().replace("\\", "/")))
                r.int(), r.int()  # flags, blend
                r.vec2(), r.vec2(), r.float()  # position, échelle, rotation
        elif tag == "BRUS":
            n = r.int()
            while r.pos < stop:
                r.cstring()
                color = r.vec4()
                r.float()  # brillance
                blend, _fx = r.int(), r.int()
                brushes.append({"alpha": color[3], "blend": blend, "textures": [r.int() for _ in range(n)]})
        elif tag == "NODE":
            read_node(start, stop, identity())

    return model

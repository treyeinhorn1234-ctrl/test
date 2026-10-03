"""Lecteur des modèles DirectX .x au format texte (« xof 0302txt » / « xof 0303txt »).

Seuls Frame, FrameTransformMatrix, Mesh, MeshTextureCoords, MeshMaterialList,
Material et TextureFilename sont interprétés ; le reste est ignoré.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field

from .model import Mat4, Model, identity, matmul, transform_point

_TOKEN = re.compile(r'"[^"]*"|<[^>]*>|[{};,]|[^\s{};,"<]+')


@dataclass
class XNode:
    kind: str
    name: str | None = None
    values: list = field(default_factory=list)  # nombres et chaînes, dans l'ordre
    children: list["XNode"] = field(default_factory=list)
    ref: str | None = None  # bloc « { Nom } » qui référence un objet existant


def _parse(text: str) -> list[XNode]:
    text = re.sub(r"(//|#)[^\n]*", "", text)
    tokens = _TOKEN.findall(text)
    pos = 0

    def number(tok: str):
        try:
            return int(tok)
        except ValueError:
            return float(tok)

    def block(kind: str, name: str | None) -> XNode:
        nonlocal pos
        node = XNode(kind, name)
        while pos < len(tokens):
            tok = tokens[pos]
            pos += 1
            if tok == "}":
                return node
            if tok in (";", ","):
                continue
            if tok.startswith("<"):
                continue  # GUID
            if tok.startswith('"'):
                node.values.append(tok[1:-1])
                continue
            if tok == "{":
                # référence anonyme : « { Nom } »
                ref = tokens[pos]
                pos += 2
                node.children.append(XNode("ref", ref=ref))
                continue
            if re.match(r"^[-+]?(\d|\.\d)", tok):
                node.values.append(number(tok))
                continue
            # nouvel objet : Type [Nom] {
            if tokens[pos] == "{":
                pos += 1
                node.children.append(block(tok, None))
            else:
                name = tokens[pos]
                pos += 2
                node.children.append(block(tok, name))
        return node

    roots: list[XNode] = []
    while pos < len(tokens):
        tok = tokens[pos]
        if tok in ("}", ";", ",") or pos + 1 >= len(tokens):
            pos += 1  # certains fichiers du jeu ont une accolade fermante en trop
            continue
        if tok == "template":
            depth = 0
            while True:
                pos += 1
                if tokens[pos] == "{":
                    depth += 1
                elif tokens[pos] == "}":
                    depth -= 1
                    if depth == 0:
                        pos += 1
                        break
            continue
        if tokens[pos + 1] == "{":
            pos += 2
            roots.append(block(tok, None))
        else:
            name = tokens[pos + 1]
            pos += 3
            roots.append(block(tok, name))
    return roots


def _material_texture(node: XNode) -> tuple[str | None, bool]:
    tex = None
    for c in node.children:
        if c.kind == "TextureFilename" and c.values:
            tex = os.path.basename(str(c.values[0]).replace("\\", "/"))
    alpha = len(node.values) >= 4 and isinstance(node.values[3], float) and node.values[3] < 1.0
    return tex, alpha


def load_x(path: str) -> Model:
    with open(path, "rb") as fh:
        head = fh.read(16)
        if b"txt" not in head[8:12]:
            raise ValueError(f"{path} : seul le format .x texte est géré ({head[:16]!r})")
        text = fh.read().decode("latin-1")

    roots = _parse(text)
    named_materials = {n.name: _material_texture(n) for n in roots if n.kind == "Material" and n.name}
    model = Model()

    def read_mesh(node: XNode, world: Mat4) -> None:
        v = node.values
        nverts = int(v[0])
        positions = [transform_point(tuple(v[1 + 3 * i:4 + 3 * i]), world) for i in range(nverts)]
        i = 1 + 3 * nverts
        nfaces = int(v[i])
        i += 1
        faces = []
        for _ in range(nfaces):
            n = int(v[i])
            faces.append([int(x) for x in v[i + 1:i + 1 + n]])
            i += 1 + n

        uvs = [(0.0, 0.0)] * nverts
        face_material = [0] * nfaces
        materials: list[tuple[str | None, bool]] = [(None, False)]
        for c in node.children:
            if c.kind == "MeshTextureCoords":
                n = int(c.values[0])
                uvs = [(float(c.values[1 + 2 * k]), float(c.values[2 + 2 * k])) for k in range(n)]
            elif c.kind == "MeshMaterialList":
                nmat, nidx = int(c.values[0]), int(c.values[1])
                idx = [int(x) for x in c.values[2:2 + nidx]]
                face_material = [idx[k] if k < len(idx) else idx[-1] for k in range(nfaces)] if idx else face_material
                materials = []
                for m in c.children:
                    if m.kind == "Material":
                        materials.append(_material_texture(m))
                    elif m.kind == "ref":
                        materials.append(named_materials.get(m.ref, (None, False)))
                materials += [(None, False)] * (nmat - len(materials))

        groups: dict[int, list[tuple[int, int, int]]] = {}
        for f, face in enumerate(faces):
            tris = groups.setdefault(face_material[f], [])
            for k in range(1, len(face) - 1):
                tris.append((face[0], face[k], face[k + 1]))
        for mat, tris in groups.items():
            used = sorted({i for t in tris for i in t})
            remap = {old: new for new, old in enumerate(used)}
            tex, alpha = materials[mat] if mat < len(materials) else (None, False)
            model.part_for(tex, alpha).extend(
                [positions[k] for k in used],
                [uvs[k] for k in used],
                [(remap[a], remap[b], remap[c]) for a, b, c in tris],
            )

    def walk(node: XNode, parent: Mat4) -> None:
        world = parent
        for c in node.children:
            if c.kind == "FrameTransformMatrix":
                m = [float(x) for x in c.values[:16]]
                local = [m[0:4], m[4:8], m[8:12], m[12:16]]
                world = matmul(local, parent)
        for c in node.children:
            if c.kind == "Mesh":
                read_mesh(c, world)
            elif c.kind == "Frame":
                walk(c, world)

    for root in roots:
        if root.kind == "Mesh":
            read_mesh(root, identity())
        elif root.kind == "Frame":
            walk(root, identity())
    return model

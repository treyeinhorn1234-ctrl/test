"""Écriture des données converties sous forme de module Luau."""

from __future__ import annotations

import os
import re

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _num(v: float) -> str:
    if float(v).is_integer():
        return str(int(v))
    return repr(round(float(v), 5))


def to_luau(value, indent: int = 0) -> str:
    pad = "\t" * indent
    if value is None:
        return "nil"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return _num(value)
    if isinstance(value, str):
        return '"' + value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n") + '"'
    if isinstance(value, (list, tuple)):
        if not value:
            return "{}"
        if all(isinstance(v, (int, float, str)) for v in value):
            return "{ " + ", ".join(to_luau(v) for v in value) + " }"
        inner = ",\n".join(pad + "\t" + to_luau(v, indent + 1) for v in value)
        return "{\n" + inner + ",\n" + pad + "}"
    if isinstance(value, dict):
        if not value:
            return "{}"
        items = []
        for k, v in value.items():
            key = k if _IDENT.match(k) else "[" + to_luau(k) + "]"
            items.append(f"{pad}\t{key} = {to_luau(v, indent + 1)}")
        return "{\n" + ",\n".join(items) + ",\n" + pad + "}"
    raise TypeError(f"type non géré : {type(value)}")


# Studio supporte mal les scripts géants : on découpe les données en modules plus petits.
MAX_MODULE_CHARS = 100_000

_HEADER = "--!nocheck\n-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.\n"


def _write(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def _clear_dir(path: str) -> None:
    """Supprime les anciens fichiers générés pour ne pas laisser de salles fantômes."""
    if not os.path.isdir(path):
        return
    for root, dirs, files in os.walk(path, topdown=False):
        for f in files:
            if f.endswith(".luau"):
                os.remove(os.path.join(root, f))
        for d in dirs:
            try:
                os.rmdir(os.path.join(root, d))
            except OSError:
                pass


def write_room_templates(folder: str, rooms: list[dict], ambience: list[str], props: dict, scale: float) -> None:
    """RoomTemplates/init.luau (données communes) + RoomTemplates/Rooms/<salle>.luau (une par salle)."""
    _clear_dir(folder)
    common = {
        "scale": scale,
        "ambience": ambience,
        "props": {k: {"boundsMin": [round(x, 4) for x in v["min"]], "boundsMax": [round(x, 4) for x in v["max"]]}
                  for k, v in sorted(props.items())},
    }
    _write(os.path.join(folder, "init.luau"),
           _HEADER
           + "-- Données extraites de SCP - Containment Breach (Regalis11/scpcb), CC BY-SA 3.0.\n"
           + "-- Positions en studs, dans le repère local de chaque salle (main droite, Y vers le haut).\n\n"
           + "local data = " + to_luau(common) + "\n\n"
           + "data.rooms = {}\n"
           + "for _, module in script.Rooms:GetChildren() do\n"
           + "\tlocal room = require(module)\n"
           + "\tdata.rooms[room.name] = room\n"
           + "end\n\n"
           + "return data\n")
    for r in rooms:
        _write(os.path.join(folder, "Rooms", f"{r['asset']}.luau"), _HEADER + "\nreturn " + to_luau(r) + "\n")


def write_room_colliders(folder: str, room: str, boxes: list[dict]) -> None:
    """Collisions d'une salle : RoomColliders/<salle>/<n>.luau, chacun en tableaux plats
    aligned = { x, y, z, sx, sy, sz, ... } et rotated = { x, y, z, sx, sy, sz, R00 … R22, ... }."""
    _clear_dir(folder)

    def flat(values: list[float]) -> str:
        return "{" + ",".join(_num(v) for v in values) + "}"

    chunks: list[tuple[list[str], list[str]]] = [([], [])]
    size = 0
    for b in boxes:
        if "rotation" in b:
            text, kind = ",".join(_num(v) for v in b["position"] + b["size"] + b["rotation"]), 1
        else:
            text, kind = ",".join(_num(v) for v in b["position"] + b["size"]), 0
        if size + len(text) > MAX_MODULE_CHARS:
            chunks.append(([], []))
            size = 0
        chunks[-1][kind].append(text)
        size += len(text) + 1

    for i, (aligned, rotated) in enumerate(chunks, 1):
        _write(os.path.join(folder, f"{i}.luau"),
               _HEADER
               + f"-- Collisions de la salle {room}, partie {i}/{len(chunks)}.\n"
               + "-- aligned : x, y, z, sx, sy, sz ; rotated : x, y, z, sx, sy, sz, R00…R22 (studs, repère de la salle).\n"
               + "return {\n\taligned = {" + ",".join(aligned) + "},\n\trotated = {" + ",".join(rotated) + "},\n}\n")


def write_manifest(src_dir: str, path: str) -> None:
    """Liste des fichiers .luau du projet, lue par l'installateur Studio (tools/studio/Install.luau)."""
    files = []
    for root, _dirs, names in os.walk(src_dir):
        for n in names:
            if n.endswith(".luau"):
                files.append(os.path.relpath(os.path.join(root, n), os.path.dirname(src_dir)).replace(os.sep, "/"))
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(sorted(files)) + "\n")

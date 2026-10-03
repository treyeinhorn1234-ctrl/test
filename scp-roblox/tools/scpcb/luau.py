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


def write_room_templates(path: str, rooms: list[dict], ambience: list[str], props: dict, scale: float) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = {
        "scale": scale,
        "ambience": ambience,
        "props": {k: {"boundsMin": [round(x, 4) for x in v["min"]], "boundsMax": [round(x, 4) for x in v["max"]]}
                  for k, v in sorted(props.items())},
        "rooms": {r["name"]: r for r in rooms},
    }
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("--!nocheck\n")
        fh.write("-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.\n")
        fh.write("-- Données extraites de SCP - Containment Breach (Regalis11/scpcb), CC BY-SA 3.0.\n")
        fh.write("-- Positions en studs, dans le repère local de chaque salle (main droite, Y vers le haut).\n\n")
        fh.write("return " + to_luau(data) + "\n")


def write_room_colliders(path: str, room: str, boxes: list[dict]) -> None:
    """Un module par salle, en tableaux plats pour rester compact :
    aligned = { x, y, z, sx, sy, sz, ... }, rotated = { x, y, z, sx, sy, sz, R00 … R22, ... }."""
    aligned: list[float] = []
    rotated: list[float] = []
    for b in boxes:
        if "rotation" in b:
            rotated += b["position"] + b["size"] + b["rotation"]
        else:
            aligned += b["position"] + b["size"]

    def flat(values: list[float]) -> str:
        return "{" + ",".join(_num(v) for v in values) + "}"

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("--!nocheck\n")
        fh.write(f"-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : collisions de la salle {room}.\n")
        fh.write("-- aligned : x, y, z, sx, sy, sz ; rotated : x, y, z, sx, sy, sz, R00…R22 (studs, repère de la salle).\n")
        fh.write(f"return {{\n\taligned = {flat(aligned)},\n\trotated = {flat(rotated)},\n}}\n")

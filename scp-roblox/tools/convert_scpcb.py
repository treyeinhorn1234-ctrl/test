#!/usr/bin/env python3
"""Convertit les salles et modèles de SCP - Containment Breach pour Roblox Studio.

    python convert_scpcb.py --game chemin/vers/scpcb --out ../build

Produit :
  build/rooms/<salle>/<salle>.obj (+ .mtl, textures/)   une salle par dossier
  build/props/<prop>/<prop>.obj                          les objets posés dans les salles
  build/models/<dossier>/<modèle>.obj                    portes, SCP, objets…
  ../src/shared/Generated/RoomTemplates/                 données des salles pour le jeu
  ../src/server/Generated/RoomColliders/<salle>/         collisions des salles (boîtes)
  ../manifest.txt                                        liste des scripts, pour l'installateur Studio
  build/report.json                                      ce qui a été converti ou ignoré

Le jeu original est sous licence CC BY-SA 3.0 (Regalis11/scpcb) : les fichiers
convertis le restent, et doivent créditer leurs auteurs.
"""

from __future__ import annotations

import argparse
import configparser
import json
import os
import sys

from scpcb.b3d import load_b3d
from scpcb.export import TextureStore, rotation_to_roblox, to_roblox, write_obj
from scpcb.collide import build_colliders
from scpcb.luau import write_manifest, write_room_colliders, write_room_templates
from scpcb.model import Model, euler_matrix
from scpcb.rmesh import load_rmesh
from scpcb.xfile import load_x

# 1 unité de salle Blitz3D (une salle fait 2048 unités) = 1/40 de stud.
# Une porte (312 unités) mesure ainsi 7,8 studs et une salle 51,2 studs.
DEFAULT_SCALE = 1.0 / 40.0


class CaseInsensitiveFS:
    """Résout les chemins Windows du jeu (casse libre, antislashs) sur n'importe quel système."""

    def __init__(self, root: str):
        self.root = root
        self.cache: dict[str, dict[str, str]] = {}

    def resolve(self, rel: str) -> str | None:
        cur = self.root
        for piece in rel.replace("\\", "/").split("/"):
            if not piece:
                continue
            if cur not in self.cache:
                try:
                    self.cache[cur] = {n.lower(): n for n in os.listdir(cur)}
                except (FileNotFoundError, NotADirectoryError):
                    return None
            real = self.cache[cur].get(piece.lower())
            if real is None:
                return None
            cur = os.path.join(cur, real)
        return cur


def safe_name(name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in name)


def load_model(path: str) -> Model:
    return load_x(path) if path.lower().endswith(".x") else load_b3d(path)


def has_bones(path: str) -> bool:
    if not path.lower().endswith(".b3d"):
        return False
    with open(path, "rb") as fh:
        return b"BONE" in fh.read()


def read_rooms_ini(path: str) -> tuple[list[dict], list[str]]:
    cp = configparser.RawConfigParser(strict=False, inline_comment_prefixes=(";",), comment_prefixes=(";",))
    with open(path, encoding="latin-1") as fh:
        cp.read_file(fh)
    rooms = []
    ambience = []
    for section in cp.sections():
        sec = cp[section]
        if section.lower() == "room ambience":
            i = 1
            while f"ambience{i}" in sec:
                ambience.append(sec[f"ambience{i}"].strip())
                i += 1
            continue
        if "mesh path" not in sec:
            continue
        rooms.append({
            "name": section,
            "description": sec.get("descr", "").strip(),
            "mesh": sec["mesh path"].strip(),
            "shape": sec.get("shape", "").strip().upper(),
            "commonness": int(sec.get("commonness", "0").strip() or 0),
            "large": sec.get("large", "false").strip().lower() == "true",
            "disableDecals": sec.get("disabledecals", "false").strip().lower() == "true",
            "zones": [int(sec[k].strip()) for k in ("zone1", "zone2", "zone3") if k in sec and sec[k].strip()],
        })
    return rooms, ambience


def convert_room(info: dict, fs: CaseInsensitiveFS, out: str, scale: float, textures: TextureStore, report: dict,
                 colliders_dir: str):
    path = fs.resolve(info["mesh"])
    if path is None or os.path.getsize(path) == 0:
        report["skipped"].append({"file": info["mesh"], "reason": "fichier absent ou vide"})
        return None
    rm = load_rmesh(path)

    visual = Model()
    solid = []  # triangles qui bloquent le joueur, comme dans le jeu : maillages opaques + collisions cachées
    for s in rm.surfaces:
        visual.part_for(s.diffuse, s.is_alpha).extend(s.positions, s.diffuse_uvs, s.triangles)
        if not s.is_alpha:
            pts = [to_roblox(p, scale) for p in s.positions]
            solid += [(pts[a], pts[b], pts[c]) for a, b, c in s.triangles]
    for c in rm.collision:
        pts = [to_roblox(p, scale) for p in c.positions]
        solid += [(pts[a], pts[b], pts[c]) for a, b, c in c.triangles]

    name = safe_name(info["name"])
    obj_path = os.path.join(out, "rooms", name, f"{name}.obj")
    stats = write_obj(visual, obj_path, scale, textures, texture_near=os.path.dirname(path))
    colliders = build_colliders(solid)
    write_room_colliders(os.path.join(colliders_dir, name), info["name"], colliders)
    report["rooms"].append({"name": info["name"], "file": os.path.relpath(obj_path, out),
                            "colliders": len(colliders), **{k: v for k, v in stats.items() if k != "parts"}})

    def pos(p):
        return [round(v, 4) for v in to_roblox(p, scale)]

    def direction(angles):
        # Les spots regardent vers +Z local de Blitz3D, orientés par tangage et lacet
        m = euler_matrix(angles[0], angles[1], angles[2] if len(angles) > 2 else 0.0)
        return [round(v, 4) for v in to_roblox(m[2][:3], 1.0)]

    entities: dict[str, list] = {k: [] for k in ("lights", "spotlights", "waypoints", "sounds", "screens", "props", "playerStarts")}
    for e in rm.entities:
        t = e["type"]
        if t == "light":
            entities["lights"].append({"position": pos(e["position"]), "range": round(e["range"] * scale, 3),
                                       "color": e["color"][:3], "brightness": round(e["intensity"], 3)})
        elif t == "spotlight":
            entities["spotlights"].append({"position": pos(e["position"]), "range": round(e["range"] * scale, 3),
                                           "color": e["color"][:3], "brightness": round(e["intensity"], 3),
                                           "direction": direction(e["angles"]),
                                           "innerCone": e["inner_cone"], "outerCone": e["outer_cone"]})
        elif t == "waypoint":
            entities["waypoints"].append(pos(e["position"]))
        elif t == "soundemitter":
            entities["sounds"].append({"position": pos(e["position"]), "ambience": e["sound"],
                                       "range": round(e["range"], 3)})
        elif t == "screen":
            entities["screens"].append({"position": pos(e["position"]), "image": e["image"]})
        elif t == "playerstart":
            entities["playerStarts"].append({"position": pos(e["position"]), "angles": e["angles"]})
        elif t == "model" and e["file"]:
            rot = euler_matrix(*e["rotation"])
            entities["props"].append({"model": safe_name(os.path.splitext(e["file"])[0]),
                                      "file": e["file"],
                                      "position": pos(e["position"]),
                                      "rotation": [round(v, 5) for v in rotation_to_roblox(rot)],
                                      "scale": [round(v, 4) for v in e["scale"]]})

    triggers = []
    for tb in rm.trigger_boxes:
        pts = [to_roblox(p, scale) for part in tb["parts"] for p in part.positions]
        if pts:
            triggers.append({"name": tb["name"],
                             "min": [round(min(p[i] for p in pts), 4) for i in range(3)],
                             "max": [round(max(p[i] for p in pts), 4) for i in range(3)]})

    return {
        **{k: info[k] for k in ("name", "description", "shape", "commonness", "large", "disableDecals", "zones")},
        "asset": name,
        "boundsMin": [round(v, 4) for v in stats["min"]],
        "boundsMax": [round(v, 4) for v in stats["max"]],
        # MeshPart -> { centre x, y, z, taille x, y, z } dans le repère du fichier
        "parts": stats["parts"],
        "triggerBoxes": triggers,
        **entities,
    }


def convert_model(path: str, out_dir: str, scale: float, textures: TextureStore, report: dict, key: str,
                  name: str | None = None):
    try:
        model = load_model(path)
    except Exception as exc:  # noqa: BLE001 — on note l'échec et on continue
        report["skipped"].append({"file": key, "reason": str(exc)})
        return None
    name = name or safe_name(os.path.splitext(os.path.basename(path))[0])
    obj_path = os.path.join(out_dir, name, f"{name}.obj")
    stats = write_obj(model, obj_path, scale, textures, texture_near=os.path.dirname(path))
    entry = {"file": key, "obj": obj_path, **{k: v for k, v in stats.items() if k != "parts"}}
    if has_bones(path):
        entry["note"] = "modèle animé : exporté en pose de repos, sans squelette"
    report["models"].append(entry)
    return {"min": stats["min"], "max": stats["max"], "parts": stats["parts"]}


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--game", required=True, help="dossier du code source de SCP - Containment Breach")
    ap.add_argument("--out", default=os.path.join(here, "..", "build"), help="dossier de sortie des .obj")
    ap.add_argument("--luau", default=os.path.join(here, "..", "src"),
                    help="dossier src/ du projet Rojo, où écrire les données Luau générées")
    ap.add_argument("--scale", type=float, default=DEFAULT_SCALE, help="studs par unité Blitz3D")
    ap.add_argument("--rooms-only", action="store_true", help="ne convertit que les salles et leurs props")
    args = ap.parse_args()

    fs = CaseInsensitiveFS(args.game)
    rooms_ini = fs.resolve("Data/rooms.ini")
    if rooms_ini is None:
        print(f"Data/rooms.ini introuvable dans {args.game}", file=sys.stderr)
        return 1

    search = [p for p in (fs.resolve(d) for d in ("GFX/map", "GFX/map/Props", "GFX/npcs", "GFX/items", "GFX")) if p]
    textures = TextureStore(args.game, search)
    report: dict = {"scale": args.scale, "rooms": [], "models": [], "skipped": []}

    rooms_info, ambience = read_rooms_ini(rooms_ini)
    rooms = []
    for info in rooms_info:
        print(f"salle  {info['name']}")
        room = convert_room(info, fs, args.out, args.scale, textures, report,
                            os.path.join(args.luau, "server", "Generated", "RoomColliders"))
        if room:
            rooms.append(room)

    # Props référencés par les salles
    props: dict[str, dict] = {}
    for room in rooms:
        for p in room["props"]:
            if p["model"] in props:
                continue
            path = fs.resolve("GFX/map/Props/" + p["file"])
            if path is None:
                report["skipped"].append({"file": p["file"], "reason": "prop introuvable"})
                props[p["model"]] = None  # type: ignore[assignment]
                continue
            print(f"prop   {p['file']}")
            props[p["model"]] = convert_model(path, os.path.join(args.out, "props"), args.scale, textures, report,
                                              p["file"], p["model"])

    models: dict[str, dict] = {}
    if not args.rooms_only:
        gfx = fs.resolve("GFX")
        props_dir = fs.resolve("GFX/map/Props")
        for dirpath, _dirs, files in os.walk(gfx):
            if dirpath == props_dir:
                continue
            for fname in sorted(files):
                if not fname.lower().endswith((".x", ".b3d")):
                    continue
                path = os.path.join(dirpath, fname)
                rel = os.path.relpath(path, args.game).replace(os.sep, "/")
                folder = safe_name(os.path.relpath(dirpath, gfx).replace(os.sep, "_"))
                print(f"modèle {rel}")
                bounds = convert_model(path, os.path.join(args.out, "models", folder), args.scale, textures, report, rel)
                if bounds:
                    models[rel] = bounds

    report["missingTextures"] = sorted(textures.missing)
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "report.json"), "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=1, ensure_ascii=False)

    write_room_templates(os.path.join(args.luau, "shared", "Generated", "RoomTemplates"), rooms, ambience,
                         {k: v for k, v in props.items() if v}, args.scale)
    write_manifest(args.luau, os.path.join(args.luau, "..", "manifest.txt"))

    print(f"\n{len(rooms)} salles, {len([p for p in props.values() if p])} props, {len(models)} modèles convertis.")
    print(f"{len(report['skipped'])} fichiers ignorés, {len(textures.missing)} textures manquantes (voir report.json).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

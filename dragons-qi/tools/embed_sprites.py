"""Regénère sprites.js : embarque les planches du samouraï en data-URI.

Permet de lancer le jeu en double-cliquant index.html (file://) sans que
WebGL refuse les textures pour cause d'origine croisée.
Usage : python3 tools/embed_sprites.py  (depuis le dossier dragons-qi/)
"""
import base64
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHEETS = ["IDLE", "RUN", "ATTACK", "HURT"]

lines = [
    "// Fichier généré par tools/embed_sprites.py — ne pas éditer à la main.",
    "// Planches « FREE Samurai 2D Pixel Art v1.2 » (cases de 96×96), voir assets/samurai/License.txt.",
    "window.SAMURAI_SPRITES = {",
]
for name in SHEETS:
    data = base64.b64encode((ROOT / "assets" / "samurai" / f"{name}.png").read_bytes()).decode()
    lines.append(f'  {name}: "data:image/png;base64,{data}",')
lines.append("};")
(ROOT / "sprites.js").write_text("\n".join(lines) + "\n")
print("sprites.js écrit")

# -*- coding: utf-8 -*-
"""Где лежит спрайт: читает assets/paths.js (её пишет tools/organize_assets.py).

    from assets_paths import sprite_path, all_sprites
    sprite_path("fire")            → /…/assets/cars/players/fire.png
    sprite_path("fire", "webp")    → …/fire.webp
"""
import json, os, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_MAP = None


def paths():
    global _MAP
    if _MAP is None:
        p = os.path.join(BASE, "assets", "paths.js")
        try:
            txt = open(p, encoding="utf-8").read()
            _MAP = json.loads(re.search(r"var ASSET_PATH=(\{.*\});", txt, re.S).group(1))
        except Exception:
            _MAP = {}
    return _MAP


def sprite_path(name, ext="png"):
    rel = paths().get(name)
    if rel:
        return os.path.join(BASE, "assets", rel + "." + ext)
    sub = "cars" if re.match(r"^(monster|fire|race|police|ambulance|bus|excavator|garbage|tractor|tow)(_|$)", name) else "world"
    return os.path.join(BASE, "assets", sub, name + "." + ext)


def all_sprites(top=None, ext="png"):
    """Список (имя, полный путь) — по всем подпапкам; top='cars' или 'world' сужает."""
    out = []
    for name, rel in sorted(paths().items()):
        if top and not rel.startswith(top + "/"):
            continue
        p = os.path.join(BASE, "assets", rel + "." + ext)
        if os.path.exists(p):
            out.append((name, p))
    return out

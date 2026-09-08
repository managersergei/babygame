# -*- coding: utf-8 -*-
"""Раскладка спрайтов по смысловым подпапкам + карта путей для игры.

    python3 tools/organize_assets.py --plan     # показать, что куда поедет
    python3 tools/organize_assets.py --apply    # переместить (git mv) и записать assets/paths.js

Игра ищет спрайт по имени: `assets/paths.js` отдаёт имя → путь. Если карты нет или имени в ней нет,
работает прежнее правило (cars/ для машинок, world/ для остального), поэтому раскладка обратима.
"""
import io, os, re, subprocess, sys, json

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(BASE, "assets")

# (подпапка, откуда, шаблон имени) — порядок важен: первое совпадение выигрывает
RULES = [
    ("cars/players",   "cars",  r"^(monster|fire|race|police)$"),
    ("cars/skins",     "cars",  r"^(monster|fire|race|police)_(black|red|yellow|d[123]|w[0-4])$"),
    ("cars/traffic",   "cars",  r"^(ambulance|bus|excavator|garbage|tractor|tow)$"),
    ("world/road",     "world", r"^(cone|ramp|pit|puddle|crossing|launchpad|restart|wheel|door|headlight)$"),
    ("world/pickups",  "world", r"^(star|coin|chest|apple|balloon|fuel|fuel_empty|paint)$"),
    ("world/animals",  "world", r"^(cow|horse|chicken|sheep|hedgehog|butterfly|bird|loc_monkey)$"),
    ("world/monsters", "world", r"^(monster_[a-d](_run)?|robot|master)$"),
    ("world/nature",   "world", r"^(tree|bush|flower|daisies|haystack|loc_palm|loc_fir|loc_jungle|sun|cloud|arch)$"),
    ("world/places",   "world", r"^(house|fence|windmill|loc_tower|loc_shop|loc_rock|loc_rocket|loc_umbrella|loc_snowman)$"),
    ("world/vehicles", "world", r"^(train|plane|ball)$"),
]

def scan():
    """Все спрайты: имя → (текущая относительная папка, набор расширений)."""
    out = {}
    for root, _dirs, fs in os.walk(A):
        rel = os.path.relpath(root, A)
        if rel.startswith("voice") or rel.startswith("music"):
            continue
        for f in fs:
            if not f.endswith((".png", ".webp")):
                continue
            name, ext = f.rsplit(".", 1)
            cur = out.setdefault(name, {"dir": rel.replace(os.sep, "/"), "ext": set()})
            cur["ext"].add(ext)
    return out

def target(name, cur_dir):
    top = cur_dir.split("/")[0]
    for sub, src, pat in RULES:
        if src == top and re.match(pat, name):
            return sub
    return None

def plan():
    moves, keep = [], []
    for name, info in sorted(scan().items()):
        t = target(name, info["dir"])
        if not t:
            keep.append((name, info["dir"])); continue
        if info["dir"] == t:
            continue
        moves.append((name, info["dir"], t, sorted(info["ext"])))
    return moves, keep

def write_map():
    m = {}
    for name, info in scan().items():
        m[name] = info["dir"] + "/" + name
    io.open(os.path.join(A, "paths.js"), "w", encoding="utf-8").write(
        "/* Карта спрайтов: имя → путь внутри assets/. Обновляется tools/organize_assets.py. */\n"
        "var ASSET_PATH=" + json.dumps(m, ensure_ascii=False, sort_keys=True) + ";\n")
    return len(m)

if __name__ == "__main__":
    moves, keep = plan()
    if "--apply" not in sys.argv:
        print("перемещений: %d" % len(moves))
        for n, a, b, ex in moves[:12]:
            print("  %-20s %s → %s (%s)" % (n, a, b, ", ".join(ex)))
        if len(moves) > 12:
            print("  … ещё %d" % (len(moves) - 12))
        if keep:
            print("остаются на месте: " + ", ".join("%s (%s)" % k for k in keep))
        sys.exit()
    for name, src, dst, exts in moves:
        os.makedirs(os.path.join(A, dst), exist_ok=True)
        for e in exts:
            s = os.path.join(A, src, name + "." + e)
            d = os.path.join(A, dst, name + "." + e)
            if os.path.exists(s):
                r = subprocess.run(["git", "mv", s, d], cwd=BASE, capture_output=True)
                if r.returncode:                      # файл не под git (png в .gitignore) — обычный перенос
                    os.replace(s, d)
    n = write_map()
    print("перемещено %d спрайтов, карта путей: %d записей" % (len(moves), n))

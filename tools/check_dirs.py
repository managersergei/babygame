#!/usr/bin/env python3
"""Контроль направления машинок.

Все машинки в игре едут ВПРАВО, значит и смотреть должны вправо. Определяем это по глазам:
у каждой машинки крупные белые белки с тёмными зрачками, и они всегда ближе к передней части.
Считаем центр масс «глазных» пикселей — если он левее середины силуэта, спрайт развёрнут.

    python3 tools/check_dirs.py          # проверить и показать отчёт
    python3 tools/check_dirs.py --fix    # проверить и развернуть то, что смотрит влево

Запускать после ЛЮБОЙ генерации или переобработки машинок. Вызывается автоматически
из gen_sprites.py и gen_variants.py.
"""
import os, sys
from PIL import Image

CARS_DIR = "/Users/sergei/Documents/babygame/assets/cars"


def eye_center(im):
    """Центр масс глаз в долях ширины: 0 — левый край, 1 — правый. None, если глаз не видно."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    sx = n = 0
    dark = []
    for y in range(int(h * 0.05), int(h * 0.72)):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 200:
                continue
            if r > 225 and g > 225 and b > 225:          # белок
                sx += x; n += 1
            elif max(r, g, b) < 60:                       # зрачок
                dark.append((x, y))
    if n < w * h * 0.002:
        return None
    cx = sx / n / w
    # проверяем, что рядом с белками есть тёмные зрачки — иначе это белый кузов
    if dark:
        dcx = sum(d[0] for d in dark) / len(dark) / w
        if abs(dcx - cx) > 0.35:
            return None
    return cx


def check(fix=False):
    files = sorted(f for f in os.listdir(CARS_DIR) if f.endswith(".png"))
    bad, unknown = [], []
    for f in files:
        path = os.path.join(CARS_DIR, f)
        im = Image.open(path)
        c = eye_center(im)
        if c is None:
            unknown.append(f)
            print("  ?  %-22s глаз не видно — проверить глазами" % f)
            continue
        ok = c > 0.5
        print("  %s %-22s глаза на %.2f" % ("OK " if ok else "!!!", f, c))
        if not ok:
            bad.append(f)
            if fix:
                im.convert("RGBA").transpose(Image.FLIP_LEFT_RIGHT).save(path)
                print("      → развернул")
    print()
    if bad:
        print("СМОТРЯТ ВЛЕВО: %s%s" % (", ".join(bad), " (исправлено)" if fix else ""))
    else:
        print("Все машинки смотрят вправо.")
    if unknown:
        print("Не определилось:", ", ".join(unknown))
    return bad


WORLD_DIR = "/Users/sergei/Documents/babygame/assets/world"

# Куда должен смотреть каждый движущийся персонаж фона.
# Все они идут навстречу машинке (влево), кроме тех, кто едет за ней.
WORLD_FACE = {
    "hedgehog": "left", "cow": "left", "horse": "left", "chicken": "left",
    "bird": "left", "butterfly": "left", "train": "left",
    "monster_a": "left", "monster_b": "left", "monster_c": "left", "monster_d": "left",
    "monster_a_run": "left", "monster_b_run": "left", "monster_c_run": "left", "monster_d_run": "left",
    "sheep": "right",     # стоит на месте, убегает вправо
    "robot": "right",     # догоняет машинку сзади
}


def check_world(fix=False):
    """Те же правила для фоновых персонажей: смотреть надо туда, куда движешься."""
    bad = []
    for name, want in sorted(WORLD_FACE.items()):
        path = os.path.join(WORLD_DIR, name + ".png")
        if not os.path.exists(path):
            continue
        im = Image.open(path)
        c = eye_center(im)
        if c is None:
            print("  ?  %-16s глаз не видно" % name)
            continue
        got = "right" if c > 0.5 else "left"
        ok = got == want
        print("  %s %-16s глаза на %.2f (надо %s)" % ("OK " if ok else "!!!", name, c, want))
        if not ok:
            bad.append(name)
            if fix:
                im.convert("RGBA").transpose(Image.FLIP_LEFT_RIGHT).save(path)
                print("      → развернул")
    return bad


if __name__ == "__main__":
    fix = "--fix" in sys.argv
    bad1 = check(fix)
    print("\n=== фоновые персонажи ===")
    bad2 = check_world(fix)
    if bad2:
        print("СМОТРЯТ НЕ ТУДА: %s%s" % (", ".join(bad2), " (исправлено)" if fix else ""))
    else:
        print("Все персонажи смотрят куда надо.")
    sys.exit(1 if (bad1 or bad2) and not fix else 0)

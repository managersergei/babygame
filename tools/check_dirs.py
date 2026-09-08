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
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from assets_paths import all_sprites, sprite_path
from PIL import Image, ImageChops, ImageStat

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


def _alpha(im):
    return im.convert("RGBA").split()[3].point(lambda v: 255 if v >= 200 else 0)


def to_webp(path):
    """Игра грузит .webp — после разворота PNG пересобираем его тем же качеством (README: cwebp -q 88)."""
    wp = path[:-4] + ".webp"
    if os.path.exists(wp):
        subprocess.run(["cwebp", "-quiet", "-q", "88", path, "-o", wp], check=False)


def base_of(f):
    """monster_d3.png -> путь к monster.png, если такой есть; иначе None (значит, это не вариант)."""
    stem = f[:-4]
    if "_" not in stem:
        return None
    b = sprite_path(stem.split("_")[0])
    return b if os.path.exists(b) else None


def same_or_mirror(var, base):
    """Ошибка по серому на пересечении масок: (к базе, к зеркалу базы)."""
    var = var.convert("RGBA"); base = base.convert("RGBA")
    if var.size != base.size:
        var = var.resize(base.size, Image.LANCZOS)
    out = []
    for b in (base, base.transpose(Image.FLIP_LEFT_RIGHT)):
        m = ImageChops.multiply(_alpha(var), _alpha(b))
        d = ImageChops.difference(var.convert("L"), b.convert("L"))
        out.append(ImageStat.Stat(d, mask=m).mean[0])
    return out


def tone(im):
    st = ImageStat.Stat(im.convert("RGB"), mask=_alpha(im))
    return st.mean


def check_variants(fix=False, tone_tol=0.12):
    """Варианты машинки (цвета, повреждения, без колёс) сверяем с базой попиксельно:
    у побитых машин глаз не видно, а зеркало ловится только сравнением. Заодно смотрим,
    не «уехал» ли общий тон — повреждение не должно перекрашивать машинку."""
    bad, off = [], []
    for name, path in all_sprites("cars"):
        f = name + ".png"
        b = base_of(f)
        if not b:
            continue
        im = Image.open(path)
        same, mirror = same_or_mirror(im, Image.open(b))
        okd = same < mirror
        bt, vt = tone(Image.open(b)), tone(im)
        drift = max(abs(vt[i] - bt[i]) / max(1.0, bt[i]) for i in range(3))
        skin = f[:-4].split("_", 1)[1]
        tone_ok = skin.startswith("d") or drift <= tone_tol      # цветные скины меняют тон намеренно
        print("  %s %-22s к базе %5.1f, к зеркалу %5.1f, тон %+.0f%%"
              % ("OK " if okd and (tone_ok or not skin.startswith("d")) else "!!!", f, same, mirror, drift * 100))
        if not okd:
            bad.append(f)
            if fix:
                im.convert("RGBA").transpose(Image.FLIP_LEFT_RIGHT).save(path)
                to_webp(path)
                print("      → развернул и пересобрал webp")
        elif skin.startswith("d") and drift > tone_tol:
            off.append("%s (%+.0f%%)" % (f, drift * 100))
    if off:
        print("ТОН УЕХАЛ у повреждений:", ", ".join(off), "— повреждение не должно перекрашивать машинку")
    return bad


def check(fix=False):
    files = sorted(n + ".png" for n, _p in all_sprites("cars") if not base_of(n + ".png"))   # варианты — в check_variants()
    bad, unknown = [], []
    for f in files:
        path = sprite_path(f[:-4])
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
                to_webp(path)
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
        path = sprite_path(name)
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
    bad1 = check(fix) + check_variants(fix)
    print("\n=== фоновые персонажи ===")
    bad2 = check_world(fix)
    if bad2:
        print("СМОТРЯТ НЕ ТУДА: %s%s" % (", ".join(bad2), " (исправлено)" if fix else ""))
    else:
        print("Все персонажи смотрят куда надо.")
    sys.exit(1 if (bad1 or bad2) and not fix else 0)

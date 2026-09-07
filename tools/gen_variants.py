#!/usr/bin/env python3
"""Скины машинок: цвета и повреждения.

Не рисуем с нуля — редактируем ОРИГИНАЛЬНЫЙ спрайт через FLUX Kontext
(оригинал идёт референсом), поэтому форма, лицо и стиль сохраняются.
Обрезаем строго по рамке оригинала, чтобы все варианты совпадали пиксель в пиксель.

    export FAL_KEY=...
    python3 tools/gen_variants.py            # чего нет — досоздать
    python3 tools/gen_variants.py --force    # перегенерить всё
"""
import base64, json, os, sys, urllib.request, concurrent.futures
from PIL import Image, ImageChops, ImageDraw, ImageFilter

KEY = os.environ["FAL_KEY"]
BASE = "/Users/sergei/Documents/babygame"
RAW, OUT = BASE + "/assets_raw", BASE + "/assets/cars"
MODEL = "https://fal.run/fal-ai/flux-pro/kontext"
CARS = ["monster", "fire", "race", "police"]
# те же развороты, что и в gen_sprites.py — иначе варианты выйдут зеркальными
FLIP = {"excavator", "ambulance", "monster"}

KEEP = ("Keep the exact same shape, pose, wheels, cartoon face with the same eyes and smile, "
        "same camera angle and cartoon style. Plain pure white background.")
KEEP2 = ("Keep the exact same body shape, size, position, cartoon face with the same eyes and smile, "
         "colors, decals, camera angle and cartoon style. Plain pure white background, no shadow.")

VARIANTS = {
    "black":  "Repaint the body of this cartoon vehicle glossy deep black. Only the paint color changes: "
              "windows, eyes, lights, wheels and details stay as they are. " + KEEP,
    "red":    "Repaint the body of this cartoon vehicle bright glossy red. Only the paint color changes: "
              "windows, eyes, lights, wheels and details stay as they are. " + KEEP,
    "yellow": "Repaint the body of this cartoon vehicle bright glossy yellow. Only the paint color changes: "
              "windows, eyes, lights, wheels and details stay as they are. " + KEEP,
    "d1":     "Add light damage to this cartoon vehicle: a few small dents and scratches on the body, "
              "a bit of dust. The face stays cheerful. " + KEEP,
    "d2":     "Add clear damage to this cartoon vehicle: several dents, scratches, one cracked headlight "
              "and a bent dirty bumper. The face looks a little worried. " + KEEP,
    "d3":     "Add heavy damage to this cartoon vehicle: big dents, cracked windshield, loose hanging bumper, "
              "soot marks and small smoke puffs. The face looks sad. " + KEEP,
    "nowheel": "Completely remove every wheel and tire from this cartoon vehicle. The wheel arches must be "
               "empty and see-through, nothing at all below the body where the wheels were. "
               "Keep the body shape, face, eyes, smile, colors, decals, position and size exactly the same. "
               "Plain pure white background.",
    # скины «без N колёс» для мастерской: колесо просто исчезает, кузов оседает на эту сторону
    "w1": "Remove ONLY the rear wheel of this cartoon vehicle — the wheel closest to the left edge. "
          "Leave an empty dark wheel arch there, the axle visible. All the other wheels stay exactly as they are. " + KEEP2,
    "w2": "Remove the TWO rear wheels of this cartoon vehicle — the ones on the left side. "
          "Leave empty dark wheel arches there. The remaining wheels stay exactly as they are. " + KEEP2,
    "w3": "Remove THREE wheels of this cartoon vehicle, keep only the front wheel closest to the right edge. "
          "Leave empty dark wheel arches. " + KEEP2,
    "w4": "Remove ALL wheels of this cartoon vehicle. Leave empty dark wheel arches, nothing below the body. " + KEEP2,
}


def post(url, payload, timeout=300):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={"Authorization": "Key " + KEY,
                                          "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def cut_alpha(im):
    """Убирает белый фон и мягкую тень — та же логика, что в gen_sprites.py."""
    im = im.convert("RGB")
    w, h = im.size
    r, g, b = im.split()
    mn = ImageChops.darker(ImageChops.darker(r, g), b)
    mx = ImageChops.lighter(ImageChops.lighter(r, g), b)
    grayish = ImageChops.difference(mx, mn).point(lambda v: 255 if v <= 34 else 0)

    bg = mn.point(lambda v: 255 if v >= 234 else 0)
    px = bg.load()
    seeds = ([(x, 0) for x in range(0, w, 8)] + [(x, h - 1) for x in range(0, w, 8)] +
             [(0, y) for y in range(0, h, 8)] + [(w - 1, y) for y in range(0, h, 8)])
    for s in seeds:
        if px[s] == 255:
            ImageDraw.floodfill(bg, s, 128, thresh=0)
    bg = bg.point(lambda v: 255 if v == 128 else 0)

    band = ImageChops.multiply(mn.point(lambda v: 255 if 95 <= v <= 233 else 0), grayish)
    zone = Image.new("L", (w, h), 0)
    ImageDraw.Draw(zone).rectangle([0, int(h * 0.76), w, h], fill=255)
    band = ImageChops.multiply(band, zone)
    grow = ImageChops.multiply(bg.filter(ImageFilter.MaxFilter(5)), band)
    for _ in range(60):
        nxt = ImageChops.multiply(grow.filter(ImageFilter.MaxFilter(5)), band)
        if not ImageChops.difference(nxt, grow).getbbox():
            break
        grow = nxt
    bg = ImageChops.lighter(bg, grow)

    alpha = bg.point(lambda v: 0 if v >= 128 else 255)
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.7)).point(lambda v: min(255, int(v * 1.35)))
    im = im.copy()
    im.putalpha(alpha)
    return im


def box_of(name):
    """Рамка оригинала — все варианты режем ровно по ней."""
    im = cut_alpha(Image.open(os.path.join(RAW, name + ".png")))
    return im, im.getbbox()


def make(job):
    name, key = job
    dst = os.path.join(OUT, "%s_%s.png" % (name, key))
    try:
        src = os.path.join(RAW, name + ".png")
        uri = "data:image/png;base64," + base64.b64encode(open(src, "rb").read()).decode()
        r = post(MODEL, {"prompt": VARIANTS[key], "image_url": uri,
                         "guidance_scale": 3.6, "output_format": "png"})
        rawv = os.path.join(RAW, "%s_%s.png" % (name, key))
        with urllib.request.urlopen(r["images"][0]["url"], timeout=180) as s, open(rawv, "wb") as f:
            f.write(s.read())
        orig, box = box_of(name)
        im = cut_alpha(Image.open(rawv))
        if im.size != orig.size:
            im = im.resize(orig.size, Image.LANCZOS)
        if name in FLIP:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
            box = (orig.width - box[2], box[1], orig.width - box[0], box[3])
        im = im.crop(box)
        k = 640 / max(im.size)
        if k < 1:
            im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        im.save(dst, "PNG", optimize=True)
        return "OK   %s_%s  %dx%d" % (name, key, im.width, im.height)
    except Exception as e:
        return "FAIL %s_%s :: %s" % (name, key, str(e)[:90])


if __name__ == "__main__":
    force = "--force" in sys.argv
    jobs = [(c, k) for c in CARS for k in VARIANTS
            if force or not os.path.exists(os.path.join(OUT, "%s_%s.png" % (c, k)))]
    print("вариантов к генерации:", len(jobs), flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        for r in ex.map(make, jobs):
            print(r, flush=True)

    # ── обязательный контроль: все машинки должны смотреть вправо
    try:
        import subprocess
        subprocess.run([sys.executable, os.path.join(BASE, "tools/check_dirs.py"), "--fix"], check=False)
    except Exception as e:
        print("проверка направления не запустилась:", e)

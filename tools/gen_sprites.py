#!/usr/bin/env python3
"""Generate game sprites via fal.ai (flux/dev) and cut out the white background."""
import json, os, sys, sys, urllib.request, concurrent.futures, time
from PIL import Image, ImageChops, ImageDraw, ImageFilter

KEY = os.environ["BABYGAME_FAL_KEY"]
BASE = "/Users/sergei/Documents/babygame"
RAW, OUT = BASE + "/assets_raw", BASE + "/assets"
CARFILES = {"monster", "fire", "race", "police", "ambulance", "garbage", "excavator", "bus",
            "tractor", "tow", "monster_body", "fire_body", "race_body",
            "wheel_big", "wheel_truck", "wheel_small"}
def outdir(name):
    return OUT + ("/cars" if name in CARFILES else "/world")
for d in (RAW, OUT, OUT + "/cars", OUT + "/world"):
    os.makedirs(d, exist_ok=True)

STYLE = ("children's cartoon illustration, thick clean black outlines, flat bright saturated colors, "
         "simple friendly shapes, glossy toy look, centered, whole object fully visible with wide margin, "
         "isolated on pure plain white background, no shadow, "
         "no text, no words, no letters, no logo, no watermark, no frame")

CAR = ("cute cartoon {what}, side view profile facing right, two big friendly cartoon eyes with "
       "black pupils on the windshield, happy smiling face, chunky toy proportions, " + STYLE)

SPRITES = {
  "monster":   CAR.format(what="orange monster truck with huge oversized knobby wheels and flame decals"),
  "fire":      CAR.format(what="red fire engine truck with silver ladder on the roof and blue siren lights"),
  "race":      CAR.format(what="red race car with white lightning bolt stripe, big rear spoiler, low and sporty"),
  "police":    CAR.format(what="blue and white police car with a red and blue siren light bar on the roof"),
  "ambulance": CAR.format(what="white ambulance van with red cross and red stripe and siren lights"),
  "garbage":   CAR.format(what="green garbage truck with big rear container"),
  "excavator": CAR.format(what="yellow excavator digger with a raised arm and metal bucket"),
  "bus":       CAR.format(what="yellow school bus with a row of windows"),
  "tractor":   CAR.format(what="green farm tractor with huge rear wheel, small front wheel and black exhaust pipe, "
                                "the cartoon face is only on the front hood grille, "
                                "the cab window is empty dark glass without any eyes"),
  "tow":       CAR.format(what="orange tow truck with a crane hook arm at the back"),

  "fuel":     "cute cartoon red fuel canister jerrycan with a happy smiling face and big eyes, "
              "yellow fuel drop symbol on the side, handle on top, glossy, " + STYLE,
  "wheel":    "cute cartoon black car tire wheel with orange rim and bolts, strict side view, "
              "round, glossy, " + STYLE,
  "paint":    "cute cartoon open paint bucket full of glossy black paint with a paint brush leaning on it, "
              "side view, " + STYLE,
  "sheep":    "cute cartoon fluffy white sheep with a happy smiling face, standing, side view, " + STYLE,
  "robot":    "funny cartoon angry robot villain with grumpy face, big eyes, metal body, "
              "rolling on wheels, side view facing right, not scary, silly, " + STYLE,
  "master":   "cute cartoon painter man in blue overalls and orange cap, friendly smiling, standing, "
              "holding a big paint bucket in one hand and a paint brush in the other hand, "
              "full body, side view facing left, " + STYLE,
  "monster_a":"funny cute cartoon green monster with big googly eyes, one horn, silly happy face, "
              "running on two legs, side view facing left, friendly not scary, " + STYLE,
  "monster_body": "cute cartoon orange monster truck BODY ONLY with no wheels at all, empty round wheel arches showing through, "
                  "side view facing right, two big friendly eyes on the windshield, happy smile, flame decals, " + STYLE,
  "fire_body":    "cute cartoon red fire engine truck BODY ONLY with no wheels at all, empty round wheel arches showing through, "
                  "side view facing right, two big friendly eyes on the windshield, happy smile, silver ladder on roof, " + STYLE,
  "race_body":    "cute cartoon red race car BODY ONLY with no wheels at all, empty round wheel arches showing through, "
                  "side view facing right, two big friendly eyes on the windshield, happy smile, white stripe, spoiler, " + STYLE,
  "wheel_big":    "cute cartoon huge black knobby monster truck tire with orange rim, strict side view, perfect circle, " + STYLE,
  "wheel_truck":  "cute cartoon black truck tire with silver rim, strict side view, perfect circle, " + STYLE,
  "wheel_small":  "cute cartoon black car tire with silver rim, strict side view, perfect circle, " + STYLE,
  "headlight":    "cute cartoon round yellow car headlight lamp, glossy glass, chrome ring, front view, single object, " + STYLE,
  "door":         "cute cartoon red car door with window and handle, side view, single object, " + STYLE,
  "monster_b": "funny cute cartoon purple fluffy monster with three googly eyes and small horns, silly happy face, "
              "running on two legs, side view facing left, friendly not scary, " + STYLE,
  "monster_c": "funny cute cartoon round blue monster with two curved horns and big teeth smile, silly face, "
              "hopping on two legs, side view facing left, friendly not scary, " + STYLE,
  "monster_d": "funny cute cartoon orange spiky monster with one big eye and tiny legs, silly happy face, "
              "running, side view facing left, friendly not scary, " + STYLE,
  "star":     "cute cartoon golden yellow five pointed star with a happy smiling face, shiny, " + STYLE,
  "balloon":  "cute cartoon red party balloon with a curly string, glossy highlight, " + STYLE,
  "cone":     "cartoon orange traffic cone with white stripe, side view, " + STYLE,
  "ramp":     "cartoon empty wooden skateboard jump ramp, blue and yellow planks, side view, "
              "right triangle wedge shape with slope rising to the right, nothing on top of it, "
              "no car, no vehicle, no person, " + STYLE,
  "arch":     "cartoon rainbow arch gate with colorful triangle flags on top, front view, wide open archway, " + STYLE,
  "cloud":    "cute cartoon fluffy white cloud with soft blue outline, " + STYLE,
  "tree":     "cute cartoon green tree with round fluffy crown and brown trunk, " + STYLE,
  "house":    "cute cartoon small house with red roof, yellow walls and one window, " + STYLE,
  "bush":     "cute cartoon small green bush with tiny colorful flowers, " + STYLE,
  "sun":      "cute cartoon smiling yellow sun with triangle rays and happy face, " + STYLE,
}

RICH = ("polished 3D-style cartoon game asset, soft volumetric shading, glossy highlights, "
        "rich saturated colors, rounded friendly shapes, crisp clean edges, high detail, centered, "
        "whole object visible with margin, isolated on pure plain white background, no shadow, "
        "no text, no watermark")

SPRITES.update({
  "cow":      "cute cartoon happy cow standing, side view facing left, white with brown spots, " + RICH,
  "horse":    "cute cartoon happy brown horse standing, side view facing left, " + RICH,
  "chicken":  "cute cartoon happy chicken standing, side view facing left, " + RICH,
  "fence":    "cute cartoon white wooden picket fence section, side view, " + RICH,
  "haystack": "cute cartoon round haystack of golden hay, " + RICH,
  "windmill": "cute cartoon windmill with red roof and white blades, " + RICH,
  "daisies":  "cute cartoon patch of white daisies with yellow centers in green grass, " + RICH,

  "fuel_empty": "cute cartoon empty red fuel canister with a sad crying face, tilted, with a single last drop, " + RICH,
  "coin":       "cute cartoon shiny gold coin with a star embossed on it, front view, " + RICH,
  "chest":      "cute cartoon open treasure chest full of gold coins, " + RICH,
  "restart":    "cute cartoon round green restart arrow icon, glossy 3d, " + RICH,

  "train":     "cute cartoon colorful train locomotive with one wagon, happy face on the front, "
               "side view facing left, " + RICH,
  "crossing":  "cartoon railway crossing sign with red and white barrier pole, side view, " + RICH,

  # ── элементы для новых слов
  "flower":    "cute cartoon bright flower with green stem and leaves, side view, " + RICH,
  "ball":      "cute cartoon colorful striped beach ball, glossy, " + RICH,
  "butterfly": "cute cartoon butterfly with bright patterned wings, flying, side view facing left, " + RICH,
  "hedgehog":  "cute cartoon happy hedgehog walking, side view facing left, " + RICH,
  "apple":     "cute cartoon shiny red apple with green leaf, " + RICH,
  "launchpad": "cute cartoon rocket launch pad tower with metal frame, empty, side view, " + RICH,

  # ── локации: по два предмета на место
  "loc_tower":  "cute cartoon city skyscraper building with many windows, colorful, tall, " + RICH,
  "loc_shop":   "cute cartoon small city shop building with awning and big window, " + RICH,
  "loc_palm":   "cute cartoon palm tree with coconuts on a small sand mound, " + RICH,
  "loc_umbrella":"cute cartoon striped beach umbrella with a towel and a beach ball, " + RICH,
  "loc_jungle": "cute cartoon jungle tree with huge leaves and hanging vines, " + RICH,
  "loc_monkey": "cute cartoon happy monkey sitting, side view, " + RICH,
  "loc_rock":   "cute cartoon grey moon rock with craters, space style, " + RICH,
  "loc_rocket": "cute cartoon small rocket standing on the ground, red and white, " + RICH,
  "loc_fir":    "cute cartoon fir tree covered with snow, winter, " + RICH,
  "loc_snowman":"cute cartoon happy snowman with carrot nose, scarf and bucket hat, " + RICH,

  "cloud":   "cute fluffy white cartoon cloud with soft blue shading, " + RICH,
  "tree":    "cute cartoon tree with lush layered green crown and textured brown trunk, " + RICH,
  "bush":    "cute cartoon green bush with small colorful flowers and berries, " + RICH,
  "house":   "cute cartoon cottage with red tiled roof, warm yellow walls, wooden door and window, " + RICH,
  "ramp":    "cartoon wooden jump ramp for toy cars, blue and yellow painted planks, side view, "
             "right triangle wedge rising to the right, nothing on it, " + RICH,
  "balloon": "cute glossy red party balloon with curly string and bright highlight, " + RICH,
  "arch":    "colorful cartoon rainbow arch gate with triangular flags on top, wide open archway, "
             "front view, " + RICH,
  "cone":    "cartoon orange traffic cone with white reflective stripe, side view, " + RICH,
  "plane":   "cute cartoon small propeller airplane with round friendly windows, side view flying right, " + RICH,
  "bird":    "cute magical fairy bird with rainbow gradient wings and long tail feathers, flying, "
             "side view facing right, sparkles, " + RICH,
})

MAXDIM = {"arch": 900, "sun": 420, "cloud": 520}
FLIP = {"excavator", "ambulance", "monster", "monster_body", "race_body"}   # едут вправо


def post(url, payload, timeout=300):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={"Authorization": "Key " + KEY,
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)


def cutout(src, dst, max_dim=640, flip=False):
    """Cut the white background AND the soft drop shadow baked into the render.

    Two stages:
      1. flood-fill the *pure white* region from the borders — safe, never leaks into
         the subject (white subject parts are fenced in by thick dark outlines);
      2. grow that region only through the mid-grey "shadow band" (132..233, desaturated).
         Bright subject parts (>=234) are outside the band, so the growth erases the
         drop shadow and stops at the artwork.
    """
    im = Image.open(src).convert("RGB")
    w, h = im.size
    r, g, b = im.split()
    mn = ImageChops.darker(ImageChops.darker(r, g), b)
    mx = ImageChops.lighter(ImageChops.lighter(r, g), b)
    grayish = ImageChops.difference(mx, mn).point(lambda v: 255 if v <= 34 else 0)

    # ── 1. чистый белый фон
    bg = mn.point(lambda v: 255 if v >= 234 else 0)
    px = bg.load()
    step = 8
    seeds = ([(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)] +
             [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)])
    for s in seeds:
        if px[s] == 255:
            ImageDraw.floodfill(bg, s, 128, thresh=0)
    bg = bg.point(lambda v: 255 if v == 128 else 0)

    # ── 2. отъедаем мягкую тень (серая полоса яркости), не трогая светлый рисунок
    # тень всегда лежит под объектом — режем её только в нижней полосе кадра,
    # иначе страдают серые детали наверху (лестница пожарной, стрела крана)
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
    im.putalpha(alpha)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    if max(im.size) > max_dim:
        k = max_dim / max(im.size)
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    im.save(dst, "PNG", optimize=True)
    return im.size


def make(name, prompt):
    t0 = time.time()
    raw = os.path.join(RAW, name + ".png")
    try:
        if not os.path.exists(raw):
            gen = post("https://fal.run/fal-ai/flux/dev", {
                "prompt": prompt, "image_size": "square_hd", "num_images": 1,
                "num_inference_steps": 30, "guidance_scale": 3.5,
                "enable_safety_checker": False, "output_format": "png",
            })
            with urllib.request.urlopen(gen["images"][0]["url"], timeout=180) as r, open(raw, "wb") as f:
                f.write(r.read())
        out = os.path.join(outdir(name), name + ".png")
        size = cutout(raw, out, MAXDIM.get(name, 640), name in FLIP)
        return f"OK   {name:10s} {size[0]}x{size[1]}  {os.path.getsize(out)//1024:4d}KB  {time.time()-t0:.1f}s"
    except Exception as e:
        return f"FAIL {name:10s} {type(e).__name__}: {e}"


if __name__ == "__main__":
    want = sys.argv[1:] or list(SPRITES)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        futs = {ex.submit(make, n, SPRITES[n]): n for n in want if n in SPRITES}
        for f in concurrent.futures.as_completed(futs):
            print(f.result(), flush=True)

    # ── обязательный контроль: все машинки должны смотреть вправо
    try:
        import subprocess
        subprocess.run([sys.executable, os.path.join(BASE, "tools/check_dirs.py"), "--fix"], check=False)
    except Exception as e:
        print("проверка направления не запустилась:", e)

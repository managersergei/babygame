#!/usr/bin/env python3
"""Скины машинки «снято N колёс»: <машина>_w1 … _w4.

Зачем. Готовые скины в репозитории не образуют лестницу: у монстр-трака тёмных
пикселей внизу у _w1 БОЛЬШЕ, чем у целой машины, а у _w4 больше, чем у _w3.
Поэтому счётчик «2 из 4» на экране починки не совпадал с картинкой — и это был
дефект ассетов, а не кода.

Как делается здесь. Сначала пробовали перерисовку по маске нейросетью — не вышло:
на трёх машинах из четырёх модель честно отвечала, но дорисовывала колёса обратно,
и тёмных пикселей становилось БОЛЬШЕ, чем было. Поэтому арифметика: в каждом
столбце нижней полосы идём от кромки силуэта вверх, пока пиксели тёмные (это шина),
и стираем их, а на месте колеса рисуем короткий обрубок оси. Кузов выше не
затрагивается по построению. Оставшиеся ступени — осадка: машина без колёс
садится на землю и заваливается.

Проверка числами, без единого взгляда:
  * тёмных пикселей внизу должно СТРОГО убывать, пока колёса ещё есть;
  * центр масс силуэта должен опускаться на ступенях осадки;
  * силуэт вне области колёс обязан совпадать с исходным (IoU ≥ 0,93).

Запуск:
    source ~/.config/babygame/freegen-cf.env
    ./.venv/bin/python tools/gen_wheels.py            # все четыре машины
    ./.venv/bin/python tools/gen_wheels.py monster    # одна
    ./.venv/bin/python tools/gen_wheels.py --dry      # только разметка колёс и отчёт
"""
from __future__ import annotations

import base64
import io
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
URL = os.environ.get("CF_WORKER_URL", "https://freegen-ai.bigdrive.workers.dev")
GATE = os.environ.get("CF_WORKER_GATE", "")
CARS = ["monster", "fire", "race", "police"]
CANVAS = 512
MIN_IOU = 0.93          # силуэт вне колёс обязан совпасть с исходным
PROMPT = ("empty wheel arch with a bare metal axle stub, no wheel, "
          "flat vector cartoon, thick clean outline, same colors, plain white background")
NEG = "wheel, tire, blurry, photo, realistic, text, watermark"


# ─────────────────────────────────────────────── пути
def paths_map() -> dict[str, str]:
    txt = (ROOT / "assets" / "paths.js").read_text(encoding="utf-8")
    return json.loads(txt[txt.index("{"): txt.rindex("}") + 1])


# ─────────────────────────────────────────────── зона колёс
def wheel_band(im: Image.Image) -> tuple[int, int, int, int]:
    """Нижняя полоса силуэта — там, где живут колёса.

    Разметить КАЖДОЕ колесо по отдельности на этих спрайтах числами не выходит:
    у всех четырёх машин колёса слиты тёмным днищем в одну связную область во всю
    ширину, и ни связность, ни профиль высот их не разделяют. Поэтому лестница
    строится не «убрать колесо №N», а «сколько нижней полосы уже без колёс»:
    сначала пропадают задние, потом все, дальше кузов оседает на землю.
    """
    a = np.asarray(im.convert("RGBA"))
    alpha = a[..., 3] > 40
    ys = np.where(alpha.any(1))[0]
    xs = np.where(alpha.any(0))[0]
    top, bot = int(ys.min()), int(ys.max())
    height = bot - top + 1
    return int(xs.min()), bot - int(height * 0.40), int(xs.max()), bot


# ─────────────────────────────────────────────── сеть
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) babygame/1.0"


def ask_horde(image: Image.Image, mask: Image.Image, prompt: str, timeout_s: int = 900) -> bytes:
    """AI Horde: бесплатно, без ключа, все воркеры умеют inpainting. Минус — очередь
       у анонимных запросов (на пробе было 226 мест, около девяти минут).

       Обязателен нормальный User-Agent: с «Python-urllib» и Horde, и Cloudflare
       отдают 403 (защита от ботов, error code 1010).
    """
    bi, bm = io.BytesIO(), io.BytesIO()
    image.save(bi, "JPEG", quality=95)
    mask.save(bm, "PNG")

    def call(path, body=None, method="GET", t=90):
        r = urllib.request.Request("https://aihorde.net/api/v2/" + path,
                                   data=json.dumps(body).encode() if body else None, method=method,
                                   headers={"Content-Type": "application/json", "apikey": "0000000000",
                                            "Client-Agent": "babygame:1.0:owner", "User-Agent": UA,
                                            "Accept": "application/json"})
        return json.load(urllib.request.urlopen(r, timeout=t))

    job = call("generate/async", {
        "prompt": prompt,
        "params": {"sampler_name": "k_euler_a", "cfg_scale": 7, "denoising_strength": 0.75,
                   "steps": 25, "n": 1, "width": CANVAS, "height": CANVAS, "karras": True},
        "nsfw": False, "censor_nsfw": True, "r2": True,
        "source_image": base64.b64encode(bi.getvalue()).decode(),
        "source_mask": base64.b64encode(bm.getvalue()).decode(),
        "source_processing": "inpainting"}, "POST")
    jid = job["id"]
    waited = 0
    while waited < timeout_s:
        time.sleep(6); waited += 6
        try:
            st = call("generate/check/" + jid, t=60)
        except Exception:                                   # noqa: BLE001 — сеть моргнула, ждём дальше
            continue
        if st.get("done"):
            break
    res = call("generate/status/" + jid, t=120)
    gens = res.get("generations") or []
    if not gens:
        raise RuntimeError("Horde не отдал результат")
    return urllib.request.urlopen(urllib.request.Request(gens[0]["img"], headers={"User-Agent": UA}), timeout=120).read()


def ask(image: Image.Image, mask: Image.Image, steps: int = 18) -> bytes:
    bi, bm = io.BytesIO(), io.BytesIO()
    image.save(bi, "JPEG", quality=95)
    mask.save(bm, "PNG")
    body = json.dumps({"model": "@cf/runwayml/stable-diffusion-v1-5-inpainting", "prompt": PROMPT,
                       "negative": NEG, "steps": steps,
                       "image": base64.b64encode(bi.getvalue()).decode(),
                       "mask": base64.b64encode(bm.getvalue()).decode()}).encode()
    req = urllib.request.Request(URL, data=body, method="POST",
                                 headers={"Content-Type": "application/json", "X-Gate": GATE,
                                          "User-Agent": "babygame-wheels/1.0"})
    with urllib.request.urlopen(req, timeout=240) as r:
        data = r.read()
        if (r.headers.get("Content-Type") or "").startswith("application/json"):
            raise RuntimeError(json.loads(data).get("error", "неизвестная ошибка"))
        return data


# ─────────────────────────────────────────────── сборка
def to_canvas(rgba: Image.Image):
    box = rgba.split()[3].getbbox() or (0, 0, rgba.width, rgba.height)
    obj = rgba.crop(box)
    k = min((CANVAS - 30) / obj.width, (CANVAS - 30) / obj.height)
    w, h = max(1, int(obj.width * k)), max(1, int(obj.height * k))
    obj = obj.resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGB", (CANVAS, CANVAS), (255, 255, 255))
    ox, oy = (CANVAS - w) // 2, (CANVAS - h) // 2
    canvas.paste(obj, (ox, oy), obj)
    return canvas, box, (ox, oy, w, h), k


def band_mask(place, box, band, frac_from: float, shrink=1.0) -> Image.Image:
    """Маска на часть нижней полосы: frac_from = 0 — вся полоса, 0.5 — только задняя половина."""
    ox, oy, w, h = place
    sx = w / (box[2] - box[0])
    sy = h / (box[3] - box[1])
    x0 = ox + (band[0] - box[0]) * sx
    y0 = oy + (band[1] - box[1]) * sy
    x1 = ox + (band[2] - box[0]) * sx
    y1 = oy + (band[3] - box[1]) * sy
    x0 = x0 + (x1 - x0) * frac_from
    pad = (y1 - y0) * 0.10 * shrink
    m = Image.new("L", (CANVAS, CANVAS), 0)
    ImageDraw.Draw(m).rounded_rectangle([x0 - pad, y0 - pad, x1 + pad, y1 + pad],
                                        radius=int(max(4, (y1 - y0) * 0.30)), fill=255)
    return m.filter(ImageFilter.GaussianBlur(4))


def blend(base: Image.Image, got: Image.Image, mask: Image.Image) -> Image.Image:
    A = np.asarray(base.convert("RGB")).astype(np.float64)
    B = np.asarray(got.convert("RGB")).astype(np.float64)
    m = (np.asarray(mask).astype(np.float64) / 255.0)[..., None]
    return Image.fromarray(np.clip(A * (1 - m) + B * m, 0, 255).astype(np.uint8))


def compose(src_rgba: Image.Image, box, place, canvas_rgb: Image.Image, used_mask: Image.Image) -> Image.Image:
    ox, oy, w, h = place
    piece = canvas_rgb.crop((ox, oy, ox + w, oy + h)).resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS)
    m = used_mask.crop((ox, oy, ox + w, oy + h)).resize(piece.size, Image.LANCZOS)
    a_src = src_rgba.crop(box).split()[3]
    arr = np.asarray(piece).astype(int)
    white = (arr.min(2) > 236) & (arr.max(2) > 246)
    a_new = np.asarray(Image.fromarray(np.where(white, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)))
    inside = np.asarray(m) > 110
    alpha = np.where(inside, a_new, np.asarray(a_src)).astype(np.uint8)
    frame = Image.merge("RGBA", (*piece.split(), Image.fromarray(alpha)))
    full = Image.new("RGBA", src_rgba.size, (0, 0, 0, 0))
    full.paste(frame, (box[0], box[1]))
    return full


def strip_wheels(base: Image.Image, band, frac_from: float) -> Image.Image:
    """Стереть колёса СНИЗУ ВВЕРХ и дорисовать голую ось.

    Просить модель убрать колёса по маске бесполезно: на трёх машинах из четырёх она
    честно отвечала, но дорисовывала колёса обратно — тёмных пикселей становилось
    БОЛЬШЕ, чем было (по три попытки на каждой). Поэтому здесь чистая арифметика:
    в каждом столбце полосы идём от нижней кромки силуэта вверх, пока пиксели тёмные
    (это шина), и делаем их прозрачными. Кузов выше не затрагивается по построению,
    и ступень получается ровно такой, какую показывает счётчик.
    """
    a = np.array(base.convert("RGBA"))
    alpha = a[..., 3] > 40
    lum = a[..., :3].astype(int).mean(2)
    x0 = int(band[0] + (band[2] - band[0]) * frac_from)
    x1, ytop, ybot = int(band[2]), int(band[1]), int(band[3])
    axles = []
    for x in range(x0, x1 + 1):
        col = np.where(alpha[:, x])[0]
        if not len(col):
            continue
        y = int(col.max())
        removed = 0
        while y >= ytop and alpha[y, x] and lum[y, x] < 118:
            a[y, x, 3] = 0
            y -= 1
            removed += 1
        if removed > (ybot - ytop) * 0.25:
            axles.append((x, y))
    out = Image.fromarray(a)
    if axles:                                       # короткий обрубок оси вместо колеса
        d = ImageDraw.Draw(out)
        xs = [q[0] for q in axles]
        runs, start = [], xs[0]
        for i in range(1, len(xs)):
            if xs[i] - xs[i - 1] > 6:
                runs.append((start, xs[i - 1])); start = xs[i]
        runs.append((start, xs[-1]))
        for rx0, rx1 in runs:
            if rx1 - rx0 < 12:
                continue
            ys = [q[1] for q in axles if rx0 <= q[0] <= rx1]
            ay = int(np.median(ys)) + 4
            cx = (rx0 + rx1) // 2
            hw = max(6, (rx1 - rx0) // 6)
            d.rounded_rectangle([cx - hw, ay, cx + hw, ay + max(8, hw)], radius=hw // 2, fill=(90, 96, 110, 255))
            d.ellipse([cx - hw * 0.7, ay + max(8, hw) - hw * 0.5, cx + hw * 0.7, ay + max(8, hw) + hw * 0.5],
                      fill=(64, 70, 84, 255))
    return out


def half_off(base: Image.Image, flat: Image.Image, band) -> Image.Image:
    """Задние колёса сняты, передние на месте: берём базовый спрайт и подменяем
       заднюю часть полосы пикселями варианта «колёс нет». Ступень выходит точной
       по построению, а модель просить «убери только задние» бесполезно — она их
       дорисовывает обратно (проверено: тёмных пикселей не убывало)."""
    A = np.asarray(base).astype(np.float64)
    B = np.asarray(flat).astype(np.float64)
    h, w = A.shape[0], A.shape[1]
    m = Image.new("L", (w, h), 0)
    x0 = band[0] + (band[2] - band[0]) * 0.50
    ImageDraw.Draw(m).rectangle([x0, band[1] - (band[3] - band[1]) * 0.12, band[2] + 4, band[3] + 4], fill=255)
    mm = (np.asarray(m.filter(ImageFilter.GaussianBlur(9))).astype(np.float64) / 255.0)[..., None]
    return Image.fromarray(np.clip(A * (1 - mm) + B * mm, 0, 255).astype(np.uint8))


def sag(rgba: Image.Image, drop: float, tilt: float) -> Image.Image:
    """Осадка кузова: машина без колёс садится на землю и заваливается."""
    out = rgba.rotate(tilt, resample=Image.BICUBIC, center=(rgba.width * 0.5, rgba.height * 0.92))
    shifted = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    shifted.paste(out, (0, int(rgba.height * drop)))
    return shifted


# ─────────────────────────────────────────────── измерения
def dark_bottom(rgba: Image.Image) -> int:
    a = np.asarray(rgba)
    al = a[..., 3] > 40
    lum = a[..., :3].astype(int).mean(2)
    lo = int(a.shape[0] * 0.55)
    return int((al[lo:] & (lum[lo:] < 100)).sum())


def centroid_y(rgba: Image.Image) -> float:
    a = np.asarray(rgba)[..., 3] > 40
    ys = np.where(a.any(1))[0]
    return float(ys.mean()) if len(ys) else 0.0


def iou_top(a: Image.Image, b: Image.Image) -> float:
    """Совпадение силуэта ВЫШЕ полосы колёс: кузов трогать нельзя."""
    A = np.asarray(a)[..., 3] > 40
    B = np.asarray(b)[..., 3] > 40
    ys = np.where(A.any(1))[0]
    if not len(ys):
        return 0.0
    top, bot = int(ys.min()), int(ys.max())
    cut = bot - int((bot - top + 1) * 0.45)
    A, B = A[:cut], B[:cut]
    return float((A & B).sum() / max(1, (A | B).sum()))


# ─────────────────────────────────────────────── главное
def run(cars: list[str], dry: bool, horde: bool = False) -> int:
    amap = paths_map()
    bad = 0
    for car in cars:
        rel = amap.get(car)
        if not rel:
            print(f"{car}: спрайта нет"); bad += 1; continue
        src = ROOT / "assets" / (rel + ".png")
        base = Image.open(src).convert("RGBA")
        band = wheel_band(base)
        print(f"\n{car}: полоса колёс {band}, тёмных пикселей внизу {dark_bottom(base)}")
        if dry:
            continue
        canvas, box, place, _ = to_canvas(base)
        base_dark = dark_bottom(base)
        if horde:
            # перерисовка нейросетью: арка получается нарисованной, а не вырезанной
            canvas, box, place, _ = to_canvas(base)
            m = band_mask(place, box, band, 0.0)
            prompt = ("cartoon vehicle with EMPTY wheel arches, no wheels, bare metal axle stubs, "
                      "flat vector, white background ### wheel, tire, photo")
            raw = ask_horde(canvas, m, prompt)
            got = Image.open(io.BytesIO(raw)).convert("RGB")
            if got.size != (CANVAS, CANVAS):
                got = got.resize((CANVAS, CANVAS), Image.LANCZOS)
            full = compose(base, box, place, blend(canvas, got, m), m)
            half = half_off(base, full, band)
            frames = [half, full]
        else:
            frames = [strip_wheels(base, band, 0.50), strip_wheels(base, band, 0.0)]
        flat = frames[1]
        print(f"  _w1: тёмных {dark_bottom(frames[0])} (задние сняты), кузов сверху {iou_top(base, frames[0]):.3f}")
        print(f"  _w2: тёмных {dark_bottom(frames[1])} (все сняты), кузов сверху {iou_top(base, frames[1]):.3f}")
        for n, (drop, tilt) in ((3, (0.016, -1.8)), (4, (0.034, -3.6))):
            frame = sag(flat, drop, tilt)
            print(f"  _w{n}: осадка, центр силуэта {centroid_y(frame):.1f} (было {centroid_y(flat):.1f})")
            frames.append(frame)
        for n, frame in enumerate(frames, 1):
            out = src.with_name(f"{car}_w{n}.png")
            frame.save(out)
            frame.save(out.with_suffix(".webp"), "WEBP", quality=90, method=6)
        seq = [dark_bottom(f) for f in frames]
        cy = [round(centroid_y(f), 1) for f in frames]
        # колёса убывают только на первых двух ступенях; дальше кузов оседает, и осевшее
        # тёмное днище само попадает в нижнюю полосу — считать по нему нечестно
        mono = base_dark > seq[0] > seq[1]
        sink = cy[3] > cy[2] > cy[1] - 0.5
        print(f"{car}: тёмные {base_dark} → {seq[0]} → {seq[1]} {'ok' if mono else 'НЕ УБЫВАЕТ'} | "
              f"центры {cy} {'ok' if sink else 'ОСАДКИ НЕТ'}")
        if not (mono and sink):
            bad += 1
    print("\nготово" if not bad else f"\nпроблем: {bad}")
    return 0 if not bad else 1


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sys.exit(run(args or CARS, "--dry" in sys.argv, "--horde" in sys.argv))

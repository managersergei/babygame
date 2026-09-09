#!/usr/bin/env python3
"""Кадры анимации окружения: <имя>_b и <имя>_c к существующему спрайту <имя>.

Почему именно перерисовка по маске, а не генерация заново.
  Прошлая попытка (08.09.2026) делала кадры текстом «нарисуй такую же корову, но
  жующую». Совпадение силуэта выходило 0,36–0,55 при нужных 0,8 — каждый кадр был
  другой коровой, и на 2–8 кадрах в секунду это читалось как мигание.
  Здесь модель получает САМ спрайт и маску: всё вне маски она не трогает вовсе,
  поэтому силуэт и палитра совпадают по построению, а меняется только та часть,
  которая и должна двигаться.

Как проверяется результат (без глаз, числами):
  * силуэт: IoU нового кадра с базовым ≥ MIN_IOU;
  * палитра: средний цвет объекта не должен уехать больше чем на MAX_DRIFT;
  * область ВНЕ маски обязана остаться прежней (иначе модель «переехала» весь спрайт);
  * область ВНУТРИ маски обязана измениться — иначе кадр бессмысленный.
Кадр, не прошедший проверку, не сохраняется: повторяем с другим зерном и меньшей
маской, а если не вышло — честно пишем «не получилось» и идём дальше.

Запуск:
    source ~/.config/babygame/freegen-cf.env
    ./.venv/bin/python tools/gen_frames.py            # все объекты из ANIM
    ./.venv/bin/python tools/gen_frames.py cow bird   # только эти
    ./.venv/bin/python tools/gen_frames.py --dry      # без сети: только маски и отчёт
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
CANVAS = 512
MIN_IOU = 0.86          # ниже — это уже другой объект (у крыльев и монетки свой порог)
MAX_DRIFT = 4.0         # сдвиг цвета неподвижной части, из 255 (внутри маски цвет подгоняется)
MAX_OUTSIDE = 2.0       # вне маски пиксели берутся из оригинала, так что здесь должен быть ноль
MIN_INSIDE = 5.0        # ниже — кадр не отличается от базового, смысла нет
TRIES = 3

STYLE = "flat vector cartoon, thick clean outline, bright saturated colors, plain white background, same style"

# Что именно должно шевелиться у каждого объекта и какими словами это просить.
# Маска — доля от рамки спрайта (слева, сверху, справа, снизу).
JOBS = {
    # Маска узкая и по верху: там голова и загривок. Широкая маска даёт модели
    # перерисовать половину животного — тогда уезжает и силуэт, и палитра.
    "cow":        {"mask": (0.00, 0.05, 1.00, 0.30), "b": "head lowered, chewing grass",       "c": "head raised, mouth open, mooing"},
    "horse":      {"mask": (0.00, 0.03, 1.00, 0.28), "b": "head lowered to the grass",         "c": "head raised high, mane up"},
    "chicken":    {"mask": (0.00, 0.02, 1.00, 0.34), "b": "head down, pecking the ground",     "c": "head up, beak open"},
    "sheep":      {"mask": (0.00, 0.04, 1.00, 0.22), "b": "head lowered, chewing",             "c": "head turned up", "iou": 0.82},
    "hedgehog":   {"mask": (0.00, 0.62, 1.00, 1.00), "b": "tiny legs stepping forward",        "c": "tiny legs stepping back"},
    "loc_monkey": {"mask": (0.00, 0.00, 1.00, 0.34), "b": "arms raised up",                    "c": "arms lowered, head tilted"},
    # у мельницы, крыльев и монетки движется почти весь объект — порог силуэта ниже
    "windmill":   {"mask": (0.06, 0.00, 0.94, 0.46), "b": "blades turned a little clockwise",  "c": "blades turned further clockwise", "iou": 0.78},
    "butterfly":  {"mask": (0.00, 0.00, 1.00, 0.60), "b": "wings raised up together",          "c": "wings spread wide open", "iou": 0.74},
    "bird":       {"mask": (0.00, 0.00, 1.00, 0.52), "b": "wings raised up",                   "c": "wings pushed down", "iou": 0.76},
    "coin":       {"mask": (0.26, 0.00, 0.74, 1.00), "b": "seen at a slight angle, narrower",  "c": "seen almost edge-on, thin", "iou": 0.72},
}



# ─────────────────────────────────────────────────────────── пути к спрайтам
def paths_map() -> dict[str, str]:
    txt = (ROOT / "assets" / "paths.js").read_text(encoding="utf-8")
    return json.loads(txt[txt.index("{"): txt.rindex("}") + 1])


def base_png(name: str, amap: dict[str, str]) -> Path | None:
    rel = amap.get(name)
    if not rel:
        return None
    p = ROOT / "assets" / (rel + ".png")
    return p if p.exists() else None


# ─────────────────────────────────────────────────────────── подготовка входа
def prepare(src: Path):
    """Спрайт на белом холсте 512×512 + рамка, куда он лёг."""
    im = Image.open(src).convert("RGBA")
    box = im.split()[3].getbbox() or (0, 0, im.width, im.height)
    obj = im.crop(box)
    scale = min((CANVAS - 40) / obj.width, (CANVAS - 40) / obj.height)
    w, h = max(1, int(obj.width * scale)), max(1, int(obj.height * scale))
    obj = obj.resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGB", (CANVAS, CANVAS), (255, 255, 255))
    ox, oy = (CANVAS - w) // 2, (CANVAS - h) // 2
    canvas.paste(obj, (ox, oy), obj)
    return im, box, canvas, (ox, oy, w, h)


def make_mask(place, rel, shrink: float = 1.0) -> Image.Image:
    ox, oy, w, h = place
    l, t, r, b = rel
    cx, cy = ox + w * (l + r) / 2, oy + h * (t + b) / 2
    hw, hh = w * (r - l) / 2 * shrink, h * (b - t) / 2 * shrink
    m = Image.new("L", (CANVAS, CANVAS), 0)
    ImageDraw.Draw(m).rounded_rectangle([cx - hw, cy - hh, cx + hw, cy + hh],
                                        radius=int(min(hw, hh) * 0.35), fill=255)
    return m.filter(ImageFilter.GaussianBlur(3))


# ─────────────────────────────────────────────────────────── сеть
def ask(model: str, prompt: str, image: Image.Image, mask: Image.Image, steps: int = 18) -> bytes:
    bi, bm = io.BytesIO(), io.BytesIO()
    image.save(bi, "JPEG", quality=95)
    mask.save(bm, "PNG")
    body = json.dumps({"model": model, "prompt": prompt,
                       "negative": "blurry, photo, realistic, text, watermark, different colors, extra limbs",
                       "image": base64.b64encode(bi.getvalue()).decode(),
                       "mask": base64.b64encode(bm.getvalue()).decode(),
                       "steps": steps}).encode()
    # User-Agent обязателен: с «Python-urllib» Cloudflare отдаёт 403 (error code 1010, защита от ботов)
    req = urllib.request.Request(URL, data=body, method="POST",
                                 headers={"Content-Type": "application/json", "X-Gate": GATE,
                                          "User-Agent": "babygame-frames/1.0"})
    with urllib.request.urlopen(req, timeout=240) as r:
        data = r.read()
        if (r.headers.get("Content-Type") or "").startswith("application/json"):
            raise RuntimeError(json.loads(data).get("error", "неизвестная ошибка"))
        return data


def recolor(base: Image.Image, got: Image.Image, mask: Image.Image) -> Image.Image:
    """Подгоняем палитру внутри маски под исходную: модель всегда чуть уводит цвет,
       а ребёнку важно, чтобы корова во всех кадрах была одного оттенка."""
    A = np.asarray(base.convert("RGB")).astype(np.float64)
    B = np.asarray(got.convert("RGB")).astype(np.float64)
    M = np.asarray(mask) > 127
    ink_a = M & (A.sum(2) < 700)
    ink_b = M & (B.sum(2) < 700)
    if ink_a.sum() < 50 or ink_b.sum() < 50:
        return got
    out = B.copy()
    for c in range(3):
        ma, sa = A[..., c][ink_a].mean(), A[..., c][ink_a].std() + 1e-6
        mb, sb = B[..., c][ink_b].mean(), B[..., c][ink_b].std() + 1e-6
        adj = (B[..., c] - mb) * min(2.0, sa / sb) + ma
        out[..., c] = np.where(M, np.clip(adj, 0, 255), B[..., c])
    return Image.fromarray(out.astype(np.uint8))


def blend(base: Image.Image, got: Image.Image, mask: Image.Image) -> Image.Image:
    """Вне маски берём пиксели ОРИГИНАЛА, а не то, что вернула модель.

    Inpainting обязан не трогать область вне маски, но возвращает целую картинку,
    пережатую заново: пиксели уезжают на 6–8 из 255, и по неподвижной части
    накапливается заметный сдвиг цвета. Склейка убирает это по построению —
    кадр отличается от базового ровно там, где мы и просили.
    """
    A = np.asarray(base.convert("RGB")).astype(np.float64)
    B = np.asarray(got.convert("RGB")).astype(np.float64)
    m = (np.asarray(mask).astype(np.float64) / 255.0)[..., None]
    return Image.fromarray(np.clip(A * (1 - m) + B * m, 0, 255).astype(np.uint8))


# ─────────────────────────────────────────────────────────── проверка и сборка
def measure(a: Image.Image, b: Image.Image, mask: Image.Image) -> dict:
    A = np.asarray(a.convert("RGB")).astype(int)
    B = np.asarray(b.convert("RGB")).astype(int)
    M = np.asarray(mask) > 127
    sa, sb = A.sum(2) < 700, B.sum(2) < 700
    iou = float((sa & sb).sum() / max(1, (sa | sb).sum()))
    diff = np.abs(A - B).mean(2)
    # палитру сверяем по неподвижной части: внутри маски силуэт и должен меняться,
    # и средний цвет там уезжает просто оттого, что стало больше или меньше пикселей
    ka, kb = sa & ~M, sb & ~M
    drift = float(np.linalg.norm(A[ka].mean(0) - B[kb].mean(0))) if ka.sum() > 50 and kb.sum() > 50 else 99.0
    return {"iou": iou, "drift": drift,
            "outside": float(diff[~M].mean()), "inside": float(diff[M].mean())}


def compose(base_rgba: Image.Image, box, place, out_rgb: Image.Image, mask: Image.Image) -> Image.Image:
    """Собираем кадр в размерах исходного файла и возвращаем прозрачность."""
    ox, oy, w, h = place
    piece = out_rgb.crop((ox, oy, ox + w, oy + h)).resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS)
    m = mask.crop((ox, oy, ox + w, oy + h)).resize(piece.size, Image.LANCZOS)
    src = base_rgba.crop(box)
    a_src = src.split()[3]
    # внутри маски прозрачность выводим по белому фону, снаружи оставляем исходную
    arr = np.asarray(piece).astype(int)
    white = (arr.min(2) > 236) & (arr.max(2) > 246)
    a_new = np.where(white, 0, 255).astype(np.uint8)
    a_new = np.asarray(Image.fromarray(a_new).filter(ImageFilter.GaussianBlur(0.7)))
    inside = np.asarray(m) > 127
    alpha = np.where(inside, a_new, np.asarray(a_src)).astype(np.uint8)
    frame = Image.merge("RGBA", (*piece.split(), Image.fromarray(alpha)))
    full = Image.new("RGBA", base_rgba.size, (0, 0, 0, 0))
    full.paste(frame, (box[0], box[1]))
    return full


def save(frame: Image.Image, src: Path, suffix: str) -> list[Path]:
    out = []
    p = src.with_name(src.stem + suffix + ".png")
    frame.save(p)
    out.append(p)
    w = src.with_name(src.stem + suffix + ".webp")
    frame.save(w, "WEBP", quality=90, method=6)
    out.append(w)
    return out


# ─────────────────────────────────────────────────────────── главное
def run(names: list[str], dry: bool) -> int:
    amap = paths_map()
    if not GATE and not dry:
        print("нет CF_WORKER_GATE — выполните: source ~/.config/babygame/freegen-cf.env")
        return 2
    bad = 0
    print(f"{'объект':<12} {'кадр':<5} {'IoU':>6} {'цвет':>6} {'вне':>6} {'внутри':>7}  итог")
    for name in names:
        src = base_png(name, amap)
        if not src:
            print(f"{name:<12} —     спрайт не найден")
            bad += 1
            continue
        base_rgba, box, canvas, place = prepare(src)
        for suffix, key in (("_b", "b"), ("_c", "c")):
            job = JOBS[name]
            prompt = f"{job[key]}, {STYLE}"
            done = False
            for attempt in range(TRIES):
                mask = make_mask(place, job["mask"], shrink=(1.0, 0.74, 0.52)[attempt])
                if dry:
                    print(f"{name:<12} {suffix:<5} маска {mask.getbbox()}")
                    done = True
                    break
                try:
                    raw = ask("@cf/runwayml/stable-diffusion-v1-5-inpainting", prompt, canvas, mask,
                              steps=18 + attempt * 4)
                except Exception as e:                                   # noqa: BLE001
                    print(f"{name:<12} {suffix:<5} ошибка: {str(e)[:70]}")
                    time.sleep(2)
                    continue
                got = Image.open(io.BytesIO(raw)).convert("RGB")
                if got.size != (CANVAS, CANVAS):
                    got = got.resize((CANVAS, CANVAS), Image.LANCZOS)
                got = blend(canvas, recolor(canvas, got, mask), mask)
                m = measure(canvas, got, mask)
                ok = (m["iou"] >= job.get("iou", MIN_IOU) and m["drift"] <= MAX_DRIFT
                      and m["outside"] <= MAX_OUTSIDE and m["inside"] >= MIN_INSIDE)
                print(f"{name:<12} {suffix:<5} {m['iou']:6.3f} {m['drift']:6.1f} {m['outside']:6.1f} "
                      f"{m['inside']:7.1f}  {'ok' if ok else 'мимо, повтор' if attempt < TRIES - 1 else 'НЕ ВЫШЛО'}")
                if ok:
                    files = save(compose(base_rgba, box, place, got, mask), src, suffix)
                    print(f"{'':<12} {'':<5} сохранено: " + ", ".join(f.name for f in files))
                    done = True
                    break
                time.sleep(1)
            if not done:
                bad += 1
    print("\nготово" if not bad else f"\nне получилось кадров: {bad}")
    return 0 if not bad else 1


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sys.exit(run(args or list(JOBS), "--dry" in sys.argv))

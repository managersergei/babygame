#!/usr/bin/env python3
"""Приёмка спрайта под риг: строго ли это вид сбоку.

Для физики важна не красота ракурса, а три вещи, и все три проверяются числом:
  * колесо — КРУГ (в три четверти это эллипс, и при вращении он плывёт);
  * оба колеса одного радиуса;
  * центры колёс на одной высоте.

Ищем колёса по нижней кромке силуэта: у стоящего колеса она — дуга окружности
y = cy + sqrt(r^2 - (x-cx)^2), где cy = линия земли - r. Перебираем (cx, r)
и берём те, у кого дуга совпала с кромкой лучше всего. Хафа хватает грубого:
нам нужны не пиксели, а ответ «два круга или нет».

Запуск: python3 tools/side_check.py файл.png [ещё файлы]
"""
import sys
import numpy as np
from PIL import Image


def silhouette(path):
    a = np.array(Image.open(path).convert("RGBA"))
    if a[..., 3].min() > 200:                       # без альфы — фон считаем белым
        m = ~((a[..., :3] > 235).all(axis=2))
    else:
        m = a[..., 3] > 40
    return a, m


def bottom_edge(m):
    h, w = m.shape
    bot = np.full(w, -1)
    for x in range(w):
        c = np.nonzero(m[:, x])[0]
        if len(c):
            bot[x] = c.max()
    return bot


def find_wheels(m, tol=3.0):
    """Два лучших круга по нижней кромке. Возвращает [(cx, cy, r, доля совпавших)]."""
    bot = bottom_edge(m)
    xs = np.nonzero(bot >= 0)[0]
    if len(xs) < 40:
        return []
    yg = int(np.percentile(bot[xs], 98))            # линия земли — самый низ силуэта
    W = xs.max() - xs.min() + 1
    cands = []
    for r in range(int(W * 0.06), int(W * 0.30), max(1, int(W * 0.012))):
        for cx in range(int(xs.min()) + r // 2, int(xs.max()) - r // 2, max(1, int(W * 0.01))):
            cy = yg - r
            x0, x1 = max(xs.min(), cx - r), min(xs.max(), cx + r)
            if x1 - x0 < r:
                continue
            X = np.arange(x0, x1 + 1)
            inside = np.abs(X - cx) <= r
            X = X[inside]
            want = cy + np.sqrt(np.maximum(0.0, r * r - (X - cx) ** 2))
            have = bot[X]
            good = (have >= 0) & (np.abs(have - want) <= tol + r * 0.02)
            cands.append((good.mean(), cx, cy, r))
    cands.sort(reverse=True)
    out = []
    for score, cx, cy, r in cands:
        if score < 0.75:
            break
        if all(abs(cx - o[0]) > o[2] * 1.2 for o in out):    # не тот же круг ещё раз
            out.append((cx, cy, r, score))
        if len(out) == 2:
            break
    return out


def report(path):
    a, m = silhouette(path)
    ys, xs = np.nonzero(m)
    W, H = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    wh = find_wheels(m)
    name = path.split("/")[-1]
    if len(wh) < 2:
        print(f"{name:34} НЕ ГОДИТСЯ: колёс найдено {len(wh)} (нужно 2). Силуэт {W}x{H}")
        return False
    wh.sort(key=lambda t: t[0])
    (x1, y1, r1, s1), (x2, y2, r2, s2) = wh
    dr = abs(r1 - r2) / max(r1, r2)
    dy = abs(y1 - y2) / H
    base = abs(x2 - x1) / W
    ok = dr <= 0.18 and dy <= 0.04 and base >= 0.35
    print(f"{name:34} {'ГОДИТСЯ' if ok else 'НЕ ГОДИТСЯ'}: силуэт {W}x{H} · "
          f"радиусы {r1} и {r2} (разница {dr*100:.0f}%) · "
          f"центры по высоте разошлись на {dy*100:.1f}% · "
          f"база {base*100:.0f}% ширины · совпадение дуг {s1:.2f}/{s2:.2f}")
    return ok


if __name__ == "__main__":
    any_ok = False
    for p in sys.argv[1:]:
        any_ok |= report(p)
    sys.exit(0 if any_ok else 1)

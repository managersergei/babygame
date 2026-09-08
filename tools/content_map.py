# -*- coding: utf-8 -*-
"""Карта контента игры: что где лежит и где это используется.

    python3 tools/content_map.py            # обновить КОНТЕНТ.md

Ходит по index.html и assets/, раскладывает спрайты по смысловым группам, собирает слова уроков,
реплики диктора и музыку. Ничего не перемещает — только описывает, чтобы можно было найти фрагмент.
"""
import io, json, os, re, subprocess

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = io.open(os.path.join(BASE, "index.html"), encoding="utf-8").read()

GROUPS = [
    ("Машинки игрока", "cars", r"^(monster|fire|race|police)$"),
    ("Скины машинок: цвет", "cars", r"^(monster|fire|race|police)_(black|red|yellow)$"),
    ("Скины машинок: поломки", "cars", r"^(monster|fire|race|police)_d[123]$"),
    ("Скины машинок: без колёс", "cars", r"^(monster|fire|race|police)_w[0-4]$"),
    ("Транспорт у дороги", "cars", r"^(ambulance|bus|excavator|garbage|tractor|tow)$"),
    ("Дорога и препятствия", "world", r"^(cone|ramp|pit|puddle|crossing|launchpad|restart)$"),
    ("Что собирать", "world", r"^(star|coin|chest|apple|balloon|fuel|fuel_empty|paint|wheel)$"),
    ("Живность", "world", r"^(cow|horse|chicken|sheep|hedgehog|butterfly|bird|loc_monkey)$"),
    ("Монстрики и робот", "world", r"^(monster_[a-d](_run)?|robot|master)$"),
    ("Растения и природа", "world", r"^(tree|bush|flower|daisies|haystack|loc_palm|loc_fir|loc_jungle|sun|cloud|arch)$"),
    ("Постройки и локации", "world", r"^(house|fence|windmill|loc_tower|loc_shop|loc_rock|loc_rocket|loc_umbrella|loc_snowman|door)$"),
    ("Транспорт фона", "world", r"^(train|plane|ball)$"),
    ("Прочее", "world", r"^(headlight)$"),
]

import sys
sys.path.insert(0, os.path.join(BASE, "tools"))
from assets_paths import all_sprites, sprite_path

def files(sub):
    return [n for n, _p in all_sprites(sub, "webp")]

def size_kb(sub, name):
    p = sprite_path(name, "webp")
    return os.path.getsize(p) // 1024 if os.path.exists(p) else 0

def folder_of(name):
    from assets_paths import paths
    return os.path.dirname(paths().get(name, ""))

def fnv(s):
    h = 0x811c9dc5
    for b in s.encode("utf-8"):
        h ^= b; h = (h * 0x01000193) & 0xFFFFFFFF
    return "%08x" % h

# слова уроков
words = re.findall(r"\n  \['([a-z_0-9]+)','([^']+)','([^']+)','([^']+)','([^']*)','([^']*)'\]", SRC)
order = re.search(r"var LESSON_ORDER = \[(.*?)\];", SRC, re.S)
order_keys = re.findall(r"'([a-z_0-9]+)'", order.group(1)) if order else []

# реплики
says = sorted(set(re.findall(r"A\.say\('((?:[^'\\]|\\.)*)'\)", SRC)))
voice_files = [f for f in os.listdir(os.path.join(BASE, "assets/voice")) if f.endswith(".mp3")]

out = ["# Карта контента игры", "",
       "Сгенерировано `tools/content_map.py`. Здесь видно, что где лежит и как называется, чтобы",
       "найти нужный фрагмент, не листая 260 КБ `index.html`.", ""]

out.append("## Спрайты\n")
used = set()
for title, sub, pat in GROUPS:
    rx = re.compile(pat)
    got = [f for f in files(sub) if rx.match(f)]
    used.update((sub, f) for f in got)
    if not got:
        continue
    tot = sum(size_kb(sub, f) for f in got)
    out.append("**%s** — `assets/%s/`, %d файлов, %d КБ" % (title, folder_of(got[0]) or sub, len(got), tot))
    out.append(": " + ", ".join("`%s`" % f for f in got) + "\n")
rest = [(sub, f) for sub in ("cars", "world") for f in files(sub) if (sub, f) not in used]
if rest:
    out.append("**Не разложено по группам**: " + ", ".join("`%s/%s`" % r for r in rest) + "\n")

out.append("## Слова, которым учит игра\n")
out.append("| # | Ключ | Слово | Как произносим | Подсказка диктора |")
out.append("|---|---|---|---|---|")
for i, k in enumerate(order_keys):
    w = next((x for x in words if x[0] == k), None)
    if w:
        out.append("| %d | `%s` | %s | %s | %s |" % (i + 1, k, w[1], w[2], w[5]))
    else:
        out.append("| %d | `%s` | — | — | сценарный урок (см. `LESSONS` в index.html) |" % (i + 1, k))
out.append("")

out.append("## Озвучка\n")
out.append("Файлы: `assets/voice/<хеш>.mp3`, имя — FNV-1a от точного текста; список — `assets/voice/list.js`.")
out.append("Всего файлов: **%d**. Проверка соответствия: `python3 tools/check_voice.py`." % len(voice_files))
out.append("Генерация: `python3 tools/gen_voice.py --engine free` (бесплатный движок) или с ключом проекта.\n")
out.append("| Реплика | Файл |")
out.append("|---|---|")
for t in says[:40]:
    out.append("| %s | `%s.mp3` |" % (t.replace("|", "\\|"), fnv(t)))
out.append("\nВсего разных реплик в коде: %d (показаны первые 40).\n" % len(says))

mus = sorted(f for f in os.listdir(os.path.join(BASE, "assets/music")) if f.endswith(".mp3"))
out.append("## Музыка\n")
out.append("`assets/music/`: " + ", ".join("`%s`" % m for m in mus) + ". Играют по кругу в случайном порядке.\n")

out.append("## Где что лежит в коде\n")
sections = re.findall(r"/\* ═+ ([^═]+?) ═+ \*/", SRC)
out.append("Разделы `index.html` (по порядку): " + ", ".join(sections) + "\n")

out.append("## Ролики и сториборды\n")
out.append("* `reels/scenes/` — 20 сцен вертикальных роликов, собираются `node reels/build.mjs`.")
out.append("* `reels/storyboards/` — 20 историй для ИИ-роликов, кадры и промпты в `story.md` каждой папки.")
out.append("* `tg/` — реле для отчётов родителю в Telegram.\n")

io.open(os.path.join(BASE, "КОНТЕНТ.md"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("КОНТЕНТ.md обновлён: спрайтов %d, слов %d, реплик %d, файлов озвучки %d"
      % (len(files("cars")) + len(files("world")), len(order_keys), len(says), len(voice_files)))

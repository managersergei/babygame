# -*- coding: utf-8 -*-
"""Сториборды через fal.ai Nano Banana Pro: по кадру 9:16 (1K) на каждый шот.
FAL_KEY=… python3 reels/storyboards/gen.py [A01 …] [--dry]
Кадры с машинкой идут через /edit с референсом assets/cars/fire.png (Image 1)."""
import base64, json, os, sys, time, urllib.request, concurrent.futures
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stories import STORIES
BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.dirname(os.path.abspath(__file__))
KEY = os.environ.get('FAL_KEY', ''); DRY = '--dry' in sys.argv
only = [a for a in sys.argv[1:] if a.startswith('A')]
REF = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(BASE, 'assets/cars/fire.png'), 'rb').read()).decode()
LOG = os.path.join(OUT, 'gen-log.csv')

def call(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Authorization': 'Key ' + KEY, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=240) as r: return json.loads(r.read().decode())

def gen(story, i, shot):
    d = os.path.join(OUT, story['id']); os.makedirs(d, exist_ok=True)
    path = os.path.join(d, 'shot%d.png' % (i + 1))
    if os.path.exists(path): return 'skip'
    if DRY: return 'dry'
    body = {'prompt': shot['prompt'], 'num_images': 1, 'aspect_ratio': '9:16', 'resolution': '1K', 'output_format': 'png'}
    tries = [('https://fal.run/fal-ai/nano-banana-pro/edit', dict(body, image_urls=[REF]))] if shot['ref'] else []
    tries.append(('https://fal.run/fal-ai/nano-banana-pro', body))
    err = None
    for url, b in tries:
        try:
            res = call(url, b); img = res['images'][0]['url']
            urllib.request.urlretrieve(img, path)
            with open(LOG, 'a') as f: f.write('%s,%s,%d,%s\n' % (time.strftime('%F %T'), story['id'], i + 1, url.rsplit('/', 2)[-1]))
            return 'ok ' + ('ref' if 'edit' in url else 'txt')
        except Exception as e:
            err = e
    return 'FAIL ' + str(err)[:120]

jobs = []
for s in STORIES:
    if only and s['id'][:3] not in only: continue
    for i, sh in enumerate(s['shots']): jobs.append((s, i, sh))
print('шотов:', len(jobs), '(dry)' if DRY else '')
with concurrent.futures.ThreadPoolExecutor(3) as ex:
    for (s, i, sh), r in zip(jobs, ex.map(lambda j: gen(*j), jobs)):
        print(s['id'], i + 1, r, flush=True)

# story.md на каждую историю + index.md + контактные листы
try:
    from PIL import Image
except ImportError:
    Image = None
idx = ['# Сториборды (ИИ-рилсы)\n', 'Шот = 2–3 с. Кадры — Nano Banana Pro (fal.ai), 9:16, 1K. Оживление по шотам — следующий этап (Kling 3.0 / Seedance, ≤3 с на шот).\n']
for s in STORIES:
    d = os.path.join(OUT, s['id']); os.makedirs(d, exist_ok=True)
    md = ['# %s — «%s»\n' % (s['id'], s['title']), 'Крючок: **%s**\n' % s['hook'], '| # | Время | Что в кадре | Движение (для I2V) | Кадр |', '|---|---|---|---|---|']
    for i, sh in enumerate(s['shots']):
        md.append('| %d | %s | %s | %s | ![](shot%d.png) |' % (i + 1, sh['t'], sh['what'], sh['motion'], i + 1))
    md.append('\n## Промпты\n')
    for i, sh in enumerate(s['shots']): md.append('**Shot %d** (%s): %s\n' % (i + 1, 'с референсом машинки' if sh['ref'] else 'без референса', sh['prompt']))
    open(os.path.join(d, 'story.md'), 'w', encoding='utf-8').write('\n'.join(md))
    have = [os.path.join(d, 'shot%d.png' % (i + 1)) for i in range(len(s['shots']))]
    have = [p for p in have if os.path.exists(p)]
    if Image and have:
        w, h = 270, 480; sheet = Image.new('RGB', (w * len(have), h), (43, 33, 64))
        for k, p in enumerate(have):
            im = Image.open(p).convert('RGB'); im.thumbnail((w, h)); sheet.paste(im, (k * w + (w - im.width) // 2, (h - im.height) // 2))
        sheet.save(os.path.join(d, 'contact.jpg'), quality=85)
    idx.append('- **%s** «%s» — %s · шотов: %d, кадров: %d · [story.md](%s/story.md)' % (s['id'], s['title'], s['hook'], len(s['shots']), len(have), s['id']))
open(os.path.join(OUT, 'index.md'), 'w', encoding='utf-8').write('\n'.join(idx) + '\n')
print('index.md готов')

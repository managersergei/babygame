# -*- coding: utf-8 -*-
"""Сториборды: по кадру 9:16 на каждый шот.
STORYBOARD_BACKEND=freegen python3 reels/storyboards/gen.py [A01 …] [--dry]   # бесплатный роутер ~/Documents/freegen
BABYGAME_FAL_KEY=… python3 reels/storyboards/gen.py [A01 …] [--dry]           # прежний путь через fal (по умолчанию пока)
Кадры с машинкой идут через /edit с референсом assets/cars/fire.png (Image 1)."""
import base64, json, os, subprocess, sys, time, urllib.request, concurrent.futures
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stories import STORIES as S1, TRUCK, TRUCK_PLAIN
try:
    from stories2 import STORIES as S2
except ImportError:
    S2 = []
STORIES = S1 + S2
BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.dirname(os.path.abspath(__file__))
KEY = os.environ.get('BABYGAME_FAL_KEY', ''); DRY = '--dry' in sys.argv
BACKEND = os.environ.get('STORYBOARD_BACKEND', 'fal')        # 'fal' — прежнее поведение 1:1; 'freegen' — бесплатный роутер
FREEGEN_PY = os.path.expanduser(os.environ.get('FREEGEN_PY', '~/Documents/freegen/.venv/bin/python'))
WORK = os.path.join(OUT, '.freegen')                         # pending.json / manifest.json (в .gitignore)
only = [a for a in sys.argv[1:] if a[:1] in 'AB' and a[1:3].isdigit()]
_REF = None
def ref_data_url():
    """Референс машинки читается лениво — только в fal-ветке; --dry и freegen без него."""
    global _REF
    if _REF is None:
        _REF = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(BASE, 'assets/cars/fire.png'), 'rb').read()).decode()
    return _REF

def is_valid_image(path):
    """Готов = валидная картинка ≥ 4 КБ, а не просто «файл существует» (усечённый после ENOSPC — не готов)."""
    try:
        if os.path.getsize(path) < 4096: return False
        from PIL import Image
        Image.open(path).verify(); return True
    except ImportError:
        return os.path.exists(path)
    except Exception:
        return False
LOG = os.path.join(OUT, 'gen-log.csv')

def call(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Authorization': 'Key ' + KEY, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=240) as r: return json.loads(r.read().decode())

def gen(story, i, shot):
    d = os.path.join(OUT, story['id']); os.makedirs(d, exist_ok=True)
    path = os.path.join(d, 'shot%d.jpg' % (i + 1))
    if is_valid_image(path): return 'skip'
    if DRY: return 'dry'
    body = {'prompt': shot['prompt'], 'num_images': 1, 'aspect_ratio': '9:16', 'resolution': '1K', 'output_format': 'jpeg'}
    tries = [('https://fal.run/fal-ai/nano-banana-pro/edit', dict(body, image_urls=[ref_data_url()]))] if shot['ref'] else []
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
def run_freegen(jobs):
    """pending.json только для шотов без валидного файла → freegen batch → manifest. Ключи fal в этот процесс не попадают."""
    os.makedirs(WORK, exist_ok=True)
    spec_path, man_path = os.path.join(WORK, 'pending.json'), os.path.join(WORK, 'manifest.json')
    todo = [(s, i, sh) for s, i, sh in jobs if not is_valid_image(os.path.join(OUT, s['id'], 'shot%d.jpg' % (i + 1)))]
    spec = {'version': 1,
            'defaults': {'size': '1080x1920', 'format': 'jpg', 'fit': 'cover', 'style': 'babygame-3d',
                         'ref_policy': 'prefer', 'ref_less_replacements': {TRUCK: TRUCK_PLAIN}},
            'jobs': [{'id': '%s/shot%d' % (s['id'], i + 1), 'prompt': sh['prompt'],
                      'reference': os.path.join(BASE, 'assets/cars/fire.png') if sh['ref'] else None,
                      'out': os.path.join(OUT, s['id'], 'shot%d.jpg' % (i + 1)),
                      'tags': {'story': s['id'], 'shot': str(i + 1)}} for s, i, sh in todo]}
    with open(spec_path, 'w', encoding='utf-8') as f: json.dump(spec, f, ensure_ascii=False, indent=1)
    if os.path.exists(man_path): os.remove(man_path)
    if not os.path.exists(FREEGEN_PY): sys.exit('freegen не найден: %s (тихого отката на fal нет)' % FREEGEN_PY)
    env = dict((k, os.environ[k]) for k in ('PATH', 'HOME', 'LANG', 'FREEGEN_HOME', 'FREEGEN_CONFIG') if k in os.environ)
    cmd = [FREEGEN_PY, '-m', 'freegen', 'batch', spec_path, '--manifest', man_path, '--workers', '3'] + (['--dry'] if DRY else [])
    subprocess.run(cmd, env=env)
    man = json.load(open(man_path, encoding='utf-8')).get('jobs', {}) if os.path.exists(man_path) else {}
    out = {}
    for s, i, sh in jobs:
        j = man.get('%s/shot%d' % (s['id'], i + 1))
        if j is None: out[(s['id'], i + 1)] = 'skip'; continue
        st = j.get('status')
        if st == 'done':
            out[(s['id'], i + 1)] = 'ok %s %s' % ('ref' if j.get('ref_used') else 'txt', j.get('provider'))
            with open(LOG, 'a') as f: f.write('%s,%s,%d,%s\n' % (time.strftime('%F %T'), s['id'], i + 1, '%s/%s' % (j.get('provider'), j.get('model'))))
        else:
            out[(s['id'], i + 1)] = {'skipped': 'skip', 'dry': 'dry', 'refused': 'REFUSED content'}.get(st, 'FAIL %s' % (j.get('error_kind') or st))
    return out

if BACKEND == 'freegen':
    res = run_freegen(jobs)
    for s, i, sh in jobs: print(s['id'], i + 1, res[(s['id'], i + 1)], flush=True)
else:
    with concurrent.futures.ThreadPoolExecutor(3) as ex:
        for (s, i, sh), r in zip(jobs, ex.map(lambda j: gen(*j), jobs)):
            print(s['id'], i + 1, r, flush=True)

# story.md на каждую историю + index.md + контактные листы
try:
    from PIL import Image
except ImportError:
    Image = None
idx = ['# Сториборды (ИИ-рилсы)\n', 'Шот = 2–3 с. Кадры — ' + ('freegen (провайдер и модель в shotN.json), 9:16, 1080×1920.' if BACKEND == 'freegen' else 'Nano Banana Pro (fal.ai), 9:16, 1K.') + ' Оживление по шотам — следующий этап (Kling 3.0 / Seedance, ≤3 с на шот).\n']
for s in STORIES:
    d = os.path.join(OUT, s['id']); os.makedirs(d, exist_ok=True)
    md = ['# %s — «%s»\n' % (s['id'], s['title']), 'Крючок: **%s**\n' % s['hook'], '| # | Время | Что в кадре | Движение (для I2V) | Кадр |', '|---|---|---|---|---|']
    for i, sh in enumerate(s['shots']):
        md.append('| %d | %s | %s | %s | ![](shot%d.jpg) |' % (i + 1, sh['t'], sh['what'], sh['motion'], i + 1))
    md.append('\n## Промпты\n')
    used = {}
    if os.path.exists(LOG):
        for line in open(LOG, encoding='utf-8'):
            parts = line.strip().split(',')
            if len(parts) == 4 and parts[1] == s['id']: used[int(parts[2])] = parts[3]
    for i, sh in enumerate(s['shots']):
        how = used.get(i + 1)
        sc = os.path.join(d, 'shot%d.json' % (i + 1))
        if os.path.exists(sc):
            try:
                j = json.load(open(sc, encoding='utf-8')); how = '%s/%s, референс: %s' % (j.get('provider'), j.get('model'), 'да' if j.get('ref_used') else 'нет')
            except Exception:
                pass
        md.append('**Shot %d** (%s): %s\n' % (i + 1, ('сгенерирован через ' + how) if how else ('с референсом машинки' if sh['ref'] else 'без референса'), sh['prompt']))
    open(os.path.join(d, 'story.md'), 'w', encoding='utf-8').write('\n'.join(md))
    have = [os.path.join(d, 'shot%d.jpg' % (i + 1)) for i in range(len(s['shots']))]
    have = [p for p in have if os.path.exists(p)]
    if Image and have:
        w, h = 270, 480; sheet = Image.new('RGB', (w * len(have), h), (43, 33, 64))
        for k, p in enumerate(have):
            try:
                im = Image.open(p).convert('RGB')
            except Exception:
                print('пропущен битый кадр:', p); continue
            im.thumbnail((w, h)); sheet.paste(im, (k * w + (w - im.width) // 2, (h - im.height) // 2))
        sheet.save(os.path.join(d, 'contact.jpg'), quality=85)
    idx.append('- **%s** «%s» — %s · шотов: %d, кадров: %d · [story.md](%s/story.md)' % (s['id'], s['title'], s['hook'], len(s['shots']), len(have), s['id']))
open(os.path.join(OUT, 'index.md'), 'w', encoding='utf-8').write('\n'.join(idx) + '\n')
print('index.md готов')

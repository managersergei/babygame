"""Звуковая дорожка ролика из лога событий: реплики диктора (mp3 по FNV-хешу текста) в нужное время.
python3 reels/mix.py events.json out.wav DUR_SEC  →  код 1, если у реплики нет mp3."""
import json, os, subprocess, sys
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def fnv(s):
    h = 0x811c9dc5
    for b in s.encode('utf-8'): h ^= b; h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h
ev = json.load(open(sys.argv[1], encoding='utf-8')); out = sys.argv[2]; dur = float(sys.argv[3])
says = [(e['t'], json.loads(e['data'])) for e in ev if e.get('name') == 'say']
missing = [t for _, t in says if not os.path.exists(os.path.join(BASE, 'assets/voice', fnv(t) + '.mp3'))]
if missing:
    for t in missing: print('НЕТ ОЗВУЧКИ:', repr(t), fnv(t))
    sys.exit(1)
# -t ДО -i: ограничение входа anullsrc (иначе тишина бесконечна и WAV растёт, пока не кончится диск — было 46 ГБ)
cmd = ['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-t', str(dur), '-i', 'anullsrc=r=48000:cl=stereo']
fl = []
for i, (t, txt) in enumerate(says):
    cmd += ['-i', os.path.join(BASE, 'assets/voice', fnv(txt) + '.mp3')]
    ms = int(t * 1000); fl.append('[%d]aresample=48000,adelay=%d|%d,volume=1.0[a%d]' % (i + 1, ms, ms, i))
n = len(says)
if n:
    fl.append('[0]' + ''.join('[a%d]' % i for i in range(n)) + 'amix=inputs=%d:duration=first:normalize=0[a]' % (n + 1))
    cmd += ['-filter_complex', ';'.join(fl), '-map', '[a]']
cmd += ['-t', str(dur), '-ar', '48000', '-ac', '2', out]
subprocess.check_call(cmd); print('mix: %d реплик → %s' % (n, out))

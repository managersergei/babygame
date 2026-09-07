"""Сверка реплик с озвучкой: все литералы в A.say('...') и в полях say/ask/tip/keySay
должны иметь mp3 (имя = FNV-1a текста) в assets/voice/list.js. python3 tools/check_voice.py"""
import re, os, sys
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(BASE, 'index.html'), encoding='utf-8').read()
lst = open(os.path.join(BASE, 'assets/voice/list.js'), encoding='utf-8').read()
have = set(re.findall(r'"([0-9a-f]{8})"', lst))
def fnv(s):
    h = 0x811c9dc5
    for b in s.encode('utf-8'):
        h ^= b; h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h
texts = set()
for m in re.finditer(r"A\.say\((.*?)\);", src, re.S):
    texts.update(re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(1)))
for m in re.finditer(r"\b(?:say|ask|tip|keySay)\s*:\s*'((?:[^'\\]|\\.)*)'", src):
    texts.add(m.group(1))
texts = {t.replace("\\'", "'") for t in texts if t.strip()}
# куски конкатенаций ('Скажи: ' + w) и одиночные слова-ключи — не реплики
texts = {t for t in texts if not t.endswith(' ') and not t.startswith(' ') and t not in ('!',) and (' ' in t or t.endswith('!') or t[:1].isupper())}
missing = sorted(t for t in texts if fnv(t) not in have)
print('реплик: %d, без озвучки: %d' % (len(texts), len(missing)))
for t in missing: print('  MISSING', fnv(t), repr(t))
sys.exit(1 if missing else 0)

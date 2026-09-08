"""Иконки PWA и OG-картинка из спрайта машинки. python3 tools/make_icons.py"""
import os, sys
from PIL import Image, ImageDraw, ImageFont
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, 'tools'))
from assets_paths import sprite_path
car = Image.open(sprite_path('fire')).convert('RGBA')
def icon(size):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=(143, 211, 244, 255))
    d.ellipse([-size * 0.2, size * 0.72, size * 1.2, size * 1.3], fill=(121, 200, 106, 255))
    d.rectangle([0, size * 0.86, size, size], fill=(91, 100, 112, 255))
    w = int(size * 0.82); h = int(car.height * w / car.width)
    c = car.resize((w, h), Image.LANCZOS)
    im.alpha_composite(c, ((size - w) // 2, int(size * 0.86) - h + int(size * 0.06)))
    return im
for s in (512, 192, 180):
    icon(s).save(os.path.join(BASE, 'icons', 'icon-%d.png' % s))
# OG 1200×630
og = Image.new('RGB', (1200, 630), (143, 211, 244))
d = ImageDraw.Draw(og)
for y in range(0, 630):
    t = y / 630
    d.line([(0, y), (1200, y)], fill=(int(143 + (200 - 143) * t), int(211 + (235 - 211) * t), int(244 + (250 - 244) * t)))
d.ellipse([-300, 420, 1500, 900], fill=(121, 200, 106))
d.rectangle([0, 520, 1200, 630], fill=(91, 100, 112))
d.rectangle([0, 575, 1200, 583], fill=(242, 246, 251))
w = 520; h = int(car.height * w / car.width)
c = car.resize((w, h), Image.LANCZOS)
og.paste(c, (640, 540 - h), c)
font_paths = ['/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf', '/Library/Fonts/Arial Rounded Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf']
fp = next((p for p in font_paths if os.path.exists(p)), None)
f1 = ImageFont.truetype(fp, 96) if fp else ImageFont.load_default()
f2 = ImageFont.truetype(fp, 44) if fp else ImageFont.load_default()
def txt(x, y, s, f, fill, stroke):
    d.text((x, y), s, font=f, fill=fill, stroke_width=6, stroke_fill=stroke)
txt(70, 110, 'МАШИНКИ', f1, (255, 255, 255), (43, 108, 176))
txt(70, 230, 'игра, где ребёнок говорит', f2, (255, 255, 255), (224, 105, 31))
txt(70, 300, 'скажи ПРЫЖОК — и машинка прыгнет', f2, (43, 33, 64), (255, 255, 255))
og.save(os.path.join(BASE, 'icons', 'og.png'), optimize=True)
print('icons ok')

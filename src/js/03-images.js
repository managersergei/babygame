/* ═══════════════ 2. КАРТИНКИ ═══════════════ */
/* Анимация окружения: у живого объекта три кадра — <имя>, <имя>_b и <имя>_c.
   Цикл и скорость свои у каждого, фаза — своя у каждого экземпляра (ph у объектов,
   мировой индекс у декоративного ряда), иначе всё стадо шевелится синхронно.
   Кадр ещё не загрузился — возвращаем базовое имя, игра при этом не ломается.
   ОСТОРОЖНО с новыми именами: monster_b и monster_c в assets/world/ — это отдельные
   монстрики фона, а не кадры. Имя, у которого <имя>_b уже занято, в таблицу не добавлять. */
/* ПОЧЕМУ ЗДЕСЬ ТАК МАЛО КАДРОВ. Сгенерированные кадры b/c проверены контактным листом
   10.09.2026 и почти все оказались браком: у курицы и обезьяны проволочные артефакты
   на голове, у ежа жёлтая клякса поперёк тела, у мельницы вместо крыльев два леденца,
   у монеты вместо решки золотой слиток, у лошади три РАЗНЫХ лошади. Игра мигала ими —
   со стороны это и читалось как «анимация сломана».

   Правило: в seq попадает только кадр, который отличается от 'a' ПОЗОЙ и совпадает с ним
   ПО ОБЪЕКТУ. Всё остальное движение делает MOVE — преобразованием одного чистого кадра.
   Так идентичность не плавает по определению. Новый кадр — только после контактного листа
   (tools/anim_sheet.py). */
var ANIM = {
  cow:        { seq: 'bbbbbbbbabbbbbbbbac', fps: 1.6 },   // подолгу пасётся, изредка поднимает голову
  hedgehog:   { seq: 'abab', fps: 6 },                    // кадр c — жёлтая клякса, выброшен
  windmill:   { seq: 'ab',   fps: 5 }                     // кадр c — леденцы вместо крыльев, выброшен
};
/* Живое движение без новых картинок: маленькие сдвиги самого спрайта. Читается как анимация,
   идентичность и палитра сохраняются идеально (сгенерированные кадры теряли и то, и другое).
   Якорь спрайта — низ-центр, поэтому rot/sy не отрывают ноги от земли.
   d — доля высоты спрайта для подъёма; всё считается от общего времени T и фазы объекта.  */
var MOVE = {
  cow:        { rot: 0.020, sy: 0.030, sp: 1.1, bias: 0.65 },     // качка вниз-и-обратно, как при щипании травы
  horse:      { rot: 0.030, sy: 0.030, sp: 1.0 },
  sheep:      { rot: 0.022, sy: 0.040, sp: 1.3 },
  chicken:    { rot: 0.075, sy: 0.020, sp: 2.4, bias: 0.6 },      // клюёт: наклон вперёд и назад
  hedgehog:   { rot: 0.030, sy: 0.040, d: 0.030, sp: 5.0 },       // семенит
  star:       { sx: 0.42, d: 0.055, sp: 3.2 },                    // подпрыгивает и поворачивается, как монетка
  windmill:   { rot: 0.012, sy: 0.008, sp: 0.9 },                 // тяжело покачивается на ветру
  butterfly:  { sx: 0.46, d: 0.040, sp: 8.0 },                    // взмах — сжатием по ширине, кадры были браком
  bird:       { sx: 0.34, d: 0.030, sp: 6.5 },
  coin:       { sx: 0.88, sp: 3.4 },                              // оборот — сжатие почти в ноль и обратно
  loc_monkey: { rot: 0.090, sy: 0.010, sp: 1.4 },
  tree:       { rot: 0.022, sp: 0.8 },                            // качается от ветра
  loc_palm:   { rot: 0.030, sp: 0.7 },
  loc_fir:    { rot: 0.016, sp: 0.9 },
  bush:       { rot: 0.014, sy: 0.012, sp: 1.2 },
  daisies:    { rot: 0.030, sp: 1.6 },
  flower:     { rot: 0.034, sp: 1.7 }
};
/* Параметры для spr(): подмешиваются к тем, что уже передаёт вызывающий код. */
/* Результат живёт ровно до вызова spr() и никем не хранится — пишем в один рабочий
   объект. Раньше на каждый анимированный спрайт в кадре создавалось по два. */
var mvOut = { rot: 0, sy: 0, sx: 0, dy: 0, mid: 0, alpha: 0 };
var mvTmp = { rot: 0, sy: 0, sx: 0, dy: 0 };   // результат живёт один вызов, дальше spr() его читает и забывает
function moveFx(name, ph, h, o) {
  var m = MOVE[name];
  if (!m) return null;
  var t = T * (m.sp || 1) + (ph || 0) * 1.7;
  var w = Math.sin(t), w2 = Math.sin(t * 2);
  o.rot = m.rot ? w * m.rot + (m.bias ? Math.max(0, w2) * m.rot * m.bias : 0) : null;
  o.sy  = m.sy  ? 1 + w2 * m.sy : null;
  o.sx  = m.sx  ? 1 - Math.abs(w) * m.sx : null;
  o.dy  = (m.d && h) ? -Math.abs(w) * m.d * h : null;     // подпрыгивает
  return o;
}
function withMove(name, ph, h, opt) {              // объединяем «своё» движение с уже заданным
  if (!MOVE[name]) return opt || {};
  var out = mvOut, k;
  out.rot = null; out.sy = null; out.sx = null; out.dy = null; out.mid = null; out.alpha = null;
  var m = moveFx(name, ph, h, mvTmp);
  for (k in (opt || {})) out[k] = opt[k];
  if (m.rot != null) out.rot = (out.rot || 0) + m.rot;
  if (m.sy != null)  out.sy = (out.sy || 1) * m.sy;
  if (m.sx != null)  out.sx = (out.sx || 1) * m.sx;
  if (m.dy != null)  out.dy = m.dy;
  return out;
}
function frameOf(name, ph) {
  var a = ANIM[name];
  if (!a) return name;
  var n = a.seq.length;
  var p = (ph || 0) * 0.61803;                     // золотое сечение: соседи не попадают в такт
  var i = Math.floor(T * a.fps + (p - Math.floor(p)) * n) % n;
  if (i < 0) i += n;
  var c = a.seq.charAt(i);
  if (c === 'a') return name;
  var v = name + '_' + c;
  return ok(IMG[v]) ? v : name;
}
var ASSETS = ['monster','fire','race','police',
              'star','balloon','cone','ramp','arch','cloud','tree','house','bush','sun','fuel','wheel'];
var IMG = {}, loadedN = 0;
/* Файлы разложены по папкам: машинки и их части — cars/, всё остальное — world/. */
var CARFILES = {};
['monster', 'fire', 'race', 'police'].forEach(function (c) {
  CARFILES[c] = 1;
  ['black', 'red', 'yellow', 'd1', 'd2', 'd3', 'w0', 'w1', 'w2', 'w3', 'w4']
    .forEach(function (v) { CARFILES[c + '_' + v] = 1; });
});
['ambulance', 'bus', 'excavator', 'garbage', 'tractor', 'tow'].forEach(function (c) { CARFILES[c] = 1; });
/* Спрайты разложены по смысловым папкам, путь берём из карты assets/paths.js
   (её пишет tools/organize_assets.py). Нет карты или имени в ней — работает прежнее правило. */
function assetPath(n) {
  var m = (typeof ASSET_PATH !== 'undefined') && ASSET_PATH[n];
  return 'assets/' + (m || ((CARFILES[n] ? 'cars/' : 'world/') + n)) + '.webp';
}

ASSETS.push('monster_body', 'monster_tire',        // части ригованной машинки
            'car_red',                            // попутная машина, вид строго сбоку
            'bird', 'plane', 'fuel_empty', 'coin', 'chest', 'restart',
            'cow', 'horse', 'chicken', 'fence', 'haystack', 'windmill', 'daisies',
            'flower', 'ball', 'butterfly', 'hedgehog', 'apple', 'launchpad', 'train', 'crossing',
            'loc_tower', 'loc_shop', 'loc_palm', 'loc_umbrella', 'loc_jungle', 'loc_monkey',
            'loc_rock', 'loc_rocket', 'loc_fir', 'loc_snowman',
            'monster_a_run', 'monster_b_run', 'monster_c_run', 'monster_d_run',
            'paint', 'sheep', 'robot', 'master', 'monster_a', 'monster_b', 'monster_c', 'monster_d',
            'ambulance', 'bus', 'excavator', 'garbage', 'tractor', 'tow');   // части машин (…_body, wheel_…) убраны: подход «колёса отдельно» отменён, файлов нет
/* ВКЛЮЧИТЬ ВМЕСТЕ С КАДРАМИ: как только в assets/world/ появятся <имя>_b.webp и <имя>_c.webp
   для всех имён из ANIM — снять комментарий со следующей строки. Раньше нельзя: каждый
   недостающий файл даёт 404 в консоли, и tools/smoke.mjs краснеет. Пока строка выключена,
   frameOf() просто всегда возвращает базовое имя и игра выглядит как до правки. */
for (var an in ANIM) { if (ANIM.hasOwnProperty(an)) ASSETS.push(an + '_b', an + '_c'); }   // кадры выпущены 09.09.2026, tools/gen_frames.py
/* Две фазы: первые CORE_N картинок (машинки, дорога, база) — и игра стартует,
   остальное догружается фоном; чего ещё нет, spr() просто пропускает. */
var CORE_N = 16, coreDone = 0;
ASSETS.forEach(function (n, idx) {
  var im = new Image();
  im.onload = im.onerror = function () {
    loadedN++;
    if (idx < CORE_N) {
      coreDone++;
      document.getElementById('barIn').style.width = (coreDone / CORE_N * 100) + '%';
      if (coreDone === CORE_N) ready();
    }
  };
  im.src = assetPath(n);
  IMG[n] = im;
});
function ok(im) { return im && (im.naturalWidth > 0 || im.width > 0) && (im.complete !== false); }
function iw(im) { return im.naturalWidth || im.width; }
function ih(im) { return im.naturalHeight || im.height; }

/* Скины машинки — настоящие картинки: цвет и три степени повреждений. */
var carPaint = null, damage = 0, noWheels = false, missWheels = 1;
var dmgT = 0;                                  // сколько ещё показывать вмятины поверх покраски
var paintRevT = 0;                             // сколько ещё заливать новую краску сверху вниз

function lazyImg(name) {                       // варианты подгружаем по требованию
  if (!IMG[name]) { var im = new Image(); im.src = assetPath(name); IMG[name] = im; }
  return IMG[name];
}
/* Доля высоты спрайта, которую занимают колёса. Замерено по самим файлам: считаем
   в каждом столбце, сколько тёмных пикселей идёт снизу вверх, и берём медиану. */
var WHEEL_BAND = { monster: 0.25, fire: 0.09, race: 0.30, police: 0.09 };

function carSkin(id) {
  /* Скины <id>_w1..w4 не используем: стирание колёс оставило в них вертикальные щели,
     и машинка выглядела перечёркнутой. Вместо скина — посадка на оси, см. drawVehicle. */
  /* Покрашенных повреждённых скинов не бывает, и раньше первый же удар навсегда
     стирал покраску — награда исчезала без объяснения. Теперь вмятины показываются
     полторы секунды после удара, а дальше кузов снова свой, крашеный. */
  if (damage > 0 && (!carPaint || dmgT > 0)) return id + '_d' + Math.min(3, damage);
  if (carPaint) return id + '_' + carPaint;
  return id;
}

/* Здесь была paintedCanvas — красила спрайт кодом через composite-режимы канваса.
   Не вызывалась ниоткуда и врала контрактом: ждала объект {c, m}, а carPaint во всём
   живом коде — строка ('black' / 'red' / 'yellow'). Покраска давно делается готовыми
   скинами <id>_<цвет>, см. carSkin. Удалено 40 строк вместе с кешем PAINTED. */

/* Снимаем n задних колёс: вырезаем их из спрайта и рисуем голую ось. */
/* Здесь была brokenCanvas — вырезала колёса из спрайта кодом. Она опиралась на карту
   WHEELS, которой в файле нет вовсе, поэтому не вызывалась никогда и оставалась ловушкой
   для следующей правки. Колёса сняты в самих спрайтах (tools/gen_wheels.py), лестница
   _w1.._w4 проверена числами. */

function imgOf(name) {
  if (car && name === car.id) {
    var sk = carSkin(name);
    if (sk !== name) { var v = lazyImg(sk); if (ok(v)) return v; }
  }
  return IMG[name];
}

/** Спрайт. Якорь — низ-центр (или центр, если o.mid). */
function spr(name, x, y, h, o) {
  var im = imgOf(name); if (!ok(im)) return 0;
  o = o || {};
  var k = h / ih(im), w = iw(im) * k;
  /* Быстрый путь: когда ни поворота, ни масштаба, ни прозрачности, ни подскока,
     save/translate/restore — чистая трата. Таких вызовов в кадре большинство. */
  if (!o.rot && !o.sx && !o.sy && o.alpha == null && !o.dy) {
    g.drawImage(im, x - w / 2, o.mid ? y - h / 2 : y - h, w, h);
    return w;
  }
  g.save();
  g.translate(x, y + (o.dy || 0));                  // dy — подскок (процедурная анимация)
  if (o.rot) g.rotate(o.rot);
  if (o.sx || o.sy) g.scale(o.sx || 1, o.sy || 1);
  if (o.alpha != null) g.globalAlpha = o.alpha;
  g.drawImage(im, -w / 2, o.mid ? -h / 2 : -h, w, h);
  g.restore();
  return w;
}
function sprW(name, h) { var im = imgOf(name); return ok(im) ? iw(im) * (h / ih(im)) : h; }

function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}


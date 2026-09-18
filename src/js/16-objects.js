/* ═══════════════ 13. ОБЪЕКТЫ ═══════════════ */
/* Контактная тень: объект «стоит» на земле, а не наклеен поверх фона. w — полуширина эллипса. */
/* Воздушная перспектива: чем дальше слой, тем сильнее он выцветает в цвет неба.
   Это самый дешёвый способ убрать ощущение «наклеенных фигурок». */
function mix(c1, c2, k) {
  function hx(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  var a = hx(c1), b = hx(c2), o = '#';
  for (var i = 0; i < 3; i++) o += ('0' + Math.round(a[i] + (b[i] - a[i]) * k).toString(16)).slice(-2);
  return o;
}
function haze(col, k) { return mix(col, TH().sky[2], k); }

/* Цвет тени — от травы локации, а не константа: на снегу и в космосе тёмно-зелёное
   пятно читалось как клякса. */
function shColor() { return mix(TH().grass, '#000000', 0.72); }
function shadow(x, y, w, a) {
  g.save(); g.globalAlpha = a || 0.22; g.fillStyle = shColor();
  g.beginPath(); g.ellipse(x, y, w, Math.max(4 * S, w * 0.22), 0, 0, TAU); g.fill(); g.restore();
}
/* «Приземление» объекта: пятно вытоптанной земли, мягкая тень и узкая контактная тень
   под самым основанием. Без неё дом и стог читаются как наклейки на стыке заливок. */
function ground(x, y, w) {
  g.save();
  g.globalAlpha = 0.16; g.fillStyle = mix(TH().grass, '#4a3a22', 0.5);
  g.beginPath(); g.ellipse(x, y, w * 1.05, Math.max(4 * S, w * 0.26), 0, 0, TAU); g.fill();
  g.globalAlpha = 0.22; g.fillStyle = shColor();
  g.beginPath(); g.ellipse(x, y, w * 0.78, Math.max(3 * S, w * 0.19), 0, 0, TAU); g.fill();
  g.globalAlpha = 0.30;
  g.beginPath(); g.ellipse(x, y + 1 * S, w * 0.42, Math.max(2 * S, w * 0.07), 0, 0, TAU); g.fill();
  g.restore();
}
/* Пучки травы поверх основания — перекрытие убеждает сильнее любой тени. */
function tufts(x, y, w, seed) {
  var th = TH();
  if (th.snow || th.name === 'космос') return;   // на снегу и на Луне трава не растёт
  g.save(); g.strokeStyle = mix(th.grass, '#000000', 0.28); g.lineWidth = 2.2 * S; g.lineCap = 'round';
  g.beginPath();                                  // все пять травинок одним путём: было пять обводок на вызов
  for (var i = 0; i < 5; i++) {
    var r = h1r(seed * 3.1 + i), tx = x + (r - 0.5) * w * 1.7, hh = (5 + r * 7) * S;
    g.moveTo(tx, y + 1 * S);
    g.quadraticCurveTo(tx + (r - 0.5) * 5 * S, y - hh * 0.6, tx + (r - 0.5) * 9 * S, y - hh);
  }
  g.stroke();
  g.restore();
}
/* Забор пролётом, а не одной секцией: одиночная доска у дороги выглядела случайной. */
function fenceRun(x, y, h, n) {
  /* Перекладина в спрайте обрывается, не доходя до краёв (замер: 390 столбцов из 640),
     и составленные встык копии читались как отдельные колья. Прогоняем две сквозные
     перекладины по всей длине — цвет и высоты взяты из самого спрайта. */
  var w = sprW('fence', h) * 0.94, x0 = x - (n - 1) / 2 * w - w * 0.5, len = n * w;
  g.save();
  g.fillStyle = '#d5ccc4';
  g.fillRect(x0, y - h * 0.63, len, h * 0.13);
  g.fillRect(x0, y - h * 0.27, len, h * 0.12);
  g.fillStyle = 'rgba(120,104,92,.22)';                      // тень под каждой перекладиной
  g.fillRect(x0, y - h * 0.51, len, h * 0.02);
  g.fillRect(x0, y - h * 0.16, len, h * 0.02);
  g.restore();
  for (var i = 0; i < n; i++) spr('fence', x + (i - (n - 1) / 2) * w, y, h, { alpha: 0.98 });
}
/* Порядок по РЕАЛЬНОЙ глубине основания. Раньше светофор (стоит на асфальте,
   ближе всех) и овца уходили ПОД ежа и цветок, которые стоят у кромки травы
   на 58*S дальше от зрителя. */
var Z_OF = { cloudy:0, plane:0, bird:0, butterfly:1, rail:2, rocket:2, prop:3, traffic:3.5,
             flower:4, hedgehog:4.2, tlight:5.5, sheep:5.6 };
function zOf(o) { return Z_OF[o.t] != null ? Z_OF[o.t] : 6; }
function zOrder(a, b) { return zOf(a) - zOf(b) || a.x - b.x; }

/* Что прячем из кадра во время урока: всё собираемое и всё, что бьётся.
   Иначе рядом со словом «ПРЫЖОК» стоит яркая канистра и ребёнок смотрит на неё. */
var LESSON_HIDE = { fuel:1, star:1, coin:1, balloon:1, apple:1, bucket:1, chest:1, ball:1,
                    arch:1, mon:1, cone:1, puddle:1, pit:1, ramp:1, plat:1, rocket:1, tlight:1, traffic:1 };
var zBuf = [];                       // переиспользуемый буфер сортировки: slice() каждый кадр давал лишний массив
function drawObjs() {
  zBuf.length = 0;
  for (var zi = 0; zi < objs.length; zi++) zBuf.push(objs[zi]);
  zBuf.sort(zOrder).forEach(function (o) {
    var sx = (o.x - carX) + CARX;
    if (sx < -500 * S || sx > W + 600 * S) return;
    if (state === 'lesson' && o !== les.obj && LESSON_HIDE[o.t]) return;
    if (o.t === 'ramp') {
      spr('ramp', sx + o.w * 0.5, GY + 2 * S, o.h * 1.25);
    } else if (o.t === 'star') {
      var bob = Math.sin(o.ph * 2.4) * 10 * S;
      g.save(); g.translate(sx, GY - o.y - bob); g.rotate(Math.sin(o.ph * 1.7) * 0.22);
      var im = IMG.star;
      if (ok(im)) { var h = 60 * S, w = iw(im) * (h / ih(im));
                    g.drawImage(im, -w / 2, -h / 2, w, h); }
      g.restore();
    } else if (o.t === 'fuel') {
      var fy = o.y + Math.sin(o.ph * 2.2) * 8 * S;
      /* Было плоское жёлтое пятно на 25 % — на светлом небе оно читалось как грязный
         бежевый круг, а не как свечение. Свет — это градиент, гаснущий к краю. */
      var frr = 66 * S + Math.sin(o.ph * 3) * 5 * S;
      var fgr = g.createRadialGradient(sx, GY - fy + 20 * S, 0, sx, GY - fy + 20 * S, frr);
      fgr.addColorStop(0, 'rgba(255,236,150,.55)');
      fgr.addColorStop(0.45, 'rgba(255,217,61,.22)');
      fgr.addColorStop(1, 'rgba(255,217,61,0)');
      g.save(); g.fillStyle = fgr;
      g.beginPath(); g.arc(sx, GY - fy + 20 * S, frr, 0, TAU); g.fill();
      g.restore();
      spr('fuel', sx, GY - fy + 48 * S, 90 * S, { rot: Math.sin(o.ph * 1.4) * 0.08 });
    } else if (o.t === 'balloon') {
      var by = o.y + Math.sin(o.ph * 1.6) * 16 * S;
      spr('balloon', sx, GY - by + 42 * S, 84 * S, { rot: Math.sin(o.ph * 1.1) * 0.12 });
    } else if (o.t === 'cone') {
      shadow(sx, GY + 4 * S, 20 * S, 0.18);
      spr('cone', sx, GY - (o.y || 0), 40 * S, { rot: o.rot || 0 });
    } else if (o.t === 'puddle') {
      var pw3 = o.w * 0.52, ph3 = 20 * S, py3 = GY + 16 * S, ph2 = o.ph || 0;   // картинка была шире своей зоны удара
      g.save();
      g.fillStyle = 'rgba(20,40,60,.35)';                        // тёмный ободок-углубление
      g.beginPath(); g.ellipse(sx, py3 + 3 * S, pw3 + 5 * S, ph3 + 4 * S, 0, 0, TAU); g.fill();
      var wg = g.createLinearGradient(0, py3 - ph3, 0, py3 + ph3);
      wg.addColorStop(0, o.done ? '#7fb6d8' : '#4aa3d8');
      wg.addColorStop(1, o.done ? '#4b7f9e' : '#1c6ea4');
      g.fillStyle = wg;
      g.beginPath(); g.ellipse(sx, py3, pw3, ph3, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3 * S;
      g.beginPath(); g.ellipse(sx, py3, pw3, ph3, 0, 0, TAU); g.stroke();
      g.globalAlpha = 0.55;                                      // круги на воде
      g.strokeStyle = '#eaf7ff'; g.lineWidth = 2.5 * S;
      for (var wr = 0; wr < 2; wr++) {
        var k3 = ((ph2 * 0.5 + wr * 0.5) % 1);
        g.globalAlpha = 0.5 * (1 - k3);
        g.beginPath(); g.ellipse(sx, py3, pw3 * (0.25 + k3 * 0.7), ph3 * (0.25 + k3 * 0.7), 0, 0, TAU); g.stroke();
      }
      g.globalAlpha = 0.8;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(sx - pw3 * 0.35, py3 - ph3 * 0.35, pw3 * 0.18, ph3 * 0.2, -0.4, 0, TAU); g.fill();
      g.restore();
    } else if (o.t === 'pit') {
      var top = GY - 10 * S;
      g.save();
      g.fillStyle = '#171a22';
      roundRect(sx - o.w / 2, top, o.w, H - top, 20 * S); g.fill();
      g.fillStyle = 'rgba(0,0,0,.5)';
      g.beginPath(); g.ellipse(sx, top + 14 * S, o.w * 0.5, 18 * S, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(sx - o.w / 2, top, o.w, 3 * S);
      // в яме кто-то живёт, а когда машинка провалилась — выпрыгивает и щёлкает зубами
      var bite = o.bite || 0, k5 = bite > 0 ? 1 + (1 - Math.abs(bite - 0.55) / 0.55) * 1.6 : 1;
      var rise = bite > 0 ? (1 - Math.abs(bite - 0.55) / 0.55) * 54 * S : 0;
      var ey = top + 42 * S - rise + Math.sin((o.ph || 0) * 2.2) * 4 * S;
      var lookx = clamp((carX - o.x) / (200 * S), -1, 1) * 3 * S;
      g.save();
      g.translate(sx, ey); g.scale(k5, k5); g.translate(-sx, -ey);
      g.fillStyle = bite > 0 ? '#ff5a5a' : '#ffe14d';       // в прыжке глаза злые
      g.beginPath(); g.arc(sx - 17 * S, ey, 9 * S, 0, TAU); g.fill();
      g.beginPath(); g.arc(sx + 17 * S, ey, 9 * S, 0, TAU); g.fill();
      g.fillStyle = '#1b1d24';
      g.beginPath(); g.arc(sx - 17 * S + lookx, ey, 4.5 * S, 0, TAU); g.fill();
      g.beginPath(); g.arc(sx + 17 * S + lookx, ey, 4.5 * S, 0, TAU); g.fill();
      var chomp = bite > 0 ? Math.abs(Math.sin(bite * 26)) * 12 * S : 0;   // щёлк-щёлк
      g.fillStyle = '#2a1418';
      if (bite > 0) { g.beginPath(); g.ellipse(sx, ey + 26 * S, 30 * S, 10 * S + chomp, 0, 0, TAU); g.fill(); }
      g.strokeStyle = '#ffffff'; g.lineWidth = 3 * S; g.lineCap = 'round';
      g.beginPath();
      for (var tz = 0; tz < 5; tz++) {
        var txx = sx - 26 * S + tz * 13 * S;
        g.moveTo(txx, ey + 20 * S); g.lineTo(txx + 6 * S, ey + 29 * S + chomp * 0.5);
      }
      g.stroke();
      g.restore();
      g.restore();
    } else if (o.t === 'bird') {
      var fl = Math.sin((o.ph || 0) * 7) * 8 * S;
      spr(frameOf('bird', o.ph), sx, o.y + fl, 78 * S, withMove('bird', o.ph, 78 * S, { mid: true }));
    } else if (o.t === 'plane') {
      spr('plane', sx, o.y + Math.sin((o.ph || 0) * 1.6) * 7 * S, 96 * S, { mid: true, sx: -1 });
    } else if (o.t === 'flower') {
      ground(sx, roadTop() - 8 * S, 16 * S);
      spr(frameOf('flower', o.ph), sx, roadTop() - 8 * S, 60 * S, withMove('flower', o.ph, 60 * S, {}));
    } else if (o.t === 'apple') {
      var ab = Math.sin((o.ph || 0) * 2.4 + T * 2) * 8 * S;
      spr('apple', sx, GY - o.y + 30 * S - ab, 58 * S);
    } else if (o.t === 'coin') {
      if (o.got) return;                                     // собрали — не рисуем
      var cb = Math.sin((o.ph || 0) * 2.2 + T * 2.4) * 7 * S;
      // есть кадры оборота — крутим ими; нет — как раньше, сжатием по ширине
      spr(frameOf('coin', o.ph), sx, GY - o.y + 30 * S - cb, 52 * S, withMove('coin', o.ph, 52 * S, {}));
    } else if (o.t === 'ball') {
      /* Тень мяча — единственная подсказка, на какой он высоте: сжимается и светлеет,
         когда мяч вверху, и наоборот. Без неё мяч висел в воздухе без опоры. */
      var bhh = ballH(o), bk = clamp(1 - bhh / (70 * S), 0.35, 1);
      shadow(sx, GY + 8 * S, 24 * S * bk, 0.10 + 0.18 * bk);
      spr('ball', sx, GY + 4 * S - bhh, 62 * S, { rot: T * 3 });
    } else if (o.t === 'hedgehog') {
      ground(sx, roadTop() - 6 * S, 18 * S);
      spr(frameOf('hedgehog', o.ph), sx, roadTop() - 6 * S, 58 * S, withMove('hedgehog', o.ph, 58 * S, {}));
    } else if (o.t === 'butterfly') {
      spr(frameOf('butterfly', o.ph), sx, o.y + Math.sin(T * 5) * 12 * S, 56 * S, withMove('butterfly', o.ph, 56 * S, { mid: true }));
    } else if (o.t === 'rocket') {
      var rb = roadTop() - 6 * S;                    // космодром стоит в глубине, за дорогой
      ground(sx, rb, 30 * S);
      if (!o.gone) spr('launchpad', sx + 34 * S, rb, 150 * S);
      spr('loc_rocket', sx, rb - (o.h || 0), 178 * S, { rot: (o.h || 0) > 0 ? 0.06 : 0 });   // была 118*S против 170*S у декорации на обочине
      if ((o.h || 0) > 0) {                          // огонь и дым при взлёте
        g.save(); g.globalAlpha = 0.9;
        for (var fz = 0; fz < 3; fz++) {
          g.fillStyle = pick(['#ffd93d', '#ff8f1f', '#ff4d1f']);
          g.beginPath();
          g.arc(sx + rnd(-8, 8) * S, rb - o.h + rnd(6, 26) * S, rnd(7, 15) * S, 0, TAU); g.fill();
        }
        g.globalAlpha = 0.35; g.fillStyle = '#d8dee8';
        g.beginPath(); g.ellipse(sx, rb + 6 * S, 40 * S, 14 * S, 0, 0, TAU); g.fill();
        g.restore();
      }
    } else if (o.t === 'rail') {
      drawRail(o, sx);
    } else if (o.t === 'prop') {
      var pby = roadTop() - 10 * S;                            // на траве, а не на кромке асфальта
      var phh = (PROP_H[o.kind] || 130) * S;
      /* Забор — это ЧЕТЫРЕ пролёта: пятно земли под ним считаем по всей длине,
         иначе оно вчетверо уже самого забора. */
      var isFence = o.kind === 'fence';
      ground(sx, pby - 1 * S, sprW(o.kind, phh) * (isFence ? 1.88 : 0.42));
      if (isFence) { fenceRun(sx, pby, phh, 4); tufts(sx, pby, phh * 0.6, o.ph || 1); return; }
      spr(frameOf(o.kind, o.ph), sx, pby, phh,
          withMove(o.kind, o.ph, phh,
                   { sy: 1 + Math.sin(T * 1.3 + (o.ph || 0)) * 0.010 }));   // общий «вдох» плюс своё движение
      tufts(sx, pby, sprW(o.kind, phh) * 0.36, o.ph || 2);
    } else if (o.t === 'traffic') {
      var tby = roadTop() + 30 * S, thh = (PROP_H[o.kind] || 118) * S * 0.9;
      if (!ok(imgOf(o.kind))) { lazyImg(o.kind); return; }   // ещё не загрузилось — не рисуем одну тень
      ground(sx, tby - 1 * S, sprW(o.kind, thh) * 0.42);
      spr(frameOf(o.kind, o.ph), sx, tby + Math.sin(T * 6 + (o.ph || 0)) * 1.6 * S, thh,
          withMove(o.kind, o.ph, thh, {}));
    } else if (o.t === 'cloudy') {
      spr('cloud', sx, o.y, 110 * S, { mid: true });
    } else if (o.t === 'bucket') {
      var bob2 = Math.sin((o.ph || 0) * 2.4) * 7 * S;
      spr('paint', sx, GY + 6 * S - bob2, 84 * S);
      g.save();
      g.fillStyle = o.col.c;
      g.beginPath(); g.arc(sx, GY - 96 * S - bob2, 26 * S, 0, TAU); g.fill();
      g.lineWidth = 4 * S; g.strokeStyle = '#fff';
      g.beginPath(); g.arc(sx, GY - 96 * S - bob2, 26 * S, 0, TAU); g.stroke();
      g.restore();
    } else if (o.t === 'plat') {
      var py2 = GY - o.h;
      g.save();
      g.fillStyle = 'rgba(0,0,0,.18)';
      roundRect(sx + 5 * S, py2 + 7 * S, o.w, 34 * S, 12 * S); g.fill();
      var pg = g.createLinearGradient(0, py2, 0, py2 + 34 * S);
      pg.addColorStop(0, '#b9803f'); pg.addColorStop(1, '#8a5a28');
      g.fillStyle = pg; roundRect(sx, py2, o.w, 34 * S, 12 * S); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; roundRect(sx + 6 * S, py2 + 4 * S, o.w - 12 * S, 7 * S, 4 * S); g.fill();
      g.strokeStyle = 'rgba(60,36,14,.5)'; g.lineWidth = 3 * S;
      roundRect(sx, py2, o.w, 34 * S, 12 * S); g.stroke();
      for (var pp = 1; pp < 4; pp++) {                       // опоры
        var lx = sx + o.w * pp / 4;
        g.fillStyle = 'rgba(120,80,40,.55)'; g.fillRect(lx - 5 * S, py2 + 32 * S, 10 * S, o.h - 26 * S);
      }
      g.restore();
    } else if (o.t === 'mon') {
      var mh2 = 96 * S, hop2 = Math.abs(Math.sin((o.ph || 0) * 5)) * 10 * S;
      g.save(); g.globalAlpha = 0.3; g.fillStyle = shColor();
      g.beginPath(); g.ellipse(sx, GY + 8 * S, 34 * S, 8 * S, 0, 0, TAU); g.fill(); g.restore();
      var msk = (o.skin || 'monster_a') + (Math.floor(T * 3.6 + (o.ph || 0)) % 2 ? '_run' : '');   // 1,8 шага в секунду, и соседи не в такт
      if (!ok(IMG[msk])) msk = o.skin || 'monster_a';
      spr(msk, sx, GY + 6 * S - hop2, mh2, { rot: Math.sin(o.ph * 5) * 0.08 });
    } else if (o.t === 'tlight') {
      var base = GY + 6 * S;
      g.save();
      g.fillStyle = '#48505f'; g.fillRect(sx - 6 * S, base - 176 * S, 12 * S, 176 * S);
      g.fillStyle = '#2d3340'; roundRect(sx - 28 * S, base - 268 * S, 56 * S, 100 * S, 13 * S); g.fill();
      g.lineWidth = 3 * S; g.strokeStyle = '#1b2029'; g.stroke();
      var onR = !o.green;
      g.fillStyle = onR ? '#ff3b30' : '#5a2b2b';
      g.beginPath(); g.arc(sx, base - 241 * S, 17 * S, 0, TAU); g.fill();
      g.fillStyle = onR ? '#24422c' : '#34c759';
      g.beginPath(); g.arc(sx, base - 195 * S, 17 * S, 0, TAU); g.fill();
      g.globalAlpha = 0.25; g.fillStyle = onR ? '#ff3b30' : '#34c759';
      g.beginPath(); g.arc(sx, base - (onR ? 241 : 195) * S, 31 * S, 0, TAU); g.fill();
      g.restore();
    } else if (o.t === 'sheep') {
      var hop = Math.abs(Math.sin((o.ph || 0) * (o.run ? 9 : 2.2))) * (o.run ? 30 : 5) * S;
      ground(sx, GY + 4 * S, 26 * S);
      spr(frameOf('sheep', o.ph), sx, GY + 4 * S - hop, 82 * S,   // была 100*S — выше коровы (84); в общей шкале овца 78
          o.run ? { rot: Math.sin(o.ph * 9) * 0.12 } : withMove('sheep', o.ph, 82 * S, {}));
    } else if (o.t === 'arch') {
      spr('arch', sx, GY + 4 * S, o.h);
    }
  });
}


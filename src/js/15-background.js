/* ═══════════════ 12. ФОН ═══════════════ */
/* Каждый уровень — своя палитра, чтобы дорога не приедалась. */
var THEMES = [
  { name:'деревня', far:'forest', sky:['#4fb6e8','#9fe0f6','#dff6ff'], h1:'#8fd07a', h2:'#79c163',
    road:['#5d6472','#3c414c'], grass:'#6ab04c', sun:1,
    props:['house','tree','fence','cow','haystack','chicken','windmill'], extra:['tractor','sheep','master'] },
  { name:'город', far:'city',   sky:['#6fb3d8','#bcd8ea','#e8f2f8'], h1:'#8f9bb0', h2:'#78849a',
    road:['#4e5560','#33383f'], grass:'#7d8896', sun:1, props:['loc_tower','loc_shop'], extra:['bus','ambulance','garbage'] },
  { name:'пляж', far:'sea',    sky:['#38c6e8','#9fe8f6','#eafcff'], h1:'#8fd8e8', h2:'#f2dfa8',
    road:['#7a6f5c','#514738'], grass:'#f0dda4', sun:1, props:['loc_palm','loc_umbrella'], extra:['chest'] },
  { name:'джунгли', far:'jungle', sky:['#4fd0a8','#a8ecc9','#e6ffe9'], h1:'#3f9c62', h2:'#2f7a4c',
    road:['#4f5a4a','#333c30'], grass:'#3f9457', sun:1, props:['loc_jungle','loc_monkey'], extra:['chest'] },
  { name:'закат', far:'forest',   sky:['#ff7e5f','#feb47b','#ffe3c0'], h1:'#c98f5e', h2:'#a86f45',
    road:['#5a4a55','#38303a'], grass:'#b9834a', sun:1, props:['house','tree'] },
  { name:'космос', far:'peaks',  sky:['#0b1030','#1b2450','#3a4680'], h1:'#4a4470', h2:'#37325a',
    road:['#3a3550','#232038'], grass:'#4a4470', sun:0, props:['loc_rock','loc_rocket'] },
  { name:'зима', far:'peaks', snow:1,    sky:['#8fc7e8','#cfe9f7','#ffffff'], h1:'#eaf3f9', h2:'#d5e5f0',
    road:['#6a7280','#454c58'], grass:'#e8f2f8', sun:1, props:['loc_fir','loc_snowman'] },
  { name:'луг', far:'forest',     sky:['#57c7e8','#a8ecc9','#e6ffe9'], h1:'#7fd18c', h2:'#5eb96f',
    road:['#5f6a63','#3d443f'], grass:'#67bd63', sun:1,
    props:['daisies','horse','tree','cow','fence','bush'], extra:['sheep','tractor'] },
  { name:'пустыня', far:'dunes', sky:['#5fbfe0','#ffe0a3','#ffefcf'], h1:'#e8c98a', h2:'#d4ac63',
    road:['#6b6357','#443f38'], grass:'#dfc07f', sun:1, props:['loc_rock','house'], extra:['excavator','tow'] }
];
var themeIx = 0, themeFrom = 0, themeK = 1;   // K: 0 — ещё прежняя палитра, 1 — новая
var thCache = null, thKey = '';               // готовый смешанный набор: mix() разбирал hex 58 раз за кадр

/* Смена локации происходила за один кадр: с оранжевого заката экран мгновенно
   проваливался в почти чёрный космос. Ведём палитру к новой за ~0,8 с. */
function setTheme(ix) {
  if ((ix % THEMES.length) === (themeIx % THEMES.length)) return;
  themeFrom = themeIx; themeIx = ((ix % THEMES.length) + THEMES.length) % THEMES.length; themeK = 0;
}
function themeStep(dt) { if (themeK < 1) themeK = Math.min(1, themeK + dt * 1.25); }
var thForce = null;                       // dev: ?th=N — посмотреть конкретную локацию
function TH() {
  if (thForce !== null) return THEMES[thForce % THEMES.length];
  var b = THEMES[themeIx % THEMES.length];
  if (themeK >= 1) return b;
  var a = THEMES[themeFrom % THEMES.length];
  /* Ключ округляем до 1/24: за всю смену набор пересобирается двадцать четыре раза,
     а не каждый кадр. mix() дорогой — он парсит hex-строки. */
  var key = themeFrom + '>' + themeIx + '@' + Math.round(themeK * 24);
  if (thKey === key) return thCache;
  var late = themeK > 0.5 ? b : a;                 // некрашеное (реквизит, дальний план) переключаем разом
  thCache = {
    name: late.name, far: late.far, props: late.props, extra: late.extra,
    sun: late.sun, snow: late.snow,
    sky: [mix(a.sky[0], b.sky[0], themeK), mix(a.sky[1], b.sky[1], themeK), mix(a.sky[2], b.sky[2], themeK)],
    h1: mix(a.h1, b.h1, themeK), h2: mix(a.h2, b.h2, themeK),
    road: [mix(a.road[0], b.road[0], themeK), mix(a.road[1], b.road[1], themeK)],
    grass: mix(a.grass, b.grass, themeK)
  };
  thKey = key;
  return thCache;
}

/* Кеш градиентов. Небо, трава и асфальт зависят только от палитры и размера окна,
   а пересоздавались каждый кадр — по три объекта CanvasGradient на кадр в мусор.
   Ключ включает фазу смены локации: она квантуется до 1/24, так что за всю смену
   градиент пересобирается двадцать четыре раза, а не сто. */
var GRD = {}, grdKey = '';
function grd(name, make) {
  var t = TH();
  var key = W + 'x' + H + '|' + themeIx + '>' + themeFrom + '@' + Math.round(themeK * 24);
  if (key !== grdKey) { GRD = {}; grdKey = key; }
  return GRD[name] || (GRD[name] = make(t));
}

function drawSky() {
  var t = TH();
  var sky = grd('sky', function (th) {
    var q = g.createLinearGradient(0, 0, 0, roadTop());
    q.addColorStop(0, th.sky[0]); q.addColorStop(0.55, th.sky[1]); q.addColorStop(1, th.sky[2]);
    return q;
  });
  g.fillStyle = sky; g.fillRect(0, 0, W, roadTop() + 2 * S);
  if (t.sun) spr('sun', W * 0.87, 160 * S + Math.sin(T * 0.7) * 6 * S, 118 * S, { mid: true });
  else {
    /* Звёзды были приклеены к экрану: дорога ехала, небо стояло. Даём им
       собственный медленный параллакс — как самому дальнему слою. */
    var scr0 = (bgX == null ? carX : bgX) * 0.04;
    g.save(); g.fillStyle = '#fff9d6';
    for (var i = 0; i < 26; i++) {
      var sx2 = ((((i * 137) % 100) / 100 * W - scr0) % W + W) % W;
      var sy2 = ((i * 71) % 40) / 100 * H;
      g.globalAlpha = 0.35 + Math.abs(Math.sin(T * 0.8 + i)) * 0.5;
      g.beginPath(); g.arc(sx2, sy2, 2.2 * S, 0, TAU); g.fill();
    }
    g.restore();
  }
  airLayer(t);
}

/* Воздух локации. Раньше девять мест отличались только палитрой: в «зиме» не было
   ни снежинки, на «закате» не летело ни листа. Всё процедурное — ни одного ассета,
   ни одной частицы в общем пуле, на кадр это 18–26 мелких заливок. */
function airLayer(t) {
  var n, i, k, x, y;
  var scroll = (bgX == null ? carX : bgX);
  if (t.snow) {                                            // зима: снег
    g.save(); g.fillStyle = '#ffffff';
    for (i = 0; i < 26; i++) {
      k = (i * 0.618) % 1;
      x = (((k * W * 1.3 + T * (14 + k * 26) * S - scroll * 0.08) % (W + 60 * S)) + W + 60 * S) % (W + 60 * S) - 30 * S;
      y = ((T * (26 + k * 34) * S + k * H) % (roadTop() + 40 * S));
      g.globalAlpha = 0.45 + k * 0.4;
      g.beginPath(); g.arc(x + Math.sin(T * 1.4 + i) * 9 * S, y, (1.6 + k * 2.2) * S, 0, TAU); g.fill();
    }
    g.restore();
  } else if (t.name === 'закат') {                         // листья по ветру
    g.save();
    for (i = 0; i < 12; i++) {
      k = (i * 0.618) % 1;
      x = (((k * W * 1.3 - T * (48 + k * 40) * S - scroll * 0.12) % (W + 60 * S)) + W + 60 * S) % (W + 60 * S) - 30 * S;
      y = 60 * S + ((T * (18 + k * 22) * S + k * H * 0.5) % (roadTop() - 40 * S));
      g.globalAlpha = 0.55;
      g.fillStyle = k > 0.6 ? '#e07a3f' : k > 0.3 ? '#c9552e' : '#e6a94f';
      g.save(); g.translate(x, y + Math.sin(T * 2 + i) * 12 * S); g.rotate(T * 2 + i);
      g.beginPath(); g.ellipse(0, 0, 7 * S, 3.4 * S, 0, 0, TAU); g.fill(); g.restore();
    }
    g.restore();
  } else if (t.name === 'пустыня') {                       // позёмка песка у горизонта
    g.save(); g.fillStyle = '#e8d3a0';
    for (i = 0; i < 14; i++) {
      k = (i * 0.618) % 1;
      x = (((k * W * 1.3 - T * (90 + k * 80) * S - scroll * 0.2) % (W + 80 * S)) + W + 80 * S) % (W + 80 * S) - 40 * S;
      y = roadTop() - 30 * S - k * 60 * S;
      g.globalAlpha = 0.16 + k * 0.14;
      g.beginPath(); g.ellipse(x, y, (26 + k * 40) * S, 2.4 * S, 0, 0, TAU); g.fill();
    }
    g.restore();
  } else if (t.name === 'джунгли') {                       // светлячки
    g.save(); g.fillStyle = '#eaff9c';
    for (i = 0; i < 14; i++) {
      k = (i * 0.618) % 1;
      x = (((k * W * 1.3 - scroll * 0.25) % (W + 40 * S)) + W + 40 * S) % (W + 40 * S) - 20 * S;
      y = 120 * S + k * (roadTop() - 160 * S) + Math.sin(T * 1.1 + i) * 18 * S;
      g.globalAlpha = 0.25 + Math.abs(Math.sin(T * 2.2 + i * 1.7)) * 0.6;
      g.beginPath(); g.arc(x + Math.cos(T * 0.9 + i) * 14 * S, y, 2.6 * S, 0, TAU); g.fill();
    }
    g.restore();
  } else if (t.name === 'пляж') {                          // блики над водой
    g.save(); g.fillStyle = '#ffffff';
    for (i = 0; i < 10; i++) {
      k = (i * 0.618) % 1;
      x = (((k * W * 1.3 - scroll * 0.18) % (W + 40 * S)) + W + 40 * S) % (W + 40 * S) - 20 * S;
      y = roadTop() - 70 * S - k * 40 * S;
      g.globalAlpha = 0.1 + Math.abs(Math.sin(T * 3 + i)) * 0.35;
      g.beginPath(); g.ellipse(x, y, (10 + k * 14) * S, 1.8 * S, 0, 0, TAU); g.fill();
    }
    g.restore();
  }
}
var bgX = null;                       // если задан — параллакс считается от него, а не от carX
function layer(rate, period, fn) {
  var scroll = (bgX == null ? carX : bgX) * rate, base = Math.floor(scroll / period);
  var off = scroll - base * period, n = Math.ceil(W / period) + 2;
  for (var i = -1; i < n; i++) fn(i * period - off, base + i);   // индекс мировой, не экранный
}
/* Дальний план. Без него над горизонтом висит пустое небо, а «город» выглядит
   как три домика в поле. Всё процедурное и привязано к МИРОВОМУ индексу,
   иначе слой телепортируется при прокрутке. */
function h1r(i) { var x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); }

var CITY_COL = ['#7f9dc4', '#d99a86', '#8fbfa4', '#b79ccc', '#e0be7e', '#7fb3cc', '#cf8fa8'];
function cityBand(rate, period, alpha, col, maxH, win) {
  var hb = grassTop() + 6 * S;
  g.save(); g.globalAlpha = alpha;
  layer(rate, period, function (x, i) {
    for (var k = 0; k < 3; k++) {
      var r1 = h1r(i * 9.7 + k * 3.3), r2 = h1r(i * 4.1 + k * 7.9);
      var bw = (52 + r1 * 62) * S, bh = (78 + r2 * (maxH - 78)) * S;
      var bx = x + k * (period / 3) + r1 * 12 * S;
      g.fillStyle = col || CITY_COL[Math.floor(h1r(i * 2.3 + k * 11.7) * CITY_COL.length)];
      g.fillRect(bx, hb - bh, bw, bh);
      if (r2 > 0.78) g.fillRect(bx + bw * 0.42, hb - bh - 26 * S, 5 * S, 26 * S);   // антенна
      if (r1 > 0.66) g.fillRect(bx - 5 * S, hb - bh - 9 * S, bw + 10 * S, 9 * S);   // карниз
      if (win) {
        var cols = Math.max(2, Math.floor(bw / (17 * S))), rows = Math.floor(bh / (26 * S));
        for (var cx = 0; cx < cols; cx++) for (var cy = 0; cy < rows; cy++) {
          var lit = h1r(i * 31 + k * 17 + cx * 5 + cy * 2.7);
          g.fillStyle = night > 0.25 ? (lit > 0.45 ? '#ffe9a8' : 'rgba(20,28,44,.55)')
                                     : (lit > 0.70 ? '#dff0ff' : 'rgba(255,255,255,.30)');
          g.fillRect(bx + 7 * S + cx * (bw - 12 * S) / cols,
                     hb - bh + 16 * S + cy * 26 * S, (bw - 14 * S) / cols * 0.62, 13 * S);
        }
      }
    }
  });
  g.restore();
}
function treeBand() {                                   // плотная опушка на горизонте
  var hb = grassTop() + 6 * S, t = TH();
  layer(0.44, 190 * S, function (x, i) {
    var r = h1r(i * 5.3), h = (74 + r * 62) * S, w = (34 + r * 22) * S;
    /* Лес брал зелень константой и на закате оставался ярко-зелёным, а в зиме и
       космосе — тоже. Подмешиваем траву локации: она у каждой темы своя. */
    var base = mix(t.far === 'jungle' ? '#2c6e45' : '#5aa257', mix(t.grass, '#000000', 0.35), 0.55);
    var cx = x + 40 * S, cy = hb - h + w * 0.5;
    g.fillStyle = '#6b4f34';                                    // ствол трапецией, а не прямоугольником
    g.beginPath();
    g.moveTo(cx - 7 * S, hb); g.lineTo(cx + 7 * S, hb);
    g.lineTo(cx + 4 * S, cy + w * 0.4); g.lineTo(cx - 4 * S, cy + w * 0.4); g.closePath(); g.fill();
    g.fillStyle = haze(mix(base, '#000000', 0.12), 0.22);       // тёмный слой кроны позади
    g.beginPath();
    for (var q = 0; q < 4; q++) {
      var a = h1r(i * 5.3 + q), ax = cx + (a - 0.5) * w * 1.1, ay = cy + (h1r(i + q * 2.1) - 0.5) * w * 0.5;
      g.moveTo(ax + w * 0.62, ay); g.arc(ax, ay, w * 0.62, 0, TAU);
    }
    g.fill();
    g.fillStyle = haze(base, 0.16);                             // светлый слой сверху
    g.beginPath();
    for (var q2 = 0; q2 < 3; q2++) {
      var b = h1r(i * 9.7 + q2), bx = cx + (b - 0.5) * w * 0.9, by = cy - w * 0.22 + (h1r(i + q2 * 3.3) - 0.5) * w * 0.4;
      g.moveTo(bx + w * 0.56, by); g.arc(bx, by, w * 0.56, 0, TAU);
    }
    g.fill();
  });
}
function peaks() {                                      // горы за холмами
  var hb = grassTop() + 6 * S, t = TH();
  layer(0.10, 420 * S, function (x, i) {
    var r = h1r(i * 3.7), h = (190 + r * 130) * S, w = 250 * S;
    g.fillStyle = t.h1;
    g.beginPath(); g.moveTo(x, hb); g.lineTo(x + w * 0.5, hb - h); g.lineTo(x + w, hb); g.closePath(); g.fill();
    if (t.snow) {                                     // шапки только там, где реально снег
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.beginPath(); g.moveTo(x + w * 0.5, hb - h);
      g.lineTo(x + w * 0.5 + 30 * S, hb - h + 52 * S); g.lineTo(x + w * 0.5 - 30 * S, hb - h + 52 * S);
      g.closePath(); g.fill();
    }
  });
}
function dunes() {                                      // барханы: широкие и высокие
  var hb = grassTop() + 6 * S;
  g.fillStyle = TH().h1;
  layer(0.12, 620 * S, function (x) {
    g.beginPath(); g.moveTo(x - 80 * S, hb);
    g.bezierCurveTo(x + 120 * S, hb - 260 * S, x + 330 * S, hb - 190 * S, x + 560 * S, hb);
    g.fill();
  });
}
function seaBand() {                                    // море у горизонта
  var hb = grassTop() + 6 * S, hh = 120 * S;
  var gr = g.createLinearGradient(0, hb - hh, 0, hb);
  gr.addColorStop(0, '#3fb8d8'); gr.addColorStop(1, '#9fe4ee');
  g.fillStyle = gr; g.fillRect(0, hb - hh, W, hh);
  g.save(); g.fillStyle = 'rgba(255,255,255,.55)';
  layer(0.18, 150 * S, function (x, i) {
    var r = h1r(i * 2.9);
    g.fillRect(x, hb - hh + (14 + r * 84) * S, (26 + r * 34) * S, 4 * S);
  });
  g.restore();
}
function drawFar() {
  var kind = TH().far || 'hills';
  if (kind === 'city') {                                 // город: два ряда домов, ближний — с окнами
    cityBand(0.13, 340 * S, 0.42, '#aebbcc', 200, 0);   // дальняя дымка — одним тоном
    cityBand(0.26, 260 * S, 1, 0, 285, 1);              // ближний ряд — цветной, с окнами
    return;
  }
  if (kind === 'peaks') peaks();
  if (kind === 'dunes') dunes();
  if (kind === 'sea')   seaBand();
  drawHills();
  if (kind === 'forest' || kind === 'jungle') treeBand();
}

/* Холмы: раньше колбэк игнорировал индекс, и через каждые 520*S шла одна и та же дуга —
   идеальная периодичность и читалась как «геометрично». Теперь форма и высота гуляют,
   а дальние слои выцветают в небо. */
function hill(rate, period, base, amp, col, k, rim) {
  var hb = grassTop() + 6 * S;
  var body = haze(col, k);
  g.fillStyle = body;
  layer(rate, period, function (x, i) {
    var r = h1r(i * 3.7), r2 = h1r(i * 8.1);
    var w = (base + r * base * 0.45) * S, h = (amp * (0.62 + r2 * 0.62)) * S;
    g.beginPath(); g.moveTo(x - 60 * S, hb);
    g.quadraticCurveTo(x + w * 0.42 + (r - 0.5) * 120 * S, hb - h, x + w, hb);
    g.lineTo(x + w, hb + 8 * S); g.lineTo(x - 60 * S, hb + 8 * S); g.closePath(); g.fill();
  });
  /* Светлая кромка по гребню. Без неё слои холмов сливаются в одно зелёное пятно:
     воздушная перспектива даёт разницу в тоне, но форму читает именно кант. */
  if (!rim) return;
  g.save();
  g.strokeStyle = mix(body, '#ffffff', rim);
  g.lineWidth = 3 * S; g.lineCap = 'round';
  layer(rate, period, function (x, i) {
    var r = h1r(i * 3.7), r2 = h1r(i * 8.1);
    var w = (base + r * base * 0.45) * S, h = (amp * (0.62 + r2 * 0.62)) * S;
    g.beginPath(); g.moveTo(x - 60 * S, hb);
    g.quadraticCurveTo(x + w * 0.42 + (r - 0.5) * 120 * S, hb - h, x + w, hb);
    g.stroke();
  });
  g.restore();
}
function drawHills() {
  var t = TH(), hb = grassTop() + 6 * S;
  /* Свечение у горизонта: дальний план не должен упираться в небо ровной кромкой. */
  var gl = g.createLinearGradient(0, hb - 190 * S, 0, hb + 10 * S);
  gl.addColorStop(0, 'rgba(255,255,255,0)');
  gl.addColorStop(1, 'rgba(255,255,255,.28)');
  g.save(); g.fillStyle = gl; g.fillRect(0, hb - 190 * S, W, 200 * S); g.restore();

  hill(0.14, 640 * S, 470, 250, t.h1, 0.62, 0.22);   // самый дальний — почти цвета неба
  hill(0.22, 520 * S, 380, 210, t.h1, 0.34, 0.26);
  hill(0.34, 430 * S, 300, 150, t.h2, 0.06, 0.30);
}
/* Высоты сведены к одной шкале: дом = 132. Раньше курица была ростом в половину коровы,
   ромашки — почти с курицу, а забор выше коровьей спины. */
/* Кто может ехать по дороге навстречу обгону, а кто только стоит на обочине. */
var TRAFFIC_KIND = { car_red:1, bus:1, ambulance:1, tractor:1, garbage:1, tow:1, excavator:1 };
var PROP_H = { car_red:76, cow:84, horse:92, chicken:34, fence:46, haystack:70, windmill:210, daisies:26,
               house:132, tree:168, bush:56, loc_tower:230, loc_shop:150, loc_palm:196,
               loc_umbrella:104, loc_jungle:200, loc_monkey:78, loc_rock:86, loc_rocket:170,
               loc_fir:180, loc_snowman:96,
               chest:64, sheep:78, bus:118, ambulance:112, excavator:122, tractor:118,
               garbage:116, tow:114, master:150 };
/* Переезд. Рельсы уходят от горизонта на зрителя и пересекают дорогу целиком,
   поезд идёт по ним наискось — сверху вниз, а не вдоль дороги. */
function railGeom(sx) {
  var x0 = sx + 78 * S, y0 = roadTop() - 34 * S,   // дальний конец — за дорогой
      x1 = sx - 104 * S, y1 = GY + 104 * S;        // ближний конец — перед дорогой
  return { x0: x0, y0: y0, x1: x1, y1: y1, ang: Math.atan2(y1 - y0, x1 - x0) };
}
function railAt(G, t) {
  return [G.x0 + (G.x1 - G.x0) * t, G.y0 + (G.y1 - G.y0) * t];
}
function drawRail(o, sx) {
  var G = railGeom(sx), i, t, pt, hw, N = 15;
  g.save();
  g.fillStyle = '#93856c'; g.globalAlpha = 0.55;         // насыпь
  g.beginPath();
  g.moveTo(G.x0 - 30 * S, G.y0); g.lineTo(G.x0 + 30 * S, G.y0);
  g.lineTo(G.x1 + 86 * S, G.y1); g.lineTo(G.x1 - 86 * S, G.y1);
  g.closePath(); g.fill();
  g.globalAlpha = 1;
  for (i = 0; i <= N; i++) {                              // шпалы: вдаль чаще и мельче
    t = Math.pow(i / N, 1.5);
    pt = railAt(G, t); hw = (20 + 44 * t) * S;
    g.save(); g.translate(pt[0], pt[1]); g.rotate(G.ang + Math.PI / 2);
    g.fillStyle = '#6b5a45';
    g.fillRect(-hw, -(2.5 + 4 * t) * S, hw * 2, (5 + 8 * t) * S);
    g.restore();
  }
  for (i = -1; i <= 1; i += 2) {                          // сами рельсы — с перспективой
    var n0 = [Math.cos(G.ang + Math.PI / 2), Math.sin(G.ang + Math.PI / 2)];
    g.beginPath();
    g.moveTo(G.x0 + n0[0] * i * 11 * S - 2 * S, G.y0 + n0[1] * i * 11 * S);
    g.lineTo(G.x0 + n0[0] * i * 11 * S + 2 * S, G.y0 + n0[1] * i * 11 * S);
    g.lineTo(G.x1 + n0[0] * i * 33 * S + 6 * S, G.y1 + n0[1] * i * 33 * S);
    g.lineTo(G.x1 + n0[0] * i * 33 * S - 6 * S, G.y1 + n0[1] * i * 33 * S);
    g.closePath();
    g.fillStyle = '#aab3c2'; g.fill();
  }
  g.restore();
  spr('crossing', sx + 150 * S, roadTop() + 8 * S, 108 * S);   // знак у обочины, за дорогой
  if (o.train) {
    /* Настоящий переезд: две лампы, попеременно и плавно. Была одна и рубленым
       квадратом на 12 рад/с — почти четыре вспышки в секунду. */
    var ph = Math.sin(T * 4.4), lx = sx + 150 * S, ly = roadTop() - 74 * S;
    g.save();
    for (var lb = 0; lb < 2; lb++) {
      var k = clamp((lb ? -ph : ph) * 0.5 + 0.5, 0, 1);
      g.globalAlpha = 0.35 + 0.65 * k;
      g.fillStyle = '#ff4b4b';
      g.beginPath(); g.arc(lx + (lb ? 15 : -15) * S, ly, 9 * S, 0, TAU); g.fill();
      g.globalAlpha = 0.18 * k;
      g.beginPath(); g.arc(lx + (lb ? 15 : -15) * S, ly, 24 * S, 0, TAU); g.fill();
    }
    g.restore();
  }
}
/* Состав: голова на o.p, вагоны — дальше к горизонту. Шаг пропорционален масштабу,
   поэтому на экране вагоны идут вплотную и уменьшаются вдаль. Геометрия рельсов не меняется. */
function trainScale(p) { return 0.45 + 0.85 * Math.min(p, 1.1); }
function trainSegs(o) {
  var res = [], p = o.p, n = 1 + (o.cars || TUNE.trainCars), i;
  for (i = 0; i < n; i++) { res.push(p); p -= TUNE.trainSeg * trainScale(p); }
  return res;
}
function trainOnLane(o) {                          // хоть один вагон стоит на полосе машинки
  var s = trainSegs(o), i;
  for (i = 0; i < s.length; i++) if (s[i] > 0.30 && s[i] < 0.62) return true;
  return false;
}
function drawTrain(near) {          // near=false — дальняя половина состава, true — ближняя (поверх машинки)
  if (state !== 'play' && state !== 'lesson') return;
  for (var i = 0; i < objs.length; i++) {
    var o = objs[i];
    if (o.t !== 'rail' || !o.train) continue;
    var sx = scr(o), G = railGeom(sx), segs = trainSegs(o);
    for (var j = segs.length - 1; j >= 0; j--) {       // дальние вагоны рисуем первыми
      var p = segs[j];
      if (p < -0.03 || p > 1.15) continue;             // ещё за горизонтом или уже ушёл за нижний край
      if ((p >= 0.5) !== !!near) continue;
      var pt = railAt(G, p), k = trainScale(p);
      var nm = (j > 0 && ok(IMG.wagon)) ? 'wagon' : 'train';   // отдельный спрайт вагона — когда появится
      spr(nm, pt[0], pt[1] + 26 * S * k, 150 * S * k, { rot: Math.sin(T * 22 + j) * 0.012 });
      if (j === 0 && p < 0.5) {
        /* Дым: три клуба, каждый поднимается, расплывается и тает. Был один
           неподвижный кружок — паровоз выглядел выключенным. */
        g.save();
        for (var pf = 0; pf < 3; pf++) {
          var t2 = ((T * 0.55 + pf / 3) % 1);
          g.globalAlpha = 0.5 * (1 - t2);
          g.fillStyle = '#e8ecf2';
          g.beginPath();
          g.arc(pt[0] - 30 * S * k - t2 * 34 * S * k, pt[1] - 78 * S * k - t2 * 70 * S * k,
                (9 + t2 * 16) * S * k, 0, TAU);
          g.fill();
        }
        g.restore();
      }
    }
  }
}

/* Занято ли место у обочины предметом, который прилетел со спавном. Фоновый ряд
   про них не знает, и корова вставала прямо на куст — на скриншоте это первое, что
   бросается в глаза. */
function propBusy(cx) {
  for (var i = 0; i < objs.length; i++) {
    var o = objs[i];
    if (o.t !== 'prop' && o.t !== 'traffic') continue;
    if (Math.abs(((o.x - carX) + CARX) - cx) < 150 * S) return true;
  }
  return false;
}

var farSpots = [];                          // экранныеx дальнего ряда: ближний ряд не должен на них лезть
function drawProps() {
  var pr = TH().props || ['house', 'tree'], pb = grassTop() + 46 * S;   // дальний ряд — по верхней трети травы
  var still = (state !== 'play');            // на экранах без движения дом не заслоняет машинку
  farSpots.length = 0;
  layer(0.55, 430 * S, function (x, i) {
    var nm = pr[(i % pr.length + pr.length) % pr.length];
    var cx = x + 90 * S;
    /* На неподвижных экранах машинка стоит то на CARX, то по центру — оберегаем оба места. */
    if (still && (Math.abs(cx - CARX) < 150 * S || Math.abs(cx - W / 2) < 210 * S)) return;
    if (propBusy(cx)) return;                 // здесь уже стоит предмет со спавна
    var hh = (PROP_H[nm] || 150) * 0.86 * S, ww = sprW(nm, hh) * 0.5;
    if (nm === 'fence') return;                                   // забор ставим только у дома, ниже
    farSpots.push(cx);
    ground(cx, pb - 1 * S, ww * 0.9);
    spr(frameOf(nm, i), cx, pb, hh, withMove(nm, i, hh, { alpha: 0.94 }));
    if (nm === 'house') fenceRun(cx, pb + 14 * S, 52 * S, 6);      // у дома — палисадник перед ним
    tufts(cx, pb, ww * 0.8, i);
  });
  // ближний ряд кустов: на траве, а не на асфальте (раньше стоял на roadTop + 14*S, то есть внутри дороги)
  var bb = roadTop() - 14 * S;
  layer(0.8, 260 * S, function (x, i) {
    if (i % 2) return;
    var cx = x + 40 * S;
    if (propBusy(cx)) return;                 // не ставим куст туда, где уже стоит предмет
    /* Ряды идут с разной скоростью и наезжают друг на друга: корова вставала на куст.
       И машинка всегда на CARX — куст не должен расти у неё из крыши. */
    if (Math.abs(cx - CARX) < 130 * S) return;
    for (var q = 0; q < farSpots.length; q++) if (Math.abs(cx - farSpots[q]) < 120 * S) return;
    ground(cx, bb - 1 * S, 22 * S);
    spr('bush', cx, bb, 66 * S, withMove('bush', i, 66 * S, {}));
    tufts(cx, bb, 20 * S, i * 1.7);
  });
}
function drawClouds() {
  /* Собственный ветер: слой облаков раньше двигался только вместе с машинкой,
     и на всех стартовых экранах мир стоял стоп-кадром. ~11*S px/с — это дрейф,
     облако пересекает кадр примерно за две минуты. */
  var save = bgX;
  bgX = (bgX == null ? carX : bgX) + T * 90 * S;
  layer(0.12, 560 * S, function (x, i) {
    spr('cloud', x + 100 * S, 64 * S + ((i * 137) % 5) * 38 * S, 86 * S, { mid: true, alpha: 0.95 });
  });
  bgX = save;
}
/* Горизонт: верх асфальта. Машинка едет по GY, а полотно начинается заметно выше —
   так дорога выглядит широкой, а дома и деревья честно стоят за ней. */
function roadTop() { return GY - 52 * S; }

/* Высота полосы земли между холмами и асфальтом. Была 28*S — дом высотой 113*S стоял
   на 24*S травы и читался как наклейка на стыке двух заливок. */
var GRASS_H = 104;
function grassTop() { return roadTop() - (GRASS_H - 2) * S; }

function drawRoad() {
  var top = roadTop(), t = TH(), gt = grassTop();
  g.fillStyle = grd('grass', function (th) {                               // трава светлее у горизонта
    var q = g.createLinearGradient(0, gt, 0, top + 2 * S);
    q.addColorStop(0, mix(th.grass, th.sky[2], 0.30)); q.addColorStop(1, th.grass);
    return q;
  });
  g.fillRect(0, gt, W, top - gt + 2 * S);                                 // обочина
  /* Мягкие пятна на траве вместо ровной плиты. Прямоугольные полосы пробовал —
     читаются как блоки, стало хуже; овалы с низким контрастом дают только глубину. */
  g.save();
  g.globalAlpha = 0.25; g.fillStyle = mix(t.grass, '#ffffff', 0.16);
  layer(0.42, 300 * S, function (x, i) {
    var r = h1r(i * 4.3);
    g.beginPath();
    g.ellipse(x + 90 * S, gt + (top - gt) * (0.35 + r * 0.4), (70 + r * 90) * S, (10 + r * 12) * S, 0, 0, TAU);
    g.fill();
  });
  g.restore();
  g.fillStyle = grd('haze', function () {                                 // мягкая дымка вместо белой линейки
    var q = g.createLinearGradient(0, gt - 10 * S, 0, gt + 26 * S);
    q.addColorStop(0, 'rgba(255,255,255,.30)'); q.addColorStop(1, 'rgba(255,255,255,0)');
    return q;
  });
  g.fillRect(0, gt - 10 * S, W, 36 * S);
  g.fillStyle = grd('road', function (th) {
    var q = g.createLinearGradient(0, top, 0, H);
    q.addColorStop(0, th.road[0]); q.addColorStop(1, th.road[1]);
    return q;
  });
  g.fillRect(0, top, W, H - top);
  g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(0, top, W, 3 * S);
  /* Тень от обочины на асфальт: без неё дорога начиналась ровной линией и читалась
     как приклеенная плита. */
  var edge = g.createLinearGradient(0, top, 0, top + 26 * S);
  edge.addColorStop(0, 'rgba(0,0,0,.20)'); edge.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = edge; g.fillRect(0, top, W, 26 * S);
  /* Накатанные колеи: две широкие светлые полосы вдоль движения. */
  g.save(); g.globalAlpha = 0.055; g.fillStyle = '#ffffff';
  g.fillRect(0, top + (H - top) * 0.30, W, (H - top) * 0.13);
  g.fillRect(0, top + (H - top) * 0.62, W, (H - top) * 0.15);
  g.restore();
  g.fillStyle = 'rgba(255,255,255,.85)';
  var per = 150 * S, off = carX % per;
  for (var x = -per; x < W + per; x += per) g.fillRect(x - off, GY + 62 * S, 76 * S, 9 * S);
  drawNearSide(t);
}

/* Ближняя обочина. Раньше нижняя треть кадра была ровной серой плитой — теперь у дороги
   виден край, и слой едет быстрее остальных, отчего появляется глубина. */
function drawNearSide(t) {
  var y = H - 54 * S;
  g.save();
  g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, y, W, H - y);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(0, y, W, 5 * S);
  g.fillStyle = t.grass; g.globalAlpha = 0.9;
  g.fillRect(0, H - 16 * S, W, 16 * S);
  g.globalAlpha = 1;
  /* Отражатели. Слой шёл со скоростью 1,55 — быстрее самой дороги, а чередование
     двух контрастных цветов давало в фиксированной точке экрана до дюжины смен в
     секунду. Теперь скорость дороги и одна краска с мягкой разницей в яркости. */
  layer(1.0, 120 * S, function (x, i) {
    g.fillStyle = i % 2 ? 'rgba(255,217,61,.95)' : 'rgba(255,217,61,.6)';
    g.fillRect(x, y + 14 * S, 16 * S, 7 * S);
  });
  g.restore();
}

/* Высота мяча над землёй: одна формула для отрисовки и для удара. */
function ballH(o) { return Math.abs(Math.sin((o.ph || 0) * 3 + T * 3)) * 70 * S; }


/* ═══════════════ 17f-3D. РУЛЬ В НАСТОЯЩЕМ 3D (three.js) ═══════════════
   Меняется ТОЛЬКО картинка. Состояние заезда (ln), спавн и касания живут в 33-lane.js
   и не трогаются: здесь мы лишь читаем ln.x / ln.y / ln.wz / ln.objs и строим из них
   низкополигональную сцену по тем же hillAt() и curveAt().

   Как включается: только флагом — ?3d=1 в адресе или галка L3.on в админке. По умолчанию
   прежний 2D. three.js лежит в vendor/three и подгружается лениво при первом входе в «руль».
   Пока грузится, если WebGL нет, импорт упал или контекст потерян — молча рисуется 2D.

   Система координат: машинка в начале координат, дорога уходит в −Z. Глубина игры z
   (0 — машинка, 1 — горизонт) переводится в метры множителем L3.depth. Всё считается
   относительно текущего ln.wz, поэтому точность float не уплывает на длинном заезде.
   Объект с o.z ≈ 0 стоит ровно на уровне машинки — там же, где игра считает касание.   */
var L3 = {
  on: 0,                                    // 1 — рисовать 3D (по умолчанию выключено, включает ?3d=1 или админка)
  depth: 60,                                // метров на единицу игровой глубины
  road: 5.6,                                // полуширина асфальта, м (ряды — LN.laneK от неё)
  hillK: 0.07, curveK: 0.11,                // перевод пикселей рельефа и изгиба в метры
  pxK: 0.0125,                              // перевод игровых пикселей высоты (шарик, разлёт) в метры
  jumpK: 0.008,                             // то же для прыжка: полная высота закрывала машинкой полдороги
  camBack: 11, camUp: 4.3, fov: 56,         // камера: позади, выше, вертикальный угол обзора
  horizon: 0.40,                            // где на экране горизонт (доля высоты сверху)
  camFollow: 0.55, camHill: 0.6,            // насколько камера идёт за рядом машинки и за склоном
  fogNear: 0.55, fogFar: 1.2,               // туман в долях глубины: объекты появляются из дымки
  sideHill: 9,                              // высота холмов по сторонам дороги, м
  dpr: 1.5                                  // потолок плотности пикселей для WebGL
};
CFG.reg('L3', L3, {
  on:       [0,    1,    1,     '3D-руль: 1 — включён'],
  depth:    [20,   140,  1,     'метров на единицу глубины'],
  road:     [3,    10,   0.1,   'полуширина дороги, м'],
  hillK:    [0,    0.2,  0.005, 'высота подъёмов в 3D'],
  curveK:   [0,    0.2,  0.005, 'сила поворотов в 3D'],
  jumpK:    [0.002, 0.02, 0.0005, 'высота прыжка в 3D'],
  camBack:  [4,    20,   0.1,   'камера: отступ назад'],
  camUp:    [1,    10,   0.1,   'камера: высота'],
  fov:      [40,   75,   1,     'камера: угол обзора'],
  horizon:  [0.2,  0.6,  0.01,  'высота горизонта на экране'],
  camFollow:[0,    1,    0.01,  'камера идёт за рядом'],
  camHill:  [0,    1,    0.01,  'камера наклоняется за склоном'],
  fogNear:  [0.1,  1,    0.01,  'туман: начало'],
  fogFar:   [0.5,  1.5,  0.01,  'туман: конец'],
  sideHill: [0,    25,   0.5,   'холмы вдоль дороги, м'],
  dpr:      [0.75, 2,    0.05,  'потолок плотности пикселей 3D']
});
try { if (/[?&]3d=1/.test(location.search)) L3.on = 1; } catch (e) {}

var Lane3D = (function () {
  var st = 0;                     // 0 — не начинали, 1 — грузим, 2 — готово, −1 — отказ (навсегда 2D)
  var T3 = null, R = null, glc = null, scene, cam, sun, hemi, fog;
  var drew = false, shown = false, lastWz = 0, wheelA = 0, carKey = '', thRef = null;
  var vw = 0, vh = 0, vdpr = 0, dprNow = 1.5, slowN = 0, lastT = 0, ms = 0;
  var mats = {}, road = {}, pools = {}, scen = {}, shadowIM, player = null;

  /* ── проверка WebGL без three.js: ничего не грузим туда, где он всё равно не заведётся ── */
  function hasGL() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
    catch (e) { return false; }
  }
  function init() {
    if (st !== 0 || !L3.on) return;
    if (!hasGL()) { st = -1; return; }
    st = 1;
    import('./vendor/three/three.module.min.js').then(function (m) {
      try { T3 = m; build(); st = 2; } catch (e) { fail(); }
    }, function () { st = -1; });
  }
  function fail() {
    st = -1;
    try { if (glc) glc.style.display = 'none'; } catch (e) {}
  }

  /* ════════ Геометрия: детали склеиваются в одну сетку с цветами вершин ════════
     Один меш на предмет = один вызов отрисовки. Всё — при постройке, не в кадре. */
  var _m, _q, _e, _p, _s, _c;
  function part(geo, col, pos, rot, scl, fn) {
    var g2 = geo.index ? geo.toNonIndexed() : geo.clone();
    _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0); _q.setFromEuler(_e);
    _m.compose(_p.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0), _q,
               _s.set(scl ? scl[0] : 1, scl ? scl[1] : 1, scl ? scl[2] : 1));
    g2.applyMatrix4(_m);
    return { g: g2, c: col, fn: fn };
  }
  function merge(parts) {
    var n = 0, i, k;
    for (i = 0; i < parts.length; i++) n += parts[i].g.attributes.position.count;
    var pos = new Float32Array(n * 3), col = new Float32Array(n * 3), o = 0;
    for (i = 0; i < parts.length; i++) {
      var a = parts[i].g.attributes.position.array, cnt = a.length / 3;
      pos.set(a, o * 3);
      for (k = 0; k < cnt; k += 3) {                      // цвет — на грань целиком: плоская закраска
        var hex = parts[i].c;
        if (parts[i].fn) {
          var j = k * 3;
          hex = parts[i].fn((a[j] + a[j + 3] + a[j + 6]) / 3, (a[j + 1] + a[j + 4] + a[j + 7]) / 3, (a[j + 2] + a[j + 5] + a[j + 8]) / 3);
        }
        _c.set(hex);
        for (var v = 0; v < 3; v++) { var q = (o + k + v) * 3; col[q] = _c.r; col[q + 1] = _c.g; col[q + 2] = _c.b; }
      }
      o += cnt;
    }
    var geo = new T3.BufferGeometry();
    geo.setAttribute('position', new T3.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T3.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    return geo;
  }
  function box(w, h, d) { return new T3.BoxGeometry(w, h, d); }
  function ico(r, det) { return new T3.IcosahedronGeometry(r, det || 0); }
  function cyl(r1, r2, h, n) { return new T3.CylinderGeometry(r1, r2, h, n || 8); }
  function cone(r, h, n) { return new T3.ConeGeometry(r, h, n || 8); }

  /* Машинка: короб, сужающаяся кабина, окна, фонари, крупные колёса. Вперёд — −Z. */
  function carParts(c0, c1, kind) {
    var big = kind === 'monster', lift = big ? 0.45 : 0, P = [];
    var light = mixHex(c0, '#ffffff', 0.18);
    P.push(part(box(1.9, 0.55, 3.3), c0, [0, 0.62 + lift, 0]));
    P.push(part(box(1.94, 0.14, 3.34), c1, [0, 0.8 + lift, 0]));                 // полоса по борту
    P.push(part(box(1.98, 0.2, 0.24), '#3a3550', [0, 0.42 + lift, 1.62]));       // задний бампер
    P.push(part(box(1.98, 0.2, 0.24), '#3a3550', [0, 0.42 + lift, -1.62]));
    var cab = box(1.5, 0.58, 1.7), cp = cab.attributes.position;
    for (var i = 0; i < cp.count; i++) if (cp.getY(i) > 0) { cp.setX(i, cp.getX(i) * 0.8); cp.setZ(i, cp.getZ(i) * 0.86 - 0.05); }
    P.push(part(cab, light, [0, 1.18 + lift, 0.25]));
    P.push(part(box(1.16, 0.38, 0.06), '#bfe9ff', [0, 1.17 + lift, 1.1]));      // заднее стекло
    P.push(part(box(1.16, 0.38, 0.06), '#bfe9ff', [0, 1.17 + lift, -0.6]));
    P.push(part(box(1.52, 0.3, 1.2), '#9fd8f5', [0, 1.17 + lift, 0.25]));        // боковые окна
    P.push(part(box(0.38, 0.16, 0.08), '#ff3b3b', [-0.68, 0.74 + lift, 1.66]));  // фонари
    P.push(part(box(0.38, 0.16, 0.08), '#ff3b3b', [0.68, 0.74 + lift, 1.66]));
    P.push(part(box(0.5, 0.12, 0.06), '#f2f6fb', [0, 0.56 + lift, 1.66]));       // номер
    if (kind === 'police') {
      P.push(part(box(0.42, 0.16, 0.34), '#ff3b3b', [-0.22, 1.56 + lift, 0.3]));
      P.push(part(box(0.42, 0.16, 0.34), '#3b7bff', [0.22, 1.56 + lift, 0.3]));
    }
    if (kind === 'fire') {
      P.push(part(box(0.08, 0.08, 2.4), '#d9d9d9', [-0.3, 1.56 + lift, 0.1]));
      P.push(part(box(0.08, 0.08, 2.4), '#d9d9d9', [0.3, 1.56 + lift, 0.1]));
      for (var r = 0; r < 5; r++) P.push(part(box(0.6, 0.06, 0.06), '#d9d9d9', [0, 1.56 + lift, -0.9 + r * 0.5]));
    }
    if (kind === 'race') {
      P.push(part(box(1.9, 0.08, 0.42), c1, [0, 1.22 + lift, 1.45]));            // антикрыло
      P.push(part(box(0.08, 0.32, 0.12), '#3a3550', [-0.6, 1.04 + lift, 1.45]));
      P.push(part(box(0.08, 0.32, 0.12), '#3a3550', [0.6, 1.04 + lift, 1.45]));
    }
    return P;
  }
  function wheelGeo(r, w) {
    return merge([part(cyl(r, r, w, 10), '#2b2140', null, [0, 0, Math.PI / 2]),
                  part(cyl(r * 0.5, r * 0.5, w + 0.04, 6), '#c9ced8', null, [0, 0, Math.PI / 2])]);
  }
  function wheelSpots(kind) {
    var big = kind === 'monster', r = big ? 0.72 : 0.46, x = big ? 1.08 : 0.98;
    return { r: r, w: big ? 0.62 : 0.44, at: [[-x, r, -1.08], [x, r, -1.08], [-x, r, 1.08], [x, r, 1.08]] };
  }
  /* попутная машина: колёса вклеены в кузов, она не крутит их — один вызов отрисовки */
  function trafficGeo(col) {
    var P = carParts(col[0], col[1], ''), ws = wheelSpots('');
    for (var i = 0; i < 4; i++) {
      var a = ws.at[i];
      P.push(part(cyl(ws.r, ws.r, ws.w, 10), '#2b2140', a, [0, 0, Math.PI / 2]));
    }
    return merge(P);
  }
  function starGeo() {
    var sh = new T3.Shape(), i;
    for (i = 0; i < 10; i++) {
      var a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.27 : 0.62;
      if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    var ex = new T3.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 1 });
    ex.translate(0, 0, -0.1);
    return merge([part(ex, '#ffd23d')]);
  }
  /* Двускатная крыша: треугольник, вытянутый вдоль конька. Цилиндр из трёх граней ложился
     вершиной вбок — крыша выглядела висящим клином. */
  function roofGeo() {
    var sh = new T3.Shape(); sh.moveTo(-1.45, 0); sh.lineTo(1.45, 0); sh.lineTo(0, 1.15); sh.lineTo(-1.45, 0);
    var ex = new T3.ExtrudeGeometry(sh, { depth: 2.9, bevelEnabled: false }); ex.translate(0, 0, -1.45);
    return ex;
  }
  var BUILD = {
    star: starGeo,
    fuel: function () {
      return merge([part(box(0.8, 0.95, 0.45), '#e63946', [0, 0.48, 0]),
                    part(box(0.5, 0.12, 0.12), '#7a1620', [-0.05, 1.02, 0]),
                    part(cyl(0.09, 0.09, 0.2, 6), '#ffd23d', [0.26, 1.04, 0]),
                    part(box(0.82, 0.12, 0.47), '#ffffff', [0, 0.55, 0])]);
    },
    cone: function () {
      return merge([part(box(0.95, 0.08, 0.95), '#d1561a', [0, 0.04, 0]),
                    part(cone(0.42, 1.0, 8), '#ff7a1a', [0, 0.58, 0]),
                    part(cyl(0.25, 0.3, 0.2, 8), '#ffffff', [0, 0.55, 0])]);
    },
    ball: function () {
      return merge([part(ico(0.46, 1), '#e63946', [0, 0.46, 0], null, null, function (x, y) {
        var b = (y - 0.46) / 0.46; return Math.abs(b) < 0.25 ? '#ffffff' : b > 0 ? '#3b7bff' : '#e63946';
      })]);
    },
    haystack: function () {
      return merge([part(cyl(0.68, 0.68, 1.4, 10), '#f2c94c', [0, 0.68, 0], [0, 0, Math.PI / 2], null, function (x) {
        return Math.abs(x) > 0.66 ? '#d9a93a' : '#f2c94c';
      })]);
    },
    hedgehog: function () {
      return merge([part(ico(0.5, 0), '#7a4f35', [0, 0.36, 0.05], null, [1, 0.72, 1.25]),
                    part(cone(0.2, 0.45, 6), '#e8c39e', [0, 0.3, 0.68], [Math.PI / 2, 0, 0]),
                    part(ico(0.07, 0), '#2b2140', [0, 0.3, 0.92]),
                    part(ico(0.05, 0), '#2b2140', [-0.14, 0.42, 0.62]),
                    part(ico(0.05, 0), '#2b2140', [0.14, 0.42, 0.62])]);
    },
    balloon: function () {
      return merge([part(ico(0.5, 1), '#ff4d6d', [0, 0, 0], null, [1, 1.18, 1]),
                    part(cone(0.1, 0.16, 5), '#c9184a', [0, -0.64, 0], [Math.PI, 0, 0]),
                    part(cyl(0.015, 0.015, 1.3, 3), '#ffffff', [0, -1.35, 0])]);
    },
    tree: function () {
      return merge([part(cyl(0.22, 0.3, 1.6, 6), '#8a5a3c', [0, 0.8, 0]),
                    part(ico(1.35, 0), '#4caf50', [0, 2.5, 0]),
                    part(ico(0.9, 0), '#66c35a', [0.5, 3.2, 0.2])]);
    },
    house: function () {
      return merge([part(box(2.6, 2, 2.4), '#fff1d6', [0, 1, 0]),
                    part(roofGeo(), '#e63946', [0, 2, 0], [0, Math.PI / 2, 0]),
                    part(box(0.6, 1.0, 0.06), '#8a5a3c', [0.5, 0.5, 1.21]),
                    part(box(0.6, 0.55, 0.06), '#9fd8f5', [-0.6, 1.2, 1.21]),
                    part(box(0.3, 0.8, 0.3), '#7a4f35', [0.7, 3.2, -0.5])]);
    },
    bush: function () {
      return merge([part(ico(0.7, 0), '#3f9c4a', [0, 0.5, 0]),
                    part(ico(0.55, 0), '#57b85a', [0.6, 0.4, 0.2]),
                    part(ico(0.5, 0), '#4caf50', [-0.55, 0.38, 0.1])]);
    },
    flower: function () {
      var P = [];
      for (var i = 0; i < 3; i++) {
        var x = (i - 1) * 0.45, h = 0.55 + (i % 2) * 0.2, c = ['#ff4d6d', '#ffd23d', '#c77dff'][i];
        P.push(part(cyl(0.03, 0.03, h, 3), '#3f9c4a', [x, h / 2, 0]));
        P.push(part(ico(0.2, 0), c, [x, h, 0], null, [1, 0.5, 1]));
        P.push(part(ico(0.08, 0), '#fff3a0', [x, h + 0.08, 0.04]));
      }
      return merge(P);
    },
    cloud: function () {
      return merge([part(ico(1.6, 1), '#ffffff', [0, 0, 0]), part(ico(1.2, 1), '#ffffff', [1.5, -0.3, 0.2]),
                    part(ico(1.1, 1), '#ffffff', [-1.5, -0.35, 0]), part(ico(0.9, 1), '#f2f6fb', [0.4, 0.9, -0.3])]);
    },
    bird: function () {
      var wing = new T3.BufferGeometry();
      wing.setAttribute('position', new T3.BufferAttribute(new Float32Array([0, 0, -0.25, 0, 0, 0.25, 1.1, 0.25, 0.05,
                                                                              0, 0, 0.25, 0, 0, -0.25, -1.1, 0.25, 0.05]), 3));
      return merge([part(wing, '#2b2140'), part(ico(0.22, 0), '#3a3550', [0, 0, 0], null, [0.8, 0.7, 1.6])]);
    },
    sky_balloon: function () {
      return merge([part(ico(1.4, 1), '#ff7a1a', [0, 0, 0], null, [1, 1.15, 1], function (x) {
                      return (Math.floor((x + 2) * 1.6) % 2) ? '#ffd23d' : '#e63946'; }),
                    part(box(0.6, 0.5, 0.6), '#8a5a3c', [0, -2.4, 0]),
                    part(cyl(0.02, 0.02, 0.8, 3), '#5a4a55', [0, -1.9, 0])]);
    },
    snowman: function () {
      return merge([part(ico(0.7, 1), '#ffffff', [0, 0.65, 0]), part(ico(0.5, 1), '#ffffff', [0, 1.6, 0]),
                    part(ico(0.34, 1), '#ffffff', [0, 2.3, 0]), part(cone(0.07, 0.4, 5), '#ff7a1a', [0, 2.3, 0.45], [Math.PI / 2, 0, 0])]);
    }
  };
  /* Реквизит тем (корова, автобус…) в 3D пока не моделирован — ставим похожую по роли форму. */
  var ALIAS = { daisies: 'flower', loc_snowman: 'snowman', loc_fir: 'pine', loc_palm: 'palm', loc_rock: 'rock',
                loc_jungle: 'tree', loc_tower: 'bld', loc_shop: 'house', windmill: 'house', fence: 'bush' };
  /* Пейзаж вдоль дороги: стоит по сетке мира, геймплея не касается. Это и даёт живую обочину —
     игровых предметов обочины на экране всего два-три. */
  var SCEN = {
    rtree: function () { return BUILD.tree(); },
    pine: function () {
      return merge([part(cyl(0.2, 0.25, 1, 5), '#7a4f35', [0, 0.5, 0]), part(cone(1.3, 2.2, 7), '#2f8f4e', [0, 1.9, 0]),
                    part(cone(0.95, 1.7, 7), '#3aa35a', [0, 3.0, 0])]);
    },
    spine: function () {
      return merge([part(cyl(0.2, 0.25, 1, 5), '#7a4f35', [0, 0.5, 0]), part(cone(1.3, 2.2, 7), '#2f7a4c', [0, 1.9, 0], null, null,
                    function (x, y) { return y > 2.3 ? '#ffffff' : '#2f7a4c'; }), part(cone(0.9, 1.6, 7), '#ffffff', [0, 3.0, 0])]);
    },
    bush: function () { return BUILD.bush(); },
    house: function () { return BUILD.house(); },
    bld: function () {
      return merge([part(box(4, 9, 4), '#c9d6e8', [0, 4.5, 0], null, null, function (x, y) {
        return (Math.floor(y * 0.9) % 2) ? '#9fd8f5' : '#c9d6e8'; }), part(box(4.2, 0.4, 4.2), '#8f9bb0', [0, 9.1, 0])]);
    },
    palm: function () {
      var P = [part(cyl(0.18, 0.28, 4, 6), '#a67c52', [0, 2, 0], [0, 0, 0.12])];
      for (var i = 0; i < 6; i++) {
        var a = i * Math.PI / 3;
        P.push(part(box(2.2, 0.08, 0.6), '#3aa35a', [Math.cos(a) * 1.0 + 0.24, 4.0, Math.sin(a) * 1.0], [0, -a, -0.35]));
      }
      return merge(P);
    },
    rock: function () { return merge([part(ico(1, 0), '#9a8f86', [0, 0.5, 0], null, [1.3, 0.8, 1])]); },
    crystal: function () {
      return merge([part(cone(0.6, 2.6, 5), '#b388ff', [0, 1.3, 0]), part(cone(0.4, 1.6, 5), '#7c4dff', [0.7, 0.8, 0.2], [0, 0, -0.3])]);
    },
    cactus: function () {
      return merge([part(cyl(0.35, 0.4, 3, 6), '#4caf50', [0, 1.5, 0]), part(cyl(0.22, 0.22, 1.2, 6), '#4caf50', [0.6, 1.8, 0]),
                    part(cyl(0.22, 0.22, 0.9, 6), '#4caf50', [-0.6, 2.2, 0])]);
    },
    flowerp: function () { return BUILD.flower(); }
  };
  var SCEN_BY = { 'деревня': ['rtree', 'rtree', 'pine', 'bush', 'house', 'bush'], 'город': ['bld', 'bld', 'rtree', 'bush'],
                  'пляж': ['palm', 'palm', 'bush', 'rock'], 'джунгли': ['palm', 'rtree', 'rtree', 'bush'],
                  'закат': ['rtree', 'pine', 'bush', 'house'], 'космос': ['rock', 'rock', 'crystal'],
                  'зима': ['spine', 'spine', 'rock', 'snowman'], 'луг': ['rtree', 'bush', 'flowerp', 'bush'],
                  'пустыня': ['cactus', 'rock', 'rock'] };
  SCEN.snowman = function () { return BUILD.snowman(); };
  var SCEN_N = 48;                                         // запас экземпляров на вид пейзажа

  function mixHex(a, b, k) { return typeof mix === 'function' ? mix(a, b, k) : a; }

  /* ════════ Постройка сцены (один раз) ════════ */
  function build() {
    var T = T3;
    _m = new T.Matrix4(); _q = new T.Quaternion(); _e = new T.Euler(); _p = new T.Vector3(); _s = new T.Vector3(); _c = new T.Color();
    glc = document.createElement('canvas');
    glc.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:none;pointer-events:none';
    cv.parentNode.insertBefore(glc, cv);                   // под игровым холстом: HUD рисуется поверх
    /* powerPreference по умолчанию: high-performance вместе со сглаживанием на iPhone
       давал 20 кадров вместо 120 (bugs.webkit.org/276959). */
    R = new T.WebGLRenderer({ canvas: glc, antialias: true, alpha: false, powerPreference: 'default' });
    R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
    glc.addEventListener('webglcontextlost', function (e) { e.preventDefault(); fail(); }, false);
    scene = new T.Scene();
    fog = new T.Fog(0xffffff, 10, 100); scene.fog = fog;
    cam = new T.PerspectiveCamera(56, 1, 0.3, 900);
    hemi = new T.HemisphereLight(0xffffff, 0x88aa66, 1.8); scene.add(hemi);
    sun = new T.DirectionalLight(0xfff4e0, 2.6);           // сбоку-сверху: грани читаются разной яркостью
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    var sc = sun.shadow.camera; sc.left = -4; sc.right = 4; sc.top = 4; sc.bottom = -4; sc.near = 1; sc.far = 30;
    sun.shadow.bias = -0.002;
    scene.add(sun); scene.add(sun.target);

    mats.v = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    mats.star = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x8a5a00, emissiveIntensity: 0.8 });
    mats.car = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0xffffff, emissiveIntensity: 0 });
    mats.road = new T.MeshLambertMaterial({ color: 0x5d6472, flatShading: true });
    mats.grass = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    mats.white = new T.MeshLambertMaterial({ color: 0xf7f7f2 });
    mats.hills = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false });
    mats.sky = new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false });
    mats.far = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: false });
    mats.shadow = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false,
                                            polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

    buildRoad();
    buildSky();
    var sg = new T.CircleGeometry(1, 14); sg.rotateX(-Math.PI / 2);
    shadowIM = new T.InstancedMesh(sg, mats.shadow, 64); shadowIM.frustumCulled = false; shadowIM.renderOrder = 1;
    scene.add(shadowIM);
    for (var k in SCEN) {
      var im = new T.InstancedMesh(SCEN[k](), mats.v, SCEN_N);
      im.frustumCulled = false; im.count = 0; im.visible = false;
      _c.setRGB(1, 1, 1); for (var i = 0; i < SCEN_N; i++) im.setColorAt(i, _c);   // заводим instanceColor сразу
      scen[k] = im; scene.add(im);
    }
  }

  /* Дорога, бордюр, разметка и трава пересобираются каждый кадр в одни и те же буферы. */
  var Z0 = -0.25, Z1 = 1.4, STEP = 0.02, ROWS = Math.ceil((Z1 - Z0) / STEP) + 2;
  var COLS = [-140, -80, -46, -26, -15, -9, -1, 1, 9, 15, 26, 46, 80, 140];   // ±1 — край у бордюра
  var rowX, rowY, rowZ, rowRX, rowRZ, rowG;
  function quadIndex(n) {
    var ix = new Uint32Array(n * 6);
    for (var i = 0; i < n; i++) { var v = i * 4, o = i * 6; ix[o] = v; ix[o + 1] = v + 1; ix[o + 2] = v + 2; ix[o + 3] = v + 1; ix[o + 4] = v + 3; ix[o + 5] = v + 2; }
    return ix;
  }
  function dyn(nv, idx, withColor) {
    var T = T3, g2 = new T.BufferGeometry();
    var pa = new T.BufferAttribute(new Float32Array(nv * 3), 3); pa.setUsage(T.DynamicDrawUsage);
    g2.setAttribute('position', pa);
    var na = new Float32Array(nv * 3); for (var i = 1; i < na.length; i += 3) na[i] = 1;
    g2.setAttribute('normal', new T.BufferAttribute(na, 3));
    if (withColor) { var ca = new T.BufferAttribute(new Float32Array(nv * 3), 3); ca.setUsage(T.DynamicDrawUsage); g2.setAttribute('color', ca); }
    g2.setIndex(new T.BufferAttribute(idx, 1));
    return g2;
  }
  function buildRoad() {
    var T = T3, r, c;
    rowX = new Float32Array(ROWS); rowY = new Float32Array(ROWS); rowZ = new Float32Array(ROWS);
    rowRX = new Float32Array(ROWS); rowRZ = new Float32Array(ROWS); rowG = new Float64Array(ROWS);
    // асфальт: две вершины на ряд
    var ri = [];
    for (r = 0; r < ROWS - 1; r++) { var a = r * 2; ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    road.asph = new T.Mesh(dyn(ROWS * 2, new Uint32Array(ri)), mats.road);
    // трава: сетка ROWS × COLS
    var gi = [], nc = COLS.length;
    for (r = 0; r < ROWS - 1; r++) for (c = 0; c < nc - 1; c++) {
      if (c === 6) continue;                                // под дорогой травы нет
      var v = r * nc + c; gi.push(v, v + 1, v + nc, v + 1, v + nc + 1, v + nc);
    }
    road.grass = new T.Mesh(dyn(ROWS * nc, new Uint32Array(gi), true), mats.grass);
    road.curbN = (ROWS - 1) * 2;
    road.curb = new T.Mesh(dyn(road.curbN * 4, quadIndex(road.curbN), true), mats.v);
    road.markN = (ROWS - 1) * 4;
    road.mark = new T.Mesh(dyn(road.markN * 4, quadIndex(road.markN)), mats.white);
    [road.asph, road.grass, road.curb, road.mark].forEach(function (m) { m.frustumCulled = false; scene.add(m); });
    road.asph.receiveShadow = true; road.curb.receiveShadow = true; road.mark.receiveShadow = true; road.grass.receiveShadow = true;
  }
  function buildSky() {
    var T = T3;
    road.sky = new T.Mesh(new T.SphereGeometry(800, 16, 12), mats.sky); road.sky.frustumCulled = false; road.sky.renderOrder = -2;
    road.sky.geometry.setAttribute('color', new T.BufferAttribute(new Float32Array(road.sky.geometry.attributes.position.count * 3), 3));
    scene.add(road.sky);
    // дальние горы — кольцо зубцов, цвет смешан с дымкой горизонта
    var P = [], n = 40;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, h = 26 + 26 * Math.abs(Math.sin(i * 1.7)) + 18 * Math.abs(Math.sin(i * 0.53));
      var rr = 560 + 60 * Math.sin(i * 2.3);
      P.push(part(cone(rr * 0.13, h, 5), '#ffffff', [Math.cos(a) * rr, h / 2 - 8, Math.sin(a) * rr], [0, a * 3.1, 0], [1, 1, 0.7]));
      P.push(part(ico(rr * 0.09, 0), '#ffffff', [Math.cos(a + 0.08) * rr * 0.96, -6, Math.sin(a + 0.08) * rr * 0.96], null, [1.6, 0.45, 1]));   // пологие холмы между пиками
    }
    road.hills = new T.Mesh(merge(P), mats.far); road.hills.frustumCulled = false; road.hills.renderOrder = -1;
    scene.add(road.hills);
    var C = [];
    for (i = 0; i < 9; i++) {
      var b = -0.9 + i * 0.22 + 0.05 * Math.sin(i * 3), d = 620;
      C.push(part(BUILD.cloud(), '#ffffff', [Math.sin(b) * d, 70 + 30 * Math.abs(Math.sin(i * 2.1)), -Math.cos(b) * d], null, [7, 4, 5]));
    }
    road.clouds = new T.Mesh(merge(C), mats.far); road.clouds.frustumCulled = false; road.clouds.renderOrder = -1;
    scene.add(road.clouds);
    road.sunM = new T.Mesh(new T.CircleGeometry(20, 20), new T.MeshBasicMaterial({ color: 0xfff6b0, fog: false, depthWrite: false }));
    road.sunM.renderOrder = -1; road.sunM.frustumCulled = false; scene.add(road.sunM);
  }

  /* ── форма дороги в метрах относительно машинки ── */
  function rX(zz) { return (curveAt(ln.wz + zz) - curveAt(ln.wz)) / S * L3.curveK; }
  function rY(zz) { return (hillAt(ln.wz + zz) - hillAt(ln.wz)) / S * L3.hillK; }
  var RA = { x: 0, y: 0, z: 0, rx: 1, rz: 0, yaw: 0 };
  function roadAt(zz, out) {
    var x = rX(zz), d = 0.01, sx = (rX(zz + d) - rX(zz - d)) / (2 * d * L3.depth), l = Math.sqrt(1 + sx * sx);
    out.x = x; out.y = rY(zz); out.z = -zz * L3.depth; out.rx = 1 / l; out.rz = sx / l; out.yaw = -Math.atan(sx);
    return out;
  }
  /* высота травы по сторонам: холмы растут от обочины наружу, привязаны к миру, а не к камере */
  function sideH(wzA, lat) {
    var a = Math.abs(lat), k = clamp((a - 14) / 40, 0, 1);
    if (k <= 0) return -0.06;
    return -0.06 + k * L3.sideHill * (0.55 + 0.45 * Math.sin(wzA * 7.3 + lat * 0.09) * Math.cos(wzA * 3.1 - lat * 0.05));
  }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  function updRoad() {
    var D = L3.depth, Rw = L3.road, laneW = Rw * LN.laneK, g0 = Math.floor((ln.wz + Z0) / STEP), r, c, i;
    for (r = 0; r < ROWS; r++) {
      var gi = g0 + r, zz = gi * STEP - ln.wz;
      roadAt(zz, RA);
      rowX[r] = RA.x; rowY[r] = RA.y; rowZ[r] = RA.z; rowRX[r] = RA.rx; rowRZ[r] = RA.rz; rowG[r] = gi;
    }
    var ap = road.asph.geometry.attributes.position, a = ap.array;
    for (r = 0; r < ROWS; r++) {
      var o = r * 6;
      a[o] = rowX[r] - rowRX[r] * Rw; a[o + 1] = rowY[r]; a[o + 2] = rowZ[r] - rowRZ[r] * Rw;
      a[o + 3] = rowX[r] + rowRX[r] * Rw; a[o + 4] = rowY[r]; a[o + 5] = rowZ[r] + rowRZ[r] * Rw;
    }
    ap.needsUpdate = true;
    // трава
    var gp = road.grass.geometry.attributes.position, gcol = road.grass.geometry.attributes.color, ga = gp.array, gc = gcol.array, nc = COLS.length;
    for (r = 0; r < ROWS; r++) for (c = 0; c < nc; c++) {
      var lat = COLS[c] < 0 ? COLS[c] - Rw : COLS[c] + Rw, q = (r * nc + c) * 3;
      if (c === 6) lat = -Rw - 0.9; if (c === 7) lat = Rw + 0.9;
      ga[q] = rowX[r] + rowRX[r] * lat; ga[q + 1] = rowY[r] + sideH(rowG[r] * STEP, lat); ga[q + 2] = rowZ[r] + rowRZ[r] * lat;
      var v = 0.86 + 0.2 * hash(rowG[r] * 0.37 + c * 13.1);  // пятна травы — тоже по сетке мира
      gc[q] = v; gc[q + 1] = v; gc[q + 2] = v;
    }
    gp.needsUpdate = true; gcol.needsUpdate = true;
    // бордюр: красно-белые плашки по 2 ряда
    var cp = road.curb.geometry.attributes.position, cc = road.curb.geometry.attributes.color, ca = cp.array, cl = cc.array, n = 0;
    for (r = 0; r < ROWS - 1; r++) for (var sd = -1; sd <= 1; sd += 2) {
      var red = Math.floor(rowG[r] / 2) % 2 === 0, cr = red ? 0.80 : 0.93, cg = red ? 0.05 : 0.90, cb = red ? 0.03 : 0.85;
      if (sd < 0) quad(ca, n, r, -Rw - 0.9, -Rw, 0.06); else quad(ca, n, r, Rw, Rw + 0.9, 0.06);   // слева направо, иначе грань смотрит вниз
      for (i = 0; i < 4; i++) { var w3 = (n * 4 + i) * 3; cl[w3] = cr; cl[w3 + 1] = cg; cl[w3 + 2] = cb; }
      n++;
    }
    cp.needsUpdate = true; cc.needsUpdate = true;
    // разметка: кромка сплошная, между рядами пунктир 2 через 2
    var mp = road.mark.geometry.attributes.position, ma = mp.array; n = 0;
    for (r = 0; r < ROWS - 1; r++) {
      quad(ma, n++, r, -Rw + 0.35, -Rw + 0.6, 0.03);
      quad(ma, n++, r, Rw - 0.6, Rw - 0.35, 0.03);
      var on = (rowG[r] % 4 + 4) % 4 < 2;
      for (sd = -1; sd <= 1; sd += 2) {
        if (on) quad(ma, n, r, sd * laneW * 0.5 - 0.14, sd * laneW * 0.5 + 0.14, 0.03);
        else for (i = 0; i < 12; i++) ma[n * 12 + i] = 0;  // пустая плашка — вырожденный квадрат
        n++;
      }
    }
    mp.needsUpdate = true;
  }
  function quad(arr, n, r, l0, l1, dy) {
    var o = n * 12, r2 = r + 1;
    arr[o] = rowX[r] + rowRX[r] * l0;  arr[o + 1] = rowY[r] + dy;  arr[o + 2] = rowZ[r] + rowRZ[r] * l0;
    arr[o + 3] = rowX[r] + rowRX[r] * l1; arr[o + 4] = rowY[r] + dy; arr[o + 5] = rowZ[r] + rowRZ[r] * l1;
    arr[o + 6] = rowX[r2] + rowRX[r2] * l0; arr[o + 7] = rowY[r2] + dy; arr[o + 8] = rowZ[r2] + rowRZ[r2] * l0;
    arr[o + 9] = rowX[r2] + rowRX[r2] * l1; arr[o + 10] = rowY[r2] + dy; arr[o + 11] = rowZ[r2] + rowRZ[r2] * l1;
  }

  /* ── цвета темы: пересчитываются только при смене объекта палитры ── */
  var _c2;
  function updTheme() {
    var th = TH();
    if (th === thRef) return;
    thRef = th;
    var T = T3; _c2 = _c2 || new T.Color();
    fog.color.set(th.sky[2]);
    R.setClearColor(fog.color);
    mats.road.color.set(th.road[0]);
    mats.grass.color.set(th.grass);
    hemi.color.set(th.sky[1]); hemi.groundColor.set(th.grass);
    var sa = road.sky.geometry.attributes.position, sc = road.sky.geometry.attributes.color, top = new T.Color(th.sky[0]),
        mid = new T.Color(th.sky[1]), low = new T.Color(th.sky[2]);
    for (var i = 0; i < sa.count; i++) {
      var e = sa.getY(i) / 800;                            // −1..1 по высоте купола
      if (e < 0.02) _c2.copy(low); else if (e < 0.25) _c2.copy(low).lerp(mid, (e - 0.02) / 0.23); else _c2.copy(mid).lerp(top, Math.min(1, (e - 0.25) / 0.5));
      sc.setXYZ(i, _c2.r, _c2.g, _c2.b);
    }
    sc.needsUpdate = true;
    // горы: цвет склона темы, к вершине светлее, всё в дымке горизонта
    var hc = road.hills.geometry.attributes.color, hp = road.hills.geometry.attributes.position, base = new T.Color(th.h2), hi = new T.Color(th.h1);
    for (i = 0; i < hc.count; i++) {
      var y = hp.getY(i), k = clamp((y + 8) / 80, 0, 1);
      _c2.copy(base).lerp(hi, k).lerp(low, 0.42 - k * 0.12);
      hc.setXYZ(i, _c2.r, _c2.g, _c2.b);
    }
    hc.needsUpdate = true;
    road.sunM.visible = !!th.sun;
    scenKinds = SCEN_BY[th.name] || ['rtree', 'bush'];
  }
  var scenKinds = ['rtree', 'bush'];

  /* ── пулы мешей по виду предмета: в кадре ничего не создаётся, кроме роста пула ── */
  function geoFor(key) {
    var pl = pools[key];
    if (pl) return pl;
    var geo, mat = mats.v;
    if (key.indexOf('auto') === 0) geo = trafficGeo(TRAFFIC[+key.slice(4)] || TRAFFIC[0]);
    else if (BUILD[key]) geo = BUILD[key]();
    else if (SCEN[key]) geo = SCEN[key]();
    else geo = BUILD.bush();
    if (key === 'star') mat = mats.star;
    pl = pools[key] = { geo: geo, mat: mat, list: [], used: 0 };
    return pl;
  }
  function take(key) {
    var pl = geoFor(key), m = pl.list[pl.used];
    if (!m) { m = new T3.Mesh(pl.geo, pl.mat); m.frustumCulled = false; scene.add(m); pl.list.push(m); }
    pl.used++; m.visible = true;
    return m;
  }
  function keyOf(o) {
    if (o.slow) { var ix = TRAFFIC.indexOf(o.col); return 'auto' + (ix < 0 ? 0 : ix); }
    if (o.sky) return o.t === 'balloon' ? 'sky_balloon' : o.t === 'bird' ? 'bird' : 'cloud';
    var t = ALIAS[o.t] || o.t;
    return BUILD[t] || SCEN[t] ? t : 'bush';
  }
  var SHR = { star: 0.5, fuel: 0.55, cone: 0.6, ball: 0.5, haystack: 0.95, hedgehog: 0.55, balloon: 0.35, tree: 1.4,
              house: 2.0, bush: 1.1, flower: 0.6, auto: 1.5, snowman: 0.8, palm: 1.2, rock: 1.1, pine: 1.2, bld: 2.6 };
  var nSh = 0, _sm;
  function shadowAt(x, y, z, r) {
    if (nSh >= 64) return;
    _sm.makeScale(r, 1, r * 0.8); _sm.setPosition(x, y + 0.05, z);
    shadowIM.setMatrixAt(nSh++, _sm);
  }

  function updObjs() {
    var D = L3.depth, laneW = L3.road * LN.laneK, i, k;
    for (k in pools) pools[k].used = 0;
    for (i = 0; i < ln.objs.length; i++) {
      var o = ln.objs[i], zz = o.z;
      if (o.done === 'take' || (o.done === 'over' && o.pop)) continue;   // лопнувший шарик не летит дальше целым
      if (state === 'lesson' && o !== les.obj && LESSON_HIDE[o.t]) continue;
      if (zz > Z1 - 0.05 || zz < Z0 + 0.02) continue;
      var key = keyOf(o), m = take(key);
      roadAt(zz, RA);
      var lat = o.decor ? (o.lane < 0 ? -1 : 1) * (Math.abs(o.lane) * laneW + 1.6) : o.sky ? o.lane * laneW * 3 : o.lane * laneW;
      if (o.fx) lat += o.fx / S * L3.pxK;
      var x = RA.x + RA.rx * lat, z = RA.z + RA.rz * lat, y = RA.y, ground = y;
      if (o.sky) y += 11 + (o.ph % 1) * 7;
      else if (o.air) y += o.air * L3.pxK;
      if (o.fy) y += o.fy / S * L3.pxK;
      var sIn = clamp((1.1 - zz) / 0.12, 0.05, 1), sc = sIn * (o.sky ? 1.3 : 1);
      if (o.decor && Math.abs(lat) > 12) ground = y = RA.y + sideH(ln.wz + zz, lat) + 0.06;
      m.position.set(x, y, z);
      m.rotation.set(0, RA.yaw, o.fly ? (o.frotA || 0) : 0);
      if (key === 'star') { m.position.y += 0.95 + Math.sin(T * 3 + o.ph) * 0.12; m.rotation.y += T * 2.4; sc *= 1.3; }
      else if (key === 'fuel') m.rotation.y += Math.sin(T * 2 + o.ph) * 0.3;
      else if (key === 'balloon') m.position.y += Math.sin(T * 2.2 + o.ph) * 0.1;
      else if (key === 'cloud') sc *= 1.4;
      if (key === 'bird') {
        m.scale.set(sc, sc * (0.35 + 0.65 * Math.abs(Math.sin(T * 5 + o.ph))), sc);   // взмах ~1,6 раза в секунду
      } else m.scale.setScalar(sc);
      if (!o.sky) shadowAt(x, ground, z, (SHR[key.indexOf('auto') === 0 ? 'auto' : key] || 0.8) * sc * (o.air ? 0.6 : 1));
    }
    for (k in pools) { var pl = pools[k]; for (i = pl.used; i < pl.list.length; i++) pl.list[i].visible = false; }
  }

  function updScenery() {
    var SC = 0.03, laneW = L3.road * LN.laneK, g0 = Math.floor((ln.wz + Z0 + 0.02) / SC), g1 = Math.floor((ln.wz + Z1 - 0.08) / SC), k, n = {};
    for (k in scen) n[k] = 0;
    var M = _sm;
    for (var gi = g0; gi <= g1; gi++) for (var sd = -1; sd <= 1; sd += 2) {
      var h1 = hash(gi * 2 + (sd > 0 ? 1 : 0)), h2 = hash(gi * 3.7 + sd * 5.1), h3 = hash(gi * 1.3 + sd * 9.7);
      if (h1 < 0.3) continue;
      var kind = scenKinds[Math.floor(h3 * scenKinds.length)], im = scen[kind];
      if (!im || n[kind] >= SCEN_N) continue;
      var zz = gi * SC - ln.wz, lat = sd * (L3.road + 3.2 + h2 * h2 * 48 + (kind === 'bld' || kind === 'house' ? 4 : 0));
      roadAt(zz, RA);
      var x = RA.x + RA.rx * lat, z = RA.z + RA.rz * lat, y = RA.y + sideH(gi * SC, lat), s = 0.75 + h1 * 0.7;
      _q.setFromAxisAngle(_p.set(0, 1, 0), h2 * 6.283);
      M.compose(_p.set(x, y, z), _q, _s.set(s, s * (0.85 + h3 * 0.3), s));
      im.setMatrixAt(n[kind], M);
      _c.setRGB(0.85 + h2 * 0.2, 0.88 + h3 * 0.16, 0.85 + h1 * 0.15);
      im.setColorAt(n[kind], _c);
      if (Math.abs(lat) < 16) shadowAt(x, y, z, (SHR[kind] || 1) * s);
      n[kind]++;
    }
    for (k in scen) {
      var m = scen[k]; m.count = n[k]; m.visible = n[k] > 0;
      if (n[k]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    }
  }

  /* ── машинка игрока: кузов + четыре колеса, пересобирается при смене машины ── */
  function updPlayer() {
    var id = car && car.id || 'race';
    if (carKey !== id) {
      if (player) { scene.remove(player.g); player.body.geometry.dispose(); player.wg.dispose(); }
      var c = CAR_BACK[id] || CAR_BACK.race, ws = wheelSpots(id), g = new T3.Group();
      var body = new T3.Mesh(merge(carParts(c[0], c[1], id)), mats.car); body.castShadow = true;
      g.add(body);
      var wg = wheelGeo(ws.r, ws.w), wl = [];
      for (var i = 0; i < 4; i++) {
        var w = new T3.Mesh(wg, mats.v); w.position.set(ws.at[i][0], ws.at[i][1], ws.at[i][2]); w.castShadow = true;
        g.add(w); wl.push(w);
      }
      scene.add(g);
      player = { g: g, body: body, wg: wg, wl: wl, r: ws.r };
      carKey = id;
    }
    var laneW = L3.road * LN.laneK, steer = clamp(Lane.steer(), -1, 1) - ln.x;
    roadAt(0, RA);
    var lat = ln.x * laneW, x = RA.x + RA.rx * lat, z = RA.z + RA.rz * lat;
    var jump = ln.y / S * L3.jumpK, sy = (ln.sy || 0) / S * L3.pxK - ln.kick * 0.12;
    var slope = Math.atan((rY(0.02) - rY(-0.02)) / (0.04 * L3.depth));
    player.g.position.set(x, RA.y + jump + sy, z);
    /* Порядок YXZ: сначала курс по дороге и рулю, потом клевок, потом крен. */
    player.g.rotation.set(slope + (ln.pitch || 0) - ln.kick * 0.08, RA.yaw - steer * 0.22, -(ln.roll || 0) - steer * 0.05, 'YXZ');
    var dw = ln.wz - lastWz; lastWz = ln.wz;
    if (dw > 0 && dw < 0.2) wheelA -= dw * L3.depth / player.r;
    for (var j = 0; j < 4; j++) player.wl[j].rotation.x = wheelA;
    /* удар: кузов подсвечивается 2,5 раза в секунду — как в 2D, в пределах правила о трёх */
    mats.car.emissiveIntensity = (ln.hitT > 0 && Math.floor(ln.t * 5) % 2 === 0) ? 0.35 : 0;
    // тень от солнца — только от машинки: маленькое окно теневой камеры ездит за ней
    sun.position.set(x - 5, RA.y + 12, z + 4); sun.target.position.set(x, RA.y, z);
  }

  function updCam() {
    var D = L3.depth, laneW = L3.road * LN.laneK, cb = L3.camBack / D;
    var b = roadAt(-cb, RA), cx = b.x + b.rx * ln.x * laneW * L3.camFollow, cy = b.y + L3.camUp, cz = b.z + b.rz * ln.x * laneW * L3.camFollow;
    var yaw = roadAt(0.06, RA).yaw * 0.7 + roadAt(-cb, RA).yaw * 0.3;
    var ahead = 0.25, hy = (rY(ahead) - rY(-cb)) / ((ahead + cb) * D);
    var pitch = Math.atan(hy) * L3.camHill;
    cam.position.set(cx, cy, cz);
    cam.lookAt(cx - Math.sin(yaw) * 10, cy + Math.tan(pitch) * 10 * Math.cos(yaw), cz - Math.cos(yaw) * 10);
    road.sky.position.copy(cam.position);
    road.hills.position.set(cam.position.x, rY(0.6) * 0.3, cam.position.z);
    road.clouds.position.set(cam.position.x, 0, cam.position.z);
    road.sunM.position.set(cam.position.x - 260, cam.position.y + 120, cam.position.z - 640); road.sunM.lookAt(cam.position);
    fog.near = cb * D + L3.fogNear * D; fog.far = cb * D + L3.fogFar * D;
  }

  /* Горизонт не в центре кадра: камера смотрит почти прямо, а снимок сдвинут вниз
     (внецентровая проекция) — так машинка внизу, а неба над дорогой не полкадра. */
  function fitView(dpr) {
    var hz = L3.horizon, hf = 2 * H * Math.max(hz, 1 - hz);
    R.setPixelRatio(dpr); R.setSize(W, H, false);
    cam.aspect = W / hf;                                   // при setViewOffset это пропорция ПОЛНОГО кадра
    cam.fov = 2 * Math.atan(Math.tan(L3.fov * Math.PI / 360) * hf / H) * 180 / Math.PI;
    cam.setViewOffset(W, hf, 0, hf / 2 - hz * H, W, H);
    cam.updateProjectionMatrix();
    vw = W; vh = H; vdpr = dpr; vhz = hz; vfov = L3.fov;
  }
  var vhz = 0, vfov = 0;

  function render() {
    if (st !== 2) return;
    var t0 = performance.now();
    /* Кадры тяжелее 16 мс 60 раз подряд — опускаем плотность пикселей до 1. Обратно не поднимаем. */
    if (lastT && t0 - lastT > 17.5) { if (++slowN > 60) { dprNow = 1; slowN = 0; } } else if (slowN > 0) slowN--;
    lastT = t0;
    var dpr = Math.min(L3.dpr, dprNow, dprCap, window.devicePixelRatio || 1);
    if (W !== vw || H !== vh || dpr !== vdpr || L3.horizon !== vhz || L3.fov !== vfov) fitView(dpr);
    if (!shown) { glc.style.display = 'block'; shown = true; }
    try {
      _sm = _sm || new T3.Matrix4();
      nSh = 0;
      updTheme(); updRoad(); updPlayer(); updObjs(); updScenery(); updCam();
      shadowIM.count = nSh; shadowIM.instanceMatrix.needsUpdate = true;
      R.render(scene, cam);
    } catch (e) { fail(); return; }
    drew = true;
    ms = performance.now() - t0;
  }
  /* Вызывается главным циклом раз в кадр: в любом другом экране 3D-холст скрыт,
     а при уходе из «руля» (не в урок из него) контекст отдаём системе. */
  function post() {
    if (st !== 2) return;
    if (!drew && shown) { glc.style.display = 'none'; shown = false; }
    if (!drew && state !== 'lane' && state !== 'lesson') dispose();
    drew = false;
  }
  function dispose() {
    try {
      scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      for (var k in mats) mats[k].dispose();
      R.dispose(); R.forceContextLoss();
      glc.parentNode.removeChild(glc);
    } catch (e) {}
    R = null; glc = null; scene = null; pools = {}; scen = {}; player = null; carKey = ''; thRef = null; mats = {}; road = {};
    vw = vh = 0; st = 0;                                   // модуль уже в памяти: следующий вход соберёт сцену заново
  }
  return {
    init: function () { if (st === 0 && T3 && L3.on && hasGL()) { try { build(); st = 2; } catch (e) { fail(); } } else init(); },
    on: function () { return st === 2 && !!L3.on; },
    render: render, post: post,
    stats: function () { return R ? { calls: R.info.render.calls, tris: R.info.render.triangles, ms: +ms.toFixed(2), st: st, dpr: vdpr } : { st: st }; }
  };
})();

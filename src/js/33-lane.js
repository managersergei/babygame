/* ═══════════════ 17f. РУЛЬ — дорога от третьего лица ═══════════════
   Машинка едет «от нас», ребёнок рулит влево-вправо (стрелки, кнопки внизу или
   телефон-руль) и объезжает то, что едет навстречу. Проигрыша нет: удар — «ой»,
   звёздочка — «ура». Вид машинки сзади пока рисуем сами: настоящие спрайты
   «сзади» — после согласования с владельцем (ПРАВИЛА-КОНТЕНТА).                */
/* Настройки режима в одном месте: скорость, зазоры, зона удара, прыжок.
   Раньше эти числа были рассыпаны по коду тремя разными системами координат. */
var LN = {
  laneK: 0.74,                              // насколько ряды расходятся к краям: при 0,6 четверть асфальта не работала
  spd0: 0.30, spdMax: 0.70, spdK: 0.9,       // глубина в секунду: старт, потолок (турбо от канистры), скорость выхода на цель
  gasK: 0.45, wzGain: 0.0016, wzCap: 0.12,   // прибавка от газа и медленный рост базы от пройденного пути
  gapMin: 0.62, gapMax: 1.00,                // зазор между объектами ПО ГЛУБИНЕ, а не по времени
  pStar: 0.55, pFuel: 0.66,                  // доли выпадения: звезда, бензин, дальше препятствие
  hitHi: 0.010, hitLo: -0.10,                // окно проверки касания
  forgive: 0.72, greedy: 1.30,               // зона: препятствие строже картинки, бонус щедрее
  jumpV: 1000, grav: 2600, overK: 0.60,      // прыжок и доля высоты объекта, с которой он «перепрыгнут»
  carW: 168, carH: 88, carY: 0.90,           // машинка ниже: раньше её силуэт закрывал место решения
  camUp: 90,                                 // камера поднята: перепад горизонт→машинка вырос на треть
  hzHalf: 62, nearHalf: 0.50, pow: 2.1, zMax: 1.9,
  hillAmp: 120, hillA: 1.9, hillB: 0.83,     // рельеф: две синусоиды, амплитуда в пикселях у камеры
  curvAmp: 620, curvA: 0.55, curvB: 0.27,     // изгибы дороги: тот же приём, что и рельеф, но по горизонтали
  decorGap: [0.45, 0.95], skyGap: [2.6, 5.0]   // обочина вдвое плотнее: пустая обочина не даёт ощущения движения
};
CFG.reg('LN', LN, {
  laneK:    [ 0.3,    1.2, 0.01, 'насколько ряды расходятся к краям'],
  spd0:     [ 0.1,    0.6, 0.01, 'глубина в секунду на старте'],
  spdMax:   [ 0.3,    1.5, 0.01, 'потолок скорости'],
  spdK:     [ 0.2,      4, 0.05, 'как быстро выходим на цель'],
  gasK:     [   0,      2, 0.01, 'прибавка от газа'],
  wzGain:   [   0, 0.0100, 0.0001, 'рост базовой скорости от пути'],
  wzCap:    [   0,    0.5, 0.01, 'потолок этого роста'],
  gapMin:   [ 0.2,      2, 0.01, 'зазор между объектами по глубине: мин'],
  gapMax:   [ 0.3,      3, 0.01, '…макс'],
  pStar:    [   0,      1, 0.01, 'доля выпадения звезды'],
  pFuel:    [   0,      1, 0.01, 'доля выпадения бензина'],
  forgive:  [ 0.3,    1.5, 0.01, 'зона препятствия (меньше — легче)'],
  greedy:   [ 0.8,      2, 0.01, 'зона бонуса (больше — щедрее)'],
  jumpV:    [ 400,   2000, 10,   'сила прыжка'],
  grav:     [1000,   5000, 50,   'притяжение'],
  overK:    [ 0.2,      1, 0.01, 'с какой доли высоты объект считается перепрыгнутым'],
  carW:     [  80,    320,  2,   'ширина машинки'],
  carH:     [  40,    200,  2,   'высота машинки'],
  carY:     [ 0.6,   0.99, 0.01, 'как низко стоит машинка'],
  camUp:    [   0,    240,  2,   'подъём камеры'],
  hillAmp:  [   0,    400,  5,   'высота холмов'],
  curvAmp:  [   0,   1500, 10,   'сила изгибов дороги']
});

var ln = { x: 0, y: 0, vy: 0, spd: 0, gas: 0, brake: 0, boost: 0, kick: 0, recShown: 0, dash: 0, run: 0, wz: 0, slope: 0,
           objs: [], spawnZ: 0, decorZ: 0, skyZ: 0,
           t: 0, hitT: 0, jumps: 0, autoT: 0, best: 0 };
var LANE_KINDS = [
  { t:'star',     h: 70,  good: true },
  { t:'fuel',     h: 78,  good: true },
  { t:'cone',     h: 44,  jump: true },
  { t:'ball',     h: 46,  jump: true },
  { t:'hedgehog', h: 42,  jump: true },
  { t:'haystack', h: 78,  jump: true },                     // был выше машинки и без прыжка — глухая стена
  { t:'balloon',  h: 60,  jump: true, pop: true, air: 190 }, // шарик на уровне прыжка, а не в небе
  { t:'auto',     h: 92,  slow: 0.55 }                      // попутная машина: её объезжают, а не перепрыгивают
];
var LANE_DECOR = [ { t:'tree', h: 170 }, { t:'house', h: 160 }, { t:'bush', h: 70 }, { t:'flower', h: 56 } ];
/* Обочина «руля» была одна и та же в любой локации: дерево, дом, куст, цветок.
   PROP_H уже сводит высоты всего реквизита к общей шкале — берём оттуда предметы темы. */
function laneKindProp(t) { return PROP_H[t] ? { t: t, h: PROP_H[t] } : null; }
function laneDecorPool() {
  var extra = (TH().props || []).concat(TH().extra || []).map(laneKindProp).filter(Boolean);
  return extra.length ? LANE_DECOR.concat(extra) : LANE_DECOR;
}
var LANE_SKY   = [ { t:'bird', h: 56 }, { t:'cloud', h: 90 }, { t:'balloon', h: 92 } ];
/* Какие слова этот режим умеет показать: дорога, обочина и небо. */
var LANE_SHOW = { star:1, fuel:1, cone:1, ball:1, hedgehog:1, haystack:1,
                  tree:1, house:1, bush:1, flower:1, bird:1, cloud:1, balloon:1, jump0:1 };
function laneKind(t) {
  var all = LANE_KINDS.concat(LANE_DECOR, LANE_SKY);
  for (var i = 0; i < all.length; i++) if (all[i].t === t) return all[i];
  return null;
}
var CAR_BACK = { monster: ['#5aa64a', '#3f7d35'], fire: ['#e63946', '#a4161a'], race: ['#ffcf3d', '#e0691f'], police: ['#f2f6fb', '#2b6cb0'] };
/* Попутные машины рисуются тем же drawRearCar, что и машинка игрока: отдельного
   спрайта не нужно, а «сзади» — единственный ракурс, который в этом режиме и виден. */
var TRAFFIC = [['#4fc3f7', '#2b6cb0'], ['#f4a261', '#c1121f'], ['#b7e4c7', '#40916c'], ['#ffcf3d', '#e0691f']];

/* Тень рисуется отдельно от кузова и остаётся на земле — иначе прыжка не видно. */
function drawRearShadow(x, y, w, lift) {
  var k = clamp(1 - lift / (260 * S), 0.35, 1);
  g.save(); g.globalAlpha = 0.28 * k;
  g.fillStyle = '#000'; g.beginPath(); g.ellipse(x, y + 6 * S, w * 0.56 * k, 14 * S * k, 0, 0, TAU); g.fill();
  g.restore();
}
function drawRearCar(x, y, w, h, tilt, blink, col) {
  var c = col || CAR_BACK[car.id] || CAR_BACK.race, big = !col && car.id === 'monster';
  g.save(); g.translate(x, y); g.rotate(clamp(tilt, -1, 1) * 0.07);
  var wr = big ? h * 0.36 : h * 0.26, wy = -wr * 0.9;
  g.fillStyle = '#2b2140';
  roundRect(-w * 0.5 - wr * 0.2, wy - wr, wr * 1.3, wr * 2, wr * 0.5); g.fill();
  roundRect(w * 0.5 - wr * 1.1, wy - wr, wr * 1.3, wr * 2, wr * 0.5); g.fill();
  if (blink) g.globalAlpha = 0.55;
  g.fillStyle = c[0]; roundRect(-w * 0.46, -h * 0.72, w * 0.92, h * 0.62, 22 * S); g.fill();
  g.fillStyle = c[1]; roundRect(-w * 0.46, -h * 0.30, w * 0.92, h * 0.2, 14 * S); g.fill();
  g.fillStyle = c[0]; roundRect(-w * 0.32, -h * 1.05, w * 0.64, h * 0.42, 18 * S); g.fill();
  g.fillStyle = '#bfe9ff'; roundRect(-w * 0.27, -h * 1.0, w * 0.54, h * 0.28, 12 * S); g.fill();
  g.fillStyle = '#ff5252';
  roundRect(-w * 0.44, -h * 0.5, w * 0.12, h * 0.1, 6 * S); g.fill();
  roundRect(w * 0.32, -h * 0.5, w * 0.12, h * 0.1, 6 * S); g.fill();
  /* Крыша и кусок капота: камера стоит чуть сверху, и передний край корпуса даёт
     точку отсчёта — без неё непонятно, где машинка кончается и когда прыгать. */
  g.fillStyle = mix(c[0], '#ffffff', 0.18);
  g.beginPath();
  g.moveTo(-w * 0.30, -h * 1.05); g.lineTo(w * 0.30, -h * 1.05);
  g.lineTo(w * 0.26, -h * 1.30); g.lineTo(-w * 0.26, -h * 1.30); g.closePath(); g.fill();
  g.fillStyle = c[0];
  g.beginPath();
  g.moveTo(-w * 0.26, -h * 1.30); g.lineTo(w * 0.26, -h * 1.30);
  g.lineTo(w * 0.22, -h * 1.52); g.lineTo(-w * 0.22, -h * 1.52); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)';
  roundRect(-w * 0.22, -h * 1.55, w * 0.44, 3 * S, 1.5 * S); g.fill();   // светлая кромка переднего края
  if (car.id === 'police') {                       // плавное перетекание вместо мигания 3 раза в секунду
    var pk = 0.5 + Math.sin(T * 3.4) * 0.5;
    g.fillStyle = mix('#ff3b3b', '#2b6cb0', pk);
    roundRect(-w * 0.12, -h * 1.15, w * 0.24, h * 0.1, 5 * S); g.fill();
  }
  if (car.id === 'fire') { g.fillStyle = '#c0c0c0'; roundRect(-w * 0.05, -h * 1.62, w * 0.1, h * 0.28, 4 * S); g.fill(); }
  g.restore();
}

/* ЕДИНСТВЕННЫЙ источник правды о геометрии дороги. По нему строятся края, разметка,
   объекты, машинка И зоны столкновения — раньше это были три разные системы. */
/* Профиль рельефа. Две несоразмерные синусоиды дают неповторяющуюся череду подъёмов
   и спусков без таблицы сегментов. */
function hillAt(wz) {
  return (Math.sin(wz * LN.hillA) + 0.55 * Math.sin(wz * LN.hillB + 1.7)) * LN.hillAmp * S * 0.5;
}
/* Изгиб дороги. Читается как «поворот», хотя управление не меняется: боковой снос,
   как и рельеф, вычитается по камере — под машинкой он всегда ноль, и все расчёты
   касаний (они в координатах рядов) остаются нетронутыми. */
function curveAt(wz) {
  return (Math.sin(wz * LN.curvA) + 0.5 * Math.sin(wz * LN.curvB + 1.3)) * LN.curvAmp * S * 0.5;
}
/* ЕДИНСТВЕННЫЙ источник правды о геометрии. Рельеф встроен ВНУТРЬ проекции и вычитает
   высоту под самой машинкой — поэтому при z = 0 смещение всегда ноль, и вся арифметика
   столкновений остаётся ровно такой же, как без холмов. */
/* Проекция глубины в экранные координаты. Вариант с out нужен горячим циклам:
   без него разметка и объекты создавали по две с лишним сотни объектов за кадр —
   это десятки килобайт мусора в секунду и работа сборщику на слабом телефоне. */
function laneProjTo(z, out) {
  var hy = roadTop() - LN.camUp * S, by = H * LN.carY;
  var p = Math.pow(clamp(1 - z, 0, LN.zMax), LN.pow);
  var half = LN.hzHalf * S + (W * LN.nearHalf - LN.hzHalf * S) * p;
  var dy = (hillAt(ln.wz + z) - hillAt(ln.wz)) * p;
  /* У рельефа смещение гасится множителем p — горизонт по вертикали неподвижен.
     У изгиба наоборот: боковой снос должен РАСТИ к горизонту, иначе поворот не читается.
     Отсюда zc*zc — та же квадратичная накачка, что и в классических псевдо-3D-гонках. */
  var zc = clamp(z, 0, 1);
  var dx = (curveAt(ln.wz + zc) - curveAt(ln.wz)) * zc * zc;
  out.p = p; out.y = hy + (by - hy) * p - dy; out.half = half; out.k = 0.12 + 0.88 * p;
  out.hy = hy; out.by = by; out.dy = dy; out.cx = W / 2 + dx;
  return out;
}
function laneProj(z) { return laneProjTo(z, {}); }
var lpA = {}, lpB = {}, lpC = {};        // рабочие проекции для горячих циклов
function laneH(o, k) { return o.h * S * k * 1.6; }        // экранная высота объекта

var Lane = {
  start: function () {
    A.init(); car = CARS[sel]; tune();
    ln.x = 0; ln.y = 0; ln.vy = 0; ln.spd = LN.spd0; ln.gas = 0; ln.brake = 0; ln.boost = 0; ln.kick = 0; ln.recShown = 0; ln.dash = 0; ln.run = 0; ln.wz = 0; ln.slope = 0;
    ln.objs = []; ln.spawnZ = 0.5; ln.decorZ = 0.3; ln.skyZ = 1.5;
    ln.t = 0; ln.hitT = 0; ln.jumps = 0; ln.autoT = 0; ln.hits = 0; ln.overs = 0; ln.takes = 0;
    parts.length = 0; texts.length = 0; objs.length = 0;
    stars = 0; row = 0; celebrate = 0; shake = 0; flash = 0; themeIx = 0; themeFrom = 0; themeK = 1;
    learned = {}; metEl = {}; resetRhythm(); seedKnown();     // уроки слов — общие с бесконечным режимом
    ln.best = 0; try { ln.best = +(localStorage.getItem('babygame.best') || 0) || 0; } catch (e) {}
    state = 'lane'; setPad();
    if (!Pult.everOn) Pult.ensure();                          // окно пульта — только пока телефон ни разу не подключался
    track('start', { game: 'lane' });
    A.rev(); A.fanfare(1);
    setTimeout(function () { A.say(['Поехали!', 'Объезжай препятствия!']); }, 300);   // сначала зажигание
    EV('lane', 'start');
  },
  steer: function () {
    if (AUTO) return ln.autoT;
    if (Pult.on && Pult.fresh()) return Pult.steer;
    return (K.left ? -1 : 0) + (K.right ? 1 : 0);
  },
  action: function () {                     // пробел / большая кнопка: прыжок (как и во всей остальной игре)
    if (ln.y > 0) return;
    ln.vy = LN.jumpV * S * (car.jump || 1); ln.jumps++;
    A.jump(); EV('lane', 'jump');
  },
  update: function (dt) {
    ln.t += dt;
    var target = clamp(Lane.steer(), -1, 1);
    ln.x = clamp(ln.x + (target - ln.x) * Math.min(1, dt * 5.5), -1.05, 1.05);
    if (ln.hitT > 0) ln.hitT -= dt;
    var wasUp = ln.y > 0;
    if (ln.y > 0 || ln.vy > 0) {
      ln.y += ln.vy * dt; ln.vy -= LN.grav * S * dt;
      if (ln.y <= 0) {
        ln.y = 0; ln.vy = 0;
        if (wasUp) {                                        // приземление: звук и пыль из-под колёс
          A.land();
          var nn = laneProj(0), cxl = nn.cx + ln.x * nn.half * LN.laneK;
          for (var d0 = 0; d0 < 7; d0++)
            P({ x: cxl + rnd(-60, 60) * S, y: GY - H * LN.carY, vx: rnd(-70, 70) * S, vy: rnd(20, 90) * S,
                r: rnd(5, 11) * S, c: pick(['#e8e0cd', '#d4c9ae']), kind: 'puff', life: rnd(0.3, 0.55), ay: 60 * S });
        }
      }
    }
    /* Газ: удержание кнопки на пульте или стрелка вверх. Скорость идёт К ЦЕЛИ, а не растёт
       линейно — раньше прирост был 0,85 % в секунду и его просто не было видно. */
    ln.gas = (K.gas || (Pult.on && Pult.gas) ? 1 : 0);
    ln.brake = Math.max(0, ln.brake - dt / 0.9);
    if (ln.boost > 0) ln.boost -= dt;                     // турбо от канистры
    if (ln.kick > 0) ln.kick = Math.max(0, ln.kick - dt * 3.5);   // отдача кузова после удара
    var base = LN.spd0 + Math.min(LN.wzCap, ln.wz * LN.wzGain);
    var goal = base * (1 + ln.gas * LN.gasK + (ln.boost > 0 ? 0.5 : 0)) * (1 - ln.slope * 0.18);   // в гору чуть медленнее, под гору чуть быстрее
    ln.spd += (Math.min(LN.spdMax, goal) - ln.spd) * Math.min(1, dt * LN.spdK);
    var b = ln.brake * ln.brake * (3 - 2 * ln.brake);       // плавное торможение вместо ступеньки ×0,45
    var v = ln.spd * (1 - 0.55 * b);
    ln.dash = (ln.dash + dt * v * 16) % 16;
    ln.run += dt * v * 900 * S;
    ln.wz += dt * v;
    ln.slope = (hillAt(ln.wz + 0.06) - hillAt(ln.wz)) / (0.06 * LN.hillAmp * S);   // + в гору, − под гору
    A.engine(clamp((ln.spd - LN.spd0) / (LN.spdMax - LN.spd0), 0, 1) * (1 - 0.5 * b), 1, true);
    if (ln.gas && ln.y === 0 && Math.floor(ln.t * 22) !== Math.floor((ln.t - dt) * 22)) {
      var nz = laneProj(0), cxg = nz.cx + ln.x * nz.half * LN.laneK;
      P({ x: cxg + rnd(-50, 50) * S, y: GY - H * LN.carY, vx: rnd(-40, 40) * S, vy: rnd(10, 50) * S,
          r: rnd(4, 9) * S, c: pick(['#e8e0cd', '#d4c9ae']), kind: 'puff', life: rnd(0.25, 0.5), ay: 40 * S });
    }
    Lane.rhythm(dt);
    Lane.spawn(dt, v);
    var near = laneProj(0);
    for (var i = ln.objs.length - 1; i >= 0; i--) {
      var o = ln.objs[i];
      o.z -= dt * v * (o.slow ? 1 - o.slow : 1);   // попутная едет в ту же сторону — сближение медленнее
      if (o.lesson && o.z < 0.62 && o.z > 0.18) {            // предмет заказанного слова доехал до кадра
        o.lesson = false; toLesson(o.lessonKey, o); return;
      }
      if (!o.done && !o.decor && !o.sky && o.z < LN.hitHi && o.z > LN.hitLo) {
        var hpx = laneH(o, near.k);
        var ow = (o.slow ? hpx * 1.9 : sprW(o.t, hpx)) * 0.5;   // у попутной машины спрайта нет — ширину знает только отрисовка
        var dx = Math.abs(o.lane - ln.x) * near.half * LN.laneK;
        var reach = (LN.carW * S * 0.42 + ow) * (o.good ? LN.greedy : LN.forgive);
        /* Раньше исход решался в ОДИН кадр: прыжок на пять сотых позже уже считался ударом.
           Пока машинка поднимается, решение откладывается и берётся максимум высоты за окно. */
        if (o.pend) {
          o.peak = Math.max(o.peak || 0, ln.y);
          if (ln.vy <= 0) { o.pend = 0; Lane.touch(o, near, o.peak); }
        } else if (dx < reach) {
          if (o.jump && !o.good && ln.vy > 0) { o.pend = 1; o.peak = ln.y; }
          else Lane.touch(o, near);
        }
      }
      if (!o.done && o.z <= LN.hitLo) {
        o.done = 'passed';
        if (!o.decor && !o.sky && !o.good) {                 // объехал — тоже молодец
          /* Раньше звезда за объезд падала молча и без картинки: ребёнок не понимал,
             за что. Теперь награда привязана к месту объезда, а близкий — заметнее. */
          var d0 = Math.abs(o.lane - ln.x), pp = Lane.pos(0, o.lane);
          stars++; row++; Lane.note(); ln.dodge = (ln.dodge || 0) + 1;
          if (d0 < 0.75) {
            A.coin(Math.min(row, 6) + 2); A.whoosh();
            popText('ВЖУХ!', pp.x, pp.y - 70 * S, '#7bd66b');
            burst(pp.x, GY - (pp.y - 30 * S), 8, ['#fff', '#cfe9f7'], 200 * S, 'dot');
          } else {
            A.coin(Math.min(row, 6));
            popText('+1', pp.x, pp.y - 50 * S, '#ffd93d');
          }
        }
      }
      if (o.fly) {                                       // разлёт сбитого предмета
        o.fx = (o.fx || 0) + o.fvx * dt; o.fy = (o.fy || 0) + o.fvy * dt;
        o.fvy -= 900 * S * dt; o.frotA = (o.frotA || 0) + o.frot * dt;
      }
      var q = laneProjTo(o.z, lpC);
      if (q.y - laneH(o, q.k) > H + 40 * S || o.z < -1.2) ln.objs.splice(i, 1);
    }
  },
  /* Ритм уроков — тот же, что в бесконечном режиме: слово раз в 15–30 с, общий прогресс. */
  rhythm: function (dt) {
    wordT += dt;
    if (wantEl) {
      wantT += dt;
      if (wantT > 5 && !wordArmed) Lane.force(wantEl);
      if (wantT > 12) { wantEl = null; wantT = 0; }
    }
    if (wordArmed && !armedObj()) wordArmed = false;
    var nk = nextLessonKey();
    if (!nk || wantEl || wordArmed || wordT < wordDue - TUNE.wordLead) return;
    if (nk === 'jump0') { metEl.jump0 = 1; toLesson('el_jump0', null); return; }   // предмета не нужно
    orderWord(nk);
  },
  force: function (k) {                     // заказ завис — ставим предмет сами
    var kind = laneKind(k);
    if (!kind) { wantEl = null; return; }
    Lane.push(kind, Lane.freeLane(kind), 1);
  },
  freeLane: function (kind) {
    if (LANE_DECOR.indexOf(kind) >= 0 || (kind && PROP_H[kind.t] && !kind.good && !kind.jump))
      return (RNG() < 0.5 ? -1 : 1) * rnd(1.55, 3.1);   // обочина уходит вглубь, а не стоит в одну линию
    if (LANE_SKY.indexOf(kind) >= 0)   return rnd(-1.2, 1.2);
    var busy = {}, i;
    for (i = 0; i < ln.objs.length; i++) {
      var o = ln.objs[i];
      if (!o.decor && !o.sky && o.z > 0.55) busy[o.lane] = 1;
    }
    var free = [];
    for (i = -1; i <= 1; i++) if (!busy[i]) free.push(i);
    if (!free.length) free = [-1, 0, 1];
    return free[Math.floor(RNG() * free.length)];
  },
  push: function (kind, lane, z) {
    var o = { t: kind.t, lane: lane, z: z, good: !!kind.good, jump: !!kind.jump, h: kind.h,
              pop: !!kind.pop, air: kind.air || 0,          // шарик: висит на высоте прыжка и лопается
              slow: kind.slow || 0, col: kind.slow ? pick(TRAFFIC) : null,   // попутная машина едет, а не стоит
              decor: LANE_DECOR.indexOf(kind) >= 0, sky: LANE_SKY.indexOf(kind) >= 0,
              ph: rnd(0, TAU), done: false };
    ln.objs.push(o);
    markFirst(o, o.t);
    return o;
  },
  spawn: function (dt, v) {
    ln.spawnZ -= dt * v; ln.decorZ -= dt * v; ln.skyZ -= dt * v;
    if (ln.spawnZ <= 0) {
      ln.spawnZ = rnd(LN.gapMin, LN.gapMax);
      var kind = null;
      if (wantEl && LANE_SHOW[wantEl] && !wordArmed) kind = laneKind(wantEl);
      if (!kind || kind.decor || LANE_DECOR.indexOf(kind) >= 0 || LANE_SKY.indexOf(kind) >= 0) {
        var w = RNG();
        kind = w < LN.pStar ? LANE_KINDS[0] : w < LN.pFuel ? LANE_KINDS[1] : pick(LANE_KINDS.slice(2));
      }
      Lane.push(kind, Lane.freeLane(kind), 1);
      /* Когда ребёнок освоился, изредка ставим второе препятствие в другой ряд:
         иначе полосу выбирать не приходится — препятствие всегда одно на всю ширину.
         freeLane отдаёт незанятый ряд, так что проезд остаётся всегда. */
      if (stars > 40 && !kind.good && RNG() < 0.35) {
        var k2 = pick(LANE_KINDS.slice(2)), free2 = Lane.freeLane(k2);
        if (free2 !== undefined) Lane.push(k2, free2, 1.02);
      }
    }
    if (ln.decorZ <= 0) {
      ln.decorZ = rnd(LN.decorGap[0], LN.decorGap[1]);
      var dk = (wantEl && LANE_SHOW[wantEl] && !wordArmed && laneKind(wantEl) && LANE_DECOR.indexOf(laneKind(wantEl)) >= 0)
             ? laneKind(wantEl) : pick(laneDecorPool());
      Lane.push(dk, Lane.freeLane(dk), 1);
    }
    if (ln.skyZ <= 0) {
      ln.skyZ = rnd(LN.skyGap[0], LN.skyGap[1]);
      var sk = (wantEl && LANE_SHOW[wantEl] && !wordArmed && laneKind(wantEl) && LANE_SKY.indexOf(laneKind(wantEl)) >= 0)
             ? laneKind(wantEl) : pick(LANE_SKY);
      Lane.push(sk, Lane.freeLane(sk), 1);
    }
  },
  touch: function (o, near, peak) {
    var p = laneProj(o.z), px = p.cx + o.lane * p.half * LN.laneK, py = p.y;
    var high = Math.max(ln.y, peak || 0);
    if (o.pop) {                                            // шарик: допрыгнул — лопнул, не допрыгнул — пролетел мимо
      if (high > o.air * S * 0.55) {
        o.done = 'over'; stars++; row++; Lane.note(); A.pop(); A.coin(row + 2);
        popText('ХЛОП!', px, py - o.air * S - 30 * S, '#ffd93d');
        burst(px, GY - (py - o.air * S), 10, ['#ff6b6b', '#ffd93d', '#fff'], 260 * S, 'conf'); EV('lane', 'pop');
        ln.overs++;
      } else o.done = 'passed';
      return;
    }
    if (o.good) {
      o.done = 'take';
      if (o.t === 'star') {
        stars++; row++; Lane.note(); A.coin(row);
        popText('+1', px, py - 60 * S, '#ffd93d');
        burst(px, GY - (py - 30 * S), 10, ['#ffd93d', '#fff'], 260 * S, 'spark'); EV('lane', 'star'); ln.takes++;
        if (stars % TUNE.praiseEvery === 0) { celebrate = 2; A.fanfare(stars); A.say(pick(['Хорошо!', 'Здорово!'])); track('lane_praise', { stars: stars }); }
        /* Раньше «руль» был заперт в одной деревне на всю сессию. Без вспышки:
           смена места — конфетти и реплика, полноэкранный белый для 2–4 лет запрещён. */
        if (stars % TUNE.themeEvery === 0) {
          setTheme(themeIx + 1); A.cheer(); A.say('Молодец! Поехали!');
          popText('НОВОЕ МЕСТО!', W / 2, H * 0.28, '#ffd93d');
          burst(W / 2, GY - H * 0.5, 26, ['#ff4d6d', '#ffd93d', '#4fc3f7', '#7bd66b'], 320 * S, 'conf');
        }
      } else {
        /* Канистра ничего не давала — ни звезды, ни скорости. Теперь это турбо:
           два с лишним секунды заметно быстрее, и это видно, а не написано. */
        stars++; row++; Lane.note(); A.fuelUp(); ln.boost = 2.2;
        popText('ТУРБО!', px, py - 60 * S, '#7bd66b');
        burst(px, GY - (py - 30 * S), 12, ['#7bd66b', '#ffd93d', '#fff'], 260 * S, 'spark'); EV('lane', 'fuel');
      }
      return;
    }
    if (o.jump && high > laneH(o, near.k) * LN.overK) {     // перепрыгнул — награда, а не удар
      o.done = 'over'; stars++; row++; Lane.note(); A.coin(row + 2);
      popText('ОП!', px, py - 90 * S, '#ffd93d'); praiseJump();   // пул похвал уже озвучен, сам держит паузу 12 с
      burst(px, GY - (py - 40 * S), 8, ['#ffd93d', '#fff'], 240 * S, 'spark'); EV('lane', 'over ' + o.t); ln.overs++;
      return;
    }
    o.done = 'hit';
    /* Тряска всего кадра для 2–4 лет запрещена — отдачу отыгрывает сама машинка. */
    ln.hitT = 0.9; ln.brake = 1; ln.kick = 1; row = 0; A.clunk(); popText('ОЙ!', px, py - 70 * S, '#ff6b6b');
    /* Раньше конус после удара оставался стоять — будто въехали в стену. Разлёт
       живёт в экранных пикселях объекта и на расчёты глубины не влияет. */
    o.fly = 1; o.fvx = (o.lane - ln.x >= 0 ? 1 : -1) * rnd(160, 300) * S;
    o.fvy = rnd(180, 320) * S; o.frot = rnd(-9, 9);
    burst(px, GY - (py - 20 * S), 12, ['#c9c9c9', '#8a94a6'], 220 * S, 'dot'); EV('lane', 'hit ' + o.t); ln.hits++;
    track('lane_hit', { t: o.t });
  },
  note: function () {                        // рекорд общий с бесконечным режимом, но всплывашка — экранная
    if (stars <= ln.best) return;
    var first = ln.best > 0;
    ln.best = stars;
    try { localStorage.setItem('babygame.best', String(stars)); } catch (e) {}
    /* Раньше это кричалось на КАЖДУЮ звезду после побития рекорда — к десятой
       звезде слово «рекорд» переставало что-либо значить. */
    if (first && !ln.recShown) {
      ln.recShown = 1; A.fanfare(2);
      popText('РЕКОРД!', W / 2, H * 0.35, '#ffd93d');
      burst(W / 2, GY - H * 0.45, 22, ['#ffd93d', '#fff'], 300 * S, 'spark');
    }
  },
  pos: function (z, lane) { var q = laneProj(z); q.x = q.cx + lane * q.half * LN.laneK; return q; },
  /* Сцена без HUD: нужна и самому режиму, и уроку, начатому из него. */
  scene: function () {
    bgX = ln.run;
    drawSky(); drawClouds(); drawFar();
    bgX = null;
    var far = laneProj(1);
    /* Трава заливается по верхней кромке САМОЙ дальней точки дороги: с рельефом
       горизонт гуляет, и прямоугольник от постоянного hy срезал бы полотно на гребне. */
    var gy0 = Math.min(far.y, far.hy) - LN.hillAmp * S;
    var gg2 = g.createLinearGradient(0, gy0, 0, H);
    gg2.addColorStop(0, mix(TH().grass, TH().sky[2], 0.35)); gg2.addColorStop(0.35, TH().grass);
    g.fillStyle = gg2; g.fillRect(0, gy0, W, H - gy0);
    // край дороги — по той же кривой, что и всё остальное, а не двумя прямыми
    /* Проекции считаем один раз на кадр: раньше те же 40 точек прогонялись через
       laneProj трижды (полотно, кромка, бордюр) — 120 объектов в мусор на кадр. */
    var SEG = 40, zs = [], PR = [], i;                        // чаще у камеры: там экранный шаг наибольший
    for (i = 0; i <= SEG; i++) { zs.push(1 - 1.35 * Math.pow(i / SEG, 1.4)); PR.push(laneProj(zs[i])); }
    g.fillStyle = TH().road[0];
    g.beginPath();
    for (i = 0; i <= SEG; i++) { var a = PR[i]; if (i === 0) g.moveTo(a.cx - a.half, a.y); else g.lineTo(a.cx - a.half, a.y); }
    for (i = SEG; i >= 0; i--) { var b = PR[i]; g.lineTo(b.cx + b.half, b.y); }
    g.closePath(); g.fill();

    /* Полосатый бордюр. На идеально прямой дороге разметка по центру — единственный
       источник скорости, и его мало: обочина, бегущая мимо, читается куда сильнее.
       Фаза привязана к ln.dash — тому же счётчику, что и пунктир. */
    for (i = 0; i < SEG; i++) {
      var ra = PR[i], rb = PR[i + 1];
      /* Дальние сегменты у точки схода занимают доли пикселя — рисовать их незачем.
         Отсекаем по экранной высоте отрезка: это снимает примерно треть заливок. */
      if (ra.p <= 0.001 && rb.p <= 0.001) continue;
      if (rb.y - ra.y < 0.7) continue;
      g.fillStyle = ((i + Math.floor(ln.dash)) % 2) ? '#e8402f' : '#f7f2ea';
      for (var sd = -1; sd <= 1; sd += 2) {
        g.beginPath();
        g.moveTo(ra.cx + sd * ra.half, ra.y);
        g.lineTo(ra.cx + sd * (ra.half + 20 * S * ra.k), ra.y);
        g.lineTo(rb.cx + sd * (rb.half + 20 * S * rb.k), rb.y);
        g.lineTo(rb.cx + sd * rb.half, rb.y);
        g.closePath(); g.fill();
      }
    }

    /* Кромка сужается к горизонту, как и всё остальное: постоянные 6*S у точки схода
       выходили толще самой полосы. Рисуем отрезками, каждый со своей толщиной. */
    /* Кромка сужается к горизонту, но обводить каждый из сорока отрезков отдельно
       дорого. Группируем в четыре ступени толщины: на глаз это та же плавность,
       а вызовов stroke() восемь вместо восьмидесяти. */
    g.strokeStyle = '#f2f6fb'; g.lineCap = 'round';
    for (var side = -1; side <= 1; side += 2) {
      for (var step = 0; step < 4; step++) {
        g.lineWidth = Math.max(1.2 * S, 6 * S * (0.14 + step * 0.29));
        g.beginPath();
        var open = false;
        for (i = 0; i <= SEG; i++) {
          var c = PR[i];
          var bucket = Math.min(3, Math.max(0, Math.floor(c.k * 4)));
          if (bucket !== step) { open = false; continue; }
          if (!open) { g.moveTo(c.cx + side * c.half, c.y); open = true; }
          else g.lineTo(c.cx + side * c.half, c.y);
          if (i > 0 && Math.min(3, Math.max(0, Math.floor(PR[i - 1].k * 4))) === step) { /* уже соединено */ }
        }
        g.stroke();
      }
    }
    g.lineCap = 'butt';
    g.fillStyle = 'rgba(255,255,255,.85)';
    for (i = 0; i < 16; i++) {
      var z0 = (((i - ln.dash) % 16) + 16) % 16 / 16, z1 = Math.min(1, z0 + 0.035);
      laneProjTo(z1, lpA); laneProjTo(z0, lpB);
      for (var j = 0; j < 2; j++) {
        var l = j ? 0.5 : -0.5;
        var ax = lpA.cx + l * lpA.half * LN.laneK, bx2 = lpB.cx + l * lpB.half * LN.laneK;
        g.beginPath(); g.moveTo(ax - 3 * S * lpA.k, lpA.y); g.lineTo(ax + 3 * S * lpA.k, lpA.y);
        g.lineTo(bx2 + 4 * S * lpB.k, lpB.y); g.lineTo(bx2 - 4 * S * lpB.k, lpB.y); g.closePath(); g.fill();
      }
    }
    // массив уже упорядочен по спавну: дальние впереди, ближние в конце — сортировать не нужно
    for (i = 0; i < ln.objs.length; i++) {
      var o = ln.objs[i], p = laneProj(o.z);
      if (p.p <= 0.001) continue;
      var hpx = laneH(o, p.k), x = p.cx + o.lane * p.half * LN.laneK + (o.fx || 0) * p.k;
      var y = o.sky ? p.y - (140 + (o.ph % 1) * 90) * S * p.k - 40 * S
            : o.air ? p.y - o.air * S * p.k
            : p.y + 4 * S * p.k;
      if (o.fy) y -= o.fy * p.k;
      var a = clamp(1 + o.z / 0.28, 0, 1);                  // на выезде гаснет, а не пропадает хлопком
      if (o.done === 'take' || (o.done === 'over' && o.pop)) continue;   // лопнувший шарик не должен лететь дальше целым
      if (state === 'lesson' && o !== les.obj && LESSON_HIDE[o.t]) continue;
      g.save(); g.globalAlpha = a;
      if (!o.sky) {
        /* Тень — единственная подсказка «объект близко», а раньше она пряталась под спрайтом.
           Ниже, шире, у камеры темнее и пульсирует: это и подсказка дистанции, и таймер прыжка. */
        var near0 = o.z < 0.35, pu = near0 ? 1 + 0.12 * Math.sin(T * 12) : 1;
        g.save(); g.globalAlpha = a * (near0 ? 0.45 : 0.32); g.fillStyle = '#000';
        /* Тень была 1,24 ширины объекта (0,62 полуоси × 2) — шире самого предмета.
           И одной высоты у камеры и у горизонта. Теперь 0,86 ширины и высота от глубины. */
        var shw = (o.slow ? hpx * 1.9 : sprW(o.t, hpx)) * 0.43 * pu;
        g.beginPath(); g.ellipse(x, p.y + 10 * S * p.k, shw, Math.max(2 * S, shw * 0.3), 0, 0, TAU);
        g.fill(); g.restore();
      }
      if (o.slow) drawRearCar(x, y, hpx * 1.9, hpx, 0, false, o.col);
      else spr(frameOf(o.t, o.ph), x, y, hpx, withMove(o.t, o.ph, hpx, o.fly ? { rot: o.frotA || 0 } : {}));
      g.restore();
    }
    /* Скоростные штрихи от точки схода — единственная безопасная для дошкольника подсказка
       скорости: она не двигает кадр, в отличие от тряски и наплыва камеры. */
    var r0 = clamp((ln.spd - LN.spd0) / (LN.spdMax - LN.spd0), 0, 1);
    if (r0 > 0.35) {
      g.save(); g.globalAlpha = (r0 - 0.35) * 0.5; g.strokeStyle = '#ffffff'; g.lineWidth = 2.5 * S;
      for (var q3 = 0; q3 < 8; q3++) {
        var ph3 = ((ln.t * (0.9 + r0) + q3 * 0.125) % 1), zz = 1 - ph3;
        var pa = laneProjTo(zz, lpA), pb2 = laneProjTo(Math.max(-0.2, zz - 0.06), lpB);
        var lx = (q3 % 2 ? 1 : -1) * (0.86 + (q3 % 3) * 0.06);
        g.beginPath(); g.moveTo(pa.cx + lx * pa.half, pa.y); g.lineTo(pb2.cx + lx * pb2.half, pb2.y); g.stroke();
      }
      g.restore();
    }
    var near = laneProj(0), cx = near.cx + ln.x * near.half * LN.laneK;
    drawRearShadow(cx, H * LN.carY, LN.carW * S, ln.y);
    /* На удар кузов приседает и клюёт вниз — это заметно не хуже тряски кадра,
       но не двигает весь мир и не нарушает возрастное правило. */
    var squat = (ln.gas ? 0.96 : 1) * (1 - ln.kick * 0.10);
    drawRearCar(cx, H * LN.carY - ln.y + ln.kick * 10 * S, LN.carW * S, LN.carH * S * squat,
                clamp(Lane.steer(), -1, 1) - ln.x, ln.hitT > 0 && Math.floor(ln.t * 5) % 2 === 0);   // 2,5 вспышки в секунду — в пределах правила о трёх
    drawParts(false);
  },
  draw: function (dt) {
    Lane.scene();
    texts.forEach(function (t) {
      g.save(); g.globalAlpha = clamp((t.life || 0) / (t.max || 1.1), 0, 1);
      /* Общий обновлятор двигает тексты в МИРОВЫХ координатах (вверх = плюс), а здесь
         координаты экранные, и «+1» уползало вниз. Вычитаем накопленное и добавляем подъём. */
      outText(t.t, t.x, t.y - ((t.max || 1.1) - t.life) * 120 * S, 34 * S, t.c || t.col || '#fff', '#2b2140');
      g.restore();
    });
    drawStarCount();
    if (ln.best > 0) drawBest(ln.best, HUDTOP());
    if (!Pult.on && !REC && ln.t < 8) { g.save(); g.globalAlpha = 0.8; outText('📱 телефон-руль — кнопка 📱 ' + (W <= 1000 ? 'вверху справа' : 'внизу справа'), W / 2, H * 0.06, Math.max(14, 20 * S), '#fff', '#2b6cb0'); g.restore(); }
    if (celebrate > 0) { g.save(); g.globalAlpha = Math.min(1, celebrate); outText('УРА!', W / 2, H * 0.3, 90 * S, '#ffd93d', '#e0691f'); g.restore(); }
  },
  auto: function () {                        // автоигра: полоса без препятствий, лучше со звездой
    var bestLane = 0, bestScore = -9;
    for (var l = -1; l <= 1; l++) {
      var danger = 1.2, bonus = 0;
      for (var i = 0; i < ln.objs.length; i++) {
        var o = ln.objs[i];
        if (o.done || o.decor || o.sky || o.lane !== l || o.z < -0.05) continue;
        if (o.good) bonus += 0.25; else if (o.z < danger) danger = o.z;
      }
      var score = danger + bonus - Math.abs(l - ln.x) * 0.05;
      if (score > bestScore) { bestScore = score; bestLane = l; }
    }
    ln.autoT = bestLane;
    if (!AUTO) return;
    for (var q = 0; q < ln.objs.length; q++) {              // прыжок через то, что прыгается
      var oo = ln.objs[q];
      if (!oo.done && oo.jump && Math.abs(oo.lane - ln.x) < 0.5 && oo.z < 0.22 && oo.z > 0.10) { Lane.action(); break; }
    }
  },
  dbg: function () {
    var o = ln.objs[0] || {};
    return { x: +ln.x.toFixed(2), y: Math.round(ln.y), objs: ln.objs.length, spd: +ln.spd.toFixed(3),
             boost: +Math.max(0, ln.boost).toFixed(2),   // турбо от канистры искажает замер скорости в тесте
             hit: ln.hitT > 0, want: wantEl, armed: wordArmed, jumps: ln.jumps,
             hits: ln.hits, overs: ln.overs, takes: ln.takes, best: ln.best,
             maxZ: ln.objs.length ? +Math.min.apply(null, ln.objs.map(function (o) { return o.z; })).toFixed(2) : null,
             first: o.t ? { t: o.t, lane: o.lane, z: +o.z.toFixed(2) } : null };
  }
};


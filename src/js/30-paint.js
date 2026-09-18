/* ═══════════════ 17by. ПОКРАСКА МАШИНКИ ═══════════════ */
var pnt = { phase: '', t: 0 };

function paintColor() {
  var st = story ? curStage() : null, sk = (st && st.skin) || 'black';
  return sk === 'red' ? '#d62828' : sk === 'yellow' ? '#f2c200' : '#16161d';
}

function drawPaintScene() {
  drawSky(); drawClouds(); drawFar(); drawRoad();
  var hh = car.h * S * 1.15, bob = Math.sin(T * 2) * 6 * S, cx = W * 0.33;
  g.save(); g.globalAlpha = 0.35; g.fillStyle = shColor();
  g.beginPath(); g.ellipse(cx, GY + 10 * S, vehW(car.id, hh) * 0.42, 14 * S, 0, 0, TAU); g.fill();
  g.restore();
  /* Раньше цвет подменялся одним кадром: самого действия «красим» видно не было.
     Скин выбирается глобальной carPaint, поэтому непокрашенный кузов и покрашенный
     рисуются одним и тем же вызовом, а граница — обычным clip-прямоугольником. */
  var kp = pnt.phase === 'painting' ? clamp(pnt.t / 0.8, 0, 1) : 1;
  if (kp < 1 && carPaint) {
    var keep = carPaint;
    carPaint = null; drawVehicle(car.id, cx, GY + bob, hh, {}); carPaint = keep;
    g.save();
    g.beginPath(); g.rect(0, GY + bob - hh, W, hh * kp); g.clip();
    drawVehicle(car.id, cx, GY + bob, hh, {});
    g.restore();
    if (kp > 0.02 && kp < 0.98)                      // капли по кромке заливки
      P({ x: cx + rnd(-vehW(car.id, hh) * 0.4, vehW(car.id, hh) * 0.4), y: GY - (GY + 6 * S + bob - hh + hh * kp) + 6 * S,
          vx: rnd(-30, 30) * S, vy: rnd(-10, 30) * S, r: rnd(4, 8) * S, c: paintColor(),
          kind: 'drop', life: 0.5, ay: 300 * S });
  } else drawVehicle(car.id, cx, GY + bob, hh, {});

  // мастер с ведром краски
  var mx = W * 0.68, mh = 176 * S;   // был 300*S: мастер выходил вдвое выше машинки и выше дома
  g.save(); g.globalAlpha = 0.3; g.fillStyle = shColor();
  g.beginPath(); g.ellipse(mx, GY + 10 * S, 60 * S, 12 * S, 0, 0, TAU); g.fill();
  g.restore();
  spr('master', mx, GY + 6 * S, mh, { rot: Math.sin(T * 1.4) * 0.02 });
  spr('paint', mx + 150 * S, GY + 8 * S, 130 * S, { rot: Math.sin(T * 1.6) * 0.04 });

  // большой образец цвета, чтобы было понятно, во что красим
  var bx = mx + 12 * S, by = GY - mh - 46 * S + Math.sin(T * 2.2) * 8 * S, r = 52 * S;
  g.save();
  g.fillStyle = 'rgba(0,0,0,.2)';
  g.beginPath(); g.arc(bx + 4 * S, by + 6 * S, r, 0, TAU); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(bx, by, r, 0, TAU); g.fill();
  g.fillStyle = paintColor();
  g.beginPath(); g.arc(bx, by, r * 0.82, 0, TAU); g.fill();
  g.lineWidth = 5 * S; g.strokeStyle = '#2b2140';
  g.beginPath(); g.arc(bx, by, r, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.beginPath(); g.ellipse(bx - r * 0.3, by - r * 0.35, r * 0.28, r * 0.16, -0.5, 0, TAU); g.fill();
  g.restore();
}

function toPaintStage() {
  state = 'paint'; pnt.phase = 'offer'; pnt.t = 0;
  parts.length = 0;
  Mic.disarm(); A.engine(0, 1, false);
  var st = curStage(), L = LESSONS[st.lesson];
  toAsk({
    q: 'ПОКРАСИМ МАШИНКУ В ' + L.word + '?', bg: 'paint', silent: 'no',
    focus: [W * 0.5, GY - 110 * S], zoom: 1.35,
    say: 'Ооо, смотри! Нам предлагают покрасить машину в ' + L.say + ' цвет. Будем красить в ' + L.say + '?',
    yes: function () { state = 'paint'; toLesson(st.lesson); },
    no:  function () { state = 'paint'; pnt.phase = 'skip'; pnt.t = 0; A.say('Ну ладно, поедем так!'); setPad(); }
  });
}

function doPaint() {
  var st = curStage();
  state = 'paint'; pnt.phase = 'painting'; pnt.t = 0;
  carPaint = st.skin || 'black'; damage = 0;
  /* Полноэкранная белая вспышка для 2–4 лет запрещена. Событие остаётся ярким,
     но локальным: кольцо разлетается от самой машинки и в цвете новой краски. */
  for (var rq = 0; rq < 26; rq++) {
    var ra = rq / 26 * TAU;
    P({ x: W * 0.42 + Math.cos(ra) * 40 * S, y: 120 * S + Math.sin(ra) * 40 * S,
        vx: Math.cos(ra) * 260 * S, vy: Math.sin(ra) * 260 * S, r: rnd(7, 13) * S,
        c: paintColor(), kind: 'spark', life: 0.7, ay: 120 * S });
  }
  A.fanfare(); A.say('Ух ты! Какая красивая машинка!');
  for (var i = 0; i < 60; i++)
    P({ x: W * 0.42 + rnd(-160, 160) * S, y: rnd(40, 300) * S, vx: rnd(-180, 180) * S, vy: rnd(40, 300) * S,
        r: rnd(6, 18) * S, c: pick(['#16161d', '#ffd93d', '#fff']), kind: 'conf',
        life: rnd(0.8, 1.6), vr: rnd(-9, 9) });
  setPad();
}

function updatePaint(dt) {
  pnt.t += dt;
  if (pnt.phase === 'painting' && pnt.t > 4.0) nextStage();
  else if (pnt.phase === 'skip' && pnt.t > 2.6) nextStage();
}

function drawPaint() {
  drawPaintScene();
  drawParts(false);
  if (pnt.phase === 'painting') {
    outText('УРА! КРАСИВАЯ МАШИНКА!', W / 2, 84 * S, 46 * S, '#fff', '#2b6cb0');
  } else if (pnt.phase === 'skip') {
    outText('ПОЕДЕМ ТАК!', W / 2, 84 * S, 46 * S, '#fff', '#2b6cb0');
  }
}


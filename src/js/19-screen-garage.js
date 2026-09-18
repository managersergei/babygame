/* ═══════════════ 16. ЭКРАН 1 — ГАРАЖ ═══════════════ */
function drawGarage(dt) {
  garageT += dt;
  slide += (0 - slide) * Math.min(1, dt * 9);
  if (saySelT > 0) { saySelT -= dt; if (saySelT <= 0) A.say(CARS[sel].say); }
  if (pickT > 0)   { pickT -= dt;   if (pickT <= 0) { pickT = 0; toGameMode(); } }

  drawSky(); drawClouds(); drawFar();
  /* Птица летит через небо примерно раз в двадцать секунд — своим ходом, а не от
     машинки: на стартовых экранах она стоит. Спрайт анимированный, он уже в проекте. */
  var bt = (garageT % 20) / 20;
  if (bt < 0.55) {
    var bx0 = -120 * S + bt / 0.55 * (W + 240 * S);
    spr(frameOf('bird', garageT * 2), bx0, 120 * S + Math.sin(garageT * 1.3) * 18 * S, 54 * S,
        withMove('bird', garageT * 2, 54 * S, { mid: true }));
  }
  drawRoad();
  /* Раньше этот ряд рисовался ДО дороги и на 36*S ниже кромки травы — полотно и
     трава закрашивали дома на три четверти. Берём общий drawProps: он ставит
     реквизит на верх травы, с тенью, пучками и палисадником. */
  drawProps();

  g.save();
  g.fillStyle = 'rgba(255,255,255,.22)';
  g.beginPath(); g.ellipse(W / 2, GY + 12 * S, 280 * S, 40 * S, 0, 0, TAU); g.fill();
  g.restore();

  /* Показываем столько соседей, сколько их на самом деле: при четырёх машинках
     d=-2 и d=+2 давали ОДИН И ТОТ ЖЕ индекс — одна машинка рисовалась дважды. */
  var step = W * 0.42, span = Math.min(2, Math.floor((CARS.length - 1) / 2));
  for (var d = -span; d <= span; d++) {
    var idx = ((sel + d) % CARS.length + CARS.length) % CARS.length;
    var c = CARS[idx], pos = d + slide;
    var k = clamp(1 - Math.abs(pos) * 0.42, 0.3, 1);
    var alpha = clamp(1 - Math.abs(pos) * 0.42, 0, 1);
    if (alpha <= 0.02) continue;
    var hh = c.h * S * (1.32 * k), bob = Math.sin(garageT * 2 + idx) * 8 * S * k;
    g.save(); g.globalAlpha = alpha;
    g.fillStyle = 'rgba(20,30,20,.28)';
    g.beginPath(); g.ellipse(W / 2 + pos * step, GY + 12 * S, vehW(c.id, hh) * 0.4, 15 * S * k, 0, 0, TAU); g.fill();
    drawVehicle(c.id, W / 2 + pos * step, GY + bob, hh, {});          // база кузова — GY, как в самой игре
    g.restore();
    /* Раз в пару секунд центральная машинка показывает, чем она особенная —
       иначе четыре карточки отличаются только цветом и выбор ничего не значит. */
    if (Math.abs(pos) < 0.15 && !pickT && RNG() < dt * 0.55) {
      var bx = W / 2, q;
      if (c.id === 'monster') {
        for (q = 0; q < 10; q++) P({ x: bx + rnd(-70, 70) * S, y: 6 * S, vx: rnd(-90, 90) * S, vy: rnd(40, 120) * S,
                                     r: rnd(9, 17) * S, c: '#e8dcc0', kind: 'puff', life: 0.7, ay: 60 * S });
        A.thud();
      } else if (c.id === 'fire') {
        for (q = 0; q < 9; q++) P({ x: bx + rnd(-40, 40) * S, y: 120 * S, vx: rnd(-140, 140) * S, vy: rnd(120, 240) * S,
                                    r: rnd(5, 10) * S, c: '#7fd8ff', kind: 'drop', life: 0.8, ay: 260 * S });
        A.splash();
      } else if (c.id === 'police') {
        for (q = 0; q < 8; q++) P({ x: bx + rnd(-50, 50) * S, y: 150 * S, vx: rnd(-60, 60) * S, vy: rnd(20, 80) * S,
                                    r: rnd(6, 12) * S, c: q % 2 ? '#ff4d4d' : '#4fc3f7', kind: 'spark', life: 0.6, ay: 40 * S });
        A.click();
      } else {
        for (q = 0; q < 10; q++) P({ x: bx - 40 * S + rnd(-30, 30) * S, y: 30 * S, vx: rnd(-260, -80) * S, vy: rnd(20, 90) * S,
                                     r: rnd(5, 11) * S, c: '#fff', kind: 'spark', life: 0.5, ay: 30 * S });
        A.whoosh();
      }
    }
  }

  if (RNG() < dt * 22) {
    var a = rnd(0, TAU), rr = rnd(120, 230) * S;
    P({ x: W / 2 + Math.cos(a) * rr, y: 150 * S + Math.sin(a) * rr * 0.7,
        vx: rnd(-30,30)*S, vy: rnd(10,60)*S, r: rnd(6,13)*S,
        c: pick(['#ffd93d','#fff','#ffe9a8']), kind:'spark', life: rnd(0.5,1.0), ay: 30*S, vr: rnd(-6,6) });
  }
  updateParts(dt); drawParts(false);

  /* Шильдик с именем под машинкой: сверху надпись наезжала на ряд кнопок, а здесь
     она и привязана к машинке, и занимает пустой асфальт в нижней трети кадра. */
  var ny = Math.min(GY + 52 * S, H - 40 * S), nw = Math.min(W * 0.62, 520 * S), nh = 62 * S;
  g.save();
  g.fillStyle = 'rgba(0,0,0,.22)'; roundRect(W / 2 - nw / 2 + 4 * S, ny - nh / 2 + 6 * S, nw, nh, 20 * S); g.fill();
  g.fillStyle = 'rgba(255,255,255,.94)'; roundRect(W / 2 - nw / 2, ny - nh / 2, nw, nh, 20 * S); g.fill();
  g.lineWidth = 5 * S; g.strokeStyle = '#ffb703'; roundRect(W / 2 - nw / 2, ny - nh / 2, nw, nh, 20 * S); g.stroke();
  g.restore();
  outText(CARS[sel].name, W / 2, ny + 12 * S, 38 * S, '#e0691f', '#fff');
  g.save(); g.globalAlpha = 0.5 + Math.sin(garageT * 4) * 0.5;
  outText(KEYW('ДАЛЬШЕ ▶'), W / 2, 84 * S, 28 * S, '#fff', '#e0691f');
  g.restore();

  garageVoice(dt);
  if (Voice.on && Mic.ready() && gv.phase !== 'idle' && gv.phase !== 'quiet')
    drawMicBubble(W / 2, Math.min(252 * S, H * 0.34),   // абсолютный y на телефоне уводил пузырь в пустое небо
      gv.phase === 'go' ? '🎤 СКАЖИ ТОЖЕ!' : gv.phase === 'listen' ? '🎤 ГОВОРИ!'
        : gv.phase === 'good' ? 'ОТЛИЧНО!' : 'СКАЖИ:',
      gv.phase === 'go' ? 'ПОЕХАЛИ!'
        : gv.phase === 'good' ? (gv.tries >= 2 ? 'ПОЕХАЛИ!' : 'ЕЩЁ РАЗОК') : CARS[sel].name,
      gv.phase === 'listen' || gv.phase === 'go');

  var pulse = 1 + Math.sin(garageT * 5) * 0.08;
  g.save(); g.globalAlpha = 0.9;
  outText('◀', 60 * S, H * 0.5, 76 * S * pulse, '#fff', '#2b6cb0');
  outText('▶', W - 60 * S, H * 0.5, 76 * S * pulse, '#fff', '#2b6cb0');
  g.restore();
}


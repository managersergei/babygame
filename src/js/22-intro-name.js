/* ═══════════════ 17bb. ЗНАКОМСТВО — ПЕРВАЯ КАЛИБРОВКА ═══════════════
   «Как тебя зовут?» три раза. Ребёнок привыкает, что игра слушает,
   а игра снимает базовый уровень его голоса и шума в комнате.        */
var nm = { got: 0, phase: '', t: 0 };

function toName() {
  state = 'name'; nm.got = 0; nm.phase = 'ask'; nm.t = 0;
  parts.length = 0;
  Mic.request();
  A.say('Привет! Как тебя зовут?');
  setPad();
}

function nameHeard(sample) {
  if (state !== 'name' || nm.phase !== 'listen') return;
  if (sample) Voice.add('name', sample);
  nameStep(!!sample);
}

function nameStep(good) {
  nm.got++; nm.phase = 'good'; nm.t = 0;
  if (good) {
    A.coin(nm.got * 3);
    for (var i = 0; i < 24; i++)
      P({ x: W / 2 + rnd(-180, 180) * S, y: H * 0.42 + rnd(-60, 60) * S, vx: rnd(-140, 140) * S,
          vy: rnd(60, 280) * S, r: rnd(6, 15) * S, c: pick(['#ffd93d', '#fff', '#7bd66b', '#4fc3f7']),
          kind: 'spark', life: rnd(0.6, 1.2), ay: 320 * S, vr: rnd(-8, 8) });
  }
  A.say(nm.got >= 3 ? 'Очень приятно! Поехали кататься!'
                    : (nm.got === 1 ? 'Как-как? Ещё раз!' : 'И ещё разок!'));
}

function updateName(dt) {
  nm.t += dt;
  if (!story && !voiceCtl) { startStage(); return; }
  if (nm.phase === 'ask') {
    if (nm.t > 0.15 && !A.talking()) {
      nm.phase = 'listen'; nm.t = 0;
      if (Mic.ready()) Mic.listen(6, nameHeard);
    }
  } else if (nm.phase === 'listen') {
    if ((!Mic.ready() || !Voice.on) && nm.t > 1.2) nameStep(false);   // без микрофона (или его выключили) просто идём дальше
  } else if (nm.phase === 'good') {
    if (nm.t > (nm.got >= 3 ? 1.4 : 0.35) && !A.talking()) {
      if (nm.got >= 3) startStage();
      else { nm.phase = 'ask'; nm.t = 1.4; }
    }
  }
}

function drawName() {
  drawSky(); drawClouds(); drawFar(); drawRoad(); drawProps();   // обочина не должна пустовать и на этом экране
  var bob = Math.sin(T * 2) * 8 * S;
  drawVehicle(car.id, W * 0.5, GY + bob, car.h * S * 1.15, {});

  outText('ДАВАЙ ЗНАКОМИТЬСЯ!', W / 2, 62 * S, 46 * S, '#fff', '#2b6cb0');
  drawMicBubble(W / 2, Math.min(168 * S, H * 0.24),
    nm.phase === 'listen' ? '🎤 ГОВОРИ!' : nm.phase === 'good' ? 'ПРИЯТНО!' : 'ВОПРОС:',
    nm.phase === 'good' && nm.got >= 3 ? 'ПОЕХАЛИ!' : 'КАК ТЕБЯ ЗОВУТ?',
    nm.phase === 'listen');

  /* Прогресс — звёздочками игры, а не безымянными белыми кружками: звезда для
     ребёнка уже что-то значит, кружок не значит ничего. */
  for (var i = 0; i < 3; i++) {
    var x = W / 2 + (i - 1) * 62 * S, y = Math.min(250 * S, H * 0.42);
    g.save(); g.globalAlpha = i < nm.got ? 1 : 0.3;
    if (!spr('star', x, y + 22 * S, 46 * S)) {
      g.fillStyle = i < nm.got ? '#4ade80' : 'rgba(255,255,255,.5)';
      g.beginPath(); g.arc(x, y, 20 * S, 0, TAU); g.fill();
      g.lineWidth = 4 * S; g.strokeStyle = '#fff'; g.stroke();
    }
    g.restore();
  }
  drawParts(false);
  if (!Mic.ready()) {
    var msg = Mic.denied() ? 'микрофон запрещён — играем кнопкой'
            : Mic.err() ? 'микрофон занят или недоступен — закрой лишние вкладки'
            : 'разреши микрофон в браузере';
    outWrap(msg, W / 2, H - 132 * S, 24 * S, W * 0.8, '#fff', '#c0392b');
  }
}


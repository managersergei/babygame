/* ═══════════════ 17bv. ПОЛОМКА НА ДОРОГЕ ═══════════════
   Машинка чихает, кренится и теряет колесо — и только потом едем в мастерскую. */
var crash = { t: 0, wx: 0, wy: 0, vx: 0, vy: 0, rot: 0, tilt: 0 }, fromCrash = false;

function toBreakdown(why) {
  if (state !== 'play') return;
  state = 'crash'; crash.t = 0; crash.tilt = 0; crash.all = why === 'train';
  damage = 3; spd = 0; crash.off = 0;
  crash.wx = carX + 30 * S; crash.wy = 50 * S;
  crash.vx = rnd(220, 380) * S; crash.vy = rnd(360, 520) * S; crash.rot = 0;
  shake = 2.5 * S;                                // тряска кадра для 2–4 лет вредна: событие отыгрывает крен кузова
  Mic.disarm(); A.engine(0, 1, false);
  A.sputter(); A.clatter();
  fromCrash = true;                               // фразу скажем один раз — здесь
  A.say('Ой-ой! Машинка сломалась! Смотри, колёса упали!');
  for (var i = 0; i < 26; i++)
    P({ x: carX + rnd(-40, 40) * S, y: carY + rnd(30, 110) * S, vx: rnd(-180, 180) * S,
        vy: rnd(80, 300) * S, r: rnd(8, 20) * S, c: pick(['#9aa3b2', '#d8dee8', '#7a8090']),
        kind: 'puff', life: rnd(0.7, 1.4), ay: -120 * S });
  setPad();
}

function updateCrash(dt) {
  crash.t += dt;
  crash.tilt = Math.sin(crash.t * 22) * 0.05 * Math.max(0, 1 - crash.t * 0.8);
  crash.vy -= GRAV * 0.55 * dt;
  crash.wx += crash.vx * dt; crash.wy += crash.vy * dt; crash.rot += dt * 9;
  if (crash.wy < 0) { crash.wy = 0; crash.vy *= -0.42; crash.vx *= 0.72; }
  if (RNG() < dt * 26)
    P({ x: carX + rnd(-30, 20) * S, y: carY + car.h * S * 0.9, vx: rnd(-60, 40) * S, vy: rnd(90, 200) * S,
        r: rnd(10, 22) * S, c: pick(['#b9c0cc', '#d8dee8']), kind: 'puff', life: rnd(0.6, 1.2), ay: -140 * S });
  if (shake > 0) shake = Math.max(0, shake - dt * 22 * S);
  if (crash.t > 2.6) toRepair();
}

function drawCrash() {
  drawSky(); drawClouds(); drawFar(); drawRoad(); drawProps();
  drawObjs();
  drawParts(true);
  var h = car.h * S;
  g.save();
  g.globalAlpha = 0.4; g.fillStyle = shColor();
  g.beginPath(); g.ellipse(CARX, GY + 8 * S, vehW(car.id, h) * 0.42, 13 * S, 0, 0, TAU); g.fill();
  g.restore();
  noWheels = crash.t > 0.5; missWheels = 1;        // колесо отлетело — кузов оседает
  drawVehicle(car.id, CARX, GY + (noWheels ? 10 * S : 0), h, { rot: crash.tilt });
  noWheels = false;
  var wx = (crash.wx - carX) + CARX;
  spr('wheel', wx, GY + 4 * S - crash.wy, 66 * S, { rot: crash.rot, mid: true });
  outText('ОЙ! КОЛЕСО ОТВАЛИЛОСЬ!', W / 2, 80 * S, 44 * S, '#fff', '#c0392b');
}


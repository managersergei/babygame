/* ═══════════════ 17d. ЭКРАН «ВО ЧТО ИГРАЕМ» ═══════════════ */
function drawGameMode(dt) {
  gmT += dt;
  drawSky(); drawClouds(); drawFar(); drawRoad(); drawProps();

  var hh = car.h * S * 1.0, bob = Math.sin(gmT * 2) * 6 * S, cwid = vehW(car.id, hh);
  g.save(); g.fillStyle = 'rgba(255,255,255,.8)';
  g.beginPath(); g.ellipse(W / 2, H * 0.3 + 6 * S, cwid * 0.46, 22 * S, 0, 0, TAU); g.fill();
  g.restore();
  drawVehicle(car.id, W / 2, H * 0.3 + bob, hh, {});

  outText('ВО ЧТО ИГРАЕМ?', W / 2, 58 * S, 46 * S, '#fff', '#2b6cb0');

  var cw = Math.min(W * 0.34, 430 * S), chh = Math.min(H * 0.26, 220 * S);
  var gap = W * 0.03, x0 = W / 2 - (GAMEMODES.length * cw + (GAMEMODES.length - 1) * gap) / 2;
  GAMEMODES.forEach(function (m, i) {
    var isSel = i === gmSel, k = isSel ? 1 + Math.sin(gmT * 4) * 0.015 : 0.9;
    var x = x0 + i * (cw + gap), cy = H * 0.44;
    g.save();
    g.translate(x + cw / 2, cy + chh / 2); g.scale(k, k); g.translate(-cw / 2, -chh / 2);
    g.fillStyle = 'rgba(0,0,0,.22)'; roundRect(6 * S, 10 * S, cw, chh, 28 * S); g.fill();
    g.fillStyle = isSel ? 'rgba(255,255,255,.97)' : 'rgba(255,255,255,.7)';
    roundRect(0, 0, cw, chh, 28 * S); g.fill();
    g.lineWidth = isSel ? 8 * S : 3 * S;
    g.strokeStyle = isSel ? '#ffb703' : 'rgba(43,33,64,.35)';
    roundRect(0, 0, cw, chh, 28 * S); g.stroke();
    /* Значки «∞» и «🛞» для 2–4 лет — пустое место. Показываем то единственное,
       чем режимы отличаются: как видно машинку — сбоку или сзади. И именно ту,
       которую ребёнок только что выбрал. */
    g.save(); g.globalAlpha = isSel ? 1 : 0.55;
    if (m.id === 'lane') drawRearCar(cw / 2, 96 * S, 104 * S, 56 * S, 0, false);
    else spr(car.id, cw / 2, 96 * S, 58 * S, {});
    g.restore();
    outText(m.title, cw / 2, 128 * S, 34 * S, isSel ? '#e0691f' : '#5a6472', '#fff');
    outText(m.sub, cw / 2, 172 * S, Math.max(14, 20 * S), '#5a6472', 'rgba(255,255,255,.9)');
    g.restore();
  });

  g.save(); g.globalAlpha = 0.55 + Math.sin(gmT * 4.5) * 0.45;
  outText(KEYW('ДАЛЬШЕ'), W / 2, H * 0.80, 36 * S, '#fff', '#e0691f');
  g.restore();
  var pulse = 1 + Math.sin(gmT * 5) * 0.08;
  g.save(); g.globalAlpha = 0.85;
  outText('◀', 46 * S, H * 0.55, 60 * S * pulse, '#fff', '#2b6cb0');
  outText('▶', W - 46 * S, H * 0.55, 60 * S * pulse, '#fff', '#2b6cb0');
  g.restore();
}

function toGameMode(quiet) {                       // quiet — пришли голосом, машинку только что назвали вслух
  A.init(); car = CARS[sel]; state = 'gamemode'; gmT = 0;
  parts.length = 0; texts.length = 0;
  A.whoosh(); if (!quiet) A.say(car.say);
  setPad();
}


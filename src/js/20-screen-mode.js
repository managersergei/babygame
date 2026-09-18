/* ═══════════════ 17. ЭКРАН 2 — РЕЖИМ ═══════════════ */
function drawKeyCap(x, y, w, h, label, hot) {
  g.save();
  g.fillStyle = hot ? '#ffcf3d' : '#ffffff';
  roundRect(x, y + 6 * S, w, h, 14 * S); g.fillStyle = 'rgba(0,0,0,.25)'; g.fill();
  roundRect(x, y, w, h, 14 * S);
  g.fillStyle = hot ? '#ffd93d' : '#f2f6fb'; g.fill();
  g.lineWidth = 3 * S; g.strokeStyle = '#2b2140'; g.stroke();
  outText(label, x + w / 2, y + h / 2, Math.min(h * 0.5, w * 0.42), '#2b2140', 'rgba(255,255,255,.85)');
  g.restore();
}

function drawMode(dt) {
  modeT += dt;
  drawSky(); drawClouds(); drawFar(); drawRoad();

  // выбранная машинка на облачке
  var hh = car.h * S * 1.05, bob = Math.sin(modeT * 2) * 7 * S;
  var cwid = vehW(car.id, hh);
  g.save();
  g.fillStyle = 'rgba(255,255,255,.85)';
  g.beginPath(); g.ellipse(W / 2, H * 0.34 + 6 * S, cwid * 0.46, 24 * S, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.beginPath(); g.ellipse(W / 2 - cwid * 0.28, H * 0.34, 46 * S, 20 * S, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(W / 2 + cwid * 0.28, H * 0.34, 46 * S, 20 * S, 0, 0, TAU); g.fill();
  g.restore();
  drawVehicle(car.id, W / 2, H * 0.34 + bob, hh, {});
  outText('КАК БУДЕМ ИГРАТЬ?', W / 2, 58 * S, 46 * S, '#fff', '#2b6cb0');

  var cw = Math.min(W * 0.27, 380 * S), chh = Math.min(H * 0.30, 250 * S);
  var cy = H * 0.42, gap = W * 0.022;
  var x0 = W / 2 - (MODES.length * cw + (MODES.length - 1) * gap) / 2;

  MODES.forEach(function (m, i) {
    var isSel = i === modeSel;
    var k = isSel ? 1 + Math.sin(modeT * 4) * 0.015 : 0.9;
    var x = x0 + i * (cw + gap);
    g.save();
    g.translate(x + cw / 2, cy + chh / 2); g.scale(k, k); g.translate(-cw / 2, -chh / 2);

    g.fillStyle = 'rgba(0,0,0,.22)'; roundRect(6 * S, 10 * S, cw, chh, 28 * S); g.fill();
    g.fillStyle = isSel ? 'rgba(255,255,255,.97)' : 'rgba(255,255,255,.72)';
    roundRect(0, 0, cw, chh, 28 * S); g.fill();
    g.lineWidth = isSel ? 8 * S : 3 * S;
    g.strokeStyle = isSel ? '#ffb703' : 'rgba(43,33,64,.35)';
    roundRect(0, 0, cw, chh, 28 * S); g.stroke();

    outText(m.title, cw / 2, 44 * S, 30 * S, isSel ? '#e0691f' : '#5a6472', '#fff');
    outText(m.sub, cw / 2, 80 * S, Math.max(14, 19 * S), '#5a6472', 'rgba(255,255,255,.9)');

    var kw = 68 * S, kh = 58 * S;
    var ws = m.keys.map(function (l) { return l.length > 2 ? kw * 2.4 : kw; });
    var tot = ws.reduce(function (a, b) { return a + b; }, 0) + (ws.length - 1) * 10 * S;
    var kx = cw / 2 - tot / 2;
    m.keys.forEach(function (lbl, j) {
      drawKeyCap(kx, chh - kh - 30 * S, ws[j], kh, lbl, isSel);
      kx += ws[j] + 10 * S;
    });
    g.restore();
  });

  g.save(); g.globalAlpha = 0.55 + Math.sin(modeT * 4.5) * 0.45;
  outText(KEYW('ПОЕХАЛИ!'), W / 2, H * 0.80, 40 * S, '#fff', '#e0691f');
  g.restore();

  var pulse = 1 + Math.sin(modeT * 5) * 0.08;
  g.save(); g.globalAlpha = 0.85;
  outText('◀', 46 * S, cy + chh * 0.5, 60 * S * pulse, '#fff', '#2b6cb0');
  outText('▶', W - 46 * S, cy + chh * 0.5, 60 * S * pulse, '#fff', '#2b6cb0');
  g.restore();
}


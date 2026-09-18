/* ═══════════════ 14. МАШИНКА ═══════════════ */
function drawCar() {
  var h = car.h * S, w = vehW(car.id, h), x = CARX, y = GY - carY;

  g.save();
  g.globalAlpha = clamp(1 - carY / (320 * S), 0.15, 0.5);
  g.fillStyle = shColor();
  g.beginPath();
  /* Тень сжимается по ОБЕИМ осям: высота была константой, и в прыжке пятно
     выглядело плоской полосой вместо уходящего вниз овала. */
  var shk = clamp(1 - carY / (900 * S), 0.5, 1);
  g.ellipse(x, GY + 8 * S, w * 0.42 * shk, 13 * S * shk, 0, 0, TAU);
  g.fill();
  g.restore();

  if (spd > VMAX * 0.62) {
    /* Штрихи скорости. Раньше и позиция, и длина, и прозрачность брались из rnd()
       на каждом кадре — получался белый шум, а не движение. Теперь у каждого штриха
       своя постоянная дорожка, а бежит он по фазе от пройденного пути. */
    var sk2 = clamp((spd - VMAX * 0.62) / (VMAX * 0.38), 0, 1);
    g.save(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 4 * S; g.lineCap = 'round';
    for (var i = 0; i < 6; i++) {
      var r6 = h1r(i * 7.7);
      var ly = y - (20 + r6 * (h * 0.85 - 20));
      var lenn = (40 + r6 * 70) * S;
      var ph6 = ((carX * (0.9 + r6 * 0.5) / (260 * S) + i * 0.17) % 1);
      var lx = x - w * 0.5 - ph6 * 170 * S;
      g.globalAlpha = (0.2 + r6 * 0.4) * sk2 * (1 - ph6 * 0.6);
      g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx - lenn, ly); g.stroke();
    }
    g.restore();
  }

  g.save();
  g.translate(x, y + squash * 12 * S);
  g.rotate(tilt - (1 - flipT) * 0 - flipT * TAU * (car.id === 'race' ? 1 : 0.6));
  g.scale(1 + squash * 0.5, 1 - squash * 0.5);
  var bob = grounded ? Math.sin(wobble * 2) * clamp(spd / VMAX, 0, 1) * 3.5 * S : 0;
  if (paintRevT > 0 && carPaint) {                 // краска наплывает сверху вниз за 0,8 с
    var kr = clamp(1 - paintRevT / 0.8, 0, 1), keep2 = carPaint;
    carPaint = null; drawVehicle(car.id, 0, bob, h, {}); carPaint = keep2;
    g.save();
    g.beginPath(); g.rect(-w, bob - h, w * 2, h * kr); g.clip();
    drawVehicle(car.id, 0, bob, h, {});
    g.restore();
  } else drawVehicle(car.id, 0, bob, h, {});

  if (sirenT > 0 && car.siren) {
    var on = Math.floor(sirenT * 5) % 2;      // 2,5 смены в секунду: собственное правило проекта — не чаще трёх
    g.globalAlpha = 0.85; g.fillStyle = on ? '#ff2d55' : '#2d7dff';
    g.beginPath(); g.ellipse(-w * 0.1, -h * 1.02, w * 0.3, 16 * S, 0, 0, TAU); g.fill();
    g.globalAlpha = 0.28;
    g.beginPath(); g.arc(-w * 0.1, -h * 1.02, 60 * S, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }
  g.restore();
}

function drawNight() {
  if (night <= 0.01) return;
  g.save();
  g.fillStyle = 'rgba(6,10,34,' + (night * 0.84).toFixed(3) + ')';
  g.fillRect(0, 0, W, H);
  if (lights) {
    var x = CARX + vehW(car.id, car.h * S) * 0.42, y = GY - car.h * S * 0.42 - carY;
    g.globalCompositeOperation = 'lighter';
    var grd = g.createLinearGradient(x, y, x + 780 * S, y);
    grd.addColorStop(0, 'rgba(255,240,170,.8)');
    grd.addColorStop(0.5, 'rgba(255,235,150,.3)');
    grd.addColorStop(1, 'rgba(255,235,150,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x, y - 22 * S); g.lineTo(x + 780 * S, y - 235 * S);
    g.lineTo(x + 780 * S, y + 225 * S); g.lineTo(x, y + 22 * S);
    g.closePath(); g.fill();
    var lg = g.createRadialGradient(x, y, 2 * S, x, y, 62 * S);
    lg.addColorStop(0, 'rgba(255,255,225,.95)'); lg.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = lg; g.beginPath(); g.arc(x, y, 62 * S, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}

function drawPlayScene() {
  drawSky(); drawClouds(); drawFar(); drawRoad(); drawProps();
  drawObjs(); drawTrain(false); drawRobot(); drawParts(true); drawCar(); drawTrain(true);
  drawNight();
}


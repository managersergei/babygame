/* ═══════════════ 11. ЧАСТИЦЫ ═══════════════ */
function updateParts(dt) {
  for (var i = parts.length - 1; i >= 0; i--) {
    var p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy -= p.ay * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.kind === 'puff') { p.r += dt * 26 * S; p.vx *= 1 - dt * 1.4; }
    if (p.y < 0 && p.kind === 'drop') p.life = Math.min(p.life, 0.12);
  }
  for (var j = texts.length - 1; j >= 0; j--) {
    texts[j].life -= dt; texts[j].y += dt * 60 * S;
    if (texts[j].life <= 0) texts.splice(j, 1);
  }
}

function drawParts(worldSpace) {
  parts.forEach(function (p) {
    var a = clamp(p.life / p.max, 0, 1);
    var sx = worldSpace ? (p.x - carX) + CARX : p.x;
    var sy = GY - p.y;
    g.save(); g.globalAlpha = a;
    if (p.kind === 'conf') {
      g.translate(sx, sy); g.rotate(p.rot); g.fillStyle = p.c;
      g.fillRect(-p.r * 0.5, -p.r * 0.35, p.r, p.r * 0.7);
    } else if (p.kind === 'note') {
      g.fillStyle = p.c; g.font = 'bold ' + (p.r * 2) + 'px system-ui';
      g.textAlign = 'center'; g.fillText('♪', sx, sy);
    } else if (p.kind === 'spark') {
      g.translate(sx, sy); g.rotate(p.rot); g.fillStyle = p.c;
      g.beginPath();
      for (var i = 0; i < 8; i++) {
        var rr = i % 2 ? p.r * 0.4 : p.r, an = i / 8 * TAU;
        g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
      }
      g.closePath(); g.fill();
    } else {
      g.fillStyle = p.c;
      g.beginPath();
      if (p.kind === 'drop') g.ellipse(sx, sy, p.r * 0.75, p.r, 0, 0, TAU);
      else g.arc(sx, sy, p.r, 0, TAU);
      g.fill();
    }
    g.restore();
  });
}


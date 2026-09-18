/* ═══════════════ 17b. ГОЛОС В ГАРАЖЕ ═══════════════
   Диктор просит назвать машинку вслух — два раза. Так ребёнок учит слово,
   а игра копит образцы его произношения.                                    */
var gv = { phase: 'idle', t: 0, tries: 0, miss: 0 };

function gvReset() { gv.phase = 'idle'; gv.t = 0; gv.tries = 0; gv.miss = 0; Mic.cancel(); }

function gvAsk() {
  gv.phase = 'say'; gv.t = 0;
  A.say('Скажи: ' + CARS[sel].say);
}

function gvHeard(sample) {
  if (state !== 'garage' || gv.phase !== 'listen') return;
  if (sample) {
    Voice.add('car.' + CARS[sel].id, sample);
    Stats.bump(CARS[sel].name);
    gv.tries++; gv.phase = 'good'; gv.t = 0;
    A.coin(gv.tries * 3);
    A.say(gv.tries >= 2 ? 'Молодец! Поехали!' : 'Умница! Ещё раз!');
    for (var i = 0; i < 22; i++)
      P({ x: W / 2 + rnd(-160, 160) * S, y: 260 * S + rnd(-40, 40) * S, vx: rnd(-120, 120) * S,
          vy: rnd(60, 260) * S, r: rnd(6, 14) * S, c: pick(['#ffd93d', '#fff', '#7bd66b']),
          kind: 'spark', life: rnd(0.6, 1.1), ay: 260 * S, vr: rnd(-8, 8) });
  } else {
    gv.miss++;
    if (gv.miss >= 2) { gv.phase = 'quiet'; }        // не приставать без конца
    else { gv.phase = 'again'; gv.t = 0; }
  }
}

function gvGo(sample) {
  if (state !== 'garage' || gv.phase !== 'go') return;
  if (sample) {
    Voice.add('cmd.go', sample);
    A.coin(6);
    for (var i = 0; i < 18; i++)
      P({ x: W / 2 + rnd(-150, 150) * S, y: 250 * S + rnd(-30, 30) * S, vx: rnd(-120, 120) * S,
          vy: rnd(60, 240) * S, r: rnd(6, 13) * S, c: pick(['#ffd93d', '#fff']),
          kind: 'spark', life: rnd(0.5, 1.0), ay: 300 * S, vr: rnd(-8, 8) });
  }
  toGameMode(true);
}

function garageVoice(dt) {
  if (!Voice.on || Mic.denied() || !Mic.ready()) return;
  if (Voice.count('car.' + CARS[sel].id) >= 2 || gv.phase === 'quiet') return;
  gv.t += dt;
  if (gv.phase === 'idle') { if (Math.abs(slide) < 0.06 && gv.t > 1.0) gvAsk(); }
  else if (gv.phase === 'say')   { if (gv.t > 0.15 && !A.talking()) { gv.phase = 'listen'; gv.t = 0; Mic.listen(5, gvHeard); } }
  else if (gv.phase === 'again') { if (gv.t > 0.6 && !A.talking()) gvAsk(); }
  else if (gv.phase === 'good')  {
    if (gv.t > 1.6 && !A.talking()) {
      if (gv.tries < 2) { gvAsk(); return; }
      gv.phase = 'go'; gv.t = 0;                       // «поехали» — тоже слово, ловим его
      if (Mic.ready()) Mic.listen(3.5, gvGo); else toGameMode(true);
    }
  }
  else if (gv.phase === 'go') { if (gv.t > 4.2) toGameMode(true); }
}

function drawMicBubble(cx, cy, title, word, listening) {
  var w = Math.min(W * 0.8, Math.max(360 * S, word.length * 30 * S)), h = 96 * S;
  g.save();
  g.fillStyle = 'rgba(20,30,60,.28)'; roundRect(cx - w / 2 + 5 * S, cy - h / 2 + 8 * S, w, h, 26 * S); g.fill();
  g.fillStyle = 'rgba(255,255,255,.95)'; roundRect(cx - w / 2, cy - h / 2, w, h, 26 * S); g.fill();
  g.lineWidth = 5 * S; g.strokeStyle = listening ? '#4ade80' : '#ffb703';
  roundRect(cx - w / 2, cy - h / 2, w, h, 26 * S); g.stroke();
  outText(title, cx, word ? cy - h * 0.26 : cy - h * 0.12, word ? 22 * S : 30 * S, listening ? '#2f9e50' : '#e0691f', 'rgba(255,255,255,.9)');
  if (word) outText(word, cx, cy + h * 0.14, 34 * S, '#2b2140', 'rgba(255,255,255,.9)');
  if (listening) {                                  // индикатор громкости
    var lw = w * 0.7, lv = Mic.level(), dead = !Mic.alive();
    g.fillStyle = 'rgba(0,0,0,.12)'; roundRect(cx - lw / 2, cy + h * 0.36, lw, 10 * S, 5 * S); g.fill();
    g.fillStyle = dead ? '#ff8f8f' : '#4ade80';
    roundRect(cx - lw / 2, cy + h * 0.36, Math.max(6 * S, lw * lv), 10 * S, 5 * S); g.fill();
    if (dead) outText('нет сигнала с микрофона', cx, cy + h * 0.66, Math.max(13, 17 * S), '#c0392b', '#fff');
  }
  g.restore();
}


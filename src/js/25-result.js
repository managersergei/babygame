/* ═══════════════ 17bz. ФИНИШ УРОВНЯ И БАЛЛЫ ═══════════════ */
/* Счёт один на всю игру — звёздочки. `best` — рекорд за один заезд, `total` — сколько собрано всего. */
var best = (function () { try { return +localStorage.getItem('babygame.best') || 0; } catch (e) { return 0; } })();
var total = (function () { try { return +localStorage.getItem('babygame.total') || 0; } catch (e) { return 0; } })();
var score = 0;   // ← старые очки больше не показываем; переменная осталась, чтобы не трогать сюжетный экран
var finishing = false, levelStars = 0, lastWord = '';
var res = { t: 0, stars: 0, word: '', pts: 0, lvl: 1 };

function saveScore() {
  try { localStorage.setItem('babygame.best', String(best)); localStorage.setItem('babygame.total', String(total)); } catch (e) {}
}
function noteStars() {                                  // звезда собрана: обновляем рекорд на лету
  if (stars > best) { if (best > 0 && !bestShown) { bestShown = 1; popText('РЕКОРД!', carX, carY + car.h * S, '#ffd93d'); A.fanfare(2); } best = stars; saveScore(); }
}
var bestShown = 0;

/* Бесконечный режим: уровней нет, просто маленькие праздники и редкие поломки. */
var miles = 0;
function milestone() {
  miles++;
  celebrate = 1.6; flash = 0.2;
  score += 30; saveScore();
  A.fanfare(); A.cheer();
  A.say(pick(['Молодец!', 'Здорово едешь!', 'Ты супер!', 'Вот это да!']));
  for (var i = 0; i < 60; i++)
    P({ x: carX + rnd(-W * 0.3, W * 0.3), y: rnd(180, 420) * S, vx: rnd(-220, 220) * S, vy: rnd(-40, 300) * S,
        r: rnd(7, 16) * S, c: pick(['#ff4d6d', '#ffd93d', '#4fc3f7', '#7bd66b', '#c77dff']),
        kind: 'conf', life: rnd(1.2, 2.2), vr: rnd(-10, 10) });
  // починка бывает только по делу — когда машинка реально разбита (см. hurt)
}

function toResult() {
  track('stage_done', { stage: stage });
  state = 'result'; res.t = 0;
  res.stars = Math.max(0, stars - levelStars);
  res.word = lastWord; res.lvl = stage + 1;
  res.pts = res.stars * 10 + (res.word ? 50 : 0) + 100;
  score += res.pts; saveScore();
  Mic.disarm(); A.engine(0, 1, false);
  A.fanfare(); A.cheer();
  A.say('Уровень пройден! Ты молодец!');
  parts.length = 0;
  for (var i = 0; i < 90; i++)
    P({ x: rnd(0, W), y: rnd(H * 0.35, H * 0.9), vx: rnd(-160, 160) * S, vy: rnd(-40, 260) * S,
        r: rnd(7, 17) * S, c: pick(['#ff4d6d', '#ffd93d', '#4fc3f7', '#7bd66b', '#c77dff', '#ff9f1c']),
        kind: 'conf', life: rnd(1.4, 2.6), vr: rnd(-10, 10) });
  setPad();
}

function updateResult(dt) {
  res.t += dt;
  if (parts.length < 40 && res.t < 2.5 && RNG() < dt * 30)
    P({ x: rnd(0, W), y: H * 0.95, vx: rnd(-120, 120) * S, vy: rnd(240, 520) * S, r: rnd(6, 14) * S,
        c: pick(['#ff4d6d', '#ffd93d', '#4fc3f7', '#7bd66b']), kind: 'conf', life: rnd(1.2, 2.0), vr: rnd(-9, 9) });
}

function drawResult() {
  drawPlayScene();
  g.save(); g.fillStyle = 'rgba(12,22,45,.6)'; g.fillRect(0, 0, W, H); g.restore();
  drawParts(false);

  var pw = Math.min(W * 0.7, 620 * S), ph = 300 * S, px = W / 2 - pw / 2, py = H * 0.22;
  g.save();
  g.fillStyle = 'rgba(0,0,0,.25)'; roundRect(px + 6 * S, py + 10 * S, pw, ph, 30 * S); g.fill();
  g.fillStyle = 'rgba(255,255,255,.96)'; roundRect(px, py, pw, ph, 30 * S); g.fill();
  g.lineWidth = 7 * S; g.strokeStyle = '#ffb703'; roundRect(px, py, pw, ph, 30 * S); g.stroke();
  g.restore();

  var k = 1 + Math.max(0, 0.5 - res.t) * 0.3;
  outText('УРОВЕНЬ ' + res.lvl + ' ПРОЙДЕН!', W / 2, py + 52 * S, 42 * S * k, '#e0691f', '#fff');

  /* Была бухгалтерская ведомость: «+10 / +50 / +100» и общий счёт — ни одной цифры
     из этого ребёнок не читает. Показываем то, что он сделал: собранные звёзды
     рядом, выученное слово своей картинкой, и всё. Счёт — мелко, для взрослого. */
  var shown = Math.min(res.stars, 8), stw = 46 * S;
  var sx0 = W / 2 - (shown - 1) * stw * 0.5;
  for (var si = 0; si < shown; si++) {
    var pop2 = 1 + Math.max(0, 0.45 - Math.abs(res.t - 0.25 - si * 0.09)) * 1.2;
    spr('star', sx0 + si * stw, py + 132 * S, 42 * S * pop2);
  }
  if (res.stars > shown)
    outText('×' + res.stars, W / 2, py + 168 * S, 30 * S, '#e0691f', '#fff');
  if (res.word) {
    var wi2 = WORD_ICON[res.word] || '';
    outText((wi2 ? wi2 + '  ' : '') + res.word, W / 2, py + 214 * S, 40 * S, '#2b6cb0', '#fff');
    outText('новое слово', W / 2, py + 252 * S, 22 * S, '#8a94a6', '#fff');
  } else {
    spr('arch', W / 2, py + 232 * S, 96 * S);
  }
  g.save(); g.globalAlpha = 0.5;
  outText('всего ' + score, px + pw - 26 * S, py + ph - 20 * S, 20 * S, '#5a6472', '#fff', 'right');
  g.restore();

  g.save(); g.globalAlpha = 0.5 + Math.sin(T * 4.5) * 0.5;
  outText(KEYW('ДАЛЬШЕ'), W / 2, py + ph + 60 * S, 34 * S, '#fff', '#e0691f');
  g.restore();
}


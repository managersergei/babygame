/* ═══════════════ 17bw. ПРОИГРЫШ В БЕСКОНЕЧНОМ ═══════════════ */
var over = { t: 0, reason: '', said: false, mon: '', sel: 0, call: 0 };   // sel: 0 — ещё раз, 1 — сменить машинку; call — сколько раз позвали играть снова

function gameOver(reason) {
  track('over', { reason: reason });
  if (state !== 'play') return;
  state = 'over'; over.t = 0; over.reason = reason; over.said = false; over.sel = 0;
  over.mon = reason === 'robot' ? 'robot' : pick(['monster_a', 'monster_b', 'monster_c', 'monster_d']);
  total += stars; if (stars > best) best = stars; bestShown = 0; saveScore();
  Mic.disarm(); A.engine(0, 1, false);
  A.land(); A.clunk();
  shake = 0;
  A.say(reason === 'fuel' ? 'Бензин закончился! Ничего страшного, попробуем ещё раз!'
                          : 'Ой! Тебя поймали! Ничего страшного, попробуем ещё раз!');
  for (var i = 0; i < 40; i++)
    P({ x: carX + rnd(-80, 80) * S, y: rnd(20, 160) * S, vx: rnd(-260, 260) * S, vy: rnd(80, 320) * S,
        r: rnd(6, 15) * S, c: pick(['#ffd93d', '#ff9f1c', '#fff']), kind: 'spark', life: rnd(0.6, 1.2) });
  setPad();
}

function updateOver(dt) {
  over.t += dt;
  if (!over.said && over.t > 0.6 && !A.talking()) {          // потом называем результат
    over.said = true;
    var n2 = stars, n10 = n2 % 10, n100 = n2 % 100;
    var word = (n10 === 1 && n100 !== 11) ? 'звёздочку'
             : (n10 >= 2 && n10 <= 4 && !(n100 >= 12 && n100 <= 14)) ? 'звёздочки' : 'звёздочек';
    A.say([n2 > 100 ? 'Ты собрал больше ста звёздочек!' : 'Ты собрал ' + n2 + ' ' + word + '!',
           n2 >= 30 ? 'Вот это рекорд!' : n2 >= 15 ? 'Здорово!' : n2 >= 5 ? 'Хорошо!'
                                                                : 'В следующий раз получится больше!']);
    over.call = 0;
  }
  /* Дальше экран был тупиком тишины: ребёнок сидит, диктор молчит, и никто не
     зовёт играть снова. Приглашаем каждые ~9 секунд, тремя разами и хватит. */
  if (over.said && !A.talking() && (over.call || 0) < 3 && over.t > 4 + (over.call || 0) * 9) {
    over.call = (over.call || 0) + 1;
    A.say('Ещё раз!');
  }
}

function drawOver() {
  drawPlayScene();
  g.save(); g.fillStyle = 'rgba(12,22,45,.40)'; g.fillRect(0, 0, W, H); g.restore();
  drawParts(false);
  // Одна карточка с понятным порядком сверху вниз: почему всё → сколько собрал → сколько всего.
  // Кнопка «ещё раз» на экране ровно одна — жёлтая внизу, её же нажимает пробел.
  var pw = Math.min(W * 0.56, 500 * S), ph = 336 * S, px = W / 2 - pw / 2,
      py = Math.max(16 * S, H * 0.5 - ph * 0.62);
  g.save();
  g.fillStyle = 'rgba(0,0,0,.25)'; roundRect(px + 6 * S, py + 10 * S, pw, ph, 30 * S); g.fill();
  g.fillStyle = 'rgba(255,255,255,.97)'; roundRect(px, py, pw, ph, 30 * S); g.fill();
  g.lineWidth = 7 * S; g.strokeStyle = '#ffb703'; roundRect(px, py, pw, ph, 30 * S); g.stroke();
  g.restore();

  var icon = over.reason === 'fuel' ? 'fuel_empty' : (over.mon || 'monster_a');
  spr(icon, W / 2, py + 122 * S, 92 * S, { rot: Math.sin(T * 2) * 0.06 });

  g.save(); g.fillStyle = 'rgba(40,50,80,.12)';
  g.fillRect(px + 40 * S, py + 140 * S, pw - 80 * S, 3 * S); g.restore();

  spr('star', W / 2 - 58 * S, py + 244 * S, 76 * S);                  // за эту поездку — крупно
  outText(String(stars), W / 2 + 62 * S, py + 206 * S, 58 * S, '#ffd93d', '#7a4b00');

  spr('chest', W / 2 - 58 * S, py + 318 * S, 52 * S);                 // рекорд — мельче
  outText('рекорд ' + best, W / 2 + 56 * S, py + 292 * S, 32 * S, '#2b6cb0', '#fff');

  /* Две кнопки: «ещё раз» и «другая машинка». Стрелки переключают, пробел нажимает выбранную. */
  var byy = py + ph + 54 * S, bw2 = pw * 0.46, bh2 = 74 * S;
  [['↻  ЕЩЁ РАЗ', W / 2 - pw / 2], ['🚗  ДРУГАЯ', W / 2 + pw / 2 - bw2]].forEach(function (b, i) {
    var on = over.sel === i, k2 = on ? 1 + Math.sin(T * 5) * 0.02 : 0.94;
    g.save(); g.translate(b[1] + bw2 / 2, byy + bh2 / 2); g.scale(k2, k2); g.translate(-bw2 / 2, -bh2 / 2);
    g.fillStyle = 'rgba(0,0,0,.22)'; roundRect(4 * S, 8 * S, bw2, bh2, 22 * S); g.fill();
    g.fillStyle = on ? '#ffd93d' : 'rgba(255,255,255,.82)'; roundRect(0, 0, bw2, bh2, 22 * S); g.fill();
    g.lineWidth = on ? 6 * S : 3 * S; g.strokeStyle = on ? '#e0691f' : 'rgba(43,33,64,.3)';
    roundRect(0, 0, bw2, bh2, 22 * S); g.stroke();
    outText(b[0], bw2 / 2, bh2 / 2, 26 * S, on ? '#2b2140' : '#5a6472', '#fff');
    g.restore();
  });
  g.save(); g.globalAlpha = 0.5 + Math.sin(T * 4) * 0.35;
  outText('◀ ▶ выбрать · ' + (TOUCH ? 'кнопка' : 'ПРОБЕЛ') + ' — поехали', W / 2, byy + bh2 + 40 * S, 24 * S, '#fff', '#2b6cb0');
  g.restore();
}


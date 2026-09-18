/* ═══════════════ 15. HUD ═══════════════ */
function outText(txt, x, y, size, fill, stroke, align) {
  g.font = '900 ' + size + 'px "Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif';
  g.textAlign = align || 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.miterLimit = 2;
  g.lineWidth = size * 0.22; g.strokeStyle = stroke || '#2b2140';
  g.strokeText(txt, x, y);
  g.fillStyle = fill; g.fillText(txt, x, y);
}

function outWrap(txt, x, y, size, maxW, fill, stroke, lh) {
  g.font = '900 ' + size + 'px "Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif';
  var words = txt.split(' '), lines = [], cur = '';
  for (var i = 0; i < words.length; i++) {
    var t = cur ? cur + ' ' + words[i] : words[i];
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = words[i]; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  for (var j = 0; j < lines.length; j++)
    outText(lines[j], x, y + j * (lh || size * 1.15), size, fill, stroke);
  return lines.length;
}

/* Счётчик звёзд рисуется одинаково в обоих режимах: спрайт игры, а не эмодзи,
   на полупрозрачной капсуле — та же подложка, что у шкалы бензина. Иконка ставится
   по ИЗМЕРЕННОЙ ширине числа, иначе на трёхзначном счёте она заезжает под цифры. */
function HUDTOP() { return W <= 1000 ? 46 : 0; }   // на узких экранах ряд #tools стоит сверху справа

/* Рекорд показан сундуком — тем же, что на экране проигрыша. Слово «рекорд» ребёнок
   не читает, а две разные формы одного и того же в одной игре сбивают и взрослого. */
function drawBest(v, hudTop) {
  g.save(); g.globalAlpha = 0.8;
  spr('chest', W - 116 * S, 118 * S + hudTop, 40 * S);
  outText(String(v), W - 30 * S, 100 * S + hudTop, 30 * S, '#fff', '#2b6cb0', 'right');
  g.restore();
}

function drawStarCount() {
  var bx = W - 30 * S, by = 46 * S + HUDTOP(), t = String(stars);
  if (stars !== starWas) { if (starWas >= 0) starPopT = T; starWas = stars; }
  var pop = 1 + 0.34 * Math.max(0, 1 - (T - starPopT) * 4.5);   // счётчик отзывается на награду
  g.save();
  g.font = '900 ' + (60 * S) + 'px "Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif';
  var tw = g.measureText(t).width;
  g.globalAlpha = 0.26; g.fillStyle = '#2b2140';
  roundRect(bx - tw - 96 * S, by - 22 * S, tw + 108 * S, 70 * S, 35 * S); g.fill();
  g.restore();
  spr('star', bx - tw - 44 * S, by + 34 * S, 68 * S * pop);
  outText(t, bx, by + 6 * S, 60 * S * pop, '#ffd93d', '#7a4b00', 'right');
}

function drawHUD() {
  drawFuelBar();

  drawStarCount();

  if (combo >= 2 && comboT > 0) {                  // серия — видно, а не только слышно по высоте чима
    var ck = clamp(comboT / 1.2, 0, 1);
    g.save(); g.globalAlpha = ck;
    outText('×' + combo, W - 30 * S, 168 * S + HUDTOP(), (34 + Math.min(combo, 8) * 3) * S, '#7bd66b', '#1f4d2a', 'right');
    g.restore();
  }

  /* Ряд «сколько звёзд до уровня». Подложка нужна, чтобы ряд не терялся на светлом небе;
     ширина = 10 шагов по 40*S от левого края 34*S плюс поля — при смене шага пересчитать. */
  g.save(); g.globalAlpha = 0.30; g.fillStyle = '#ffffff';
  roundRect(10 * S, 126 * S, 408 * S, 44 * S, 22 * S); g.fill();
  g.globalAlpha = 0.35; g.lineWidth = 2 * S; g.strokeStyle = '#2b2140';
  roundRect(10 * S, 126 * S, 408 * S, 44 * S, 22 * S); g.stroke(); g.restore();
  for (var i = 0; i < 10; i++) {
    var x = 34 * S + i * 40 * S, y = 148 * S;
    g.save(); g.globalAlpha = i < row ? 1 : 0.5;   // 0,28 на подложке давало серое пятно вместо ряда
    var im = IMG.star;
    var isNew = (i === row - 1);                   // только что полученная — подпрыгивает
    if (ok(im)) { var h = (i < row ? 40 * S : 32 * S) * (isNew ? 1 + 0.25 * Math.max(0, 1 - (T - starPopT) * 5) : 1),
                  w = iw(im) * (h / ih(im));
                  g.drawImage(im, x - w / 2, y - h / 2, w, h); }
    g.restore();
  }

  outText(car.name, W / 2, 44 * S, 34 * S, '#ffffff', '#2b6cb0');
  var hudTop = HUDTOP();
  if (best > 0) drawBest(best, hudTop);

  texts.forEach(function (t) {
    g.save(); g.globalAlpha = clamp(t.life / t.max, 0, 1);
    outText(t.t, (t.x - carX) + CARX, GY - t.y, 40 * S, t.c, '#2b2140');
    g.restore();
  });

  if (celebrate > 0) {
    var k = clamp(celebrate / 2.4, 0, 1);
    g.save(); g.globalAlpha = Math.min(1, k * 1.6);
    outText('МОЛОДЕЦ!', W / 2, H * 0.3, 78 * S * (1 + (1 - k) * 0.1), '#fff', '#ff8f1f');
    g.restore();
  }
}


/* ═══════════════ 17bx. ВОПРОС «ДА / НЕТ» ═══════════════
   Первый ответ становится образцом слова «да». Всё, что потом не похоже
   на «да», запоминается как «нет» — так обе кнопки диалога калибруются сами. */
var ask = { q: '', say: '', bg: 'play', t: 0, phase: '', yes: null, no: null, silent: 'yes', answer: null, sel: 0 };   // sel — что выбрано стрелками: 0 «да», 1 «нет»

function toAsk(o) {
  state = 'ask';
  var f = o.focus || [W / 2, GY - 110 * S];
  camTo(f[0], f[1], o.zoom || 1.5);
  ask.q = o.q; ask.say = o.say || o.q; ask.bg = o.bg || 'play';
  ask.yes = o.yes || null; ask.no = o.no || null; ask.silent = o.silent || 'yes';
  ask.t = 0; ask.phase = 'say'; ask.answer = null; ask.sel = 0;
  Mic.disarm(); Mic.cancel();
  A.engine(0, 1, false);
  A.say(ask.say);
  setPad();
}

function yesNo(sample) {
  if (!sample) return null;
  var known = [];
  if (Voice.count('cmd.yes')) known.push('cmd.yes');
  if (Voice.count('cmd.no')) known.push('cmd.no');
  if (!known.length) { Voice.add('cmd.yes', sample); return true; }   // первое «готов?» — учим «да»
  var m = Voice.match(sample, known);
  if (m && m.ok && m.word === 'cmd.yes') { Voice.add('cmd.yes', sample); return true; }
  Voice.add('cmd.no', sample);
  return false;
}

function askAnswer(yes) {
  if (ask.phase === 'done' || ask.phase === 'idle') return;
  Mic.cancel();
  ask.answer = yes; ask.phase = 'done'; ask.t = 0;
  A.coin(4);
  A.say(yes ? 'Отлично!' : 'Ну хорошо!');
}

function askHeard(sample) {
  if (state !== 'ask' || ask.phase !== 'listen') return;
  var r = yesNo(sample);
  if (r === null) r = (ask.silent === 'yes');
  askAnswer(r);
}

function updateAsk(dt) {
  ask.t += dt; camStep(dt);
  if (ask.phase === 'say') {
    if (ask.t > 0.15 && !A.talking()) {
      ask.phase = 'listen'; ask.t = 0;
      if (Mic.ready()) Mic.listen(6, askHeard);
    }
  } else if (ask.phase === 'listen') {
    if (!Mic.ready() && ask.t > 1.2) askAnswer(ask.silent === 'yes');
  } else if (ask.phase === 'done') {
    if (ask.t > 1.5 && !A.talking()) {
      var f = ask.answer ? ask.yes : ask.no;
      ask.phase = 'idle';
      if (f) f();
    }
  }
}

function drawAskBg() {
  if (ask.bg === 'repair') drawRepair();
  else if (ask.bg === 'paint') drawPaintScene();
  else drawPlayScene();
}

function drawAsk() {
  withCam(drawAskBg);
  spotlight(0.95);
  outWrap(ask.q, W / 2, H * 0.2, 42 * S, W * 0.82, '#fff', '#2b6cb0');
  drawMicBubble(W / 2, H * 0.47,
    ask.phase === 'listen' ? '🎤 ОТВЕЧАЙ!' : ask.phase === 'done' ? 'ПОНЯЛ!' : 'СЛУШАЙ…',
    ask.phase === 'done' ? (ask.answer ? 'ДА!' : 'НЕТ') : 'ДА  /  НЕТ',
    ask.phase === 'listen');
  var chips = [['ДА', '#4ade80'], ['НЕТ', '#ff8f8f']];
  chips.forEach(function (c, i) {
    var x = W / 2 + (i ? 1 : -1) * 115 * S, y = H * 0.68, w = 150 * S, h = 66 * S;
    var lit = ask.phase === 'done' ? ask.answer === (i === 0) : ask.sel === i;
    g.save();
    g.fillStyle = lit ? c[1] : 'rgba(255,255,255,.55)';
    roundRect(x - w / 2, y - h / 2, w, h, 22 * S); g.fill();
    g.lineWidth = lit ? 7 * S : 4 * S; g.strokeStyle = lit ? '#ffb703' : '#fff'; g.stroke();
    outText(c[0], x, y, 34 * S, '#2b2140', 'rgba(255,255,255,.85)');
    g.restore();
  });
  drawParts(false);
}


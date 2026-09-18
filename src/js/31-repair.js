/* ═══════════════ 17c. УРОВЕНЬ-МАСТЕРСКАЯ ═══════════════ */
var repairsDone = 0, breakN = 0;   // breakN — случайные поломки (для «каждой третьей на 4 колеса»)
var rep = { n: 0, fixed: 0, phase: '', t: 0, wheels: [], listening: false, numT: 0, lesson: null,
            echoPhase: '', echoT: 0, echoWord: '' };
var NUMKEY = ['', 'one', 'two', 'three', 'four'];
var level = 0, pendingRepair = false;

function numWord(n) { return ['', 'один', 'два', 'три', 'четыре'][n] || String(n); }
function wheelsWord(n) { return n === 1 ? 'одно колесо' : numWord(n) + ' колеса'; }

function toRepair() {
  state = 'repair';
  var st = story ? curStage() : null;
  rep.lesson = st && st.lesson ? st.lesson : null;
  var forcedN = rep.lesson === 'one' ? 1 : rep.lesson === 'two' ? 2 : rep.lesson === 'three' ? 3 : 0;
  if (forcedN) rep.n = forcedN;                                    // сюжетный урок счёта
  else if (crash.all) { crash.all = false; rep.n = 4; }            // снесло все колёса (поезд)
  else { breakN++; rep.n = (breakN % TUNE.fourEvery === 0) ? 4 : ri(1, 3); }   // числа озвучены до четырёх
  var wnq = +((location.search.match(/[?&]wn=(\d)/) || [])[1]) || 0;   // dev: ?wn=4 — принудительно
  if (wnq) rep.n = Math.min(4, Math.max(1, wnq));
  rep.fixed = 0; rep.echoPhase = ''; rep.echoT = 0; rep.phase = 'intro'; rep.t = 0; rep.listening = false; rep.numT = 0;
  rep.wheels = [];
  for (var i = 0; i < rep.n; i++)
    rep.wheels.push({ dx: (i - (rep.n - 1) / 2) * 175 * S, y: rnd(380, 520) * S, vy: 0,
                      rot: rnd(-1, 1), fly: 0, gone: false });
  parts.length = 0; texts.length = 0;
  A.engine(0, 1, false); A.clunk(); Mic.disarm();
  /* В сюжете этап уже сказал «заезжаем в мастерскую, колёса отвалились» — вторая
     реплика про то же самое давала ~7 секунд монолога без единого действия. */
  if (!fromCrash && !rep.lesson) A.say('Ой-ой! Машинка сломалась! Смотри, колёса упали!');
  fromCrash = false;
  if (Voice.on) Mic.request(false);
  setPad();
}

function askRepair() {
  rep.phase = 'ask'; rep.t = 0; rep.listening = false; rep.hinted = 0;
  A.say('Сколько колёс надо починить?');
  setPad();
}

function answerRepair() {
  if (rep.phase !== 'ask') return;
  Mic.cancel(); rep.listening = false;
  rep.phase = 'answer'; rep.t = 0; rep.numT = 1;
  A.fanfare(stars);
  A.say('Правильно! ' + wheelsWord(rep.n) + '!');
  setPad();
}

function repairSpace() {
  if (rep.phase === 'intro') { askRepair(); return; }
  if (rep.phase === 'ask') { answerRepair(); return; }
  if (rep.phase === 'answer') {
    if (rep.lesson && !learned[rep.lesson]) { toLesson(rep.lesson); return; }
    rep.phase = 'fix'; rep.t = 0; A.say('Нажимай пробел! Ставим колёса!'); setPad(); return;
  }
  if (rep.phase !== 'fix') return;
  var w = null;
  for (var i = 0; i < rep.wheels.length; i++)
    if (!rep.wheels[i].gone && rep.wheels[i].fly === 0) { w = rep.wheels[i]; break; }
  if (!w) return;
  w.fly = 0.001;
  rep.fixed++; rep.numT = 1;
  A.bolt(); A.coin(rep.fixed * 2);   // clunk означает поломку — закрученный болт так звучать не должен
  var nw = numWord(rep.fixed);
  A.say(nw.charAt(0).toUpperCase() + nw.slice(1) + '! Скажи ' + nw + '!');
  rep.echoWord = numWord(rep.fixed); rep.echoNum = rep.fixed; rep.echoPhase = 'say'; rep.echoT = 0;
  if (rep.fixed >= rep.n) {
    rep.phase = 'done'; rep.t = 0; stars += 5;
    /* «Починили!» было только текстом. Салют вокруг машинки — на том же языке,
       на котором игра награждает везде. */
    for (var dq = 0; dq < 46; dq++)
      P({ x: W * 0.30 + rnd(-150, 150) * S, y: rnd(30, 300) * S, vx: rnd(-240, 240) * S, vy: rnd(60, 320) * S,
          r: rnd(6, 15) * S, c: pick(['#ffd93d', '#7bd66b', '#fff', '#4fc3f7']), kind: 'conf',
          life: rnd(0.9, 1.8), vr: rnd(-9, 9) });
    setTimeout(function () { if (state === 'repair') { A.fanfare(stars); A.cheer(); A.say('Ура! Починили! Поехали дальше!'); } }, 700);
    setPad();
  }
}

function updateRepair(dt) {
  rep.t += dt;

  if (rep.echoPhase === 'say') {                    // даём диктору договорить и слушаем повтор
    rep.echoT += dt;
    if (!Voice.on) { rep.echoPhase = ''; }
    else if (!Mic.ready()) { Mic.request(false); if (rep.echoT > 1.6) rep.echoPhase = ''; }
    else if (rep.echoT > 0.12 && !A.talking() && !Mic.busy()) {
      rep.echoT = 0; rep.echoPhase = 'listen';
      Mic.listen(4, function (sm) {
        if (state !== 'repair' || rep.echoPhase !== 'listen') return;
        if (sm) { Voice.add('cmd.' + NUMKEY[rep.echoNum || rep.fixed], sm); A.coin(9); }
        rep.echoPhase = '';
      });
    }
  } else if (rep.echoPhase === 'listen') {
    rep.echoT += dt;
    if (rep.echoT > 4.4) { Mic.cancel(); rep.echoPhase = ''; }
  }
  if (rep.numT > 0) rep.numT = Math.max(0, rep.numT - dt * 1.2);

  var cx = W * 0.30, hh = car.h * S * 1.25;
  rep.wheels.forEach(function (w) {
    if (w.gone) return;
    if (w.fly > 0) {
      w.fly += dt * 2.4;
      if (w.fly >= 1) {
        w.gone = true;
        for (var i = 0; i < 18; i++)
          P({ x: cx + rnd(-60, 60) * S, y: GY - hh * 0.25 + rnd(-30, 30) * S, vx: rnd(-220, 220) * S,
              vy: rnd(80, 300) * S, r: rnd(6, 16) * S, c: pick(['#ffd93d', '#fff', '#ffb703']),
              kind: 'spark', life: rnd(0.5, 1.0), ay: 500 * S, vr: rnd(-9, 9) });
      }
    } else if (w.y > 0 || Math.abs(w.vy) > 1) {
      w.vy -= 2600 * S * dt; w.y += w.vy * dt; w.rot += dt * 3;
      if (w.y <= 0) {
        w.y = 0; w.vy = -w.vy * 0.34;
        if (Math.abs(w.vy) < 90 * S) { w.vy = 0; }
        else A.clunk();
      }
    } else w.rot = Math.sin(rep.t * 2.2 + w.dx * 0.01) * 0.14;
  });

  if (rep.phase === 'intro') {
    if (rep.t > 3.0 && !A.talking()) {
      if (!metEl.wheel && repairsDone >= 1 && Stats.canTeach('КОЛЕСО')) {   // на второй починке, вне очереди
        metEl.wheel = 1;
        toLesson('el_wheel', { x: carX + (W * 0.70 - CARX), h: 70 * S });
        return;
      }
      askRepair();
    }
  }
  else if (rep.phase === 'ask') {
    if (rep.listening && !rep.hinted && rep.t > 5 && !A.talking()) {
      rep.hinted = 1; A.say('Посчитай, сколько колёс на экране!');
    }
    if (!rep.listening && rep.t > 0.2 && !A.talking() && Voice.on && Mic.ready() && !Mic.busy()) {
      rep.listening = true;
      Mic.listen(12, function (sample) {
        rep.listening = false;
        if (state !== 'repair' || rep.phase !== 'ask') return;
        if (sample) Voice.add('num.' + rep.n, sample);
        answerRepair();                // молчание — диктор сам называет ответ
      });
    }
  }
  else if (rep.phase === 'answer') {
    if (rep.t > 2.6 && !A.talking()) {
      if (rep.lesson && !learned[rep.lesson]) { toLesson(rep.lesson); return; }
      rep.phase = 'fix'; rep.t = 0; A.say('Нажимай пробел! Ставим колёса!'); setPad();
    }
  }
  else if (rep.phase === 'done')   {
    if (rep.t > 3.0 && !A.talking() && !rep.echoPhase) {
      damage = 0; repairsDone++;
      if (story) nextStage();
      else { state = 'play'; fuel = 1; celebrate = 0; setPad(); }
    }
  }
}

/* Мастерская — это готовый дом из игры плюс табличка с ключом. Рисовать её коробкой
   в коде было ошибкой: рядом с настоящими спрайтами самоделка сразу видна. */
function repairShed(x, base, h) {
  ground(x, base + 2 * S, sprW('house', h) * 0.40);
  spr('house', x, base, h);
  var sw = 76 * S, sh = 34 * S, sy = base - h * 0.86;
  g.save();
  g.fillStyle = 'rgba(0,0,0,.18)'; roundRect(x - sw / 2 + 3 * S, sy - sh / 2 + 4 * S, sw, sh, 10 * S); g.fill();
  g.fillStyle = '#f7f2ea';         roundRect(x - sw / 2, sy - sh / 2, sw, sh, 10 * S); g.fill();
  g.lineWidth = 3 * S; g.strokeStyle = '#2b2140'; roundRect(x - sw / 2, sy - sh / 2, sw, sh, 10 * S); g.stroke();
  g.restore();
  outText('🔧', x, sy + 11 * S, 24 * S, '#2b2140', '#fff');
}

function drawRepair() {
  drawSky(); drawClouds(); drawFar(); drawRoad();

  var cx = W * 0.30, hh = car.h * S * 1.25, broken = rep.fixed < rep.n;

  /* Обстановка: навес, мастер и кусты. Раньше «мастерская» была участком пустой
     обочины — ребёнок не понимал, куда приехал. */
  /* Мастер стоял на W*0.74+96*S — ровно внутри полосы, где лежат колёса
     (W*0.70 ± 262*S при четырёх), и они рисуются позже, поэтому его было не видно.
     Разводим по-честному: колёса в середине, мастерская и мастер — у правого края. */
  var shx = Math.min(W * 0.86, W - 130 * S), shb = roadTop() + 4 * S;
  repairShed(shx, shb, 190 * S);
  spr('bush', shx - 150 * S, shb + 2 * S, 62 * S, withMove('bush', 3, 62 * S, {}));
  var mx = Math.min(W * 0.90, W - 74 * S);
  ground(mx, GY + 2 * S, 34 * S);
  spr('master', mx, GY + 4 * S, 168 * S, { rot: Math.sin(T * 1.5) * 0.025 });

  g.save();
  g.globalAlpha = 0.4; g.fillStyle = shColor();
  g.beginPath(); g.ellipse(cx, GY + 10 * S, vehW(car.id, hh) * 0.42, 14 * S, 0, 0, TAU); g.fill();
  g.restore();

  /* Считаем колёса, которые ЕЩЁ НЕ ДОЕХАЛИ до машины, а не произнесённые слова:
     раньше кузов отращивал колесо в момент ответа, за полсекунды до посадки колеса. */
  var missing = 0;
  rep.wheels.forEach(function (w) { if (!w.gone) missing++; });
  noWheels = missing > 0; missWheels = missing;
  drawVehicle(car.id, cx, GY + (noWheels ? 10 * S : 0), hh, { rot: noWheels ? -0.03 : 0 });
  noWheels = false;

  rep.wheels.forEach(function (w) {
    if (w.gone) return;
    var sz = 118 * S, wx = W * 0.56 + w.dx, wy = GY + 4 * S - sz * 0.5 - w.y, rot = w.rot;   // сдвинуты левее: раньше крайнее колесо закрывало мастера
    if (w.fly > 0) {
      var k = clamp(w.fly, 0, 1);
      wx = lerp(wx, cx + vehW(car.id, hh) * 0.1, k);
      wy = lerp(wy, GY - hh * 0.3, k);
      sz = lerp(sz, 70 * S, k); rot = w.fly * 9;
    } else {
      g.save(); g.globalAlpha = 0.25; g.fillStyle = shColor();
      g.beginPath(); g.ellipse(wx, GY + 12 * S, sz * 0.4, 9 * S, 0, 0, TAU); g.fill(); g.restore();
    }
    spr('wheel', wx, wy, sz, { rot: rot, mid: true });
  });

  drawParts(false);

  /* На уроке эту сцену рисует drawLesson внутри камеры с наплывом: подписи мастерской
     растягивались вместе с камерой и наезжали на слово урока. Тексты — только в мастерской. */
  if (state === 'lesson') return;

  if (rep.phase === 'intro') {
    outText('ОЙ! МАШИНКА СЛОМАЛАСЬ!', W / 2, 80 * S, 48 * S, '#fff', '#c0392b');
    outText('колёса упали…', W / 2, 140 * S, 28 * S, '#ffd93d', '#7a4b00');
  } else if (rep.phase === 'ask') {
    outText('СКОЛЬКО КОЛЁС НАДО ПОЧИНИТЬ?', W / 2, 80 * S, 42 * S, '#fff', '#2b6cb0');
    if (Voice.on && Mic.ready())
      /* Колёса лежат справа (W*0.70 ± 262*S) — пузырь по центру ложился прямо на них,
         и ребёнок считал сквозь него. Уводим влево, но не за кромку экрана. */
      drawMicBubble(Math.max(Math.min(W * 0.8, 360 * S) / 2 + 12 * S, W * 0.26), 190 * S,
                    rep.listening ? '🎤 ГОВОРИ!' : 'СЕЙЧАС СПРОШУ…',
                    'СКОЛЬКО?', rep.listening);
    else
      outText(KEYW('ОТВЕТИТЬ'), W / 2, 160 * S, 30 * S, '#fff', '#e0691f');
  } else if (rep.phase === 'answer') {
    var k = 1 + rep.numT * 0.35;
    outText('ПРАВИЛЬНО!', W / 2, 76 * S, 40 * S, '#fff', '#2f9e50');
    outText(String(rep.n), W / 2, 176 * S, 110 * S * k, '#ffd93d', '#7a4b00');
    outText(wheelsWord(rep.n).toUpperCase(), W / 2, 250 * S, 34 * S, '#fff', '#2b6cb0');
  } else if (rep.phase === 'fix') {
    outText('СТАВИМ КОЛЁСА!', W / 2, 76 * S, 44 * S, '#fff', '#2b6cb0');
    if (rep.echoPhase)
      drawMicBubble(W / 2, 320 * S,
                    rep.echoPhase === 'listen' ? '🎤 ГОВОРИ!' : Mic.ready() ? 'СЛУШАЙ…' : 'ВКЛЮЧАЮ МИКРОФОН…',
                    (rep.echoWord || '').toUpperCase(), rep.echoPhase === 'listen');
    /* Было «2 / 4» — дробь. Ребёнок 2–4 лет не читает и дробей не знает: показываем
       ряд колёс, поставленные яркие, оставшиеся полупрозрачные. */
    var iw2 = 52 * S, ix0 = W / 2 - (rep.n - 1) * iw2 * 0.5;
    for (var wi = 0; wi < rep.n; wi++) {
      g.save();
      g.globalAlpha = wi < rep.fixed ? 1 : 0.28;
      var wp = (wi === rep.fixed - 1) ? 1 + rep.numT * 0.45 : 1;
      spr('wheel', ix0 + wi * iw2, 168 * S + 22 * S, 46 * S * wp, {});
      g.restore();
    }
    g.save(); g.globalAlpha = 0.5 + Math.sin(T * 5) * 0.5;
    outText(TOUCH ? 'НАЖИМАЙ КНОПКУ!' : 'НАЖИМАЙ ПРОБЕЛ!', W / 2, 236 * S, 30 * S, '#fff', '#e0691f');
    g.restore();
  } else {
    outText('МОЛОДЕЦ! ПОЧИНИЛИ!', W / 2, 84 * S, 54 * S, '#fff', '#ff8f1f');
    outText('+5 ⭐', W / 2, 156 * S, 40 * S, '#ffd93d', '#7a4b00');
  }
}


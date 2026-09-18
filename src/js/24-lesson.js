/* ═══════════════ 17bc. УРОК СЛОВА ═══════════════
   Игра замирает, диктор просит сказать новое слово три раза — и оно
   становится живой командой.                                            */
var REPS = 2;                                   // обычное слово — два повтора
var REPS_CMD = 3;                               // командное слово — три, чтобы точнее узнавалось
function repsFor(key) { var L = LESSONS[key]; return (L && L.reps) || REPS; }
var les = { key: '', got: 0, said: 0, phase: '', t: 0, obj: null, from: 'play' };   // said — попытки, где ребёнок что-то сказал

function toLesson(key, obj) {
  EV('lesson', key); les.from = state; state = 'lesson'; les.key = key; les.got = 0; les.said = 0; les.phase = 'ask'; les.t = 0; les.obj = obj || null;
  var f = lessonFocus(key);
  camTo(f[0], f[1], key === 'one' || key === 'two' || key === 'three' ? 1.5 : key === 'el_robot' ? 1.35 : 1.8);   // робот и так у левого края — сильный зум выносит его за кадр
  Mic.disarm(); Mic.cancel();
  A.engine(0, 1, false);
  A.clunk();
  var LA = LESSONS[key];
  A.say(LA.keySay && !TOUCH ? [LA.ask, LA.keySay] : LA.ask);   // «нажми пробел» на планшете — совет в пустоту
  setPad();
}

function lessonHeard(sample) {
  if (state !== 'lesson' || les.phase !== 'listen') return;
  if (sample) { les.said++; Voice.add(cmdKey(les.key), sample); lessonStep(true); }
  else lessonStep(false);            // промолчал — не застреваем, идём дальше
}

function lessonStep(good) {
  les.got++; les.phase = 'good'; les.t = 0; les.ok = !!good;
  if (good) {
    A.coin(les.got * 3);
    for (var i = 0; i < 20; i++)
      /* Частицы живут в мировых координатах (y вверх от GY), а сцену урока камера
         поднимает к H*0.44 — искры улетали к верхней кромке мимо предмета. */
      P({ x: W / 2 + rnd(-160, 160) * S, y: GY - H * 0.44 + rnd(-40, 40) * S, vx: rnd(-140, 140) * S,
          vy: rnd(60, 260) * S, r: rnd(6, 14) * S, c: pick(['#ffd93d', '#fff', '#7bd66b']),
          kind: 'spark', life: rnd(0.5, 1.0), ay: 300 * S, vr: rnd(-8, 8) });
  }
  if (les.got >= repsFor(les.key)) {
    var L2 = LESSONS[les.key];
    /* «Ты выучил слово» — только тому, кто это слово произнёс. Молчуну игра
       не врёт: повторяет подсказку и позже предложит слово снова. */
    if (les.said) A.say(L2.tip ? ['Молодец! Ты выучил слово ' + L2.say + '!', L2.tip]
                               : 'Молодец! Ты выучил слово ' + L2.say + '!');
    else if (L2.tip) A.say(L2.tip);
  }
  else A.say(good ? [pick(JUMP_PRAISE), les.got === 1 ? 'Ещё раз!' : 'И ещё разок!']
                  : (les.got === 1 ? 'Ещё раз!' : 'И ещё разок!'));
}

function updateLesson(dt) {
  les.t += dt;
  camStep(dt);
  for (var i = 0; i < objs.length; i++) objs[i].ph = (objs[i].ph || 0) + dt * 0.7;   // мир чуть дышит
  if (les.phase === 'ask') {
    if (les.t > 0.15 && !A.talking()) {
      les.phase = 'listen'; les.t = 0; les.hint = 0;
      if (Mic.ready()) {
        /* Вторая попытка — по счёту повторов, а не по числу удачных: у застенчивого
           ребёнка первая попытка часто пустая, и запись не сохранялась вовсе.
           Пустую попытку выбросит сам recDone(!!sample). */
        if (les.got === 1) Mic.record({ word: LESSONS[les.key].word, key: les.key });
        Mic.listen(7, lessonHeard);
      }
    }
  } else if (les.phase === 'listen') {
    /* Молчание до 20 секунд без единого слова — ребёнок решает, что игра зависла.
       Один раз за попытку переспрашиваем; таймер слушания при этом не тратится
       (Mic.step замораживает его, пока диктор говорит). */
    if (!les.hint && les.t > 3.5 && !A.talking() && Mic.ready() && Voice.on) { les.hint = 1; A.say(LESSONS[les.key].ask); }
    if ((!Mic.ready() || !Voice.on) && les.t > 1.0) lessonStep(false);   // микрофон выключили посреди урока — не ждём вечно
  } else if (les.phase === 'good') {
    if (les.t > (les.got >= repsFor(les.key) ? 1.6 : 0.35) && !A.talking()) {
      if (les.got >= repsFor(les.key)) applyLesson();
      else { les.phase = 'ask'; les.t = 1.6; }
    }
  }
}

/* Слово выучено — происходит обещанное чудо (у каждого урока своё). */
function applyLesson() {
  var key = les.key, L = LESSONS[key];
  learned[key] = true; lastWord = L.word;
  if (les.said) Stats.bump(L.word);   // в родительской панели — только реально сказанные слова
  /* Обещание игры — «сказал слово, и что-то произошло». У 52 предметных уроков своего
     чуда нет, поэтому отдача общая и на языке, который ребёнок уже понимает: звёзды. */
  if (les.said) {
    stars += 2; bumpRow(); A.coin(6);
    popText(L.word + '!', carX + 200 * S, 240 * S, '#ffd93d');
    burst((les.obj && les.obj.x != null) ? les.obj.x : carX, 120 * S, 22, ['#ffd93d', '#fff', '#7bd66b'], 300 * S, 'spark');
  }
  wordArmed = false; rollWord(); EV('learned', key);   // следующее слово — через wordMin..wordMax c езды
  flash = 0.12;                                   // полноэкранная вспышка для 2–4 лет запрещена: оставляем еле заметный отблеск
  A.fanfare(stars);
  if (les.from === 'lane') { state = 'lane'; setPad(); return; }   // «чудо» урока к «рулю» не относится
  if (L.after) L.after();
  else { state = 'play'; armCommands(); }
  setPad();
}

function finishLine() { objs.push({ t: 'arch', x: carX + 2200 * S, h: 340 * S, used: false }); }   // тот же размер, что у радуги-ворот: было 260*S
function resumeRun() { state = 'play'; A.say('Поехали!'); armCommands(); setPad(); }

LESSONS.jump.after = function () {
  state = 'play';
  spd = Math.max(spd, 620 * S); autoJump = true;
  A.rev();
  popText('ПРЫЖОК!', carX, carY + car.h * S, '#ffd93d');
  finishLine(); armCommands();
};

LESSONS.light.after = function () {
  state = 'play'; lights = true; A.honk();
  popText('ФАРА!', carX, carY + car.h * S, '#ffd93d');
  finishLine(); armCommands();
};

LESSONS.fuel.after = function () {
  state = 'play';
  if (story && curStage().t === 'fuelrun') {
    stageSub = 3;
    objs.push({ t: 'fuel', x: carX + 760 * S, y: 58 * S, ph: 0 });
    toAsk({ q: 'ЭТО БЕНЗИН! СОБЕРЁМ ЕГО?', bg: 'play', silent: 'yes',
            say: 'Урааа! Это бензин! Давай его соберём. Готов?',
            yes: resumeRun, no: resumeRun });
    return;
  }
  fuel = 1; outOfFuel = false; emptyShown = false; spd = CRUISE * 0.7;
  A.fuelUp();
  burst(carX, carY + car.h * S * 0.5, 26, ['#ff4d4d', '#ffd93d', '#fff'], 320 * S, 'spark');
  finishLine(); armCommands();
};

LESSONS.one.after = function () {
  state = 'repair'; rep.phase = 'fix'; rep.t = 0;
  A.say('А теперь нажимай пробел — ставим колёса!');
};
LESSONS.two.after = LESSONS.one.after;
LESSONS.three.after = LESSONS.one.after;

LESSONS.black.after = function () { doPaint(); };
LESSONS.red.after = LESSONS.black.after;

LESSONS.stop.after = function () {
  state = 'play'; spd = 0; stopHold = 2.6;
  A.clunk(); popText('СТОП!', carX, carY + car.h * S, '#ff4d4d');
  A.say('Стоп! Машинка остановилась. Ждём зелёный!');
};

LESSONS.beep.after = function () {
  state = 'play';
  A.honk();
  var sh = findObj('sheep'); if (sh) sh.run = 1;
  popText('БИ-БИ!', carX, carY + car.h * S, '#ffd93d');
  A.say('Би-би! Овечка ушла с дороги. Спасибо!');
  finishLine(); armCommands();
};

LESSONS.gas.after = function () {
  state = 'play';
  robot.flee = true;
  spd = Math.max(spd, VMAX * 0.95);
  A.rev(); popText('ГАЗ!', carX, carY + car.h * S, '#ffd93d');
  A.say('Газ! Ура, мы убежали от робота!');
  finishLine(); armCommands();
};

LESSONS.water.after = function () { doWash(); };

/* Клавиша нарисована, а не подписана: ребёнок читать не умеет. */
function drawKeyHint(kind, cx, cy) {
  var kw = (kind === '⎵' ? 230 : 130) * S, kh = 96 * S;
  var x = cx - kw / 2, y = cy - kh / 2;
  g.save();
  g.globalAlpha = 0.5 + Math.abs(Math.sin(T * 3)) * 0.5;      // «нажимай сюда»
  g.fillStyle = '#ffd93d';
  roundRect(x - 9 * S, y - 9 * S, kw + 18 * S, kh + 18 * S, 26 * S); g.fill();
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(0,0,0,.28)'; roundRect(x + 5 * S, y + 9 * S, kw, kh, 18 * S); g.fill();
  var kg = g.createLinearGradient(0, y, 0, y + kh);
  kg.addColorStop(0, '#ffffff'); kg.addColorStop(1, '#d7e0ec');
  g.fillStyle = kg; roundRect(x, y, kw, kh, 18 * S); g.fill();
  g.lineWidth = 5 * S; g.strokeStyle = '#2b2140'; roundRect(x, y, kw, kh, 18 * S); g.stroke();
  if (kind === '⎵') {                                        // пробел — длинная планка
    g.fillStyle = '#2b2140';
    roundRect(cx - kw * 0.34, cy - 7 * S, kw * 0.68, 14 * S, 7 * S); g.fill();
  } else {                                                    // стрелка вправо
    g.fillStyle = '#2b2140';
    g.beginPath();
    g.moveTo(cx - 20 * S, cy - 26 * S); g.lineTo(cx + 26 * S, cy); g.lineTo(cx - 20 * S, cy + 26 * S);
    g.closePath(); g.fill();
  }
  g.restore();
}

function drawLesson() {
  var L = LESSONS[les.key], bg = les.from === 'lane' ? 'lane' : L.bg;
  withCam(function () {
    if (bg === 'lane') Lane.scene();
    else if (bg === 'repair') drawRepair();
    else if (bg === 'paint') drawPaintScene();
    else if (bg === 'wash') drawWashScene();
    else drawPlayScene();
    // круг внимания вокруг предмета разговора; на уроках клавиш предмета нет — круг обводил бы воздух
    if (!L.key) {
      g.save();
      g.globalAlpha = 0.35 + Math.abs(Math.sin(cam.t * 2.2)) * 0.35;
      g.strokeStyle = '#ffd93d'; g.lineWidth = 6 / cam.z;
      g.beginPath(); g.arc(cam.fx, cam.fy, (110 + Math.sin(cam.t * 2.2) * 10) * S / cam.z, 0, TAU); g.stroke();
      g.restore();
    }
  });
  spotlight(clamp(cam.t * 2.2, 0, 1));   // виньетка набирается за ~0,45 с, а не включается рывком

  /* У большинства уроков есть собственный нарисованный спрайт предмета — он и должен
     стоять в заголовке. Эмодзи остаётся откатом: spr возвращает 0, если картинки нет. */
  var sn = les.key.indexOf('el_') === 0 ? les.key.slice(3) : '';
  var sw = sn ? spr(sn, W / 2 - (L.word.length * 22 + 60) * S, H * 0.19 + 34 * S, 76 * S) : 0;
  outText(sw > 0 ? L.word : L.icon + '  ' + L.word + '  ' + L.icon, W / 2, H * 0.19, 78 * S, '#ffd93d', '#7a4b00');

  if (L.key) drawKeyHint(L.key, W * 0.82, H * 0.40);   // кнопка картинкой, в стороне от машинки

  drawMicBubble(W / 2, H * 0.79,
    les.phase === 'listen' ? '🎤 ГОВОРИ!' : les.phase === 'good' ? (les.ok ? 'МОЛОДЕЦ!' : 'СЛУШАЙ…') : 'СЛУШАЙ…',
    L.key ? '' : L.word, les.phase === 'listen');   // на уроках клавиш слово уже крупно стоит сверху

  var need = repsFor(les.key);
  for (var i = 0; i < need; i++) {
    /* Ряд «сколько раз ещё сказать» стоял под HTML-кнопкой «▶ СКАЗАЛ» и микрофонным пузырём —
       единственный индикатор прогресса урока ребёнок просто не видел. Поднимаем над пузырём. */
    var x = W / 2 + (i - (need - 1) / 2) * 62 * S, y = H * 0.79 - 82 * S;
    g.save();
    g.fillStyle = i < les.got ? '#4ade80' : 'rgba(255,255,255,.45)';
    g.beginPath(); g.arc(x, y, 24 * S, 0, TAU); g.fill();
    g.lineWidth = 4 * S; g.strokeStyle = '#fff'; g.stroke();
    g.restore();
  }
  drawParts(false);
}


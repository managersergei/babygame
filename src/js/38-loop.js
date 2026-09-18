/* ═══════════════ 20. ГЛАВНЫЙ ЦИКЛ ═══════════════ */
var last = 0;

/* Шаг симуляции фиксирован. Раньше в updatePlay и Lane.update уходил сырой dt кадра,
   поэтому на слабом телефоне машинка вела себя иначе, чем на быстром, и повторить
   прогон было нельзя — половина ощущения «физика ненастоящая» отсюда.
   1/120, а не 1/60: при экране 60 Гц на кадр приходится ровно два шага, и симуляция
   не дёргается между «ноль шагов» и «два». Рисуем по-прежнему как успевает железо. */
var SIM = CFG.reg('SIM', { hz: 120 }, { hz: [30, 240, 10, 'шагов физики в секунду'] });
var SIM_STEP = 1 / SIM.hz;
var SIM_MAXF = 1800;                 // потолок шагов за кадр: и защита от «спирали смерти», и запас для ?fast=300
var simAcc = 0;

var FAST = Math.min(300, +((location.search.match(/[?&]fast=(\d+)/) || [])[1]) || 1);
var TRACE = [];

function stepState(dt) {
  if (state === 'name') updateName(dt);
  else if (state === 'ask') updateAsk(dt);
  else if (state === 'paint') updatePaint(dt);
  else if (state === 'result') updateResult(dt);
  else if (state === 'intro') updateIntro(dt);
  else if (state === 'over') updateOver(dt);
  else if (state === 'crash') updateCrash(dt);
  else if (state === 'wash') updateWash(dt);
  else if (state === 'lesson') updateLesson(dt);
  else if (state === 'repair') updateRepair(dt);
  else if (state === 'lane') Lane.update(dt);
  else if (state === 'play') updatePlay(dt);
  updateParts(dt);
}

/* Автоигра для записи роликов (?rec=1&auto=1): жмёт «пробел», когда диктор замолчал,
   «говорит» слово на уроке и прыгает через ямы. */
var autoWait = 0, autoState = '';
function autoStep(dt) {
  if (state !== autoState) { autoState = state; autoWait = 0; }
  autoWait += dt;
  if (state === 'play') {
    if (!grounded) return;
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i];
      if ((o.t === 'pit' || o.t === 'mon' || o.t === 'ball') && o.x > carX && o.x - carX < 240 * S) { EV('auto', 'jump ' + o.t); action(); break; }
    }
    return;
  }
  if (state === 'lane') { Lane.auto(); return; }
  if (state === 'load' || state === 'garage' || state === 'gamemode' || state === 'mode') return;
  if (A.talking()) { autoWait = 0; return; }
  if (state === 'lesson') {
    if (les.phase !== 'good' && autoWait > 0.9) { autoWait = 0; EV('auto', 'word'); lessonStep(true); }
    return;
  }
  if (autoWait > 1.1) { autoWait = 0; EV('auto', 'space ' + state); keyDown('space'); }
}

function frame(ts) {
  requestAnimationFrame(frame);
  var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
  last = ts; T += dt;
  perfStep(dt);                                    // на слабом устройстве опускаем плотность пикселей
  if (state === 'load') return;
  if (state !== 'play') {                          // эффекты гаснут на любом экране
    if (shake > 0) shake = Math.max(0, shake - dt * 30 * S);
    if (flash > 0) flash = Math.max(0, flash - dt * 1.6);
    if (celebrate > 0) celebrate = Math.max(0, celebrate - dt);
  }
  themeStep(dt);                                   // палитра доезжает до новой локации
  Mic.poll(dt);
  var sp = A.talking();                              // уступаем диктору место в миксе
  if (sp !== A.sayDuck) A.duck(sp, 'say');
  if (AUTO) autoStep(dt);

  if (state !== 'play' && state !== 'lane' && state !== 'lesson' && (K.left || K.right)) {
    repeatT -= dt;
    if (repeatT <= 0) { moveSel(K.left ? -1 : 1); repeatT = 0.28; }
  }

  if (state !== 'garage' && state !== 'mode' && state !== 'gamemode') {
    /* ?fast=N ускоряет игровое время в N раз — накапливаем столько же, сколько
       накручивал прежний цикл из N вызовов, но выдаём симуляции ровными шагами. */
    SIM_STEP = 1 / SIM.hz;                    // админка могла поменять частоту прямо сейчас
    simAcc = Math.min(simAcc + dt * FAST, SIM_MAXF * SIM_STEP);
    while (simAcc >= SIM_STEP) {
      simAcc -= SIM_STEP;
      var was = state, wasStage = stage;
      stepState(SIM_STEP);
      if (state !== was || stage !== wasStage) {
        if (DBG) { TRACE.push(state + (state === 'play' ? '#' + stage : '')); if (TRACE.length > 9) TRACE.shift(); }
        simAcc = 0;                           // экран сменился — не проскакиваем
        break;
      }
    }
  } else simAcc = 0;                          // в меню симуляция стоит: иначе вход в игру начнётся рывком

  g.fillStyle = TH().sky[1];                                 // фон-подложка: без неё видны хвосты кадра
  g.fillRect(0, 0, W, H);

  /* Переход между экранами. Раньше гараж, выбор режима и игра просто подменялись
     в один кадр — ребёнок не успевал понять, что произошло. Полноэкранная вспышка
     возрасту запрещена, поэтому новый экран мягко наплывает: 0,26 с от 0,97 до 1
     по масштабу и от 0,35 до 1 по прозрачности. */
  if (state !== trState) { trState = state; trT = 0.26; }
  if (trT > 0) trT = Math.max(0, trT - dt);
  var trK = trT > 0 ? 1 - trT / 0.26 : 1;

  g.save();
  if (trK < 1) {
    g.globalAlpha = 0.35 + 0.65 * trK;
    var tz = 0.97 + 0.03 * trK;
    g.translate(W / 2, H / 2); g.scale(tz, tz); g.translate(-W / 2, -H / 2);
  }
  if (shake > 0) {
    /* Сдвиг сцены открывал по краям подложку — плоскую полосу неба. Масштаб на
       ту же величину закрывает кромку: 2*shake по каждой оси. */
    var sk = 1 + 2 * shake / Math.min(W, H);
    g.translate(W / 2, H / 2); g.scale(sk, sk); g.translate(-W / 2, -H / 2);
    g.translate(rnd(-shake, shake), rnd(-shake, shake));
  }

  if (state === 'garage') {
    drawGarage(dt);
  } else if (state === 'gamemode') {
    drawGameMode(dt);
  } else if (state === 'mode') {
    drawMode(dt);
  } else if (state === 'name') {
    drawName();
  } else if (state === 'ask') {
    drawAsk();
  } else if (state === 'paint') {
    drawPaint();
  } else if (state === 'crash') {
    drawCrash();
  } else if (state === 'over') {
    drawOver();
  } else if (state === 'intro') {
    drawIntro();
  } else if (state === 'result') {
    drawResult();
  } else if (state === 'wash') {
    drawWash();
  } else if (state === 'lesson') {
    drawLesson();
  } else if (state === 'lane') {
    Lane.draw(dt);
  } else if (state === 'repair') {
    drawRepair();
  } else {
    drawPlayScene();
    drawHUD();
    if (emptyShown) drawEmptyScreen();
  }

  if (DBG) {
    g.save();
    g.font = '600 15px monospace'; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(8, H - 152, 520, 144);
    g.fillStyle = '#7bff9b';
    ['T=' + T.toFixed(1) + ' state=' + state + ' stage=' + stage,
     'fuel=' + fuel.toFixed(2) + ' out=' + outOfFuel + ' night=' + night.toFixed(1) + ' lit=' + lights,
     'spd=' + spd.toFixed(0) + ' carX=' + carX.toFixed(0) + ' objs=' + objs.length,
     'les=' + les.phase + ' got=' + les.got + ' key=' + les.key + ' fired=' + stageFired,
     'nm=' + nm.phase + '/' + nm.got + ' rep=' + rep.phase,
     'MIC on=' + Voice.on + ' ready=' + Mic.ready() + ' denied=' + Mic.denied() +
       ' perm=' + Mic.dbg().perm + ' попыток=' + Mic.dbg().tries,
     '    ctx=' + Mic.dbg().ctx + ' err=' + (Mic.dbg().err || '-'),
     '    вход=' + Mic.dbg().dev.slice(0, 30) + '  всего входов: ' + Mic.dbg().devs,
     '    listen=' + Mic.busy() + ' lvl=' + Mic.dbg().lvl.toFixed(1) +
       ' floor=' + Mic.dbg().floor.toFixed(1) + ' th=' + Mic.dbg().th.toFixed(1),
     'stars=' + stars + ' learned=' + Object.keys(learned).join(','),
     '» ' + TRACE.join(' → ')
    ].forEach(function (l, i) { g.fillText(l, 16, H - 146 + i * 20); });
    g.restore();
  }
  g.restore();

  /* Полноэкранная белая заливка до 0,75 — прямой запрет для 2–4 лет: вестибулярно и
     зрительно это удар. Заменено мягким тёплым свечением от центра события, вдвое слабее. */
  if (flash > 0) {
    var fa = clamp(flash * 0.8, 0, 0.34);
    var fx0 = flashX != null ? flashX : W / 2, fy0 = flashY != null ? flashY : GY - 60 * S;
    var gr = g.createRadialGradient(fx0, fy0, 0, fx0, fy0, Math.max(W, H) * 0.55);
    gr.addColorStop(0, 'rgba(255,250,224,' + fa.toFixed(3) + ')');
    gr.addColorStop(0.55, 'rgba(255,246,200,' + (fa * 0.45).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(255,240,180,0)');
    g.save(); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
  }
}

function ready() {
  if (state !== 'load') return;
  if (REC) {                                       // запись ролика: тихо, без кнопок, реплики — в лог
    document.getElementById('pad').style.display = 'none';
    document.getElementById('tools').style.display = 'none';
    Voice.setOn(false);
    A.music = function () {};
    var talkUntil = 0;
    A.say = function (text) {
      var t = Object.prototype.toString.call(text) === '[object Array]' ? text.join(' | ') : String(text);
      EV('say', JSON.stringify(t));
      talkUntil = T + 0.5 + t.replace(/\|/g, ' ').trim().split(/\s+/).length * 0.42;
    };
    A.talking = function () { return T < talkUntil; };
    A.hush = function () { talkUntil = 0; };
  } else {
    try { if (!localStorage.getItem('babygame.parent')) document.getElementById('parent').style.display = 'flex'; } catch (e) {}
    checkTurn();
    if (YM_ID) {
      (function (m, e, t, r, i, k, a) { m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
        k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
      })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
      window.ym(YM_ID, 'init', { clickmap: false, trackLinks: true, accurateTrackBounce: true });
    }
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
    TG.init();                                             // отчёты в Telegram (17e); без TG_BOT/TG_API — тихо выключено
  }
  var l = document.getElementById('loader');
  document.getElementById('loadTxt').textContent = 'Готово!';
  l.classList.add('hide');
  setTimeout(function () { l.style.display = 'none'; }, 600);
  try {
    var pk = JSON.parse(localStorage.getItem('babygame.pick') || 'null');
    if (pk) { sel = clamp(pk.c | 0, 0, CARS.length - 1);
              gmSel = pickIx(GAMEMODES, ALL_GAMEMODES, pk.g);      // id или старый индекс; скрытый → первый видимый
              modeSel = pickIx(MODES, ALL_MODES, pk.m); }
  } catch (e) {}
  fit(); tune(); toGarage();
  requestAnimationFrame(frame);

  // отладка: index.html?s=mode / ?s=play — сразу нужный экран
  var q = (location.search.match(/[?&]s=(\w+)/) || [])[1];
  var thq = (location.search.match(/[?&]th=(\d+)/) || [])[1];   // dev: посмотреть локацию
  if (thq) thForce = +thq;
  var sk = (location.search.match(/[?&]skin=(\w+)/) || [])[1];
  if (sk) { carPaint = sk === 'none' ? null : sk; }
  var dm = (location.search.match(/[?&]dmg=(\d)/) || [])[1];
  if (dm) damage = +dm;
  if (q === 'over') {
    car = CARS[sel]; tune(); resetWorld(); easy = true; story = false;
    stars = 63; score = 810; state = 'play'; gameOver('fuel');
  }
  else if (q === 'paint') {
    car = CARS[sel]; tune(); resetWorld(); easy = true; story = true; stage = 3; toPaintStage();
    if (/[?&]yes=1/.test(location.search)) ask.silent = 'yes';
  }
  else if (q === 'fuelrun') {
    car = CARS[sel]; tune(); resetWorld(); easy = true; story = true;
    stage = 2; voiceCtl = true; beginStage(); stageStart = carX - CAMPAIGN[2].dist * S;
  }
  else if (q === 'intro') {
    car = CARS[sel]; tune(); resetWorld(); easy = true; story = true; voiceCtl = true;
    stage = +((location.search.match(/[?&]st=(\d+)/) || [])[1]) || 0;
    startStage();
  }
  else if (q === 'camp') {
    car = CARS[sel]; tune(); resetWorld(); easy = true; story = true;
    learned = {}; stage = +((location.search.match(/[?&]st=(\d+)/) || [])[1]) || 0;
    voiceCtl = true; beginStage();
    if (/[?&]arch=1/.test(location.search)) objs.push({ t: 'arch', x: carX + 700 * S, h: 340 * S, used: false });
  }
  else if (q === 'name' || q === 'lesson') {
    car = CARS[sel]; tune(); resetWorld(); easy = true; story = true;
    if (q === 'name') toName();
    else { state = 'play'; toLesson((location.search.match(/[?&]w=(\w+)/) || [])[1] || 'jump'); }
  }
  else if (q === 'repair') {
    car = CARS[sel]; tune(); resetWorld(); easy = true; toRepair();
    var ph = (location.search.match(/[?&]ph=(\w+)/) || [])[1];
    if (ph) { rep.phase = ph; rep.t = 0; if (ph === 'fix' || ph === 'done') rep.fixed = ph === 'done' ? rep.n : 1;
              rep.wheels.forEach(function (w, i) { w.y = 0; w.vy = 0; if (ph === 'done') w.gone = true;
                                                  else if (ph === 'fix' && i === 0) w.gone = true; }); }
  }
  else if (q === 'endless') {                     // dev: сразу катимся, без сюжета и голоса
    car = CARS[sel]; tune(); resetWorld(); easy = true; story = false; voiceCtl = false;
    stars = +((location.search.match(/[?&]st=(\d+)/) || [])[1]) || 30;
    state = 'play';
    if (/[?&]rail=1/.test(location.search)) objs.push({ t: 'rail', x: carX + 900 * S });
  }
  else if (q === 'mode') toMode();
  else if (q === 'lane') { car = CARS[sel]; Lane.start(); }
  else if (q === 'play' || q === 'empty') {
    car = CARS[sel]; startGame();
    if (q === 'empty') { fuel = 0.0001; spd = 0; }
  }
}
fit();
setTimeout(function () { if (state === 'load') ready(); }, 8000);   // подстраховка

  if (DBG || REC || /[?&]test=1/.test(location.search)) {
    window.__cfg = CFG;                                          // тест: настройки и админка
    window.__sim = function () { return { hz: SIM.hz, step: SIM_STEP, acc: simAcc, cruise: CRUISE, phys: PHYS.cruise }; };   // тест: фиксированный шаг
    window.__roll = function () { toRepair(); return rep.n; };   // тест: серия случайных поломок
    window.__stats = Stats;                                      // тест: прогресс и повторение слов
    window.__move = moveFx;                                      // тест: параметры процедурной анимации
    window.__put = function (o) { objs.push(o); return objs.length; };   // тест: положить объект прямо перед машинкой
    window.__car = function () { return { x: carX, y: carY, w: vehW(car.id, car.h * S), S: S }; };
    /* Тест: режим «руль» изнутри. quiet() глушит очередь слов — иначе урок,
       начавшийся посреди проверки, останавливает Lane.update, и объект «зависает». */
    window.__th = function () { return { ix: themeIx, from: themeFrom, k: +themeK.toFixed(3), sky: TH().sky.slice(), grass: TH().grass, set: setTheme }; };   // тест: смена палитры
    window.__lane = function () {
      return { ln: ln, LN: LN, proj: laneProj, push: Lane.push, kinds: LANE_KINDS,
               quiet: function () { wantEl = null; wordArmed = false; wordT = -1e9; } };
    };
    window.__bg = function () {
      var n = 0; for (var k in IMG) if (ok(IMG[k])) n++;
      return { state: state, stage: stage, stars: stars, objs: objs.length, imgs: n, lane: Lane.dbg(), talking: A.talking(), voice: Voice.on,
               gm: gmSel, gmId: (GAMEMODES[gmSel] || {}).id, ctl: (MODES[modeSel] || {}).id, voiceCtl: voiceCtl, story: story,
               pult: +Pult.steer.toFixed(2), pultFresh: Pult.fresh(), pultOn: Pult.on,
               micSrc: Mic.src(), micReady: Mic.ready(),
               tg: TG.dbg(), T: +T.toFixed(1), known: Stats.list().filter(function (r) { return r.n >= Stats.need; }).length,
               said: les.said, recs: Rec.count(), rec: Mic.recording(),
               word: { t: +wordT.toFixed(1), due: +wordDue.toFixed(1), want: wantEl, armed: wordArmed, next: nextLessonKey(), met: Object.keys(metEl).length },
               chase: { on: robot.on, flee: robot.flee, n: chaseN, t: +robotT.toFixed(1), due: +robotDue.toFixed(1) },
               mons: objs.filter(function (o) { return o.t === 'mon'; }).length,
               S: S, spd: Math.round(spd / S), damage: damage, breakN: breakN,
               tilt: +tilt.toFixed(4), gh: Math.round(groundProbe(carX, carY) / S), grounded: grounded,   // тест: честный наклон по уклону
               wheelA: +wheelA.toFixed(3), carXw: Math.round(carX / S),   // тест: вращение колеса
               rigW: car ? Math.round(vehW(car.id, car.h * S) / S) : 0,
               rigOn: !!(car && car.rig && rigSize(car, car.h * S)),   // машинка выбирается позже — до гаража car ещё null
               carY: Math.round(carY / S), best: best, total: total, tank: +tankMul.toFixed(2),
               fuelPicks: fuelPicks, overSel: over.sel,
               rep: { n: rep.n, fixed: rep.fixed, phase: rep.phase },
               rail: (function () {
                 for (var qi = 0; qi < objs.length; qi++) if (objs[qi].t === 'rail')
                   return { dx: Math.round((objs[qi].x - carX) / S), p: +(objs[qi].p || 0).toFixed(3), train: !!objs[qi].train,
                            lane: !!(objs[qi].train && trainOnLane(objs[qi])), over: !!objs[qi].over, cars: objs[qi].cars || 0 };
                 return null;
               })(),
               minGap: (function () {
                 var ox = [], mg = 1e9, qi;
                 for (qi = 0; qi < objs.length; qi++) if (/^(cone|puddle|ball|pit|rail)$/.test(objs[qi].t)) ox.push(objs[qi].x);
                 ox.sort(function (a, b) { return a - b; });
                 for (qi = 1; qi < ox.length; qi++) mg = Math.min(mg, ox[qi] - ox[qi - 1]);
                 return mg === 1e9 ? null : Math.round(mg / S);
               })() };
    };
  }
})();

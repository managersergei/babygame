/* ═══════════════ 17bd. СЦЕНАРИЙ ГОЛОСОВОГО РЕЖИМА ═══════════════ */
var story = false, voiceCtl = false, stage = 0, stageStart = 0, stageFired = false, learned = {}, pendingNext = false;
var idleN = 0;                                  // сколько раз за заезд уже подсказывали
var autoJump = false, stageSub = 0, subT = 0, stopHold = 0, idleT = 0, chaseT = 0, lastWasRamp = false, flipT = 0, runT = 0, skyT = 0, railT = 0, rocketT = 0;

function hurt(why) {                            // получили по кузову
  if (state !== 'play') return;
  damage++;
  shake = 2.5 * S; squash = 0.22; flash = 0.10; dmgT = 1.5;   // тряска кадра для 2–4 лет вредна: приседает сам кузов
  A.crunch();
  popText(['ОЙ!', 'АЙ!', 'БАМ!'][Math.min(2, damage - 1)], carX, carY + car.h * S, '#ff8f8f');
  for (var i = 0; i < 16; i++)
    P({ x: carX + rnd(-40, 40) * S, y: carY + rnd(20, 80) * S, vx: rnd(-260, 260) * S,
        vy: rnd(60, 260) * S, r: rnd(4, 11) * S, c: pick(['#9aa3b2', '#d8dee8', '#ffd93d']),
        kind: 'spark', life: rnd(0.3, 0.7) });
  if (damage >= TUNE.hits) toBreakdown();
}
var robot = { on: false, x: 0, flee: false };
var wsh = { phase: '', t: 0 }, carDirty = false, dirtA = 0;   // dirtA — остаток грязи, пока её смывают

/* ── мойка ── */
function toWashStage() {
  state = 'wash'; wsh.phase = 'intro'; wsh.t = 0; carDirty = true; dirtA = 1;
  parts.length = 0; Mic.disarm(); A.engine(0, 1, false);
  A.say('Ой, посмотри, машинка вся грязная! Мы приехали на мойку.');
  setPad();
}
function doWash() {
  state = 'wash'; wsh.phase = 'wash'; wsh.t = 0; carDirty = false; dirtA = 1;
  A.splash(); A.fanfare(stars);
  A.say('Вода! Ура, машинка чистая и блестит!');
  for (var i = 0; i < 60; i++)
    P({ x: W * 0.62 + rnd(-40, 40) * S, y: rnd(60, 260) * S, vx: rnd(-520, -120) * S, vy: rnd(-60, 220) * S,
        r: rnd(5, 13) * S, c: pick(['#4fc3f7', '#81d4fa', '#fff', '#29b6f6']), kind: 'drop', life: rnd(0.6, 1.3) });
  setPad();
}
function updateWash(dt) {
  wsh.t += dt;
  if (wsh.phase === 'intro') { if (wsh.t > 2.6 && !A.talking()) toLesson('water'); }
  else if (wsh.phase === 'wash') {
    dirtA = Math.max(0, dirtA - dt * 0.55);            // смывается за ~1,8 с, а не исчезает кадром
    if (RNG() < dt * 50)
      P({ x: (wsh.nx || W * 0.60) + rnd(-6, 6) * S, y: GY - (wsh.ny || GY - 160 * S) + rnd(-8, 8) * S,
          vx: rnd(-520, -260) * S, vy: rnd(-30, 90) * S,
          r: rnd(4, 11) * S, c: pick(['#4fc3f7', '#81d4fa', '#fff']), kind: 'drop', life: rnd(0.5, 1.0) });
    if (wsh.t > 4.0 && !A.talking()) nextStage();
  }
}
function drawDirt(cx, base, w, h) {
  /* dirtA — грязь уходит не мгновенно, а смывается за время мойки. И base сюда
     передаётся ВМЕСТЕ с покачиванием кузова, иначе пятна ползают по машинке. */
  var da = carDirty ? 1 : dirtA;
  if (da <= 0.01) return;
  g.save(); g.fillStyle = 'rgba(92,64,34,' + (0.5 * da).toFixed(3) + ')';
  for (var i = 0; i < 10; i++) {
    var a = ((i * 97) % 100) / 100, b = ((i * 53) % 100) / 100;
    g.beginPath();
    g.ellipse(cx - w * 0.42 + a * w * 0.84, base - h * 0.82 + b * h * 0.66,
              (7 + (i % 3) * 5) * S, (5 + (i % 2) * 4) * S, i, 0, TAU);
    g.fill();
  }
  g.restore();
}
function drawWashScene() {
  drawSky(); drawClouds(); drawFar(); drawRoad();
  var hh = car.h * S * 1.2, cx = W * 0.38;
  g.save(); g.globalAlpha = 0.35; g.fillStyle = shColor();
  g.beginPath(); g.ellipse(cx, GY + 10 * S, vehW(car.id, hh) * 0.42, 14 * S, 0, 0, TAU); g.fill();
  g.restore();
  var wbob = Math.sin(T * 2) * 5 * S;
  drawVehicle(car.id, cx, GY + wbob, hh, {});
  drawDirt(cx, GY + wbob, vehW(car.id, hh), hh);               // грязь качается вместе с кузовом

  /* Мойщик. Раньше это была ВТОРАЯ такая же машинка (когда игрок сам за пожарную),
     без тени и с размером, привязанным к росту игрока. Теперь размер свой, тень есть,
     а если игрок и есть пожарная — моет мастер из шланга. */
  var wx = W * 0.74, wsz = 150 * S, who = car.id === 'fire' ? 'master' : 'fire';
  ground(wx, GY + 4 * S, (who === 'fire' ? 60 : 34) * S);
  spr(who, wx, GY + 6 * S, who === 'fire' ? wsz : 170 * S, { rot: Math.sin(T * 1.6) * 0.02 });

  /* Шланг: вода должна выходить из сопла, а не из воздуха. */
  var nz = wx - (who === 'fire' ? wsz * 0.55 : 46 * S), ny = GY - (who === 'fire' ? 66 * S : 96 * S);
  g.save();
  g.strokeStyle = '#2f6f4f'; g.lineWidth = 7 * S; g.lineCap = 'round';
  g.beginPath(); g.moveTo(wx, GY - 24 * S);
  g.quadraticCurveTo(nz + 34 * S, GY - 12 * S, nz, ny); g.stroke();
  g.fillStyle = '#b0b8c4';
  roundRect(nz - 16 * S, ny - 7 * S, 22 * S, 14 * S, 6 * S); g.fill();
  g.restore();
  wsh.nx = nz - 14 * S; wsh.ny = ny;
}
function drawWash() {
  drawWashScene();
  drawParts(false);
  if (wsh.phase === 'intro') outText('ЕДЕМ НА МОЙКУ!', W / 2, 80 * S, 46 * S, '#fff', '#2b6cb0');
  else outText('ЧИСТАЯ МАШИНКА!', W / 2, 80 * S, 48 * S, '#fff', '#2f9e50');
}

/* ── робот-преследователь ── */
function drawRobot() {
  if (!robot.on) return;
  var sx = (robot.x - carX) + CARX;
  if (sx < -400 * S || sx > W + 400 * S) return;
  g.save(); g.globalAlpha = 0.32; g.fillStyle = shColor();
  g.beginPath(); g.ellipse(sx, GY + 8 * S, 84 * S, 15 * S, 0, 0, TAU); g.fill();
  g.restore();
  spr('robot', sx, GY + 6 * S + Math.abs(Math.sin(T * 8)) * 6 * S, 205 * S,
      { rot: Math.sin(T * 6) * 0.035 });
}
var night = 0, nightTo = 0, lights = false;   // nightTo — куда ведём: 1 темнеет, 0 светает

function curStage() { return CAMPAIGN[stage % CAMPAIGN.length]; }

/* Заставка перед этапом: понятно, что сейчас будет, и диктор это объясняет. */
var intro = { t: 0, icon: '', title: '', sub: '' };

function stageIntro(st) {
  var n = (stage % CAMPAIGN.length) + 1, L = st.lesson ? LESSONS[st.lesson] : null;
  if (!story) return { icon:'∞', title:'БЕСКОНЕЧНАЯ ПОЕЗДКА', sub:'катаемся и собираем звёздочки',
                       say:'Поехали кататься! Собирай звёздочки и жми пробел, чтобы прыгать!' };
  if (st.t === 'repair')  return { icon:'🔧', title:'МАСТЕРСКАЯ', sub:'чиним колёса',
      say:'А теперь заезжаем в мастерскую. У машинки отвалились колёса — будем чинить!' };
  if (st.t === 'paint')   return { icon:'🎨', title:'ПОКРАСОЧНАЯ', sub:'выбираем цвет',
      say:'Заезжаем в покрасочную! Сейчас нам предложат покрасить машинку.' };
  if (st.t === 'wash')    return { icon:'💧', title:'МОЙКА', sub:'моем машинку',
      say:'Едем на мойку! Машинка вся грязная, надо её помыть.' };
  if (st.t === 'chase')   return { icon:'🤖', title:'УРОВЕНЬ ' + n, sub:'убегаем от робота',
      say:'Это уровень ' + n + '. Сейчас за нами погонится злой робот, и мы выучим слово газ. Ты готов?' };
  if (st.t === 'fuelrun') return { icon:'⛽', title:'УРОВЕНЬ ' + n, sub:'ищем бензин',
      say:'Это уровень ' + n + '. Сейчас машина поедет, и мы выучим слово бензин. Ты готов?' };
  return { icon: L ? L.icon : '🏁', title:'УРОВЕНЬ ' + n,
           sub: L ? 'учим слово ' + L.word : 'поехали кататься',
           say:'Это уровень ' + n + '. Сейчас твоя машина поедет, и мы выучим слово ' +
               (L ? L.say : '') + '. Ты готов?' };
}

function startStage() {
  var st = story ? curStage() : {};
  var info = stageIntro(st);
  intro.t = 0; intro.icon = info.icon; intro.title = info.title; intro.sub = info.sub;
  state = 'intro';
  parts.length = 0; texts.length = 0;
  Mic.disarm(); A.engine(0, 1, false);
  A.whoosh(); A.say(info.say);
  setPad();
}

function updateIntro(dt) {
  intro.t += dt;
  if (intro.t > 2.6 && !A.talking()) beginStage();
}

function drawIntro() {
  drawSky(); drawClouds(); drawFar(); drawRoad(); drawProps();   // обочина не должна пустовать и на этом экране
  var k = clamp(intro.t / 4.5, 0, 1);
  drawVehicle(car.id, W * 0.12 + k * W * 0.76, GY + Math.sin(intro.t * 9) * 3 * S, car.h * S * 0.95, {});

  var e = 1 - Math.pow(1 - clamp(intro.t * 2.4, 0, 1), 3);          // выезд карточки
  var pw = Math.min(W * 0.74, 700 * S), ph = 230 * S;
  var px = W / 2 - pw / 2 + (1 - e) * W * 0.7, py = H * 0.2;
  g.save();
  g.globalAlpha = e;
  g.fillStyle = 'rgba(0,0,0,.25)'; roundRect(px + 7 * S, py + 11 * S, pw, ph, 32 * S); g.fill();
  g.fillStyle = 'rgba(255,255,255,.97)'; roundRect(px, py, pw, ph, 32 * S); g.fill();
  g.lineWidth = 8 * S; g.strokeStyle = '#ffb703'; roundRect(px, py, pw, ph, 32 * S); g.stroke();
  outText(intro.icon, px + 92 * S, py + ph / 2, 84 * S, '#e0691f', '#fff');
  outText(intro.title, px + 175 * S, py + 84 * S, 44 * S, '#2b6cb0', '#fff', 'left');
  outText(intro.sub, px + 175 * S, py + 146 * S, 26 * S, '#5a6472', '#fff', 'left');
  g.restore();

  g.save(); g.globalAlpha = 0.4 + Math.sin(T * 5) * 0.4;
  outText(KEYW('ПОЕХАЛИ!'), W / 2, py + ph + 70 * S, 32 * S, '#fff', '#e0691f');
  g.restore();
}

function beginStage() {
  if (!story) {                                   // бесконечный режим — просто едем
    state = 'play'; finishing = false; levelStars = stars; row = 0; runT = 0; resetRhythm();
    armCommands(); setPad();
    return;
  }
  var st = curStage();
  stageSub = 0; subT = 0; levelStars = stars; lastWord = ''; row = 0;
  setTheme(stage % THEMES.length);
  finishing = false;
  if (st.t === 'repair') { toRepair(); return; }
  if (st.t === 'paint') { toPaintStage(); return; }
  if (st.t === 'wash') { toWashStage(); return; }
  if (st.t === 'chase') { robot.on = true; robot.x = carX - 1900 * S; robot.flee = false; }
  state = 'play';
  stageStart = carX; stageFired = false;
  outOfFuel = false; emptyShown = false; fuel = 1;
  nightTo = 0; lights = false;    // светает плавно, а не в один кадр
  A.say('Поехали!');
  armCommands();
  setPad();
}

function nextStage() { stage++; startStage(); }

/* Ключ урока → команда. Одно слово учится в двух местах (сюжет и бесконечный), образцы лежат
   под разными ключами ('cmd.jump' и 'cmd.el_jump0') — перечисляем оба. */
var CMD_OF = { jump: 'jump', el_jump0: 'jump', gas: 'gas', el_gas0: 'gas', fuel: 'fuel', light: 'light' };
/* Ключ образца зависит от микрофона: телефонный тракт звучит иначе, и смешивать записи
   с двух микрофонов в одной корзине нельзя — распознавание начнёт путаться. */
function cmdKey(k) { return (Mic.src() === 'phone' ? 'cmd.p.' : 'cmd.') + k; }

/* Выученные слова становятся живыми командами — в том числе выученные в прошлые заходы.
   ВЫКЛЮЧЕНО 09.09.2026 по просьбе владельца: во время свободной езды микрофон не слушает
   вовсе, поэтому машинка не дёргается от громких звуков. Слова по-прежнему живут в уроках.
   Вернуть — поставить VOICE_CMD = true. */
var VOICE_CMD = false;
function armCommands() {
  if (!VOICE_CMD || !Voice.on || !Mic.ready()) return;
  Mic.arm(function (sample) {
    if (state !== 'play' || A.talking()) return;
    var words = [];
    for (var k in CMD_OF) if ((learned[k] || (LESSONS[k] && Stats.known(LESSONS[k].word))) && Voice.count(cmdKey(k)) >= 2) words.push(cmdKey(k));
    if (!words.length) return;
    var m = Voice.match(sample, words);
    if (!m || !m.ok) return;
    var key = CMD_OF[m.word.slice(4)];
    if (key === 'jump') { action(); popText('ПРЫЖОК!', carX, carY + car.h * S, '#ffd93d'); }
    else if (key === 'fuel') { fuel = Math.min(1, fuel + 0.5); A.fuelUp(); popText('БЕНЗИН!', carX, carY + car.h * S, '#7bd66b'); }
    else if (key === 'light') { lights = !lights; A.click(); }   // фары — щелчок переключателя, а не гудок
    else if (key === 'gas') { spd = Math.min(VMAX * 1.2, spd + 300 * S); A.rev(); popText('ГАЗ!', carX, carY + car.h * S, '#ffd93d'); }
  });
}

function updateStage(dt) {
  if (!story || state !== 'play') return;
  var st = curStage();

  if (st.t === 'fuelrun') {                       // «о неееет, заканчивается бензин…»
    if (stageSub === 0) {
      if (carX - stageStart > st.dist * S) {
        stageSub = 1; subT = 0; fuel = 0.12;
        A.say('О неееет! У нас заканчивается бензин, мы не сможем доехать… Нам нужен бензин!');
      }
    } else if (stageSub === 1) {
      subT += dt;
      if (subT > 3.6 && !A.talking()) { stageSub = 2; toLesson('fuel'); }
    }
    return;
  }

  if (st.t === 'chase') {
    if (!stageFired && !robot.flee && carX - robot.x < 440 * S) { stageFired = true; toLesson('gas'); }
    return;
  }
  if (stageFired || st.t !== 'drive') return;
  if (carX - stageStart < st.dist * S) return;
  stageFired = true;
  if (st.lesson === 'jump')       objs.push({ t:'pit',    x: carX + 620 * S, w: 185 * S, lesson:true, lessonKey:'jump' });
  else if (st.lesson === 'stop')  objs.push({ t:'tlight', x: carX + 700 * S, lesson:true, lessonKey:'stop', green:false, ph:0 });
  else if (st.lesson === 'beep')  objs.push({ t:'sheep',  x: carX + 700 * S, lesson:true, lessonKey:'beep', run:0, ph:0 });
  else if (st.lesson === 'light') { nightTo = 1; night = Math.max(night, 0.001); }
}


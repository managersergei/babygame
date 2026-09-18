/* ═══════════════ 7. МИР ═══════════════ */
function resetWorld() {
  objs.length = 0; parts.length = 0; texts.length = 0;
  carX = 0; carY = 0; vy = 0; spd = easy ? EASYSPD : CRUISE;
  grounded = true; jumps = 0; lastGroundH = 0; lastObsX = -1e9; breakN = 0; railT = 0;
  stars = 0; row = 0; combo = 0; nextX = W * 0.9; lastFuelX = 0; fuelPicks = 0; tankMul = 1; bestShown = 0; tune();
  archPending = false; celebrate = 0; flash = 0; shake = 0; idleT = 0; idleN = 0;
  fuel = 1; outOfFuel = false; emptyShown = false; beepT = 0; lowT = 0; refuels = 0;
}

function spawnFuel(x) {
  objs.push({ t:'fuel', x:x, y: 58 * S, ph: rnd(0, TAU) });
  lastFuelX = x;
}

function spawnAhead() {
  var guard = 0;
  while (nextX < carX + W * 1.5 && guard++ < 40) {
    var x = obsFrom(nextX), r = RNG();

    if (archPending) {
      objs.push({ t:'arch', x: x + 260 * S, h: 340 * S, used: false, gate: true });   // радуга-ворота: за ней новая локация
      nextX = x + 900 * S; archPending = false; continue;
    }
    // канистра обязательно появляется раз в ~1100 px пути
    if (x - lastFuelX > TUNE.fuelEvery * S || (!story && wantEl === 'fuel')) {
      spawnFuel(x);
      if (!story) markFirst(objs[objs.length - 1], 'fuel');
      nextX = x + rnd(560, 720) * S;
      continue;
    }

    if (!story) { nextX = spawnEndless(x); continue; }
    if (r < 0.12) {                                    // трамплин + дуга звёзд
      var rw = 132 * S, rh = 76 * S;
      objs.push({ t:'ramp', x:x, w:rw, h:rh });
      for (var i = 0; i < 5; i++) {
        var tt = i / 4;
        objs.push({ t:'star', x: x + rw * 1.05 + tt * 330 * S,
                    y: rh + 60 * S + Math.sin(tt * Math.PI) * 190 * S, ph: rnd(0, TAU) });
      }
      nextX = x + rnd(620, 780) * S;
    } else if (r < 0.26) {                             // шарики
      var n = ri(2, 4);
      for (var j = 0; j < n; j++)
        objs.push({ t:'balloon', x: x + j * 105 * S, y: rnd(150, 330) * S, ph: rnd(0, TAU) });
      nextX = x + rnd(420, 620) * S;
    } else if (r < 0.38) {                             // конусы
      var m = ri(1, 3);
      for (var k = 0; k < m; k++) objs.push({ t:'cone', x: obsMark(x + k * 440 * S), y:0, hit:false });
      nextX = lastObsX + rnd(430, 600) * S;
    } else if (r < 0.48) {                             // лужа
      objs.push({ t:'puddle', x: obsMark(x), w: rnd(80, 120) * S, done:false });
      nextX = lastObsX + rnd(430, 600) * S;
    } else if (r < 0.58) {                             // дополнительная канистра
      spawnFuel(x);
      nextX = x + rnd(360, 520) * S;
    } else {                                           // звёздочки
      var c = ri(2, 4), lowRow = easy || RNG() < 0.6;
      for (var q = 0; q < c; q++)
        objs.push({ t:'star', x: x + q * 92 * S, y: (lowRow ? 105 : rnd(180, 280)) * S, ph: rnd(0, TAU) });
      nextX = x + rnd(380, 560) * S;
    }
  }
}

var ghRamp = false;
/* Что уже «открыто» по числу собранных звёздочек. */
function unlockedNow() {
  var set = {};
  if (!story && Stats.known('РОБОТ')) set.robot = 1;   // уже знаком с роботом — не запираем его заново после рестарта
  for (var i = 0; i < ENDLESS_STEPS.length; i++)
    if (stars >= ENDLESS_STEPS[i].stars)
      for (var j = 0; j < ENDLESS_STEPS[i].add.length; j++) set[ENDLESS_STEPS[i].add[j]] = 1;
  return set;
}

var metEl = {}, platN = 0;

/* ═════ ОЧЕРЕДЬ ИНТЕРАКТИВ-СТОПОВ ═════
   Строгий порядок: следующий урок включится только когда пройден предыдущий.
   Небо (птица, самолёт, солнце, радуга) — в конце, чтобы не мешало основам.
   Полный разбор — в ИНТЕРАКТИВЫ.md                                          */
var LESSON_ORDER = [
  'jump0',   // прыжок — сразу на старте
  'gas0',    // газ — следом
  'star', 'balloon',            // что собирать
  'cone', 'puddle',             // безобидные помехи
  'ramp', 'plat',               // как взлетать и запрыгивать
  'pit', 'fuel',                // опасность и бензин
  'mon', 'robot',               // кто гоняется
  'bucket',                        // ведро с краской
  'bird', 'plane', 'sun', 'arch',  // небо
  'tree', 'house', 'bush', 'cloud', // что растёт у дороги
  'flower', 'apple', 'ball', 'butterfly', 'hedgehog', 'rocket', 'train',   // на долгую игру
  'cow', 'horse', 'chicken', 'fence', 'haystack', 'windmill', 'daisies',   // ферма и луг
  'coin', 'chest', 'sheep', 'tractor', 'bus', 'ambulance', 'excavator', 'garbage', 'tow',
  'loc_tower', 'loc_shop', 'loc_palm', 'loc_umbrella', 'loc_monkey', 'loc_rock', 'loc_fir', 'loc_snowman', 'master'
  // ↑ окружение и транспорт: слово входит в очередь, только когда его реплики озвучены (voicedLesson)
  // 'wheel' в очереди нет: слово учим на второй починке, когда бы она ни случилась
];

/* ═════ РИТМ СОБЫТИЙ БЕСКОНЕЧНОГО РЕЖИМА ═════
   • wordT/wordDue — таймер «до следующего слова» (TUNE.wordMin..wordMax c ЕЗДЫ: уроки,
     поломки и мастерская не считаются). Вышел — дороге заказывается предмет слова (wantEl);
     первый такой предмет получает урок.
   • robotT/robotDue — таймер погони (TUNE.robotMin..robotMax c). Идёт ТОЛЬКО когда учить
     нечего и робота нет. Слово РОБОТ приходит через заказ, то есть слово всегда важнее.
   • chaseN — номер погони; первые TUNE.monFreeChases идут без монстриков навстречу,
     и за TUNE.monQuiet c до них монстриков уже не ставим.
   Сброс всего — resetRhythm() (startGame и beginStage).                            */
var wordT = 0, wordDue = 0, wantEl = null, wantT = 0, wordArmed = false;
var robotT = 0, robotDue = 0, chaseN = 0, robotSoon = false;
function rollWord()  { wordT = 0; wordDue = rnd(TUNE.wordMin, TUNE.wordMax); }
function rollRobot() { robotT = 0; robotDue = rnd(TUNE.robotMin, TUNE.robotMax); }
function resetRhythm() { rollWord(); rollRobot(); wantEl = null; wantT = 0; wordArmed = false; chaseN = 0; robotSoon = false; }

/* Чем дорога может показать слово. Нет записи — показать нечем (солнце, радуга): очередь их пропускает. */
var PROP_KIND = { tree:1, house:1, bush:1, fence:1, cow:1, haystack:1, chicken:1, windmill:1, daisies:1, horse:1,
                  chest:1, sheep:1, tractor:1, bus:1, ambulance:1, excavator:1, garbage:1, tow:1, master:1,
                  loc_tower:1, loc_shop:1, loc_palm:1, loc_umbrella:1, loc_monkey:1, loc_rock:1, loc_fir:1, loc_snowman:1 };
var ROAD_EL   = { star:1, balloon:1, cone:1, puddle:1, ramp:1, plat:1, pit:1, mon:1, flower:1, apple:1, ball:1, hedgehog:1, coin:1 };
var SKY_EL    = { bird:1, plane:1, butterfly:1, cloud:1 };
function hasItem(p, t) { for (var i = 0; i < p.items.length; i++) if (p.items[i].t === t) return true; return false; }
function patternOk(p, un) {                        // связка открыта по звёздам и не запрещена погоней
  for (var j = 0; j < p.need.length; j++) if (!un[p.need[j]]) return false;
  if (monBlocked() && hasItem(p, 'mon')) return false;
  return true;
}
function patternFor(t) {                           // есть ли сейчас открытая связка с таким предметом
  var un = unlockedNow();
  for (var i = 0; i < PATTERNS.length; i++) if (patternOk(PATTERNS[i], un) && hasItem(PATTERNS[i], t)) return true;
  return false;
}
function canSummon(k) {                            // можно ли прямо сейчас показать предмет слова k
  if (state === 'lane') return !!LANE_SHOW[k] && k !== 'gas0';   // в «руле» газа нет, а прыжок есть
  if (k === 'jump0' || k === 'gas0') return true;  // сценарий старта — по runT
  if (PROP_KIND[k]) return (TH().props || []).indexOf(k) >= 0 && patternFor('prop');
  if (ROAD_EL[k])   return patternFor(k);
  if (k === 'robot') return !!unlockedNow().robot && !robot.on;
  if (k === 'train') return stars > 20;
  return !!(SKY_EL[k] || k === 'fuel' || k === 'bucket' || k === 'rocket');
}
/* Слово учим, только если все его реплики озвучены: иначе включится робо-голос браузера (ГРАБЛИ §1). */
var voicedCache = {};
function voicedLesson(k) {
  if (voicedCache[k] != null) return voicedCache[k];
  var L = LESSONS['el_' + k], ok2 = !!L && A.have(L.ask) && A.have('Молодец! Ты выучил слово ' + L.say + '!') && (!L.tip || A.have(L.tip));
  return (voicedCache[k] = ok2);
}
/* Следующее слово: первое в очереди, которое ребёнок ещё не знает и которое есть чем показать. */
function nextLessonKey() {
  for (var i = 0; i < LESSON_ORDER.length; i++) {
    var k = LESSON_ORDER[i];
    if (metEl[k] || !LESSONS['el_' + k] || !voicedLesson(k)) continue;
    if (!Stats.canTeach(LESSONS['el_' + k].word)) { metEl[k] = 1; continue; }   // уже знает — пропускаем
    if (canSummon(k)) return k;
  }
  return null;
}
/* Таймер вышел — заказываем дороге предмет слова k. */
function orderWord(k) {
  wantEl = k; wantT = 0;
  if (state === 'lane') return;                                // предмет поставит сам режим «руль»
  if (k === 'robot')      { startChase(true); return; }        // робот приходит сам, сразу с уроком
  if (k === 'rocket')     rocketT = 41;                        // ракета — на следующем кадре
  else if (SKY_EL[k])     skyT = 99;                           // небо — на следующем кадре
  else if (k === 'train') railT = 96;                          // переезд — на следующем кадре
  /* бензин, ведро с краской и дорожные предметы заберут spawnAhead / spawnEndless по wantEl */
}
function armedObj() {
  var arr = state === 'lane' ? ln.objs : objs;
  for (var i = 0; i < arr.length; i++) if (arr[i].lesson) return arr[i];
  return null;
}
/* Заказ завис (связка с нужным предметом не выпала) — ставим предмет сами, впереди по дороге.
   Без этого промежуток между словами растягивался до минуты. */
function forceSpawn(k) {
  var x = obsFrom(carX + W * 1.15), o = null;
  if (k === 'star')          o = { t:'star', x:x, y: 95 * S, ph: rnd(0, TAU) };
  else if (k === 'balloon')  o = { t:'balloon', x:x, y: 200 * S, ph: rnd(0, TAU) };
  else if (k === 'cone')     o = { t:'cone', x:x, y:0, hit:false };
  else if (k === 'puddle')   o = { t:'puddle', x:x, w: rnd(80, 120) * S, done:false };
  else if (k === 'ramp')     o = { t:'ramp', x:x, w: 132 * S, h: 76 * S };
  else if (k === 'plat')     o = { t:'plat', x:x, w: rnd(250, 330) * S, h: rnd(115, 165) * S };
  else if (k === 'pit')      o = { t:'pit', x:x, w: 150 * S };
  else if (k === 'mon')      o = monBlocked() ? null : { t:'mon', x:x, ph:0, hit:false, skin: pick(['monster_a','monster_b','monster_c','monster_d']) };
  else if (k === 'flower')   o = { t:'flower', x:x };
  else if (k === 'apple')    o = { t:'apple', x:x, y: 95 * S, ph: rnd(0, TAU) };
  else if (k === 'ball')     o = { t:'ball', x:x, ph: rnd(0, TAU), hit:false };
  else if (k === 'hedgehog') o = { t:'hedgehog', x:x, ph: rnd(0, TAU) };
  else if (PROP_KIND[k])     o = { t:'prop', x:x, kind: k, ph: rnd(0, TAU) };
  else if (k === 'fuel')     o = { t:'fuel', x:x, y: 58 * S, ph: rnd(0, TAU) };   // без y канистра ложилась на асфальт
  else if (k === 'bucket')   o = { t:'bucket', x:x, ph: rnd(0, TAU), col: pick(BUCKETS) };   // без col падала и отрисовка, и сбор
  if (!o) { wantEl = null; return; }
  if (/^(cone|puddle|ball|pit|mon)$/.test(o.t)) obsMark(x);
  objs.push(o);
  EV('force', k);
  markFirst(o, o.t === 'prop' ? o.kind : o.t);
}
/* Монстрикам навстречу нельзя: идёт одна из первых погонь или она вот-вот начнётся. */
function monBlocked() {
  if (story) return false;
  if (robot.on && !robot.flee) return chaseN <= TUNE.monFreeChases;
  return chaseN < TUNE.monFreeChases && robotSoon;
}
/* Робот появляется позади машинки. lesson=true — первая встреча, слово РОБОТ. */
function startChase(lesson) {
  EV('chase', (chaseN + 1) + ' robotT=' + robotT.toFixed(1));
  chaseN++; rollRobot();
  robot.on = true; robot.flee = false; robot.x = carX - TUNE.robotStart * S; robot.life = 0; robot.told = 0;
  if (chaseN <= TUNE.monFreeChases)                // первые погони — без монстриков: убираем тех, кто ещё не в кадре
    for (var i = objs.length - 1; i >= 0; i--)
      if (objs[i].t === 'mon' && scr(objs[i]) > W) objs.splice(i, 1);
  A.siren();
  if (lesson) {
    /* Робот стартует в 760*S ПОЗАДИ машинки — на уроке «робот» камера смотрела в пустую
       дорогу за левым краем экрана. Подтягиваем его в кадр и возвращаем на место после урока. */
    wantEl = null; metEl.robot = 1;
    robot.x = carX - 300 * S;
    LESSONS.el_robot.after = function () { robot.x = carX - TUNE.robotStart * S; state = 'play'; armCommands(); };
    toLesson('el_robot', { x: robot.x });
    return;
  }
  A.say('Я тебя догоню!');
}
/* Что ребёнок уже знает — помечаем сразу на старте, иначе известное слово держит очередь,
   пока его предмет не выпадет на дороге (у робота это могло не случиться вовсе). */
function seedKnown() {
  for (var i = 0; i < LESSON_ORDER.length; i++) {
    var k = LESSON_ORDER[i], L = LESSONS['el_' + k];
    if (L && !Stats.canTeach(L.word)) metEl[k] = 1;
  }
}
function markFirst(o, t) {                         // предмет заказанного слова получает урок
  if (!o || metEl[t] || !LESSONS['el_' + t] || wantEl !== t) return;
  wantEl = null;
  if (!Stats.canTeach(LESSONS['el_' + t].word)) { metEl[t] = 1; return; }   // уже знает — не повторяем
  metEl[t] = 1; wordArmed = true; o.lesson = true; o.lessonKey = 'el_' + t;
}
function gap(x, v) { return Math.max(x + TUNE.minGap * S, v); }
var lastObsX = -1e9;   // мировой x последнего препятствия: конус, лужа, мяч, яма, монстрик, переезд
/* Правило дистанции: следующее препятствие не ближе TUNE.minGap к предыдущему — иначе между
   ними не приземлиться и не взлететь снова (полкузова + радиусы + ~180 px на реакцию и разгон). */
function obsFrom(x) { return Math.max(x, lastObsX + TUNE.minGap * S); }
function obsMark(x) { if (x > lastObsX) lastObsX = x; return x; }

var JUMP_PRAISE = ['Молодец!', 'Здорово!', 'Ты супер!', 'Вот это да!'];
var praiseT = 0;
function praiseJump() {
  if (T - praiseT < 12 || A.talking() || RNG() < 0.45) return;
  praiseT = T; A.say(pick(JUMP_PRAISE));
}

var MONSTER_LINES = ['Бу-у-у!', 'Хи-хи-хи!', 'Ага, попался!', 'Куда поехал?', 'Стой, машинка!',
                     'Ням-ням-ням!', 'Гр-р-р!', 'Хо-хо-хо!', 'Я тебя вижу!'];
var monTalk = 0;

var BUCKETS = [
  { skin:'black',  c:'#16161d', name:'ЧЁРНЫЙ'  },
  { skin:'red',    c:'#d62828', name:'КРАСНЫЙ' },
  { skin:'yellow', c:'#f2c200', name:'ЖЁЛТЫЙ'  }
];

/* ═════ РИТМ ДОРОГИ ═════
   Связка препятствий → пустой участок на отдых. Правь таблицу смело:
   need — что должно быть уже открыто, len — длина связки, rest — отдых после неё. */
var PATTERNS = [
  { need:['star'],        len: 380, rest:[420, 620], items:[
      {t:'star',dx:0}, {t:'star',dx:92}, {t:'star',dx:184} ] },
  { need:['star'],        len: 420, rest:[460, 660], items:[
      {t:'star',dx:0,y:95}, {t:'star',dx:96,y:170}, {t:'star',dx:192,y:245}, {t:'star',dx:288,y:170} ] },
  { need:['balloon'],     len: 340, rest:[460, 640], items:[
      {t:'balloon',dx:0,y:180}, {t:'balloon',dx:110,y:255}, {t:'balloon',dx:220,y:180} ] },
  { need:['cone'],        len: 480, rest:[520, 700], items:[
      {t:'cone',dx:0}, {t:'cone',dx:440} ] },
  { need:['cone'],        len: 920, rest:[560, 760], w: 3, items:[      // редко — ряд из трёх
      {t:'cone',dx:0}, {t:'cone',dx:440}, {t:'cone',dx:880} ] },
  { need:['puddle'],      len: 200, rest:[480, 660], items:[ {t:'puddle',dx:0} ] },
  { need:['cone','puddle'], len: 560, rest:[560, 760], items:[
      {t:'cone',dx:0}, {t:'puddle',dx:460} ] },
  { need:['ramp'],        len: 560, rest:[600, 820], items:[
      {t:'ramp',dx:0}, {t:'star',dx:200,y:150}, {t:'star',dx:300,y:230},
      {t:'star',dx:400,y:250}, {t:'star',dx:500,y:180} ] },
  { need:['plat'], chain:true, len: 600, rest:[620, 840], items:[
      {t:'plat',dx:0}, {t:'star',dx:70,onPlat:1}, {t:'star',dx:170,onPlat:1}, {t:'star',dx:270,onPlat:1} ] },
  { need:['pit'],         len: 300, rest:[640, 860], items:[ {t:'pit',dx:0} ] },
  { need:['pit','star'],  len: 420, rest:[660, 880], items:[
      {t:'pit',dx:0}, {t:'star',dx:0,y:200}, {t:'star',dx:120,y:170} ] },
  { need:['mon'],         len: 260, rest:[680, 900], items:[ {t:'mon',dx:0} ] },
  { need:['prop'],        len: 120, rest:[420, 620], items:[ {t:'prop',dx:0} ] },
  { need:['prop'],        len: 240, rest:[560, 760], items:[ {t:'traffic',dx:0} ] },
  { need:['prop'],        len: 200, rest:[420, 600], items:[ {t:'flower',dx:0}, {t:'flower',dx:120} ] },
  { need:['star'],        len: 260, rest:[440, 640], items:[ {t:'apple',dx:0}, {t:'apple',dx:130} ] },
  { need:['cone'],        len: 200, rest:[520, 700], items:[ {t:'ball',dx:0} ] },
  { need:['prop'],        len: 160, rest:[460, 660], items:[ {t:'hedgehog',dx:0} ] },
  { need:['star'],        len: 300, rest:[440, 640], items:[ {t:'coin',dx:0}, {t:'coin',dx:110}, {t:'coin',dx:220} ] },
  { need:['mon','star'],  len: 460, rest:[700, 920], items:[
      {t:'mon',dx:0}, {t:'star',dx:60,y:210}, {t:'star',dx:180,y:130} ] }
];

function spawnEndless(x) {
  if (!metEl.jump0) return x + 900 * S;            // сперва просто едем по пустой дороге
  x = obsFrom(x);                                  // правило дистанции (после переезда и прошлой связки)
  if (wantEl === 'bucket' || RNG() < 0.06) {   // ведро с краской: по заказу слова или изредка
    var ob = { t:'bucket', x:x, ph:0, col: pick(BUCKETS) };
    objs.push(ob); markFirst(ob, 'bucket');
    return gap(x, x + rnd(520, 700) * S);
  }
  var un = unlockedNow(), pool = [], i;
  var wantItem = wantEl && PROP_KIND[wantEl] ? 'prop' : (wantEl && ROAD_EL[wantEl] ? wantEl : null);   // заказ слова
  for (i = 0; i < PATTERNS.length; i++)
    if (patternOk(PATTERNS[i], un) && (!wantItem || hasItem(PATTERNS[i], wantItem))) pool.push(PATTERNS[i]);
  if (!pool.length && wantItem) {                  // заказ сейчас невыполним — снимаем, едем как обычно
    wantEl = null; wantItem = null;
    for (i = 0; i < PATTERNS.length; i++) if (patternOk(PATTERNS[i], un)) pool.push(PATTERNS[i]);
  }
  if (!pool.length) pool = [PATTERNS[0]];
  var wsum = 0, wi;                                // w — как часто встречается связка (по умолчанию 10)
  for (wi = 0; wi < pool.length; wi++) wsum += (pool[wi].w || 10);
  var roll = RNG() * wsum, pt = pool[pool.length - 1];
  for (wi = 0; wi < pool.length; wi++) { roll -= (pool[wi].w || 10); if (roll <= 0) { pt = pool[wi]; break; } }
  var platH = 0;

  if (pt.chain && ++platN % 2 === 0) {             // каждая вторая — целая эстакада
    var tall = RNG() < 0.35;                 // иногда — высокая эстакада
    var cnt = ri(2, 6), px3 = x, hh3 = rnd(120, 165) * S, first = null, step3 = 0;
    for (var c3 = 0; c3 < cnt; c3++) {
      var w3 = rnd(190, 275) * S;
      var o3 = { t:'plat', x:px3, w:w3, h:hh3 };
      objs.push(o3);
      if (!first) { first = o3; markFirst(o3, 'plat'); }
      objs.push({ t:'star', x: px3 + w3 * 0.5, y: hh3 + 55 * S, ph: rnd(0, TAU) });
      if (c3 < cnt - 1) objs.push({ t:'star', x: px3 + w3 + 70 * S, y: hh3 + 110 * S, ph: rnd(0, TAU) });
      px3 += w3 + rnd(115, 185) * S;               // разрыв, который перепрыгивается
      if (tall && step3 < 3) { hh3 += rnd(70, 100) * S; step3++; }   // ступеньками вверх
      else hh3 = clamp(hh3 + rnd(-28, 28) * S, 105 * S, 420 * S);
    }
    return px3 + rnd(520, 720) * S;
  }

  for (i = 0; i < pt.items.length; i++) {
    var it = pt.items[i], px2 = x + it.dx * S, o = null;
    if (it.t === 'star') {
      var sy = it.onPlat ? platH + 55 * S : (it.y || 95) * S;
      o = { t:'star', x:px2, y:sy, ph:rnd(0, TAU) };
    } else if (it.t === 'balloon') o = { t:'balloon', x:px2, y:(it.y || 200) * S, ph:rnd(0, TAU) };
    else if (it.t === 'cone')      o = { t:'cone', x:px2, y:0, hit:false };
    else if (it.t === 'puddle')    o = { t:'puddle', x:px2, w:rnd(80, 120) * S, done:false };
    else if (it.t === 'ramp')      o = { t:'ramp', x:px2, w:132 * S, h:76 * S };
    else if (it.t === 'plat')    { platH = rnd(115, 165) * S; o = { t:'plat', x:px2, w:rnd(250, 330) * S, h:platH }; }
    else if (it.t === 'pit')       o = { t:'pit', x:px2, w:150 * S };
    else if (it.t === 'mon')       o = { t:'mon', x:px2, ph:0, hit:false,
                                         skin: pick(['monster_a','monster_b','monster_c','monster_d']) };
    else if (it.t === 'prop')      o = { t:'prop', x:px2, ph: rnd(0, TAU),
                                         kind: wantEl && PROP_KIND[wantEl] ? wantEl : pick((TH().props || ['tree','house','bush']).concat(TH().extra || [])) };
    else if (it.t === 'traffic') {
      /* car_red нарисована строго сбоку и уместна в любой локации; остальные —
         из реквизита темы, если он там есть. */
      var tk = ['car_red'].concat((TH().extra || []).filter(function (n) { return TRAFFIC_KIND[n]; }));
      o = { t:'traffic', x:px2, ph: rnd(0, TAU), kind: pick(tk), sp: rnd(0.42, 0.62), passed: 0 };
    }
    else if (it.t === 'flower')    o = { t:'flower', x:px2 };
    else if (it.t === 'apple')     o = { t:'apple', x:px2, y: 95 * S, ph: rnd(0, TAU) };
    else if (it.t === 'ball')      o = { t:'ball', x:px2, ph: rnd(0, TAU), hit:false };
    else if (it.t === 'hedgehog')  o = { t:'hedgehog', x:px2, ph: rnd(0, TAU) };
    else if (it.t === 'coin')      o = { t:'coin', x:px2, y: 95 * S, ph: rnd(0, TAU) };
    if (!o) continue;
    if (/^(cone|puddle|ball|pit|mon)$/.test(it.t)) obsMark(px2);
    objs.push(o);
    markFirst(o, it.t === 'prop' ? o.kind : it.t);
  }
  var len = pt.len * S + (pt.items[pt.items.length - 1].t === 'plat' ? 0 : 0);
  return x + len + rnd(pt.rest[0], pt.rest[1]) * S;   // связка, потом отдых
}

/* Высота земли под точкой — БЕЗ побочных эффектов. Нужна отдельно, потому что
   колёса щупают землю по два раза за кадр, а «настоящий» groundHeightAt заодно
   ставит ghRamp и хвалит за посадку на платформу: пробе это делать нельзя. */
function groundProbe(x, y) {
  var h = 0;
  for (var i = 0; i < objs.length; i++) {
    var o = objs[i];
    if (o.t === 'ramp' && x > o.x && x < o.x + o.w) {
      var rh = o.h * clamp((x - o.x) / o.w, 0, 1);
      if (rh > h) h = rh;
    } else if (o.t === 'plat' && x > o.x - 6 * S && x < o.x + o.w + 6 * S && y >= o.h - 14 * S) {
      if (o.h > h) h = o.h;
    }
  }
  return h;
}

function groundHeightAt(x, y) {
  var h = 0; ghRamp = false;
  for (var i = 0; i < objs.length; i++) {
    var o = objs[i];
    if (o.t === 'ramp' && x > o.x && x < o.x + o.w) {
      var rh = o.h * clamp((x - o.x) / o.w, 0, 1);
      if (rh > h) { h = rh; ghRamp = true; }
    } else if (o.t === 'plat' && x > o.x - 6 * S && x < o.x + o.w + 6 * S && y >= o.h - 14 * S) {
      if (o.h > h) { h = o.h; ghRamp = false; if (!o.landed) { o.landed = 1; praiseJump(); } }
    }
  }
  return h;
}


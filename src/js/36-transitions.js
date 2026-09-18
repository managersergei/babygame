/* ═══════════════ 18. ПЕРЕХОДЫ ═══════════════ */
function setPad() {
  var big = document.getElementById('kS').querySelector('.big');
  var cap = document.getElementById('kSCap');
  if (cap && TOUCH) cap.textContent = '';        // подпись «ПРОБЕЛ» на планшете указывает в пустоту
  if (TOUCH) { var ph = document.getElementById('pgHint'); if (ph) ph.style.display = 'none'; }
  var arrows = state === 'garage' || state === 'mode' || state === 'gamemode' || state === 'lane' || (state === 'play' && !easy);
  document.getElementById('kL').classList.toggle('hidden', !arrows);
  document.getElementById('kR').classList.toggle('hidden', !arrows);
  /* Газ — только в «руле»: там ◀ ▶ рулят, и разогнаться с планшета было нечем.
     В бесконечном ускоряет сама ▶, второй кнопки не нужно. */
  document.getElementById('kG').classList.toggle('hidden', state !== 'lane');
  /* Во время самой игры в панели инструментов нужен только звук: остальное — экраны взрослого,
     и ребёнок случайно попадает по ним пальцем. */
  var playing = state === 'play' || state === 'lane' || state === 'lesson' || state === 'repair'
             || state === 'crash' || state === 'wash' || state === 'paint' || state === 'over';
  ['bStats', 'bSet', 'bMic', 'bFull', 'bInfo'].forEach(function (id) {   // 🏠 и 🔊 остаются: без них с планшета не выйти и не выключить звук
    var el = document.getElementById(id);
    if (el) el.style.display = (playing && !DBG) ? 'none' : '';
  });
  var pult = document.getElementById('bPult');
  if (pult) pult.style.display = (playing && state !== 'lane' && !DBG) ? 'none' : '';
  big.textContent = state === 'garage' ? '✓ ДАЛЬШЕ'
                  : state === 'gamemode' ? (MODES.length < 2 ? '✓ ПОЕХАЛИ' : '✓ ДАЛЬШЕ')
                  : state === 'mode'   ? '✓ ПОЕХАЛИ'
                  : state === 'name'   ? '▶ ДАЛЬШЕ'
                  : state === 'ask'    ? (ask.sel === 1 ? '✗ НЕТ' : '✓ ДА')
                  : state === 'paint'  ? '▶ ДАЛЬШЕ'
                  : state === 'result' ? '▶ ДАЛЬШЕ'
                  : state === 'lane'   ? '⬆ ПРЫЖОК'
                  : state === 'intro'  ? '▶ ПОЕХАЛИ'
                  : state === 'over'   ? (over.sel === 1 ? '🚗 ДРУГАЯ МАШИНКА' : '↻ ЕЩЁ РАЗ')
                  : state === 'crash'  ? '…' 
                  : state === 'wash'   ? '▶ ДАЛЬШЕ'
                  : state === 'lesson' ? '▶ СКАЗАЛ'
                  : state === 'repair' ? (rep.phase === 'fix' ? '🔧 ПОСТАВИТЬ'
                                        : rep.phase === 'ask' ? '✓ ОТВЕТИТЬ' : '▶ ДАЛЬШЕ')
                  : outOfFuel          ? '⛽ ЗАПРАВИТЬ'
                                       : '⬆ ПРЫЖОК';
}

function toGarage() {
  Pult.hideBox();
  state = 'garage'; A.engine(0, 1, false); Mic.disarm(); story = false; voiceCtl = false;
  parts.length = 0; texts.length = 0;
  gvReset();
  A.say([CARS[sel].say, 'Выбирай машинку!']);   // раньше на входе в гараж никто не объяснял, что делать
  setPad();
}
function toMode() {
  A.init(); car = CARS[sel]; state = 'mode'; modeT = 0;
  parts.length = 0; texts.length = 0;
  A.whoosh();
  setPad();
}
function startGame() {
  A.init();
  if (GAMEMODES[gmSel].id === 'endless' && Voice.on) voiceCtl = true;   // голос всегда наготове
  try {
    localStorage.setItem('babygame.pick', JSON.stringify({ c: sel, g: GAMEMODES[gmSel].id, m: MODES[modeSel].id }));
  } catch (e) {}
  var m = MODES[modeSel].id;
  easy = m !== 'full';
  voiceCtl = (m === 'voice') || (GAMEMODES[gmSel].id === 'endless' && Voice.on);
  story = GAMEMODES[gmSel].id === 'story';
  track('start', { game: GAMEMODES[gmSel].id, ctl: m });
  tune(); resetWorld();
  learned = {}; metEl = {}; resetRhythm(); if (!story) seedKnown();   // бесконечный: известное — мимо очереди
  stage = 0; night = 0; nightTo = 0; lights = false; stageFired = false; damage = 0;
  carPaint = null; damage = 0; carDirty = false; robot.on = false; stopHold = 0; finishing = false;
  themeIx = 0; themeFrom = 0; themeK = 1;
  if (story || voiceCtl) { if (Voice.on) Mic.request(false); toName(); return; }
  state = 'play';
  A.rev(); A.fanfare(stars);
  setTimeout(function () { A.say('Поехали!'); }, 300);   // сначала зажигание, потом диктор
  setPad();
}

function moveSel(dir) {
  A.init();
  if (state === 'garage') {
    sel = ((sel + dir) % CARS.length + CARS.length) % CARS.length;
    /* Имя произносим не сразу, а когда карусель доехала: при удержании стрелки
       диктор начинал четыре реплики подряд и заикался. */
    slide = dir; A.whoosh(); gvReset(); saySelT = 0.32;
  } else if (state === 'ask') {
    /* «НЕТ» была нарисована кнопкой, но нажать её было физически нечем: на пульте
       одна большая кнопка, и она всегда означала «да». Стрелки выбирают, как везде. */
    var ns = ask.sel ? 0 : 1;
    if (ask.phase !== 'done') { ask.sel = ns; A.whoosh(); }
  } else if (state === 'gamemode') {
    /* Кольцуем, как в гараже: раньше стрелка в крайнем положении не делала ничего —
       ни звука, ни движения, и ребёнок решал, что кнопка сломалась. */
    var ng = ((gmSel + dir) % GAMEMODES.length + GAMEMODES.length) % GAMEMODES.length;
    if (ng !== gmSel) {
      gmSel = ng; A.whoosh(); A.say(GAMEMODES[gmSel].say);
      if (GAMEMODES[gmSel].id === 'endless') modeSel = ixById(MODES, 'full', 0);    // по умолчанию: стрелки (голос — упражнения внутри)
    }
  } else if (state === 'mode') {
    var nm = clamp(modeSel + dir, 0, MODES.length - 1);
    if (nm !== modeSel) { modeSel = nm; A.whoosh(); A.say(MODES[modeSel].say); }
  }
}


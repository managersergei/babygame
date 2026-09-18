/* ═══════════════ 5. СОСТОЯНИЕ ═══════════════ */
var DBG = /[?&]dbg=1/.test(location.search);
var REC  = /[?&]rec=1/.test(location.search);            // запись роликов: без HUD и музыки, события в консоль
var AUTO = REC && /[?&]auto=1/.test(location.search);    // …и машинка играет сама
var YM_ID = 0;                                            // счётчик Яндекс Метрики; 0 — выключено
function EV(name, extra) { if (REC) console.log('EV ' + T.toFixed(3) + ' ' + name + (extra ? ' ' + extra : '')); }
function track(ev, p) {
  try { if (YM_ID && window.ym) window.ym(YM_ID, 'reachGoal', ev, p || {}); } catch (e) {}
  try { TG.ev(ev, p || {}); } catch (e) {}                 // отчёты родителю (секция 17e)
  if (DBG) console.log('track', ev, p || {});
}
var state = 'load';                 // load | garage | mode | play
var sel = 0, slide = 0, modeSel = 0, modeT = 0, garageT = 0, gmSel = 0, gmT = 0;
var saySelT = 0, pickT = 0;      // отложенная озвучка имени и «завестись и рвануть» при выборе
var trState = '', trT = 0;       // мягкий наплыв нового экрана вместо подмены в один кадр
var car = null, easy = false;

var carX = 0, carY = 0, vy = 0, spd = 0, grounded = true, jumps = 0;
var wobble = 0, squash = 0, tilt = 0, lastGroundH = 0;
var stars = 0, row = 0, combo = 0, comboT = 0;
var objs = [], parts = [], texts = [];
var nextX = 0, lastFuelX = 0, archPending = false;
var fuel = 1, outOfFuel = false, emptyShown = false, beepT = 0, lowT = 0, refuels = 0;
/* Каждый десятый собранный бензин чуть увеличивает бак: видно по шкале, сбрасывается после проигрыша. */
var fuelPicks = 0, tankMul = 1;
var celebrate = 0, flash = 0, flashX = null, flashY = null, shake = 0, sirenT = 0, fxT = 0, T = 0;
var starWas = -1, starPopT = -9;   // счётчик звёзд подпрыгивает, когда число меняется
/* Есть ли у ребёнка клавиатура. На планшете «нажимай пробел» — инструкция в пустоту. */
var TOUCH = (function () { try { return ('ontouchstart' in window) || navigator.maxTouchPoints > 0; } catch (e) { return false; } })();
function KEYW(t) { return (TOUCH ? '⬆ ' : 'ПРОБЕЛ — ') + t; }   // на планшете клавиатуры нет

var CARX = 0;
var CRUISE, VMAX, ACC, BRK, GRAV, JUMP1, JUMP2, FUELDIST, EASYSPD;

/* Физика платформера. Раньше эти девять чисел стояли прямо в tune() и правились
   только в редакторе кода; теперь это обычный набор настроек, доступный админке.
   Значения ровно те же, что были, — поведение не меняется. */
var PHYS = CFG.reg('PHYS', {
  cruise:   235,   // крейсерская скорость, к которой машинка выходит сама
  easySpd:  330,   // …она же в лёгком режиме
  vmax:     720,   // потолок скорости (умножается на «резвость» машинки)
  acc:      520,   // разгон
  brk:      950,   // торможение
  grav:    2100,   // притяжение
  jump1:    830,   // первый прыжок
  jump2:    690,   // второй прыжок в воздухе
  fuelDist:3600    // на сколько метров хватает полного бака
}, {
  cruise:  [ 80,  600, 5, 'крейсерская скорость'],
  easySpd: [ 80,  800, 5, 'крейсерская в лёгком режиме'],
  vmax:    [200, 1600, 10,'потолок скорости'],
  acc:     [100, 1500, 10,'разгон'],
  brk:     [200, 2500, 10,'торможение'],
  grav:    [800, 5000, 50,'притяжение'],
  jump1:   [300, 1800, 10,'сила первого прыжка'],
  jump2:   [200, 1600, 10,'сила второго прыжка'],
  fuelDist:[800, 12000,100,'на сколько хватает бака']
});

function tune() {
  CRUISE  = PHYS.cruise  * S;
  EASYSPD = PHYS.easySpd * S;
  VMAX    = PHYS.vmax    * S * (car && car.top ? car.top : 1);
  ACC     = PHYS.acc     * S;
  BRK     = PHYS.brk     * S;
  GRAV    = PHYS.grav    * S;
  JUMP1   = PHYS.jump1   * S * (car && car.jump ? car.jump : 1);
  JUMP2   = PHYS.jump2   * S * (car && car.jump ? car.jump : 1);
  FUELDIST= PHYS.fuelDist* S * tankMul;    // растёт от собранного бензина
}


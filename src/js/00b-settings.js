/* ═══════════════ 0b. НАСТРОЙКИ ═══════════════ */
/* Единственное место, откуда игра берёт числа, влияющие на игру.
   Правило отрасли простое: ни одного такого числа в коде — иначе баланс правит
   программист, а каждая правка требует выкладки. Здесь собран механизм, а сами
   значения по-прежнему объявлены рядом со своим кодом (TUNE, LN, PHYS…) и сюда
   только регистрируются: так не нужно таскать 200 чисел через весь файл.

   Три слоя, каждый следующий перекрывает предыдущий:
     1) заводские значения — то, что написано в коде;
     2) tune.js в репозитории — общий для всех детей, его кладёт админка кнопкой «выгрузить»;
     3) localStorage — правки ЭТОГО устройства из панели внутри игры (Shift+пробел трижды).

   Слой 3 никуда не уезжает и виден только здесь: подбирать на ходу можно смело,
   пока не нажата «выгрузить», чужая игра не меняется. */
var CFG = (function () {
  var GROUPS = {};      // имя → { obj, schema }
  var DEF    = {};      // имя → заводские значения (снимок ДО правок)
  var over   = {};      // что перекрываем

  function merge(dst, src) {
    if (!src) return dst;
    for (var gk in src) {
      if (!Object.prototype.hasOwnProperty.call(src, gk)) continue;
      dst[gk] = dst[gk] || {};
      for (var k in src[gk]) if (Object.prototype.hasOwnProperty.call(src[gk], k)) dst[gk][k] = src[gk][k];
    }
    return dst;
  }

  try { merge(over, window.TUNE_OVERRIDES); } catch (e) {}
  try { merge(over, JSON.parse(localStorage.getItem('babygame.tune') || 'null')); } catch (e) {}

  function clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return {}; } }

  /* Регистрируем объект настроек. Возвращает его же — чтобы писать
     `var TUNE = CFG.reg('TUNE', { ... }, { ... });` одной строкой.
     schema[k] = [мин, макс, шаг, 'подпись'] — из этого админка рисует ползунок.
     Ключ без схемы не пропадает: панель покажет его полем ввода. */
  function reg(name, obj, schema) {
    DEF[name] = clone(obj);                        // снимок обязателен ДО правок, иначе «сбросить» вернёт не туда
    GROUPS[name] = { obj: obj, schema: schema || {} };
    var o = over[name];
    if (o) for (var k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
      /* Молча берём только то, что уже есть в объекте и того же типа: устаревший
         ключ из старого tune.js не должен подсовывать игре строку вместо числа. */
      if (Object.prototype.hasOwnProperty.call(obj, k) && typeof o[k] === typeof obj[k]) obj[k] = o[k];
    }
    return obj;
  }

  function set(name, key, val) {
    var G = GROUPS[name]; if (!G || !Object.prototype.hasOwnProperty.call(G.obj, key)) return false;
    var s = G.schema[key];
    if (typeof G.obj[key] === 'number') {
      val = +val; if (!isFinite(val)) return false;
      if (s) val = Math.max(s[0], Math.min(s[1], val));
    }
    G.obj[key] = val;
    over[name] = over[name] || {}; over[name][key] = val;
    try { localStorage.setItem('babygame.tune', JSON.stringify(over)); } catch (e) {}
    if (typeof tune === 'function') tune();         // производные величины пересчитываем сразу
    return true;
  }

  function reset() {
    for (var name in GROUPS) {
      var d = DEF[name], obj = GROUPS[name].obj;
      for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) obj[k] = d[k];
    }
    over = {};
    try { localStorage.removeItem('babygame.tune'); } catch (e) {}
    if (typeof tune === 'function') tune();
  }

  /* Текст файла tune.js — его кладут в репозиторий рядом с index.html.
     Пишем только отличия от заводских: так видно, что именно подкрутили. */
  function exportJs() {
    var diff = {};
    for (var name in GROUPS) {
      var obj = GROUPS[name].obj, d = DEF[name], g = null;
      for (var k in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        if (obj[k] !== d[k]) { g = g || {}; g[k] = obj[k]; }
      }
      if (g) diff[name] = g;
    }
    return '/* Настройки игры. Файл создан админкой ' + new Date().toISOString().slice(0, 10) +
           '.\n   Правится ползунками, а не руками: панель внутри игры → «выгрузить». */\n' +
           'window.TUNE_OVERRIDES = ' + JSON.stringify(diff, null, 2) + ';\n';
  }

  return {
    reg: reg, set: set, reset: reset, exportJs: exportJs,
    groups: function () { return GROUPS; },
    def: function (name) { return DEF[name]; },
    changed: function (name, key) { return DEF[name] && GROUPS[name].obj[key] !== DEF[name][key]; }
  };
})();

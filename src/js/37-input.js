/* ═══════════════ 19. УПРАВЛЕНИЕ ═══════════════ */
var K = { left: false, right: false };
try { localStorage.removeItem('babygame.swap'); } catch (e) {}   // настройка обмена клавиш удалена 09.09.2026
var repeatT = 0;

function keyDown(k) {
  A.init(); A.music();
  if (Voice.on) { Mic.request(true); Mic.resume(); }
  if (k === 'space') {
    if (state !== 'play' && state !== 'garage' && state !== 'lane' && A.talking()) return;   // не перебиваем диктора
    if (state === 'garage') {
      /* Мгновенный срез кадра ощущался как «ничего не произошло». Даём машинке
         0,35 с завестись: рёв, дым из-под колёс, рывок — и только потом уходим. */
      if (!pickT) {
        pickT = 0.35; A.rev();
        for (var pq = 0; pq < 14; pq++)
          P({ x: W / 2 - 60 * S + rnd(-30, 30) * S, y: 10 * S, vx: rnd(-200, -40) * S, vy: rnd(30, 140) * S,
              r: rnd(8, 18) * S, c: '#e8dcc0', kind: 'puff', life: rnd(0.4, 0.8), ay: 40 * S });
      }
    }
    else if (state === 'gamemode') { if (GAMEMODES[gmSel].id === 'lane') Lane.start(); else if (MODES.length < 2) startGame(); else toMode(); }
    else if (state === 'repair') repairSpace();
    else if (state === 'name')   { if (nm.phase !== 'good') { Mic.cancel(); nameStep(false); } }
    else if (state === 'ask')    { askAnswer(ask.sel === 0); }
    else if (state === 'result')  { nextStage(); }
    else if (state === 'intro')   { beginStage(); }
    else if (state === 'over')    {
      if (over.sel === 1) { toGarage(); return; }          // выбрана смена машинки
      resetWorld(); chaseT = 0; robot.on = false; beginStage();
    }
    else if (state === 'lesson') { if (les.phase !== 'good') { Mic.cancel(); lessonStep(false); } }
    else if (state === 'mode') startGame();
    else if (state === 'lane') Lane.action();
    else if (state === 'play') action();
    return;
  }
  K[k] = true;
  if (k === 'gas') return;                         // газ — только удержание, экраны им не листают
  if (state === 'over') {                          // на экране проигрыша стрелки переключают действие
    var ns = clamp(over.sel + (k === 'left' ? -1 : 1), 0, 1);
    if (ns !== over.sel) { over.sel = ns; A.whoosh(); setPad(); }
    return;
  }
  if (state !== 'play' && state !== 'lane') { moveSel(k === 'left' ? -1 : 1); repeatT = 0.42; }
}
function keyUp(k) { if (k !== 'space') K[k] = false; }

/* Пока открыто окно взрослого, клавиши в игру не проходят: пробел закрывает окно,
   Escape тоже. Иначе пробел за спиной родителя уводит игру на следующий экран. */
var OVERLAYS = [
  { id: 'bot',      ok: function () { hideBot(); } },
  { id: 'pult',     ok: function () { Pult.hideBox(); } },
  { id: 'parent',   ok: function () { parentOk(); } },
  { id: 'stats',    ok: function () { document.getElementById('statsClose').click(); } },
  { id: 'settings', ok: function () { document.getElementById('setClose').click(); } }
];
function topOverlay() {
  for (var i = 0; i < OVERLAYS.length; i++) {
    var el = document.getElementById(OVERLAYS[i].id);
    if (el && el.style.display !== 'none') return OVERLAYS[i];
  }
  return null;
}
window.addEventListener('keydown', function (e) {
  /* Админка: Ctrl+Shift+A открывает и закрывает. Пока она открыта, игра клавиши
     не перехватывает — иначе пробел и стрелки не дошли бы до полей ввода. */
  /* Через typeof: если модуль админки почему-то не выполнился, обработчик клавиш
     обязан продолжать работать — иначе игра остаётся вообще без управления. */
  var adm = typeof Admin !== 'undefined' ? Admin : null;
  if (adm && e.ctrlKey && e.shiftKey && e.code === 'KeyA') { e.preventDefault(); adm.toggle(); return; }
  if (adm && adm.open()) { if (e.code === 'Escape') { e.preventDefault(); adm.hide(); } return; }
  var ov = topOverlay();
  if (ov) {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); ov.ok(); }
    return;
  }
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) keyDown('space'); }
  else if (e.code === 'ArrowUp')    { e.preventDefault(); K.gas = true; }
  else if (e.code === 'ArrowLeft')  { e.preventDefault(); if (!e.repeat) keyDown('left');  }
  else if (e.code === 'ArrowRight') { e.preventDefault(); if (!e.repeat) keyDown('right'); }
  else if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); toGarage(); }
  else if (e.code === 'KeyM') { setSoundIcon(A.toggle()); }
  else if (e.code === 'Tab') { e.preventDefault(); togglePadLock(); }
});
window.addEventListener('keyup', function (e) {
  if (e.code === 'ArrowUp') K.gas = false;
  else if (e.code === 'ArrowLeft') keyUp('left');
  else if (e.code === 'ArrowRight') keyUp('right');
});

function bindKey(el, k) {
  var on  = function (e) { e.preventDefault(); el.classList.add('down');
                           if (navigator.vibrate) try { navigator.vibrate(10); } catch (e2) {}   // как на пульте: нажатие отзывается
                           keyDown(k); };
  var off = function (e) { if (e) e.preventDefault(); el.classList.remove('down'); keyUp(k); };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('pointerleave', function () { el.classList.remove('down'); keyUp(k); });
}
bindKey(document.getElementById('kL'), 'left');
bindKey(document.getElementById('kR'), 'right');
bindKey(document.getElementById('kS'), 'space');
bindKey(document.getElementById('kG'), 'gas');

/* Замок экранных кнопок. На ноутбуке ребёнок ведёт ладонью по тачпаду и попадает
   по ◀ ⬆ ▶ и по кнопкам взрослого. Tab выключает их все разом; клавиатура работает,
   поэтому играть можно дальше. На тачскрине замок не даём: там Tab не нажать, и
   ребёнок остался бы без управления. */
var padLock = false;
function togglePadLock() {
  if (TOUCH) return;
  padLock = !padLock;
  document.body.classList.toggle('padlock', padLock);
  if (padLock) { K.left = K.right = K.gas = false; }   // не залипаем на том, что было нажато
  A.click();
}

function setSoundIcon(m) { document.getElementById('bSound').textContent = m ? '🔇' : '🔊'; }
document.getElementById('bSound').addEventListener('click', function () { A.init(); setSoundIcon(A.toggle()); });
document.getElementById('bHome').addEventListener('click', function () { toGarage(); });
['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
  window.addEventListener(ev, function () {
    if (Voice.on) { Mic.request(true); Mic.resume(); }     // явное действие ребёнка
  }, true);
});

function setMicIcon() { document.getElementById('bMic').textContent = Voice.on ? '🎤' : '🚫'; }
document.getElementById('bMic').addEventListener('click', function () {
  Voice.setOn(!Voice.on);
  if (Voice.on) Mic.request(false); else { Mic.cancel(); gvReset(); }
  setMicIcon();
});
setMicIcon();

(function () {                                   // пока доступа нет — показываем кнопку
  var b = document.getElementById('micAsk');
  b.addEventListener('click', function () { Mic.request(true); Mic.resume(); });
  setInterval(function () {
    b.style.display = (Voice.on && !Mic.ready() && !Mic.denied()) ? 'block' : 'none';
  }, 700);
})();

(function () {                                   // страница выученных слов
  var box = document.getElementById('stats'), body = document.getElementById('statsBody');
  var WICON = WORD_ICON;                          // общая карта «слово → иконка»
  function render() {
    var l = Stats.list();
    if (!l.length) {
      body.innerHTML = '<div class="empty">Пока ничего не проговаривали.<br>Слова появятся после первых уроков.</div>';
      renderRecs();
      return;
    }
    /* Иконку слова берём из самой таблицы уроков — тогда страницу можно показать
       и ребёнку: он узнаёт слово по картинке, а не читает список. */
    var done = 0;
    for (var q = 0; q < l.length; q++) if (l[q].n >= Stats.need) done++;
    var pc = Math.round(done / Math.max(1, l.length) * 100);
    body.innerHTML =
      '<div class="sum">выучено <b>' + done + '</b> из ' + l.length +
      '<div class="bar"><i style="width:' + pc + '%"></i></div></div>' +
      l.map(function (r) {
        var full = Math.min(r.n, Stats.need);
        var dots = new Array(full + 1).join('●') + new Array(Stats.need - full + 1).join('○');
        return '<div class="w' + (r.n >= Stats.need ? ' fin' : '') + '" data-w="' + r.w + '"><span>' +
               (WICON[r.w] ? WICON[r.w] + ' ' : '') + r.w + '</span><span class="dots">' + dots + '</span>' +
               '<span class="' + (r.n >= Stats.need ? 'done' : '') + '">' +
               (r.n >= Stats.need ? 'выучено' : r.n + '&nbsp;раз') + '</span></div>';
      }).join('');
    renderRecs();
  }
  var cache = [], player = null;
  function two(x) { return (x < 10 ? '0' : '') + x; }
  function renderRecs() {                               // под каждым словом — до трёх последних записей
    Rec.all(function (rs) {
      cache = rs;
      var old = body.querySelectorAll('.r');            // повторный вызов не должен удваивать строки
      for (var q = 0; q < old.length; q++) old[q].parentNode.removeChild(old[q]);
      var by = {}; rs.forEach(function (r) { (by[r.word] || (by[r.word] = [])).push(r); });
      var rows = body.querySelectorAll('.w');
      for (var i = 0; i < rows.length; i++) {
        /* Слово берём из data-атрибута, а не из текста: в подписи рядом с ним стоит иконка. */
        var list = (by[rows[i].getAttribute('data-w')] || []).slice(0, 3), html = '';
        for (var j = 0; j < list.length; j++) {
          var r = list[j], d = new Date(r.t);
          html += '<div class="r"><button data-play="' + r.id + '" title="Послушать">▶ послушать</button><span>' +
                  two(d.getDate()) + '.' + two(d.getMonth() + 1) + ' ' +
                  two(d.getHours()) + ':' + two(d.getMinutes()) + '</span>' +
                  '<button data-dl="' + r.id + '" title="Скачать">⬇</button><button data-del="' + r.id + '" title="Удалить">✕</button></div>';
        }
        if (html) rows[i].insertAdjacentHTML('afterend', html);
      }
      var tip = document.getElementById('recTip');
      if (tip) tip.textContent = rs.length
        ? '▶ послушать — как ребёнок произнёс слово. Записи хранятся только на этом устройстве.'
        : (Rec.on ? 'Записи появятся после уроков: игра сохраняет вторую попытку каждого слова.'
                  : 'Записи выключены — включите галку ниже, и игра сохранит вторую попытку каждого слова.');
    });
  }
  function byId(id) { for (var i = 0; i < cache.length; i++) if (cache[i].id === id) return cache[i]; return null; }
  function stopPlay() { if (player) { try { player.pause(); } catch (e) {} player = null; A.duck(false); } }
  body.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
    var r = byId(b.getAttribute('data-play') || b.getAttribute('data-dl') || b.getAttribute('data-del')); if (!r) return;
    if (b.hasAttribute('data-del')) { stopPlay(); Rec.del(r.id, render); return; }
    var url = URL.createObjectURL(r.blob);
    if (b.hasAttribute('data-dl')) {                    // экспорт файлом; на iOS откроется «Поделиться»
      var a = document.createElement('a'); a.href = url;
      a.download = r.word + '_' + Rec.stamp(r.t) + (r.mime === 'audio/wav' ? '.wav' : r.mime.indexOf('mp4') >= 0 ? '.m4a' : '.webm');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000); return;
    }
    stopPlay(); player = new Audio(url); A.duck(true);   // клик ▶ — жест пользователя, iOS пустит play()
    player.onended = player.onerror = function () { stopPlay(); URL.revokeObjectURL(url); };
    player.play();
  });
  var recOn = document.getElementById('recOn'); recOn.checked = Rec.on;
  recOn.addEventListener('change', function () { Rec.setOn(this.checked); });
  document.getElementById('recClear').addEventListener('click', function () {
    if (!confirm('Удалить все записи голоса?')) return;
    stopPlay(); Rec.clear(render);
  });
  document.getElementById('bStats').addEventListener('click', function () {
    if (box.style.display === 'none') { render(); box.style.display = 'block'; }
    else box.style.display = 'none';
  });
  document.getElementById('statsClose').addEventListener('click', function () { stopPlay(); box.style.display = 'none'; });
  document.getElementById('statsReset').addEventListener('click', function () {
    if (!confirm('Стереть выученные слова и образцы голоса? Со следующего заезда игра начнёт учить сначала.')) return;
    Stats.reset(); Voice.reset(); render();
  });
})();

(function () {                                   // громкость: диктор, звуки, музыка
  var box = document.getElementById('settings');
  var ids = { voice: 'vVoice', sfx: 'vSfx', mus: 'vMus' };
  try {
    var st = JSON.parse(localStorage.getItem('babygame.vol') || 'null');
    if (st) A.vol = st;
  } catch (e) {}
  for (var k in ids) document.getElementById(ids[k]).value = Math.round(A.vol[k] * 100);
  var sEl = document.getElementById('vSens');
  sEl.value = Math.round(Voice.sens * 100);
  sEl.addEventListener('input', function () { Voice.setSens(this.value / 100); });
  function save() {
    try { localStorage.setItem('babygame.vol', JSON.stringify(A.vol)); } catch (e) {}
    A.applyVol();
  }
  var prevT = 0;
  Object.keys(ids).forEach(function (kk) {
    document.getElementById(ids[kk]).addEventListener('input', function () {
      A.vol[kk] = this.value / 100; save();
      /* Ползунок без пробного звука настраивается вслепую. Троттлинг — чтобы
         протаскивание не превращалось в очередь из полусотни звуков. */
      var now = +new Date(); if (now - prevT < 400) return; prevT = now;
      if (kk === 'sfx') A.coin(4);
      else if (kk === 'voice' && !A.talking()) A.say('Поехали!');
    });
  });
  document.getElementById('bSet').addEventListener('click', function () {
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('setClose').addEventListener('click', function () { box.style.display = 'none'; });
})();
document.getElementById('bFull').addEventListener('click', function () {
  if (!document.fullscreenElement) {
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  } else if (document.exitFullscreen) document.exitFullscreen();
});


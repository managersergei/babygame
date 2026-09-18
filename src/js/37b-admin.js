/* ═══════════════ 19b. АДМИНКА НАСТРОЕК ═══════════════ */
/* Панель поверх игры: ползунки правят CFG на лету, игра при этом продолжает идти —
   так баланс подбирается глазами, а не пересборками.
   Открыть: ?admin=1 в адресе или Ctrl+Shift+A. Закрыть: × или Esc.
   Комбинацию ребёнок не наберёт: на планшете её просто нечем нажать.

   Два слоя правок (см. CFG): ползунки меняют только ЭТО устройство, а кнопка
   «выгрузить tune.js» отдаёт файл, который кладут в репозиторий рядом с index.html —
   вот тогда правки уезжают всем. */
var Admin = (function () {
  var box = null, built = false;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function row(name, key, val, schema) {
    var r = el('div', 'arow');
    var lab = el('label', 'alab', (schema && schema[3]) || key);
    lab.title = name + '.' + key;
    r.appendChild(lab);

    var num = el('input', 'anum');
    num.type = 'number';
    var slider = null;

    if (typeof val === 'number' && schema) {
      slider = el('input', 'asld');
      slider.type = 'range';
      slider.min = schema[0]; slider.max = schema[1]; slider.step = schema[2]; slider.value = val;
      r.appendChild(slider);
      num.min = schema[0]; num.max = schema[1];
      num.step = schema[2];
    }
    num.value = val;
    r.appendChild(num);

    function mark() { r.classList.toggle('chg', CFG.changed(name, key)); }
    function apply(v) {
      if (!CFG.set(name, key, v)) return;
      var now = CFG.groups()[name].obj[key];
      num.value = now; if (slider) slider.value = now;
      mark();
    }
    if (slider) slider.addEventListener('input', function () { apply(slider.value); });
    num.addEventListener('change', function () { apply(num.value); });
    mark();
    r.refresh = function () {
      var now = CFG.groups()[name].obj[key];
      num.value = now; if (slider) slider.value = now;
      mark();
    };
    return r;
  }

  var rows = [];

  function build() {
    box = el('div', null); box.id = 'admin';
    var head = el('div', 'ahead');
    head.appendChild(el('b', null, 'Настройки игры'));
    var x = el('button', 'ax', '×'); x.title = 'Закрыть (Esc)';
    x.addEventListener('click', hide);
    head.appendChild(x);
    box.appendChild(head);

    var body = el('div', 'abody');
    var G = CFG.groups();
    Object.keys(G).forEach(function (name) {
      var sec = el('details', 'agrp');
      sec.open = true;
      sec.appendChild(el('summary', null, name));
      var obj = G[name].obj, sch = G[name].schema;
      Object.keys(obj).forEach(function (k) {
        var v = obj[k];
        if (typeof v !== 'number' && typeof v !== 'string') return;   // массивы и вложенное панелью не правим
        var r = row(name, k, v, sch[k]);
        rows.push(r); sec.appendChild(r);
      });
      body.appendChild(sec);
    });
    box.appendChild(body);

    var foot = el('div', 'afoot');
    var bReset = el('button', null, 'Сбросить всё');
    bReset.addEventListener('click', function () {
      if (!window.confirm('Вернуть все настройки к заводским?')) return;
      CFG.reset(); rows.forEach(function (r) { r.refresh(); });
    });
    var bSave = el('button', 'aprim', 'Выгрузить tune.js');
    bSave.title = 'Скачать файл настроек — положить его рядом с index.html и закоммитить';
    bSave.addEventListener('click', function () {
      var blob = new Blob([CFG.exportJs()], { type: 'text/javascript' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'tune.js';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    });
    foot.appendChild(bReset); foot.appendChild(bSave);
    box.appendChild(foot);

    document.body.appendChild(box);
    built = true;
  }

  function show() { if (!built) build(); rows.forEach(function (r) { r.refresh(); }); box.style.display = 'flex'; }
  function hide() { if (box) box.style.display = 'none'; }
  function open() { return !!box && box.style.display !== 'none'; }

  return {
    show: show, hide: hide, open: open,
    toggle: function () { open() ? hide() : show(); }
  };
})();

if (/[?&]admin=1/.test(location.search)) try { Admin.show(); } catch (e) {}

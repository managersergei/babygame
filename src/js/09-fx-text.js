/* ═══════════════ 6. ЧАСТИЦЫ И НАДПИСИ ═══════════════ */
var partHead = 0;                    // куда писать следующую частицу, когда пул заполнен
function P(o) {
  o.life = o.life || 0.7; o.max = o.life; o.rot = o.rot || 0; o.vr = o.vr || 0;
  o.ay = o.ay == null ? 900 * S : o.ay;
  /* Раньше на переполнении звался shift() — сдвиг 420-элементного массива на КАЖДУЮ
     новую частицу. Переписываем самую старую по кругу: та же ёмкость, без сдвигов. */
  if (parts.length >= 420) { parts[partHead] = o; partHead = (partHead + 1) % 420; return; }
  parts.push(o);
}
function popText(txt, x, y, col) { texts.push({ t: txt, x: x, y: y, c: col || '#fff', life: 1.1, max: 1.1 }); }
/* Ряд наград до похвалы. Считать его в одном месте обязательно: проверка вехи
   стояла у двух предметов из восьми, и перепрыгнутый поезд «не считался». */
function bumpRow() { row++; if (!story && row >= TUNE.praiseEvery) { row = 0; milestone(); } }

/* Слово → иконка. Экраны итогов и панель родителя показывают слово картинкой:
   читать ребёнок не умеет, а картинку узнаёт. */
var WORD_ICON = (function () { var m = {}; for (var k in LESSONS) if (LESSONS[k].word) m[LESSONS[k].word] = LESSONS[k].icon || ''; return m; })();
function burst(x, y, n, col, spdv, kind) {
  for (var i = 0; i < n; i++) {
    var a = rnd(0, TAU), v = rnd(0.35, 1) * spdv;
    P({ x:x, y:y, vx:Math.cos(a)*v, vy:Math.abs(Math.sin(a))*v + spdv*0.35,
        r: rnd(4,11)*S, c: Array.isArray(col)?pick(col):col, kind: kind||'dot',
        life: rnd(0.5,1.1), vr: rnd(-9,9) });
  }
}


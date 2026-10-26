/* ═══════════════ 3D-ОСНОВА: ОДИН WebGL-КОНТЕКСТ НА ВСЮ ИГРУ ═══════════════
   Общая часть для «руля» (33b-lane3d.js) и платформера (17b-plat3d.js): ленивая загрузка
   three.js, единственный WebGL-холст под игровым #cv, ограничитель плотности пикселей и
   потеря контекста. Сцены у режимов свои, рендерер и холст — один.

   Жизненный цикл: load() — импорт three.js (один раз). renderer() — создаёт холст и
   WebGLRenderer при первом запросе. frame(cap) — раз в кадр перед render(): размер, DPR,
   показать холст. post() — из главного цикла: холст скрыт в кадре, где никто не рисовал
   3D; на экранах без 3D контекст отдаётся системе (iOS теряет его сам — bugs.webkit.org/289601).
   Потеря контекста = навсегда 2D: каждый пользователь получает lost() и рисует по-старому. */
var R3D = (function () {
  var st = 0;                     // 0 — не грузили, 1 — грузим, 2 — three.js в памяти, −1 — отказ (навсегда 2D)
  var T3 = null, R = null, glc = null, users = [], drew = false, shown = false;
  var vw = 0, vh = 0, vdpr = 0, dprNow = 1.5, slowN = 0, lastT = 0;
  var KEEP = { lane: 1, lesson: 1, play: 1, result: 1, over: 1, ask: 1 };   // здесь 3D может понадобиться в следующем кадре

  function hasGL() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
    catch (e) { return false; }
  }
  function load() {
    if (st !== 0) return;
    if (!hasGL()) { st = -1; return; }
    st = 1;
    import('./vendor/three/three.module.min.js').then(function (m) { T3 = m; st = 2; }, function () { st = -1; });
  }
  function lost() {
    st = -1;
    try { if (glc) glc.style.display = 'none'; } catch (e) {}
    shown = false;
    for (var i = 0; i < users.length; i++) try { users[i].lost(); } catch (e) {}
  }
  function renderer() {
    if (st !== 2) return null;
    if (R) return R;
    try {
      glc = document.createElement('canvas');
      glc.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:none;pointer-events:none';
      cv.parentNode.insertBefore(glc, cv);                   // под игровым холстом: HUD рисуется поверх
      /* powerPreference по умолчанию: high-performance вместе со сглаживанием на iPhone
         давал 20 кадров вместо 120 (bugs.webkit.org/276959). */
      R = new T3.WebGLRenderer({ canvas: glc, antialias: true, alpha: false, powerPreference: 'default' });
      R.shadowMap.enabled = true; R.shadowMap.type = T3.PCFSoftShadowMap;
      glc.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost(); }, false);
    } catch (e) {
      try { if (glc && glc.parentNode) glc.parentNode.removeChild(glc); } catch (e2) {}
      R = null; glc = null; st = -1; return null;
    }
    return R;
  }
  /* Раз в кадр перед отрисовкой. Кадры тяжелее 16 мс 60 раз подряд — плотность до 1, обратно не поднимаем. */
  function frame(cap) {
    if (!R) return 0;
    var t0 = performance.now();
    if (lastT && t0 - lastT > 17.5) { if (++slowN > 60) { dprNow = 1; slowN = 0; } } else if (slowN > 0) slowN--;
    lastT = t0;
    var dpr = Math.min(cap || 1.5, dprNow, dprCap, window.devicePixelRatio || 1);
    if (W !== vw || H !== vh || dpr !== vdpr) { R.setPixelRatio(dpr); R.setSize(W, H, false); vw = W; vh = H; vdpr = dpr; }
    if (!shown) { glc.style.display = 'block'; shown = true; }
    drew = true;
    return dpr;
  }
  function post() {
    if (!R) return;
    if (!drew && shown) { glc.style.display = 'none'; shown = false; }
    if (!drew && !KEEP[state]) dispose();
    drew = false;
  }
  function dispose() {
    for (var i = 0; i < users.length; i++) try { users[i].release(); } catch (e) {}
    try { R.dispose(); R.forceContextLoss(); glc.parentNode.removeChild(glc); } catch (e) {}
    R = null; glc = null; shown = false; vw = vh = 0;
  }
  return {
    load: load, renderer: renderer, frame: frame, post: post,
    T: function () { return T3; },
    ready: function () { return st === 2; },
    dead: function () { return st === -1; },
    use: function (u) { users.push(u); },
    dpr: function () { return vdpr; }
  };
})();

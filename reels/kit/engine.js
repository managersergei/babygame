/* Reel kit — таймлайн на rAF. В браузере — превью в реальном времени со звуком;
   под record.mjs --vt — детерминированный покадровый рендер, реплики уходят в лог EV.
   API: dur(sec) · set(sel, {x,y,scale,rot,sx,sy,o}) · tw(sel, t0, dur, {x:[a,b], …}, ease)
        at(t, fn) · every(fn(t)) · say(t, text) · ev(t, name)
   Твины на одно свойство писать в хронологическом порядке: поздний побеждает. */
(function () {
  'use strict';
  var RENDER = /[?&]render=1/.test(location.search) || !!window.__vtTick;
  var items = [], perFrame = [], start = null, DUR = 10;
  var EASE = {
    linear: function (p) { return p; },
    out: function (p) { return 1 - Math.pow(1 - p, 3); },
    in: function (p) { return p * p * p; },
    inout: function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
    back: function (p) { var c = 1.70158, d = c + 1; return 1 + d * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    backin: function (p) { var c = 1.70158; return (c + 1) * p * p * p - c * p * p; },
    bounce: function (p) { var n = 7.5625, d = 2.75; if (p < 1 / d) return n * p * p; if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75; if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375; return n * (p -= 2.625 / d) * p + 0.984375; },
    arc: function (p) { return 4 * p * (1 - p); }              // 0 → 1 → 0: парабола прыжка
  };
  var state = new Map();
  function $(sel) { return typeof sel === 'string' ? document.querySelector(sel) : sel; }
  function st(el) { if (!state.has(el)) state.set(el, { x: 0, y: 0, scale: 1, rot: 0, sx: 1, sy: 1, o: 1 }); return state.get(el); }
  function apply(el) {
    var s = st(el);
    el.style.transform = 'translate(' + s.x + 'px,' + s.y + 'px) rotate(' + s.rot + 'deg) scale(' + (s.scale * s.sx) + ',' + (s.scale * s.sy) + ')';
    el.style.opacity = s.o;
  }
  window.set = function (sel, props) { var el = $(sel), s = st(el); for (var k in props) s[k] = props[k]; apply(el); };
  window.tw = function (sel, t0, d, props, ease) { items.push({ el: $(sel), t0: t0, dur: d, props: props, ease: EASE[ease || 'out'] }); };
  window.at = function (t0, fn) { items.push({ t0: t0, fn: fn, fired: false }); };
  window.every = function (fn) { perFrame.push(fn); };
  window.ev = function (t0, name, data) { at(t0, function () { console.log('EV ' + t0.toFixed(3) + ' ' + name + (data ? ' ' + data : '')); }); };
  window.say = function (t0, text) { at(t0, function () { console.log('EV ' + t0.toFixed(3) + ' say ' + JSON.stringify(text)); if (!RENDER) playVoice(text); }); };
  window.dur = function (d) { DUR = d; document.title = (document.title || 'reel') + ' · ' + d + 's'; };
  window.fnv = function (str) { var h = 0x811c9dc5, b = unescape(encodeURIComponent(str)); for (var i = 0; i < b.length; i++) { h ^= b.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); };
  function playVoice(text) { try { var a = new Audio('../../assets/voice/' + fnv(text) + '.mp3'); a.play().catch(function () {}); } catch (e) {} }
  function tick(now) {
    if (start === null) start = now;
    var t = (now - start) / 1000;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.fn) { if (!it.fired && t >= it.t0) { it.fired = true; it.fn(t); } continue; }
      if (t < it.t0) continue;
      var p = it.dur > 0 ? Math.min(1, (t - it.t0) / it.dur) : 1, e = it.ease(p), s = st(it.el);
      for (var k in it.props) { var v = it.props[k]; s[k] = v[0] + (v[1] - v[0]) * e; }
      apply(it.el);
    }
    for (var j = 0; j < perFrame.length; j++) perFrame[j](t);
    if (t <= DUR + 1) requestAnimationFrame(tick);
  }
  window.addEventListener('load', function () { requestAnimationFrame(tick); });
})();

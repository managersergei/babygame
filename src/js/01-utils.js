/* ═══════════════ 0. УТИЛИТЫ ═══════════════ */
var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
/* Случайность: обычно Math.random, а с ?seed=N — повторяемая (запись роликов, тесты). */
var RNG = (function () {
  var m = location.search.match(/[?&]seed=(\d+)/); if (!m) return Math.random;
  var a = (+m[1]) | 0;
  return function () { a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
})();
var rnd   = function (a, b) { return a + RNG() * (b - a); };
var ri    = function (a, b) { return Math.floor(rnd(a, b + 1)); };
var pick  = function (a) { return a[Math.floor(RNG() * a.length)]; };
var lerp  = function (a, b, t) { return a + (b - a) * t; };
var TAU   = Math.PI * 2;


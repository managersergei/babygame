/* dev: сообщаем родителю о падениях, чтобы ловить их автопроверкой */
window.addEventListener('error', function (e) {
  try { parent.postMessage({ err: (e.message || '?') + ' @' + (e.lineno || 0) }, '*'); } catch (x) {}
});

(function () {
'use strict';


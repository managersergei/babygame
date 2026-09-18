/* ═══════════════ 1. ХОЛСТ ═══════════════ */
var cv = document.getElementById('cv');
var g  = cv.getContext('2d', { alpha: false });   // кадр всегда закрашивается целиком — альфа-канал холста только добавляет смешение
var W = 0, H = 0, S = 1, GY = 0, DPR = 1;

/* Запас по производительности. Если кадры стабильно тяжелее 26 мс, опускаем
   плотность пикселей на ступень: на слабом телефоне лучше чуть мягче, чем рывками.
   Обратно не поднимаем — качели между режимами заметнее, чем сама мягкость. */
var dprCap = 2, slowN = 0;
function perfStep(dt) {
  if (dprCap <= 1 || state === 'load') return;
  if (dt > 0.026) { if (++slowN >= 90) { dprCap = 1; slowN = 0; fit(); } }
  else if (slowN > 0) slowN--;
}

function fit() {
  DPR = Math.min(dprCap, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  S = clamp(Math.min(W / 1350, H / 800), 0.45, 1.7);
  // Горизонт держим на ~58% высоты. Раньше он стоял на 79% — над ним оставалось
  // полкадра пустого неба, а вся игра ютилась узкой полоской внизу.
  GY = Math.round(clamp(H * 0.58, H * 0.42, H - 210 * S) + 52 * S);
  CARX = W * 0.30;
  if (typeof LN !== 'undefined' && LN) LN.carY = clamp((H - 112) / H, 0.62, 0.90);   // низкий экран: кузов не должен уходить под кнопки
}
window.addEventListener('resize', fit);
function checkTurn() {                            // портрет на телефоне: просим повернуть
  var el = document.getElementById('turn');
  if (!el) return;
  var busy = ['parent', 'bot', 'pult'].some(function (id) {          // окно взрослого важнее подсказки о повороте
    var o = document.getElementById(id); return o && o.style.display !== 'none';
  });
  el.style.display = (!REC && !busy && window.innerWidth < window.innerHeight && window.innerWidth < 700) ? 'flex' : 'none';
}
window.addEventListener('resize', checkTurn);


/* Мир для сцен: небо, солнце, облака, холмы, дорога с разметкой, трава. world({night}) → узлы.
   Спрайты игры: car(id) — машинка (вид сбоку, едет вправо), sprite(name, h). Пути относительно reels/scenes/. */
/* Путь спрайта: сначала карта assets/paths.js (её грузит сцена), иначе прежнее правило. */
function spritePath(name) {
  var m = (typeof ASSET_PATH !== 'undefined') && ASSET_PATH[name];
  if (m) return '../../assets/' + m + '.webp';
  return '../../assets/' + (/^(monster|fire|race|police|ambulance|bus|excavator|garbage|tractor|tow)(_|$)/.test(name) ? 'cars/' : 'world/') + name + '.webp';
}
function world(opt) {
  opt = opt || {};
  var s = document.getElementById('stage');
  var h = '';
  h += '<div class="sky' + (opt.night ? ' night' : '') + '"></div>';
  h += '<div class="sun el mid" id="sun"></div>';
  h += '<div class="cloud el" id="c1" style="left:120px;top:330px"></div><div class="cloud el" id="c2" style="left:640px;top:480px;transform:scale(.7)"></div>';
  h += '<div class="hills"></div><div class="grass"></div>';
  h += '<div class="road"><div class="stripes el" id="stripes"></div></div>';
  s.insertAdjacentHTML('afterbegin', h);
  var stripes = document.getElementById('stripes'), off = 0;
  return {
    // road(t, speed): вызывать из every(); speed px/с, 0 — стоим
    road: function (dt, speed) { off = (off + speed * dt) % 240; stripes.style.transform = 'translate(' + (-off) + 'px,0)'; }
  };
}
/* спрайт машинки: якорь низ-центр в точке (x, groundY), высота h px */
function car(id, x, groundY, h, extraClass) {
  var img = document.createElement('img');
  img.className = 'el ' + (extraClass || ''); img.id = 'car'; img.src = spritePath(id);
  img.style.height = h + 'px'; img.style.left = x + 'px'; img.style.top = (groundY - h) + 'px';
  img.style.transform = 'translate(-50%,0)';
  document.getElementById('stage').appendChild(img);
  return img;
}
function sprite(name, x, groundY, h, id, cls) {
  var img = document.createElement('img');
  img.className = 'el ' + (cls || ''); if (id) img.id = id;
  img.src = spritePath(name);
  img.style.height = h + 'px'; img.style.left = x + 'px'; img.style.top = (groundY - h) + 'px';
  document.getElementById('stage').appendChild(img);
  return img;
}
function text(cls, html, id) {
  var d = document.createElement('div'); d.className = 'el txt ' + cls; if (id) d.id = id; d.innerHTML = html;
  document.getElementById('stage').appendChild(d); return d;
}
function endCard(t0, title, sub, cta) {
  var d = document.createElement('div'); d.className = 'el end'; d.id = 'end';
  d.innerHTML = '<div class="t1">' + title + '</div><div class="t2">' + sub + '</div><div class="t3">' + (cta || 'ссылка в профиле') + '</div>';
  document.getElementById('stage').appendChild(d);
  set('#end', { o: 0, y: 60 }); tw('#end', t0, 0.5, { o: [0, 1], y: [60, 0] }, 'out');
  tw('#end .t1', t0 + 0.15, 0.5, { scale: [0.7, 1] }, 'back');
}
/* Прыжок машинки через яму: anticipation → дуга со stretch → squash при приземлении */
function jump(sel, t0, h, len) {
  h = h || 330; len = len || 0.85;
  tw(sel, t0, 0.14, { sy: [1, 0.88], sx: [1, 1.08] }, 'out');                 // присед
  tw(sel, t0 + 0.14, 0.08, { sy: [0.88, 1.16], sx: [1.08, 0.9] }, 'out');    // отрыв: stretch
  tw(sel, t0 + 0.22, len, { y: [0, -h] }, 'arc');                             // дуга
  tw(sel, t0 + 0.22, len * 0.5, { rot: [0, -10] }, 'out');
  tw(sel, t0 + 0.22 + len * 0.5, len * 0.5, { rot: [-10, 6] }, 'in');
  tw(sel, t0 + 0.30, len - 0.16, { sy: [1.16, 1.0], sx: [0.9, 1.0] }, 'out');
  tw(sel, t0 + 0.22 + len, 0.09, { sy: [1, 0.78], sx: [1, 1.22], rot: [6, 0] }, 'out');   // squash
  tw(sel, t0 + 0.31 + len, 0.45, { sy: [0.78, 1], sx: [1.22, 1] }, 'back');              // отскок
}

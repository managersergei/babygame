/* ═══════════════ 17g. ТЕЛЕФОН-РУЛЬ ═══════════════
   pult.html на телефоне шлёт наклон и кнопки через WebRTC (PeerJS): без сервера,
   только сигналинг. Код из 4 знаков показываем на экране игры.               */
function loadScript(urls, cb) {
  var i = 0;
  (function next() {
    if (i >= urls.length) { cb(false); return; }
    var sc = document.createElement('script'); sc.src = urls[i++]; sc.async = true;
    sc.onload = function () { cb(true); }; sc.onerror = next;
    document.head.appendChild(sc);
  })();
}
var Pult = {
  on: false, everOn: false, steer: 0, gas: false, lastT: -9, code: '', token: '', peer: null, conn: null,
  loading: false, tries: 0, reT: 0, call: null,
  fresh: function () { return T - this.lastT < 1.5; },
  /* Раньше проверялось только «объект peer существует». После сна компьютера объект
     оставался, поэтому связь не переоткрывалась НИКОГДА, а телефон получал «такого кода нет». */
  dead: function () { return !this.peer || this.peer.destroyed || this.peer.disconnected; },
  ensure: function () {
    if (!REC && !this.loading && this.dead()) { this.drop(); this.open(); }
    this.showBox();
  },
  drop: function () {
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} }
    if (this.call) { try { this.call.close(); } catch (e) {} this.call = null; }
    this.peer = null; this.conn = null; this.on = false; this.steer = 0; this.gas = false; this.lastT = -9;
    Mic.backToLocal();
  },
  /* Код и токен постоянные: сервер отдаёт занятый id обратно, если токен совпал,
     поэтому у родителя на телефоне остаётся тот же код и тот же QR. */
  ident: function () {
    var alph = 'ABCDEFGHJKLMNPRSTUVWXYZ23456789', i;
    try {
      var sv = JSON.parse(localStorage.getItem('babygame.pult') || 'null');
      if (sv && /^[A-Z2-9]{4}$/.test(sv.c) && sv.t) { this.code = sv.c; this.token = sv.t; return; }
    } catch (e) {}
    var code = '', tok = '', a = new Uint8Array(20);
    try { crypto.getRandomValues(a); } catch (e) { for (i = 0; i < 20; i++) a[i] = Math.floor(Math.random() * 256); }
    for (i = 0; i < 4; i++) code += alph[a[i] % alph.length];
    for (i = 4; i < 20; i++) tok += (a[i] % 36).toString(36);
    this.code = code; this.token = tok;
    try { localStorage.setItem('babygame.pult', JSON.stringify({ c: code, t: tok })); } catch (e) {}
  },
  newCode: function () { try { localStorage.removeItem('babygame.pult'); } catch (e) {} this.ident(); },
  open: function () {
    var self = this;
    self.ident(); self.loading = true;
    loadScript(['https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'], function (okk) {
      self.loading = false;
      if (!okk || !window.Peer) { self.status('Нет интернета — телефон-руль пока недоступен'); return; }
      var peer = new window.Peer('bgame-' + self.code, { debug: 0, token: self.token });
      self.peer = peer;
      peer.on('open', function () { self.tries = 0; self.status('Ждём телефон…'); self.render(); });
      peer.on('connection', function (conn) {
        if (self.conn) { try { self.conn.close(); } catch (e) {} }     // старое соединение не должно перебивать статус
        self.conn = conn;
        conn.on('open', function () { self.on = true; self.everOn = true; self.status('Телефон подключён ✓'); A.coin(3); track('pult_on'); setTimeout(function () { self.hideBox(); }, 1200); });
        conn.on('data', function (m) { self.onData(m); });
        conn.on('close', function () { self.on = false; self.steer = 0; self.gas = false; self.status('Телефон отключился'); });
      });
      /* Телефон звонит со своим микрофоном: ребёнок держит телефон в руках, и его голос
         слышно лучше, чем через микрофон компьютера на другом конце комнаты. */
      peer.on('call', function (call) {
        try { call.answer(); } catch (e) { return; }
        call.on('stream', function (stream) {
          if (Mic.fromPhone(stream)) { self.status('Микрофон телефона подключён 🎤'); track('mic_phone'); }
        });
        call.on('close', function () { Mic.backToLocal(); });
        self.call = call;
      });
      peer.on('disconnected', function () { self.status('Восстанавливаю связь…'); self.retry(); });
      peer.on('close', function () { self.peer = null; self.on = false; });
      peer.on('error', function (e) {
        var t = (e && e.type) || '';
        if (t === 'unavailable-id') { self.drop(); self.newCode(); self.open(); return; }   // код занял кто-то другой
        if (t === 'network' || t === 'socket-error' || t === 'socket-closed') { self.retry(); return; }
        self.status('Ошибка связи: ' + t);
      });
    });
  },
  /* Лестница попыток: 0,5 → 2 → 5 секунд. Без неё при пропавшем интернете получается
     бесконечный цикл reconnect → error → reconnect. */
  retry: function () {
    var self = this;
    if (self.reT || self.tries > 6) return;
    var wait = [500, 500, 2000, 2000, 5000, 5000, 5000][self.tries++] || 5000;
    self.reT = setTimeout(function () {
      self.reT = 0;
      if (!self.peer || self.peer.destroyed) { self.drop(); self.open(); return; }
      if (self.peer.disconnected) { try { self.peer.reconnect(); } catch (e) { self.drop(); self.open(); } }
    }, wait);
  },
  wake: function () {                       // компьютер проснулся или вкладка вернулась
    if (REC || !this.peer) return;
    if (this.peer.destroyed) { this.drop(); this.open(); }
    else if (this.peer.disconnected) { this.tries = 0; this.retry(); }
  },
  onData: function (m) {
    if (!m) return;
    if (m.t === 'steer') {
      if (m.off) { this.steer = 0; this.lastT = -9; return; }   // наклон выключили — сразу отдаём управление кнопкам
      this.steer = clamp(+m.v || 0, -1, 1); this.lastT = T;
    }
    else if (m.t === 'gas') this.gas = !!m.d;
    else if (m.t === 'key') { if (m.d) keyDown(m.k); else keyUp(m.k); }
  },
  url: function () {
    /* С file:// и с локального сервера свой адрес телефону бесполезен — он до него не
       дотянется. Отдаём боевой адрес: страница пульта там та же, а связь идёт через
       брокер PeerJS, так что подключение работает и со скачанной копии. */
    if (LOCAL_COPY) return SITE_URL + 'pult.html';
    return location.origin + location.pathname.replace(/[^\/]*$/, '') + 'pult.html';
  },
  render: function () {
    document.getElementById('pultCode').textContent = this.code || '····';
    document.getElementById('pultUrl').textContent = this.url().replace(/^https?:\/\//, '');
    var cvq = document.getElementById('pultQr'), link = this.url() + '?c=' + this.code;
    if (!this.code) return;
    if (window.qrcode) {
      try {
        var q = window.qrcode(0, 'M'); q.addData(link); q.make();
        var n = q.getModuleCount(), sz = 5; cvq.width = cvq.height = n * sz;
        var x = cvq.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cvq.width, cvq.height); x.fillStyle = '#2b2140';
        for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(c * sz, r * sz, sz, sz);
        cvq.style.display = 'block';
      } catch (e) {}
    } else if (!this.qrLoading) {
      this.qrLoading = true;
      loadScript(['https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', 'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'], function (okk) { if (okk) Pult.render(); });
    }
  },
  status: function (s) { document.getElementById('pultState').textContent = s; },
  showBox: function () { document.getElementById('pult').style.display = 'flex'; this.render(); },
  hideBox: function () { var b = document.getElementById('pult'); if (b) b.style.display = 'none'; },
  toggle: function () { var b = document.getElementById('pult'); if (b.style.display === 'none') this.ensure(); else this.hideBox(); }
};
document.getElementById('bPult').addEventListener('click', function () { Pult.toggle(); });
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') Pult.wake(); });
/* Свернули вкладку или погас экран телефона — игра не должна продолжать шуметь
   в кармане. Возвращаемся — музыка сама поднимается. */
document.addEventListener('visibilitychange', function () {
  var bm = document.getElementById('bgm');
  if (document.visibilityState === 'hidden') {
    if (bm) { try { bm.pause(); } catch (e) {} }
    A.engine(0, 1, false); A.hush();
  } else if (state !== 'load') A.music();
});
window.addEventListener('online', function () { Pult.wake(); });
window.addEventListener('pageshow', function () { Pult.wake(); });
['click', 'pointerup'].forEach(function (ev) { document.getElementById('pultClose').addEventListener(ev, function () { Pult.hideBox(); }); });
document.getElementById('bInfo').addEventListener('click', function () { showParent(); });
['click', 'pointerup'].forEach(function (ev) { document.getElementById('parentGo').addEventListener(ev, parentOk); });
function showParent() { document.getElementById('parent').style.display = 'flex'; TG.hint(); checkTurn(); }
function parentOk() {
  document.getElementById('parent').style.display = 'none';
  try { localStorage.setItem('babygame.parent', '1'); } catch (e) {}
  A.init(); track('parent_ok'); checkTurn();
}
/* Окно с QR телеграм-бота — отдельное, чтобы не путалось с QR телефона-руля. */
function showBot() { document.getElementById('bot').style.display = 'flex'; TG.render(); checkTurn(); }
function hideBot() { document.getElementById('bot').style.display = 'none'; TG.pollId++; checkTurn(); }
document.getElementById('tgOpen').addEventListener('click', function () { if (TG.code) showBot(); });   // без кода окно пустое — не открываем
['click', 'pointerup'].forEach(function (ev) { document.getElementById('botClose').addEventListener(ev, hideBot); });
document.getElementById('tgCopy').addEventListener('click', function () {
  var b = this, link = TG.link(), done = function () { b.textContent = 'скопировано ✓'; setTimeout(function () { b.textContent = 'копировать'; }, 1600); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(link).then(done, fallback); return; }
  } catch (e) {}
  fallback();
  function fallback() {                                  // Safari по http и старые браузеры
    var t = document.createElement('textarea');
    t.value = link; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(t);
  }
});


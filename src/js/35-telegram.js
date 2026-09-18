/* ═══════════════ 17e. ОТЧЁТЫ РОДИТЕЛЮ В TELEGRAM ═══════════════
   Токена бота в игре нет. События копятся тут и уходят POST'ом на реле (tg/worker.js,
   Cloudflare Worker) вместе с кодом привязки; реле по коду находит chat_id и шлёт sendMessage.
   Код — 10 знаков в localStorage; родитель привязывает его по https://t.me/<бот>?start=<код>
   (QR или ссылка на экране «Родителям»). Частота: не чаще 1 сообщения в TG_MIN минут, сводка —
   при уходе со страницы и после TG_IDLE минут тишины. Уходят только код, слова, звёзды, машинка. */
/* Боевой адрес игры. Нужен, когда её открыли с диска или с локального сервера:
   телефон и телеграм-бот должны вести на место, до которого дотянется интернет. */
var SITE_URL = 'https://managersergei.github.io/babygame/';
var LOCAL_COPY = location.protocol === 'file:' ||
                 /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$)/.test(location.hostname);

var TG_BOT  = 'big_drive_bot';              // username бота без @; '' — функция выключена (как YM_ID = 0).
                               // Как включить: tg/README.md (BotFather → Cloudflare Worker → сюда username и адрес реле)
var TG_API  = 'https://babygame-tg.bigdrive.workers.dev';              // адрес реле, напр. 'https://babygame-tg.<аккаунт>.workers.dev'
var TG_MIN  = 3;               // минут между сообщениями по ходу игры
var TG_IDLE = 5;               // минут без событий → накопленное уходит сводкой
var TG_CAP  = 20;              // потолок промежуточных сообщений за запуск страницы (сводки — вне лимита)

var qrWait = [], qrLoad = 0;   // очередь на отрисовку, пока грузится библиотека: 0 нет, 1 грузим, 2 есть, -1 не вышло
function qrInto(cvq, text, sz) {
  if (!cvq) return;
  if (window.qrcode) {
    try {
      var q = window.qrcode(0, 'M'); q.addData(text); q.make();
      var n = q.getModuleCount(); cvq.width = cvq.height = n * sz;
      var x = cvq.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cvq.width, cvq.height); x.fillStyle = '#2b2140';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(c * sz, r * sz, sz, sz);
      cvq.style.display = 'block';
    } catch (e) {}
    return;
  }
  if (qrLoad === -1) return;
  qrWait.push([cvq, text, sz]);
  if (qrLoad === 1) return;
  qrLoad = 1;
  loadScript(['https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', 'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js'], function (okk) {
    qrLoad = okk ? 2 : -1;
    var w = qrWait; qrWait = [];
    if (okk) for (var i = 0; i < w.length; i++) qrInto(w[i][0], w[i][1], w[i][2]);
  });
}

function tgEmpty() { return { car: '', stars: 0, levels: 0, over: 0, words: {}, learned: [] }; }
var TG = {
  code: '', on: false, dirty: false, sent: 0, nAll: 0, lastSent: 0, lastEv: 0, lastStars: 0, t0: 0, pollId: 0, polls: 0,
  sum: tgEmpty(), tot: tgEmpty(),          // sum — с последней отправки, tot — с начала сессии (для сводки)
  init: function () {
    var tq = /[?&]test=1/.test(location.search) && (location.search.match(/[?&]tg=([^&]+)/) || [])[1];
    if (tq) { TG_API = decodeURIComponent(tq); TG_BOT = TG_BOT || 'test_bot'; }   // автопроверка: реле-заглушка
    this.localOnly = LOCAL_COPY && !tq;      // код и QR показываем всегда, прогресс с локальной копии не шлём
    if (!TG_BOT || !TG_API || REC) return;
    try {
      this.code = localStorage.getItem('babygame.tg') || '';
      if (!/^[A-Z2-9]{10}$/.test(this.code)) { this.code = this.mkCode(); localStorage.setItem('babygame.tg', this.code); }
      this.on = localStorage.getItem('babygame.tg.on') === '1';
    } catch (e) { this.code = ''; return; }
    this.t0 = Date.now();
    var self = this;
    if (!this.localOnly) {
      setInterval(function () { self.tick(); }, 15000);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') self.flush(true); });
      window.addEventListener('pagehide', function () { self.flush(true); });
      if (this.on) this.status();                                  // вдруг родитель нажал /stop
    }
    this.hint();
  },
  mkCode: function () {
    var alph = 'ABCDEFGHJKLMNPRSTUVWXYZ23456789', s = '', a = new Uint8Array(10), i;
    try { crypto.getRandomValues(a); } catch (e) { for (i = 0; i < 10; i++) a[i] = Math.floor(Math.random() * 256); }
    for (i = 0; i < 10; i++) s += alph[a[i] % alph.length];
    return s;
  },
  link: function () { return 'https://t.me/' + TG_BOT + '?start=' + this.code; },
  touch: function () { this.dirty = true; this.lastEv = Date.now(); },
  add: function (k, v) { this.sum[k] += v; this.tot[k] += v; this.touch(); },
  sample: function () {                                             // звёзды — по глобальному счётчику, без правок в 8 местах
    if (stars < this.lastStars) this.lastStars = 0;                // новый заезд: resetWorld() обнулил stars
    if (stars > this.lastStars) { this.add('stars', stars - this.lastStars); this.lastStars = stars; }
  },
  ev: function (name, p) {                                          // вызывается из track()
    if (!this.code) return;
    if (name === 'start') { this.sample(); this.sum.car = this.tot.car = CARS[sel].name; }
    else if (name === 'word') {
      this.sum.words[p.word] = this.tot.words[p.word] = p.n;
      if (p.n === Stats.need) { this.sum.learned.push(p.word); this.tot.learned.push(p.word); }
      this.touch();
    }
    else if (name === 'stage_done') this.add('levels', 1);
    else if (name === 'over') this.add('over', 1);
  },
  tick: function () {
    if (!this.on || !this.code) return;
    this.sample();
    if (!this.dirty) return;
    var now = Date.now();
    if (now - this.lastEv > TG_IDLE * 60000) { this.flush(true); return; }          // ребёнок ушёл — сводка
    if (now - this.lastSent >= TG_MIN * 60000 && this.nAll < TG_CAP) this.flush(false);
  },
  flush: function (fin) {
    if (!this.on || !this.code) return;
    this.sample();
    if (!this.dirty && !(fin && this.sent > 0)) return;            // сводка нужна, только если что-то уже уходило
    var body = JSON.stringify({ c: this.code, fin: !!fin, dur: Math.round((Date.now() - this.t0) / 60000),
                                need: Stats.need, sum: fin ? this.tot : this.sum });
    var car = this.tot.car;
    this.sum = tgEmpty(); this.dirty = false; this.lastSent = Date.now(); this.nAll++;
    if (fin) { this.tot = tgEmpty(); this.tot.car = car; this.sent = 0; this.t0 = Date.now(); } else this.sent++;
    var url = TG_API + '/ev', self = this;
    if (fin && navigator.sendBeacon) { try { if (navigator.sendBeacon(url, body)) return; } catch (e) {} }
    try {
      fetch(url, { method: 'POST', body: body, keepalive: true }).then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.linked === false) self.setOn(false); }).catch(function () {});
    } catch (e) {}
  },
  setOn: function (v) {
    this.on = !!v;
    try { localStorage.setItem('babygame.tg.on', v ? '1' : '0'); } catch (e) {}
    var st = document.getElementById('tgState');
    if (st) st.textContent = v ? 'Telegram привязан ✓ — отчёты будут приходить' : 'Пока не привязано';
  },
  status: function (cb) {
    var self = this;
    try {
      fetch(TG_API + '/status?c=' + this.code).then(function (r) { return r.json(); })
        .then(function (j) { if (j && typeof j.linked === 'boolean') self.setOn(j.linked); if (cb) cb(); })
        .catch(function () { if (cb) cb(); });
    } catch (e) { if (cb) cb(); }
  },
  render: function () {                                             // экран «Родителям»
    if (!this.code) return;
    var a = document.getElementById('tgLink'), link = this.link();
    a.href = link; a.textContent = link.replace(/^https:\/\//, '');
    this.setOn(this.on);
    qrInto(document.getElementById('tgQr'), link, 6);
    var st = document.getElementById('tgState');
    if (this.localOnly && st) st.textContent = 'Привязать можно, но отчёты пойдут, когда игру откроют с сайта';
    if (this.localOnly) return;                                    // реле не принимает локальный адрес — опрашивать нечего
    this.polls = 0; this.poll(++this.pollId);
  },
  hint: function () {                                               // строка «Отчёты в Telegram» на экране «Родителям»
    var el = document.getElementById('tgOpen');
    if (!el) return;
    el.style.display = '';
    if (this.code) {
      el.textContent = '📲 Отчёты о прогрессе в Telegram';
      el.style.cursor = 'pointer'; el.style.textDecoration = 'underline'; el.style.color = '#2b6cb0';
      return;
    }
    el.textContent = '📲 Телеграм-бот сейчас недоступен';
    el.style.cursor = 'default'; el.style.textDecoration = 'none'; el.style.color = '#8a94a6';
  },
  poll: function (id) {                                             // пока экран открыт и не привязано — спрашиваем реле раз в 5 с, до 2 минут
    var self = this;
    this.status(function () {
      if (id !== self.pollId || self.on || self.polls++ >= 24) return;
      setTimeout(function () {
        if (id === self.pollId && document.getElementById('bot').style.display !== 'none') self.poll(id);
      }, 5000);
    });
  },
  dbg: function () { return { code: this.code, on: this.on, dirty: this.dirty, sent: this.sent, all: this.nAll, sum: this.sum, tot: this.tot }; }
};



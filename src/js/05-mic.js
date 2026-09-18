/* ═══════════════ 3b. МИКРОФОН ═══════════════
   Слушает ребёнка и сохраняет «отпечаток» произнесённого слова (16 полос спектра,
   24 кадра, нормировка). Пока это калибровка: игра принимает любую попытку и копит
   образцы — на них потом встанет распознавание команд (DTW).                       */
var Mic = (function () {
  var ac = null, an = null, bins = null, rdy = false, denied = false, asked = false;
  var listening = false, frames = [], speaking = false, quiet = 0, tout = 0, floorE = 10, lvl = 0, cb = null, cont = null;
  var node = null, sink = null, src = 'local';   // src: откуда слушаем — 'local' или 'phone'
  var spokeT = 0, talkT = 0;          // сколько длится фраза и сколько ещё не слушаем после своей же речи

  var lastAsk = -99, err = '', tries = 0, perm = '?';
  var devId = null, devName = '', devList = [], devIx = -1, silent = 0, cur = null, pending = false;

  /* Запись одной попытки для родителя: MediaRecorder на том же потоке. */
  var rec = null, recTag = null, recT0 = 0, recSpk = -1, recEnd = -1, recMime = null;
  function nowS() { return (window.performance && performance.now ? performance.now() : Date.now()) / 1000; }
  function recType() {
    if (recMime !== null) return recMime;
    recMime = '';
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return recMime;
    var list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];   // mp4 — iOS Safari
    for (var i = 0; i < list.length; i++) { try { if (MediaRecorder.isTypeSupported(list[i])) { recMime = list[i]; break; } } catch (e) {} }
    return recMime;
  }
  function recBegin(tag) {                          // tag = { word:'ПРЫЖОК', key:'el_jump0' }
    if (rec || !cur || !rdy || !Voice.on || !Rec.on) return;
    var mt = recType(); if (!mt) return;
    var chunks = [], r;
    try { r = new MediaRecorder(cur, { mimeType: mt, audioBitsPerSecond: 48000 }); } catch (e) { return; }
    rec = r; recTag = tag; recSpk = -1; recEnd = -1; recT0 = nowS();
    r.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    r.onerror = function () { if (rec === r) { rec = null; recTag = null; } };
    r.onstop = function () {
      var tag2 = recTag, spk = recSpk, end = recEnd, t0 = recT0;
      if (rec === r) { rec = null; recTag = null; }
      if (!tag2 || spk < 0 || !chunks.length) return;              // не заговорил или попытка отменена
      var at = Math.max(0, spk - t0 - 1.5), to = (end < 0 ? nowS() : end) - t0 + 1.5;
      Rec.fromBlob(new Blob(chunks, { type: mt }), ac, at, to, tag2);
    };
    try { r.start(); } catch (e) { rec = null; recTag = null; }     // без timeslice: iOS отдаёт данные только на stop
  }
  function recSpoke() { if (rec && recSpk < 0) recSpk = nowS(); }
  function recDone(keep) {                            // keep=false — попытку выбрасываем
    var r = rec; if (!r) return;
    if (!keep) recTag = null;
    recEnd = nowS();
    setTimeout(function () { try { if (r.state !== 'inactive') r.stop(); } catch (e) {} }, keep ? 1500 : 0);
  }

  function drop(why) {                             // поток умер — сбрасываем и пробуем снова
    recDone(false);
    err = why; rdy = false;
    try { if (cur) cur.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    cur = null; ac = null; an = null; lastAsk = -99;
  }

  var badDev = {};
  function rankDev(d) {                            // встроенный микрофон — самый надёжный
    var n = (d.label || '').toLowerCase();
    if (badDev[d.deviceId]) return 9;
    if (/built-?in|встроен|macbook|internal/.test(n)) return 0;
    if (d.deviceId === 'default') return 1;
    if (/iphone|ipad|continuity|pops/.test(n)) return 5;   // телефон как микрофон часто отваливается
    return 2;
  }
  function nextDevice() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    if (devId) badDev[devId] = 1;                  // текущий не работает — больше не берём
    navigator.mediaDevices.enumerateDevices().then(function (ds) {
      devList = ds.filter(function (d) { return d.kind === 'audioinput'; });
      if (!devList.length) return;
      var sorted = devList.slice().sort(function (a, b) { return rankDev(a) - rankDev(b); });
      var pickd = sorted[0];
      if (rankDev(pickd) >= 9) { badDev = {}; pickd = sorted[0]; }   // все перепробованы — заходим на второй круг
      devId = pickd.deviceId; devName = pickd.label || '';
      lastAsk = -99;
    }).catch(function () {});
  }
  try {
    if (navigator.permissions && navigator.permissions.query)
      navigator.permissions.query({ name: 'microphone' })
        .then(function (st) { perm = st.state; st.onchange = function () { perm = st.state; }; })
        .catch(function () { perm = 'n/a'; });
  } catch (e) { perm = 'n/a'; }
  /* user = true — запрос по явному действию (кнопка, первое нажатие клавиши).
     Автоматические повторы разрешены только когда доступ уже выдан: тогда браузер
     ничего не спрашивает. Пока разрешения нет — спрашиваем ровно один раз. */
  function request(user) {
    if (rdy || denied || pending) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { denied = true; err = 'нет API'; return; }
    if (!user && perm !== 'granted' && asked) return;      // не переспрашиваем сами
    var now = (window.performance && performance.now ? performance.now() : Date.now()) / 1000;
    if (now - lastAsk < 3) return;
    lastAsk = now; asked = true; tries++; pending = true;
    var base = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    var want = devId ? { deviceId: { exact: devId }, echoCancellation: true,
                         noiseSuppression: true, autoGainControl: true } : base;
    navigator.mediaDevices.getUserMedia({ audio: want })
      .then(function (stream) { attach(stream, 'local'); pending = false; })
      .catch(function (e) {
        pending = false;
        err = (e && e.name) || 'ошибка';
        if (err === 'NotAllowedError' || err === 'SecurityError') { denied = true; return; }
        nextDevice();                              // занято или недоступно — пробуем другой вход
      });
  }
  /* Один вход на всю игру: сюда приходит и локальный микрофон, и поток с телефона.
     Контекст создаётся ОДИН раз — раньше каждый повторный запрос плодил новый AudioContext. */
  function attach(stream, kind) {
    var tr = stream.getAudioTracks()[0];
    if (tr) {
      devName = tr.label || '';
      tr.onended = function () { if (src === kind) drop('устройство отключилось'); };
      tr.onmute = function () { if (src === kind) drop('микрофон замолчал'); };
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!ac) ac = new AC();
    if (ac.state === 'suspended') ac.resume();          // иначе анализатор отдаёт тишину
    if (!an) { an = ac.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.25; }
    if (node) { try { node.disconnect(); } catch (e) {} }
    node = ac.createMediaStreamSource(stream);
    node.connect(an);
    /* Chromium отдаёт из удалённого потока тишину, пока поток не «проигрывается»
       хоть куда-то. Держим скрытый беззвучный аудиоэлемент — только ради этого. */
    if (kind === 'phone') {
      if (!sink) {
        sink = document.createElement('audio');
        sink.muted = true; sink.autoplay = true; sink.setAttribute('playsinline', '');
        sink.style.display = 'none'; document.body.appendChild(sink);
      }
      try { sink.srcObject = stream; var pp = sink.play(); if (pp && pp.catch) pp.catch(function () {}); } catch (e) {}
    }
    bins = new Uint8Array(an.frequencyBinCount);
    cur = stream; src = kind; rdy = true; err = ''; silent = 0;
    floorE = 10;                                        // другой микрофон — другой уровень шума
  }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }

  function bands() {                       // 16 логарифмических полос
    an.getByteFrequencyData(bins);
    var f = [], e = 0, es = 0, ns = 0, n = bins.length;
    var hz = (ac ? ac.sampleRate : 48000) / (an ? an.fftSize : 2048);   // ширина одной корзины по частоте
    for (var b = 0; b < 16; b++) {
      var lo = Math.floor(Math.pow(n, b / 16)) - 1, hi = Math.floor(Math.pow(n, (b + 1) / 16));
      if (lo < 0) lo = 0; if (hi <= lo) hi = lo + 1;
      var sum = 0;
      for (var i = lo; i < hi; i++) sum += bins[i];
      var v = sum / (hi - lo);
      f.push(v); e += v;
      if (hi * hz > 300 && lo * hz < 3400) { es += v; ns++; }           // речевая полоса
    }
    return { f: f, e: e / 16, es: ns ? es / ns : e / 16 };
  }

  function shape(fr) {                     // 24 кадра, нормировка по максимуму
    var N = 24, out = [], mx = 1, i, j;
    for (i = 0; i < N; i++) {
      var t = i / (N - 1) * (fr.length - 1), a = Math.floor(t), b2 = Math.min(fr.length - 1, a + 1), k = t - a, row = [];
      for (j = 0; j < 16; j++) row.push(fr[a][j] * (1 - k) + fr[b2][j] * k);
      out.push(row);
    }
    for (i = 0; i < N; i++) for (j = 0; j < 16; j++) if (out[i][j] > mx) mx = out[i][j];
    for (i = 0; i < N; i++) for (j = 0; j < 16; j++) out[i][j] = Math.round(out[i][j] / mx * 100);
    return out;
  }

  /* Слишком короткое — не слово: хлопок, стук, скрип стула. Четверть секунды речи —
     нижняя граница, ниже начинают проходить шумы, выше отсекаются короткие «би», «дай». */
  function good() { return spokeT > 0.25 && frames.length > 5; }

  function finish(sample) {
    recDone(!!sample);
    speaking = false; frames = []; quiet = 0; spokeT = 0;
    if (!cont) A.duck(false);
    if (cont) {                                   // непрерывный режим: слушаем дальше
      listening = true; tout = 1e9;
      if (sample) cont(sample);
      return;
    }
    listening = false;
    var f = cb; cb = null;
    if (f) f(sample);
  }

  return {
    request: request,
    resume: resume,
    err: function () { return err; },
    ready: function () { return rdy; },
    denied: function () { return denied; },
    level: function () { return clamp((lvl - floorE * 0.8) / 22, 0, 1); },
    alive: function () { return rdy && silent < 2; },
    dbg: function () { var sn = (Voice.sens == null ? 0.35 : Voice.sens);
                       return { lvl: lvl, floor: floorE, spoke: +spokeT.toFixed(2), talkT: +talkT.toFixed(2),
                                th: Math.max(11, Math.min(60, (floorE * 1.5 + 6) * (1.7 - sn))),
                                err: err, ctx: ac ? ac.state : '-', tries: tries, perm: perm,
                                dev: devName || '-', devs: devList.length }; },
    busy: function () { return listening; },
    record: recBegin,
    recording: function () { return !!rec; },
    src: function () { return src; },
    fromPhone: function (stream) {                       // поток пришёл с телефона по WebRTC
      try { attach(stream, 'phone'); denied = false; return true; } catch (e) { return false; }
    },
    backToLocal: function () { if (src === 'phone') { src = 'local'; rdy = false; request(false); } },
    cancel: function () { listening = false; speaking = false; cb = null; cont = null; recDone(false); A.duck(false); },
    arm: function (fn) { if (!rdy) return; cont = fn; listening = true; speaking = false; frames = []; quiet = 0; tout = 1e9; },
    disarm: function () { cont = null; listening = false; speaking = false; },
    armed: function () { return !!cont; },
    listen: function (secs, done) {
      if (!rdy) { done(null); return; }
      resume();
      A.duck(true);                                  // приглушаем музыку, чтобы не мешала слушать
      cont = null; listening = true; speaking = false; frames = []; quiet = 0; tout = secs; cb = done;
    },
    poll: function (dt) {
      if (!rdy) {                                   // поток пропал — восстанавливаем молча,
        if (Voice.on && !denied) request(false);    // но только если разрешение уже выдано
        return;
      }
      var r = bands();
      lvl = r.e;
      /* Игра слышит саму себя: пока говорит диктор — не слушаем и обрываем начатую фразу,
         плюс четверть секунды на хвост эха. */
      if (A.talking()) { talkT = 0.25; if (speaking) { speaking = false; frames = []; quiet = 0; } }
      else if (talkT > 0) talkT = Math.max(0, talkT - dt);
      /* Шумовой порог подстраивается под комнату ВСЕГДА, кроме своей речи и чужой фразы.
         Раньше он замерзал на весь заезд (в бою listening всегда true) и любой громкий
         звук открывал запись. */
      if (!speaking && talkT <= 0) floorE = floorE * 0.97 + r.es * 0.03;
      floorE = Math.min(floorE, 36);                                       // потолок: в шумной комнате порог должен успевать подняться
      var sn = (Voice.sens == null ? 0.35 : Voice.sens);      // 0 — глухо, 1 — очень чутко
      var th = Math.max(11, Math.min(60, (floorE * 1.5 + 6) * (1.7 - sn)));
      if (r.e < 0.4) {                            // поток есть, а звука нет — вход мёртвый
        silent += dt;
        if (silent > (listening ? 4 : 7)) { silent = 0; drop('вход молчит'); nextDevice(); }
      } else silent = 0;
      if (!listening || talkT > 0) return;
      tout -= dt;
      if (speaking) {
        frames.push(r.f); spokeT += dt;
        if (r.es < th * 0.7) { quiet += dt; if (quiet > 0.45 || frames.length > 110) finish(good() ? shape(frames) : null); }
        else quiet = 0;
      } else if (r.es > th) { speaking = true; spokeT = 0; frames = [r.f]; quiet = 0; recSpoke(); }
      if (tout <= 0) finish(speaking && good() ? shape(frames) : null);
    }
  };
})();

/* Что ребёнок уже проговаривал: слово → сколько раз и в какой сессии в последний раз.
   Слово перестаём предлагать после 5 повторов, а до того — не чаще раза в 3 сессии. */
var Stats = {
  need: 5, gap: 3,
  data: (function () { try { return JSON.parse(localStorage.getItem('babygame.stats') || '{}'); } catch (e) { return {}; } })(),
  session: (function () {
    var n = 0;
    try { n = (+localStorage.getItem('babygame.session') || 0) + 1; localStorage.setItem('babygame.session', n); } catch (e) {}
    return n;
  })(),
  save: function () { try { localStorage.setItem('babygame.stats', JSON.stringify(this.data)); } catch (e) {} },
  bump: function (word) {
    if (!word) return;
    var d = this.data[word] || (this.data[word] = { n: 0, s: 0 });
    d.n++; d.s = this.session; this.save();
    try { track('word', { word: word, n: d.n }); } catch (e) {}   // → бот: «сказал слово n из 5», на пятом — «выучил»
  },
  again: 6,                                    // через столько заходов выученное слово повторяем
  known: function (word) { var d = this.data[word]; return !!d && d.n >= this.need; },   // умеет говорить и как команда
  reset: function () { this.data = {}; this.save(); },
  canTeach: function (word) {
    var d = this.data[word];
    if (!d) return true;
    if (d.n >= this.need) return (this.session - d.s) >= this.again;   // повторяем, но редко
    return (this.session - d.s) >= this.gap;
  },
  list: function () {
    var out = [];
    for (var w in this.data) out.push({ w: w, n: this.data[w].n, s: this.data[w].s });
    out.sort(function (a, b) { return b.n - a.n; });
    return out;
  }
};

/* Копилка образцов голоса + сравнение по DTW.
   Игра узнаёт слово не «по-русски», а по тому, как его говорит именно этот ребёнок. */
var Voice = {
  data: (function () { try { return JSON.parse(localStorage.getItem('babygame.voice') || '{}'); } catch (e) { return {}; } })(),
  on: (function () { try { return localStorage.getItem('babygame.mic') !== '0'; } catch (e) { return true; } })(),
  sens: (function () { try { var v = localStorage.getItem('babygame.sens'); return v == null ? 0.35 : +v; }
                       catch (e) { return 0.35; } })(),
  setSens: function (v) { this.sens = v; try { localStorage.setItem('babygame.sens', v); } catch (e) {} },
  count: function (w) { return (this.data[w] || []).length; },
  add: function (w, sample) {
    if (!sample) return;
    var a = this.data[w] || (this.data[w] = []);
    a.push(sample);
    while (a.length > 5) a.shift();
    try { localStorage.setItem('babygame.voice', JSON.stringify(this.data)); } catch (e) {}
  },
  setOn: function (v) { this.on = v; try { localStorage.setItem('babygame.mic', v ? '1' : '0'); } catch (e) {} },
  reset: function () { this.data = {}; try { localStorage.removeItem('babygame.voice'); } catch (e) {} },

  dtw: function (a, b) {
    var n = a.length, m = b.length, INF = 1e9, prev = new Array(m + 1), cur = new Array(m + 1), i, j, k;
    for (j = 0; j <= m; j++) prev[j] = INF;
    prev[0] = 0;
    for (i = 1; i <= n; i++) {
      cur[0] = INF;
      for (j = 1; j <= m; j++) {
        var d = 0, ai = a[i - 1], bj = b[j - 1];
        for (k = 0; k < 16; k++) { var t = ai[k] - bj[k]; d += t * t; }
        d = Math.sqrt(d / 16);
        var mn = prev[j] < cur[j - 1] ? prev[j] : cur[j - 1];
        if (prev[j - 1] < mn) mn = prev[j - 1];
        cur[j] = d + mn;
      }
      for (j = 0; j <= m; j++) prev[j] = cur[j];
    }
    return prev[m] / (n + m);
  },

  /* Насколько образцы слова похожи друг на друга — из этого берём порог. */
  spread: function (w) {
    var a = this.data[w] || [], n = a.length, sum = 0, c = 0;
    for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) { sum += this.dtw(a[i], a[j]); c++; }
    return c ? sum / c : 14;
  },

  /* Ищем, какое из выученных слов сказали. words — список ключей. */
  match: function (sample, words) {
    if (!sample) return null;
    var best = null, self = null;
    for (var i = 0; i < words.length; i++) {
      var a = this.data[words[i]] || [];
      if (a.length < 2) continue;
      var d = 1e9;
      for (var j = 0; j < a.length; j++) { var t = this.dtw(sample, a[j]); if (t < d) d = t; }
      if (!best || d < best.dist) { best = { word: words[i], dist: d }; self = this.spread(words[i]); }
    }
    if (!best) return null;
    best.ok = best.dist < Math.max(11, self * 1.75);
    return best;
  }
};


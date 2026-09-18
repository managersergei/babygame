/* ═══════════════ 3. ЗВУК ═══════════════ */
var A = (function () {
  var ac = null, master = null, eng = null, engGain = null, engFilt = null, noiseBuf = null, muted = false;
  var roadF = null, roadG = null;                 // шум дороги: скорость должна быть слышна, а не только видна
  var chosen, cur = null, cache = {}, HAVE = {}, qq = [];
  (function () {
    var L = window.VOICE_LIST || [];
    for (var i = 0; i < L.length; i++) HAVE[L[i]] = 1;
  })();
  function fnv(str) {                                  // тот же хеш, что у генератора
    var h = 0x811c9dc5, b = unescape(encodeURIComponent(str));
    for (var i = 0; i < b.length; i++) { h ^= b.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = A.vol.sfx;    // сохранённая громкость, а не жёсткие 0,55
    /* Мягкий лимитер: на максимуме ползунка фанфара поверх мотора и монет уходила в хрип. */
    var lim = ac.createDynamicsCompressor();
    lim.threshold.value = -8; lim.knee.value = 8; lim.ratio.value = 12;
    lim.attack.value = 0.003; lim.release.value = 0.22;
    master.connect(lim); lim.connect(ac.destination);

    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = RNG() * 2 - 1;

    engFilt = ac.createBiquadFilter(); engFilt.type = 'lowpass'; engFilt.frequency.value = 620;
    engGain = ac.createGain(); engGain.gain.value = 0;
    eng = [];
    [1, 1.5, 2.02].forEach(function (m, i) {
      var o = ac.createOscillator();
      o.type = i === 0 ? 'sawtooth' : 'square';
      o.frequency.value = 60 * m;
      o.connect(engFilt); o.start();
      eng.push({ o: o, m: m });
    });
    engFilt.connect(engGain); engGain.connect(master);

    /* Шум дороги и ветра. Один зациклённый источник на всю игру: на кадр не влияет,
       громкость и срез ведёт engine() от скорости. */
    var rs = ac.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true;
    roadF = ac.createBiquadFilter(); roadF.type = 'lowpass'; roadF.frequency.value = 400;
    roadG = ac.createGain(); roadG.gain.value = 0;
    rs.connect(roadF); roadF.connect(roadG); roadG.connect(master); rs.start();
  }

  function tone(f, dur, type, vol, to, delay) {
    if (!ac || muted) return;
    var t = ac.currentTime + (delay || 0);
    var o = ac.createOscillator(), gg = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(Math.max(20, f), t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    gg.gain.setValueAtTime(0.0001, t);
    gg.gain.linearRampToValueAtTime(vol == null ? 0.25 : vol, t + 0.012);
    gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gg); gg.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function noise(dur, vol, f0, f1, delay, type) {
    if (!ac || muted) return;
    var t = ac.currentTime + (delay || 0);
    var s = ac.createBufferSource(); s.buffer = noiseBuf;
    var f = ac.createBiquadFilter(); f.type = type || 'bandpass';
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    f.Q.value = 1.1;
    var gg = ac.createGain();
    gg.gain.setValueAtTime(0.0001, t);
    gg.gain.linearRampToValueAtTime(vol, t + 0.02);
    gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(gg); gg.connect(master);
    /* Смещение по буферу — иначе сотый удар звучит бит-в-бит как первый.
       loop обязателен: без него звук длиннее остатка буфера обрывается. */
    s.loop = true; s.start(t, RNG() * 1.5); s.stop(t + dur + 0.05);
  }

  return {
    init: init,
    engine: function (spd, maxSpd, on) {
      if (!ac || !eng) return;
      var r = clamp(spd / maxSpd, 0, 1);
      /* Ставим автоматизации, только когда что-то заметно изменилось: раньше это были
         пять событий КАЖДЫЙ кадр — три сотни в секунду на аудиопоток, при том что
         setTargetAtTime и так тянет значение плавно. */
      var mute = muted || !on || this.ducked;
      if (Math.abs(r - (this.engR == null ? -9 : this.engR)) < 0.012 && mute === this.engMute) return;
      this.engR = r; this.engMute = mute;
      var base = 48 + r * 105;
      eng.forEach(function (e) { e.o.frequency.setTargetAtTime(base * e.m, ac.currentTime, 0.08); });
      engFilt.frequency.setTargetAtTime(420 + r * 1500, ac.currentTime, 0.1);
      engGain.gain.setTargetAtTime(mute ? 0 : 0.035 + r * 0.05, ac.currentTime, 0.12);
      if (roadG) {                                 // r*r — на малой скорости шума почти нет
        roadG.gain.setTargetAtTime(mute ? 0 : r * r * 0.045, ac.currentTime, 0.15);
        roadF.frequency.setTargetAtTime(280 + r * 1500, ac.currentTime, 0.15);
      }
    },
    honk:    function () { tone(392, 0.32, 'square', 0.2); tone(494, 0.32, 'square', 0.16); },
    /* ±9 % по высоте: за заезд прыжков сотни, и абсолютно одинаковый звук ухо перестаёт замечать. */
    jump:    function () { var k = 0.92 + RNG() * 0.17;
                           tone(300 * k, 0.26, 'sine', 0.28, 900 * k); tone(600 * k, 0.2, 'triangle', 0.12, 1500 * k); },
    land:    function () { var k = 0.9 + RNG() * 0.2;
                           noise(0.22, 0.28, 900 * k, 90, 0, 'lowpass'); tone(90 * k, 0.16, 'sine', 0.22, 45); },
    coin:    function (n) { var b = 880 * Math.pow(1.06, Math.min(n || 0, 8));
                            tone(b, 0.1, 'triangle', 0.22); tone(b * 1.5, 0.16, 'triangle', 0.18, null, 0.07); },
    pop:     function () { noise(0.09, 0.34, 2200, 600); tone(900, 0.08, 'sine', 0.14, 1800); },
    splash:  function () { noise(0.42, 0.3, 400, 3400, 0, 'bandpass'); },
    clunk:   function () { noise(0.16, 0.24, 500, 120, 0, 'lowpass'); tone(150, 0.12, 'square', 0.14, 70); },
    whee:    function () { tone(420, 0.5, 'sine', 0.22, 1250); },
    rev:     function () { tone(70, 0.45, 'sawtooth', 0.22, 220); noise(0.4, 0.1, 300, 1400); },
    click:   function () { noise(0.05, 0.18, 2600, 900, 0, 'bandpass'); tone(1500, 0.05, 'square', 0.09); },
    bolt:    function () { tone(1200, 0.06, 'square', 0.11); tone(1700, 0.07, 'square', 0.09, null, 0.06);
                           noise(0.08, 0.12, 3000, 1200); },
    siren:   function () { for (var i = 0; i < 6; i++)
                             tone(i % 2 ? 980 : 700, 0.22, 'square', 0.13, null, i * 0.22); },
    /* Звонок шлагбаума: сирена уже значит «скорая», «полиция» и «робот» —
       ещё одно значение сделало бы её ничего не значащей. */
    bell:    function () { for (var i = 0; i < 8; i++)
                             tone(i % 2 ? 880 : 660, 0.17, 'square', 0.15, null, i * 0.19); },
    /* Три варианта: одна и та же фанфара звучала и на «поехали», и на рекорде —
       к концу заезда ухо перестаёт отличать большое событие от рядового. */
    fanfare: function (v) {
      [[523, 659, 784, 1047, 1319], [587, 740, 880, 1175, 1480], [494, 622, 740, 988, 1245]][Math.abs(v | 0) % 3]
        .forEach(function (f, i) { tone(f, 0.34, 'triangle', 0.22, null, i * 0.11); });
    },
    /* Один полосовой шум звучал как «шшш». Три смещённых слоя (в noise теперь случайное
       смещение по буферу) плюс несколько нот сверху дают подобие радостной толпы. */
    cheer:   function () {
      for (var ci = 0; ci < 3; ci++) noise(0.9 + RNG() * 0.4, 0.09, 600 + ci * 500, 1800 + ci * 700, ci * 0.09);
      for (var cj = 0; cj < 4; cj++) tone(880 + RNG() * 700, 0.22, 'triangle', 0.05, null, 0.1 + RNG() * 0.7);
    },
    whoosh:  function () { noise(0.2, 0.16, 300, 2000); },
    fuelUp:  function () { noise(0.35, 0.14, 500, 1600); [523, 784, 1047].forEach(function (f, i) {
                             tone(f, 0.2, 'sine', 0.22, null, i * 0.09); }); },
    beep:    function (k) { tone(1046 * (1 + (k || 0) * 0.4), 0.1, 'square', 0.13); },   // k=0..1 — насколько пуст бак
    clatter: function () { for (var i = 0; i < 3; i++) {
                             noise(0.11, 0.2, 900 - i * 200, 160, i * 0.07, 'bandpass');
                             tone(210 - i * 30, 0.09, 'square', 0.1, 90, i * 0.07); } },
    hiss:    function () { noise(0.5, 0.16, 5200, 900, 0, 'bandpass'); },
    thud:    function () { noise(0.16, 0.26, 420, 90, 0, 'lowpass'); tone(120, 0.14, 'sine', 0.2, 60); },
    skid:    function () { noise(0.28, 0.1, 2600, 700, 0, 'bandpass'); },   // короткий шелест шин
    fall:    function () { tone(500, 0.35, 'sine', 0.22, 90); noise(0.3, 0.2, 700, 120, 0.12, 'lowpass'); },
    crunch:  function () { noise(0.22, 0.3, 1800, 300, 0, 'bandpass');
                           tone(160, 0.16, 'square', 0.16, 70); },
    sputter: function () { for (var i = 0; i < 4; i++) {
                             noise(0.12, 0.2, 260, 90, i * 0.16, 'lowpass');
                             tone(110 - i * 12, 0.1, 'sawtooth', 0.16, 60, i * 0.16); } },
    voice: function () {
      if (chosen !== undefined) return chosen;
      try {
        var vs = speechSynthesis.getVoices() || [];
        var ru = vs.filter(function (v) { return /^ru/i.test(v.lang || ''); });
        if (!ru.length) { chosen = null; return chosen; }
        var want = (location.search.match(/[?&]voice=([^&]+)/) || [])[1];
        if (want) {
          want = decodeURIComponent(want).toLowerCase();
          for (var i = 0; i < ru.length; i++) if ((ru[i].name || '').toLowerCase().indexOf(want) >= 0) { chosen = ru[i]; return chosen; }
        }
        // чем «живее» голос, тем выше в списке
        var rank = function (v) {
          var n = (v.name || '') + ' ' + (v.voiceURI || '');
          if (/google/i.test(n)) return 0;
          if (/premium|enhanced|siri|natural|neural/i.test(n)) return 1;
          if (/milena|katya|kate|alyona|yuri|artemiy/i.test(n)) return 2;
          if (/compact|eloquence|novelty/i.test(n)) return 5;
          return 3;
        };
        ru.sort(function (a, b) { return rank(a) - rank(b); });
        chosen = ru[0];
      } catch (e) { chosen = null; }
      return chosen;
    },
    voices: function () {
      try { return (speechSynthesis.getVoices() || []).filter(function (v) { return /^ru/i.test(v.lang || ''); })
                    .map(function (v) { return v.name; }); } catch (e) { return []; }
    },
    say: function (text) {
      if (muted) return;
      if (Object.prototype.toString.call(text) === '[object Array]') {
        qq = text.slice(1); text = text[0];
      } else qq = [];
      var key = fnv(text);
      if (HAVE[key]) {                                  // заранее записанный живой голос
        try {
          if (cur) { cur.pause(); cur.currentTime = 0; }
          var a2 = cache[key] || (cache[key] = new Audio('assets/voice/' + key + '.mp3'));
          a2.onended = function () { if (qq.length) A.say(qq.shift()); };
          a2.onerror = function () { if (cur === a2) cur = null; };   // нет файла — не «говорим» вечно
          a2.currentTime = 0;
          a2.volume = this.vol.voice;
          var pr = a2.play();
          if (pr && pr.catch) pr.catch(function () {});
          cur = a2;
          if ('speechSynthesis' in window) try { speechSynthesis.cancel(); } catch (e) {}
          return;
        } catch (e) {}
      }
      if (!('speechSynthesis' in window)) return;
      try {
        var v = this.voice();
        if (!v) { if (qq.length) A.say(qq.shift()); return; }   // очередь реплик не должна рваться на первой ненайденной mp3
        speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.voice = v; u.lang = 'ru-RU'; u.rate = 0.94; u.pitch = 1.06; u.volume = this.vol.voice;
        u.onend = function () { if (qq.length) A.say(qq.shift()); };
        speechSynthesis.speak(u);
      } catch (e) {}
    },
    have: function (text) { return !!HAVE[fnv(text)]; },   // есть ли записанная реплика
    talking: function () {
      if (cur && !cur.paused && !cur.ended) return true;
      try { return !!(window.speechSynthesis && speechSynthesis.speaking); } catch (e) { return false; }
    },
    hush: function () { if (cur) { try { cur.pause(); } catch (e) {} } },
    vol: { voice: 1, sfx: 0.55, mus: 0.35 },
    applyVol: function () {
      if (master) master.gain.value = muted ? 0 : this.vol.sfx * (this.ducked ? 0.06 : 1);
      if (cur) cur.volume = this.vol.voice;
      var m = document.getElementById('bgm');
      if (m) m.volume = muted ? 0 : this.vol.mus;
    },
    ducked: false, sayDuck: false, engR: null, engMute: null,
    /* Два источника приглушения. Жёсткое (0,06) — когда слушаем ребёнка: там важна тишина.
       Мягкое (0,25) — пока говорит диктор: речь это главный канал игры, ребёнок текст не
       читает, и она не должна конкурировать с музыкой, мотором и эффектами. */
    duck: function (on, src) {
      if (src === 'say') this.sayDuck = on; else this.ducked = on;
      var d = this.ducked || this.sayDuck, k = this.ducked ? 0.06 : 0.25;
      var m = document.getElementById('bgm');
      if (m) m.volume = muted ? 0 : this.vol.mus * (d ? k : 1);
      if (master) master.gain.setTargetAtTime(muted ? 0 : this.vol.sfx * (d ? k : 1),
                                              ac ? ac.currentTime : 0, 0.08);
      if (engGain && ac) engGain.gain.setTargetAtTime(d ? (this.ducked ? 0 : 0.012) : 0.05, ac.currentTime, 0.08);
      this.engR = null;      // сбрасываем кеш мотора: следующий кадр вернёт громкость по скорости
    },
    tracks: ['loop.mp3', 'loop2.mp3', 'loop3.mp3', 'loop4.mp3', 'loop5.mp3'],
    /* Напряжение музыкой. Ускорение темпа — самый дешёвый и самый читаемый приём:
       не нужен второй трек, и ребёнок слышит разницу мгновенно. */
    tense: function (on) {
      var m = document.getElementById('bgm');
      if (!m || this.tensed === on) return;
      this.tensed = on;
      try { m.playbackRate = on ? 1.14 : 1; } catch (e) {}
    },
    tensed: false,
    music: function () {
      var self = this;
      var m = document.getElementById('bgm');
      if (!m) {
        m = document.createElement('audio');
        m.id = 'bgm';
        m.src = 'assets/music/' + self.tracks[Math.floor(RNG() * self.tracks.length)];
        /* Кроссфейд за 1,2 с до конца: смена src по 'ended' давала паузу на загрузку —
           каждые 45 секунд музыка проваливалась в тишину. */
        m.addEventListener('timeupdate', function () {
          if (!m.duration || m.duration - m.currentTime > 1.2 || m.dataset.sw) return;
          m.dataset.sw = '1';
          var t = self.tracks[Math.floor(RNG() * self.tracks.length)];
          if ('assets/music/' + t === m.getAttribute('src')) t = self.tracks[0];
          var nx = new Audio('assets/music/' + t);
          nx.volume = 0;
          var pn = nx.play(); if (pn && pn.catch) pn.catch(function () {});
          var v0 = m.volume, st = 0;
          var iv = setInterval(function () {
            st += 0.08;
            var k = Math.min(1, st / 1.1);
            m.volume = v0 * (1 - k);
            nx.volume = muted ? 0 : self.vol.mus * k;
            if (k < 1) return;
            clearInterval(iv);
            try { m.pause(); } catch (e) {}
            m.src = nx.src; m.currentTime = nx.currentTime; m.volume = muted ? 0 : self.vol.mus;
            var pm = m.play(); if (pm && pm.catch) pm.catch(function () {});
            try { nx.pause(); } catch (e) {}
            m.dataset.sw = '';
          }, 90);
        });
        document.body.appendChild(m);
      }
      m.volume = muted ? 0 : this.vol.mus;
      if (m.paused) { var pr = m.play(); if (pr && pr.catch) pr.catch(function () {}); }
    },
    toggle: function () {
      muted = !muted;
      if (muted && cur) { try { cur.pause(); } catch (e) {} }   // кнопка должна затыкать и уже начатую реплику
      if (master) master.gain.value = muted ? 0 : this.vol.sfx * ((this.ducked || this.sayDuck) ? 0.06 : 1);
      var mm = document.getElementById('bgm'); if (mm) mm.volume = muted ? 0 : this.vol.mus;
      if (muted && 'speechSynthesis' in window) try { speechSynthesis.cancel(); } catch (e) {}
      return muted;
    }
  };
})();
if ('speechSynthesis' in window) {
  try {
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = function () { A.voice(); };
  } catch (e) {}
}


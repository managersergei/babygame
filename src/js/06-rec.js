/* ═══════════════ 3c. ЗАПИСИ ДЛЯ РОДИТЕЛЯ ═══════════════
   Вторая попытка слова на уроке — WAV 16 кГц моно в IndexedDB (babygame / rec).
   Ключ: слово|дата-время. Лимит MAX_N штук или MAX_B байт — старое стираем.  */
var Rec = (function () {
  var DB = 'babygame', ST = 'rec', MAX_N = 60, MAX_B = 12e6, RATE = 16000, db = null, n = 0, failed = false;
  var on = (function () { try { return localStorage.getItem('babygame.rec') !== '0'; } catch (e) { return true; } })();
  function open(fn) {
    if (db) { fn(db); return; }
    if (failed || !window.indexedDB) { fn(null); return; }
    var rq;
    try { rq = indexedDB.open(DB, 1); } catch (e) { failed = true; fn(null); return; }
    rq.onupgradeneeded = function () { rq.result.createObjectStore(ST, { keyPath: 'id' }); };
    rq.onsuccess = function () { db = rq.result; db.onversionchange = function () { db.close(); db = null; }; fn(db); };
    rq.onerror = rq.onblocked = function () { failed = true; fn(null); };
  }
  function all(fn) {                                    // новые сверху
    open(function (d) {
      if (!d) { fn([]); return; }
      var out = [], rq;
      try { rq = d.transaction(ST).objectStore(ST).openCursor(); } catch (e) { fn(out); return; }
      rq.onsuccess = function () { var c = rq.result; if (c) { out.push(c.value); c['continue'](); }
                                   else { out.sort(function (a, b) { return b.t - a.t; }); n = out.length; fn(out); } };
      rq.onerror = function () { fn(out); };
    });
  }
  function put(r, fn) { open(function (d) { if (!d) return; var tx = d.transaction(ST, 'readwrite'); tx.objectStore(ST).put(r); tx.oncomplete = function () { n++; if (fn) fn(); trim(); }; }); }
  function del(id, fn) { open(function (d) { if (!d) return; var tx = d.transaction(ST, 'readwrite'); tx.objectStore(ST)['delete'](id); tx.oncomplete = function () { if (fn) fn(); }; }); }
  function clear(fn) { open(function (d) { if (!d) return; var tx = d.transaction(ST, 'readwrite'); tx.objectStore(ST).clear(); tx.oncomplete = function () { n = 0; if (fn) fn(); }; }); }
  function trim() {
    all(function (rs) {
      var tot = 0; for (var i = 0; i < rs.length; i++) tot += rs[i].size;
      while (rs.length && (rs.length > MAX_N || tot > MAX_B)) { var r = rs.pop(); tot -= r.size; del(r.id); }
    });
  }
  function two(x) { return (x < 10 ? '0' : '') + x; }
  function stamp(t) { var d = new Date(t); return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + '_' + two(d.getHours()) + '-' + two(d.getMinutes()) + '-' + two(d.getSeconds()); }
  function wav(f32, rate) {                             // моно 16 бит
    var N = f32.length, b = new ArrayBuffer(44 + N * 2), v = new DataView(b), i;
    function s(o, t) { for (var k = 0; k < t.length; k++) v.setUint8(o + k, t.charCodeAt(k)); }
    s(0, 'RIFF'); v.setUint32(4, 36 + N * 2, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, N * 2, true);
    for (i = 0; i < N; i++) { var x = f32[i]; if (x > 1) x = 1; else if (x < -1) x = -1; v.setInt16(44 + i * 2, x < 0 ? x * 32768 : x * 32767, true); }
    return new Blob([b], { type: 'audio/wav' });
  }
  function slice(ab, at, to) {                          // окно [at,to] → 16 кГц моно, усреднением
    var sr = ab.sampleRate, ch = ab.getChannelData(0), a = Math.max(0, Math.floor(at * sr)), b = Math.min(ch.length, Math.ceil(to * sr));
    var k = sr / RATE, N = Math.max(0, Math.floor((b - a) / k)), out = new Float32Array(N);
    for (var i = 0; i < N; i++) { var s0 = a + Math.floor(i * k), s1 = a + Math.floor((i + 1) * k), sum = 0; for (var j = s0; j < s1; j++) sum += ch[j]; out[i] = sum / (s1 - s0 || 1); }
    return out;
  }
  function save(blob, tag, dur) { var t = Date.now(); put({ id: tag.word + '|' + stamp(t), word: tag.word, key: tag.key, t: t, dur: dur, size: blob.size, mime: blob.type, blob: blob }); }
  function fromBlob(blob, ac, at, to, tag) {           // сырой webm/mp4 → decode → окно → WAV; не декодировалось — храним как есть
    if (!on || !ac) return;
    var fr = new FileReader();
    fr.onload = function () {
      var done = false;
      function raw() { if (!done) { done = true; save(blob, tag, to - at); } }
      try {
        ac.decodeAudioData(fr.result, function (ab) { if (done) return; done = true; var pcm = slice(ab, at, to); save(wav(pcm, RATE), tag, pcm.length / RATE); }, raw);
      } catch (e) { raw(); }
      setTimeout(raw, 4000);                            // старый Safari может не позвать ни один колбэк
    };
    fr.readAsArrayBuffer(blob);
  }
  return { on: on, setOn: function (v) { this.on = on = v; try { localStorage.setItem('babygame.rec', v ? '1' : '0'); } catch (e) {} },
           fromBlob: fromBlob, all: all, del: del, clear: clear, wav: wav, save: save, stamp: stamp, count: function () { return n; } };
})();


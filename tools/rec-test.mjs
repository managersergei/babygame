// Автопроверка записи второй попытки слова (панель родителя, IndexedDB babygame/rec).
// Запуск: python3 -m http.server 8765 &  →  node tools/rec-test.mjs   (playwright ищется как в smoke.mjs)
//
// Микрофон подменяется фейковым устройством Chromium: оно отдаёт синтетический тон, а не речь,
// поэтому РАСПОЗНАВАНИЕ РЕЧИ ЗДЕСЬ НЕ ПРОВЕРЯЕТСЯ. Проверяем то, что от речи не зависит:
//   1) микрофон поднялся, урок дошёл до слушания, страница не упала;
//   2) MediaRecorder создаётся на живом потоке и отдаёт непустой blob;
//   3) хранилище babygame/rec открывается, пишется и читается;
//   4) панель родителя рисует строки записей с кнопками ▶ ⬇ ✕, ▶ и ✕ работают.
// ?fast= намеренно НЕ используем: он ускоряет игровой цикл, а звук идёт в реальном времени —
// окно Mic.listen схлопнулось бы раньше, чем ребёнок успел бы что-то сказать.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { existsSync, readdirSync } from "node:fs";
async function loadChromium() {
  const bases = [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href];
  for (const b of bases) for (const n of ["playwright", "@playwright/test"]) {
    try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {}
  }
  throw new Error("playwright не найден");
}
function cachedChrome() {
  const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null;
  const dirs = readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0]);
  for (const d of dirs) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; }
  return null;
}
const ARGS = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
const chromium = await loadChromium();
let browser;
try { browser = await chromium.launch({ args: ARGS }); }
catch { browser = await chromium.launch({ args: ARGS, executablePath: cachedChrome() }); }
const BASE = process.env.BASE || "http://127.0.0.1:8765/";
let fails = 0, RECOGNISED = false;      // удалось ли фейковому тону сойти за речь и доехать до IndexedDB
async function run(name, fn) { try { await fn(); console.log("OK   " + name); } catch (e) { fails++; console.log("FAIL " + name + ": " + e.message.split("\n").slice(0, 6).join(" / ")); } }
const bg = (page) => page.evaluate(() => window.__bg());
const shown = (page, id) => page.evaluate((id) => getComputedStyle(document.getElementById(id)).display !== "none", id);

async function newCtx() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ["microphone"] });
  await ctx.grantPermissions(["microphone"], { origin: BASE });
  return ctx;
}
function watch(page) {
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  return errs;
}
async function start(page, qs) {
  await page.goto(BASE + qs);
  await page.waitForFunction(() => window.__bg && window.__bg().state !== "load", null, { timeout: 20000 });
  if (await shown(page, "parent")) await page.click("#parentGo");     // и заодно жест: Mic.request(true)
  else await page.mouse.click(640, 400);
}

// ─────────── 1. Урок: микрофон, попытки, поля __bg ───────────
await run("урок: микрофон поднялся, поля said/recs/rec живы, страница не упала", async () => {
  const ctx = await newCtx(); const page = await ctx.newPage(); const errs = watch(page);
  await start(page, "?s=lesson&w=jump&test=1");
  let b = await bg(page);
  for (const f of ["said", "recs", "rec"]) if (!(f in b)) throw new Error("в __bg() нет поля " + f);
  if (b.state !== "lesson") throw new Error("состояние " + b.state + ", ожидали lesson");

  // ждём, пока микрофон поднимется (кнопка #micAsk прячется, когда Mic.ready())
  const micUp = await page.waitForFunction(
    () => getComputedStyle(document.getElementById("micAsk")).display === "none" && window.__bg().voice,
    null, { timeout: 15000 }).then(() => true).catch(() => false);

  await page.waitForTimeout(25000);                                    // несколько попыток урока в реальном времени
  // запись стартует на второй попытке со звуком и доезжает до IndexedDB ещё несколько секунд
  const saved = await page.waitForFunction(() => window.__bg().recs > 0, null, { timeout: 15000 })
    .then(() => true).catch(() => false);
  b = await bg(page);
  console.log("     mic=" + (micUp ? "ready" : "НЕ поднялся") + " state=" + b.state +
              " said=" + b.said + " recs=" + b.recs + " rec=" + b.rec);
  if (!micUp) throw new Error("микрофон так и не поднялся — фейковое устройство не отдалось");
  if (typeof b.said !== "number") throw new Error("said не число: " + b.said);

  if (saved) {                                                         // тон Chromium сошёл за речь — путь пройден целиком
    const r = await page.evaluate(() => new Promise((ok, no) => {
      const rq = indexedDB.open("babygame");
      rq.onerror = () => no(new Error("indexedDB.open сорвался"));
      rq.onsuccess = () => {
        const d = rq.result, q = d.transaction("rec").objectStore("rec").getAll();
        q.onsuccess = () => { const v = q.result.map(x => ({ id: x.id, word: x.word, key: x.key, dur: x.dur, size: x.size, mime: x.mime, blob: x.blob && x.blob.size })); d.close(); ok(v); };
        q.onerror = () => { d.close(); no(new Error("чтение rec сорвалось")); };
      };
    }));
    console.log("     в babygame/rec: " + JSON.stringify(r));
    if (!r.length) throw new Error("recs=" + b.recs + ", а в IndexedDB пусто");
    if (r[0].word !== "ПРЫЖОК") throw new Error("слово записи: " + r[0].word);
    if (!r[0].blob) throw new Error("blob записи пустой");
    if (r[0].mime !== "audio/wav") console.log("     decodeAudioData не сработал — сохранён сырой " + r[0].mime + " (запасной путь)");
    RECOGNISED = true;
  } else {
    console.log("     фейковый тон за речь не принят — распознавание и сохранение здесь НЕ проверены (said=" + b.said + ")");
  }
  if (errs.length) throw new Error(errs.join(" | "));
  await ctx.close();
});

// ─────────── 2. MediaRecorder на живом потоке ───────────
await run("MediaRecorder: создаётся на потоке микрофона и отдаёт непустой blob", async () => {
  const ctx = await newCtx(); const page = await ctx.newPage(); const errs = watch(page);
  await start(page, "?s=lesson&w=jump&test=1");
  const res = await page.evaluate(async () => {
    const list = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    const mt = list.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
    if (!mt) return { mime: "", size: 0, err: "нет поддерживаемого mime" };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const r = new MediaRecorder(stream, { mimeType: mt, audioBitsPerSecond: 48000 });
    const chunks = [];
    r.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(ok => { r.onstop = ok; });
    r.start();
    await new Promise(ok => setTimeout(ok, 1500));
    r.stop(); await stopped;
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, { type: mt });
    // тот же путь, что у Rec.fromBlob: сырой контейнер → decodeAudioData
    let decoded = 0;
    try {
      const ab = await new Response(blob).arrayBuffer();
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const buf = await ac.decodeAudioData(ab);
      decoded = +buf.duration.toFixed(2);
      ac.close();
    } catch (e) { decoded = -1; }
    return { mime: mt, size: blob.size, decoded };
  });
  console.log("     mime=" + res.mime + " size=" + res.size + " decodeAudioData=" + res.decoded + " с");
  if (!res.mime) throw new Error("MediaRecorder не поддержал ни один контейнер");
  if (!res.size) throw new Error("MediaRecorder отдал пустой blob");
  if (res.decoded === -1) console.log("     decodeAudioData не справился — Rec.fromBlob сохранит сырой контейнер (запасной путь)");
  if (errs.length) throw new Error(errs.join(" | "));
  await ctx.close();
});

// ─────────── 3. Хранилище и панель родителя ───────────
await run("панель родителя: babygame/rec пишется, строки ▶ ⬇ ✕ рисуются, ▶ и ✕ работают", async () => {
  const ctx = await newCtx(); const page = await ctx.newPage(); const errs = watch(page);
  await page.addInitScript(() => {                      // слово уже «учили» — иначе в панели нет строки .w
    try { localStorage.setItem("babygame.stats", JSON.stringify({ "ПРЫЖОК": { n: 2, s: 1 } })); } catch (e) {}
  });
  await start(page, "?s=play&test=1");

  await page.click("#bStats");                          // render() → renderRecs() → Rec.all() создаёт babygame/rec
  await page.waitForTimeout(700);
  if (!(await shown(page, "stats"))) throw new Error("панель не открылась");
  if (!(await page.evaluate(() => !!document.getElementById("recOn")))) throw new Error("нет галки recOn");
  if (!(await page.evaluate(() => document.getElementById("recOn").checked))) throw new Error("запись выключена по умолчанию");

  const stores = await page.evaluate(() => new Promise((ok, no) => {   // хранилище открылось без ошибок
    const rq = indexedDB.open("babygame");
    rq.onerror = () => no(new Error("indexedDB.open('babygame') сорвался"));
    rq.onsuccess = () => { const s = [].slice.call(rq.result.objectStoreNames); rq.result.close(); ok(s); };
  }));
  if (stores.indexOf("rec") < 0) throw new Error("нет хранилища rec, есть: " + JSON.stringify(stores));

  const wrote = await page.evaluate(() => new Promise((ok, no) => {    // кладём настоящий WAV (0,2 с тишины, 16 кГц)
    const N = 3200, b = new ArrayBuffer(44 + N * 2), v = new DataView(b);
    const s = (o, t) => { for (let k = 0; k < t.length; k++) v.setUint8(o + k, t.charCodeAt(k)); };
    s(0, "RIFF"); v.setUint32(4, 36 + N * 2, true); s(8, "WAVE"); s(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, "data"); v.setUint32(40, N * 2, true);
    const blob = new Blob([b], { type: "audio/wav" });
    const rq = indexedDB.open("babygame");
    rq.onerror = () => no(new Error("open"));
    rq.onsuccess = () => {
      const d = rq.result, tx = d.transaction("rec", "readwrite");
      tx.objectStore("rec").put({ id: "ПРЫЖОК|2026-09-08_12-00-00", word: "ПРЫЖОК", key: "jump",
                                 t: Date.now(), dur: 1.4, size: blob.size, mime: "audio/wav", blob: blob });
      tx.oncomplete = () => { d.close(); ok(blob.size); };
      tx.onerror = () => { d.close(); no(new Error("запись в rec не прошла")); };
    };
  }));

  await page.click("#statsClose"); await page.click("#bStats"); await page.waitForTimeout(700);
  let rows = await page.evaluate(() => document.querySelectorAll("#statsBody .r").length);
  if (rows !== 1) throw new Error("строк записи в панели: " + rows + " (ожидали 1)");
  const btns = await page.evaluate(() => [].map.call(document.querySelectorAll("#statsBody .r button"), b => b.textContent).join(""));
  if (btns !== "▶ послушать⬇✕") throw new Error("кнопки строки: " + btns);
  console.log("     WAV " + wrote + " Б в babygame/rec, строка в панели: " + btns);

  await page.click("#statsBody .r button[data-play]"); await page.waitForTimeout(900);   // ▶ — воспроизведение
  await page.click("#statsBody .r button[data-play]"); await page.waitForTimeout(300);   // повторный клик: stopPlay()

  await page.click("#bStats"); await page.click("#bStats"); await page.waitForTimeout(700);   // перерисовка не удваивает
  rows = await page.evaluate(() => document.querySelectorAll("#statsBody .r").length);
  if (rows !== 1) throw new Error("после перерисовки строк: " + rows + " (ожидали 1, значит дублируются)");

  page.once("dialog", d => d.accept());                 // ✕ — удаление
  await page.click("#statsBody .r button[data-del]"); await page.waitForTimeout(900);
  rows = await page.evaluate(() => document.querySelectorAll("#statsBody .r").length);
  if (rows !== 0) throw new Error("после удаления строк: " + rows);

  await page.evaluate(() => document.getElementById("recOn").click());   // галка гасит запись
  if (await page.evaluate(() => localStorage.getItem("babygame.rec")) !== "0") throw new Error("галка не сохранила выключение");
  await page.evaluate(() => document.getElementById("recOn").click());
  if (await page.evaluate(() => localStorage.getItem("babygame.rec")) !== "1") throw new Error("галка не вернула запись");

  if (errs.length) throw new Error(errs.join(" | "));
  await ctx.close();
});

await browser.close();
console.log(RECOGNISED
  ? "\nТон фейкового микрофона сошёл за речь: путь «сказал → recSpoke → onstop → WAV в IndexedDB» пройден целиком.\nНо это синтетический тон, а не голос: качество окна [речь−1,5 … конец+1,5] и разборчивость записи\nпроверяются только ушами на живом устройстве."
  : "\nВНИМАНИЕ: фейковый микрофон Chromium отдал тон, который игра за речь не приняла, поэтому распознавание\nи путь «сказал → recSpoke → onstop → WAV в IndexedDB» здесь НЕ проверены — только на живом устройстве.");
console.log("iOS Safari отдельно: там контейнер audio/mp4 и свои правила на play() — headless это не ловит.");
console.log(fails ? "FAILS: " + fails : "ALL OK");
process.exit(fails ? 1 : 0);

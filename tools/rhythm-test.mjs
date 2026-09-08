// Проверка ритма бесконечного режима: интервалы между новыми словами, погони, монстрики.
// node tools/rhythm-test.mjs [секунд-игрового-времени] [seed]
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const chromium = await loadChromium();
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: cachedChrome() }); }
const GAME_SEC = +(process.argv[2] || 300), SEED = +(process.argv[3] || 3), FAST = +(process.argv[4] || 1);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const ev = [], errs = [];
page.on("pageerror", e => errs.push(e.message));
page.on("console", m => { const t = m.text(); if (t.startsWith("EV ")) ev.push(t); });
await page.goto(`http://127.0.0.1:8765/?s=play&rec=1&auto=1&test=1&seed=${SEED}&fast=${FAST}`);
await page.waitForFunction(() => window.__bg && window.__bg().state !== "load", null, { timeout: 20000 });
const samples = [];
const t0 = Date.now();
while (true) {
  const b = await page.evaluate(() => window.__bg());
  samples.push({ T: b.T, state: b.state, want: b.word.want, next: b.word.next, mons: b.mons, chase: b.chase.on, flee: b.chase.flee, n: b.chase.n });
  if (b.T >= GAME_SEC) break;
  if (Date.now() - t0 > (GAME_SEC / FAST + 60) * 1000) { console.log("таймаут реального времени"); break; }
  await page.waitForTimeout(250);
}
const last = samples[samples.length - 1];
console.log(`игрового времени: ${last.T} с, звёзд/погонь: n=${last.n}`);
const lessons = ev.filter(l => l.includes(" lesson ")).map(l => ({ t: +l.split(" ")[1], key: l.split(" ")[3] }));
const learned = ev.filter(l => l.includes(" learned ")).map(l => ({ t: +l.split(" ")[1] }));
const idle = lessons.map((l, i) => { const prev = learned.filter(x => x.t < l.t).pop(); return prev ? +(l.t - prev.t).toFixed(1) : null; }).filter(x => x !== null);
console.log("пауза между словами (конец урока → начало следующего), с:", idle.join(", "));
if (idle.length) console.log(`  мин ${Math.min(...idle)} · сред ${(idle.reduce((a,b)=>a+b,0)/idle.length).toFixed(1)} · макс ${Math.max(...idle)}  (цель 15–30)`);
const chases = ev.filter(l => l.includes(" chase ")).map(l => ({ t: +l.split(" ")[1] }));
console.log(`уроков: ${lessons.length}, погонь: ${chases.length}`);
const gaps = lessons.slice(1).map((l, i) => +(l.t - lessons[i].t).toFixed(1));
console.log("слова:", lessons.map(l => `${l.t.toFixed(0)}с ${l.key}`).join(" · "));
console.log("промежутки между словами, с:", gaps.join(", "));
if (gaps.length) {
  const mn = Math.min(...gaps), mx = Math.max(...gaps), avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  console.log(`  мин ${mn} · сред ${avg.toFixed(1)} · макс ${mx}`);
  console.log(`  ${mx <= 45 ? "ok " : "ВНИМАНИЕ"} максимум ${mx} с (цель: около 15–30 с плюс время самого урока)`);
}
if (chases.length > 1) console.log("промежутки между погонями, с:", chases.slice(1).map((c, i) => +(c.t - chases[i].t).toFixed(1)).join(", "));
// монстрики во время первых двух погонь
const bad = samples.filter(s => s.chase && !s.flee && s.n <= 2 && s.mons > 0);
console.log(`  ${bad.length === 0 ? "ok " : "FAIL"} монстрики во время первых двух погонь: ${bad.length} замеров с монстриками`);
if (errs.length) console.log("ОШИБКИ СТРАНИЦЫ:", errs.slice(0, 3).join(" | "));
await browser.close();
process.exit(errs.length ? 1 : 0);

// Проверка пункта 14: когда слов для изучения не осталось, робот приходит каждые 45–75 с.
// Прогресс подделываем через localStorage babygame.stats (все слова выучены).
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const chromium = await loadChromium();
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: cachedChrome() }); }
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const ev = [], errs = [];
page.on("pageerror", e => errs.push(e.message));
page.on("console", m => { const t = m.text(); if (t.startsWith("EV ")) ev.push(t); });
const B = "http://127.0.0.1:8765/";
await page.goto(B);
// все слова уже выучены (n >= Stats.need) и звёзд достаточно, чтобы робот был открыт
await page.evaluate(() => {
  const words = ["ПРЫЖОК","ГАЗ","ЗВЕЗДА","ШАРИК","КОНУС","ЛУЖА","ТРАМПЛИН","ПЛАТФОРМА","ЯМА","БЕНЗИН","МОНСТР","РОБОТ","КРАСКА","ПТИЦА","САМОЛЁТ","ДЕРЕВО","ДОМ","КУСТ","ОБЛАКО","ЦВЕТОК","ЯБЛОКО","МЯЧ","БАБОЧКА","ЁЖИК","РАКЕТА","ПОЕЗД","КОРОВА","ЛОШАДЬ","КУРИЦА","ЗАБОР","СЕНО","МЕЛЬНИЦА","РОМАШКИ","КОЛЕСО"];
  const d = {}; words.forEach(w => d[w] = { n: 9, s: 1 });
  localStorage.setItem("babygame.stats", JSON.stringify(d));
  localStorage.setItem("babygame.session", "99");
});
await page.goto(B + "?s=play&rec=1&auto=1&test=1&seed=11&fast=3");
await page.waitForFunction(() => window.__bg && window.__bg().state !== "load", null, { timeout: 20000 });
const t0 = Date.now();
let last = null;
while (Date.now() - t0 < 380000) {
  last = await page.evaluate(() => window.__bg());
  if (last.T > 340) break;
  await page.waitForTimeout(1000);
}
console.log(`игрового времени: ${last.T} с · слов к изучению: ${last.word.next} · погонь: ${last.chase.n}`);
const chases = ev.filter(l => l.includes(" chase ")).map(l => +l.split(" ")[1]);
console.log("погони на секундах:", chases.map(t => t.toFixed(0)).join(", "));
const gaps = chases.slice(1).map((t, i) => +(t - chases[i]).toFixed(1));
if (gaps.length) {
  console.log("промежутки между погонями, с:", gaps.join(", "), `(цель 45–75 плюс время самой погони)`);
  const ok = gaps.every(g => g >= 45 && g <= 110);
  console.log(`  ${ok ? "ok " : "ВНИМАНИЕ"} все промежутки в разумных пределах`);
} else console.log(`  ${chases.length ? "мало данных: погоня одна, промежуток измерить не на чем" : "ВНИМАНИЕ: погонь не было"} · звёзд ${last.stars} (робот открывается с 56)`);
if (errs.length) console.log("ОШИБКИ:", errs.slice(0, 3).join(" | "));
await browser.close();

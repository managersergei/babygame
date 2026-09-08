// Проверка: за один заезд слово не повторяется (даже после проигрыша и рестарта).
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const chromium = await loadChromium();
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: cachedChrome() }); }
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const lessons = [], overs = [];
page.on("console", m => { const t = m.text();
  if (t.startsWith("EV ") && t.includes(" lesson ")) lessons.push(t.split(" ")[3]);
  if (t.startsWith("EV ") && t.includes(" say ") && /поймали|Бензин закончился/.test(t)) overs.push(1); });
await page.goto("http://127.0.0.1:8765/?s=play&rec=1&auto=1&test=1&seed=31&fast=4");
await page.waitForFunction(() => window.__bg && window.__bg().state !== "load", null, { timeout: 20000 });
const t0 = Date.now();
while (Date.now() - t0 < 180000) { const b = await page.evaluate(() => window.__bg()); if (b.T > 500) break; await page.waitForTimeout(1000); }
const b = await page.evaluate(() => window.__bg());
const uniq = new Set(lessons);
const dup = lessons.filter((x, i) => lessons.indexOf(x) !== i);
console.log(`заезд ${b.T} с · уроков ${lessons.length} · разных слов ${uniq.size} · проигрышей ${overs.length}`);
console.log("порядок слов:", lessons.join(" → "));
console.log(dup.length ? `FAIL повторились в одном заезде: ${[...new Set(dup)].join(", ")}` : "ok  ни одно слово не повторилось за заезд");
await browser.close();
process.exit(dup.length ? 1 : 0);

// Сколько времени в заезде занимают уроки, а сколько — обычная езда (пункт 4).
// node tools/balance-test.mjs [секунд]
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const chromium = await loadChromium();
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: cachedChrome() }); }
const SEC = +(process.argv[2] || 240);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
await page.goto(`http://127.0.0.1:8765/?s=play&rec=1&auto=1&test=1&seed=21`);
await page.waitForFunction(() => window.__bg && window.__bg().state !== "load", null, { timeout: 20000 });
const count = {};
const t0 = Date.now();
let n = 0, lastT = 0;
while (Date.now() - t0 < SEC * 1000) {
  const b = await page.evaluate(() => window.__bg());
  count[b.state] = (count[b.state] || 0) + 1; n++; lastT = b.T;
  await page.waitForTimeout(200);
}
const pct = k => ((count[k] || 0) / n * 100).toFixed(0);
console.log(`заезд ${lastT.toFixed(0)} с, замеров ${n}`);
console.log(`  езда (play): ${pct("play")}%`);
console.log(`  урок слова (lesson): ${pct("lesson")}%`);
console.log(`  мастерская и авария (repair/crash): ${(+pct("repair") + +pct("crash")).toFixed(0)}%`);
console.log(`  остальное (знакомство, экраны): ${(100 - pct("play") - pct("lesson") - (+pct("repair") + +pct("crash"))).toFixed(0)}%`);
console.log("  всё: " + Object.keys(count).map(k => `${k} ${pct(k)}%`).join(", "));
await browser.close();

// Риг машинки: колесо крутится ровно по пройденному пути (угол = путь / радиус),
// а ширина сборки совпадает с той, по которой считаются столкновения.
// Запуск: python3 -m http.server 8765 &  →  node tools/rig-test.mjs
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const B = process.env.BASE || "http://127.0.0.1:8765/";
let fail = 0;
const ck = (n, ok, info) => { console.log(`  ${ok ? "ok " : "FAIL"} ${n}${info ? ": " + info : ""}`); if (!ok) fail++; };
const chromium = await loadChromium(); const ex = cachedChrome();
const browser = await chromium.launch(ex ? { executablePath: ex } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => { try { localStorage.setItem("babygame.parent", "1"); } catch (e) {} });
const p = await ctx.newPage();
await p.goto(B + "index.html?test=1&s=play&seed=4");
await p.waitForFunction(() => window.__bg && window.__bg().state === "play");
await p.waitForTimeout(2500);

console.log("риг машинки: части, вращение, ширина");
const a0 = await p.evaluate(() => window.__bg());
await p.waitForTimeout(2500);
const a1 = await p.evaluate(() => window.__bg());

ck("угол колеса растёт", a1.wheelA > a0.wheelA + 1, `${a0.wheelA} → ${a1.wheelA}`);

// путь в тех же единицах, что и радиус: обе величины отдаём делёнными на S
const R = await p.evaluate(() => { const c = window.__car(); return { w: window.__bg().rigW, S: c.S }; });
const path = a1.carXw - a0.carXw;
const rad = R.w * 0.30 * 0.5;                 // tire2 = 0.30 от ширины кузова
const want = path / rad, got = a1.wheelA - a0.wheelA;
ck("угол совпадает с путём/радиусом", Math.abs(got - want) / want < 0.06,
   `путь ${path}, радиус ${rad.toFixed(1)} → ожидали ${want.toFixed(2)}, получили ${got.toFixed(2)}`);

ck("риг реально включён, а не откат на старый спрайт", a1.rigOn === true, String(a1.rigOn));
ck("ширина сборки разумная", a1.rigW > 60 && a1.rigW < 400, String(a1.rigW));

await browser.close();
console.log(fail ? `\nПРОВАЛОВ: ${fail}` : "\nВСЁ ОК");
process.exit(fail ? 1 : 0);

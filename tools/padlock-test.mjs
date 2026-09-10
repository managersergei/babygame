// Замок экранных кнопок по Tab: на ноутбуке ладонь на тачпаде жмёт кнопки за ребёнка.
// Проверяем: Tab выключает кнопки и включает обратно, клавиатура при этом работает.
// Запуск: python3 -m http.server 8765 &  →  node tools/padlock-test.mjs
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const B = process.env.BASE || "http://127.0.0.1:8765/";
let fail = 0;
const ck = (n, ok, info) => { console.log(`  ${ok ? "ok " : "FAIL"} ${n}${info ? ": " + info : ""}`); if (!ok) fail++; };
const chromium = await loadChromium(); const ex = cachedChrome();
const browser = await chromium.launch(ex ? { executablePath: ex } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });   // без hasTouch — это ноутбук
await ctx.addInitScript(() => { try { localStorage.setItem("babygame.parent", "1"); } catch (e) {} });
const p = await ctx.newPage();
await p.goto(B + "index.html?test=1&s=play&seed=3");
await p.waitForFunction(() => window.__bg && window.__bg().state === "play");
await p.waitForTimeout(1500);

const state = () => p.evaluate(() => ({
  lock: document.body.classList.contains("padlock"),
  padHits: getComputedStyle(document.getElementById("kS")).pointerEvents,
  toolHits: getComputedStyle(document.getElementById("bSound")).pointerEvents,
  note: getComputedStyle(document.getElementById("lockNote")).display
}));

console.log("замок экранных кнопок (Tab)");
let s0 = await state();
ck("сначала кнопки работают", !s0.lock && s0.padHits !== "none", `pad=${s0.padHits}`);

await p.keyboard.press("Tab");
await p.waitForTimeout(200);
let s1 = await state();
ck("Tab выключает кнопки", s1.lock && s1.padHits === "none" && s1.toolHits === "none", `pad=${s1.padHits} tools=${s1.toolHits}`);
ck("на экране видно, что замок стоит", s1.note !== "none", s1.note);

// нажатие мышью по кнопке прыжка не должно проходить
const y0 = await p.evaluate(() => window.__bg().carY);
const box = await p.locator("#kS").boundingBox();
await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await p.waitForTimeout(350);
const y1 = await p.evaluate(() => window.__bg().carY);
ck("клик по экранной кнопке не проходит", Math.abs(y1 - y0) < 6, `carY ${y0} → ${y1}`);

// клавиатура работать обязана
await p.keyboard.press("Space");
await p.waitForTimeout(250);
const y2 = await p.evaluate(() => window.__bg().carY);
ck("клавиатура при замке работает", y2 > y0 + 8, `carY ${y0} → ${y2}`);

await p.keyboard.press("Tab");
await p.waitForTimeout(200);
const s2 = await state();
ck("Tab включает обратно", !s2.lock && s2.padHits !== "none", `pad=${s2.padHits}`);

await browser.close();
console.log(fail ? `\nПРОВАЛОВ: ${fail}` : "\nВСЁ ОК");
process.exit(fail ? 1 : 0);

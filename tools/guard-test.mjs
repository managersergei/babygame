// Пульт: полный экран отдельной кнопкой и защита от лишних касаний.
// В защите отвечают только газ, прыжок и сам замок — остальное ладонью не задеть.
// Запуск: python3 -m http.server 8765 &  →  node tools/guard-test.mjs
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const B = process.env.BASE || "http://127.0.0.1:8765/";
let fail = 0;
const ck = (n, ok, info) => { console.log(`  ${ok ? "ok " : "FAIL"} ${n}${info ? ": " + info : ""}`); if (!ok) fail++; };
const chromium = await loadChromium(); const ex = cachedChrome();
const browser = await chromium.launch(ex ? { executablePath: ex } : {});
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
await p.goto(B + "pult.html");
await p.waitForTimeout(1200);

const hits = id => p.evaluate(i => { const e = document.getElementById(i); return e ? getComputedStyle(e).pointerEvents : "нет"; }, id);
const shown = id => p.evaluate(i => { const e = document.getElementById(i); return !!e && getComputedStyle(e).display !== "none"; }, id);

console.log("пульт: полный экран и защита от касаний");
ck("кнопка «весь экран» есть", await shown("full"));
ck("замок есть", await shown("guard"));
ck("до защиты кнопки живые", (await hits("tilt")) !== "none" && (await hits("connect")) !== "none");

await p.locator("#guard").click();
await p.waitForTimeout(250);
ck("в защите наклон не нажать", (await hits("tilt")) === "none", await hits("tilt"));
ck("в защите подключение не нажать", (await hits("connect")) === "none", await hits("connect"));
ck("в защите микрофон не нажать", (await hits("mic")) === "none", await hits("mic"));
ck("газ доступен", (await hits("G")) === "auto", await hits("G"));
ck("прыжок доступен", (await hits("J")) === "auto", await hits("J"));
ck("газ и прыжок показаны", await shown("thumbs"));
ck("замок остаётся нажимаемым", (await hits("guard")) !== "none", await hits("guard"));

await p.locator("#guard").click();
await p.waitForTimeout(250);
ck("замок снимается", (await hits("tilt")) !== "none", await hits("tilt"));

await browser.close();
console.log(fail ? `\nПРОВАЛОВ: ${fail}` : "\nВСЁ ОК");
process.exit(fail ? 1 : 0);

// Наклон кузова берётся из уклона ПОД КОЛЁСАМИ, а не из синусоиды.
// Проверяем два факта: на ровной дороге наклона нет, на трамплине нос задирается.
// Запуск: python3 -m http.server 8765 &  →  node tools/tilt-test.mjs
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const B = process.env.BASE || "http://127.0.0.1:8765/";
const KNOWN = ["ПРЫЖОК","ГАЗ","ЗВЕЗДА","ШАРИК","КОНУС","ЛУЖА","ТРАМПЛИН","ПЛАТФОРМА","ЯМА","БЕНЗИН","МОНСТР","РОБОТ","КРАСКА","ПТИЦА","САМОЛЁТ","ДЕРЕВО","ДОМ","КУСТ","ОБЛАКО","ЦВЕТОК","ЯБЛОКО","МЯЧ","БАБОЧКА","ЁЖИК","РАКЕТА","ПОЕЗД","КОРОВА","ЛОШАДЬ","КУРИЦА","ЗАБОР","СЕНО","МЕЛЬНИЦА","РОМАШКИ","КОЛЕСО"];
let fail = 0;
const ck = (name, ok, info) => { console.log(`  ${ok ? "ok " : "FAIL"} ${name}${info ? ": " + info : ""}`); if (!ok) fail++; };

const chromium = await loadChromium(); const ex = cachedChrome();
const browser = await chromium.launch(ex ? { executablePath: ex } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(w => { try { const d = {}; w.forEach(x => d[x] = { n: 9, s: 1 }); localStorage.setItem("babygame.stats", JSON.stringify(d)); localStorage.setItem("babygame.session", "99"); } catch (e) {} }, KNOWN);
const p = await ctx.newPage();
await p.goto(B + "index.html?test=1&s=play&seed=9");
await p.waitForFunction(() => window.__bg && window.__bg().state === "play");
await p.waitForTimeout(2500);

// сначала ровная дорога — без всякого рельефа рядом, потом отдельно трамплин
const flatRaw = await p.evaluate(() => new Promise(res => {
  const out = []; let n = 0;
  function step() { const d = window.__bg(); out.push({ t: d.tilt, g: d.grounded, gh: d.gh });
    if (++n < 90) requestAnimationFrame(step); else res(out); }
  requestAnimationFrame(step);
}));
const r = await p.evaluate(() => new Promise(res => {
  const out = []; let n = 0;
  const c0 = window.__car();
  // урок слова замораживает мир: кладём трамплин заново, пока он не окажется под колёсами
  let ramp = { t: "ramp", x: c0.x + 260 * c0.S, w: 132 * c0.S, h: 76 * c0.S };
  window.__put(ramp);
  let re = 0;
  function step() {
    const d = window.__bg();
    out.push({ t: d.tilt, gh: d.gh, g: d.grounded });
    if (++n < 900) requestAnimationFrame(step); else res(out);
  }
  requestAnimationFrame(step);
}));

const flat = flatRaw.filter(x => x.g && x.gh <= 0).map(x => Math.abs(x.t));
const onRamp = r.filter(x => x.gh > 3).map(x => x.t);
console.log("наклон кузова по уклону под колёсами");
ck("на ровной дороге кузов не качает", flat.length > 30 && Math.max(...flat) < 0.03,
   `${flat.length} кадров, максимум ${Math.max(...flat).toFixed(3)} рад`);
ck("трамплин попал под колёса", onRamp.length >= 5, `${onRamp.length} кадров`);
ck("на подъёме нос задирается", onRamp.length && Math.min(...onRamp) < -0.08,
   onRamp.length ? `${(Math.min(...onRamp) * 57.3).toFixed(1)}°` : "нет данных");
ck("наклон не переходит в опрокидывание", !onRamp.length || Math.max(...onRamp.map(Math.abs)) <= 0.33,
   onRamp.length ? `${(Math.max(...onRamp.map(Math.abs)) * 57.3).toFixed(1)}°` : "нет данных");

await browser.close();
console.log(fail ? `\nПРОВАЛОВ: ${fail}` : "\nВСЁ ОК");
process.exit(fail ? 1 : 0);

import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const chromium = await loadChromium(); const ex = cachedChrome();
const b = await chromium.launch(ex ? { executablePath: ex } : {});
const ctx = await b.newContext({ viewport: { width: 1400, height: 860 } });
await ctx.addInitScript(() => { try { const w = ["ПРЫЖОК","ГАЗ","ЗВЕЗДА","ШАРИК","КОНУС","ЛУЖА","ТРАМПЛИН","ПЛАТФОРМА","ЯМА","БЕНЗИН","МОНСТР","РОБОТ","КРАСКА","ПТИЦА","САМОЛЁТ","ДЕРЕВО","ДОМ","КУСТ","ОБЛАКО","ЦВЕТОК","ЯБЛОКО","МЯЧ","БАБОЧКА","ЁЖИК","РАКЕТА","ПОЕЗД","КОРОВА","ЛОШАДЬ","КУРИЦА","ЗАБОР","СЕНО","МЕЛЬНИЦА","РОМАШКИ","КОЛЕСО"]; const d = {}; w.forEach(x => d[x] = { n: 9, s: 1 }); localStorage.setItem("babygame.stats", JSON.stringify(d)); localStorage.setItem("babygame.session","99"); localStorage.setItem("babygame.parent","1"); } catch (e) {} });
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:8765/index.html?test=1&s=play&seed=5");
await p.waitForFunction(() => window.__bg && window.__bg().state === "play");
await p.waitForTimeout(3000);
// ставим ровно те объекты, что на скринах владельца
await p.evaluate(() => {
  const c = window.__car();
  window.__put({ t: "prop", x: c.x + 420 * c.S, ph: 0.4, kind: "windmill" });
  window.__put({ t: "fuel", x: c.x + 700 * c.S, y: 95 * c.S, ph: 0.2 });
  window.__put({ t: "prop", x: c.x + 980 * c.S, ph: 1.1, kind: "fence" });
});
await p.waitForTimeout(900);
await p.screenshot({ path: "/tmp/shot_play.png" });
console.log("готово");
await b.close();

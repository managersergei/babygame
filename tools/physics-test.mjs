// Физика «с весом» (октябрь 2026): запас на прыжок после края, запомненное раннее нажатие,
// подвеска платформера и боковая динамика в режиме «руль».
// Запуск: python3 -m http.server 8765 &  →  node tools/physics-test.mjs
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const B = process.env.BASE || "http://127.0.0.1:8765/";
const KNOWN = ["ПРЫЖОК","ГАЗ","ЗВЕЗДА","ШАРИК","КОНУС","ЛУЖА","ТРАМПЛИН","ПЛАТФОРМА","ЯМА","БЕНЗИН","МОНСТР","РОБОТ","КРАСКА","ПТИЦА","САМОЛЁТ",
               "ДЕРЕВО","ДОМ","КУСТ","ОБЛАКО","ЦВЕТОК","ЯБЛОКО","МЯЧ","БАБОЧКА","ЁЖИК","РАКЕТА","ПОЕЗД","КОРОВА","ЛОШАДЬ","КУРИЦА",
               "ЗАБОР","СЕНО","МЕЛЬНИЦА","РОМАШКИ","КОЛЕСО","МАШИНА"];
let fail = 0;
const ck = (name, ok, info) => { console.log(`  ${ok ? "ok " : "FAIL"} ${name}${info ? ": " + info : ""}`); if (!ok) fail++; };
const bad = v => typeof v !== "number" || !isFinite(v);

const chromium = await loadChromium();
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: cachedChrome() }); }
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(w => { try { const d = {}; w.forEach(x => d[x] = { n: 9, s: 99 });   // выучены в этой же сессии — повтор урока не наступит localStorage.setItem("babygame.stats", JSON.stringify(d));
  localStorage.setItem("babygame.session", "99"); localStorage.setItem("babygame.parent", "1"); } catch (e) {} }, KNOWN);
const errs = [];
const p = await ctx.newPage();
p.on("pageerror", e => errs.push(e.message));
await p.goto(B + "index.html?test=1&s=play&seed=9");
await p.waitForFunction(() => window.__bg && window.__bg().state === "play");
await p.evaluate(() => window.__phys().quiet());
await p.waitForTimeout(1500);

/* Съезд с края платформы: как только колёса ушли с края, жмём прыжок. С запасом это прыжок
   с земли (jumps=1, сила первого прыжка), без запаса — уже второй, воздушный. */
const edge = coyote => p.evaluate(cy => new Promise(res => {
  const P = window.__phys(), c = window.__car(), S = c.S, keep = P.PHYS.coyote;
  P.PHYS.coyote = cy;
  window.__put({ t: "plat", x: c.x - 80 * S, w: 160 * S, h: 100 * S });
  P.set({ carY: 100 * S, vy: 0, grounded: true, jumps: 0, lastGroundH: 100 * S });
  let n = 0;
  function step() {
    const d = window.__phys();
    if (!d.grounded && d.jumps === 1 && d.vy <= 0) {
      const before = d.coyoteT; d.act(); const a = window.__phys();
      P.PHYS.coyote = keep;
      return res({ before: +before.toFixed(3), jumps: a.jumps, vy: Math.round(a.vy / S), j1: Math.round(a.J1 / S) });
    }
    if (++n < 240) requestAnimationFrame(step); else { P.PHYS.coyote = keep; res(null); }
  }
  requestAnimationFrame(step);
}), coyote);
console.log("запас на прыжок после края");
const e1 = await edge(0.10);
ck("съехал с края и нажал сразу — прыжок с земли", e1 && e1.jumps === 1 && Math.abs(e1.vy - e1.j1) <= 1, JSON.stringify(e1));
await p.waitForTimeout(1500);
const e0 = await edge(0);
ck("без запаса то же нажатие — уже второй прыжок", e0 && e0.jumps === 2, JSON.stringify(e0));
await p.waitForTimeout(1500);

/* Запомненное нажатие: прыжки кончились, до земли меньше 0,1 с — жмём, и машинка
   подпрыгивает сразу после касания. */
console.log("раннее нажатие перед посадкой");
const buf = await p.evaluate(() => new Promise(res => {
  const P = window.__phys(), S = P.S;
  P.set({ carY: 40 * S, vy: -300 * S, grounded: false, jumps: 2 });
  P.act();
  const armed = window.__phys().jumpBufT;
  let n = 0, up = 0;
  function step() {
    const d = window.__phys();
    if (d.vy > 0.5 * P.J1) up = Math.max(up, d.vy / S);
    if (++n < 30) requestAnimationFrame(step); else res({ armed, up });
  }
  requestAnimationFrame(step);
}));
ck("нажатие запомнено", buf.armed > 0.05, `${buf.armed.toFixed(3)} с`);
ck("после посадки машинка сама подпрыгнула", buf.up > 0, `vy ${buf.up.toFixed(0)}`);
await p.waitForTimeout(1500);

/* Подвеска: роняем машинку с высоты — кузов приседает и за секунду успокаивается. */
console.log("подвеска платформера");
const sus = await p.evaluate(() => new Promise(res => {
  const P = window.__phys(), S = P.S;
  P.set({ carY: 150 * S, vy: 0, grounded: false, jumps: 2 });
  let land = -1, minDy = 0, nan = false;
  const t0 = performance.now(), after = [];
  function step() {
    const d = window.__phys(), t = (performance.now() - t0) / 1000;
    if (!isFinite(d.bodyDy) || !isFinite(d.bodyPitch)) nan = true;
    if (land < 0 && d.grounded) land = t;
    if (land >= 0) { minDy = Math.min(minDy, d.bodyDy / S); if (t - land > 1.0) after.push(d.bodyDy / S); }
    if (t < 2.4 && after.length < 10) requestAnimationFrame(step); else res({ land, minDy, nan, after, st: window.__bg().state + ':' + d.lesson, y: Math.round(d.carY / S), g: d.grounded, n: after.length });
  }
  requestAnimationFrame(step);
}));
const endDy = sus.after.length ? Math.max(...sus.after.map(Math.abs)) : NaN;
ck("машинка приземлилась", sus.land >= 0, `через ${sus.land.toFixed(2)} с; ${sus.st} y=${sus.y} g=${sus.g}`);
ck("при посадке кузов присел", sus.minDy < -3, `${sus.minDy.toFixed(1)} px`);
ck("через секунду кузов на месте", endDy < 0.5, `${endDy.toFixed(2)} px`);
ck("ни одного NaN", !sus.nan);

/* Руль: зажали «вправо» — машинка переезжает в правый ряд, встаёт в нём и не проскакивает. */
console.log("руль: боковая динамика");
const q = await ctx.newPage();
q.on("pageerror", e => errs.push(e.message));
await q.goto(B + "index.html?s=lane&test=1");
await q.waitForFunction(() => window.__bg && window.__bg().state === "lane", null, { timeout: 20000 });
await q.evaluate(() => { const b = document.getElementById("pult"); if (b && b.style.display !== "none") document.getElementById("pultClose").click(); });
await q.waitForTimeout(500);
await q.evaluate(() => { const L = window.__lane(); L.quiet(); L.ln.spawnZ = 999; L.ln.objs.length = 0; L.ln.x = 0; L.ln.vx = 0; });
await q.keyboard.down("ArrowRight");
const lr = await q.evaluate(() => new Promise(res => {
  const ln = window.__lane().ln, t0 = performance.now(), out = [];
  function step() {
    const t = (performance.now() - t0) / 1000;
    out.push({ t, x: ln.x, roll: ln.roll, pitch: ln.pitch, sy: ln.sy, vx: ln.vx });
    if (t < 1.6) requestAnimationFrame(step); else res(out);
  }
  requestAnimationFrame(step);
}));
await q.keyboard.up("ArrowRight");
const at12 = lr.filter(s => s.t >= 1.2 && s.t <= 1.6);
const maxX = Math.max(...lr.map(s => s.x)), minRoll = Math.min(...lr.map(s => s.roll));
ck("через 1,2 с машинка в правом ряду", at12.length > 0 && at12.every(s => Math.abs(s.x - 1) < 0.05),
   at12.length ? `x=${at12[0].x.toFixed(3)}` : "нет данных");
ck("проскок за ряд меньше 0,15", maxX - 1 < 0.15, `max x=${maxX.toFixed(3)}`);
ck("в повороте вправо кузов кренится наружу (влево, roll < 0)", minRoll < -0.01, `${minRoll.toFixed(3)} рад`);
ck("ни одного NaN в руле", !lr.some(s => bad(s.x) || bad(s.roll) || bad(s.pitch) || bad(s.sy) || bad(s.vx)));
ck("без ошибок на странице", errs.length === 0, errs.slice(0, 3).join(" | "));

await browser.close();
console.log(fail ? `\nПРОВАЛОВ: ${fail}` : "\nВСЁ ОК");
process.exit(fail ? 1 : 0);

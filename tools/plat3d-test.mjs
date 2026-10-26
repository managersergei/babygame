// Проверка 3D-платформера (17b-plat3d.js): под ?3d=1 в браузере с WebGL включается 3D-путь,
// 20 с автоигры без ошибок страницы, вызовов отрисовки ≤ 100; без WebGL — молча прежний 2D.
// SHOTS=1 — ещё и снимки из самой игры в /tmp/p3d-*.png (трамплин, платформа, яма, звёзды, ночь, темы).
// Запуск: python3 -m http.server 8765 &  →  node tools/plat3d-test.mjs
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }

const B = process.env.BASE || "http://127.0.0.1:8765/";
const SHOTS = process.env.SHOTS === "1";
let fail = 0;
const ck = (n, ok, d) => { console.log(`  ${ok ? "ok " : "FAIL"} ${n}${d !== undefined ? ": " + d : ""}`); if (!ok) fail++; };
const chromium = await loadChromium();
async function launch(args) {
  try { return await chromium.launch({ args }); } catch { return await chromium.launch({ args, executablePath: cachedChrome() }); }
}
const Q = "?s=play&rec=1&auto=1&test=1&seed=5&3d=1";

async function run(args, want3d, label) {
  console.log(label);
  const browser = await launch(args);
  const errs = [];
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.on("pageerror", e => errs.push(e.message));
  if (SHOTS && want3d) {                     // для снимков все слова выучены: уроки не прячут предметы и не приближают камеру
    const w = ["ПРЫЖОК","ГАЗ","ЗВЕЗДА","ШАРИК","КОНУС","ЛУЖА","ТРАМПЛИН","ПЛАТФОРМА","ЯМА","БЕНЗИН","МОНСТР","РОБОТ","КРАСКА","ПТИЦА",
               "САМОЛЁТ","ДЕРЕВО","ДОМ","КУСТ","ОБЛАКО","ЦВЕТОК","ЯБЛОКО","МЯЧ","БАБОЧКА","ЁЖИК","РАКЕТА","ПОЕЗД","КОРОВА","ЛОШАДЬ",
               "КУРИЦА","ЗАБОР","СЕНО","МЕЛЬНИЦА","РОМАШКИ","КОЛЕСО","МАШИНА"];
    const d = {}; w.forEach(x => d[x] = { n: 9, s: 1 });
    await p.goto(B);
    await p.evaluate(s => { localStorage.setItem("babygame.parent", "1"); localStorage.setItem("babygame.stats", s); localStorage.setItem("babygame.session", "99"); }, JSON.stringify(d));
  }
  await p.goto(B + Q + (process.env.EXTRA || ""));
  await p.waitForFunction(() => window.__bg && window.__bg().state === "play", null, { timeout: 20000 });
  if (want3d) {
    const up = await p.waitForFunction(() => window.__bg().p3d.st === 2 && window.__bg().p3d.calls > 0, null, { timeout: 20000 }).then(() => true, () => false);
    ck("3D-путь включился", up, JSON.stringify(await p.evaluate(() => window.__bg().p3d)));
  }
  let maxCalls = 0, maxTris = 0, msSum = 0, msN = 0, x0 = await p.evaluate(() => window.__bg().carXw);
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(1000);
    const s = await p.evaluate(() => window.__bg().p3d);
    if (s.calls) { maxCalls = Math.max(maxCalls, s.calls); maxTris = Math.max(maxTris, s.tris); msSum += s.ms; msN++; }
  }
  const fps = await p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res((n * 1000 / (performance.now() - t0)).toFixed(1)); }; requestAnimationFrame(f); }));
  console.log(`  кадров в секунду: ${fps}`);
  const b = await p.evaluate(() => window.__bg());
  ck("машинка ехала 20 с", b.carXw - x0 > 500, `${x0} → ${b.carXw}, состояние ${b.state}`);
  ck("нет ошибок страницы", errs.length === 0, errs.slice(0, 3).join(" | "));
  if (want3d) {
    ck("3D активен всю игру", b.p3d.st === 2, JSON.stringify(b.p3d));
    ck("вызовов отрисовки ≤ 100", maxCalls > 0 && maxCalls <= 100, `макс ${maxCalls}, треугольников ${maxTris}, кадр ЦП ${(msSum / Math.max(1, msN)).toFixed(2)} мс`);
    const hidden = await p.evaluate(() => { const c = [...document.querySelectorAll("canvas")].find(c => c.id !== "cv" && c.style.position === "fixed"); return c ? getComputedStyle(c).display : "нет холста"; });
    ck("WebGL-холст виден", hidden === "block", hidden);
  } else {
    ck("без WebGL остался 2D", b.p3d.st !== 2, JSON.stringify(b.p3d));
    const n = await p.evaluate(() => [...document.querySelectorAll("canvas")].filter(c => c.id !== "cv" && c.style.position === "fixed").length);
    ck("WebGL-холста нет", n === 0, n);
  }
  if (want3d && SHOTS) await shots(p);
  await browser.close();
}

/* Снимки: перед машинкой кладём нужный предмет и ловим момент. */
async function shots(p) {
  const put = (o) => p.evaluate((o) => { const c = window.__car(); o.x = c.x + o.dx * c.S; delete o.dx; for (const k of ["w", "h", "y"]) if (o[k]) o[k] *= c.S; return window.__put(o); }, o);
  const calm = () => p.evaluate(() => { window.__phys().quiet(); window.__look({ play: 1 }); });   // только для снимков
  const snap = async (n) => { await calm(); console.log("  состояние " + (await p.evaluate(() => { const b = window.__bg(); return b.state + " x=" + b.carXw + " spd=" + b.spd + " T=" + b.T + " th=" + JSON.stringify(window.__th().k); }))); await p.screenshot({ path: `/tmp/p3d-${n}.png` }); console.log("  снимок /tmp/p3d-" + n + ".png"); };
  // урок слова прячет предметы и приближает камеру — ждём обычную езду и глушим очередь слов
  await p.waitForFunction(() => window.__bg().state === "play", null, { timeout: 40000 }).catch(() => {});
  await calm();
  await put({ t: "ramp", dx: 520, w: 260, h: 110 });
  await put({ t: "star", dx: 420, y: 150, ph: 0 }); await put({ t: "star", dx: 560, y: 210, ph: 1 }); await put({ t: "star", dx: 700, y: 250, ph: 2 });
  await put({ t: "plat", dx: 1100, w: 380, h: 150 });
  await put({ t: "pit", dx: 1700, w: 150 });
  await p.waitForTimeout(150); await snap("1-ramp-stars");
  await p.waitForFunction(() => !window.__bg().grounded && window.__phys().carY > 60 * window.__bg().S, null, { timeout: 8000 }).catch(() => {});
  await snap("2-jump");
  await p.waitForTimeout(900); await snap("3-platform-pit");
  await p.evaluate(() => window.__th().set(1)); await calm(); await p.waitForTimeout(4000); await snap("4-city");
  await p.evaluate(() => window.__th().set(6)); await calm(); await p.waitForTimeout(4000); await snap("5-winter");
  await p.evaluate(() => window.__th().set(2)); await p.waitForTimeout(1600);
  await put({ t: "puddle", dx: 700, w: 200 }); await put({ t: "cone", dx: 900 }); await put({ t: "fuel", dx: 1100, y: 90, ph: 0 });
  await p.waitForTimeout(300); await snap("6-beach");
  await p.evaluate(() => { window.__look({ night: 1, lights: 1 }); window.__th().set(7); });
  await calm(); await p.waitForTimeout(4000); await snap("7-night");
}

if (process.env.GPU === "1") await run(["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"], true, "3D (видеокарта)");
else await run(["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"], true, "3D (swiftshader)");
await run(["--disable-3d-apis", "--disable-webgl"], false, "без WebGL");
console.log(fail ? `PLAT3D: ${fail} провалов` : "PLAT3D: всё зелёное");
process.exit(fail ? 1 : 0);

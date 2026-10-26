// Настройки и админка: числа игры лежат в CFG, панель их правит, выгрузка их сохраняет.
// Заодно проверяем фиксированный шаг симуляции.
// Запуск: python3 -m http.server 8765 &  →  node tools/tune-test.mjs
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const B = process.env.BASE || "http://127.0.0.1:8765/";
const PAGE = process.env.PAGE || "index.html";
let fail = 0;
const ck = (name, ok, info) => { console.log(`  ${ok ? "ok " : "FAIL"} ${name}${info ? ": " + info : ""}`); if (!ok) fail++; };

const chromium = await loadChromium(); const ex = cachedChrome();
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: ex }); }
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

await page.goto(`${B}${PAGE}?admin=1&test=1`, { waitUntil: "load" });
await page.waitForTimeout(3500);

const s0 = await page.evaluate(() => ({
  groups: window.__cfg ? Object.keys(window.__cfg.groups()) : [],
  rows: document.querySelectorAll("#admin .arow").length,
  sliders: document.querySelectorAll("#admin .asld").length,
  shown: !!document.getElementById("admin") && getComputedStyle(document.getElementById("admin")).display !== "none",
  sim: window.__sim ? window.__sim() : null,
}));

console.log("настройки и админка");
ck("панель открылась по ?admin=1", s0.shown);
for (const g of ["TUNE", "WEIGHT", "PHYS", "LN", "SIM"]) ck(`группа ${g} зарегистрирована`, s0.groups.includes(g));
ck("панель показывает настройки", s0.rows > 50, `${s0.rows} строк, ${s0.sliders} ползунков`);

console.log("фиксированный шаг симуляции");
ck("шаг соответствует частоте", s0.sim && Math.abs(s0.sim.step - 1 / s0.sim.hz) < 1e-9, s0.sim ? `${s0.sim.hz} Гц → ${s0.sim.step.toFixed(5)} с` : "нет данных");
ck("накопитель не разбухает", s0.sim && s0.sim.acc >= 0 && s0.sim.acc < s0.sim.step, s0.sim ? `${s0.sim.acc.toFixed(5)} с` : "нет данных");

// правка настройки обязана дойти до производной величины, иначе ползунок обманывает
const s1 = await page.evaluate(() => { const was = window.__sim().cruise; window.__cfg.set("PHYS", "cruise", 400); return { was, now: window.__sim().cruise, phys: window.__sim().phys }; });
console.log("правка на лету");
ck("значение применилось", s1.phys === 400);
ck("производная величина пересчиталась", s1.now !== s1.was, `CRUISE ${s1.was.toFixed(1)} → ${s1.now.toFixed(1)}`);

const s2 = await page.evaluate(() => {
  const js = window.__cfg.exportJs();
  window.__cfg.reset();
  return { js, afterReset: window.__sim().phys, stored: (() => { try { return localStorage.getItem("babygame.tune"); } catch (e) { return "x"; } })() };
});
ck("выгрузка содержит правку", /"cruise":\s*400/.test(s2.js));
ck("выгрузка — валидный js", /^\/\*[\s\S]*window\.TUNE_OVERRIDES = \{/.test(s2.js));
ck("сброс вернул заводское", s2.afterReset === 235, String(s2.afterReset));
ck("сброс очистил хранилище", !s2.stored);

// новые ключи физики и 3D обязаны попадать в выгрузку tune.js — иначе правка из админки не уедет всем
console.log("новые ключи в выгрузке");
for (const g of ["L3"]) ck(`группа ${g} зарегистрирована`, s0.groups.includes(g));
const NEW = { PHYS: ["coyote", "jumpBuf", "suspW"], LN: ["steerW", "rollK"], L3: ["camBack", "fov"] };
const s3 = await page.evaluate((NEW) => {
  const C = window.__cfg, miss = [];
  for (const g in NEW) for (const k of NEW[g]) {
    const d = C.def(g);
    if (!d || typeof d[k] !== "number") { miss.push(g + "." + k); continue; }
    C.set(g, k, +(d[k] * 1.5 + 0.01).toFixed(3));
  }
  const js = C.exportJs(); C.reset();
  return { js, miss };
}, NEW);
ck("ключи существуют в настройках", s3.miss.length === 0, s3.miss.join(", "));
const ov = (() => { try { return JSON.parse(s3.js.slice(s3.js.indexOf("{"), s3.js.lastIndexOf("}") + 1)); } catch { return null; } })();
for (const g in NEW) for (const k of NEW[g]) ck(`выгрузка содержит ${g}.${k}`, !!(ov && ov[g] && typeof ov[g][k] === "number"));

ck("ошибок в консоли нет", errs.length === 0, errs.slice(0, 3).join(" | "));

// ?fixed=1: кадр = ровно SIM.hz/60 шагов. Два прогона с одним seed за одно число кадров — одна и та же игра.
console.log("?fixed=1 — повторяемость");
async function fixedRun() {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  p.on("pageerror", (e) => errs.push("fixed: " + e.message));
  await p.goto(B);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem("babygame.parent", "1"); });
  await p.goto(`${B}${PAGE}?s=endless&seed=7&fixed=1&test=1`, { waitUntil: "load" });
  await p.waitForFunction(() => window.__sim && window.__sim().snaps.length >= 8, null, { timeout: 60000 });
  const r = await p.evaluate(() => ({ fixed: window.__sim().fixed, snaps: window.__sim().snaps.slice(0, 8) }));
  await p.close();
  return r;
}
const fa = await fixedRun(), fb = await fixedRun();
const last = fa.snaps[fa.snaps.length - 1] || {};
ck("режим ?fixed=1 включился", fa.fixed && fb.fixed);
ck("машинка за 480 кадров уехала", fa.snaps.length === 8 && last.carX > fa.snaps[0].carX, `carX ${fa.snaps[0] && fa.snaps[0].carX} → ${last.carX}, звёзд ${last.stars}`);
ck("два прогона совпали покадрово (carX, звёзды)", JSON.stringify(fa.snaps) === JSON.stringify(fb.snaps),
   fa.snaps.map((s, i) => s.carX + "/" + (fb.snaps[i] || {}).carX).join(" "));

await browser.close();
console.log(fail ? `\nПРОВАЛОВ: ${fail}` : "\nВСЁ ОК");
process.exit(fail ? 1 : 0);

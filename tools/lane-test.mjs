// Проверка режима «руль» (пункты 10, 11, 12, 12.1, 12.2, 12.3): геометрия, хитбоксы,
// прыжок, плавный разгон, удаление объектов за экраном и уроки слов внутри режима.
// Запуск: python3 -m http.server 8765 &  →  node tools/lane-test.mjs
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }

const B = process.env.BASE || "http://127.0.0.1:8765/";
let fail = 0;
const ck = (n, ok, d) => { console.log(`  ${ok ? "ok " : "FAIL"} ${n}${d !== undefined ? ": " + d : ""}`); if (!ok) fail++; };

const chromium = await loadChromium();
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: cachedChrome() }); }
const errs = [];
async function open(q, storage) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(B);
  await p.evaluate(s => { localStorage.setItem("babygame.parent", "1"); for (const k in s) localStorage.setItem(k, s[k]); }, storage || {});
  await p.goto(B + q);
  await p.waitForFunction(() => window.__bg && window.__bg().state === "lane", null, { timeout: 20000 });
  // окно телефона-руля показывается один раз за сессию и перехватывает пробел — закрываем
  await p.evaluate(() => { const b = document.getElementById("pult"); if (b && b.style.display !== "none") document.getElementById("pultClose").click(); });
  await p.waitForTimeout(300);
  return p;
}
const lane = p => p.evaluate(() => window.__bg().lane);

console.log("1) геометрия и хитбоксы (пункт 12.1)");
let p = await open("?s=lane&test=1");
// объект в соседней полосе не должен задевать машинку, стоящую по центру
const geo = await p.evaluate(() => {
  const L = window.__lane(), ln = L.ln;
  const near = L.proj(0), out = [];
  for (const kind of L.kinds) {
    const hpx = kind.h * (window.innerHeight / 800) * near.k * 1.6;
    for (const lane of [0, 1]) {
      const dx = Math.abs(lane - 0) * near.half * 0.6;
      out.push({ t: kind.t, lane, dx: Math.round(dx) });
    }
  }
  return { out, half: Math.round(near.half), k: +near.k.toFixed(2) };
});
ck("соседняя полоса дальше корпуса машины", geo.out.filter(o => o.lane === 1).every(o => o.dx > 380), JSON.stringify(geo.out.filter(o => o.lane === 1).map(o => o.dx)));

// прямая проверка: ставим конус в соседнюю полосу и проезжаем — удара быть не должно
const near1 = await p.evaluate(async () => {
  const L = window.__lane(), ln = L.ln;
  ln.objs.length = 0; ln.x = 0; ln.hits = 0; ln.overs = 0;
  L.push({ t: "cone", h: 80, jump: true }, 1, 0.35);
  return true;
});
await p.waitForTimeout(2500);
ck("конус в соседней полосе не задевает", (await lane(p)).hits === 0, `ударов ${(await lane(p)).hits}`);

// тот же конус в своей полосе — удар должен быть
await p.evaluate(() => { const L = window.__lane(); L.ln.objs.length = 0; L.ln.x = 0; L.ln.hits = 0; L.push({ t: "cone", h: 80, jump: true }, 0, 0.35); });
await p.waitForTimeout(2500);
ck("конус в своей полосе бьёт", (await lane(p)).hits === 1, `ударов ${(await lane(p)).hits}`);

console.log("2) прыжок (пункт 11)");
await p.evaluate(() => { const L = window.__lane(); L.ln.objs.length = 0; L.ln.x = 0; L.ln.hits = 0; L.ln.overs = 0; L.ln.jumps = 0; });
await p.keyboard.press("Space");
await p.waitForTimeout(120);
ck("пробел поднимает машинку", (await lane(p)).y > 20, `высота ${(await lane(p)).y}`);
await p.waitForTimeout(1200);
ck("машинка приземляется", (await lane(p)).y === 0, `высота ${(await lane(p)).y}`);
// перепрыгнуть конус
await p.evaluate(() => { const L = window.__lane(); L.ln.objs.length = 0; L.ln.x = 0; L.ln.hits = 0; L.ln.overs = 0; L.push({ t: "cone", h: 80, jump: true }, 0, 0.30); });
await p.waitForTimeout(600); await p.keyboard.press("Space");
await p.waitForTimeout(2200);
const jr = await lane(p);
ck("конус можно перепрыгнуть", jr.overs === 1 && jr.hits === 0, `перепрыгнуто ${jr.overs}, ударов ${jr.hits}`);
// стог сена перепрыгнуть нельзя
await p.evaluate(() => { const L = window.__lane(); L.ln.objs.length = 0; L.ln.x = 0; L.ln.hits = 0; L.ln.overs = 0; L.push({ t: "haystack", h: 120 }, 0, 0.30); });
await p.waitForTimeout(600); await p.keyboard.press("Space");
await p.waitForTimeout(2200);
const hs = await lane(p);
ck("стог сена не перепрыгивается", hs.hits === 1 && hs.overs === 0, `ударов ${hs.hits}, перепрыгнуто ${hs.overs}`);
await p.close();

console.log("3) скорость и плотность (пункт 12)");
p = await open("?s=lane&test=1");
const s0 = (await lane(p)).spd;
await p.waitForTimeout(20000);
const s1 = await lane(p);
ck("старт медленный", s0 <= 0.27, `спд ${s0}`);
ck("разгон постепенный", s1.spd > s0 && s1.spd < 0.33, `через 20 с ${s1.spd}`);
ck("на дороге не толпа", s1.objs <= 8, `объектов ${s1.objs}`);
await p.close();

console.log("4) объекты уезжают за экран, а не пропадают (пункт 12.2)");
p = await open("?s=lane&test=1");
const zmin = await p.evaluate(async () => {
  const L = window.__lane(); let m = 9;
  for (let i = 0; i < 120; i++) {
    await new Promise(r => setTimeout(r, 50));
    for (const o of L.ln.objs) if (o.z < m) m = o.z;
  }
  return +m.toFixed(2);
});
ck("объект доживает ниже плоскости машинки", zmin < -0.2, `минимальный z ${zmin}`);
await p.close();

console.log("5) уроки слов внутри режима (пункт 12.3)");
p = await open("?s=lane&test=1&fast=3");
let sawLesson = false, backToLane = false;
for (let i = 0; i < 120; i++) {
  const st = await p.evaluate(() => window.__bg().state);
  if (st === "lesson") { sawLesson = true; break; }
  await p.waitForTimeout(500);
}
ck("урок начался прямо в режиме «руль»", sawLesson, sawLesson ? "да" : "за 60 с не дождались");
if (sawLesson) {
  const key = await p.evaluate(() => window.__bg().les || null);
  for (let i = 0; i < 60; i++) {                       // проходим урок пробелом
    const st = await p.evaluate(() => window.__bg().state);
    if (st === "lane") { backToLane = true; break; }
    await p.keyboard.press("Space");
    await p.waitForTimeout(700);
  }
  ck("после урока вернулись в «руль», а не в бесконечный", backToLane, backToLane ? "lane" : await p.evaluate(() => window.__bg().state));
}
await p.close();

if (errs.length) { console.log("ошибки страницы:", errs.slice(0, 3).join(" | ")); fail += errs.length; }
await browser.close();
console.log(fail ? `\nПРОВАЛОВ: ${fail}` : "\nВСЁ ОК");
process.exit(fail ? 1 : 0);

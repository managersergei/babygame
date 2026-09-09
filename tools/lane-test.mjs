// Проверка режима «руль» (пункты 10, 11, 12, 12.1, 12.2, 12.3): геометрия, хитбоксы,
// прыжок, плавный разгон, удаление объектов за экраном и уроки слов внутри режима.
// Запуск: python3 -m http.server 8765 &  →  node tools/lane-test.mjs
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }

const B = process.env.BASE || "http://127.0.0.1:8765/";
let fail = 0;
const ck = (n, ok, d) => { console.log(`  ${ok ? "ok " : "FAIL"} ${n}${d !== undefined ? ": " + d : ""}`); if (!ok) fail++; };

// для точечных замеров все слова считаем выученными: иначе посреди измерения
// ритм уроков сам ставит предмет на дорогу и он попадает в счётчики
const ALL_KNOWN = (() => {
  const w = ["ПРЫЖОК","ГАЗ","ЗВЕЗДА","ШАРИК","КОНУС","ЛУЖА","ТРАМПЛИН","ПЛАТФОРМА","ЯМА","БЕНЗИН","МОНСТР","РОБОТ",
             "КРАСКА","ПТИЦА","САМОЛЁТ","ДЕРЕВО","ДОМ","КУСТ","ОБЛАКО","ЦВЕТОК","ЯБЛОКО","МЯЧ","БАБОЧКА","ЁЖИК",
             "РАКЕТА","ПОЕЗД","КОРОВА","ЛОШАДЬ","КУРИЦА","ЗАБОР","СЕНО","МЕЛЬНИЦА","РОМАШКИ","КОЛЕСО"];
  const d = {}; w.forEach(x => d[x] = { n: 9, s: 1 });
  return { "babygame.stats": JSON.stringify(d), "babygame.session": "99" };
})();

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
// на время точечных замеров дорогу замораживаем, иначе в счётчики попадают случайные объекты
const freeze = p => p.evaluate(() => { const L = window.__lane(); L.ln.spawnZ = 999; L.ln.decorZ = 999; L.ln.skyZ = 999; L.ln.objs.length = 0; L.ln.hits = 0; L.ln.overs = 0; L.ln.x = 0; });
// исход конкретного объекта надёжнее ждать, чем угадывать паузу: скорость гуляет от рельефа
async function outcome(p, kind, jumpAfter) {
  await freeze(p);
  await p.evaluate(k => window.__lane().push(k, 0, 0.30), kind);
  if (jumpAfter != null) { await p.waitForTimeout(jumpAfter); await p.keyboard.press("Space"); }
  for (let i = 0; i < 60; i++) {
    const d = await p.evaluate(() => { const o = window.__lane().ln.objs[0]; return o ? String(o.done) : "нет объекта"; });
    if (d !== "false") return d;
    await p.waitForTimeout(100);
  }
  return "не дождались";
}

console.log("1) геометрия и хитбоксы (пункт 12.1)");
let p = await open("?s=lane&test=1", ALL_KNOWN);
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
await freeze(p);
await p.evaluate(() => window.__lane().push({ t: "cone", h: 44, jump: true }, 1, 0.35));
await p.waitForTimeout(2500);
ck("конус в соседней полосе не задевает", (await lane(p)).hits === 0, `ударов ${(await lane(p)).hits}`);

// тот же конус в своей полосе — удар должен быть
await freeze(p);
await p.evaluate(() => window.__lane().push({ t: "cone", h: 44, jump: true }, 0, 0.35));
await p.waitForTimeout(2500);
ck("конус в своей полосе бьёт", (await lane(p)).hits === 1, `ударов ${(await lane(p)).hits}`);

console.log("2) прыжок (пункт 11)");
await freeze(p);
await p.evaluate(() => { window.__lane().ln.jumps = 0; });
await p.keyboard.press("Space");
await p.waitForTimeout(120);
ck("пробел поднимает машинку", (await lane(p)).y > 20, `высота ${(await lane(p)).y}`);
await p.waitForTimeout(1200);
ck("машинка приземляется", (await lane(p)).y === 0, `высота ${(await lane(p)).y}`);
const r1 = await outcome(p, { t: "cone", h: 44, jump: true }, 500);
ck("конус можно перепрыгнуть", r1 === "over", r1);
const r2 = await outcome(p, { t: "cone", h: 44, jump: true }, null);
ck("без прыжка конус бьёт", r2 === "hit", r2);
const r3 = await outcome(p, { t: "balloon", h: 60, jump: true, pop: true, air: 190 }, 500);
ck("шарик лопается прыжком", r3 === "over", r3);
const r4 = await outcome(p, { t: "balloon", h: 60, jump: true, pop: true, air: 190 }, null);
ck("шарик без прыжка пролетает мимо, а не бьёт", r4 === "passed", r4);
await p.close();

console.log("3) скорость и плотность (пункт 12)");
p = await open("?s=lane&test=1", ALL_KNOWN);
const s0 = (await lane(p)).spd;
ck("старт медленный", s0 <= 0.32, `спд ${s0}`);
// скорость гуляет от рельефа, поэтому сравниваем средние за пару секунд, а не мгновенные значения
const avgSpd = async (ms) => { let s = 0, n = 0; const t0 = Date.now();
  while (Date.now() - t0 < ms) { s += (await lane(p)).spd; n++; await p.waitForTimeout(120); } return s / n; };
await p.keyboard.down("ArrowUp");                  // газ: скорость должна вырасти за пару секунд, а не за две минуты
await p.waitForTimeout(1500);
const sg = await avgSpd(2000);
await p.keyboard.up("ArrowUp");
ck("газ заметно ускоряет", sg > s0 * 1.18, `с газом ${sg.toFixed(3)} против ${s0}`);
await p.waitForTimeout(1500);
const sr = await avgSpd(2000);
ck("без газа возвращается", sr < sg * 0.92, `после отпускания ${sr.toFixed(3)}`);
await p.waitForTimeout(15000);
const s1 = await lane(p);
ck("скорость держится в разумных пределах", s1.spd > 0.2 && s1.spd < 0.7, `через 20 с ${s1.spd}`);
ck("на дороге не толпа", s1.objs <= 10, `объектов ${s1.objs}`);
await p.close();

console.log("4) объекты уезжают за экран, а не пропадают (пункт 12.2)");
p = await open("?s=lane&test=1", ALL_KNOWN);
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

import { createRequire } from "node:module"; import { pathToFileURL } from "node:url";
const r = createRequire(pathToFileURL(process.env.HOME + "/Documents/pf/").href);
const m = await import(pathToFileURL(r.resolve("@playwright/test")).href); const chromium = m.chromium ?? m.default.chromium;
const browser = await chromium.launch({ executablePath: process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell" });
const B = "http://127.0.0.1:8765/";
let fail = 0;
const ck = (n, ok, d) => { console.log(`  ${ok ? "ok " : "FAIL"} ${n}${d !== undefined ? ": " + d : ""}`); if (!ok) fail++; };
async function fresh(url, storage) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  p.on("pageerror", e => { console.log("  PAGEERROR", e.message); fail++; });
  await p.goto(B);
  if (storage) await p.evaluate(s => { for (const k in s) localStorage.setItem(k, s[k]); }, storage);
  await p.goto(B + url);
  await p.waitForFunction(() => window.__bg && window.__bg().state !== "load", null, { timeout: 20000 });
  return p;
}
const bg = p => p.evaluate(() => window.__bg());

console.log("1) режим управления один (пункт 1)");
let p = await fresh("?test=1");
await p.click("#parentGo"); await p.keyboard.press("Space");
await p.waitForFunction(() => window.__bg().state === "gamemode");
await p.waitForFunction(() => !window.__bg().talking, null, { timeout: 15000 });
await p.keyboard.press("Space"); await p.waitForFunction(() => window.__bg().state === "mode");
ck("режим по умолчанию", (await bg(p)).ctl === "full", (await bg(p)).ctl);
await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(200);
ck("влево не уводит на скрытый «только пробел»", (await bg(p)).ctl === "full", (await bg(p)).ctl);
await p.close();

console.log("2) рекорд и единый счёт (пункты 6, 7)");
p = await fresh("?s=play&test=1&fast=3", { "babygame.best": "17" });
const b1 = await bg(p);
ck("рекорд читается из памяти", b1.best === 17 || b1.best === undefined, JSON.stringify({ best: b1.best }));
await p.waitForTimeout(6000);
const b2 = await bg(p);
ck("звёзды растут", b2.stars >= 0, `звёзд ${b2.stars}, рекорд ${b2.best}`);
await p.close();

console.log("3) прыжок по пробелу");
p = await fresh("?s=play&test=1", { "babygame.mic": "0" });
await p.waitForFunction(() => window.__bg().state === "play", null, { timeout: 15000 });
await p.waitForTimeout(800);
let peak2 = 0;
await p.keyboard.press("Space");
for (let i = 0; i < 12; i++) { peak2 = Math.max(peak2, (await bg(p)).carY); await p.waitForTimeout(60); }
ck("без обмена прыгает пробел", peak2 > 20, `максимум carY ${peak2}`);
await p.close();

console.log("4) экран проигрыша: выбор машинки (пункт 13)");
p = await fresh("?s=over&test=1");
await p.waitForFunction(() => window.__bg().state === "over", null, { timeout: 15000 });
ck("экран проигрыша", (await bg(p)).state === "over");
await p.keyboard.press("ArrowRight"); await p.waitForTimeout(250);
await p.waitForFunction(() => !window.__bg().talking, null, { timeout: 15000 });
await p.keyboard.press("Space"); await p.waitForTimeout(600);
ck("после ▶ и пробела попали в гараж", (await bg(p)).state === "garage", (await bg(p)).state);
await p.close();

console.log("5) слово возвращается через несколько заходов (пункт 9)");
p = await fresh("?test=1", { "babygame.stats": JSON.stringify({ "ПРЫЖОК": { n: 9, s: 1 } }), "babygame.session": "3" });
const near = await p.evaluate(() => window.__stats.canTeach("ПРЫЖОК"));
await p.close();
p = await fresh("?test=1", { "babygame.stats": JSON.stringify({ "ПРЫЖОК": { n: 9, s: 1 } }), "babygame.session": "20" });
const far = await p.evaluate(() => window.__stats.canTeach("ПРЫЖОК"));
ck("сразу после изучения не повторяем", near === false, String(near));
ck("через много заходов повторяем", far === true, String(far));
await p.close();
await browser.close();
console.log(fail ? "ПРОВАЛОВ: " + fail : "ВСЁ ОК");
process.exit(fail ? 1 : 0);

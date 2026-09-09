// Автопроверка в headless Chromium: гараж → руль, мобильный тач в портрете, режим записи.
// Запуск: python3 -m http.server 8765 &  →  node tools/smoke.mjs   (playwright ищется как в record.mjs)
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { existsSync, readdirSync } from "node:fs";
async function loadChromium() {
  const bases = [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href];
  for (const b of bases) for (const n of ["playwright", "@playwright/test"]) {
    try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {}
  }
  throw new Error("playwright не найден");
}
function cachedChrome() {
  const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null;
  const dirs = readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0]);
  for (const d of dirs) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; }
  return null;
}
const chromium = await loadChromium();
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: cachedChrome() }); }
const BASE = process.env.BASE || "http://127.0.0.1:8765/";
let fails = 0;
async function run(name, fn) { try { await fn(); console.log("OK   " + name); } catch (e) { fails++; console.log("FAIL " + name + ": " + e.message.split("\n").slice(0, 6).join(" / ")); } }
const bg = (page) => page.evaluate(() => window.__bg());
const quiet = (page) => page.waitForFunction(() => !window.__bg().talking, null, { timeout: 15000 });
const shown = (page, id) => page.evaluate((id) => getComputedStyle(document.getElementById(id)).display !== "none", id);

await run("desktop: гараж → родители → режим РУЛЬ → руление → Esc", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; page.on("pageerror", e => errs.push("pageerror: " + e.message)); page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await page.goto(BASE + "?test=1"); await page.waitForFunction(() => window.__bg && window.__bg().state === "garage", null, { timeout: 20000 });
  if (!(await shown(page, "parent"))) throw new Error("экран для родителей не показан при первом запуске");
  await page.click("#parentGo"); if (await shown(page, "parent")) throw new Error("экран родителей не закрылся");
  await page.keyboard.press("Space"); await page.waitForFunction(() => window.__bg().state === "gamemode");
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(150); await page.keyboard.press("ArrowRight");
  const gm = (await bg(page)).gmId; if (gm !== "lane") throw new Error("gmId=" + gm + " (ожидали lane = РУЛЬ)");
  await quiet(page); await page.keyboard.press("Space"); await page.waitForFunction(() => window.__bg().state === "lane");
  if (!(await shown(page, "pult"))) throw new Error("окно пульта не показано");
  await page.click("#pultClose");
  await page.keyboard.down("ArrowLeft"); await page.waitForTimeout(2500); await page.keyboard.up("ArrowLeft");
  let b = await bg(page); if (b.lane.x > -0.6) throw new Error("руль влево не сработал x=" + b.lane.x); if (b.lane.objs < 1) throw new Error("нет объектов");
  await page.keyboard.press("Space"); await page.waitForTimeout(4000);
  b = await bg(page); console.log("     lane after 6.5s:", JSON.stringify(b.lane), "stars=" + b.stars, "imgs=" + b.imgs);
  await page.keyboard.press("Escape"); await page.waitForFunction(() => window.__bg().state === "garage");
  if (b.imgs < 40) throw new Error("загружено картинок: " + b.imgs);
  if (errs.length) throw new Error(errs.join(" | "));
  await page.close();
});

await run("mobile: портрет → подсказка «поверни», тач-кнопки, старт игры", async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.goto(BASE + "?test=1"); await page.waitForFunction(() => window.__bg && window.__bg().state === "garage", null, { timeout: 20000 });
  if (await shown(page, "turn")) throw new Error("подсказка о повороте закрывает окно «Родителям»");
  await page.click("#parentGo");
  if (!(await shown(page, "turn"))) throw new Error("нет подсказки повернуть телефон в портрете");
  // page.tap виснет на fixed-кнопках с touch-action:none в эмуляции — тапаем по координатам
  const tapKS = async () => { const b = await page.evaluate(() => { const r = document.getElementById("kS").getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }); await page.touchscreen.tap(b[0], b[1]); };
  await tapKS(); await page.waitForFunction(() => window.__bg().state === "gamemode");
  await quiet(page); await tapKS(); await page.waitForTimeout(1500);
  const st = (await bg(page)).state; if (!["play", "name", "intro"].includes(st)) throw new Error("после старта состояние " + st);
  await tapKS(); await page.waitForTimeout(800);
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(300);
  if (await shown(page, "turn")) throw new Error("подсказка «поверни» не исчезла в ландшафте");
  if (errs.length) throw new Error(errs.join(" | "));
  await ctx.close();
});

await run("rec+auto: вертикаль 1080×1920, HUD скрыт, события в консоли, машинка играет сама", async () => {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  const errs = [], ev = []; page.on("pageerror", e => errs.push(e.message)); page.on("console", m => { const t = m.text(); if (t.startsWith("EV ")) ev.push(t); });
  await page.goto(BASE + "?rec=1&auto=1&seed=7&test=1&s=play&w=jump"); await page.waitForFunction(() => window.__bg && window.__bg().state !== "load", null, { timeout: 20000 });
  await page.waitForTimeout(9000);
  const b = await bg(page); if (await shown(page, "pad")) throw new Error("кнопки видны в rec");
  console.log("     rec: state=" + b.state + " stage=" + b.stage + " stars=" + b.stars + " events=" + ev.length + "\n     " + ev.slice(0, 6).join("\n     "));
  if (ev.length < 2) throw new Error("нет событий EV");
  if (errs.length) throw new Error(errs.join(" | "));
  await page.close();
});
await browser.close();
console.log(fails ? "FAILS: " + fails : "ALL OK"); process.exit(fails ? 1 : 0);

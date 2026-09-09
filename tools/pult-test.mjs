// Сквозная проверка телефона-руля без телефона: игра (режим РУЛЬ) + pult.html в двух вкладках headless,
// связь через публичный PeerJS. BASE=https://… node tools/pult-test.mjs
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; const dirs = readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0]); for (const d of dirs) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const chromium = await loadChromium();
const ARGS = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
let browser; try { browser = await chromium.launch({ args: ARGS }); } catch { browser = await chromium.launch({ args: ARGS, executablePath: cachedChrome() }); }
const BASE = process.env.BASE || "https://managersergei.github.io/babygame/";
const game = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; game.on("pageerror", e => errs.push("game: " + e.message));
await game.goto(BASE + "?test=1"); await game.waitForFunction(() => window.__bg && window.__bg().state === "garage", null, { timeout: 30000 });
console.log("sw:", await game.evaluate(async () => { try { const r = await navigator.serviceWorker.getRegistration(); return r ? "registered" : "none"; } catch (e) { return "err " + e.message; } }));
await game.click("#parentGo"); await game.keyboard.press("Space"); await game.waitForFunction(() => window.__bg().state === "gamemode");
await game.keyboard.press("ArrowRight"); await game.waitForTimeout(150); await game.keyboard.press("ArrowRight");
await game.waitForFunction(() => !window.__bg().talking, null, { timeout: 15000 }); await game.keyboard.press("Space");
await game.waitForFunction(() => window.__bg().state === "lane");
await game.waitForFunction(() => /Ждём/.test(document.getElementById("pultState").textContent), null, { timeout: 20000 }).catch(() => {});
const code = await game.evaluate(() => document.getElementById("pultCode").textContent.trim());
const status = await game.evaluate(() => document.getElementById("pultState").textContent);
console.log("code:", code, "| status:", status, "| qr:", await game.evaluate(() => document.getElementById("pultQr").width + "px"));
const pult = await browser.newPage({ viewport: { width: 390, height: 844 } }); pult.on("pageerror", e => errs.push("pult: " + e.message));
await pult.goto(BASE + "pult.html?c=" + code);
await pult.waitForFunction(() => /Подключено/.test(document.getElementById("st").textContent), null, { timeout: 30000 }).catch(() => {});
console.log("pult status:", await pult.evaluate(() => document.getElementById("st").textContent));
await game.waitForFunction(() => /подключён/.test(document.getElementById("pultState").textContent), null, { timeout: 10000 }).catch(() => {});
console.log("game sees pult:", await game.evaluate(() => document.getElementById("pultState").textContent));
const x0 = (await game.evaluate(() => window.__bg())).lane.x;
await pult.evaluate(() => { const b = document.getElementById("L"); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
await game.waitForTimeout(1500);
await pult.evaluate(() => { const b = document.getElementById("L"); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); });
const x1 = (await game.evaluate(() => window.__bg())).lane.x;
console.log("steer via phone: x " + x0 + " → " + x1, x1 < x0 - 0.4 ? "OK" : "FAIL");

// ── ландшафт: кнопки в ряд и все влезают (пункт 9)
await pult.setViewportSize({ width: 844, height: 390 });
await pult.waitForTimeout(400);
const box = await pult.evaluate(() => {
  const R = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bot: Math.round(r.bottom) }; };
  return { L: R("L"), S: R("S"), R: R("R"), h: window.innerHeight, over: document.documentElement.scrollWidth > window.innerWidth + 1 };
});
const inRow = box.L.x < box.S.x && box.S.x < box.R.x;
const fits = box.L.bot <= box.h && box.S.bot <= box.h && box.R.bot <= box.h;
console.log("landscape: кнопки в ряд " + (inRow ? "OK" : "FAIL") + ", влезают " + (fits ? "OK" : "FAIL") +
            ", боковой прокрутки " + (box.over ? "ЕСТЬ FAIL" : "нет OK"));

// ── руль по наклону (пункт 14)
await pult.evaluate(() => document.getElementById("tilt").click());
await pult.waitForTimeout(300);
const wheelOn = await pult.evaluate(() => document.getElementById("wheel").classList.contains("on") &&
                                          document.getElementById("wrap").classList.contains("tilt") &&
                                          getComputedStyle(document.getElementById("L")).display === "none");
console.log("руль вместо кнопок:", wheelOn ? "OK" : "FAIL");
async function tiltTo(beta, gamma) {
  await pult.evaluate(([b, g]) => {
    let e;
    try { e = new DeviceOrientationEvent("deviceorientation", { alpha: 0, beta: b, gamma: g, absolute: false }); }
    catch (err) { e = new Event("deviceorientation"); Object.defineProperty(e, "beta", { value: b }); Object.defineProperty(e, "gamma", { value: g }); }
    window.dispatchEvent(e);
  }, [beta, gamma]);
}
await tiltTo(0, -80);                       // ноль калибровки: телефон «как руль», экран к лицу
await pult.waitForTimeout(150);
await game.evaluate(() => { window.__lane().ln.x = 0; });   // кнопка ◀ до этого увела машинку в упор
for (let i = 0; i < 26; i++) { await tiltTo(-30, -74); await pult.waitForTimeout(60); }   // шлём непрерывно: свежесть данных руля 1,5 с
const steer = await game.evaluate(() => window.__bg().pult || null);
const rot = await pult.evaluate(() => document.getElementById("wheel").style.transform);
const x2 = (await game.evaluate(() => window.__bg())).lane.x;
console.log("наклон рулит: x 0 → " + x2.toFixed(2) + " " + (Math.abs(x2) > 0.2 ? "OK" : "FAIL") + " | руль повёрнут: " + rot);

// ── газ под левым большим пальцем (пункт 4)
const thumbsOn = await pult.evaluate(() => document.getElementById("thumbs").classList.contains("on"));
const g0 = (await game.evaluate(() => window.__bg())).lane.spd;
await pult.evaluate(() => { const b = document.getElementById("G"); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 7 })); });
await game.waitForTimeout(2200);
const g1 = (await game.evaluate(() => window.__bg())).lane.spd;
await pult.evaluate(() => { const b = document.getElementById("G"); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7 })); });
console.log("газ с телефона: кнопки видны " + (thumbsOn ? "OK" : "FAIL") + ", скорость " + g0.toFixed(3) + " → " + g1.toFixed(3) + " " + (g1 > g0 * 1.12 ? "OK" : "FAIL"));

// ── защита от залипания: уход вкладки в фон разряжает все кнопки
await pult.evaluate(() => { const b = document.getElementById("J"); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 9 })); });
await pult.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await game.waitForTimeout(300);
const stuck = await pult.evaluate(() => document.getElementById("J").classList.contains("down"));
console.log("кнопка не залипает при уходе в фон: " + (stuck ? "FAIL" : "OK"));

// ── микрофон с телефона (пункт 3)
const src0 = (await game.evaluate(() => window.__bg())).micSrc;
await pult.evaluate(() => document.getElementById("mic").click());
await game.waitForTimeout(3000);
const src1 = (await game.evaluate(() => window.__bg())).micSrc;
const ready = (await game.evaluate(() => window.__bg())).micReady;
console.log("микрофон телефона: источник " + src0 + " → " + src1 + " " + (src1 === "phone" && ready ? "OK" : "FAIL"));

// ── выключили наклон: управление сразу возвращается кнопкам (баг «1,5 секунды прямо»)
await pult.evaluate(() => document.getElementById("tilt").click());
await game.waitForTimeout(250);
const freshOff = await game.evaluate(() => window.__bg().pultFresh);
console.log("после выключения наклона руль не залипает:", freshOff === false ? "OK" : "FAIL (" + freshOff + ")");

if (errs.length) console.log("errors:", errs.join(" | "));
await browser.close();

// Сквозная проверка телефона-руля без телефона: игра (режим РУЛЬ) + pult.html в двух вкладках headless,
// связь через публичный PeerJS. BASE=https://… node tools/pult-test.mjs
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; const dirs = readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0]); for (const d of dirs) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const chromium = await loadChromium();
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: cachedChrome() }); }
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
if (errs.length) console.log("errors:", errs.join(" | "));
await browser.close();

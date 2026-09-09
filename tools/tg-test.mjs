// Сквозная проверка отчётов в Telegram без телефона: игра (экран «Родителям») ↔ реле на Cloudflare.
// Игра берёт свой код, тест привязывает его к реле от имени Telegram, игра должна увидеть «привязан ✓».
// Запуск: source ~/.config/babygame/tg.env && WEBHOOK_SECRET=$WEBHOOK_SECRET node tools/tg-test.mjs
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; const dirs = readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0]); for (const d of dirs) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }

const BASE = process.env.BASE || "https://managersergei.github.io/babygame/";
const SECRET = process.env.WEBHOOK_SECRET || "";
const CHAT = "777000222";                       // несуществующий чат: привязка пишется, отправка ожидаемо не проходит
const fails = [];
const ok = (c, m) => { console.log((c ? "OK  " : "FAIL") + "  " + m); if (!c) fails.push(m); };

const chromium = await loadChromium();
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: cachedChrome() }); }
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on("pageerror", e => errs.push(e.message));

await page.goto(BASE + "?test=1");
await page.waitForFunction(() => window.__bg && window.__bg().state === "garage", null, { timeout: 30000 });
await page.waitForFunction(() => { const e = document.getElementById("tgOpen"); return e && e.style.display !== "none"; }, null, { timeout: 15000 });
await page.click("#tgOpen");
await page.waitForFunction(() => document.getElementById("bot").style.display !== "none", null, { timeout: 15000 });

const link = await page.evaluate(() => document.getElementById("tgLink").href);
const html = await (await fetch(BASE + "index.html")).text();
const api = (html.match(/var TG_API\s*=\s*'([^']*)'/) || [])[1] || "";
console.log("ссылка:", link);
console.log("реле:  ", api);
ok(/^https:\/\/t\.me\/big_drive_bot\?start=[A-Z2-9]{10}$/.test(link), "ссылка вида t.me/big_drive_bot?start=КОД");
ok(/^https:\/\/[a-z0-9.-]+\.workers\.dev$/.test(api), "адрес реле прописан");
const code = link.split("start=")[1];

await page.waitForFunction(() => document.getElementById("tgQr").width > 0, null, { timeout: 20000 }).catch(() => {});
ok(await page.evaluate(() => document.getElementById("tgQr").width > 0), "QR нарисован");
ok(/Пока не привязано/.test(await page.evaluate(() => document.getElementById("tgState").textContent)), "до привязки — «Пока не привязано»");

const st = await (await fetch(api + "/status?c=" + code)).json();
ok(st.ok === true && st.linked === false, "реле отвечает и код ещё не привязан");

if (!SECRET) { console.log("WEBHOOK_SECRET не задан — привязку не проверяем"); }
else {
  const upd = (text, id) => fetch(api + "/tg", { method: "POST", headers: { "content-type": "application/json", "X-Telegram-Bot-Api-Secret-Token": SECRET }, body: JSON.stringify({ update_id: id, message: { message_id: id, chat: { id: +CHAT, type: "private" }, text } }) });
  await upd("/start " + code, 101);
  ok((await (await fetch(api + "/status?c=" + code)).json()).linked === true, "после /start реле помнит код");
  await page.waitForFunction(() => /привязан/.test(document.getElementById("tgState").textContent), null, { timeout: 30000 }).catch(() => {});
  ok(/привязан/.test(await page.evaluate(() => document.getElementById("tgState").textContent)), "игра сама увидела привязку (опрос раз в 5 с)");
  const ev = await (await fetch(api + "/ev", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ c: code, sum: { words: { "ПРЫЖОК": 2 }, stars: 7, car: "ГОНЩИК" } }) })).json();
  ok(ev.linked === true, "событие игры доехало до привязанного кода (sent=" + ev.sent + ", чат тестовый)");
  // тот же POST, но из самой страницы: так шлёт игра (без заголовка content-type, значит без предзапроса CORS)
  const fromPage = await page.evaluate(async ([u, c]) => {
    try { const r = await fetch(u + "/ev", { method: "POST", body: JSON.stringify({ c: c, sum: { words: { "ПРЫЖОК": 2 }, stars: 7, car: "ГОНЩИК" } }), keepalive: true }); return await r.json(); }
    catch (e) { return { err: String(e) }; }
  }, [api, code]);
  ok(fromPage.linked === true, "браузер игры не упёрся в CORS: " + JSON.stringify(fromPage));
  const foreign = await (await fetch(api + "/ev", { method: "POST", headers: { origin: "https://evil.example" }, body: JSON.stringify({ c: code }) })).status;
  ok(foreign === 403, "чужой источник отклоняется (" + foreign + ")");
  await upd("/stop", 102);
  ok((await (await fetch(api + "/status?c=" + code)).json()).linked === false, "после /stop привязка стёрта");
}

if (errs.length) { console.log("ошибки страницы:", errs.join(" | ")); fails.push("ошибки страницы"); }
await browser.close();
console.log(fails.length ? "\nПРОВАЛЕНО: " + fails.length : "\nвсё сошлось");
process.exit(fails.length ? 1 : 0);

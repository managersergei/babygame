// Проверка отчётов в Telegram без телефона и без сети: реле подменено заглушкой (page.route).
// Игра (экран «Родителям») берёт свой код, заглушка сначала отвечает «не привязан», потом «привязан» —
// игра должна сама это увидеть. Настоящие реле и Telegram тест не трогает: в CI их нет и быть не должно.
// Раньше тест ходил на живое реле и падал на локальном сервере: игра с 127.0.0.1 считает себя
// локальной копией (LOCAL_COPY) и пишет «отчёты пойдут, когда игру откроют с сайта», а не «Пока не привязано».
// Параметр ?tg=<адрес реле> (только вместе с test=1) снимает это ограничение — им и пользуемся.
// Живое реле проверяется вручную по tg/README.md. Запуск: node tools/tg-test.mjs (BASE — адрес игры)
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; const dirs = readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0]); for (const d of dirs) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }

const BASE = process.env.BASE || "http://127.0.0.1:8765/";
const RELAY = "https://relay.test";
const fails = [];
const ok = (c, m) => { console.log((c ? "OK  " : "FAIL") + "  " + m); if (!c) fails.push(m); };

const chromium = await loadChromium();
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: cachedChrome() }); }
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on("pageerror", e => errs.push(e.message));

// заглушка реле: /status?c=КОД → { ok, linked }, /ev → { linked }
const relay = { linked: false, status: [], ev: [] };
await page.route(RELAY + "/**", async (r) => {
  const u = new URL(r.request().url());
  const json = (o) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(o) });
  if (u.pathname === "/status") { relay.status.push(u.searchParams.get("c")); return json({ ok: true, linked: relay.linked }); }
  if (u.pathname === "/ev") { relay.ev.push(r.request().postData()); return json({ ok: true, linked: relay.linked, sent: false }); }
  return r.fulfill({ status: 404, body: "" });
});
// всё, что похоже на настоящее реле или Telegram, — обрывается и считается провалом
const leaks = [];
await page.route(/workers\.dev|api\.telegram\.org/, (r) => { leaks.push(r.request().url()); return r.abort(); });

await page.goto(BASE + "?test=1&tg=" + encodeURIComponent(RELAY));
await page.waitForFunction(() => window.__bg && window.__bg().state === "garage", null, { timeout: 30000 });
await page.waitForFunction(() => { const e = document.getElementById("tgOpen"); return e && e.style.display !== "none"; }, null, { timeout: 15000 });
await page.click("#tgOpen");
await page.waitForFunction(() => document.getElementById("bot").style.display !== "none", null, { timeout: 15000 });

const link = await page.evaluate(() => document.getElementById("tgLink").href);
console.log("ссылка:", link);
ok(/^https:\/\/t\.me\/big_drive_bot\?start=[A-Z2-9]{10}$/.test(link), "ссылка вида t.me/big_drive_bot?start=КОД");
const html = await (await fetch(BASE + "index.html")).text();
ok(/^https:\/\/[a-z0-9.-]+\.workers\.dev$/.test((html.match(/var TG_API\s*=\s*'([^']*)'/) || [])[1] || ""), "адрес реле прописан в игре");
const code = link.split("start=")[1];

await page.waitForFunction(() => document.getElementById("tgQr").width > 0, null, { timeout: 20000 }).catch(() => {});
ok(await page.evaluate(() => document.getElementById("tgQr").width > 0), "QR нарисован");
await page.waitForFunction(() => /Пока не привязано/.test(document.getElementById("tgState").textContent), null, { timeout: 5000 }).catch(() => {});
ok(/Пока не привязано/.test(await page.evaluate(() => document.getElementById("tgState").textContent)), "до привязки — «Пока не привязано»");
ok(relay.status.includes(code), "игра спросила у реле статус своего кода");

relay.linked = true;                           // родитель нажал /start в боте
await page.waitForFunction(() => /привязан ✓/.test(document.getElementById("tgState").textContent), null, { timeout: 12000 }).catch(() => {});
ok(/привязан ✓/.test(await page.evaluate(() => document.getElementById("tgState").textContent)), "игра сама увидела привязку (опрос раз в 5 с)");
ok(await page.evaluate(() => localStorage.getItem("babygame.tg.on") === "1"), "привязка запомнена в localStorage");
ok(leaks.length === 0, "ни одного запроса к настоящему реле или Telegram" + (leaks.length ? ": " + leaks.join(", ") : ""));

if (errs.length) { console.log("ошибки страницы:", errs.join(" | ")); fails.push("ошибки страницы"); }
await browser.close();
console.log(fails.length ? "\nПРОВАЛЕНО: " + fails.length : "\nвсё сошлось");
process.exit(fails.length ? 1 : 0);

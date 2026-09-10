import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const chromium = await loadChromium(); const ex = cachedChrome();
const b = await chromium.launch(ex ? { executablePath: ex } : {});
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on("pageerror", e => errs.push("pageerror: " + e.message));
p.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
const reqs = [];
p.on("requestfailed", r => reqs.push("СБОЙ ЗАПРОСА: " + r.url() + " — " + (r.failure()?.errorText || "")));
await p.goto(process.env.URL || "http://127.0.0.1:8765/index.html?test=1");
try { await p.waitForFunction(() => window.__bg ? window.__bg().state === "garage" : !!document.getElementById("parentGo"), null, { timeout: 25000 }); } catch (e) { console.log("не дождались гаража"); }
await p.waitForTimeout(1200);
await p.evaluate(() => { const e = document.getElementById("parentGo"); if (e) e.click(); });
await p.waitForTimeout(400);
// открываем окно пульта
await p.evaluate(() => { const e = document.getElementById("bPult"); if (e) e.click(); });
await p.waitForTimeout(2000);
await p.evaluate(() => { const e = document.getElementById("pultClose"); if (e) e.click(); });
await p.evaluate(() => { const e = document.getElementById("tgOpen") || document.getElementById("bInfo"); if (e) e.click(); });
await p.waitForTimeout(600);
await p.evaluate(() => { const e = document.getElementById("tgOpen"); if (e) e.click(); });
await p.waitForTimeout(2500);
const info = await p.evaluate(() => {
  const out = {};
  out.qrcodeLib = typeof window.qrcode;
  for (const id of ["pult", "bot"]) {
    const box = document.getElementById(id);
    const cv = box && box.querySelector("canvas");
    let ink = null;
    if (cv && cv.width) {
      const x = cv.getContext("2d");
      const d = x.getImageData(0, 0, cv.width, cv.height).data;
      let dark = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 128) dark++;
      ink = { w: cv.width, h: cv.height, dark, display: getComputedStyle(cv).display, boxShown: getComputedStyle(box).display };
    } else if (cv) ink = { w: cv.width, h: cv.height, display: getComputedStyle(cv).display, boxShown: getComputedStyle(box).display };
    out[id] = ink || "нет canvas";
  }
  return out;
});
console.log(JSON.stringify(info, null, 1));
if (errs.length) console.log("ОШИБКИ:", errs.slice(0, 6).join(" | "));
if (reqs.length) console.log(reqs.slice(0, 6).join("\n"));
await b.close();

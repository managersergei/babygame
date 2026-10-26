// 3D-дорога режима РУЛЬ (33b-lane3d.js, флаг ?3d=1): с программным WebGL (SwiftShader) 3D включается
// и 15 секунд езды проходят без ошибок страницы; без WebGL (--disable-3d-apis) игра остаётся 2D
// и тоже без ошибок. Запуск: python3 -m http.server 8765 &  →  node tools/lane3d-test.mjs
import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }

const B = process.env.BASE || "http://127.0.0.1:8765/";
let fail = 0;
const ck = (n, ok, d) => { console.log(`  ${ok ? "ok " : "FAIL"} ${n}${d !== undefined ? ": " + d : ""}`); if (!ok) fail++; };
const chromium = await loadChromium(); const ex = cachedChrome();

async function drive(args, title) {
  console.log(title);
  let browser; try { browser = await chromium.launch({ args }); } catch { browser = await chromium.launch({ args, executablePath: ex }); }
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(B);
  await p.evaluate(() => { localStorage.setItem("babygame.parent", "1"); });
  await p.goto(B + "?s=lane&test=1&3d=1&admin=1");
  await p.waitForFunction(() => window.__bg && window.__bg().state === "lane", null, { timeout: 20000 });
  // окно телефона-руля перехватывает пробел — закрываем, как в lane-test
  await p.evaluate(() => { const b = document.getElementById("pult"); if (b && b.style.display !== "none") document.getElementById("pultClose").click(); });
  const gl = await p.evaluate(() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } });
  // ждём, пока 3D догрузит three.js и построит сцену (или честно откажется)
  await p.waitForFunction(() => { const s = window.__lane().l3d.stats().st; return s === 2 || s === -1 || (s === 0 && window.__bg().T > 2); }, null, { timeout: 30000 }).catch(() => {});
  // 15 секунд езды: руль влево-вправо, газ и прыжки
  const t0 = Date.now(); let i = 0;
  while (Date.now() - t0 < 15000) {
    const k = i % 3 === 0 ? "ArrowLeft" : i % 3 === 1 ? "ArrowRight" : "ArrowUp";
    await p.keyboard.down(k); await p.waitForTimeout(700); await p.keyboard.up(k);
    if (i % 2) await p.keyboard.press("Space");
    i++;
  }
  const r = await p.evaluate(() => ({
    on: window.__lane().l3d.on(), stats: window.__lane().l3d.stats(), state: window.__bg().state,
    z: window.__bg().lane, admin3d: (document.getElementById("admin3d") || {}).textContent || "",
    ver: (document.getElementById("adminVer") || {}).textContent || "" }));
  await browser.close();
  return { gl, errs, ...r };
}

const a = await drive(["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"], "WebGL через SwiftShader, ?3d=1");
ck("WebGL доступен", a.gl);
ck("3D-путь включился (Lane3D.on, st=2)", a.on && a.stats.st === 2, JSON.stringify(a.stats));
ck("сцена рисуется (вызовы отрисовки > 0)", a.stats.calls > 0, `${a.stats.calls} вызовов, ${a.stats.tris} треугольников`);
ck("админка показывает 3D-строку", /3D: вызовов отрисовки \d+/.test(a.admin3d), a.admin3d);
ck("админка показывает версию сборки", /^сборка (src-[0-9a-f]{10}|без сборщика)$/.test(a.ver), a.ver);
ck("15 с езды — без ошибок страницы", a.errs.length === 0, a.errs.slice(0, 3).join(" | "));

const b = await drive(["--disable-3d-apis"], "без WebGL (--disable-3d-apis), ?3d=1");
ck("WebGL недоступен", !b.gl);
ck("остались в 2D (Lane3D.on = false)", !b.on && b.stats.st !== 2, JSON.stringify(b.stats));
ck("игра идёт в режиме РУЛЬ", b.state === "lane" || b.state === "lesson", b.state);
ck("15 с езды — без ошибок страницы", b.errs.length === 0, b.errs.slice(0, 3).join(" | "));

console.log(fail ? `\nПРОВАЛОВ: ${fail}` : "\nВСЁ ОК");
process.exit(fail ? 1 : 0);

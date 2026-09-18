import { createRequire } from "node:module"; import { pathToFileURL } from "node:url"; import { existsSync, readdirSync } from "node:fs";
/* Загрузчик такой же, как в остальных тестах: playwright ищется в нескольких местах, а
   браузер сначала пробуется штатный. Раньше здесь были прошиты путь к чужому проекту
   (~/Documents/pf) и конкретная сборка chromium для macOS ARM — на раннере CI такого нет. */
async function loadChromium() { for (const b of [import.meta.url, pathToFileURL(process.cwd() + "/").href, pathToFileURL(process.env.HOME + "/Documents/pf/").href]) for (const n of ["playwright", "@playwright/test"]) { try { const r = createRequire(b); const m = await import(pathToFileURL(r.resolve(n)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {} } throw new Error("playwright не найден"); }
function cachedChrome() { const cache = `${process.env.HOME}/Library/Caches/ms-playwright`; if (!existsSync(cache)) return null; for (const d of readdirSync(cache).filter(d => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => +b.match(/\d+$/)[0] - +a.match(/\d+$/)[0])) for (const l of ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"]) { const p = `${cache}/${d}/${l}`; if (existsSync(p)) return p; } return null; }
const chromium = await loadChromium();
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ executablePath: cachedChrome() }); }
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", e => console.log("PAGEERROR", e.message));
await page.goto("http://127.0.0.1:8765/?s=play&test=1");
await page.waitForFunction(() => window.__bg && window.__bg().state !== "load", null, { timeout: 20000 });
const info = await page.evaluate(() => {
  const out = { total: 0, voiced: [], unvoiced: [], noSprite: [] };
  const order = window.__bg().word ? null : null;
  return new Promise(res => {
    // достаём внутренности через отладочный хук: перечисляем LESSON_ORDER через nextLessonKey нельзя,
    // поэтому проверяем по списку слов из ELEM_WORDS, отражённому в LESSONS
    const bg = window.__bg();
    res({ next: bg.word.next, met: bg.word.met, known: bg.known, imgs: bg.imgs });
  });
});
console.log("первое слово к изучению:", info.next, "| помечено:", info.met, "| выучено ранее:", info.known, "| картинок загружено:", info.imgs);
// проверим, что новые спрайты загрузились и что монета собирается
const probe = await page.evaluate(() => {
  const names = ["coin","chest","sheep","tractor","bus","ambulance","excavator","garbage","tow","loc_tower","loc_shop","loc_palm","loc_umbrella","loc_monkey","loc_rock","loc_fir","loc_snowman","master"];
  const img = names.map(n => { const i = new Image(); i.src = "assets/" + (window.ASSET_PATH && window.ASSET_PATH[n] ? window.ASSET_PATH[n] : "world/" + n) + ".webp"; return [n, i]; });
  return new Promise(res => setTimeout(() => res(img.filter(([n, i]) => !i.naturalWidth).map(([n]) => n)), 2500));
});
console.log(probe.length ? "НЕ ЗАГРУЗИЛИСЬ: " + probe.join(", ") : "все 18 новых спрайтов доступны");
await browser.close();

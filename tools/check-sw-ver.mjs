/* Страж кеша: если поменялись index.html или vendor/, а строка VER в sw.js — нет, service worker
   продолжит отдавать телефонам СТАРУЮ игру из кеша, и правка «не доедет», хотя на сайте она есть.
   Сравнение — с базой: SWVER_BASE (в CI — коммит до пуша или база PR), иначе HEAD~1.
   Рабочее дерево учитывается: локально ловит и незакоммиченную правку.
   Запуск: node tools/check-sw-ver.mjs */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const verOf = (src) => (src.match(/^var VER\s*=\s*'([^']*)'/m) || [])[1] || null;

let base = (process.env.SWVER_BASE || "").trim();
if (!base || /^0+$/.test(base)) base = "HEAD~1";
try { git("rev-parse", "--verify", "--quiet", base + "^{commit}"); }
catch {
  console.log(`check-sw-ver: базовый коммит ${base} недоступен (первый коммит или неглубокий клон) — проверку пропускаю`);
  process.exit(0);
}

const changed = git("diff", "--name-only", base, "--", "index.html", "vendor/").split("\n").filter(Boolean);
const verNow = verOf(readFileSync(ROOT + "sw.js", "utf8"));
let verWas = null;
try { verWas = verOf(git("show", base + ":sw.js")); } catch {}

if (!verNow) { console.error("check-sw-ver: в sw.js не найдена строка var VER = '…'"); process.exit(1); }
if (!changed.length) { console.log(`check-sw-ver: index.html и vendor/ не менялись относительно ${base} — VER ${verNow} можно не трогать`); process.exit(0); }
if (verNow === verWas) {
  console.error(
    `ОШИБКА: изменились ${changed.join(", ")}, а версия кеша в sw.js осталась прежней (${verNow}).\n` +
    `Телефоны с установленной игрой будут получать старую версию из кеша service worker.\n` +
    `Поменяй строку var VER в sw.js (например, на bg-ГГГГ-ММ-ДД<буква>) и закоммить вместе с правкой.`);
  process.exit(1);
}
console.log(`check-sw-ver: index.html/vendor изменились, VER ${verWas || "—"} → ${verNow} — ок`);

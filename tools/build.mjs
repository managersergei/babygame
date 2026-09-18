/* Сборка игры: src/index.template.html + src/js/*.js (в порядке из src/build.json) → index.html.
   Собранный index.html КОММИТИТСЯ: GitHub Pages раздаёт репозиторий как есть, и порядок
   публикации от этого не меняется.
   --check — ничего не пишет, только сверяет, что index.html совпадает со сборкой (для CI). */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const cfg = JSON.parse(readFileSync(ROOT + "src/build.json", "utf8"));
const MARK = "<!--BUILD:JS-->";

const tpl = readFileSync(ROOT + cfg.template, "utf8");
if (!tpl.includes(MARK)) { console.error("в шаблоне нет метки " + MARK); process.exit(1); }

const body = cfg.js
  .map((f) => readFileSync(ROOT + "src/js/" + f, "utf8").replace(/\n$/, ""))
  .join("\n");

const out = tpl.replace(MARK, () => body);

if (process.argv.includes("--check")) {
  const cur = readFileSync(ROOT + cfg.out, "utf8");
  if (cur === out) { console.log("index.html совпадает со сборкой"); process.exit(0); }
  console.error("index.html РАСХОДИТСЯ со сборкой из src/ — запусти npm run build и закоммить результат");
  process.exit(1);
}

writeFileSync(ROOT + cfg.out, out);
console.log(`собрано: ${cfg.js.length} модулей → ${cfg.out} (${(out.length / 1024).toFixed(0)} КБ)`);

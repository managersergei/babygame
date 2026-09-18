// Прогон всего набора проверок. Запуск: npm test (локальный сервер поднимается сам).
// Возвращает ненулевой код, если хоть один тест упал, — чтобы CI это заметил.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";

const PORT = 8765;
/* Четыре теста моделируют минуты реальной игры (balance — 240 с, rhythm — 300 с,
   robot — 380 с, words-once — 180 с). Гонять их на каждый пуш — впустую жечь минуты
   GitHub Actions, поэтому на пуше идёт быстрый набор, а полный — по ночам и по кнопке. */
const SLOW = ["balance-test.mjs", "rhythm-test.mjs", "robot-test.mjs", "words-once-test.mjs"];
const args = process.argv.slice(2);
const quick = args.includes("--quick");
const only = args.filter((a) => a !== "--quick");

function run(cmd, args, opts = {}) {
  return new Promise((res) => {
    const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    const kill = setTimeout(() => p.kill("SIGKILL"), opts.timeout ?? 900000);
    p.on("close", (code) => { clearTimeout(kill); res({ code, out }); });
    p.on("error", (e) => { clearTimeout(kill); res({ code: -1, out: String(e) }); });
  });
}

async function serverUp() {
  try { const r = await fetch(`http://localhost:${PORT}/index.html`); return r.ok; } catch { return false; }
}

let server = null;
if (!(await serverUp())) {
  server = spawn("python3", ["-m", "http.server", String(PORT)], { stdio: "ignore", detached: true });
  for (let i = 0; i < 40 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 250));
  if (!(await serverUp())) { console.error("не удалось поднять сервер на " + PORT); process.exit(1); }
}

const all = readdirSync("tools").filter((f) => /-test\.mjs$/.test(f) || f === "smoke.mjs").sort();
let list = only.length ? all.filter((f) => only.some((o) => f.includes(o))) : all;
if (quick) list = list.filter((f) => !SLOW.includes(f));
console.log(`проверок к прогону: ${list.length}${quick ? " (быстрый набор, долгие пропущены)" : ""}`);

const bad = [];
for (const f of list) {
  const t0 = Date.now();
  const { code, out } = await run("node", [`tools/${f}`]);
  const sec = ((Date.now() - t0) / 1000).toFixed(0);
  if (code === 0) console.log(`PASS  ${f}  (${sec} с)`);
  else {
    bad.push(f);
    console.log(`FAIL  ${f}  (код ${code}, ${sec} с)`);
    console.log(out.trim().split("\n").slice(-14).map((l) => "        " + l).join("\n"));
  }
}

if (server) { try { process.kill(-server.pid); } catch {} }
console.log(`\nитог: ${list.length - bad.length}/${list.length} прошло` + (bad.length ? `, упало: ${bad.join(", ")}` : ""));
process.exit(bad.length ? 1 : 0);

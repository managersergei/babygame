// Сборка роликов: node reels/build.mjs [01 02 …] [--fps 30] [--quick]
// Для каждой сцены: record.mjs --vt (кадры + события) → mix.py (голос) → encode.sh (mp4 + постер).
import { readdirSync, readFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join, basename } from "node:path";
const here = resolve(new URL(".", import.meta.url).pathname);
const args = process.argv.slice(2);
const fps = +(args[args.indexOf("--fps") + 1] || 30) || 30;
const quick = args.includes("--quick");
const only = args.filter((a, i) => /^\d\d$/.test(a) && args[i - 1] !== "--fps");   // «30» после --fps — не номер сцены
const REC = process.env.HOME + "/.claude/skills/code-motion/scripts/record.mjs";
const ENC = process.env.HOME + "/.claude/skills/code-motion/scripts/encode.sh";
mkdirSync(join(here, "out"), { recursive: true }); mkdirSync(join(here, "frames"), { recursive: true });
const scenes = readdirSync(join(here, "scenes")).filter((f) => f.endsWith(".html") && (!only.length || only.includes(f.slice(0, 2)))).sort();
const t0 = Date.now();
for (const f of scenes) {
  const slug = basename(f, ".html"), src = readFileSync(join(here, "scenes", f), "utf8");
  const dur = +(src.match(/\bdur\(([\d.]+)\)/) || [])[1] || 10;
  const sec = quick ? Math.min(dur, 3) : dur, useFps = quick ? 10 : fps;
  const video = join(here, "out", slug + ".video.mp4"), events = join(here, "out", slug + ".events.json"), wav = join(here, "out", slug + ".wav"), mp4 = join(here, "out", slug + ".mp4");
  console.log(`\n=== ${slug}: ${sec}s @ ${useFps}fps`);
  // кадры не пишем на диск — сразу в ffmpeg (--pipe)
  execFileSync("node", [REC, join(here, "scenes", f), "--pipe", video, "--vt", "--w", "1080", "--h", "1920", "--fps", String(useFps), "--sec", String(sec), "--wait", "500", "--events", events], { stdio: "inherit", cwd: process.env.HOME + "/Documents/pf" });
  execFileSync("python3", [join(here, "mix.py"), events, wav, String(sec)], { stdio: "inherit" });
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", video, "-i", wav, "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-shortest", "-movflags", "+faststart", mp4], { stdio: "inherit" });
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", mp4, "-frames:v", "1", "-q:v", "3", join(here, "out", slug + ".jpg")], { stdio: "inherit" });
  for (const p of [video, wav]) if (existsSync(p)) unlinkSync(p);
  console.log("→ " + mp4);
}
console.log(`\nготово: ${scenes.length} роликов за ${((Date.now() - t0) / 1000).toFixed(0)} с → ${join(here, "out")}`);

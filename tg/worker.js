// tg/worker.js — реле «игра → Telegram» для babygame. Cloudflare Worker, бесплатный план.
// Секреты (npx wrangler secret put): BOT_TOKEN — от BotFather; WEBHOOK_SECRET — любая строка 16+ знаков.
// Переменные ([vars] в wrangler.toml или .dev.vars): ALLOWED_ORIGINS — откуда игра шлёт события (через запятую);
//   DRY=1 — не слать в Telegram, а возвращать текст в ответе (для проверок).
// KV LINKS: code:<КОД> → {chat, ts};  chat:<chat_id> → ["КОД", …] (до MAX_CODES устройств на один чат).
// Маршруты: POST /tg — вебхук бота (/start КОД, /stop); POST /ev — события игры; GET /status?c=КОД;
//           GET /setup?key=WEBHOOK_SECRET — один раз после деплоя: регистрирует вебхук и команды бота.
var CODE_RE = /^[A-Z2-9]{8,10}$/;
var TTL = 400 * 86400;            // привязка живёт 400 дней с последнего события
var MAX_CODES = 5;

export default {
  async fetch(req, env) {
    var url = new URL(req.url), p = url.pathname, origin = req.headers.get('Origin') || '';
    var allowed = (env.ALLOWED_ORIGINS || 'https://managersergei.github.io').split(',');
    var cors = { 'Access-Control-Allow-Origin': allowed.indexOf(origin) >= 0 ? origin : allowed[0], 'Vary': 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (p === '/tg' && req.method === 'POST') return await onWebhook(req, env);
      if (p === '/ev' || p === '/status') {
        if (origin && allowed.indexOf(origin) < 0) return json({ ok: false, err: 'origin' }, cors, 403);   // простой POST выполняется и без CORS — режем сами
        if (p === '/ev' && req.method === 'POST') return json(await onEvent(req, env), cors);
        if (p === '/status' && req.method === 'GET') return json(await onStatus(url, env), cors);
      }
      if (p === '/setup' && req.method === 'GET') return await onSetup(url, env);
      return new Response('babygame-tg ok', { status: 200 });
    } catch (e) {
      return json({ ok: false, err: String(e && e.message || e) }, cors, 500);
    }
  }
};

function json(o, headers, status) {
  var h = Object.assign({ 'content-type': 'application/json; charset=utf-8' }, headers || {});
  return new Response(JSON.stringify(o), { status: status || 200, headers: h });
}

/* ── Telegram Bot API ── */
async function tg(env, method, body) {
  if (env.DRY) return { ok: true, dry: true, result: body };
  var r = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/' + method, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  return r.json().catch(function () { return { ok: false }; });
}
function send(env, chat, text) { return tg(env, 'sendMessage', { chat_id: chat, text: text }); }

/* ── вебхук: /start КОД привязывает, /stop отвязывает ── */
async function onWebhook(req, env) {
  if (!env.WEBHOOK_SECRET || req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
  var upd = await req.json().catch(function () { return null; });
  var msg = upd && upd.message;
  if (!msg || !msg.chat || typeof msg.text !== 'string') return new Response('ok');
  var chat = String(msg.chat.id), text = msg.text.trim();
  var m = /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?$/.exec(text);
  if (m) {
    var code = (m[1] || '').toUpperCase();
    if (!CODE_RE.test(code)) {
      await send(env, chat, 'Привет! Это бот игры «Машинки». Чтобы получать отчёты, откройте в игре ⓘ «Для родителей» и отсканируйте QR-код (или нажмите ссылку под ним).');
      return new Response('ok');
    }
    var list = (await env.LINKS.get('chat:' + chat, 'json')) || [];
    if (list.indexOf(code) < 0) list.push(code);
    while (list.length > MAX_CODES) { var drop = list.shift(); await env.LINKS.delete('code:' + drop); }
    await env.LINKS.put('code:' + code, JSON.stringify({ chat: chat, ts: Date.now() }), { expirationTtl: TTL });
    await env.LINKS.put('chat:' + chat, JSON.stringify(list), { expirationTtl: TTL });
    await send(env, chat, 'Готово ✅ Буду присылать, какие слова ребёнок проговорил и сколько звёзд собрал: не чаще раза в несколько минут и сводку в конце игры.\nОтключить — /stop');
    return new Response('ok');
  }
  if (/^\/stop/.test(text)) {
    var old = (await env.LINKS.get('chat:' + chat, 'json')) || [];
    for (var i = 0; i < old.length; i++) await env.LINKS.delete('code:' + old[i]);
    await env.LINKS.delete('chat:' + chat);
    await send(env, chat, 'Отчёты выключены. Включить снова — отсканируйте QR в игре.');
    return new Response('ok');
  }
  await send(env, chat, 'Команды: /start КОД — привязать игру, /stop — отключить отчёты.');
  return new Response('ok');
}

/* ── привязан ли код (игра спрашивает с экрана «Родителям») ── */
async function onStatus(url, env) {
  var code = String(url.searchParams.get('c') || '').toUpperCase();
  if (!CODE_RE.test(code)) return { ok: false, err: 'code' };
  var rec = await env.LINKS.get('code:' + code, 'json');
  return { ok: true, linked: !!rec };
}

/* ── событие игры → сообщение родителю ── */
async function onEvent(req, env) {
  var d; try { d = JSON.parse(await req.text()); } catch (e) { return { ok: false, err: 'json' }; }
  var code = String(d && d.c || '').toUpperCase();
  if (!CODE_RE.test(code)) return { ok: false, err: 'code' };
  var ip = req.headers.get('CF-Connecting-IP') || '0';
  if (!(await allow(env, env.RL_IP, 'ip:' + ip, 20))) return { ok: false, err: 'rate' };
  var rec = await env.LINKS.get('code:' + code, 'json');
  if (!rec) return { ok: true, linked: false };                         // игра запомнит и перестанет слать до новой проверки
  if (!(await allow(env, env.RL_CODE, 'code:' + code, 2))) return { ok: true, linked: true, sent: false, err: 'rate' };
  var text = fmt(d);
  if (!text) return { ok: true, linked: true, sent: false };
  var r = await send(env, rec.chat, text);
  if (r && r.error_code === 403) {                                       // родитель заблокировал бота — отвязываем
    await env.LINKS.delete('code:' + code);
    return { ok: true, linked: false };
  }
  if (r && r.ok && Date.now() - (rec.ts || 0) > 30 * 86400000)          // раз в месяц продлеваем срок жизни привязки (экономим записи KV)
    await env.LINKS.put('code:' + code, JSON.stringify({ chat: rec.chat, ts: Date.now() }), { expirationTtl: TTL });
  return { ok: true, linked: true, sent: !!(r && r.ok), text: env.DRY ? text : undefined };
}

/* ── лимит частоты: биндинг Rate Limiting; без него — счётчик в KV (1 запись на запрос, на бесплатном плане 1000 записей/сутки) ── */
async function allow(env, rl, key, limit) {
  if (rl) return (await rl.limit({ key: key })).success;
  var k = 'rl:' + key, n = +(await env.LINKS.get(k)) || 0;
  if (n >= limit) return false;
  await env.LINKS.put(k, String(n + 1), { expirationTtl: 60 });
  return true;
}

/* ── текст сообщения ── */
function plural(n, one, few, many) {
  var m10 = n % 10, m100 = n % 100;
  return n + ' ' + (m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many);
}
function fmt(d) {
  var s = d.sum || {}, need = +d.need || 5, L = [], words = s.words || {}, learned = s.learned || [];
  if (d.fin) L.push('🏁 Итог' + (d.dur > 0 ? ' за ' + plural(d.dur, 'минуту', 'минуты', 'минут') : '') + (s.car ? ' · 🚗 ' + s.car : ''));
  learned.forEach(function (w) { L.push('🎉 Выучил слово «' + w + '»!'); });
  Object.keys(words).forEach(function (w) {
    if (learned.indexOf(w) >= 0) return;
    L.push('🗣 Сказал «' + w + '» — ' + (words[w] >= need ? 'уже выучено' : words[w] + ' из ' + need));
  });
  if (s.stars) L.push('⭐ ' + plural(s.stars, 'звезда', 'звезды', 'звёзд'));
  if (s.levels) L.push('🏆 ' + plural(s.levels, 'уровень пройден', 'уровня пройдено', 'уровней пройдено'));
  if (s.over) L.push('💥 ' + plural(s.over, 'раз', 'раза', 'раз') + ' не доехал (бензин или робот)');
  if (!L.length || (d.fin && L.length === 1)) return '';                  // пустая сводка не нужна
  return L.join('\n').slice(0, 4000);
}

/* ── разовая настройка после деплоя: GET /setup?key=WEBHOOK_SECRET ── */
async function onSetup(url, env) {
  if (!env.WEBHOOK_SECRET || url.searchParams.get('key') !== env.WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
  var a = await tg(env, 'setWebhook', { url: url.origin + '/tg', secret_token: env.WEBHOOK_SECRET, allowed_updates: ['message'], drop_pending_updates: true });
  var b = await tg(env, 'setMyCommands', { commands: [{ command: 'start', description: 'Привязать игру' }, { command: 'stop', description: 'Отключить отчёты' }] });
  return json({ webhook: a, commands: b });
}

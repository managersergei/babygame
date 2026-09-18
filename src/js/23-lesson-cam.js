/* ═══════════════ 17bb2. КАМЕРА УРОКА ═══════════════
   Кадр не замирает: камера наезжает на предмет разговора и медленно плывёт. */
var cam = { z: 1, tz: 1, fx: 0, fy: 0, t: 0 };

function camTo(fx, fy, z) { cam.fx = fx; cam.fy = fy; cam.tz = z || 1.75; cam.z = 1.02; cam.t = 0; }
function camStep(dt) { cam.t += dt; cam.z += (cam.tz - cam.z) * Math.min(1, dt * 1.1); }   // ~1,5 с: рывок камеры для 2–4 лет резок

function withCam(fn) {
  var dx = Math.sin(cam.t * 0.55) * 16 * S, dy = Math.cos(cam.t * 0.42) * 9 * S;
  var z = Math.max(1.001, cam.z);
  var fx = clamp(cam.fx, W * 0.3, W * 0.7);                 // предмет всегда ближе к центру
  var fy = clamp(cam.fy, H * 0.44 / z, H - (H - H * 0.44) / z);
  g.save();
  g.translate(W / 2 + dx, H * 0.44 + dy);
  g.scale(z, z);
  g.translate(-fx, -fy);
  fn();
  g.restore();
}

/* Тёмная виньетка со светлым пятном ровно там, куда смотрит камера. */
function spotlight(alpha) {
  var r = Math.max(W, H) * 0.62;
  var grd = g.createRadialGradient(W / 2, H * 0.47, r * 0.18, W / 2, H * 0.47, r);
  grd.addColorStop(0, 'rgba(10,18,40,0)');
  grd.addColorStop(0.55, 'rgba(10,18,40,' + (alpha * 0.55).toFixed(2) + ')');
  grd.addColorStop(1, 'rgba(8,14,32,' + (alpha * 0.92).toFixed(2) + ')');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
}

function findObj(t) {
  for (var i = 0; i < objs.length; i++) if (objs[i].t === t) return objs[i];
  return null;
}
function scr(o) { return (o.x - carX) + CARX; }

/* Куда смотреть на каждом уроке. */
function lessonFocus(key) {
  var o;
  if (les.from === 'lane') {                                     // в «руле» координаты свои
    if (les.obj) {
      var lo = les.obj, lp = laneProj(lo.z);
      return [W / 2 + lo.lane * lp.half * LN.laneK, lp.y - laneH(lo, lp.k) * 0.55];
    }
    var nr = laneProj(0);
    return [W / 2 + ln.x * nr.half * LN.laneK, H * LN.carY - 90 * S];   // урок про клавишу — смотрим на машинку
  }
  if (les.obj) {
    var ob = les.obj, oy;
    if (ob.t === 'rail' && ob.train) {                           // на уроке «поезд» смотрим на состав
      var GG = railGeom(scr(ob)), P = railAt(GG, ob.p);
      return [P[0], P[1] - 46 * S];
    }
    if (ob.t === 'bird' || ob.t === 'plane') oy = ob.y;          // летят по небу
    else if (ob.t === 'plat' || ob.t === 'ramp') oy = GY - ob.h;
    else if (ob.t === 'balloon') oy = GY - ob.y;
    else if (ob.t === 'star') oy = GY - ob.y;
    else if (ob.t === 'fuel') oy = GY - ob.y - 20 * S;
    else oy = GY - 50 * S;
    return [scr(ob), oy];
  }
  if (key === 'jump')  { o = findObj('pit');    return [o ? scr(o) : CARX + 300 * S, GY - 20 * S]; }
  if (key === 'stop')  { o = findObj('tlight'); return [o ? scr(o) : CARX + 300 * S, GY - 150 * S]; }
  if (key === 'beep')  { o = findObj('sheep');  return [o ? scr(o) : CARX + 300 * S, GY - 60 * S]; }
  if (key === 'el_jump0' || key === 'el_gas0') return [CARX, GY - 90 * S];
  if (key === 'gas')   return [CARX - 220 * S, GY - 100 * S];
  if (key === 'fuel')  return [CARX + 40 * S, GY - 110 * S];
  if (key === 'light') return [CARX + 60 * S, GY - 110 * S];
  if (key === 'one' || key === 'two' || key === 'three') return [W * 0.70, GY - 70 * S];
  if (key === 'black' || key === 'red' || key === 'blue') return [W * 0.5, GY - 110 * S];
  if (key === 'water') return [W * 0.42, GY - 100 * S];
  return [CARX, GY - 90 * S];
}


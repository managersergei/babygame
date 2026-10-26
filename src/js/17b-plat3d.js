/* ═══════════════ 14-3D. ПЛАТФОРМЕР В НАСТОЯЩЕМ 3D (2.5D) ═══════════════
   Меняется ТОЛЬКО картинка: мир, физика, касания и спавн живут в 08/10/13/16 и не трогаются.
   Здесь мы читаем carX/carY/objs/… и ставим по ним объёмную сцену: мир 3D, игра — в плоскости.

   Как включается: ?3d=1 в адресе или галка P3.on в админке. Рендерер и WebGL-холст общие
   с «рулём» (32b-r3d.js) — один контекст на всю игру. Пока three.js грузится, если WebGL нет
   или контекст потерян — молча рисуется прежний 2D.

   Система координат: 1 единица = 100 игровых пикселей при S = 1 (u = 1/(100·S)). Машинка —
   всегда в x = 0 (всё считается относительно carX, float не уплывает на длинном заезде), y — вверх,
   z — к зрителю. Плоскость игры — z = 0: там стоят машинка и всё, чего она касается, и там масштаб
   камеры ровно 100·S px на единицу — объект стоит там же, где его считает игра.
   Глубина декораций берётся из 2D-вёрстки: y экрана ниже/выше GY → z ближе/дальше (Zd()).     */
var P3 = {
  on: 0,                                    // 1 — платформер в 3D (включает ?3d=1 или админка)
  fov: 32,                                  // вертикальный угол обзора, градусы (дальняя штанга)
  pitch: 0.21,                              // наклон камеры вниз, рад: видно полотно дороги, срез земли — тонкая полоса
  camK: 6,                                  // скорость догоняния камеры по вертикали: 1−exp(−k·dt)
  camY: 0.7,                                // доля высоты платформы, на которую поднимается камера
  hemi: 1.7, sun: 2.3,                      // свет: небо/земля и солнце сбоку-сверху
  dpr: 1.5                                  // потолок плотности пикселей
};
CFG.reg('P3', P3, {
  on:    [0,    1,    1,    '3D-платформер: 1 — включён'],
  fov:   [20,   50,   1,    'камера: угол обзора'],
  pitch: [0,    0.4,  0.01, 'камера: наклон вниз'],
  camK:  [1,    15,   0.5,  'камера: скорость догоняния'],
  camY:  [0,    1,    0.05, 'камера: подъём за платформой'],
  hemi:  [0.5,  3,    0.05, 'свет неба'],
  sun:   [0.5,  4,    0.05, 'свет солнца'],
  dpr:   [0.75, 2,    0.05, 'потолок плотности пикселей 3D']
});
try { if (/[?&]3d=1/.test(location.search)) P3.on = 1; } catch (e) {}

var Plat3D = (function () {
  var st = 0;                               // 0 — не строили, 2 — сцена готова, −1 — отказ (навсегда 2D)
  var TT = null, R = null, scene, cam, hemi, sun, spot, fog;
  var M = {}, mats = {}, tex = new Map(), ctex = {}, thRef = null, nightRef = -1;
  var pool = [], glows = [], misc = [], bbN = 0, glN = 0, miN = 0;
  var camYs = 0, lastNow = 0, ms = 0, dyPx = 0, wasGround = true, frameId = 0;
  var _m, _q, _e, _p, _s, _c, _c2, _v;
  var tint = 1, tintB = 1;                  // ночное затемнение спрайтов (они не освещаются)
  var u = 0.01;                             // единиц на игровой пиксель в этом кадре

  /* ── сборка: детали склеиваются в одну сетку с цветами вершин, один меш = один вызов ── */
  function part(geo, col, pos, rot, scl, fn) {
    var g2 = geo.index ? geo.toNonIndexed() : geo.clone();
    _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0); _q.setFromEuler(_e);
    _m.compose(_p.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0), _q,
               _s.set(scl ? scl[0] : 1, scl ? scl[1] : 1, scl ? scl[2] : 1));
    g2.applyMatrix4(_m);
    return { g: g2, c: col, fn: fn };
  }
  function merge(parts) {
    var n = 0, i, k;
    for (i = 0; i < parts.length; i++) n += parts[i].g.attributes.position.count;
    var pos = new Float32Array(n * 3), col = new Float32Array(n * 3), o = 0;
    for (i = 0; i < parts.length; i++) {
      var a = parts[i].g.attributes.position.array, cnt = a.length / 3;
      pos.set(a, o * 3);
      for (k = 0; k < cnt; k += 3) {
        var hex = parts[i].c, j = k * 3;
        if (parts[i].fn) hex = parts[i].fn((a[j] + a[j + 3] + a[j + 6]) / 3, (a[j + 1] + a[j + 4] + a[j + 7]) / 3, (a[j + 2] + a[j + 5] + a[j + 8]) / 3);
        _c.set(hex);
        for (var v = 0; v < 3; v++) { var q = (o + k + v) * 3; col[q] = _c.r; col[q + 1] = _c.g; col[q + 2] = _c.b; }
      }
      o += cnt;
    }
    var geo = new TT.BufferGeometry();
    geo.setAttribute('position', new TT.BufferAttribute(pos, 3));
    geo.setAttribute('color', new TT.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    return geo;
  }
  function box(w, h, d) { return new TT.BoxGeometry(w, h, d); }
  function ico(r, det) { return new TT.IcosahedronGeometry(r, det || 0); }
  function cyl(r1, r2, h, n) { return new TT.CylinderGeometry(r1, r2, h, n || 8); }
  function cone(r, h, n) { return new TT.ConeGeometry(r, h, n || 8); }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function inst(n, geo, mat, shadow) {
    var im = new TT.InstancedMesh(geo, mat, n);
    im.frustumCulled = false; im.count = 0;
    _c.setRGB(1, 1, 1); for (var i = 0; i < n; i++) im.setColorAt(i, _c);
    if (shadow) im.receiveShadow = true;
    scene.add(im); return im;
  }
  function put(im, i, x, y, z, sx, sy, sz, rz, ry) {
    _e.set(0, ry || 0, rz || 0); _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    im.setMatrixAt(i, _m);
  }
  function done(im, n) { im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }

  /* ── нарисованные кодом картинки: свет, глаза в яме, светофор ── */
  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new TT.CanvasTexture(c); t.colorSpace = TT.SRGBColorSpace; return t;
  }
  function glowTex(c, w, h) {
    var gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,236,150,1)'); gr.addColorStop(0.45, 'rgba(255,217,61,.4)'); gr.addColorStop(1, 'rgba(255,217,61,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }
  function eyesTex(angry) {
    return function (c) {
      c.fillStyle = angry ? '#ff5a5a' : '#ffe14d';
      c.beginPath(); c.arc(40, 34, 18, 0, TAU); c.fill(); c.beginPath(); c.arc(88, 34, 18, 0, TAU); c.fill();
      c.fillStyle = '#1b1d24';
      c.beginPath(); c.arc(44, 36, 9, 0, TAU); c.fill(); c.beginPath(); c.arc(92, 36, 9, 0, TAU); c.fill();
      if (angry) {
        c.fillStyle = '#2a1418'; c.beginPath(); c.ellipse(64, 84, 52, 22, 0, 0, TAU); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath();
        for (var t = 0; t < 5; t++) { c.moveTo(22 + t * 21, 70); c.lineTo(32 + t * 21, 88); }
        c.stroke();
      }
    };
  }
  function tlightTex(red) {
    return function (c) {
      c.fillStyle = '#48505f'; c.fillRect(26, 92, 12, 176);
      c.fillStyle = '#2d3340'; c.beginPath(); c.roundRect(4, 0, 56, 100, 13); c.fill();
      c.fillStyle = red ? '#ff3b30' : '#5a2b2b'; c.beginPath(); c.arc(32, 27, 17, 0, TAU); c.fill();
      c.fillStyle = red ? '#24422c' : '#34c759'; c.beginPath(); c.arc(32, 73, 17, 0, TAU); c.fill();
    };
  }
  /* ореол солнца: мягкий градиент, гаснущий к краю (плоский диск на небе читается пятном) */
  function haloTex(c, w) {
    var gr = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,248,200,.9)'); gr.addColorStop(0.3, 'rgba(255,240,170,.45)');
    gr.addColorStop(0.65, 'rgba(255,236,160,.14)'); gr.addColorStop(1, 'rgba(255,236,160,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, w);
  }
  /* яма сверху: верх текстуры — дальний край. Камера смотрит в яму сбоку, поэтому видна дальняя
     стенка (полоса сверху) и одна боковая — та, что обращена к камере (справа; для ямы левее
     камеры экземпляр зеркалится). Ближняя кромка закрыта травой. В середине — темнота. */
  function pitTex(c, w, h) {
    c.fillStyle = '#07080c'; c.fillRect(0, 0, w, h);
    var gr = c.createLinearGradient(0, 0, 0, h * 0.22);
    gr.addColorStop(0, '#8a5c36'); gr.addColorStop(0.5, '#4a2f1c'); gr.addColorStop(1, 'rgba(7,8,12,0)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h * 0.22);
    var gx = c.createLinearGradient(w, 0, w * 0.66, 0);
    gx.addColorStop(0, '#8a5c36'); gx.addColorStop(0.35, '#6a4529'); gx.addColorStop(0.7, '#2e1d12'); gx.addColorStop(1, 'rgba(7,8,12,0)');
    c.fillStyle = gx; c.beginPath(); c.moveTo(w, 0); c.lineTo(w * 0.66, h * 0.22); c.lineTo(w * 0.66, h); c.lineTo(w, h); c.closePath(); c.fill();
    c.fillStyle = '#b07a48'; c.fillRect(0, 0, w, 5); c.fillRect(w - 4, 0, 4, h);
  }
  function discTex(c, w) {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, w / 2, w / 2 - 1, 0, TAU); c.fill();
  }

  /* ── текстура из картинки игры: sRGB, мипмапы; кеш по самому объекту Image ── */
  function texOf(im) {
    var t = tex.get(im);
    if (!t) {
      t = new TT.Texture(im); t.colorSpace = TT.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
      tex.set(im, t);
    }
    return t;
  }

  /* ════════ Постройка сцены (один раз) ════════ */
  var ZB = -1.5, ZF = 2.6, ZC = 2.85, ZE = 5.4;     // дальний край асфальта, ближний, бордюр, срез земли
  /* ZE — край ближней обочины. Широкая травяная полоса с цветами занимает низ кадра, а срез земли
     внизу остаётся тонкой лентой (≤ 12 % высоты): пустой коричневой стены больше нет. */
  var XL = -40, XR = 90;                            // полотно от камеры назад/вперёд, единиц
  function build() {
    var T = TT;
    _m = new T.Matrix4(); _q = new T.Quaternion(); _e = new T.Euler(); _p = new T.Vector3(); _s = new T.Vector3();
    _c = new T.Color(); _c2 = new T.Color(); _v = new T.Vector3();
    scene = new T.Scene();
    fog = new T.Fog(0xffffff, 26, 120); scene.fog = fog;
    cam = new T.PerspectiveCamera(P3.fov, 1, 0.5, 600);
    hemi = new T.HemisphereLight(0xffffff, 0x88aa66, P3.hemi); scene.add(hemi);
    sun = new T.DirectionalLight(0xfff4e0, P3.sun);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);       // тень только от машинки: 1024², больше не надо
    var sc = sun.shadow.camera; sc.left = -3.5; sc.right = 3.5; sc.top = 3.5; sc.bottom = -3.5; sc.near = 0.5; sc.far = 30;
    sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    spot = new T.SpotLight(0xfff2c0, 0, 16, 0.42, 0.6, 1.2);          // фары: светят только ночью
    scene.add(spot); scene.add(spot.target);

    mats.v = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    mats.flat = new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    mats.road = new T.MeshLambertMaterial({ color: 0x5d6472 });
    mats.grass = new T.MeshLambertMaterial({ color: 0x6ab04c });
    mats.grassF = new T.MeshLambertMaterial({ color: 0x6ab04c });
    mats.sea = new T.MeshLambertMaterial({ color: 0x3cc0e0 });
    mats.cloud = new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0xffffff, emissiveIntensity: 0.25 });
    mats.star = new T.MeshLambertMaterial({ color: 0xffd23d, emissive: 0x8a5a00, emissiveIntensity: 0.9, flatShading: true });
    mats.blob = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false,
                                          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mats.puddleRim = new T.MeshBasicMaterial({ color: 0x14283c, transparent: true, opacity: 0.35, depthWrite: false,
                                               polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    mats.puddle = new T.MeshLambertMaterial({ color: 0x2f8cc4, emissive: 0x1c6ea4, emissiveIntensity: 0.35,
                                              polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    mats.beam = new T.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0, depthWrite: false,
                                          blending: T.AdditiveBlending, side: T.DoubleSide });
    mats.sun = new T.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false });
    mats.lamp = new T.MeshBasicMaterial({ color: 0xff3b3b });

    ctex.glow = canvasTex(128, 128, glowTex);
    ctex.eyes = canvasTex(128, 112, eyesTex(false)); ctex.eyesA = canvasTex(128, 112, eyesTex(true));
    ctex.tlR = canvasTex(64, 270, tlightTex(true)); ctex.tlG = canvasTex(64, 270, tlightTex(false));
    ctex.disc = canvasTex(64, 64, discTex);
    ctex.halo = canvasTex(256, 256, haloTex); ctex.pit = canvasTex(128, 512, pitTex);
    mats.pitIn = new T.MeshBasicMaterial({ map: ctex.pit, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    mats.halo = new T.MeshBasicMaterial({ map: ctex.halo, transparent: true, depthWrite: false, fog: false });
    ctex.sky = document.createElement('canvas'); ctex.sky.width = 2; ctex.sky.height = 256;
    ctex.skyT = new T.CanvasTexture(ctex.sky); ctex.skyT.colorSpace = T.SRGBColorSpace;
    scene.background = ctex.skyT;

    buildGround();
    buildDecor();
    buildObjs();
    buildCar();
  }

  function mesh(geo, mat, shadow) {
    var m = new TT.Mesh(geo, mat); m.frustumCulled = false; if (shadow) m.receiveShadow = true; scene.add(m); return m;
  }
  function buildGround() {
    var L = XR - XL, cx = (XL + XR) / 2;
    M.road = mesh(box(L, 0.3, ZF - ZB), mats.road, true); M.road.position.set(cx, -0.15, (ZF + ZB) / 2);
    M.grassF = mesh(box(L, 0.36, ZE - ZC), mats.grassF, true); M.grassF.position.set(cx, -0.12, (ZE + ZC) / 2);
    /* Срез земли спереди — «торт в разрезе»: трава кромкой, потом слои грунта. */
    M.earth = mesh(merge([
      part(box(L, 0.7, 0.2), '#a8703f', [cx, -0.83, ZE - 0.1]),
      part(box(L, 0.8, 0.2), '#8d5a33', [cx, -1.58, ZE - 0.1]),
      part(box(L, 6, 0.2), '#704428', [cx, -4.98, ZE - 0.1])]), mats.v);
    mats.lip = new TT.MeshLambertMaterial({ color: 0x5b9a3e });
    M.lip = mesh(box(L, 0.3, 0.22), mats.lip); M.lip.position.set(cx, -0.33, ZE - 0.1);   // кромка травы над срезом — цвет темы
    M.grassB = mesh(new TT.PlaneGeometry(L * 3, 160), mats.grass, true);
    M.grassB.rotation.x = -Math.PI / 2; M.grassB.position.set(cx, 0, ZB - 0.2 - 80);
    M.sea = mesh(new TT.PlaneGeometry(L * 4, 300), mats.sea); M.sea.rotation.x = -Math.PI / 2;
    M.sea.position.set(cx, 0.03, -14 - 150); M.sea.visible = false;
    var curb = merge([part(box(1, 1, 1), '#ffffff')]);
    M.curbF = inst(140, curb, mats.v, true); M.curbB = inst(140, curb, mats.v, true);
    M.dash = inst(70, merge([part(box(1, 1, 1), '#f4f4ee')]), mats.v, true);
    M.seam = inst(112, merge([part(box(1, 1, 1), '#5f6672')]), mats.v);
    M.stone = inst(80,merge([part(ico(0.5, 0), '#ffffff', null, null, [1, 0.6, 0.35])]), mats.flat);
    M.tuft = inst(160, merge([part(cone(0.09, 0.32, 4), '#ffffff', [0, 0.16, 0]), part(cone(0.07, 0.24, 4), '#ffffff', [0.1, 0.12, 0.03], [0, 0, -0.4]),
                             part(cone(0.07, 0.24, 4), '#ffffff', [-0.1, 0.12, -0.02], [0, 0, 0.4])]), mats.v);
  }

  /* ── дальний план: низкополигональные холмы, деревья, дома, горы, дюны; облака ── */
  var FAR = {};
  function buildDecor() {
    var hill = ico(1, 1);
    M.hill1 = inst(14, merge([part(hill, '#ffffff', [0, 0, 0], null, [1, 1, 1])]), mats.flat);
    M.hill2 = inst(14, merge([part(hill, '#ffffff', [0, 0, 0], null, [1, 1, 1])]), mats.flat);
    FAR.forest = inst(40, merge([part(cyl(0.12, 0.16, 0.7, 5), '#8a5a35', [0, 0.35, 0]),
                                 part(cone(0.75, 1.3, 7), '#4f9d4a', [0, 1.2, 0]), part(cone(0.58, 1.05, 7), '#5fb456', [0, 1.85, 0])]), mats.v);
    FAR.jungle = inst(40, merge([part(cyl(0.12, 0.16, 1.2, 5), '#7a4f35', [0, 0.6, 0]),
                                 part(ico(0.7, 0), '#2f8f4e', [0, 1.5, 0], null, [1.2, 0.8, 1]), part(ico(0.5, 0), '#3fa65b', [0.45, 1.9, 0.1]),
                                 part(ico(0.45, 0), '#2a7f45', [-0.4, 1.8, -0.1])]), mats.v);
    var city = [part(box(1, 1, 1), '#ffffff', [0, 0.5, 0]), part(box(1.06, 0.06, 1.06), '#c9ced8', [0, 1.0, 0])];
    for (var r = 0; r < 7; r++) for (var cc = 0; cc < 3; cc++)
      city.push(part(box(0.18, 0.07, 0.02), '#ffe9a8', [-0.28 + cc * 0.28, 0.1 + r * 0.12, 0.51]));
    FAR.city = inst(40, merge(city), mats.v);
    FAR.peaks = inst(20, merge([part(cone(1, 1, 6), '#8b8fb3', [0, 0.5, 0], null, null, function (x, y) {
      return y > 0.68 ? '#ffffff' : y > 0.4 ? '#9a9ec0' : '#7d81a6'; })]), mats.v);
    FAR.dunes = inst(20, merge([part(ico(1, 1), '#e8c98a', [0, 0, 0])]), mats.flat);
    FAR.sea = inst(10, merge([part(ico(1, 1), '#7fd18c', [0, 0, 0], null, null, function (x, y) { return y > 0.25 ? '#5fb456' : '#f2dfa8'; })]), mats.v);
    var cl = [];
    for (var k = 0; k < 5; k++) cl.push(part(ico(0.8 + hash(k) * 0.6, 1), '#ffffff', [(k - 2) * 0.9, (k % 2) * 0.35 + (k === 2 ? 0.4 : 0), hash(k + 9) * 0.4]));
    M.cloud = inst(12, merge(cl), mats.cloud);
    M.sun = mesh(new TT.PlaneGeometry(1, 1), mats.sun); M.sun.renderOrder = -1;
    M.halo = mesh(new TT.PlaneGeometry(1, 1), mats.halo); M.halo.renderOrder = -2;
    buildProps3();
  }

  /* ── объёмный реквизит обочины в стиле деревьев дальнего плана: дом, дерево, куст, стог,
        забор, ромашки, ёлка. Каждый вид — один InstancedMesh (один вызов), модель стоит на y = 0,
        BH — высота модели; масштаб экземпляра = нужная высота / BH. Спрайты остались у животных,
        машин и предметов, у которых нет объёмной версии. ── */
  var P3K = { house: 'house', tree: 'tree', bush: 'bush', haystack: 'hay', fence: 'fence', daisies: 'daisy', loc_fir: 'fir' };
  var BH = { house: 1.12, tree: 1.02, bush: 0.44, hay: 0.7, fence: 0.6, daisy: 0.3, fir: 1.22,
            shell: 0.1, starfish: 0.06, palmlet: 0.56, hydrant: 0.44, bench: 0.42, lamp: 0.9, drift: 0.26, snowlump: 0.62 };
  var P3N = { house: 16, tree: 30, bush: 40, hay: 16, fence: 48, daisy: 80, fir: 60,
              shell: 40, starfish: 30, palmlet: 30, hydrant: 20, bench: 24, lamp: 24, drift: 50, snowlump: 20 }, n3 = {};
  function buildProps3() {
    var T = TT, i, P = {};
    P.tree = [part(cyl(0.05, 0.08, 0.44, 6), '#8a5a35', [0, 0.22, 0]),
              part(ico(0.3, 0), '#5cb85c', [0, 0.62, 0]), part(ico(0.24, 0), '#6cc66a', [0.22, 0.52, 0.06]),
              part(ico(0.24, 0), '#4ea84e', [-0.21, 0.54, -0.04]), part(ico(0.19, 0), '#79d073', [0.03, 0.84, 0.05])];
    P.bush = [part(ico(0.25, 0), '#5cb85c', [0, 0.2, 0], null, [1.3, 0.9, 1]), part(ico(0.19, 0), '#6cc66a', [0.27, 0.15, 0.05]),
              part(ico(0.18, 0), '#4ea84e', [-0.27, 0.14, -0.03]),
              part(ico(0.035, 0), '#ff5d73', [0.1, 0.34, 0.18]), part(ico(0.035, 0), '#ff5d73', [-0.14, 0.27, 0.17]),
              part(ico(0.035, 0), '#ff5d73', [0.3, 0.22, 0.17])];
    var tri = new T.Shape(); tri.moveTo(-0.62, 0); tri.lineTo(0.62, 0); tri.lineTo(0, 0.5); tri.lineTo(-0.62, 0);
    var roof = new T.ExtrudeGeometry(tri, { depth: 1, bevelEnabled: false }); roof.translate(0, 0, -0.5); roof.rotateY(Math.PI / 2);
    P.house = [part(box(1, 0.62, 0.9), '#fff1d6', [0, 0.31, 0]), part(roof, '#e8553f', [0, 0.6, 0], null, [1, 1, 1.18]),
               part(box(0.12, 0.24, 0.12), '#b5523f', [0.3, 0.92, -0.12]),
               part(box(0.2, 0.34, 0.03), '#8a5a35', [0.2, 0.17, 0.455]), part(box(0.26, 0.22, 0.02), '#ffffff', [-0.2, 0.36, 0.452]),
               part(box(0.2, 0.16, 0.03), '#8fd3ff', [-0.2, 0.36, 0.46]), part(box(1.04, 0.05, 0.94), '#d9c7a6', [0, 0.025, 0])];
    P.hay = [part(cyl(0.48, 0.52, 0.42, 10), '#e9c46a', [0, 0.21, 0]), part(ico(0.49, 1), '#f2d27a', [0, 0.42, 0], null, [1, 0.58, 1]),
             part(cyl(0.53, 0.53, 0.06, 10), '#c99a3a', [0, 0.3, 0])];
    P.fence = [part(box(1.0, 0.07, 0.04), '#b97a45', [0, 0.16, -0.04]), part(box(1.0, 0.07, 0.04), '#b97a45', [0, 0.38, -0.04])];
    for (i = 0; i < 4; i++) P.fence.push(part(box(0.1, 0.5, 0.05), '#e0a868', [-0.375 + i * 0.25, 0.25, 0]),
                                         part(cone(0.072, 0.1, 4), '#e0a868', [-0.375 + i * 0.25, 0.55, 0], [0, Math.PI / 4, 0]));
    P.daisy = [part(cone(0.13, 0.16, 5), '#4ea84e', [0, 0.08, 0])];
    for (i = 0; i < 5; i++) {
      var dx = (i - 2) * 0.09 + hash(i) * 0.03, dh = 0.17 + hash(i + 7) * 0.1, dz = hash(i + 2) * 0.08 - 0.04;
      P.daisy.push(part(box(0.016, dh, 0.016), '#3f8f3f', [dx, dh / 2, dz]),
                   part(cyl(0.06, 0.06, 0.016, 8), i % 3 === 1 ? '#ffd84d' : '#ffffff', [dx, dh, dz], [1.1, 0, 0]),
                   part(cyl(0.024, 0.024, 0.02, 6), '#ffb703', [dx, dh + 0.006, dz + 0.008], [1.1, 0, 0]));
    }
    P.fir = [part(cyl(0.06, 0.08, 0.3, 5), '#7a4f35', [0, 0.15, 0]),
             part(cone(0.44, 0.5, 7), '#2f6b4a', [0, 0.47, 0]), part(cone(0.34, 0.42, 7), '#357a52', [0, 0.74, 0]),
             part(cone(0.24, 0.36, 7), '#3b8659', [0, 0.98, 0]), part(cone(0.13, 0.17, 7), '#ffffff', [0, 1.13, 0]),
             part(cone(0.2, 0.08, 7), '#f4f8ff', [0, 0.84, 0]), part(cone(0.3, 0.08, 7), '#f4f8ff', [0, 0.6, 0])];
    /* ближний план тем без цветов: пляж (ракушки, морские звёзды, кустики пальм),
       город (гидрант, скамейка, фонарик), зима (сугробы, ёлочки, снежные комья) */
    P.shell = [part(ico(0.13, 1), '#ffe1cf', [0, 0.03, 0], null, [1, 0.42, 0.85]), part(cone(0.05, 0.05, 5), '#f1b39a', [0, 0.02, -0.12], [-1.4, 0, 0]),
               part(ico(0.08, 1), '#ffc2b8', [0.2, 0.02, 0.06], [0, 0.6, 0], [1, 0.45, 0.85])];
    for (i = 0; i < 5; i++) P.shell.push(part(box(0.012, 0.012, 0.2), '#e9a88c', [(i - 2) * 0.045, 0.055 - Math.abs(i - 2) * 0.008, 0], [0, (i - 2) * 0.28, 0]));
    var sf = new T.Shape();
    for (i = 0; i < 10; i++) {
      var sa = Math.PI / 2 + i * Math.PI / 5, sr = i % 2 ? 0.06 : 0.17;
      if (i) sf.lineTo(Math.cos(sa) * sr, Math.sin(sa) * sr); else sf.moveTo(Math.cos(sa) * sr, Math.sin(sa) * sr);
    }
    var sfg = new T.ExtrudeGeometry(sf, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    sfg.rotateX(-Math.PI / 2);
    P.starfish = [part(sfg, '#ff8a5c', [0, 0.02, 0]), part(ico(0.03, 0), '#ffb38a', [0, 0.07, 0])];
    P.palmlet = [part(cyl(0.035, 0.05, 0.22, 6), '#a0703f', [0, 0.11, 0], [0, 0, 0.12]), part(ico(0.045, 0), '#7a4f2a', [0.035, 0.22, 0.03])];
    for (i = 0; i < 7; i++) {
      var la = i / 7 * TAU, lt = 0.75 + hash(i + 11) * 0.35;
      P.palmlet.push(part(cone(0.07, 0.36, 4), i % 2 ? '#3fae5a' : '#55c46a', [Math.cos(la) * 0.15, 0.27, Math.sin(la) * 0.15],
                          [Math.sin(la) * lt, 0, -Math.cos(la) * lt], [1, 1, 0.3]));
    }
    P.hydrant = [part(cyl(0.12, 0.13, 0.05, 8), '#b8202c', [0, 0.025, 0]), part(cyl(0.09, 0.1, 0.3, 8), '#e63946', [0, 0.2, 0]),
                 part(ico(0.095, 1), '#e63946', [0, 0.35, 0], null, [1, 0.7, 1]), part(cyl(0.03, 0.03, 0.06, 6), '#f4c542', [0, 0.42, 0]),
                 part(cyl(0.04, 0.04, 0.28, 6), '#c42a36', [0, 0.25, 0], [0, 0, Math.PI / 2]), part(cyl(0.11, 0.11, 0.035, 8), '#f4c542', [0, 0.31, 0])];
    P.bench = [part(box(0.8, 0.04, 0.24), '#c9853f', [0, 0.22, 0]), part(box(0.8, 0.12, 0.03), '#b87638', [0, 0.36, -0.12], [-0.2, 0, 0]),
               part(box(0.04, 0.22, 0.2), '#4a4f5a', [-0.32, 0.11, 0]), part(box(0.04, 0.22, 0.2), '#4a4f5a', [0.32, 0.11, 0]),
               part(box(0.03, 0.2, 0.03), '#4a4f5a', [-0.32, 0.3, -0.12]), part(box(0.03, 0.2, 0.03), '#4a4f5a', [0.32, 0.3, -0.12])];
    P.lamp = [part(cyl(0.07, 0.09, 0.08, 6), '#3b414c', [0, 0.04, 0]), part(cyl(0.03, 0.035, 0.7, 6), '#4a5260', [0, 0.42, 0]),
              part(cyl(0.05, 0.09, 0.08, 6), '#3b414c', [0, 0.8, 0]), part(ico(0.075, 1), '#fff2b0', [0, 0.84, 0], null, [1, 0.8, 1])];
    P.drift = [part(ico(0.3, 1), '#f4f9ff', [0, 0, 0], null, [1.7, 0.85, 1]), part(ico(0.2, 1), '#e6f0fa', [0.38, 0, 0.05], null, [1.4, 0.8, 1]),
               part(ico(0.16, 1), '#ffffff', [-0.36, 0, -0.02], null, [1.3, 0.75, 1])];
    P.snowlump = [part(ico(0.22, 1), '#f4f9ff', [0, 0.18, 0], null, [1, 0.85, 1]), part(ico(0.15, 1), '#ffffff', [0.02, 0.45, 0]),
                  part(cone(0.03, 0.12, 5), '#ff8c2a', [0.04, 0.46, 0.17], [Math.PI / 2, 0, 0]),
                  part(ico(0.018, 0), '#2b2140', [-0.03, 0.5, 0.13]), part(ico(0.018, 0), '#2b2140', [0.08, 0.5, 0.12])];
    M.p3 = {};
    for (var k in P) M.p3[k] = inst(P3N[k], merge(P[k]), mats.v, true);
  }
  /* поставить объёмный реквизит: kind — ключ модели, h — высота в единицах */
  function p3(kind, x, z, h, sway, ry, y) {
    var im = M.p3[kind]; if (!im || n3[kind] >= P3N[kind]) return 0;
    var sc = h / BH[kind];
    put(im, n3[kind]++, x, y || 0, z, sc, sc, sc, sway || 0, ry || 0);
    return sc;
  }
  function p3done() { for (var k in M.p3) { done(M.p3[k], n3[k] || 0); n3[k] = 0; } }
  function p3fence(x, z, h, n) {          // забор — сквозные секции встык, без щелей
    var sc = h / BH.fence;
    for (var k = 0; k < n; k++) p3('fence', x + (k - (n - 1) / 2) * sc * 0.99, z, h);
  }

  /* ── предметы на дороге: трамплины, платформы, звёзды, ямы, лужи, тени; пулы спрайтов ── */
  var bbGeoB, bbGeoM;
  function buildObjs() {
    var T = TT;
    /* Трамплин: клин 1×1×1 (подъём слева направо), на скате — полосы; масштаб экземпляра — w, h, ширина. */
    var sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(1, 0); sh.lineTo(1, 1); sh.lineTo(0, 0);
    var wedge = new T.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); wedge.translate(0, 0, -0.5);
    var rp = [part(wedge, '#ffb703', null, null, null, function (x, y, z) {
      return Math.abs(z) > 0.49 ? '#e07b22' : x > 0.99 ? '#c96f1e' : y < 0.01 ? '#7a4a20' : '#ffb703'; })];
    for (var i = 1; i < 5; i++) rp.push(part(box(0.07, 0.012, 0.96), '#e63946', [i / 5, i / 5 + 0.006, 0], [0, 0, Math.PI / 4], [1.41, 1, 1]));
    M.ramp = inst(6, merge(rp), mats.v, true); M.ramp.castShadow = false;
    /* Платформа — цельный земляной блок от дороги до верха (верх ровно o.h): слои грунта,
       камешки, травяная шапка с напуском и свесами. Модель 1×1×1, низ в 0, верх в 1. */
    var pl = [part(box(1, 0.32, 1), '#7a4a2a', [0, 0.16, 0]), part(box(1, 0.3, 1), '#8d5a33', [0, 0.47, 0]),
              part(box(1, 0.26, 1), '#a8703f', [0, 0.75, 0]),
              part(box(1.05, 0.13, 1.06), '#78c850', [0, 0.935, 0], null, null, function (x, y) { return y > 0.99 ? '#8ad85e' : '#5fae43'; })];
    /* свесы травы — неровные капли: разный шаг, ширина и длина, скруглённые снизу (ящики читались как зубцы стены) */
    for (var dxp = -0.5; dxp < 0.47; ) {
      var dw = 0.03 + hash(dxp * 91) * 0.04, dl = 0.04 + hash(dxp * 37 + 5) * 0.11;
      dxp += dw + 0.01 + hash(dxp * 53 + 2) * 0.05;
      if (dxp > 0.49) break;
      pl.push(part(ico(1, 1), hash(dxp * 17) > 0.5 ? '#5fae43' : '#54a03c', [dxp, 0.875 - dl * 0.5, 0.515 + hash(dxp * 13) * 0.01], null, [dw, dl * 0.5 + 0.035, 0.022]));
      dxp += dw;
    }
    for (i = 0; i < 6; i++) pl.push(part(ico(0.05, 0), i % 2 ? '#5e3a22' : '#c49061', [-0.4 + i * 0.16 + hash(i * 3) * 0.05, 0.12 + hash(i * 5) * 0.55, 0.5]));
    M.plat = inst(6, merge(pl), mats.v, true);
    M.post = inst(24, merge([part(cyl(0.07, 0.08, 1, 6), '#8a5a28', [0, 0.5, 0])]), mats.v);
    /* Звезда — главная награда: настоящая объёмная, золотая, крутится. */
    var ss = new T.Shape();
    for (i = 0; i < 10; i++) {
      var a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.14 : 0.33;
      if (i) ss.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ss.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    var sg = new T.ExtrudeGeometry(ss, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 1 });
    sg.translate(0, 0, -0.05);
    M.star = inst(28, sg, mats.star);
    var cg = new T.CircleGeometry(1, 18); cg.rotateX(-Math.PI / 2);
    M.blob = inst(64, cg, mats.blob); M.blob.renderOrder = 1;
    M.pudRim = inst(6, cg, mats.puddleRim); M.pud = inst(6, cg, mats.puddle);
    var pq = new T.PlaneGeometry(1, 1); pq.rotateX(-Math.PI / 2);
    M.pitTop = inst(6, pq, mats.pitIn);
    M.rail = inst(80, merge([part(box(1, 1, 1), '#ffffff')]), mats.v);
    bbGeoB = new T.PlaneGeometry(1, 1); bbGeoB.translate(0, 0.5, 0);
    bbGeoM = new T.PlaneGeometry(1, 1);
    for (i = 0; i < 72; i++) {
      var bm = new T.Mesh(bbGeoB, new T.MeshBasicMaterial({ transparent: true, alphaTest: 0.06, side: T.DoubleSide }));
      bm.visible = false; bm.frustumCulled = false; scene.add(bm); pool.push(bm);
    }
    for (i = 0; i < 8; i++) {
      var gm = new T.Mesh(bbGeoM, new T.MeshBasicMaterial({ map: ctex.glow, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      gm.visible = false; gm.frustumCulled = false; scene.add(gm); glows.push(gm);
    }
    var sph = ico(1, 1);
    for (i = 0; i < 6; i++) {
      var mm = new T.Mesh(sph, new T.MeshBasicMaterial({ color: 0xffffff }));
      mm.visible = false; mm.frustumCulled = false; scene.add(mm); misc.push(mm);
    }
    /* Пыль при посадке и искры звезды — одни Points на 32 точки, буферы на всю жизнь. */
    var pg = new T.BufferGeometry();
    pg.setAttribute('position', new T.BufferAttribute(new Float32Array(32 * 3), 3));
    pg.setAttribute('color', new T.BufferAttribute(new Float32Array(32 * 3), 3));
    M.pts = new T.Points(pg, new T.PointsMaterial({ size: 0.24, map: ctex.disc, vertexColors: true, transparent: true,
                                                    depthWrite: false, alphaTest: 0.02 }));
    M.pts.frustumCulled = false; scene.add(M.pts);
  }

  /* ── машинка: кузов и колёса — плоскости со спрайтами; тень — настоящая, от силуэта ── */
  var car3 = {};
  function carPlane(z) {
    var T = TT, mt = new T.MeshBasicMaterial({ transparent: true, alphaTest: 0.06, side: T.DoubleSide });
    var m = new T.Mesh(bbGeoM, mt);
    m.customDepthMaterial = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, alphaTest: 0.5, side: T.DoubleSide });
    m.castShadow = true; m.frustumCulled = false; m.position.z = z; m.renderOrder = 2;
    return m;
  }
  function buildCar() {
    car3.g = new TT.Group(); scene.add(car3.g);
    car3.body = carPlane(0.03); car3.t1 = carPlane(0); car3.t2 = carPlane(0);
    car3.g.add(car3.body); car3.g.add(car3.t1); car3.g.add(car3.t2);
    var bg = new TT.ConeGeometry(1, 1, 16, 1, true); bg.translate(0, -0.5, 0); bg.rotateZ(Math.PI / 2);
    M.beam = mesh(bg, mats.beam); M.beam.renderOrder = 3;
  }
  function setMap(mesh0, im) {
    var t = texOf(im), mt = mesh0.material;
    if (mt.map !== t) { mt.map = t; if (!mt.__had) { mt.needsUpdate = true; mt.__had = 1; }
                        if (mesh0.customDepthMaterial) { mesh0.customDepthMaterial.map = t; mesh0.customDepthMaterial.needsUpdate = true; } }
  }

  /* ════════ Кадр ════════ */
  function Zd(y2d) { return (y2d - GY) * u * 2.9; }   // глубина из 2D: обочина (roadTop) ≈ дальний край асфальта
  function X(x) { return (x - carX) * u; }

  /* Спрайт-плоскость: якорь низ-центр (или центр при mid), как spr() в 2D. */
  function bb(name, x, y, z, h, o) {
    var im = imgOf(name);
    if (!ok(im) || bbN >= pool.length) return 0;
    var m = pool[bbN++], w = iw(im) * (h / ih(im));
    setMap(m, im);
    m.geometry = (o && o.mid) ? bbGeoM : bbGeoB;
    m.position.set(x, y - (o && o.dy ? o.dy * u : 0), z);
    m.rotation.set(0, 0, o && o.rot ? -o.rot : 0);
    m.scale.set(w * (o && o.sx ? o.sx : 1), h * (o && o.sy ? o.sy : 1), 1);
    m.material.opacity = o && o.alpha != null ? o.alpha : 1;
    m.material.color.setRGB(tint, tint, tintB);
    m.visible = true;
    return w;
  }
  function bbTex(t, x, y, z, w, h, mid) {
    if (bbN >= pool.length) return;
    var m = pool[bbN++], mt = m.material;
    if (mt.map !== t) { mt.map = t; if (!mt.__had) { mt.needsUpdate = true; mt.__had = 1; } }
    m.geometry = mid ? bbGeoM : bbGeoB;
    m.position.set(x, y, z); m.rotation.set(0, 0, 0); m.scale.set(w, h, 1);
    mt.opacity = 1; mt.color.setRGB(tint, tint, tintB); m.visible = true;
  }
  function glow(x, y, z, r, op) {
    if (glN >= glows.length) return;
    var m = glows[glN++]; m.position.set(x, y, z); m.scale.set(r * 2, r * 2, 1); m.material.opacity = op; m.visible = true;
  }
  function lamp(x, y, z, r, hex, k) {
    if (miN >= misc.length) return;
    var m = misc[miN++]; m.position.set(x, y, z); m.scale.set(r, r, r);
    m.material.color.set(hex); if (k != null) m.material.color.multiplyScalar(k); m.visible = true;
  }
  var nB = 0;
  function blob(x, z, rx, rz) { if (nB < 64) put(M.blob, nB++, x, 0.012, z, rx, 1, rz); }

  var lessonHide = false;
  function hidden(o) { return lessonHide && o !== les.obj && LESSON_HIDE[o.t]; }

  function updObjs() {
    var nS = 0, nR = 0, nP = 0, nPo = 0, nPt = 0, nPd = 0, nRl = 0, k;
    var xmin = (-CARX - 500 * S) * u, xmax = (W - CARX + 600 * S) * u, zO = -0.15;
    lessonHide = state === 'lesson';
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i], x = X(o.x);
      if (o.t === 'ramp' || o.t === 'plat') { if (x + o.w * u < xmin || x > xmax) continue; }
      else if (x < xmin || x > xmax) continue;
      if (hidden(o)) continue;
      var t = o.t;
      if (t === 'ramp') {
        if (nR < 6) put(M.ramp, nR++, x, 0, -0.1, o.w * u, o.h * u, 2.6);
      } else if (t === 'plat') {
        /* Платформа целиком ЗА плоскостью игры: машинка под ней проезжает спереди, а не сквозь
           опоры (в 2D платформа тоже рисуется до машинки); на ней — стоит у самой кромки. */
        var pw = o.w * u + 0.12 * 100 * S * u;
        if (nP < 6) put(M.plat, nP++, x + o.w * u / 2, 0, -0.82, pw, o.h * u, 1.6);
      } else if (t === 'star') {
        var sb = Math.sin(o.ph * 2.4) * 10 * S;
        if (nS < 28) put(M.star, nS++, x, (o.y + sb) * u, zO, 1.05 * S * u * 100, 1.05 * S * u * 100, 1.05 * S * u * 100,
                         Math.sin(o.ph * 1.7) * 0.22, T * 2.6 + (o.ph || 0));
        blob(x, zO, 0.22, 0.12);
        o.__p3 = frameId; trackStar(o, x, (o.y + sb) * u);
      } else if (t === 'fuel') {
        var fy = o.y + Math.sin(o.ph * 2.2) * 8 * S;
        glow(x, (fy - 20 * S) * u, zO - 0.05, (66 * S + Math.sin(o.ph * 3) * 5 * S) * u, 0.55);
        bb('fuel', x, (fy - 48 * S) * u, zO, 90 * S * u, { rot: Math.sin(o.ph * 1.4) * 0.08 });
        blob(x, zO, 0.35, 0.18);
      } else if (t === 'balloon') {
        var by = o.y + Math.sin(o.ph * 1.6) * 16 * S;
        bb('balloon', x, (by - 42 * S) * u, zO, 84 * S * u, { rot: Math.sin(o.ph * 1.1) * 0.12 });
      } else if (t === 'cone') {
        blob(x, zO, 0.22, 0.14);
        bb('cone', x, (o.y || 0) * u, zO, 40 * S * u, { rot: o.rot || 0 });
      } else if (t === 'puddle') {
        if (nPd < 6) { put(M.pudRim, nPd, x, 0.006, 0.45, o.w * 0.52 * u + 0.06, 1, 0.78); put(M.pud, nPd++, x, 0.01, 0.45, o.w * 0.52 * u, 1, 0.68); }
      } else if (t === 'pit') {
        if (nPt < 6) {
          // дыра только в полотне: от дальнего бордюра до ближнего; травяная полоса и срез земли перед ней целые
          put(M.pitTop, nPt++, x, 0.016, (ZB - 0.25 + ZC) / 2, (x < 0 ? -1 : 1) * o.w * u, 1, ZC - ZB + 0.25);
        }
        var bite = o.bite || 0, rise = bite > 0 ? (1 - Math.abs(bite - 0.55) / 0.55) : 0;
        var ew = 0.8 * (1 + rise * 0.6);
        bbTex(bite > 0 ? ctex.eyesA : ctex.eyes, x, -0.5 + rise * 0.9 + Math.sin((o.ph || 0) * 2.2) * 0.04, 0.9, ew, ew * 0.875, false);
      } else if (t === 'bird') {
        bb(frameOf('bird', o.ph), x, Y(o.y + Math.sin((o.ph || 0) * 7) * 8 * S), -1, 78 * S * u, withMove('bird', o.ph, 78 * S, { mid: true }));
      } else if (t === 'plane') {
        bb('plane', x, Y(o.y + Math.sin((o.ph || 0) * 1.6) * 7 * S), -2, 96 * S * u, { mid: true, sx: -1 });
      } else if (t === 'flower') {
        bb(frameOf('flower', o.ph), x, 0, Zd(roadTop() - 8 * S), 60 * S * u, withMove('flower', o.ph, 60 * S, {}));
      } else if (t === 'apple') {
        bb('apple', x, (o.y - 30 * S + Math.sin((o.ph || 0) * 2.4 + T * 2) * 8 * S) * u, zO, 58 * S * u);
      } else if (t === 'coin') {
        if (o.got) continue;
        bb(frameOf('coin', o.ph), x, (o.y - 30 * S + Math.sin((o.ph || 0) * 2.2 + T * 2.4) * 7 * S) * u, zO, 52 * S * u, withMove('coin', o.ph, 52 * S, {}));
      } else if (t === 'ball') {
        var bh = ballH(o), bk = clamp(1 - bh / (70 * S), 0.35, 1);
        blob(x, zO, 0.26 * bk, 0.14 * bk);
        bb('ball', x, (bh - 4 * S) * u, zO, 62 * S * u, { rot: T * 3 });
      } else if (t === 'hedgehog') {
        var zh = Zd(roadTop() - 6 * S); blob(x, zh, 0.22, 0.1);
        bb(frameOf('hedgehog', o.ph), x, 0, zh, 58 * S * u, withMove('hedgehog', o.ph, 58 * S, {}));
      } else if (t === 'butterfly') {
        bb(frameOf('butterfly', o.ph), x, Y(o.y + Math.sin(T * 5) * 12 * S), -0.8, 56 * S * u, withMove('butterfly', o.ph, 56 * S, { mid: true }));
      } else if (t === 'rocket') {
        var zr = Zd(roadTop() - 6 * S) - 0.6;
        if (!o.gone) bb('launchpad', x + 34 * S * u, 0, zr - 0.05, 150 * S * u);
        bb('loc_rocket', x, (o.h || 0) * u, zr, 178 * S * u, { rot: (o.h || 0) > 0 ? 0.06 : 0 });
        if ((o.h || 0) > 0) glow(x, (o.h || 0) * u, zr + 0.05, 0.6, 0.9);
      } else if (t === 'rail') {
        nRl = rail(o, x, nRl);
      } else if (t === 'prop') {
        var zp = Zd(roadTop() - 10 * S) - 0.2, phh = (PROP_H[o.kind] || 130) * S * u;
        if (o.kind === 'fence') { p3fence(x, zp, phh * 1.6, 4); continue; }
        var k3d = P3K[o.kind];
        if (k3d) {                                    // объёмная версия: крупнее спрайта, покачивается
          var sc3 = p3(k3d, x, zp, phh * (k3d === 'daisy' ? 2.2 : 1.45), Math.sin(T * 1.3 + (o.ph || 0)) * (k3d === 'house' || k3d === 'hay' ? 0 : 0.025));
          if (k3d !== 'daisy') blob(x, zp, BH[k3d] * sc3 * 0.45, 0.32);
          continue;
        }
        var pw2 = bb(frameOf(o.kind, o.ph), x, 0, zp, phh * 1.2, withMove(o.kind, o.ph, phh * 1.2 / u, { sy: 1 + Math.sin(T * 1.3 + (o.ph || 0)) * 0.010 }));
        blob(x, zp, pw2 * 0.4, 0.25);
      } else if (t === 'traffic') {
        if (!ok(imgOf(o.kind))) { lazyImg(o.kind); continue; }
        var zt = Zd(roadTop() + 30 * S), thh = (PROP_H[o.kind] || 118) * S * 0.9 * u;
        var tw = bb(frameOf(o.kind, o.ph), x, Math.sin(T * 6 + (o.ph || 0)) * 1.6 * S * u, zt, thh, withMove(o.kind, o.ph, thh / u, {}));
        blob(x, zt, tw * 0.45, 0.3);
      } else if (t === 'cloudy') {
        bb('cloud', x, Y(o.y), -3, 110 * S * u, { mid: true });
      } else if (t === 'bucket') {
        var b2 = Math.sin((o.ph || 0) * 2.4) * 7 * S;
        bb('paint', x, (b2 - 6 * S) * u, zO, 84 * S * u);
        lamp(x, (96 * S + b2) * u, zO, 26 * S * u, o.col.c);
        blob(x, zO, 0.35, 0.16);
      } else if (t === 'mon') {
        var hop2 = Math.abs(Math.sin((o.ph || 0) * 5)) * 10 * S;
        var msk = (o.skin || 'monster_a') + (Math.floor(T * 3.6 + (o.ph || 0)) % 2 ? '_run' : '');
        if (!ok(IMG[msk])) msk = o.skin || 'monster_a';
        blob(x, zO, 0.38, 0.14);
        bb(msk, x, (hop2 - 6 * S) * u, zO, 96 * S * u, { rot: Math.sin(o.ph * 5) * 0.08 });
      } else if (t === 'tlight') {
        bbTex(o.green ? ctex.tlG : ctex.tlR, x, 0, -1.0, 0.64 * 100 * S * u, 2.7 * 100 * S * u, false);
        blob(x, -1.0, 0.18, 0.1);
      } else if (t === 'sheep') {
        var hop = Math.abs(Math.sin((o.ph || 0) * (o.run ? 9 : 2.2))) * (o.run ? 30 : 5) * S;
        blob(x, -0.3, 0.32, 0.14);
        bb(frameOf('sheep', o.ph), x, (hop - 4 * S) * u, -0.3, 82 * S * u, o.run ? { rot: Math.sin(o.ph * 9) * 0.12 } : withMove('sheep', o.ph, 82 * S, {}));
      } else if (t === 'arch') {
        bb('arch', x, -4 * S * u, -0.6, o.h * u);
      }
    }
    done(M.star, nS); done(M.ramp, nR); done(M.plat, nP); done(M.post, nPo);
    done(M.pitTop, nPt); done(M.pudRim, nPd); done(M.pud, nPd); done(M.rail, nRl);
  }
  function Y(y2d) { return (GY - y2d) * u; }

  /* Переезд: рельсы наискось через всю дорогу, состав идёт по ним из глубины на зрителя. */
  function railPt(x, p) { return [x + (0.78 - 1.82 * p) * 100 * S * u, -2.6 + 6.2 * p]; }
  function rail(o, x, n) {
    var a = railPt(x, -0.2), b = railPt(x, 1.2), dx = b[0] - a[0], dz = b[1] - a[1];
    var len = Math.sqrt(dx * dx + dz * dz), ang = Math.atan2(-dz, dx), nx = -dz / len, nz = dx / len, k;
    _c.set('#93856c');
    for (k = -1; k <= 1; k += 2) if (n < 80) {
      _c.set('#8f98a6'); M.rail.setColorAt(n, _c);
      put(M.rail, n++, (a[0] + b[0]) / 2 + nx * k * 0.32, 0.06, (a[1] + b[1]) / 2 + nz * k * 0.32, len, 0.07, 0.07, 0, ang);
    }
    for (k = 0; k < 16 && n < 80; k++) {
      var q = k / 15; _c.set('#7a5a3a'); M.rail.setColorAt(n, _c);
      put(M.rail, n++, a[0] + dx * q, 0.025, a[1] + dz * q, 0.16, 0.05, 0.95, 0, ang);
    }
    var ph = Math.sin(T * 4.4);                      // лампы переезда — плавно, < 1 раза в секунду
    if (o.train) {
      var lx = x + 1.5 * 100 * S * u;
      lamp(lx - 0.15, 0.95, -1.9, 0.09, '#ff4b4b', 0.35 + 0.65 * clamp(ph * 0.5 + 0.5, 0, 1));
      lamp(lx + 0.15, 0.95, -1.9, 0.09, '#ff4b4b', 0.35 + 0.65 * clamp(-ph * 0.5 + 0.5, 0, 1));
      var segs = trainSegs(o);
      for (var j = segs.length - 1; j >= 0; j--) {
        var p = segs[j]; if (p < -0.03 || p > 1.15) continue;
        var pt = railPt(x, p), nm = (j > 0 && ok(IMG.wagon)) ? 'wagon' : 'train';
        bb(nm, pt[0], 0.04, pt[1], 150 * S * u * 0.95, { rot: Math.sin(T * 22 + j) * 0.012 });
        blob(pt[0], pt[1], 0.8, 0.35);
      }
    }
    return n;
  }

  /* ── звезда собрана: поп ×1.3 и искры (рядом с машинкой исчезла из objs) ── */
  var sCur = [], sPrev = [], sPop = [];
  for (var _i = 0; _i < 16; _i++) { sCur.push({ o: null, x: 0, y: 0 }); sPrev.push({ o: null, x: 0, y: 0 }); }
  for (_i = 0; _i < 4; _i++) sPop.push({ t: -1, x: 0, y: 0 });
  var sN = 0, sPrevN = 0;
  function trackStar(o, x, y) { if (sN < 16) { var s = sCur[sN++]; s.o = o; s.x = x; s.y = y; } }
  function checkStars(dt) {
    for (var i = 0; i < sPrevN; i++) {
      var s = sPrev[i];
      if (s.o && s.o.__p3 !== frameId && Math.abs(s.x) < 3) {
        for (var k = 0; k < 4; k++) if (sPop[k].t < 0) { sPop[k].t = 0; sPop[k].x = s.x; sPop[k].y = s.y; burst(s.x, s.y, 0, 8, '#ffd23d', 2.2, 0.5); break; }
      }
      s.o = null;
    }
    var sw = sPrev; sPrev = sCur; sCur = sw; sPrevN = sN; sN = 0;
  }
  function drawPops(dt, nS) {
    for (var k = 0; k < 4; k++) {
      var p = sPop[k]; if (p.t < 0) continue;
      p.t += dt;
      if (p.t > 0.3) { p.t = -1; continue; }
      var sc = p.t < 0.15 ? 1 + 0.3 * p.t / 0.15 : 1.3 * (1 - (p.t - 0.15) / 0.15);
      var z = 1.05 * S * u * 100 * sc;
      if (nS < 28) put(M.star, nS++, p.x, p.y, -0.15, z, z, z, 0, T * 9);
    }
    done(M.star, nS);
  }

  /* ── пыль и искры: 32 точки одним Points ── */
  var PT = [];
  for (_i = 0; _i < 32; _i++) PT.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, c: '#fff' });
  var ptI = 0;
  function burst(x, y, z, n, col, sp, life) {
    for (var i = 0; i < n; i++) {
      var p = PT[ptI = (ptI + 1) % 32], a = (i / n) * TAU + hash(i + T) * 0.6;
      p.life = p.max = life * (0.7 + hash(i * 3.1 + T) * 0.5); p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(a) * sp; p.vy = Math.abs(Math.sin(a)) * sp * 0.8 + 0.4; p.vz = (hash(i * 7.7) - 0.5) * sp * 0.6;
      p.g = col === '#ffd23d' ? 3 : 2.2; p.c = col;
    }
  }
  function updPts(dt) {
    var pa = M.pts.geometry.attributes.position, ca = M.pts.geometry.attributes.color;
    for (var i = 0; i < 32; i++) {
      var p = PT[i];
      if (p.life > 0) {
        p.life -= dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y = Math.max(0.02, p.y + p.vy * dt); p.z += p.vz * dt;
        p.vx *= 1 - dt * 2.5;
      }
      var a = clamp(p.life / p.max, 0, 1);
      pa.setXYZ(i, p.x, a > 0 ? p.y : -50, p.z);
      _c.set(p.c); ca.setXYZ(i, _c.r * tint, _c.g * tint, _c.b * tintB);
    }
    pa.needsUpdate = true; ca.needsUpdate = true;
  }

  /* ── декор: полотно, бордюры, разметка, трава, ряды реквизита, дальний план, облака ── */
  function updGround(xw) {
    var i, n = 0, sp = 0.5, i0 = Math.floor((xw + XL) / sp), i1 = Math.floor((xw + XR) / sp);
    var red = '#e63946';
    for (i = i0; i <= i1 && n < 140; i++) {
      var x = i * sp - xw + sp / 2;
      if (inPit(x)) continue;
      _c.set(i % 2 ? '#ffffff' : red);
      M.curbF.setColorAt(n, _c); M.curbB.setColorAt(n, _c);
      put(M.curbF, n, x, 0.02, (ZF + ZC) / 2, sp * 0.98, 0.16, ZC - ZF);
      put(M.curbB, n++, x, 0.02, ZB - 0.11, sp * 0.98, 0.16, 0.22);
    }
    done(M.curbF, n); done(M.curbB, n);
    var dsp = 1.5; n = 0;
    for (i = Math.floor((xw + XL) / dsp); i <= Math.floor((xw + XR) / dsp) && n < 70; i++) {
      var dx = i * dsp - xw; if (inPit(dx)) continue;
      put(M.dash, n++, dx, 0.004, 1.35, 0.76, 0.01, 0.1);
    }
    done(M.dash, n);
    n = 0;                                          // пучки травы на ближней и дальней обочине (на тротуаре города — нет)
    var paved = !!(thRef && thRef.props && thRef.props.indexOf('loc_tower') >= 0);
    for (i = Math.floor((xw - 30) / 0.6); i <= Math.floor((xw + 60) / 0.6) && n < 160; i++) {
      var hx = hash(i);
      if (hx < 0.4) continue;
      var tx = i * 0.6 - xw + hx * 0.4, front = hash(i * 1.7) > 0.5;
      if (front && paved) continue;
      _c.set(thRef ? thRef.grass : '#6ab04c'); _c.multiplyScalar(0.8 + hx * 0.3);
      M.tuft.setColorAt(n, _c);
      put(M.tuft, n++, tx, 0, front ? ZC + 0.2 + hash(i * 2.3) * (ZE - ZC - 0.5) : ZB - 0.5 - hash(i * 2.3) * 1.2, 1 + hx, 1 + hx, 1, 0, hx * 3);
    }
    done(M.tuft, n);
    var pr0 = thRef && thRef.props || [], green = /^(house|tree|bush|daisies|fence)$/;   // цветы — только в зелёных темах
    var flowers = pr0.some(function (k) { return green.test(k); });
    var nearK = pr0.indexOf('loc_palm') >= 0 ? 'beach' : pr0.indexOf('loc_tower') >= 0 ? 'city' : pr0.indexOf('loc_fir') >= 0 ? 'winter' : '';
    if (nearK) nearProps(nearK, xw);
    if (flowers) for (i = Math.floor((xw - 20) / 1.1); i <= Math.floor((xw + 40) / 1.1); i++) {   // ромашки на ближней обочине
      if (hash(i * 8.3) < 0.45) continue;
      var vx = i * 1.1 - xw + hash(i * 1.9) * 0.7;
      p3('daisy', vx, ZC + 1.6 + hash(i * 6.1) * (ZE - ZC - 1.9), 0.4 + hash(i) * 0.1, Math.sin(T * 1.6 + i) * 0.05, (hash(i) - 0.5) * 0.6);
    }
    n = 0;                                          // камешки в срезе земли: без них торт плоский
    for (i = Math.floor((xw - 30) / 1.3); i <= Math.floor((xw + 50) / 1.3) && n < 40; i++) {
      var sx = i * 1.3 - xw + hash(i * 3.3) * 0.8, sy = -0.7 - hash(i * 5.7) * 1.4, ss = 0.2 + hash(i * 1.1) * 0.25;
      _c.set(sy < -1.3 ? '#5e3a22' : '#93603a'); M.stone.setColorAt(n, _c);
      put(M.stone, n++, sx, sy, ZE + 0.02, ss * 1.4, ss, ss, hash(i) * 2);
    }
    if (!flowers && nearK !== 'city') for (i = Math.floor((xw - 20) / 1.5); i <= Math.floor((xw + 40) / 1.5) && n < 80; i++) {   // без цветов (пляж, город, зима) — камушки и комья на обочине
      if (hash(i * 9.7) < 0.35) continue;
      var gx = i * 1.5 - xw + hash(i * 2.2) * 0.9, gs = 0.16 + hash(i * 4.9) * 0.22;
      _c.set(mix(thRef ? thRef.grass : '#6ab04c', '#2a2018', 0.12 + hash(i) * 0.2)); M.stone.setColorAt(n, _c);
      put(M.stone, n++, gx, 0.03, ZC + 0.8 + hash(i * 3.9) * (ZE - ZC - 1.1), gs * 1.3, gs * 0.8, gs * 3.2, 0, hash(i) * 3);
    }
    done(M.stone, n);
  }
  /* ближний план тем без цветов — та же плотность, что у ромашек; в городе полоса — тротуар со швами плиток */
  function nearProps(k, xw) {
    var i, n = 0, GT = 0.06;                         // верх травяной полосы: она на 6 см выше полотна
    for (i = Math.floor((xw - 20) / 1.1); i <= Math.floor((xw + 40) / 1.1); i++) {
      if (hash(i * 8.3) < 0.45) continue;
      var vx = i * 1.1 - xw + hash(i * 1.9) * 0.7, vz = ZC + 1.6 + hash(i * 6.1) * (ZE - ZC - 1.9), r = hash(i * 4.4), ry = (hash(i) - 0.5) * 1.2;
      if (k === 'beach') {
        if (r < 0.35) p3('shell', vx, vz, 0.16 + hash(i) * 0.06, 0, ry * 2, GT);
        else if (r < 0.6) p3('starfish', vx, vz, 0.09, 0, ry * 3, GT);
        else p3('palmlet', vx, vz - 0.3, 0.55 + hash(i) * 0.15, Math.sin(T * 1.4 + i) * 0.04, ry, GT);
      } else if (k === 'city') {
        if (r < 0.5) continue;                       // в городе реже: тротуар не свалка
        if (r < 0.7) p3('hydrant', vx, vz, 0.42, 0, ry, GT);
        else if (r < 0.88) p3('bench', vx, vz - 0.2, 0.42, 0, ry * 0.3, GT);
        else p3('lamp', vx, vz - 0.4, 0.85, 0, 0, GT);
      } else {
        if (r < 0.5) p3('drift', vx, vz, 0.22 + hash(i) * 0.1, 0, ry, GT);
        else if (r < 0.8) p3('fir', vx, vz - 0.3, 0.55 + hash(i) * 0.2, Math.sin(T * 1.2 + i) * 0.03, ry, GT);
        else p3('snowlump', vx, vz - 0.2, 0.55, 0, ry * 0.5, GT);
      }
    }
    if (k === 'city') {
      for (i = Math.floor((xw - 30) / 0.9); i <= Math.floor((xw + 60) / 0.9) && n < 110; i++)
        put(M.seam, n++, i * 0.9 - xw, 0.065, (ZC + ZE) / 2, 0.035, 0.01, ZE - ZC);
      for (i = 1; i < 3; i++) put(M.seam, n++, 15, 0.065, ZC + i * (ZE - ZC) / 3, 90, 0.01, 0.035);
    }
    done(M.seam, n);
  }
  var pits = [], pitN = 0;
  function inPit(x) { for (var k = 0; k < pitN; k += 2) if (x > pits[k] - 0.1 && x < pits[k + 1] + 0.1) return true; return false; }
  function collectPits() {
    pitN = 0;
    for (var i = 0; i < objs.length && pitN < 16; i++) {
      var o = objs[i]; if (o.t !== 'pit' || hidden(o)) continue;
      var x = X(o.x); pits[pitN++] = x - o.w * u / 2; pits[pitN++] = x + o.w * u / 2;
    }
  }

  /* дальний ряд спрайтов-реквизита (дома, деревья, коровы) и кусты у обочины — те же картинки, что в 2D */
  function updProps(xw) {
    var th = thRef, pr = th.props || ['house', 'tree'], i, sp = 4.6, zf = -4.2;
    /* высоты ряда в единицах: объёмные — в масштабе деревьев дальнего плана, спрайты — ×1,3 к 2D */
    var H3 = { house: 2.1, tree: 2.7, bush: 0.85, hay: 1.15, fence: 0.75, daisy: 0.5, fir: 2.9 };
    for (i = Math.floor((xw - 34) / sp); i <= Math.floor((xw + 54) / sp); i++) {
      var nm = pr[((i % pr.length) + pr.length) % pr.length];
      var x = i * sp - xw + hash(i) * 1.2, z = zf - hash(i * 1.3) * 1.4;
      if (propBusy3(x)) continue;
      var k3 = P3K[nm], hv = 0.9 + hash(i * 2.1) * 0.25;
      if (nm === 'fence') { p3fence(x, z + 0.6, H3.fence, 3); continue; }
      if (k3) {
        var s3 = p3(k3, x, z, H3[k3] * hv, k3 === 'tree' || k3 === 'fir' ? Math.sin(T * 1.1 + i) * 0.02 : 0, k3 === 'house' ? (hash(i * 7) - 0.5) * 0.5 : hash(i) * 6);
        if (k3 !== 'daisy') blob(x, z, BH[k3] * s3 * 0.5, 0.4);
        continue;
      }
      var hh = (PROP_H[nm] || 150) * 0.86 * 1.15 * 1.3 / 100;
      var w = bb(frameOf(nm, i), x, 0, z, hh, withMove(nm, i, hh * 100 * S, { alpha: 0.96 }));
      if (w) blob(x, z, w * 0.4, 0.35);
    }
    sp = 2.7;
    var bush3 = !th.props || th.props.indexOf('loc_fir') < 0 ? 'bush' : 'fir';
    for (i = Math.floor((xw - 20) / sp); i <= Math.floor((xw + 34) / sp); i++) {
      if (hash(i * 5.1) < 0.4) continue;
      var bx = i * sp - xw + hash(i * 2.9) * 0.8, bz = -2.25 - hash(i * 4.4) * 0.6;
      if (Math.abs(bx) < 1.4 || propBusy3(bx)) continue;
      p3(bush3, bx, bz, (bush3 === 'fir' ? 1.1 : 0.78) * (0.85 + hash(i) * 0.3), Math.sin(T * 1.4 + i) * 0.03, hash(i * 3) * 6);
    }
  }
  function propBusy3(x) {
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i]; if (o.t !== 'prop' && o.t !== 'traffic' && o.t !== 'rocket' && o.t !== 'rail') continue;
      if (Math.abs(X(o.x) - x) < 1.6) return true;
    }
    return false;
  }

  function updFar(xw) {
    var th = thRef, i, n;
    var hs = [[M.hill1, 9, -30, 6, th.h1], [M.hill2, 14, -55, 9.5, th.h2]];   // ниже, чем было: над ними видно небо и солнце
    for (var r = 0; r < 2; r++) {
      var im = hs[r][0], sp = hs[r][1], z0 = hs[r][2], sz = hs[r][3]; n = 0;
      for (i = Math.floor((xw - 70) / sp); i <= Math.floor((xw + 120) / sp) && n < 14; i++) {
        var hx = hash(i * 3.7 + r * 11), s = sz * (0.7 + hx * 0.6);
        _c.set(hs[r][4]); _c.multiplyScalar(0.92 + hx * 0.16); im.setColorAt(n, _c);
        put(im, n++, i * sp - xw + hx * sp * 0.5, -s * 0.4, z0 - hx * 6, s * 1.4, s * 0.95, s);
      }
      done(im, n);
    }
    /* Дальний план по теме. Смена темы — старый слой уходит за холмы, новый поднимается. */
    var A = thForce !== null ? THEMES[thForce % THEMES.length] : THEMES[themeFrom % THEMES.length];
    var B = thForce !== null ? A : THEMES[themeIx % THEMES.length], kk = thForce !== null ? 1 : themeK;
    M.sea.visible = (A.far === 'sea' && kk < 1) || B.far === 'sea';
    for (var key in FAR) {
      var rise = (key === B.far ? kk : 0) + (key === A.far && A.far !== B.far ? 1 - kk : 0);
      if (key === B.far && A.far === B.far) rise = 1;
      var fm = FAR[key];
      if (rise <= 0.001) { fm.count = 0; continue; }
      var drop = (1 - rise) * 9; n = 0;
      var cfg = key === 'peaks' ? [8, -34, 7] : key === 'dunes' ? [6, -20, 4] : key === 'sea' ? [16, -30, 2.5] : key === 'city' ? [2.3, -15, 1] : [3.2, -16, 1];
      for (i = Math.floor((xw - 40) / cfg[0]); i <= Math.floor((xw + 70) / cfg[0]) && n < fm.instanceMatrix.count; i++) {
        var h1 = hash(i * 1.9 + 3), h2 = hash(i * 2.7 + 5), fx = i * cfg[0] - xw + h1 * cfg[0] * 0.6, fz = cfg[1] - h2 * 7;
        if (key === 'city') {
          _c.set(['#f4a6a6', '#a6d1f4', '#f4e0a6', '#bfe8c2', '#d9c2f0'][Math.floor(h1 * 5)]);
          put(fm, n, fx, -drop * 1.6, fz, 1.7 + h2 * 1.2, 4 + h1 * 7, 1.6);
        } else if (key === 'peaks') {
          _c.setRGB(1, 1, 1); put(fm, n, fx, -drop * 2, fz, 5 + h1 * 4, 5 + h2 * 4.5, 5 + h1 * 2);   // ниже, чтобы над ними оставалось небо с солнцем
        } else if (key === 'dunes') {
          _c.set(th.h1); _c.multiplyScalar(0.95 + h2 * 0.1); put(fm, n, fx, -1.4 - drop, fz, 4 + h1 * 3, 1.8 + h2, 3);
        } else if (key === 'sea') {
          _c.setRGB(1, 1, 1); put(fm, n, fx, -0.6 - drop, fz - 20, 3 + h1 * 3, 1.4 + h2, 3);
        } else {
          _c.set(th.h1); _c.lerp(_c2.setRGB(1, 1, 1), 0.65);
          var ts = 1.1 + h2 * 0.9; put(fm, n, fx, -drop, fz, ts, ts * (0.9 + h1 * 0.4), ts, 0, h1 * 6);
        }
        fm.setColorAt(n++, _c);
      }
      done(fm, n);
    }
    n = 0;                                          // облака: свой ветер, как в 2D
    var cw = xw * 0.35 + T * 0.4;
    for (i = Math.floor((cw - 60) / 11); i <= Math.floor((cw + 90) / 11) && n < 12; i++) {
      var c1 = hash(i * 4.1), c2 = hash(i * 6.3);
      _c.setRGB(tint, tint, tintB); M.cloud.setColorAt(n, _c);
      put(M.cloud, n++, i * 11 - cw + c1 * 5, 12 + c2 * 7, -45 - c1 * 20, 1.0 + c2 * 0.6, 0.7 + c1 * 0.3, 1);
    }
    done(M.cloud, n);
    var sunIm = IMG.sun;
    M.sun.visible = !!th.sun && ok(sunIm) && night < 0.6;
    if (M.sun.visible) {
      if (mats.sun.map !== texOf(sunIm)) { mats.sun.map = texOf(sunIm); mats.sun.needsUpdate = true; }
      /* Солнце целиком в кадре, в правой верхней трети: точка экрана → луч камеры на глубине d
         (ось камеры приходит в (CARX, GY) — см. updCam). */
      cam.updateMatrixWorld();
      var d = 150, kk2 = 2 * d * Math.tan(cam.fov * Math.PI / 360) / H, sh2 = H * 0.17 * kk2;
      _v.set((W * 0.72 - CARX) * kk2, (GY - H * 0.12) * kk2, -d); cam.localToWorld(_v);
      M.sun.position.copy(_v); M.sun.quaternion.copy(cam.quaternion);
      M.sun.scale.set(sh2 * iw(sunIm) / ih(sunIm), sh2, 1); mats.sun.opacity = 1 - night;
      M.halo.position.copy(_v).addScaledVector(_v.sub(cam.position).normalize(), 2); M.halo.quaternion.copy(cam.quaternion);
      M.halo.scale.set(sh2 * 3, sh2 * 3, 1); mats.halo.opacity = 0.9 * (1 - night);
    }
    M.halo.visible = M.sun.visible;
  }

  /* ── палитра: небо, туман, свет, трава, асфальт — от TH(); он уже плавно смешивает темы ── */
  function updTheme() {
    var th = TH(), nq = Math.round(night * 40) / 40;
    if (th === thRef && nq === nightRef) return;
    thRef = th; nightRef = nq;
    var nk = nq * 0.84, NB = '#0b1030';
    var sc = ctex.sky.getContext('2d'), gr = sc.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, mix(th.sky[0], NB, nk)); gr.addColorStop(0.55, mix(th.sky[1], NB, nk)); gr.addColorStop(1, mix(th.sky[2], NB, nk));
    sc.fillStyle = gr; sc.fillRect(0, 0, 2, 256); ctex.skyT.needsUpdate = true;
    fog.color.set(mix(th.sky[2], NB, nk));
    mats.road.color.set(th.road[0]);
    mats.grass.color.set(mix(th.grass, th.sky[2], 0.12)); mats.grassF.color.set(th.grass); mats.lip.color.set(mix(th.grass, '#000000', 0.22));
    hemi.color.set(th.sky[1]); hemi.groundColor.set(th.grass);
    tint = 1 - nk * 0.72; tintB = 1 - nk * 0.55;
  }

  /* ── машинка: те же преобразования, что drawCar()/drawRig() в 2D ── */
  function updCar() {
    var h = car.h * S, g0 = car3.g, rigged = car.rig && !carPaint && damage === 0 && !!rigSize(car, h);
    g0.position.set(0, (carY - squash * 12 * S) * u, 0);
    g0.rotation.set(0, 0, -(tilt - flipT * TAU * (car.id === 'race' ? 1 : 0.6)));
    g0.scale.set(1 + squash * 0.5, 1 - squash * 0.5, 1);
    var b = car3.body;
    if (rigged) {
      var z = rigSize(car, h), RG = car.rig, d = z.d * u, bh = z.bh * u, bw = z.bw * u;
      var tI = lazyImg(RG.tire);
      setMap(b, z.im); b.scale.set(bw, bh, 1);
      var py = d * RG.lift + bodyDy * u + 0.35 * bh;
      b.rotation.z = bodyPitch;
      b.position.set(-Math.sin(bodyPitch) * 0.15 * bh, py + Math.cos(bodyPitch) * 0.15 * bh, 0.03);   // центр кузова от оси подвески
      var tw = ok(tI) ? d * iw(tI) / ih(tI) : d, tt = [car3.t1, car3.t2];
      for (var i = 0; i < 2; i++) {
        var m = tt[i]; m.visible = ok(tI) && !(noWheels && i < Math.min(2, missWheels));
        if (!m.visible) continue;
        setMap(m, tI); m.scale.set(tw, d, 1);
        m.position.set((RG.at[i] - 0.5) * bw, d * RG.lift, 0); m.rotation.z = -wheelA;
      }
    } else {
      var im = imgOf(car.id);
      car3.t1.visible = car3.t2.visible = false;
      if (!ok(im)) { b.visible = false; return; }
      b.visible = true; setMap(b, im);
      var w = iw(im) * (h / ih(im)) * u, hh = h * u;
      b.scale.set(w, hh, 1); b.rotation.z = bodyPitch;
      var cy = bodyDy * u + hh * 0.5;                 // 2D: поворот на −bodyPitch, потом спрайт низом на −bodyDy
      b.position.set(-Math.sin(bodyPitch) * cy, Math.cos(bodyPitch) * cy, 0.03);
    }
    b.visible = true;
    var cs = tint; b.material.color.setRGB(cs, cs, tintB); car3.t1.material.color.setRGB(cs, cs, tintB); car3.t2.material.color.setRGB(cs, cs, tintB);
    /* мигалка: 2,5 смены в секунду — правило проекта «не чаще трёх» */
    if (sirenT > 0 && car.siren) {
      var on = Math.floor(sirenT * 5) % 2, sw = vehW(car.id, h) * u;
      _v.set(-sw * 0.1, h * u * 1.02, 0.1); g0.localToWorld(_v);
      lamp(_v.x, _v.y, _v.z, 0.12, on ? '#ff2d55' : '#2d7dff');
      glow(_v.x, _v.y, _v.z + 0.05, 0.6, 0.45);
    }
    /* фары ночью: настоящий конус света вместо 2D-заливки */
    var lit = lights && night > 0.01, fx = vehW(car.id, h) * u * 0.42, fyy = h * u * 0.42;
    _v.set(fx, fyy, 0.05); g0.localToWorld(_v);
    spot.intensity = lit ? 60 * night : 0;
    spot.position.copy(_v); spot.target.position.set(_v.x + 8, 0, 0.4);
    M.beam.visible = lit;
    if (lit) { M.beam.position.copy(_v); M.beam.scale.set(6.5, 1.5, 0.9); M.beam.rotation.set(0, 0, -0.06 - tilt); mats.beam.opacity = 0.1 * night; }
    if (lit) glow(_v.x + 0.05, _v.y, _v.z + 0.02, 0.45, 0.9 * night);
    /* настоящая тень от машинки: свет сбоку-сверху-спереди, теневая камера едет за ней */
    sun.position.set(-2.2, 9, 5.2 + 0 * carY); sun.target.position.set(0, carY * u * 0.3, 0);
    sun.intensity = P3.sun * (1 - night * 0.85); hemi.intensity = P3.hemi * (1 - night * 0.7);
  }

  function updRobot() {
    if (!robot.on) return;
    var x = X(robot.x);
    if (x < -14 || x > 30) return;
    blob(x, -0.3, 0.9, 0.3);
    bb('robot', x, (Math.abs(Math.sin(T * 8)) * 6 * S - 6 * S) * u, -0.3, 205 * S * u, { rot: Math.sin(T * 6) * 0.035 });
  }

  /* ── камера: штанга, машинка на CARX (упреждение 20 %), по вертикали ждёт посадки ── */
  function updCam(dt) {
    var fov = P3.fov, th = P3.pitch;
    var D = H / (200 * S * Math.tan(fov * Math.PI / 360));        // в плоскости игры 100·S px на единицу
    var want = grounded ? (ghRamp ? 0 : carY * u * P3.camY) : camYs;   // на трамплине и в воздухе — стоит
    camYs += (want - camYs) * (1 - Math.exp(-P3.camK * dt));
    cam.fov = fov; cam.aspect = W / H;
    cam.position.set(0, camYs + D * Math.sin(th), D * Math.cos(th));
    cam.rotation.set(-th, 0, 0);
    /* Опорная точка (машинка, уровень камеры) встаёт ровно в (CARX, GY), как в 2D. Поверх —
       то же преобразование, что у 2D-холста (зум урока, тряска): частицы и рамки совпадают. */
    var ox = W / 2 - CARX, oy = H / 2 - GY;
    var mt = g.getTransform(), a = mt.a / DPR, e = mt.e / DPR, f = mt.f / DPR;
    if (!(a > 0.01)) { a = 1; e = 0; f = 0; }
    cam.setViewOffset(W, H, ox - e / a, oy - f / a, W / a, H / a);
    cam.updateProjectionMatrix();
    dyPx = camYs / u;
  }

  function render() {
    if (!ensure()) return;
    var t0 = performance.now(), dt = lastNow ? Math.min(0.1, (t0 - lastNow) / 1000) : 0.016;
    lastNow = t0;
    R3D.frame(P3.dpr);
    try {
      frameId++;
      u = 1 / (100 * S);
      bbN = 0; glN = 0; miN = 0; nB = 0; for (var k3 in P3N) n3[k3] = 0;
      updTheme();
      R.setClearColor(fog.color);
      var xw = carX * u;
      collectPits();
      updCam(dt);
      updGround(xw);
      updFar(xw);
      updProps(xw);
      updObjs();
      checkStars(dt);
      drawPops(dt, M.star.count);
      updRobot();
      updCar();
      if (grounded && !wasGround) burst(0, 0.05, 0.3, 12, '#e8e0cd', 1.9, 0.5);   // пыль при посадке (2D-клубы в 3D не рисуются)
      wasGround = grounded;
      updPts(dt);
      for (var i = bbN; i < pool.length; i++) pool[i].visible = false;
      for (i = glN; i < glows.length; i++) glows[i].visible = false;
      for (i = miN; i < misc.length; i++) misc[i].visible = false;
      done(M.blob, nB); p3done();
      R.render(scene, cam);
    } catch (e) { if (window.__p3err === undefined) window.__p3err = String(e && e.stack || e); fail(); return; }
    ms = performance.now() - t0;
  }

  function ensure() {
    if (st === 2) return true;
    if (st === -1 || !P3.on) return false;
    if (R3D.dead()) { st = -1; return false; }
    if (!R3D.ready()) { R3D.load(); return false; }
    TT = R3D.T(); R = R3D.renderer();
    if (!R) { st = -1; return false; }
    try { build(); st = 2; } catch (e) { window.__p3err = String(e && e.stack || e); fail(); }
    return st === 2;
  }
  function fail() { st = -1; }
  function release() {
    if (st !== 2) return;
    try {
      scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      tex.forEach(function (t) { t.dispose(); }); for (var k in ctex) if (ctex[k].dispose) ctex[k].dispose();
    } catch (e) {}
    tex = new Map(); ctex = {}; pool = []; glows = []; misc = []; M = {}; mats = {}; FAR = {}; car3 = {};
    R = null; scene = null; thRef = null; nightRef = -1; st = 0;
  }
  R3D.use({ lost: fail, release: release });
  return {
    on: function () { return !!P3.on && st !== -1 && ensure(); },
    render: render,
    dy: function () { return dyPx; },
    stats: function () {
      return R && st === 2 ? { st: st, calls: R.info.render.calls, tris: R.info.render.triangles, ms: +ms.toFixed(2), dpr: R3D.dpr(), bb: bbN }
                           : { st: st, err: window.__p3err || null };
    }
  };
})();

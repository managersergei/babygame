/* ═══════════════ 9. БЕНЗИН ═══════════════ */
function refuel() {
  fuel = 1; outOfFuel = false; emptyShown = false; lowT = 0; refuels++;
  spd = (easy ? EASYSPD : CRUISE) * 0.7;
  flash = 0.3;
  A.fuelUp(); A.say('Поехали!');
  burst(carX, carY + car.h * S * 0.5, 26, ['#ff4d4d','#ffd93d','#fff'], 320 * S, 'spark');
  popText('ПОЛНЫЙ БАК!', carX, carY + car.h * S, '#ffd93d');
  spawnFuel(carX + 760 * S);
  setPad();
}

function drawFuelBar() {
  var x = 26 * S, y = 26 * S, h = 40 * S, w0 = 300 * S, ix = x + 34 * S;
  /* Ширину считаем ДО отрисовки: раньше подложка и колба рисовались по старой ширине,
     а заливка и обводка по новой — шкала выглядела сломанной. */
  var w = tankMul > 1 ? Math.min(w0 * tankMul, W * 0.34) : w0;
  /* Мало бензина ребёнок узнаёт не по надписи (он её не читает), а по тому,
     что канистра начинает подпрыгивать. Движение объекта возрасту разрешено, мигание — нет. */
  spr('fuel', ix, y + h + 18 * S, 84 * S,
      (fuel < 0.25 && !outOfFuel) ? { dy: -Math.abs(Math.sin(T * 4)) * 10 * S } : {});
  var bx = x + 76 * S;
  g.save();
  g.fillStyle = 'rgba(20,25,40,.35)'; roundRect(bx - 4*S, y - 4*S, w + 8*S, h + 8*S, (h+8*S)/2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.45)'; roundRect(bx, y, w, h, h/2); g.fill();
  var f = clamp(fuel, 0, 1);
  var col = f > 0.5 ? '#4ade80' : f > 0.25 ? '#ffd93d' : '#ff4d4d';
  if (f < 0.25) g.globalAlpha = 0.7 + Math.abs(Math.sin(T * 3.4)) * 0.3;   // 1,1 Гц: было 2,2 — впритык к возрастному порогу
  if (f > 0.005) {
    var grd = g.createLinearGradient(bx, y, bx, y + h);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.25, col); grd.addColorStop(1, col);
    g.fillStyle = grd;
    roundRect(bx, y, Math.max(h * 0.5, w * f), h, h / 2); g.fill();
  }
  g.globalAlpha = 1;
  g.lineWidth = 4 * S; g.strokeStyle = '#ffffff';
  roundRect(bx, y, w, h, h / 2); g.stroke();
  /* Рост бака — насечками внутри шкалы, а не подписью «×1.1»: цифру ребёнок не читает,
     а крупная надпись за краем шкалы выглядела приклеенной. */
  var lv = Math.round((tankMul - 1) / 0.12);
  for (var q = 1; q <= lv && q <= 6; q++) {
    /* Насечка — прежняя граница бака: первая на краю исходного, каждая следующая — перед
       своим апгрейдом. Участок справа от последней и есть «вот сколько прибавилось». */
    var nx = bx + w0 * (1 + 0.12 * (q - 1));
    if (nx > bx + w - 6 * S) break;
    g.fillStyle = 'rgba(122,75,0,.45)';
    roundRect(nx, y + h * 0.28, 3 * S, h * 0.44, 1.5 * S); g.fill();
  }
  g.restore();

  if (f < 0.25 && !outOfFuel) {          // надпись для взрослого — спокойная, мигает уже сама шкала
    g.save(); g.globalAlpha = 0.85;
    outText('МАЛО БЕНЗИНА!', bx + w0 * 0.5, y + h + 30 * S, 26 * S, '#fff', '#c0392b');
    g.restore();
  }
}

function drawEmptyScreen() {
  g.save();
  g.fillStyle = 'rgba(15,25,45,.62)'; g.fillRect(0, 0, W, H);
  var bob = Math.sin(T * 2.2) * 10 * S;
  spr('fuel', W / 2, H * 0.60 + bob, 220 * S);
  outText('БЕНЗИН ЗАКОНЧИЛСЯ!', W / 2, H * 0.24, 60 * S, '#fff', '#c0392b');
  /* Счёт звёзд — иконкой и числом, как в HUD: слово «звёздочек» ребёнок не прочтёт. */
  g.save();
  g.font = '900 ' + (46 * S) + 'px "Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif';
  var stw = g.measureText(String(stars)).width;
  g.restore();
  spr('star', W / 2 - stw / 2 - 34 * S, H * 0.335 + 14 * S, 58 * S);
  outText(String(stars), W / 2 + 20 * S, H * 0.335, 46 * S, '#ffd93d', '#7a4b00', 'right');
  g.globalAlpha = 0.55 + Math.sin(T * 4.5) * 0.45;
  outText(KEYW('ЗАПРАВИТЬСЯ!'), W / 2, H * 0.74, 44 * S, '#fff', '#e0691f');
  g.restore();
}


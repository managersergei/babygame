/* ═══════════════ 8. ДЕЙСТВИЕ (ПРОБЕЛ) ═══════════════ */
function action() {
  A.init(); idleT = 0; idleN = 0;
  if (outOfFuel) { refuel(); return; }
  var cw = vehW(car.id, car.h * S);
  if (jumps < 2) {
    jumps++;
    vy = jumps === 1 ? JUMP1 : JUMP2;
    grounded = false; squash = -0.16;
    if (!story && robot.on && !robot.flee) spd = Math.min(VMAX * 1.2, spd + 150 * S);
    if (jumps === 2) {
      flipT = (car.id === 'monster') ? 0 : 1;           // монстр-трак сальто не крутит
      if (car.id === 'race') {                          // у Молнии — электро-разряд
        flash = 0.25; A.rev(); A.whee();
        spd = Math.min(VMAX * 1.35, spd + 300 * S);
        popText('МОЛНИЯ!', carX, carY + car.h * S * 1.3, '#ffd93d');
        for (var z = 0; z < 30; z++)
          P({ x: carX + rnd(-50, 50) * S, y: carY + rnd(0, 90) * S, vx: rnd(-420, 420) * S,
              vy: rnd(-120, 320) * S, r: rnd(6, 16) * S,
              c: pick(['#ffd93d', '#fff7b0', '#7fd8ff', '#fff']), kind: 'spark',
              life: rnd(0.35, 0.8), ay: 260 * S, vr: rnd(-14, 14) });
      }
    }
    A.jump();
    for (var i = 0; i < 12; i++)
      P({ x: carX + rnd(-cw*0.3, cw*0.3), y: carY + rnd(0, 20*S), vx: rnd(-90,90)*S, vy: rnd(20,150)*S,
          r: rnd(6,15)*S, c:'#ffffff', kind:'dot', life: rnd(0.3,0.6), ay: 200*S });
  }
  doFx(cw);
}

function doFx(cw) {
  if (fxT > 0.1) return;                          // третье нажатие подряд играло полную сирену поверх предыдущей
  fxT = 0.55; sirenT = car.siren ? 1.4 : 0;
  var bx = carX - cw * 0.42;

  switch (car.fx) {
    case 'dust':
      A.rev();
      for (var i = 0; i < 22; i++)
        P({ x: carX + rnd(-cw*0.45, cw*0.45), y: rnd(0, 30*S), vx: rnd(-260,-40)*S, vy: rnd(40,220)*S,
            r: rnd(10,26)*S, c: pick(['#e3d3b8','#cbb894','#f0e6d2']), kind:'puff',
            life: rnd(0.5,1.0), ay: -60*S });
      break;
    case 'water':
      A.siren(); A.splash();
      for (var j = 0; j < 34; j++)
        P({ x: carX + cw*0.42, y: carY + car.h*S*0.65, vx: rnd(280,760)*S, vy: rnd(120,430)*S,
            r: rnd(5,13)*S, c: pick(['#4fc3f7','#81d4fa','#ffffff','#29b6f6']), kind:'drop',
            life: rnd(0.6,1.1) });
      break;
    case 'boost':
      A.rev(); A.whee();
      if (!easy) spd = Math.min(VMAX * 1.25, spd + 320 * S);
      for (var k = 0; k < 26; k++)
        P({ x: bx, y: carY + rnd(20, car.h*S*0.5), vx: rnd(-720,-260)*S, vy: rnd(-60,120)*S,
            r: rnd(8,22)*S, c: pick(['#ffd93d','#ff8f1f','#ff4d1f','#fff3b0']), kind:'puff',
            life: rnd(0.3,0.6), ay: -180*S });
      break;
    case 'lights':
      A.siren();
      break;
    case 'smoke':
      A.clunk();
      for (var m = 0; m < 16; m++)
        P({ x: carX + rnd(-cw*0.2, cw*0.1), y: carY + car.h*S*0.95, vx: rnd(-70,50)*S, vy: rnd(120,300)*S,
            r: rnd(12,28)*S, c: pick(['#b9c0cc','#d8dee8','#9aa3b2']), kind:'puff',
            life: rnd(0.7,1.3), ay: -140*S });
      break;
    case 'dirt':
      A.clunk();
      for (var n = 0; n < 20; n++)
        P({ x: carX + cw*0.35, y: carY + 30*S, vx: rnd(120,520)*S, vy: rnd(180,520)*S,
            r: rnd(6,16)*S, c: pick(['#8b5a2b','#a9752f','#6d4520']), kind:'dot', life: rnd(0.5,0.9) });
      break;
    default:
      A.honk();
      for (var p = 0; p < 6; p++)
        P({ x: carX + cw*0.4, y: carY + car.h*S*0.7, vx: rnd(60,220)*S, vy: rnd(90,220)*S,
            r: rnd(18,28)*S, c:'#fff', kind:'note', life: rnd(0.6,1.0), ay: -50*S, vr: rnd(-4,4) });
  }
}


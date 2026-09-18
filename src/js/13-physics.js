/* ═══════════════ 10. ФИЗИКА ═══════════════ */
function updatePlay(dt) {
  var cw = vehW(car.id, car.h * S), ch = car.h * S;

  /* --- скорость --- */
  if (stopHold > 0) {
    stopHold -= dt; spd = 0;
    if (stopHold <= 0) {
      var tl = findObj('tlight'); if (tl) tl.green = true;
      A.say('Зелёный свет! Поехали!'); finishLine(); armCommands();
    }
  } else if (finishing) {
    spd = Math.max(0, spd - 520 * S * dt);
    if (spd < 14 * S && celebrate < 1.2) { finishing = false; toResult(); return; }
  } else if (outOfFuel) {
    spd = Math.max(0, spd - 190 * S * dt);            // катимся по инерции
    if (spd < 6 * S && !emptyShown) {
      if (story && stageFired && !learned.fuel && curStage().lesson === 'fuel') { toLesson('fuel'); return; }
      if (!story) { gameOver('fuel'); return; }
      emptyShown = true; A.say('Бензин закончился!'); setPad();
    }
    if (spd > 20 * S && RNG() < dt * 8)
      P({ x: carX - cw * 0.4, y: carY + ch * 0.5, vx: rnd(-160,-40)*S, vy: rnd(60,180)*S,
          r: rnd(10,22)*S, c: pick(['#9aa3b2','#c8cfda']), kind:'puff', life: rnd(0.5,0.9), ay: -120*S });
  } else if (easy) {
    spd += (EASYSPD - spd) * Math.min(1, dt * 1.6);
  } else {
    if (K.right)      spd += ACC * dt;
    else if (K.left)  spd -= BRK * dt;
    else              spd += (CRUISE - spd) * Math.min(1, dt * 1.2);
    spd = clamp(spd, 26 * S, VMAX * 1.3);
    if (K.left && spd < CRUISE * 0.55 && RNG() < dt * 3) A.skid();   // clunk означает поломку — торможение так звучать не должно
  }
  carX += spd * dt;
  if (car.rig) {                                  // угол колеса = путь / радиус, без подгонки
    var rr = vehW(car.id, car.h * S) * car.rig.tire2 * 0.5;
    if (rr > 1) wheelA += (spd * dt) / rr;
  }

  /* --- расход бензина --- */
  var scripted = story && curStage().t === 'fuelrun' && stageSub >= 1 && stageSub <= 3;
  if (!outOfFuel && !scripted) {
    fuel -= (spd * dt) / FUELDIST + dt * 0.005;
    if (fuel < 0.25) {
      beepT -= dt;
      /* Писк не лезет поверх речи: диктор говорит — тревога ждёт. К нулю интервал
         сжимается до 0,35 с, это ускорение, а не мигание. */
      if (beepT <= 0 && !A.talking()) { var kb = 1 - clamp(fuel / 0.25, 0, 1); A.beep(kb); beepT = 0.9 - kb * 0.55; }
      /* Один раз на бак сказать словами — писк сам по себе ребёнку ничего не объясняет.
         Не перебиваем ни урок, ни другую реплику. */
      if (!lowT && state === 'play' && !A.talking()) { lowT = 1; A.say('Мало бензина!'); }
    }
    if (fuel <= 0) {
      fuel = 0; outOfFuel = true; jumps = 0;
      A.sputter(); A.engine(0, 1, false);
    }
  }

  /* --- прыжок/земля --- */
  var gh = groundHeightAt(carX, carY);
  var ghWasRamp = ghRamp;
  if (!grounded) {
    vy -= GRAV * dt;
    carY += vy * dt;
    if (carY <= gh) {
      var hard = vy < -1150 * S;   // одиночный прыжок даёт ~-830*S: при пороге 640 тряслось после каждого
      carY = gh; vy = 0; grounded = true; jumps = 0; squash = 0.26;
      A.land();
      if (hard) A.thud();                    // тяжёлая посадка должна и звучать тяжело
      if (hard) shake = 5 * S;
      for (var i = 0; i < (hard ? 20 : 9); i++)
        P({ x: carX + rnd(-cw*0.4, cw*0.4), y: gh + 4*S, vx: rnd(-300,300)*S, vy: rnd(60,260)*S,
            r: rnd(7,19)*S, c: pick(['#e6ddc9','#cfc4ab','#fff']), kind:'puff',
            life: rnd(0.35,0.75), ay: -40*S });
    }
  } else {
    if (gh > lastGroundH + 0.01) carY = gh;
    else if (lastGroundH > 6 * S && gh <= 0.01) {
      grounded = false; jumps = 1;
      if (lastWasRamp) { vy = clamp(spd * 0.72, 380 * S, 1050 * S); A.whee();
                         burst(carX, 10 * S, 14, ['#fff','#ffe9a8'], 260 * S, 'puff'); }
      else vy = 0;                                   // просто съехали с платформы
    } else carY = gh;
  }
  lastGroundH = gh; lastWasRamp = ghWasRamp;

  /* --- анимация --- */
  var rel = clamp(spd / VMAX, 0, 1.3);
  wobble += dt * (7 + rel * 26);
  squash += (0 - squash) * Math.min(1, dt * 8);
  /* Наклон на земле теперь берётся из уклона ПОД КОЛЁСАМИ, а не из синусоиды:
     на трамплине нос честно задирается, на съезде опускается. Синусоида осталась
     мелкой дрожью поверх — это «работа мотора», а не рельеф. */
  var halfBase = cw * 0.34;
  var hFront = groundProbe(carX + halfBase, carY), hRear = groundProbe(carX - halfBase, carY);
  var slope = Math.atan2(hRear - hFront, halfBase * 2);
  var wantTilt = grounded ? clamp(slope, -0.32, 0.32) + Math.sin(wobble) * 0.010 * rel   // 18°: замер давал 25° и это читалось как опрокидывание
                          : clamp(-vy / (3000 * S), -0.3, 0.3);
  tilt = lerp(tilt, wantTilt, Math.min(1, dt * 10));

  if (grounded && rel > 0.45 && RNG() < dt * 26)
    P({ x: carX - cw * 0.35, y: 6 * S, vx: rnd(-260,-60)*S, vy: rnd(20,110)*S, r: rnd(6,16)*S,
        c: pick(['#e8e0cd','#d4c9ae']), kind:'puff', life: rnd(0.3,0.6), ay: -50*S });

  A.engine(spd, VMAX, !outOfFuel);

  if (!story && !metEl.jump0) {                  // первый урок — прыжок
    runT += dt;
    if (runT > 5) {
      metEl.jump0 = 1; runT = 0;
      if (Stats.canTeach('ПРЫЖОК')) { toLesson('el_jump0'); return; }
    }
  } else if (!story && !metEl.gas0 && nextLessonKey() === 'gas0') {   // сразу следом — газ
    runT += dt;
    if (runT > 16) {
      metEl.gas0 = 1;
      if (Stats.canTeach('ГАЗ')) { toLesson('el_gas0'); return; }
    }
  }

  railT += dt;                                   // очень редко — железнодорожный переезд
  if (!story && railT > 95 && stars > 20) { railT = 0; objs.push({ t:'rail', x: obsMark(obsFrom(carX + W * 1.6)) }); }

  rocketT += dt;                                 // на фоне периодически стартует ракета
  if (rocketT > 40) { rocketT = 0; objs.push({ t:'rocket', x: carX + W * 1.3, h: 0, wait: rnd(2.5, 5) }); }
  for (var ri2 = 0; ri2 < objs.length; ri2++) {
    var ro = objs[ri2];
    if (ro.t !== 'rocket') continue;
    if (!ro.met && (ro.x - carX) < W * 0.6) { ro.met = 1; markFirst(ro, 'rocket'); }
    if (ro.wait > 0) { ro.wait -= dt; if (ro.wait <= 0) { A.rev(); ro.up = 1; } }
    else if (ro.up) {
      ro.h = (ro.h || 0) + (60 + ro.h * 1.6) * S * dt;
      if (ro.h > H * 1.3) { objs.splice(ri2, 1); ri2--; }   // улетела — убираем вместе с площадкой
    }
  }

  skyT += dt;                                    // в небе кто-то пролетает
  if (skyT > rnd(11, 20)) {
    skyT = 0;
    if (wantEl === 'butterfly') {
      objs.push({ t:'butterfly', x: carX + W * 1.05, y: rnd(H * 0.28, H * 0.46), ph: 0 });
    } else if (wantEl === 'cloud') {
      var oc = { t:'cloudy', x: carX + W * 1.05, y: rnd(H * 0.10, H * 0.26), ph: 0, sp: rnd(15, 35) * S };
      objs.push(oc); markFirst(oc, 'cloud');
    } else {
      var isPlane = wantEl === 'plane' ? true : wantEl === 'bird' ? false : RNG() < 0.45;
      objs.push({ t: isPlane ? 'plane' : 'bird', x: carX + W * 1.1,
                  y: rnd(H * 0.12, H * 0.34), ph: rnd(0, TAU), sp: rnd(30, 90) * S });
    }
  }

  noteStars();                                   // рекорд обновляется на лету, «РЕКОРД!» — один раз за заезд
  /* Подсказка при простое. Раньше она долбила одну фразу каждые 15 секунд и
     срабатывала даже у активного ребёнка: idleT рос от времени, а не от безделья.
     Теперь его обнуляет любое действие, а интервал растёт: 15 → 24 → 38 с. */
  idleT += dt;
  if (idleT > 15 + idleN * 9 && !A.talking() && !emptyShown && idleN < 3) {
    idleT = 0; idleN++;
    A.say(voiceCtl && learned.jump ? 'Скажи прыжок — и машинка подпрыгнет!'
                                   : 'Нажимай пробел — машинка подпрыгнет!');
  }

  /* --- сценарий голосового режима --- */
  updateStage(dt);
  /* Ночь ведём к цели в обе стороны: наплыв был плавным, а рассвет — рубленым
     кадром (night = 0 в один присест). Теперь светает за те же ~1,3 секунды. */
  if (Math.abs(night - nightTo) > 0.002) {
    night += (nightTo - night) * Math.min(1, dt * 1.6);
    if (nightTo > 0 && night >= 0.9 && story && !learned.light && curStage().lesson === 'light') { toLesson('light'); return; }
  } else night = nightTo;

  if (!story) {                                        // ритм бесконечного режима: слово важнее робота
    if (wordDue <= 0 || robotDue <= 0) resetRhythm();  // старт мимо beginStage (?s=play)
    wordT += dt;
    if (wantEl) {                                    // заказ висит — дорога должна показать предмет
      wantT += dt;
      if (wantT > 5 && !wordArmed) forceSpawn(wantEl);   // не выпало само — ставим сами
      if (wantT > 12) wantEl = null;                     // и совсем не вышло — забываем
    }
    if (wordArmed && !armedObj()) wordArmed = false;                       // тег потерян — не ждём
    var nk = nextLessonKey();
    robotSoon = (nk === 'robot' && wordT >= wordDue - TUNE.monQuiet)
             || (!nk && !robot.on && robotT >= robotDue - TUNE.monQuiet);
    if (nk && nk !== 'jump0' && nk !== 'gas0' && !wantEl && !wordArmed && !robot.on
        && wordT >= wordDue - (nk === 'robot' ? 0 : TUNE.wordLead)) {
      orderWord(nk);
      if (state !== 'play') return;                    // слово РОБОТ начало урок прямо сейчас
    }
    if (!robot.on && !wantEl && !wordArmed) {          // робот идёт по своему таймеру всегда,
      robotT += dt * (nk ? 1 / TUNE.robotIdle : 1);     // но пока есть чему учиться — вдвое медленнее
      if (robotT >= robotDue && unlockedNow().robot && state === 'play') startChase(false);
    }
    if (robot.on && !robot.flee) {
      robot.life += dt;
      /* Пассивный ребёнок раньше проигрывал ВСЕГДА: робот идёт 350*S/с, крейсерская
         машинка — 235*S/с, разрыв в 760*S закрывался за 6,6 с при погоне в 14 с.
         И за эти шесть секунд ему ни разу не говорили, что делать. */
      if (robot.life > 1.4 && !robot.told && !A.talking()) { robot.told = 1; A.say('Скорее, жми газ!'); }
      if (carX - robot.x < 40 * S) { gameOver('robot'); return; }
      if (robot.life > TUNE.robotLife || carX - robot.x > 1500 * S) {
        robot.flee = true; A.cheer();
        A.say('Я тебя ещё потом догоню!');
      }
    }
  }
  A.tense(robot.on && !robot.flee);            // погоня слышна, а не только видна
  if (robot.on) {
    // робот едет со своей скоростью: на полном газу от него можно уехать
    /* Вплотную робот сбавляет: угроза остаётся, но проигрыш перестаёт быть неизбежным. */
    var rs = robot.flee ? -420 * S
           : (story ? spd + 62 * S
                    : (carX - robot.x < 300 * S ? spd + 30 * S : EASYSPD * TUNE.robotSpeed));
    robot.x += rs * dt;
    if (robot.flee && carX - robot.x > W * 1.3) robot.on = false;
    if (!robot.flee && RNG() < dt * 8)
      P({ x: robot.x, y: rnd(40, 150) * S, vx: rnd(-140, -30) * S, vy: rnd(30, 120) * S, r: rnd(4, 10) * S,
          c: pick(['#ff6b6b', '#ffd93d']), kind: 'spark', life: rnd(0.3, 0.6), ay: 200 * S });
  }

  /* --- обещанный прыжок через яму --- */
  if (autoJump) {
    for (var ai = 0; ai < objs.length; ai++) {
      var ao = objs[ai];
      if (ao.t === 'pit' && carX > ao.x - 300 * S) { autoJump = false; action(); break; }
    }
  }

  /* --- объекты --- */
  spawnAhead();
  var bx0 = carX - cw * 0.36, bx1 = carX + cw * 0.36;
  var by0 = carY + 6 * S,     by1 = carY + ch * 0.92;

  for (var q = objs.length - 1; q >= 0; q--) {
    var o = objs[q];
    if (o.x < carX - W * 0.7) { objs.splice(q, 1); continue; }
    o.ph = (o.ph || 0) + dt;
    if (o.lesson) {
      var lsx = (o.x - carX) + CARX;                              // где предмет на экране
      if (lsx < W * 0.68 && lsx > W * 0.22) { o.lesson = false; toLesson(o.lessonKey || 'jump', o); return; }
      if (lsx <= W * 0.22) {                                       // проскочили — слово подождёт следующего раза
        o.lesson = false;
        if (!story && o.lessonKey && o.lessonKey.indexOf('el_') === 0) { delete metEl[o.lessonKey.slice(3)]; wordArmed = false; }
      }
    }
    if (o.t === 'sheep' && o.run) { o.x += 430 * S * dt; o.run += dt; }
    if (o.t === 'pit' && o.bite > 0) o.bite = Math.max(0, o.bite - dt);
    if (o.t === 'cloudy') o.x -= o.sp * dt;
    if (o.t === 'butterfly') { o.x -= 40 * S * dt; if (!o.met) { o.met = 1; markFirst(o, 'butterfly'); } }
    if (o.t === 'hedgehog') { o.x -= 25 * S * dt; if (!o.met) { o.met = 1; markFirst(o, 'hedgehog'); } }
    if (o.t === 'flower' && !o.met) { o.met = 1; markFirst(o, 'flower'); }
    if (o.t === 'coin' && !o.got) {
      if (!o.met) { o.met = 1; markFirst(o, 'coin'); }
      if (bx1 > o.x - 34 * S && bx0 < o.x + 34 * S && by1 > o.y - 36 * S && by0 < o.y + 36 * S) {
        o.got = 1; stars += 1; bumpRow(); A.coin(3);
        popText('+1', o.x, o.y + 30 * S, '#ffd93d');
        burst(o.x, o.y, 10, ['#ffd93d', '#fff3b0', '#fff'], 260 * S, 'spark');
      }
    }
    if (o.t === 'apple' && !o.got) {
      if (!o.met) { o.met = 1; markFirst(o, 'apple'); }
      if (bx1 > o.x - 36*S && bx0 < o.x + 36*S && by1 > o.y - 40*S && by0 < o.y + 40*S) {
        o.got = 1; stars += 2; bumpRow(); A.coin(4);
        popText('+2', o.x, o.y + 40 * S, '#ff6b6b');
        burst(o.x, o.y, 12, ['#ff4d4d', '#7bd66b', '#fff'], 280 * S, 'spark');
        objs.splice(q, 1); continue;
      }
    }
    if (o.t === 'ball') {
      if (!o.met) { o.met = 1; markFirst(o, 'ball'); }
      /* Мяч нарисован прыгающим, а бился как неподвижный столб: машина проезжала
         ПОД мячом в верхней точке и всё равно получала удар. Считаем по той же
         высоте, по которой он рисуется (ballH), и требуем перекрытия по вертикали. */
      var bh = ballH(o), bTop = bh + 62 * S;
      if (!o.hit && bx1 > o.x - 34*S && bx0 < o.x + 34*S && by0 < bTop && by1 > bh) { o.hit = 1; A.clunk(); hurt('ball'); }
      else if (!o.hit && !o.over && carX > o.x + 30 * S) {
        o.over = 1; stars += 1; bumpRow(); A.coin(5); praiseJump();
      }
    }
    if (o.t === 'rail') {                          // переезд: поезд идёт ПОПЕРЁК дороги
      // голова выходит на полотно за trainLead c до приезда машинки при её текущей скорости
      if (!o.train && !o.done && o.x - carX < Math.max(spd, CRUISE) * (0.30 * TUNE.trainPass + TUNE.trainLead)) {
        o.train = 1; o.p = 0; o.cars = ri(2, 4); A.bell();
      }
      if (o.train) {
        o.p += dt / TUNE.trainPass;                // 0 — далеко на горизонте, 1 — уехал за нижний край
        if (o.p > 0.06 && !o.said) { o.said = 1; if (!A.talking()) A.say('Его надо перепрыгнуть!'); }
        if (!o.met && o.p > 0.12) { o.met = 1; markFirst(o, 'train'); }   // урок пораньше: до полотна ещё есть время
        // опасно, только пока состав идёт по самой дороге
        // опасно, пока хоть один вагон на полотне, машинка на переезде и не в воздухе
        if (trainOnLane(o) && Math.abs(carX - o.x) < 60 * S) {
          if (carY < 60 * S) { o.train = 0; o.done = 1; toBreakdown('train'); return; }
          o.flying = 1;                            // машинка сейчас над составом
        }
        if (o.flying && !o.over && carX > o.x + 60 * S) {   // перепрыгнули состав — награда
          o.over = 1; stars += 3; bumpRow(); A.coin(6);
          if (!A.talking()) A.say('Здорово!');
          popText('ПЕРЕПРЫГНУЛ!', o.x, 150 * S, '#7bd66b');
          burst(o.x, 60 * S, 14, ['#7bd66b', '#ffd93d', '#fff'], 280 * S, 'spark');
        }
        var tsg = trainSegs(o);
        if (tsg[tsg.length - 1] >= 1) { o.train = 0; o.done = 1; }   // хвост ушёл за нижний край
      }
    }
    if (o.t === 'bird' || o.t === 'plane') {
      o.x -= o.sp * dt;
      var bsx = (o.x - carX) + CARX;
      if (!o.met && bsx < W * 0.8) { o.met = 1; markFirst(o, o.t); }
    }
    if (o.t === 'traffic') {
      o.x += spd * o.sp * dt;                                  // едет в ту же сторону, но медленнее
      if (!o.passed && carX > o.x + 40 * S) {
        o.passed = 1; stars += 1; bumpRow(); A.coin(4); A.honk();
        popText('ОБГОН!', o.x, 170 * S, '#7bd66b');
      }
    }
    if (o.t === 'bucket' && bx1 > o.x - 46 * S && bx0 < o.x + 46 * S && by0 < 120 * S) {
      carPaint = o.col.skin; damage = 0; paintRevT = 0.8;
      A.fanfare(stars); A.splash(); flash = 0.12;   // мягкий отблеск вместо вспышки на весь экран
      A.say('Ух ты! Какая красивая машинка!');
      popText(o.col.name + '!', o.x, 150 * S, o.col.c === '#16161d' ? '#fff' : o.col.c);
      burst(o.x, 90 * S, 30, [o.col.c, '#fff', '#ffd93d'], 320 * S, 'conf');
      objs.splice(q, 1); continue;
    }
    if (o.t === 'mon') {
      o.x -= TUNE.monSpeed * S * dt;
      if (!o.said && o.x - carX < (W - CARX) * 0.9 && T - monTalk > 6 && !A.talking()) {
        o.said = 1; monTalk = T; A.say(pick(MONSTER_LINES));
      }                                    // монстрик бежит навстречу
      if (!o.hit && bx1 > o.x - 36 * S && bx0 < o.x + 36 * S) {
        if (by0 < 66 * S) { o.hit = true; gameOver('mon'); return; }
        o.hit = true; stars += 2; bumpRow(); A.coin(6);
        if (!A.talking()) { monTalk = T; A.say('Ой, перепрыгнул!'); }
        popText('ПЕРЕПРЫГНУЛ!', o.x, 150 * S, '#7bd66b');
        burst(o.x, 60 * S, 14, ['#7bd66b', '#ffd93d', '#fff'], 280 * S, 'spark');
      }
    }

    if (o.t === 'star') {
      /* Магнит. Трёхлетка не целится: без притяжения дуга звёзд над трамплином
         пролетала мимо почти всегда. Радиус небольшой — это помощь, а не автосбор. */
      var mdx = carX - o.x, mdy = (carY + car.h * S * 0.5) - o.y, mr = 120 * S;
      if (mdx * mdx + mdy * mdy < mr * mr) {
        o.x += mdx * Math.min(1, dt * 7); o.y += mdy * Math.min(1, dt * 7);
      }
      if (bx1 > o.x - 34*S && bx0 < o.x + 34*S && by1 > o.y - 36*S && by0 < o.y + 36*S) {
        stars++; combo++; comboT = 1.2;
        A.coin(combo);
        if (!story && stars % TUNE.themeEvery === 0) { archPending = true; A.cheer(); }   // впереди встанет радуга — место сменится под ней, без вспышки
        popText('+1', o.x, o.y + 30 * S, '#ffd93d');
        burst(o.x, o.y, 12, ['#ffd93d','#fff3b0','#ffb703'], 300 * S, 'spark');
        bumpRow();
        objs.splice(q, 1); continue;
      }
    } else if (o.t === 'fuel') {
      var fy = o.y + Math.sin(o.ph * 2.2) * 8 * S;
      if (bx1 > o.x - 44*S && bx0 < o.x + 44*S && by1 > fy - 52*S && by0 < fy + 52*S) {
        fuel = Math.min(1, fuel + 0.45);
        A.fuelUp();
        fuelPicks++;
        if (fuelPicks % 10 === 0 && tankMul < 2.0) {          // десятая канистра — бак побольше
          tankMul = Math.min(2.0, tankMul + 0.12); tune();
          A.fanfare(stars); flash = 0.35;
          popText('БАК БОЛЬШЕ!', o.x, fy + 110 * S, '#ffd93d');
          burst(o.x, fy + 40 * S, 16, ['#7bd66b', '#ffd93d', '#fff'], 300 * S, 'spark');
        } else popText('+БЕНЗИН', o.x, fy + 60 * S, '#7bd66b');
        if (story && curStage().t === 'fuelrun' && stageSub === 3) {
          stageSub = 4; fuel = 1; finishLine();
          A.say('Ура! Полный бак! Едем к финишу!');
        }
        burst(o.x, fy + 30 * S, 14, ['#ff4d4d','#ffd93d','#fff'], 280 * S, 'spark');
        objs.splice(q, 1); continue;
      }
    } else if (o.t === 'balloon') {
      var by = o.y + Math.sin(o.ph * 1.6) * 16 * S;
      if (bx1 > o.x - 32*S && bx0 < o.x + 32*S && by1 > by - 38*S && by0 < by + 38*S) {
        stars++;
        A.pop(); A.coin(row + 1);   // звёздочку дали — значит и чим награды тоже
        burst(o.x, by, 16, ['#ff4d6d','#ffd93d','#4fc3f7','#7bd66b'], 340 * S, 'conf');
        popText('ХЛОП!', o.x, by, '#ff4d6d');
        bumpRow();
        objs.splice(q, 1); continue;
      }
    } else if (o.t === 'cone' && !o.hit) {
      if (bx1 > o.x - 11*S && bx0 < o.x + 11*S && by0 < 34*S) {   // был неперепрыгиваем: зона шире прыжка
        o.jumped = false;
        o.hit = true; o.vx = rnd(240, 520) * S + spd * 0.4; o.vy = rnd(280, 520) * S; o.rot = 0; o.vr = rnd(-14, 14);
        A.clatter();
        hurt('cone');
        burst(o.x, 40 * S, 8, ['#fff','#ffb703'], 180 * S, 'dot');
      }
    } else if (o.t === 'cone' && !o.hit && !o.over && carX > o.x + 24 * S && carY > 26 * S) {
      /* Перепрыгнул конус — раньше ровно ничего не происходило, зато сбил — минус
         здоровье. Награда за удачный прыжок обязана быть заметнее наказания. */
      o.over = 1; stars += 1; bumpRow(); A.coin(5); praiseJump();
      popText('+1', o.x, 150 * S, '#7bd66b');
    } else if (o.t === 'cone' && o.hit) {
      o.vy -= GRAV * 0.55 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.vr * dt;
      if (o.y < 0) { o.y = 0; o.vy *= -0.35; o.vx *= 0.6; o.vr *= 0.5; }
    } else if (o.t === 'puddle' && !o.done) {
      if (Math.abs(carX - o.x) < o.w * 0.5 && carY < 30 * S) {
        /* Диктор обещает «проедем — будут брызги», а код снимал здоровье: первое,
           чему игра учила, — что диктору верить нельзя. Лужа теперь пачкает и
           притормаживает (и тем оправдывает мойку), но не наказывает. */
        o.done = true; A.splash(); A.hiss();
        carDirty = true; spd *= 0.82;
        popText('БРЫЗГИ!', o.x, 150 * S, '#4fc3f7');
        for (var w2 = 0; w2 < 26; w2++)
          P({ x: carX + rnd(-o.w*0.4, o.w*0.4), y: 6*S, vx: rnd(-320,420)*S, vy: rnd(220,560)*S,
              r: rnd(5,14)*S, c: pick(['#4fc3f7','#81d4fa','#e1f5fe']), kind:'drop', life: rnd(0.4,0.8) });
      }
    } else if (o.t === 'pit' && !o.fell) {
      if (Math.abs(carX - o.x) < o.w * 0.45 && carY < 26 * S) {
        o.fell = true; o.bite = 1.1; A.fall(); A.clatter(); spd *= 0.45;
        hurt('pit');
      } else if (!o.fell && !o.over && carX > o.x + o.w * 0.5 && carY > 26 * S) {
        o.over = true; stars += 1; bumpRow(); A.coin(5); praiseJump();
        popText('+1', o.x, 150 * S, '#7bd66b');
      }
    } else if (o.t === 'arch' && !o.used) {
      if (carX > o.x) {
        o.used = true; celebrate = 2.4; fuel = Math.min(1, fuel + 0.3);
        /* Радуга-ворота посреди заезда — это смена места, а не конец уровня:
           ни очков за уровень, ни мастерской, ни реплики «Уровень пройден». */
        if (o.gate) {
          setTheme(themeIx + 1); stars += 2; A.fanfare(stars); A.cheer(); A.say('Молодец! Поехали!');
          popText('НОВОЕ МЕСТО!', carX, carY + ch, '#ffd93d');
          for (var cg = 0; cg < 40; cg++)
            P({ x: o.x + rnd(-120, 120) * S, y: rnd(40, 300) * S, vx: rnd(-160, 160) * S, vy: rnd(60, 260) * S,
                r: rnd(6, 14) * S, c: pick(['#ff4d6d', '#ffd93d', '#4fc3f7', '#7bd66b']), kind: 'conf',
                life: rnd(0.7, 1.4), vr: rnd(-8, 8) });
          continue;
        }
        stars += 5;
        level++;
        if (story) { finishing = true; A.say('Финиш!'); }
        else { pendingRepair = true; setTheme(themeIx + 1); }
        A.fanfare(level); A.cheer(); A.say('Уровень пройден! Ты молодец!');
        popText('УРА!', carX, carY + ch, '#fff');
        for (var c2 = 0; c2 < 90; c2++)
          P({ x: o.x + rnd(-160,160)*S, y: rnd(180, 380)*S, vx: rnd(-260,260)*S, vy: rnd(-40,320)*S,
              r: rnd(7,16)*S, c: pick(['#ff4d6d','#ffd93d','#4fc3f7','#7bd66b','#c77dff','#ff9f1c']),
              kind:'conf', life: rnd(1.2,2.2), vr: rnd(-10,10) });
      }
    }
  }

  if (pendingRepair && celebrate > 0 && celebrate < 0.7) { pendingRepair = false; toRepair(); return; }

  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
  if (sirenT > 0) sirenT -= dt;
  if (dmgT > 0) dmgT = Math.max(0, dmgT - dt);
  if (paintRevT > 0) paintRevT = Math.max(0, paintRevT - dt);
  if (fxT > 0) fxT -= dt;
  if (celebrate > 0) celebrate -= dt;
  if (flash > 0) flash -= dt;
  if (shake > 0) shake = Math.max(0, shake - dt * 26 * S);
  if (flipT > 0) flipT = Math.max(0, flipT - dt * 2.2);

  if (car.fx === 'water' && fxT > 0.1 && RNG() < dt * 40)
    P({ x: carX + cw*0.42, y: carY + ch*0.65, vx: rnd(280,700)*S, vy: rnd(140,400)*S,
        r: rnd(5,12)*S, c: pick(['#4fc3f7','#81d4fa','#fff']), kind:'drop', life: rnd(0.5,0.9) });
}


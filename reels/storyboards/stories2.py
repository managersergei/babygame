# -*- coding: utf-8 -*-
"""Вторая десятка ИИ-историй (B01–B10). Стиль и персонажи — те же, что в stories.py."""
from stories import STYLE, KID, MOM, DAD, GRAN, TRUCK, TABLET_GAME, sh
SIS = "his six-year-old sister with two blond braids and a green dress"
GRANDPA = "his grandfather, bald with a grey moustache, blue work overalls"

STORIES = [
 {"id": "B01-bedtime", "title": "Последнее слово перед сном", "hook": "Перед сном он говорит ФАРА, а не «ещё мультик»", "shots": [
   sh("0–2.5", "Детская вечером, ночник, мальчик в пижаме с планшетом под одеялом", f"Medium shot of a cozy children's bedroom at night: {KID} in star-print pajamas sits under a blanket with a dimmed tablet, a warm nightlight shaped like a moon on the shelf. {STYLE}", "blanket rustles, nightlight glows softly", ref=False),
   sh("2.5–5", "Крупно: экран — ночная дорога, машинка в темноте", f"Close-up of the tablet screen: {TRUCK} on a dark night road under stars, headlights off, a sleepy moon. {STYLE}", "stars twinkle, the truck rolls slowly"),
   sh("5–7.5", "Мальчик шепчет слово, глаза сонные", f"Close-up: {KID} whispering one word toward the tablet with sleepy half-closed eyes and a small smile, soft nightlight on his face. {STYLE}", "he whispers, eyelids droop slightly", ref=False),
   sh("7.5–10", "Экран: фары включились, две тёплые полосы света", f"Close-up of the tablet screen: {TRUCK} with headlights switched on casting two warm beams along the night road, fireflies. {STYLE}", "beams flick on, fireflies drift"),
   sh("10–12.5", "Мама выключает ночник, мальчик спит, планшет на тумбочке", f"Wide shot: {MOM} gently switching off the moon nightlight, {KID} asleep with a smile, the tablet face-down on the nightstand. {STYLE}", "light dims, mom tiptoes out", ref=False)]},
 {"id": "B02-big-sister", "title": "Сестра показывает", "hook": "Старшая научила младшего за одну яму", "shots": [
   sh("0–2.5", "Сестра и брат на диване, планшет между ними", f"Medium shot: {SIS} and {KID} sitting close together on a sofa with a tablet between them, afternoon light, toys on the floor. {STYLE}", "sister points at the screen, brother leans in", ref=False),
   sh("2.5–5", "Сестра кричит слово, показывая пример", f"Close-up: {SIS} shouting a word at the tablet with a proud grin, pointing at the screen with her finger. {STYLE}", "she shouts, braids swing", ref=False),
   sh("5–7.5", "Экран: машинка прыгает", f"Close-up of the tablet: {TRUCK} jumping over a pit with sparkles on a cartoon road. {STYLE}", "the truck arcs over the pit"),
   sh("7.5–10", "Младший повторяет, сестра даёт пять", f"Medium shot: {KID} shouting the word with his mouth wide open while {SIS} raises her hand for a high five, both laughing. {STYLE}", "high five lands, both bounce", ref=False)]},
 {"id": "B03-playground", "title": "На площадке", "hook": "Один сказал — все закричали", "shots": [
   sh("0–2.5", "Три малыша на скамейке у площадки, один держит телефон", f"Wide shot of a sunny playground: three toddlers sitting on a wooden bench, {KID} in the middle holding a phone, slide and swings behind, green trees. {STYLE}", "leaves sway, swings move slightly", ref=False),
   sh("2.5–5", "Крупно: телефон — машинка перед ямой", f"Close-up of a phone held by small hands: {TRUCK} stopped before a pit on a cartoon road. {STYLE}", "truck wobbles, slight hand shake"),
   sh("5–7.5", "Все трое кричат слово одновременно", f"Medium shot: three toddlers on the bench all shouting one word at the phone together with wide open mouths, {KID} in the middle. {STYLE}", "all three lean in and shout, camera pushes in", ref=False),
   sh("7.5–10", "Экран: прыжок; дети подпрыгивают на скамейке", f"Low-angle shot: the phone screen shows {TRUCK} mid-jump while the three toddlers bounce on the bench with raised arms, blurred background. {STYLE}", "kids bounce, truck jumps")]},
 {"id": "B04-toy-comes-alive", "title": "Игрушка повторяет", "hook": "Настоящая машинка тоже прыгнула", "shots": [
   sh("0–2.5", "Ковёр: планшет с игрой и рядом настоящая игрушечная пожарная машинка", f"Top-down shot of a round rug: a tablet showing {TRUCK} on a cartoon road, and next to it a real toy fire truck of the same design, small hands at the edge of the frame. {STYLE}", "slow push-in, screen glows"),
   sh("2.5–5", "Мальчик кричит слово, глядя на обе машинки", f"Medium shot: {KID} kneeling on the rug shouting a word, looking between the tablet and the toy truck. {STYLE}", "he shouts, curls bounce", ref=False),
   sh("5–7.5", "Экран: машинка прыгает", f"Close-up of the tablet: {TRUCK} leaping over a pit with sparkles. {STYLE}", "truck arcs over the pit"),
   sh("7.5–10", "Игрушечная машинка на ковре тоже подпрыгнула (магия)", f"Close-up on the rug: the real toy fire truck of the same design hopping a few centimeters into the air with tiny sparkles, the tablet blurred behind, {KID}'s astonished face at the edge. {STYLE}", "toy hops, sparkles, boy gasps"),
   sh("10–12.5", "Мальчик обнимает игрушку, планшет рядом", f"Medium shot: {KID} hugging the toy fire truck to his chest with a huge smile, tablet on the rug, warm light. {STYLE}", "hug, happy wiggle", ref=False)]},
 {"id": "B05-grandpa-garage", "title": "Дедушка в гараже", "hook": "Дед чинит колесо, внук говорит ОДИН", "shots": [
   sh("0–2.5", "Гараж: дедушка меняет колесо у настоящей машины, внук с планшетом на ящике", f"Wide shot of a tidy home garage: {GRANDPA} kneeling by a small car with a wheel removed, {KID} sitting on a wooden crate with a tablet, tools on the wall. {STYLE}", "grandpa tightens a bolt, boy swings his feet", ref=False),
   sh("2.5–5", "Крупно: экран — машинка без одного колеса, колесо рядом", f"Close-up of the tablet: {TRUCK} missing one rear wheel, the loose wheel lying on the cartoon road beside it, a question-mark mood. {STYLE}", "wheel rolls a little, truck tilts"),
   sh("5–7.5", "Внук показывает один палец и кричит", f"Medium shot: {KID} holding up one finger and shouting a word toward the tablet, {GRANDPA} looking over his shoulder smiling. {STYLE}", "finger up, shout, grandpa turns", ref=False),
   sh("7.5–10", "Дед ставит колесо, на экране колесо возвращается", f"Split composition in one frame: {GRANDPA} pushing the real wheel onto the car in the foreground, and the tablet propped nearby showing {TRUCK} with its wheel back in place and sparkles. {STYLE}", "wheel slides on, sparkles on screen")]},
 {"id": "B06-red-light", "title": "СТОП на настоящем светофоре", "hook": "Сказал СТОП машинке — сказал СТОП маме", "shots": [
   sh("0–2.5", "Салон машины: мальчик в детском кресле с планшетом, мама за рулём", f"Medium shot inside a car: {KID} in a child car seat holding a tablet, {MOM} driving in the front, sunny street through the windows. {STYLE}", "street slides past the windows", ref=False),
   sh("2.5–5", "Крупно: экран — машинка перед красным светофором", f"Close-up of the tablet: {TRUCK} stopped at a cartoon traffic light glowing red. {STYLE}", "red light pulses, truck rocks"),
   sh("5–7.5", "Мальчик кричит СТОП, показывает ладонь", f"Close-up: {KID} shouting a word with his palm raised like a stop sign, grinning, seatbelt across his chest. {STYLE}", "palm up, shout", ref=False),
   sh("7.5–10", "Мама смеётся, впереди настоящий красный светофор", f"Over-the-shoulder shot from the back seat: {MOM} laughing while a real red traffic light hangs ahead through the windshield, the tablet in the corner of the frame showing green. {STYLE}", "mom laughs, light ahead", ref=False)]},
 {"id": "B07-garage-dawn", "title": "Гараж на рассвете", "hook": "Каждое утро он выбирает машинку по имени", "shots": [
   sh("0–2.5", "Игрушечный гараж на рассвете: четыре машинки спят", f"Wide shot of a cozy cartoon toy garage at dawn: four small toy vehicles parked side by side — {TRUCK}, a green monster truck, a yellow race car and a white police car — with sleepy closed headlights, soft pink light through the gate. {STYLE}", "light creeps in, headlights blink open"),
   sh("2.5–5", "Пожарная машинка просыпается, фары-глаза открываются", f"Close-up: {TRUCK} waking up, headlights opening like eyes, a little stretch bounce, dust motes in a sunbeam. {STYLE}", "headlights open, bounce"),
   sh("5–7.5", "Мальчик у планшета говорит название машинки", f"Medium shot: {KID} sitting cross-legged on a rug with the tablet, saying a word with a decisive nod, morning light. {STYLE}", "he nods and speaks", ref=False),
   sh("7.5–10", "Машинка выезжает из гаража навстречу", f"Low-angle shot: {TRUCK} rolling out of the garage gate toward the camera into the sunrise, the other three vehicles waving with their wipers behind. {STYLE}", "truck rolls forward, wipers wave")]},
 {"id": "B08-yard-wash", "title": "Мойка во дворе", "hook": "Папа моет машину, сын моет машинку словом ВОДА", "shots": [
   sh("0–2.5", "Двор: папа со шлангом моет машину, сын с планшетом на крыльце", f"Wide shot of a sunny backyard: {DAD} washing a small family car with a hose and foam, {KID} sitting on the porch steps with a tablet. {STYLE}", "water sprays, foam slides", ref=False),
   sh("2.5–5", "Крупно: экран — грязная машинка на мойке", f"Close-up of the tablet: {TRUCK} covered in mud splashes standing under a cartoon car-wash arch. {STYLE}", "mud drips, arch lights blink"),
   sh("5–7.5", "Сын кричит слово, папа направляет шланг вверх — радуга", f"Medium shot: {KID} shouting a word from the porch while {DAD} sprays the hose upward creating a small rainbow in the mist. {STYLE}", "spray arcs, rainbow appears", ref=False),
   sh("7.5–10", "Экран: пена и блестящая чистая машинка", f"Close-up of the tablet: {TRUCK} shining clean in a cloud of soap bubbles, sparkles. {STYLE}", "bubbles pop, sparkle glints"),
   sh("10–12.5", "Папа и сын на мокрой траве смеются", f"Wide shot: {DAD} and {KID} sitting on the wet grass laughing, the clean car behind them, tablet on the step. {STYLE}", "both laugh, water drips", ref=False)]},
 {"id": "B09-silence", "title": "Тишина", "hook": "Игра ждёт. Столько, сколько нужно", "shots": [
   sh("0–3", "Мальчик молча смотрит на планшет, сжав губы", f"Close-up: {KID} looking at a tablet in silence with pressed lips and thoughtful eyes, soft window light, calm room. {STYLE}", "very slow push-in, he blinks", ref=False),
   sh("3–5.5", "Экран: машинка терпеливо стоит перед ямой, облака плывут", f"Close-up of the tablet: {TRUCK} standing patiently before a pit, clouds drifting, no rush. {STYLE}", "clouds drift, truck idles"),
   sh("5.5–8", "Мальчик шепчет слово, чуть-чуть", f"Extreme close-up: {KID}'s mouth forming a quiet word, a tiny hopeful smile. {STYLE}", "lips move slightly", ref=False),
   sh("8–10.5", "Экран: машинка прыгает; мальчик выдыхает с улыбкой", f"Medium shot: the tablet showing {TRUCK} jumping over the pit with sparkles, and {KID} exhaling with a wide relieved smile behind it. {STYLE}", "truck jumps, boy's face lights up")]},
 {"id": "B10-dad-home", "title": "Папа пришёл", "hook": "Встретил папу словом ГАЗ", "shots": [
   sh("0–2.5", "Прихожая: дверь открывается, папа с сумкой", f"Medium shot of a hallway: {DAD} opening the front door with a work bag, evening light behind him. {STYLE}", "door opens, light spills in", ref=False),
   sh("2.5–5", "Мальчик бежит с планшетом, кричит слово", f"Medium shot: {KID} running down the hallway toward the camera holding a tablet up, shouting a word, socks sliding on the floor. {STYLE}", "he runs and slides, tablet raised", ref=False),
   sh("5–7.5", "Экран: машинка мчится с линиями скорости", f"Close-up of the tablet: {TRUCK} speeding along a cartoon road with motion lines and dust, a tiny robot far behind. {STYLE}", "truck speeds, dust trails"),
   sh("7.5–10", "Папа поднимает сына на руки, планшет между ними", f"Medium shot: {DAD} lifting {KID} into his arms, both looking at the tablet screen together, laughing, {MOM} smiling in the doorway behind. {STYLE}", "lift, laugh, mom appears", ref=False)]},
]

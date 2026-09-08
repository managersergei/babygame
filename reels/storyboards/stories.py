# -*- coding: utf-8 -*-
"""10 историй для ИИ-рилсов: сториборд по шотам (2–3 с каждый). Стиль один на все —
мультяшный 3D, палитра игры. Машинка — из спрайта игры (Image 1). Дети — только
рисованные персонажи, не «настоящие отзывы»."""
STYLE = ("Stylized 3D cartoon render in the look of a modern family animated film: soft rounded shapes, "
         "gentle depth of field, saturated but not neon palette (sky blue #8fd3f4, sunny yellow #ffd93d, coral #ff6650, ink #2b2140), "
         "clean uncluttered background, no text, no captions, no logos, no user interface elements. Vertical 9:16 composition.")
KID = "a three-year-old boy with short curly brown hair, round cheeks, a yellow t-shirt and blue shorts"
MOM = "his mother in her early thirties with dark hair in a low bun and a mustard cardigan"
DAD = "his father in his thirties with a short beard, grey hoodie"
GRAN = "his grandmother, silver hair, round reading glasses, floral blouse"
TRUCK = "the small red toy fire truck from Image 1 (keep its exact design, proportions and friendly headlights)"
TRUCK_PLAIN = "a small red toy fire truck with round friendly headlight eyes, a short white ladder on top and a simple rounded cartoon design"  # для провайдеров без референса; текст утверждает владелец
TABLET_GAME = "the tablet screen shows a bright cartoon road game with " + TRUCK + " on a road"

def sh(t, what, prompt, motion, ref=True):
    return {"t": t, "what": what, "prompt": prompt, "motion": motion, "ref": ref}

STORIES = [
 {"id": "A01-first-word", "title": "Первое слово — машинке", "hook": "Он сказал ПРЫЖОК раньше, чем МАМА", "shots": [
   sh("0–2.5", "Общий план: утро, гостиная, мальчик с планшетом на ковре, мама на кухне на фоне",
      f"Wide shot of a cozy sunlit living room in the morning: {KID} sits on a round rug holding a tablet, {MOM} stands at the kitchen counter in the blurred background pouring tea. Soft window light from the left. {STYLE}",
      "slow push-in toward the boy, mom stirs her tea, dust motes in the light", ref=False),
   sh("2.5–5", "Крупно: экран планшета — машинка перед ямой, детские руки держат планшет",
      f"Close-up over the boy's shoulder: his small hands hold a tablet; {TABLET_GAME} stopped in front of a dark pit, cartoon hills and clouds. Shallow depth of field, screen glows softly. {STYLE}",
      "the truck bounces slightly in place, the boy's thumbs tighten on the tablet"),
   sh("5–7.5", "Средний план: лицо мальчика, кричит слово, глаза горят",
      f"Medium close-up of {KID} leaning toward the tablet with his mouth wide open shouting one word, eyes bright, eyebrows raised, joyful energy. Warm morning light on his face. {STYLE}",
      "he leans forward and shouts, curls bounce, slight camera shake on the shout", ref=False),
   sh("7.5–10", "Крупно: экран — машинка в прыжке над ямой, искры",
      f"Close-up of the tablet screen filling the frame: {TRUCK} mid-air jumping over the pit on a cartoon road, tiny yellow sparkles around it, bright blue sky. {STYLE}",
      "the truck arcs over the pit, sparkles burst, camera follows the arc"),
   sh("10–12.5", "Средний план: мама обернулась, удивлённая улыбка; мальчик хлопает на переднем плане",
      f"Medium shot: {MOM} has turned around from the counter with a surprised delighted smile, hand on her chest; in the blurred foreground {KID} claps his hands with the tablet on his lap. {STYLE}",
      "mom turns and smiles, boy claps twice, gentle rack focus from boy to mom", ref=False)]},
 {"id": "A02-truck-obeys", "title": "Машинка слушается", "hook": "Слово — и машинка едет, прыгает, светит", "shots": [
   sh("0–2.5", "Общий план: игрушечная дорога через луг, машинка едет", f"Establishing wide shot of a toy-like winding road through a bright green meadow with rounded hills and fluffy clouds; {TRUCK} drives along the road toward the camera. Golden soft daylight. {STYLE}", "the truck drives forward, clouds drift, grass sways"),
   sh("2.5–5", "Машинка остановилась перед ямой, вопросительное настроение", f"Medium shot: {TRUCK} stopped at the edge of a dark round pit in the road, headlights like worried eyes, a small dust cloud settling behind it. {STYLE}", "the truck rocks back slightly, dust settles"),
   sh("5–7.5", "Прыжок через яму", f"Dynamic low-angle shot: {TRUCK} leaping through the air over the pit, wheels spread, motion lines and yellow sparkles, blue sky behind. {STYLE}", "the truck arcs over the pit and lands with a small bounce"),
   sh("7.5–10", "Ночь, фары включаются", f"Night scene: the same road under a deep blue starry sky, {TRUCK} with headlights switched on casting two warm beams on the road ahead, fireflies. {STYLE}", "headlights flicker on, beams sweep the road, fireflies drift"),
   sh("10–12.5", "Мойка: пена, блестящая машинка", f"Bright morning: {TRUCK} inside a cheerful cartoon car wash covered in foam bubbles, water sparkles, big soft brushes, rainbow in the spray. {STYLE}", "bubbles pop, brushes spin, water sparkles fly")]},
 {"id": "A03-watch-vs-talk", "title": "Смотрит или говорит", "hook": "Не мультик. Здесь ребёнок говорит, а не смотрит", "shots": [
   sh("0–3", "Серый план: мальчик обмяк на диване перед телевизором", f"Desaturated muted scene: {KID} slumped on a sofa staring blankly at a television, cold blue glow on his face, evening room in shadow. {STYLE}", "very slow zoom, TV flicker on his face, he blinks slowly", ref=False),
   sh("3–5.5", "Цвет возвращается: тот же мальчик сидит прямо с планшетом, кричит", f"The same sofa now in full warm color: {KID} sitting upright and alert holding a tablet with both hands, mouth open shouting a word, sunlight through the window. {STYLE}", "color blooms in, he sits up and shouts, hair bounces", ref=False),
   sh("5.5–8", "Крупно: экран — машинка прыгает", f"Close-up of the tablet screen: {TRUCK} jumping over a pit on a cartoon road, sparkles, bright sky. {STYLE}", "the truck jumps, sparkles burst"),
   sh("8–10.5", "Мальчик смеётся, мама рядом на диване", f"Medium shot: {KID} laughing with his head back, {MOM} sitting beside him on the sofa laughing too, tablet between them, warm light. {STYLE}", "both laugh, mom leans in, camera pulls back slightly", ref=False)]},
 {"id": "A04-grandmas-phone", "title": "Бабушкин телефон", "hook": "Это не приложение. Это ссылка", "shots": [
   sh("0–2.5", "Бабушка с старым телефоном за кухонным столом, внук рядом", f"Medium shot at a kitchen table: {GRAN} holds an old scratched smartphone at arm's length squinting through her glasses, {KID} kneels on the chair beside her peeking at the screen, teacups and a plate of cookies. {STYLE}", "grandma tilts the phone, boy leans in", ref=False),
   sh("2.5–5", "Крупно: старый телефон, на экране игра, палец бабушки", f"Close-up of an old smartphone with a slightly worn edge held in an elderly hand: the screen shows a bright cartoon road game with {TRUCK} in front of a pit; a wrinkled finger hovers over the screen. {STYLE}", "finger taps, the screen brightens, truck wobbles"),
   sh("5–7.5", "Мальчик кричит в телефон, бабушка смеётся", f"Medium shot: {KID} shouting a word toward the phone with both fists clenched in excitement, {GRAN} laughing with her hand over her mouth. Warm kitchen light. {STYLE}", "boy shouts, grandma laughs and shakes her head", ref=False),
   sh("7.5–10", "Оба смотрят в телефон, машинка прыгает", f"Over-the-shoulder shot of grandma and the boy both looking at the phone screen where {TRUCK} leaps over a pit with sparkles. {STYLE}", "truck jumps, both heads bob up following the jump")]},
 {"id": "A05-dad-shouts", "title": "Папа кричит БЕНЗИН", "hook": "Папа орёт БЕНЗИН на ноутбук. Сын в восторге", "shots": [
   sh("0–2.5", "Папа с ноутбуком на диване, сын на коленях, вечер", f"Medium shot: {DAD} sits on a sofa with a laptop on his knees, {KID} sits on his lap, both looking at the screen, a warm floor lamp, evening. {STYLE}", "dad shifts, boy bounces on his lap", ref=False),
   sh("2.5–5", "Крупно: папа кричит, щёки надуты, сын хихикает", f"Close-up: {DAD} mid-shout with puffed cheeks and wide eyes toward the laptop, {KID} giggling with his hands over his mouth beside him. {STYLE}", "dad shouts, boy giggles and covers mouth", ref=False),
   sh("5–7.5", "Экран ноутбука: машинка подбирает канистру", f"Close-up of a laptop screen: {TRUCK} on a cartoon road grabbing a green fuel can, yellow sparkles, a fuel gauge icon filling up. {STYLE}", "truck rolls, fuel can pops, sparkles"),
   sh("7.5–10", "Мама в дверях смеётся", f"Wide shot of the living room: {MOM} leaning in the doorway laughing, {DAD} and {KID} on the sofa cheering with raised arms, laptop glowing. {STYLE}", "mom laughs, dad and boy raise arms, cozy lamp flicker", ref=False)]},
 {"id": "A06-road-of-words", "title": "Дорога слов", "hook": "Каждое слово открывает дорогу", "shots": [
   sh("0–2.5", "Извилистая дорога с тремя воротами вдали, машинка на старте", f"Wide shot: a winding toy road across rolling hills with three tiny colorful gates far in the distance; {TRUCK} at the start line at the bottom of the frame. Morning light. {STYLE}", "slow crane up, truck starts rolling"),
   sh("2.5–5", "Ворота 1: мост выдвигается над ямой, над машинкой светящийся пузырь речи", f"Medium shot: {TRUCK} before a pit while a wooden bridge slides out across it; above the truck a glowing empty speech bubble made of light. {STYLE}", "bridge slides across, bubble pulses"),
   sh("5–7.5", "Ворота 2: светофор переключается на зелёный", f"Medium shot: {TRUCK} stopped at a cartoon traffic light that switches to green, rounded sign post, green glow on the road. {STYLE}", "light changes red to green, truck rolls"),
   sh("7.5–10", "Ночь: включаются фары", f"Night on the road: {TRUCK} with headlight beams switching on, stars, a sleepy moon, fireflies. {STYLE}", "beams flick on, fireflies scatter"),
   sh("10–12.5", "Финиш: радужная арка, конфетти", f"Wide shot: {TRUCK} passing under a big rainbow arch at the finish, confetti falling, rounded hills. {STYLE}", "confetti falls, truck passes under the arch")]},
 {"id": "A07-morning", "title": "Утро без мультиков", "hook": "10 минут, где ребёнок говорит", "shots": [
   sh("0–2.5", "Утренняя кухня, мальчик с планшетом за столом, блины", f"Medium shot of a bright kitchen table: {KID} sits with a tablet propped against a mug, a plate of pancakes, morning sun. {STYLE}", "steam rises from pancakes, boy taps the tablet", ref=False),
   sh("2.5–5", "Крупно: кричит в планшет", f"Close-up: {KID} shouting one word at the tablet with sparkling eyes, a bit of pancake on his cheek. {STYLE}", "he shouts, curls bounce", ref=False),
   sh("5–7.5", "Мамина рука показывает большой палец у планшета", f"Close-up: the tablet showing {TRUCK} jumping over a pit, and {MOM}'s hand giving a thumbs up next to it, the boy's hands on the table edge. {STYLE}", "thumb goes up, truck jumps"),
   sh("7.5–10", "Планшет закрыт, мальчик ест блины, солнце", f"Medium shot: {KID} happily eating pancakes, the tablet face-down on the table, {MOM} sitting opposite with tea, sunny kitchen. {STYLE}", "boy chews, mom smiles, sunlight shifts", ref=False)]},
 {"id": "A08-how-it-hears", "title": "Как игра слышит", "hook": "Микрофон включён. Интернет выключен", "shots": [
   sh("0–2.5", "Внутри телефона: волна звука входит в микрофон", f"Abstract cartoon interior of a smartphone: a bright wavy sound line flows into a big rounded microphone icon, glossy surfaces, blue and coral. {STYLE}", "the wave ripples into the microphone", ref=False),
   sh("2.5–5", "Волна превращается в узор из точек", f"The sound wave transforms into a small glowing pattern of dots and bars floating in the middle of the phone interior, soft glow. {STYLE}", "dots rearrange into a pattern and settle", ref=False),
   sh("5–7.5", "Узор ложится в сундучок с замком", f"The glowing pattern floats down into a small wooden chest with a padlock inside the phone interior, the lid closes gently. {STYLE}", "the pattern drops in, the lid closes, lock clicks", ref=False),
   sh("7.5–10", "Снаружи: телефон на столе, перечёркнутый wi-fi, довольный мальчик", f"Medium shot: a smartphone lying on a wooden table showing {TRUCK} in the game, a small crossed-out wifi symbol floating above it, {KID} peeking over the table edge grinning. {STYLE}", "boy pops up over the table edge, symbol bobs")]},
 {"id": "A09-mom-jealous", "title": "А МАМА?", "hook": "Первое слово досталось машинке", "shots": [
   sh("0–2.5", "Мальчик кричит в планшет, машинка прыгает", f"Medium shot: {KID} on the rug shouting at a tablet where {TRUCK} jumps over a pit, sparkles on the screen. {STYLE}", "boy shouts, truck jumps"),
   sh("2.5–5", "Мама приподняла бровь, рука на боку, игриво", f"Medium shot: {MOM} standing with a hand on her hip and one eyebrow raised in a playful mock-offended expression, living room. {STYLE}", "eyebrow rises, slight head tilt", ref=False),
   sh("5–7.5", "Мальчик поворачивается к маме и говорит с улыбкой", f"Medium shot: {KID} turns from the tablet toward his mother, mouth open saying a word with a huge smile, arms reaching. {STYLE}", "he turns and reaches out, curls bounce", ref=False),
   sh("7.5–10", "Мама обнимает мальчика, планшет на ковре, сердечки", f"Wide warm shot: {MOM} kneeling and hugging {KID}, the tablet lying on the rug beside them, tiny heart-shaped sparkles in the air. {STYLE}", "hug tightens, hearts float up", ref=False)]},
 {"id": "A10-therapist", "title": "Логопед смотрит", "hook": "Не занятие. Повод захотеть сказать", "shots": [
   sh("0–2.5", "Логопед за светлым столом с планшетом", f"Medium shot: a friendly speech therapist woman in her forties with a warm smile and a lanyard, sitting at a bright office table holding a tablet, shelves with toys behind. {STYLE}", "she looks at the tablet, slight nod", ref=False),
   sh("2.5–5", "Крупно: планшет — машинка перед ямой", f"Close-up of the tablet in her hands: {TRUCK} stopped before a pit on a cartoon road. {STYLE}", "truck wobbles, screen glow"),
   sh("5–7.5", "Она кивает, большой палец, тёплая улыбка", f"Close-up: the speech therapist nodding with a warm smile and giving a thumbs up, soft office light. {STYLE}", "she nods twice, thumb up", ref=False),
   sh("7.5–10", "Общий план: логопед и мама, мальчик играет на переднем плане", f"Wide shot: the speech therapist and {MOM} talking at the table while {KID} plays with a tablet on a colorful mat in the foreground, toys around. {STYLE}", "adults talk, boy bounces with the tablet", ref=False)]},
]

#!/usr/bin/env python3
"""A tiny multiplayer country-guessing Telegram bot; stdlib only."""
from __future__ import annotations

import json
import os
import random
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# (country, flag, capital, clue)
COUNTRIES = [
    ("Япония", "🇯🇵", "Токио", "Страна восходящего солнца; её столица — Токио."),
    ("Бразилия", "🇧🇷", "Бразилиа", "Самая большая страна Южной Америки; здесь говорят по-португальски."),
    ("Исландия", "🇮🇸", "Рейкьявик", "Островное государство с гейзерами и северным сиянием."),
    ("Египет", "🇪🇬", "Каир", "Здесь находятся пирамиды Гизы и река Нил."),
    ("Канада", "🇨🇦", "Оттава", "Страна кленового листа и второй по площади территории в мире."),
    ("Италия", "🇮🇹", "Рим", "Страна в форме сапога; её столица — Рим."),
    ("Австралия", "🇦🇺", "Канберра", "Единственная страна, занимающая целый континент."),
    ("Кения", "🇰🇪", "Найроби", "Восточноафриканская страна, известная сафари и марафонцами."),
    ("Греция", "🇬🇷", "Афины", "Родина древней демократии и Олимпийских игр."),
    ("Мексика", "🇲🇽", "Мехико", "Страна тако, майя и ацтеков."),
    ("Норвегия", "🇳🇴", "Осло", "Скандинавская страна фьордов; её столица — Осло."),
    ("Марокко", "🇲🇦", "Рабат", "Североафриканская страна, где находятся Марракеш и Атласские горы."),
    ("Таиланд", "🇹🇭", "Бангкок", "Юго-восточноазиатская страна, известная храмами и уличной едой."),
    ("Перу", "🇵🇪", "Лима", "В этой стране находятся Мачу-Пикчу и Анды."),
    ("Южная Корея", "🇰🇷", "Сеул", "Родина K-pop, кимчи и города Сеул."),
    ("Швейцария", "🇨🇭", "Берн", "Альпийская страна, известная часами, шоколадом и нейтралитетом."),
    ("Португалия", "🇵🇹", "Лиссабон", "Европейская страна на берегу Атлантики; столица — Лиссабон."),
    ("Новая Зеландия", "🇳🇿", "Веллингтон", "Островная страна, где снимали «Властелина колец»."),
    ("Турция", "🇹🇷", "Анкара", "Страна, расположенная сразу в Европе и Азии."),
    ("Аргентина", "🇦🇷", "Буэнос-Айрес", "Родина танго и футболиста Лионеля Месси."),
]

# Add every ISO-3166 entry with a capital; keep the hand-written Russian clues/names
# for familiar countries, and use the full bundled dataset for the rest.
def flag_for(iso: str) -> str:
    return "".join(chr(127397 + ord(letter)) for letter in iso.upper())


def iso_for_flag(flag: str) -> str:
    return "".join(chr(ord(letter) - 127397) for letter in flag).lower()


_curated = {iso_for_flag(row[1]): row for row in COUNTRIES}
try:
    records = json.loads((Path(__file__).parent / "data" / "countries.json").read_text(encoding="utf-8"))
    COUNTRY_BY_ISO = {}
    for item in records:
        iso = item["iso"].lower()
        flag = flag_for(iso)
        curated = _curated.get(iso)
        if curated:
            name, _, capital, clue = curated
        else:
            name, capital, clue = item.get("name_ru", item["name"]), item["capital"], ""
        COUNTRY_BY_ISO[iso] = {"iso": iso, "name": name, "flag": flag, "capital": capital, "clue": clue}
except (OSError, ValueError, KeyError) as exc:
    raise RuntimeError("Не удалось загрузить data/countries.json. Оставьте файл данных в папке data рядом с country_bot.py.") from exc
COUNTRIES = list(COUNTRY_BY_ISO.values())

API = "https://api.telegram.org/bot{}/{}"
GAMES: dict[int, dict] = {}
ALLOWED_USERS: set[int] = set()


def call(token: str, method: str, data: dict | None = None) -> dict:
    body = urllib.parse.urlencode(data or {}).encode()
    req = urllib.request.Request(API.format(token, method), data=body)
    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            result = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"Telegram API error: {exc}")
        return {}
    if not result.get("ok"):
        print(f"Telegram API error: {result}")
        return {}
    return result


MAIN_MENU_KEYBOARD = {
    "inline_keyboard": [
        [{"text": "🎮 Игра вдвоём", "callback_data": "newgame"}, {"text": "👤 Одиночная игра", "callback_data": "solo"}],
    ]
}
GAME_KEYBOARD = {
    "inline_keyboard": [
        [{"text": "💡 Подсказка", "callback_data": "hint"}, {"text": "🏆 Счёт", "callback_data": "score"}],
        [{"text": "⏭ Дальше", "callback_data": "next"}, {"text": "🛑 Стоп", "callback_data": "stop"}],
    ]
}
SOLO_LEVEL_KEYBOARD = {
    "inline_keyboard": [
        [{"text": "🌱 Начальный", "callback_data": "level_easy"}, {"text": "🌿 Средний", "callback_data": "level_medium"}],
        [{"text": "🔥 Продвинутый", "callback_data": "level_hard"}, {"text": "🌍 Все флаги", "callback_data": "level_all"}],
    ]
}
BUTTON_COMMANDS = {
    "newgame": "/newgame",
    "solo": "/solo",
    "level_easy": "/solo_easy",
    "level_medium": "/solo_medium",
    "level_hard": "/solo_hard",
    "level_all": "/solo_all",
    "hint": "/hint",
    "score": "/score",
    "next": "/next",
    "stop": "/stop",
    # Compatibility with the older reply keyboard.
    "🎮 Новая игра": "/newgame",
    "💡 Подсказка": "/hint",
    "🏆 Счёт": "/score",
    "⏭ Дальше": "/next",
    "🛑 Стоп": "/stop",
}


def send(token: str, chat_id: int, text: str, keyboard: dict | None = None) -> dict:
    return call(token, "sendMessage", {
        "chat_id": chat_id,
        "text": text,
        "reply_markup": json.dumps(keyboard or GAME_KEYBOARD, ensure_ascii=False),
    })


TERRITORY_ISO = set("ai as aw ax bl bq cc ck cw cx eh fk fo gf gg gs gu hk hm im io je ky mf mq ms nc nf nu pf pm pn pr re sj sx tc tk um vg vi wf yt".split())
EASY_ISO = set("jp br is eg ca it au ke gr mx no ma th pe kr ch pt nz tr ar gb fr de es us cn in ru".split())


def difficulty_pool(round_number: int) -> tuple[str, list[dict]]:
    if round_number <= 5:
        return "Лёгкая", [c for c in COUNTRIES if c["iso"] in EASY_ISO]
    if round_number <= 15:
        return "Средняя", [c for c in COUNTRIES if c["iso"] not in EASY_ISO and c["iso"] not in TERRITORY_ISO]
    return "Сложная", [c for c in COUNTRIES if c["iso"] in TERRITORY_ISO]


def solo_pool(level_key: str) -> tuple[str, list[dict]]:
    pools = {
        "easy": ("Начальный", [c for c in COUNTRIES if c["iso"] in EASY_ISO]),
        "medium": ("Средний", [c for c in COUNTRIES if c["iso"] not in EASY_ISO and c["iso"] not in TERRITORY_ISO]),
        "hard": ("Продвинутый", [c for c in COUNTRIES if c["iso"] in TERRITORY_ISO]),
        "all": ("Все флаги", COUNTRIES[:]),
    }
    return pools[level_key]


def solo_round_pool(level_key: str, used: set[str]) -> tuple[str, list[dict]]:
    if level_key != "all":
        return solo_pool(level_key)
    tiers = [
        ("Все флаги • начальный этап", [c for c in COUNTRIES if c["iso"] in EASY_ISO]),
        ("Все флаги • средний этап", [c for c in COUNTRIES if c["iso"] not in EASY_ISO and c["iso"] not in TERRITORY_ISO]),
        ("Все флаги • продвинутый этап", [c for c in COUNTRIES if c["iso"] in TERRITORY_ISO]),
    ]
    for label, tier in tiers:
        if any(c["iso"] not in used for c in tier):
            return label, tier
    return "Все флаги", []


def solo_answer_keyboard(options: list[dict]) -> dict:
    rows = [[{"text": item["name"], "callback_data": f"solo_answer:{item['iso']}"} for item in options[:2]],
            [{"text": item["name"], "callback_data": f"solo_answer:{item['iso']}"} for item in options[2:4]],
            [{"text": "💡 Подсказка", "callback_data": "hint"}, {"text": "⏭ Дальше", "callback_data": "next"}, {"text": "🛑 Стоп", "callback_data": "stop"}]]
    return {"inline_keyboard": rows}


def start_solo_round(token: str, chat_id: int, game: dict) -> None:
    level_name, pool = solo_round_pool(game["level"], game["used"])
    unused = [c for c in pool if c["iso"] not in game["used"]]
    if not unused:
        game["finished"] = True
        total = len(COUNTRIES) if game["level"] == "all" else len(pool)
        send(token, chat_id, f"🎉 Уровень «{level_name}» пройден! Вы изучили все {total} флагов. Одиночный режим не добавляет очки в общий счёт.")
        return

    target = random.choice(unused)
    distractors = [c for c in pool if c["iso"] != target["iso"]]
    options = random.sample(distractors, 3) + [target]
    random.shuffle(options)
    game["round"] += 1
    game["used"].add(target["iso"])
    game["answer"] = target
    game["options"] = options
    game["answered"] = False
    game["round_hints"] = 0

    result = call(token, "sendPhoto", {
        "chat_id": chat_id,
        "photo": f"https://flagcdn.com/w320/{target['iso']}.png",
        "caption": f"👤 {level_name} • вопрос {game['round']}\nНазовите страну по флагу. У вас 15 секунд!",
        "reply_markup": json.dumps(solo_answer_keyboard(options), ensure_ascii=False),
    })
    game["prompt_message_id"] = (result.get("result") or {}).get("message_id")
    game["deadline"] = time.time() + 15


def start_round(token: str, chat_id: int, game: dict) -> None:
    if game.get("mode") == "solo":
        start_solo_round(token, chat_id, game)
        return
    game["round"] += 1
    level, pool = difficulty_pool(game["round"])
    choices = [c for c in pool if c["iso"] not in game["used"]]
    if not choices:
        game["used"].clear()
        choices = pool or COUNTRIES[:]
    country = random.choice(choices)
    game["used"].add(country["iso"])
    game["answer"] = country
    game["answered"] = False
    game["round_hints"] = 0
    flag_url = f"https://flagcdn.com/w320/{country['iso']}.png"
    call(token, "sendPhoto", {
        "chat_id": chat_id,
        "photo": flag_url,
        "caption": f"🌍 Раунд {game['round']} • {level} сложность\nУгадайте страну только по флагу! Ответьте названием страны.",
        "reply_markup": json.dumps(GAME_KEYBOARD, ensure_ascii=False),
    })


def close_solo_buttons(token: str, chat_id: int, game: dict) -> None:
    message_id = game.get("prompt_message_id")
    if message_id:
        call(token, "editMessageReplyMarkup", {
            "chat_id": chat_id,
            "message_id": message_id,
            "reply_markup": json.dumps({"inline_keyboard": []}),
        })


def submit_solo_choice(token: str, chat_id: int, game: dict, selected_iso: str) -> None:
    if game.get("answered") or game.get("finished") or selected_iso not in {c["iso"] for c in game.get("options", [])}:
        return
    if time.time() >= game.get("deadline", 0):
        game["answered"] = True
        close_solo_buttons(token, chat_id, game)
        send(token, chat_id, f"⏰ Время вышло! Это {game['answer']['name']}.")
        start_solo_round(token, chat_id, game)
        return
    close_solo_buttons(token, chat_id, game)
    if selected_iso == game["answer"]["iso"]:
        send(token, chat_id, "✅ Верно! Следующий флаг.")
    else:
        send(token, chat_id, f"❌ Не угадали. Это {game['answer']['name']}. Следующий флаг.")
    game["answered"] = True
    start_solo_round(token, chat_id, game)


def expire_solo_rounds(token: str) -> None:
    now = time.time()
    for chat_id, game in list(GAMES.items()):
        if game.get("mode") == "solo" and not game.get("answered") and not game.get("finished") and now >= game.get("deadline", float("inf")):
            game["answered"] = True
            close_solo_buttons(token, chat_id, game)
            send(token, chat_id, f"⏰ Время вышло! Это {game['answer']['name']}.")
            start_solo_round(token, chat_id, game)


def handle(token: str, message: dict) -> None:
    chat_id = message["chat"]["id"]
    user = message.get("from", {})
    name = user.get("first_name") or "Игрок"
    text = (message.get("text") or "").strip()
    text = BUTTON_COMMANDS.get(text, text)
    command = text.split()[0].split("@")[0].lower() if text.startswith("/") else ""

    # This one onboarding command reveals only the caller's own Telegram ID.
    if command == "/myid":
        send(token, chat_id, f"Ваш Telegram ID: {user.get('id')}\nДобавьте его в ALLOWED_USER_IDS, чтобы разрешить игру.")
        return
    if user.get("id") not in ALLOWED_USERS:
        return

    active_game = GAMES.get(chat_id)
    if active_game and active_game.get("mode") in ("solo", "solo_setup") and active_game.get("owner") != user.get("id"):
        return

    if command in ("/start", "/help"):
        send(token, chat_id, "Привет! Угадывайте страны только по изображениям флагов 🗺️\n\n/newgame — игра вдвоём\n/solo — одиночная игра с выбором уровня\n/hint — взять подсказку (5 на игру)\n/score — посмотреть счёт\n/next — пропустить вопрос\n/stop — завершить игру\n\nВ одиночном режиме можно пройти выбранный уровень или изучить все флаги.", MAIN_MENU_KEYBOARD)
        return
    if command == "/solo":
        GAMES[chat_id] = {"mode": "solo_setup", "owner": user.get("id"), "scores": {}, "names": {}}
        send(token, chat_id, "👤 Одиночная игра — выберите уровень:\nНачальный: самые знакомые флаги. Средний: остальные страны. Продвинутый: территории. «Все флаги» проходит этапы от простых к редким. В каждом вопросе 1 флаг, 4 варианта и 15 секунд.", SOLO_LEVEL_KEYBOARD)
        return
    if command in ("/solo_easy", "/solo_medium", "/solo_hard", "/solo_all"):
        setup = GAMES.get(chat_id)
        level_key = command.removeprefix("/solo_")
        if not setup or setup.get("mode") != "solo_setup" or setup.get("owner") != user.get("id"):
            send(token, chat_id, "Сначала нажмите «Одиночная игра» и выберите уровень.")
            return
        GAMES[chat_id] = {
            "mode": "solo", "owner": user.get("id"), "level": level_key,
            "scores": {user.get("id"): 0}, "names": {user.get("id"): name},
            "used": set(), "round": 0, "answer": None, "answered": False,
            "hints_left": 5, "round_hints": 0, "finished": False,
        }
        send(token, chat_id, f"Начинаем одиночное обучение: {level_key}. Угадывайте флаг!")
        start_round(token, chat_id, GAMES[chat_id])
        return
    if command == "/newgame":
        GAMES[chat_id] = {"mode": "duo", "scores": {}, "names": {}, "used": set(), "round": 0, "answer": None, "answered": False, "hints_left": 5}
        send(token, chat_id, "🎉 Новая игра! Зовите друг друга и отвечайте в этом чате. Начинаем!")
        start_round(token, chat_id, GAMES[chat_id])
        return
    game = GAMES.get(chat_id)
    if game and game.get("mode") == "solo_setup" and not command:
        send(token, chat_id, "Выберите один из уровней в меню выше:", SOLO_LEVEL_KEYBOARD)
        return
    if command == "/solo_answer":
        selected_iso = text.split(maxsplit=1)[1].strip().lower() if len(text.split(maxsplit=1)) > 1 else ""
        if game and game.get("mode") == "solo":
            submit_solo_choice(token, chat_id, game, selected_iso)
        return
    if command == "/stop":
        if game:
            if game.get("mode") == "solo":
                close_solo_buttons(token, chat_id, game)
            GAMES.pop(chat_id, None)
            if game.get("mode") == "solo":
                send(token, chat_id, "Одиночная тренировка завершена. Она не входит в общий счёт.")
            else:
                send(token, chat_id, "Игра завершена!\n" + score_text(game))
        else:
            send(token, chat_id, "Сейчас нет активной игры. Напишите /newgame, чтобы начать.")
        return
    if command == "/score":
        if game and game.get("mode") == "solo":
            send(token, chat_id, "Одиночная тренировка не входит в общий игровой счёт.")
        else:
            send(token, chat_id, score_text(game) if game else "Сейчас нет активной игры. Напишите /newgame.")
        return
    if command == "/next":
        if game and game.get("answer") and not game.get("finished"):
            answer = game["answer"]
            if game.get("mode") == "solo":
                close_solo_buttons(token, chat_id, game)
                game["answered"] = True
            send(token, chat_id, f"Ответ: {answer['name']} {answer['flag']}. Следующий раунд!")
            start_round(token, chat_id, game)
        elif game and game.get("finished"):
            send(token, chat_id, "Этот уровень уже завершён. Нажмите «Одиночная игра», чтобы выбрать другой.")
        else:
            send(token, chat_id, "Сначала начните игру командой /newgame.")
        return
    if command == "/hint":
        if not game or not game.get("answer"):
            send(token, chat_id, "Сначала начните игру командой /newgame или выберите уровень в одиночной игре.")
        elif game.get("finished"):
            send(token, chat_id, "Уровень уже завершён — выберите другой режим.")
        elif game["answered"]:
            send(token, chat_id, "Раунд уже завершён — дождитесь следующего флага.")
        elif game["hints_left"] <= 0:
            send(token, chat_id, "Подсказки на эту игру закончились — вы уже использовали все 5.")
        else:
            answer = game["answer"]
            normalized_name = "".join(char for char in answer["name"] if char.isalpha())
            step = game.get("round_hints", 0) + 1
            game["round_hints"] = step
            game["hints_left"] -= 1
            if step == 1:
                clue = f"В названии {len(normalized_name)} букв."
            elif step == 2:
                clue = f"Название начинается на «{normalized_name[:1]}»."
            elif step == 3:
                clue = f"Первые две буквы: «{normalized_name[:2]}»."
            elif step == 4:
                clue = f"Первые три буквы: «{normalized_name[:3]}»."
            else:
                clue = f"Столица этой страны — {answer['capital']}."
            send(token, chat_id, f"💡 Подсказка {step}/5: {clue} Осталось подсказок на игру: {game['hints_left']} из 5.")
        return
    if not game or not text or text.startswith("/"):
        return

    normalize = lambda value: " ".join(value.casefold().replace("ё", "е").strip(" .,!?«»\"'").split())
    if game.get("mode") == "solo":
        chosen = next((c for c in game.get("options", []) if normalize(text) == normalize(c["name"])), None)
        if chosen:
            submit_solo_choice(token, chat_id, game, chosen["iso"])
        return

    answer = game["answer"]
    accepted = normalize(answer["name"])
    if not game["answered"] and normalize(text) == accepted:
        game["answered"] = True
        game["names"][user.get("id", name)] = name
        game["scores"][user.get("id", name)] = game["scores"].get(user.get("id", name), 0) + 1
        send(token, chat_id, f"✅ Верно, {name}! Это {answer['name']} {answer['flag']}. +1 очко\n\n" + score_text(game))
        time.sleep(1)
        start_round(token, chat_id, game)


def score_text(game: dict | None) -> str:
    if not game or not game["scores"]:
        return "Счёт пока пуст — пусть первым ответит кто-нибудь из вас!"
    rows = sorted(game["scores"].items(), key=lambda item: (-item[1], game["names"].get(item[0], "")))
    return "🏆 Счёт:\n" + "\n".join(f"{game['names'].get(uid, 'Игрок')} — {score}" for uid, score in rows)


def handle_callback(token: str, query: dict) -> None:
    call(token, "answerCallbackQuery", {"callback_query_id": query["id"]})
    message = query.get("message")
    data = query.get("data", "")
    if not message:
        return
    if data.startswith("solo_answer:"):
        command = "/solo_answer " + data.split(":", 1)[1]
    else:
        command = BUTTON_COMMANDS.get(data)
    if not command:
        return
    # Reuse the normal command path so permissions and game rules stay identical.
    handle(token, {**message, "from": query.get("from", {}), "text": command})


def main() -> None:
    global ALLOWED_USERS
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        raise SystemExit("Set TELEGRAM_BOT_TOKEN to your bot token from @BotFather.")
    try:
        ids = {int(part.strip()) for part in os.environ.get("ALLOWED_USER_IDS", "").split(",") if part.strip()}
    except ValueError:
        raise SystemExit("ALLOWED_USER_IDS must contain numeric Telegram user IDs separated by a comma.")
    if len(ids) not in (0, 2):
        raise SystemExit("ALLOWED_USER_IDS must be empty for initial ID discovery, or contain exactly two Telegram user IDs.")
    ALLOWED_USERS = ids
    if ids:
        print("Country game bot is running with a two-user allowlist. Press Ctrl+C to stop.")
    else:
        print("ID discovery mode: only /myid replies; no gameplay is allowed until two IDs are configured.")
    offset = 0
    while True:
        updates = call(token, "getUpdates", {
            "timeout": 5,
            "offset": offset,
            "allowed_updates": json.dumps(["message", "callback_query"]),
        })
        if "result" not in updates:
            time.sleep(3)
            continue
        for update in updates.get("result", []):
            offset = update["update_id"] + 1
            if update.get("callback_query"):
                try:
                    handle_callback(token, update["callback_query"])
                except Exception as exc:
                    print(f"Callback handling error: {exc}")
                continue
            message = update.get("message")
            if message:
                try:
                    handle(token, message)
                except Exception as exc:
                    print(f"Update handling error: {exc}")
        try:
            expire_solo_rounds(token)
        except Exception as exc:
            print(f"Solo timer error: {exc}")


if __name__ == "__main__":
    main()

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
            name, capital, clue = item["name"], item["capital"], ""
        COUNTRY_BY_ISO[iso] = {"iso": iso, "name": name, "flag": flag, "capital": capital, "clue": clue}
except (OSError, ValueError, KeyError):
    COUNTRY_BY_ISO = {
        iso_for_flag(row[1]).lower(): {"iso": iso_for_flag(row[1]).lower(), "name": row[0], "flag": row[1], "capital": row[2], "clue": row[3]}
        for row in COUNTRIES
    }
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
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"Telegram API error: {exc}")
        return {}
    if not result.get("ok"):
        print(f"Telegram API error: {result}")
        return {}
    return result


REPLY_KEYBOARD = {
    "keyboard": [
        [{"text": "🎮 Новая игра"}, {"text": "💡 Подсказка"}],
        [{"text": "🏆 Счёт"}, {"text": "⏭ Дальше"}],
        [{"text": "🛑 Стоп"}],
    ],
    "resize_keyboard": True,
    "is_persistent": True,
}
BUTTON_COMMANDS = {
    "🎮 Новая игра": "/newgame",
    "💡 Подсказка": "/hint",
    "🏆 Счёт": "/score",
    "⏭ Дальше": "/next",
    "🛑 Стоп": "/stop",
}


def send(token: str, chat_id: int, text: str) -> None:
    call(token, "sendMessage", {
        "chat_id": chat_id,
        "text": text,
        "reply_markup": json.dumps(REPLY_KEYBOARD, ensure_ascii=False),
    })


TERRITORY_ISO = set("ai as aw ax bl bq cc ck cw cx eh fk fo gf gg gs gu hk hm im io je ky mf mq ms nc nf nu pf pm pn pr re sj sx tc tk um vg vi wf yt".split())
EASY_ISO = set("jp br is eg ca it au ke gr mx no ma th pe kr ch pt nz tr ar gb fr de es us cn in ru".split())


def difficulty_pool(round_number: int) -> tuple[str, list[dict]]:
    if round_number <= 5:
        return "Лёгкая", [c for c in COUNTRIES if c["iso"] in EASY_ISO]
    if round_number <= 15:
        return "Средняя", [c for c in COUNTRIES if c["iso"] not in EASY_ISO and c["iso"] not in TERRITORY_ISO]
    return "Сложная", [c for c in COUNTRIES if c["iso"] in TERRITORY_ISO]


def start_round(token: str, chat_id: int, game: dict) -> None:
    game["round"] += 1
    level, pool = difficulty_pool(game["round"])
    choices = [c for c in pool if c["iso"] not in game["used"]]
    if not choices:
        choices = [c for c in COUNTRIES if c["iso"] not in game["used"]]
    if not choices:
        game["used"].clear()
        choices = pool or COUNTRIES[:]
    country = random.choice(choices)
    game["used"].add(country["iso"])
    game["answer"] = country
    game["answered"] = False
    game["round_hints"] = 0
    flag_url = f"https://flagcdn.com/w320/{country['iso']}.png"
    call(token, "sendPhoto", {"chat_id": chat_id, "photo": flag_url, "caption": f"🌍 Раунд {game['round']} • {level} сложность\nУгадайте страну только по флагу! Ответьте названием страны."})


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

    if command in ("/start", "/help"):
        send(token, chat_id, "Привет! Угадывайте страны только по изображениям флагов 🗺️\n\n/newgame — начать новую игру\n/hint — взять подсказку (всего 5 за игру)\n/score — посмотреть счёт\n/next — пропустить вопрос\n/stop — завершить игру\n\nРаунды постепенно становятся сложнее. Первый правильный ответ получает очко!")
        return
    if command == "/newgame":
        GAMES[chat_id] = {"scores": {}, "names": {}, "used": set(), "round": 0, "answer": None, "answered": False, "hints_left": 5}
        send(token, chat_id, "🎉 Новая игра! Зовите друг друга и отвечайте в этом чате. Начинаем!")
        start_round(token, chat_id, GAMES[chat_id])
        return
    game = GAMES.get(chat_id)
    if command == "/stop":
        if game:
            scoreboard = score_text(game)
            GAMES.pop(chat_id, None)
            send(token, chat_id, "Игра завершена!\n" + scoreboard)
        else:
            send(token, chat_id, "Сейчас нет активной игры. Напишите /newgame, чтобы начать.")
        return
    if command == "/score":
        send(token, chat_id, score_text(game) if game else "Сейчас нет активной игры. Напишите /newgame.")
        return
    if command == "/next":
        if game:
            answer = game["answer"]
            send(token, chat_id, f"Ответ: {answer['name']} {answer['flag']}. Следующий раунд!")
            start_round(token, chat_id, game)
        else:
            send(token, chat_id, "Сначала начните игру командой /newgame.")
        return
    if command == "/hint":
        if not game:
            send(token, chat_id, "Сначала начните игру командой /newgame.")
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

    answer = game["answer"]
    normalize = lambda value: " ".join(value.casefold().replace("ё", "е").strip(" .,!?«»\"'").split())
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
        updates = call(token, "getUpdates", {"timeout": 30, "offset": offset})
        for update in updates.get("result", []):
            offset = update["update_id"] + 1
            message = update.get("message")
            if message:
                try:
                    handle(token, message)
                except Exception as exc:
                    print(f"Update handling error: {exc}")


if __name__ == "__main__":
    main()

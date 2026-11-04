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


_curated = {row[1]: row for row in COUNTRIES}
try:
    records = json.loads((Path(__file__).parent / "data" / "countries.json").read_text(encoding="utf-8"))
    for row in records:
        flag = flag_for(row["iso"])
        if flag not in _curated:
            _curated[flag] = (row["name"], flag, row["capital"], f"Столица этой страны — {row['capital']}. Угадайте страну по флагу!")
    COUNTRIES = list(_curated.values())
except (OSError, ValueError, KeyError):
    pass

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


def send(token: str, chat_id: int, text: str) -> None:
    call(token, "sendMessage", {"chat_id": chat_id, "text": text})


def start_round(token: str, chat_id: int, game: dict) -> None:
    choices = [c for c in COUNTRIES if c[0] not in game["used"]]
    if not choices:
        game["used"].clear()
        choices = COUNTRIES[:]
    country = random.choice(choices)
    game["used"].add(country[0])
    game["answer"] = country
    game["answered"] = False
    game["round"] += 1
    send(token, chat_id, f"🌍 Раунд {game['round']}! Угадайте страну по подсказке: {country[3]}\nМожно отвечать обоим — первый правильный ответ получает очко. Или напишите /hint за флагом.")


def handle(token: str, message: dict) -> None:
    chat_id = message["chat"]["id"]
    user = message.get("from", {})
    name = user.get("first_name") or "Игрок"
    text = (message.get("text") or "").strip()
    command = text.split()[0].split("@")[0].lower() if text.startswith("/") else ""

    # This one onboarding command reveals only the caller's own Telegram ID.
    if command == "/myid":
        send(token, chat_id, f"Ваш Telegram ID: {user.get('id')}\nДобавьте его в ALLOWED_USER_IDS, чтобы разрешить игру.")
        return
    if user.get("id") not in ALLOWED_USERS:
        return

    if command in ("/start", "/help"):
        send(token, chat_id, "Привет! Это игра-угадайка про страны для вас двоих 🗺️\n\n/newgame — начать новую игру\n/hint — показать флаг страны\n/score — счёт\n/next — пропустить вопрос\n/stop — завершить игру\n\nИграйте вместе в личном чате с ботом или добавьте его в общий чат. Первый правильный ответ в раунде получает очко!")
        return
    if command == "/newgame":
        GAMES[chat_id] = {"scores": {}, "names": {}, "used": set(), "round": 0, "answer": None, "answered": False}
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
            send(token, chat_id, f"Ответ: {answer[0]} {answer[1]}. Следующий раунд!")
            start_round(token, chat_id, game)
        else:
            send(token, chat_id, "Сначала начните игру командой /newgame.")
        return
    if command == "/hint":
        if game and game["answer"] and not game["answered"]:
            send(token, chat_id, f"Подсказка-флаг: {game['answer'][1]}")
        else:
            send(token, chat_id, "Сейчас нечего подсказывать — начните игру командой /newgame.")
        return
    if not game or not text or text.startswith("/"):
        return

    answer = game["answer"]
    normalize = lambda value: " ".join(value.casefold().replace("ё", "е").strip(" .,!?«»\"'").split())
    accepted = {normalize(answer[0]), normalize(answer[2])}
    if not game["answered"] and normalize(text) in accepted:
        game["answered"] = True
        game["names"][user.get("id", name)] = name
        game["scores"][user.get("id", name)] = game["scores"].get(user.get("id", name), 0) + 1
        send(token, chat_id, f"✅ Верно, {name}! Это {answer[0]} {answer[1]}. +1 очко\n\n" + score_text(game))
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

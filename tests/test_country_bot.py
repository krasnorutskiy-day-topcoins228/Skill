import unittest
from unittest.mock import patch

import country_bot


class CountryBotTests(unittest.TestCase):
    def test_full_flag_dataset_has_unique_iso_codes_and_image_fields(self):
        self.assertGreaterEqual(len(country_bot.COUNTRIES), 200)
        codes = set()
        for country in country_bot.COUNTRIES:
            self.assertEqual(set(country), {"iso", "name", "flag", "capital", "clue"})
            self.assertEqual(len(country["iso"]), 2)
            self.assertTrue(country["name"] and country["flag"] and country["capital"])
            codes.add(country["iso"])
        self.assertEqual(len(codes), len(country_bot.COUNTRIES))

    def test_difficulty_progresses_from_common_flags_to_territories(self):
        self.assertEqual(country_bot.difficulty_pool(1)[0], "Лёгкая")
        self.assertEqual(country_bot.difficulty_pool(6)[0], "Средняя")
        self.assertEqual(country_bot.difficulty_pool(16)[0], "Сложная")
        self.assertTrue(all(c["iso"] in country_bot.EASY_ISO for c in country_bot.difficulty_pool(1)[1]))
        self.assertTrue(all(c["iso"] in country_bot.TERRITORY_ISO for c in country_bot.difficulty_pool(16)[1]))

    @patch.object(country_bot, "call")
    def test_new_round_sends_an_online_flag_image_without_country_clue(self, api_call):
        game = {"used": set(), "round": 0, "answer": None, "answered": False, "round_hints": 4}
        country_bot.start_round("token", 123, game)
        self.assertEqual(game["round_hints"], 0)
        self.assertEqual(api_call.call_args.args[1], "sendPhoto")
        fields = api_call.call_args.args[2]
        self.assertIn("https://flagcdn.com/w320/", fields["photo"])
        self.assertIn("только по флагу", fields["caption"])
        self.assertNotIn(game["answer"]["name"], fields["caption"])
        self.assertEqual(game["round"], 1)

    @patch.object(country_bot, "send")
    def test_hints_are_limited_to_five_per_game_and_shared_in_chat(self, send):
        country_bot.ALLOWED_USERS = {11, 22}
        country_bot.GAMES[999] = {
            "scores": {}, "names": {}, "used": set(), "round": 1,
            "answer": {"name": "Япония", "flag": "🇯🇵", "capital": "Токио", "iso": "jp"},
            "answered": False, "hints_left": 5, "round_hints": 0,
        }
        message = {"chat": {"id": 999}, "from": {"id": 11, "first_name": "Аня"}, "text": "/hint"}
        expected = ["6 букв", "начинается на «Я»", "две буквы: «Яп»", "три буквы: «Япо»", "Столица этой страны — Токио"]
        for index, clue in enumerate(expected):
            country_bot.handle("token", message)
            self.assertIn(clue, send.call_args.args[2])
            self.assertEqual(country_bot.GAMES[999]["round_hints"], index + 1)
        self.assertEqual(country_bot.GAMES[999]["hints_left"], 0)
        previous_calls = send.call_count
        message["from"] = {"id": 22, "first_name": "Борис"}
        country_bot.handle("token", message)
        self.assertEqual(country_bot.GAMES[999]["hints_left"], 0)
        self.assertIn("закончились", send.call_args.args[2])
        self.assertGreater(send.call_count, previous_calls)
        country_bot.GAMES.pop(999)

    def test_all_flags_level_advances_through_easy_medium_and_hard_stages(self):
        easy_codes = {c["iso"] for c in country_bot.COUNTRIES if c["iso"] in country_bot.EASY_ISO}
        name, pool = country_bot.solo_round_pool("all", set())
        self.assertIn("начальный", name)
        self.assertTrue(all(c["iso"] in country_bot.EASY_ISO for c in pool))
        name, pool = country_bot.solo_round_pool("all", easy_codes)
        self.assertIn("средний", name)
        self.assertTrue(all(c["iso"] not in country_bot.EASY_ISO and c["iso"] not in country_bot.TERRITORY_ISO for c in pool))
        used_through_medium = easy_codes | {c["iso"] for c in pool}
        name, pool = country_bot.solo_round_pool("all", used_through_medium)
        self.assertIn("продвинутый", name)
        self.assertTrue(all(c["iso"] in country_bot.TERRITORY_ISO for c in pool))

    @patch.object(country_bot, "call")
    def test_solo_question_has_one_flag_four_answers_and_deadline(self, api_call):
        api_call.return_value = {"result": {"message_id": 456}}
        game = {"mode": "solo", "level": "all", "used": set(), "round": 0, "answered": False}
        country_bot.start_solo_round("token", 123, game)
        photo_call = next(c for c in api_call.call_args_list if c.args[1] == "sendPhoto")
        import json
        fields = photo_call.args[2]
        keyboard = json.loads(fields["reply_markup"])["inline_keyboard"]
        choices = [button for row in keyboard[:2] for button in row]
        self.assertIn("flagcdn.com/w320/", fields["photo"])
        self.assertEqual(len(choices), 4)
        self.assertEqual(len({button["callback_data"] for button in choices}), 4)
        self.assertGreater(game["deadline"], country_bot.time.time())
        self.assertEqual(game["prompt_message_id"], 456)

    @patch.object(country_bot, "start_solo_round")
    @patch.object(country_bot, "send")
    @patch.object(country_bot, "call")
    def test_solo_answers_do_not_add_duo_score(self, api_call, send, start_round):
        game = {
            "mode": "solo", "answer": {"iso": "jp", "name": "Япония"},
            "options": [{"iso": "jp", "name": "Япония"}], "answered": False,
            "finished": False, "deadline": country_bot.time.time() + 5,
            "prompt_message_id": 456, "scores": {11: 0}, "used": set(), "level": "all",
        }
        country_bot.submit_solo_choice("token", 123, game, "jp")
        self.assertEqual(game["scores"], {11: 0})
        start_round.assert_called_once()

    @patch.object(country_bot, "start_round")
    @patch.object(country_bot, "send")
    def test_solo_mode_offers_levels_and_starts_selected_course(self, send, start_round):
        country_bot.ALLOWED_USERS = {11, 22}
        country_bot.GAMES.pop(999, None)
        message = {"chat": {"id": 999}, "from": {"id": 11, "first_name": "Аня"}, "text": "/solo"}
        country_bot.handle("token", message)
        self.assertEqual(country_bot.GAMES[999]["mode"], "solo_setup")
        message["text"] = "/solo_all"
        country_bot.handle("token", message)
        game = country_bot.GAMES[999]
        self.assertEqual(game["mode"], "solo")
        self.assertEqual(game["level"], "all")
        self.assertEqual(game["scores"][11], 0)
        start_round.assert_called_once()
        country_bot.GAMES.pop(999, None)

    @patch.object(country_bot, "send")
    def test_solo_game_ignores_other_allowed_player(self, send):
        country_bot.ALLOWED_USERS = {11, 22}
        country_bot.GAMES[999] = {"mode": "solo", "owner": 11, "scores": {11: 0}, "names": {11: "Аня"}, "used": set(), "round": 1, "answer": {"name": "Япония", "flag": "🇯🇵", "iso": "jp"}, "answered": False}
        message = {"chat": {"id": 999}, "from": {"id": 22, "first_name": "Борис"}, "text": "/next"}
        country_bot.handle("token", message)
        send.assert_not_called()
        self.assertEqual(country_bot.GAMES[999]["round"], 1)
        country_bot.GAMES.pop(999, None)

    @patch.object(country_bot, "start_round")
    @patch.object(country_bot, "send")
    def test_reply_keyboard_button_starts_a_game(self, send, start_round):
        country_bot.ALLOWED_USERS = {11, 22}
        country_bot.GAMES.pop(999, None)
        message = {"chat": {"id": 999}, "from": {"id": 11, "first_name": "Аня"}, "text": "🎮 Новая игра"}
        country_bot.handle("token", message)
        self.assertIn(999, country_bot.GAMES)
        self.assertEqual(country_bot.GAMES[999]["hints_left"], 5)
        start_round.assert_called_once()
        country_bot.GAMES.pop(999, None)

    @patch.object(country_bot, "call")
    def test_game_messages_show_controls_not_the_game_selection_menu(self, api_call):
        country_bot.send("token", 123, "Вопрос")
        payload = api_call.call_args.args[2]
        import json
        markup = json.loads(payload["reply_markup"])
        buttons = [b for row in markup["inline_keyboard"] for b in row]
        labels = [b["text"] for b in buttons]
        self.assertIn("⏭ Дальше", labels)
        self.assertNotIn("👤 Одиночная игра", labels)
        self.assertNotIn("🎮 Игра вдвоём", labels)

    @patch.object(country_bot, "send")
    def test_start_help_shows_game_selection_buttons(self, send):
        country_bot.ALLOWED_USERS = {11, 22}
        message = {"chat": {"id": 123}, "from": {"id": 11, "first_name": "Аня"}, "text": "/start"}
        country_bot.handle("token", message)
        keyboard = send.call_args.args[3]
        labels = [b["text"] for row in keyboard["inline_keyboard"] for b in row]
        self.assertIn("👤 Одиночная игра", labels)
        self.assertIn("🎮 Игра вдвоём", labels)

    @patch.object(country_bot, "handle")
    @patch.object(country_bot, "call")
    def test_inline_next_button_acknowledges_and_routes_next_command(self, api_call, handle):
        query = {
            "id": "cb-1", "data": "next", "from": {"id": 11, "first_name": "Аня"},
            "message": {"chat": {"id": 999}, "message_id": 7},
        }
        country_bot.handle_callback("token", query)
        api_call.assert_called_once_with("token", "answerCallbackQuery", {"callback_query_id": "cb-1"})
        routed = handle.call_args.args[1]
        self.assertEqual(routed["text"], "/next")
        self.assertEqual(routed["from"]["id"], 11)

    def test_scoreboard_handles_empty_and_multiple_players(self):
        game = {"scores": {}, "names": {}}
        self.assertIn("пуст", country_bot.score_text(game))
        game["scores"] = {1: 3, 2: 1}
        game["names"] = {1: "Аня", 2: "Борис"}
        result = country_bot.score_text(game)
        self.assertLess(result.index("Аня — 3"), result.index("Борис — 1"))

    @patch.object(country_bot, "send")
    def test_non_allowlisted_user_cannot_start_or_read_score(self, send):
        country_bot.ALLOWED_USERS = {11, 22}
        message = {"chat": {"id": 999}, "from": {"id": 33, "first_name": "Чужой"}, "text": "/newgame"}
        country_bot.handle("token", message)
        self.assertNotIn(999, country_bot.GAMES)
        send.assert_not_called()
        message["text"] = "/score"
        country_bot.handle("token", message)
        send.assert_not_called()

    @patch.object(country_bot, "send")
    def test_allowed_users_can_obtain_own_id_for_setup(self, send):
        message = {"chat": {"id": 999}, "from": {"id": 11, "first_name": "Аня"}, "text": "/myid"}
        country_bot.handle("token", message)
        self.assertIn("11", send.call_args.args[2])


if __name__ == "__main__":
    unittest.main()

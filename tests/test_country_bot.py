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
    def test_text_replies_include_persistent_keyboard(self, api_call):
        country_bot.send("token", 123, "Меню")
        payload = api_call.call_args.args[2]
        import json
        markup = json.loads(payload["reply_markup"])
        self.assertTrue(markup["is_persistent"])
        self.assertIn("🎮 Новая игра", [b["text"] for row in markup["keyboard"] for b in row])

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

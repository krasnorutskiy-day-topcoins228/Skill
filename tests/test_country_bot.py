import unittest
from unittest.mock import patch

import country_bot


class CountryBotTests(unittest.TestCase):
    def test_full_country_dataset_has_flags_capitals_and_clues(self):
        self.assertGreaterEqual(len(country_bot.COUNTRIES), 200)
        flags = set()
        for record in country_bot.COUNTRIES:
            self.assertEqual(len(record), 4)
            self.assertTrue(all(isinstance(value, str) and value for value in record))
            flags.add(record[1])
        self.assertEqual(len(flags), len(country_bot.COUNTRIES))

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

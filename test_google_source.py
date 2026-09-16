import io
import unittest
import urllib.error
from unittest.mock import patch

import server
import pandas as pd


class Response:
    def __init__(self, body: bytes, content_type="text/csv"):
        self.body = body
        self.headers = {"Content-Type": content_type}

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self.body


class GoogleSourceTests(unittest.TestCase):
    def test_resolves_browser_collapsed_question_spaces(self):
        frame = pd.DataFrame(columns=["2. ¿Qué marca SUV  asociarías con tecnología?"])
        self.assertEqual(
            server.resolve_column(frame, "2. ¿Qué marca SUV asociarías con tecnología?"),
            "2. ¿Qué marca SUV  asociarías con tecnología?",
        )

    @patch("server.urllib.request.urlopen")
    def test_reads_public_csv(self, urlopen):
        urlopen.return_value = Response("Nombre,Edad\nAna,30\n".encode("utf-8"))
        frame = server.read_google_csv("https://example.test/export")
        self.assertEqual(frame.to_dict("records"), [{"Nombre": "Ana", "Edad": 30}])

    @patch("server.urllib.request.urlopen")
    def test_explains_private_sheet(self, urlopen):
        urlopen.side_effect = urllib.error.HTTPError(
            "https://example.test/export", 401, "Unauthorized", {}, io.BytesIO()
        )
        with self.assertRaisesRegex(ValueError, "Cualquier persona con el enlace"):
            server.read_google_csv("https://example.test/export")

    @patch("server.urllib.request.urlopen")
    def test_detects_login_page(self, urlopen):
        urlopen.return_value = Response(b"<html>accounts.google.com signin</html>", "text/html")
        with self.assertRaisesRegex(ValueError, "inicio de sesi.n"):
            server.read_google_csv("https://example.test/export")


if __name__ == "__main__":
    unittest.main()

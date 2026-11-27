import sqlite3

import pytest
from fastapi.testclient import TestClient

from prelegal_backend.config import Settings


def login(client: TestClient, email: str, password: str = "anything"):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_any_credentials_are_accepted(client: TestClient) -> None:
    res = login(client, "jane@example.com", "wrong-or-right")
    assert res.status_code == 200
    assert res.json() == {"id": 1, "email": "jane@example.com"}


def test_user_is_stored(client: TestClient, settings: Settings) -> None:
    login(client, "jane@example.com")
    conn = sqlite3.connect(settings.database_path)
    try:
        assert conn.execute("SELECT email FROM users").fetchall() == [("jane@example.com",)]
    finally:
        conn.close()


def test_repeat_login_returns_same_user(client: TestClient) -> None:
    first = login(client, "jane@example.com").json()
    assert login(client, "  JANE@example.com ").json() == first
    assert login(client, "bob@example.com").json()["id"] != first["id"]


@pytest.mark.parametrize(
    "body",
    [
        {"email": "not-an-email", "password": "x"},
        {"email": "", "password": "x"},
        {"email": "jane@example.com", "password": ""},
        {"email": "jane@example.com"},
    ],
)
def test_invalid_input_is_rejected(client: TestClient, body: dict) -> None:
    assert client.post("/api/auth/login", json=body).status_code == 422

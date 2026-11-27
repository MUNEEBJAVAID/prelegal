import sqlite3

import pytest
from conftest import PASSWORD, sign_up
from fastapi.testclient import TestClient

from prelegal_backend.auth import COOKIE, hash_password, verify_password
from prelegal_backend.config import Settings


def login(client: TestClient, email: str = "jane@example.com", password: str = PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_signup_creates_user_and_signs_in(client: TestClient) -> None:
    res = sign_up(client, " Jane@Example.com ")
    assert res.status_code == 201
    assert res.json() == {"id": 1, "email": "jane@example.com"}
    cookie = res.headers["set-cookie"]
    assert f"{COOKIE}=" in cookie and "HttpOnly" in cookie and "samesite=lax" in cookie.lower()
    assert client.get("/api/auth/me").json() == {"id": 1, "email": "jane@example.com"}


def test_password_is_hashed(client: TestClient, settings: Settings) -> None:
    sign_up(client)
    conn = sqlite3.connect(settings.database_path)
    try:
        (stored,) = conn.execute("SELECT password_hash FROM users").fetchone()
    finally:
        conn.close()
    assert PASSWORD not in stored and stored.startswith("scrypt$")
    assert verify_password(PASSWORD, stored)


def test_duplicate_signup_is_409(client: TestClient) -> None:
    sign_up(client)
    res = sign_up(client, "JANE@example.com", "another password")
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"]


def test_login_with_correct_password(client: TestClient) -> None:
    sign_up(client)
    client.post("/api/auth/logout")
    res = login(client, "JANE@example.com")
    assert res.status_code == 200
    assert res.json()["email"] == "jane@example.com"
    assert client.get("/api/auth/me").status_code == 200


@pytest.mark.parametrize(("email", "password"), [("jane@example.com", "wrong password"), ("bob@example.com", PASSWORD)])
def test_bad_credentials_get_the_same_401(client: TestClient, email: str, password: str) -> None:
    sign_up(client)
    client.post("/api/auth/logout")
    res = login(client, email, password)
    assert res.status_code == 401
    assert res.json() == {"detail": "Incorrect email or password."}
    assert client.get("/api/auth/me").status_code == 401


def test_logout_ends_the_session(user_client: TestClient, settings: Settings) -> None:
    assert user_client.post("/api/auth/logout").status_code == 204
    assert user_client.get("/api/auth/me").status_code == 401
    conn = sqlite3.connect(settings.database_path)
    try:
        assert conn.execute("SELECT COUNT(*) FROM sessions").fetchone() == (0,)
    finally:
        conn.close()


def test_me_without_session_is_401(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.set(COOKIE, "forged")
    assert client.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize(
    "body",
    [
        {"email": "not-an-email", "password": PASSWORD},
        {"email": "jane@example", "password": PASSWORD},
        {"email": "", "password": PASSWORD},
        {"email": "jane@example.com", "password": "short"},
        {"email": "jane@example.com"},
    ],
)
def test_invalid_signup_is_rejected(client: TestClient, body: dict) -> None:
    assert client.post("/api/auth/signup", json=body).status_code == 422


def test_verify_password_rejects_malformed_hashes() -> None:
    assert verify_password("x", hash_password("x"))
    assert not verify_password("y", hash_password("x"))
    assert not verify_password("x", "garbage")
    assert not verify_password("x", "bcrypt$00$00")


def test_sessions_expire_on_the_server(user_client: TestClient, settings: Settings) -> None:
    conn = sqlite3.connect(settings.database_path)
    try:
        with conn:
            conn.execute("UPDATE sessions SET created_at = '2000-01-01T00:00:00Z'")
    finally:
        conn.close()
    assert user_client.get("/api/auth/me").status_code == 401

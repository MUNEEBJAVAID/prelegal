import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from prelegal_backend.config import Settings
from prelegal_backend.main import create_app


def test_health(client: TestClient) -> None:
    assert client.get("/api/health").json() == {"status": "ok"}


def test_serves_static_frontend(client: TestClient) -> None:
    assert "login" in client.get("/").text
    assert "nda" in client.get("/nda/").text


def test_unknown_api_route_is_404(client: TestClient) -> None:
    assert client.get("/api/nope").status_code == 404


def test_runs_without_frontend_build(settings: Settings, tmp_path: Path) -> None:
    missing = Settings(database_path=settings.database_path, frontend_dir=tmp_path / "missing")
    with TestClient(create_app(missing)) as c:
        assert c.get("/api/health").status_code == 200
        assert c.get("/").status_code == 404


def test_database_is_recreated_on_every_start(settings: Settings) -> None:
    with TestClient(create_app(settings)) as c:
        c.post("/api/auth/login", json={"email": "a@example.com", "password": "x"})
    with TestClient(create_app(settings)):
        conn = sqlite3.connect(settings.database_path)
        try:
            assert conn.execute("SELECT COUNT(*) FROM users").fetchone() == (0,)
        finally:
            conn.close()

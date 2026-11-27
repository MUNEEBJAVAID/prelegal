from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from prelegal_backend.config import Settings
from prelegal_backend.main import create_app


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    frontend = tmp_path / "out"
    (frontend / "nda").mkdir(parents=True)
    (frontend / "index.html").write_text("<h1>login</h1>")
    (frontend / "nda" / "index.html").write_text("<h1>nda</h1>")
    return Settings(database_path=tmp_path / "data" / "test.db", frontend_dir=frontend)


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as c:  # `with` runs the lifespan (DB init)
        yield c

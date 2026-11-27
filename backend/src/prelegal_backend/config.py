"""Runtime settings, read from environment variables with local-dev defaults."""

import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent


@dataclass(frozen=True)
class Settings:
    database_path: Path
    """Static frontend build (Next.js `output: "export"`); not served if missing."""
    frontend_dir: Path

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            database_path=Path(os.environ.get("DATABASE_PATH", BACKEND_DIR / "data" / "prelegal.db")),
            frontend_dir=Path(os.environ.get("FRONTEND_DIR", REPO_DIR / "frontend" / "out")),
        )

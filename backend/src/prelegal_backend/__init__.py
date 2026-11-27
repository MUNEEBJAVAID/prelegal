"""Prelegal backend."""

import os


def main() -> None:
    """Runs the API server (`uv run prelegal-backend`)."""
    import uvicorn

    from .config import REPO_DIR

    env_file = REPO_DIR / ".env"  # OPENROUTER_API_KEY etc.

    uvicorn.run(
        "prelegal_backend.main:create_app",
        factory=True,
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8000")),
        env_file=env_file if env_file.is_file() else None,
    )

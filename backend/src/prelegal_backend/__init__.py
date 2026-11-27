"""Prelegal backend."""

import os


def main() -> None:
    """Runs the API server (`uv run prelegal-backend`)."""
    import uvicorn

    uvicorn.run(
        "prelegal_backend.main:create_app",
        factory=True,
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8000")),
    )

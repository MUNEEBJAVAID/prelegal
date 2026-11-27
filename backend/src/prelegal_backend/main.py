"""FastAPI application: JSON API under /api, static frontend everywhere else."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import auth, chat, drafts
from .config import Settings
from .db import init_db
from .llm import StructuredLLM, complete_structured, warm_up


class FrontendFiles(StaticFiles):
    """The static export, plus Next's prefetch requests for page segments.

    `next build` writes a page's segment data to `__next.<segment>/__PAGE__.txt`,
    while the client router asks for `__next.<segment>.__PAGE__.txt`.
    """

    def lookup_path(self, path: str):
        full_path, stat = super().lookup_path(path)
        if stat is None and path.endswith(".__PAGE__.txt"):
            return super().lookup_path(path.removesuffix(".__PAGE__.txt") + "/__PAGE__.txt")
        return full_path, stat


def create_app(settings: Settings | None = None, llm: StructuredLLM | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        init_db(settings.database_path)
        if app.state.llm is complete_structured:
            warm_up()
        yield

    app = FastAPI(title="Prelegal", lifespan=lifespan)
    app.state.settings = settings
    app.state.llm = llm or complete_structured

    @app.get("/api/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router)
    app.include_router(chat.router)
    app.include_router(drafts.router)

    # Mounted last so it never shadows an API route.
    if settings.frontend_dir.is_dir():
        app.mount("/", FrontendFiles(directory=settings.frontend_dir, html=True), name="frontend")

    return app

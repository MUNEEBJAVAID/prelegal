"""Structured LLM calls: gpt-oss-120b on Cerebras, via OpenRouter and LiteLLM.

Every call returns a validated Pydantic model (Structured Outputs), so callers
never parse free text. The app holds the callable in `app.state.llm`, which
tests replace with a fake.
"""

import logging
import os
import threading
from collections.abc import Callable
from typing import Any, TypeVar

from pydantic import BaseModel

log = logging.getLogger(__name__)

MODEL = "openrouter/openai/gpt-oss-120b"
# Route to Cerebras only (OpenRouter provider routing).
PROVIDER = {"order": ["cerebras"], "allow_fallbacks": False}

T = TypeVar("T", bound=BaseModel)
Message = dict[str, str]
StructuredLLM = Callable[[list[Message], type[T]], T]


def warm_up() -> None:
    """Imports LiteLLM in the background (~15s) so the first chat reply isn't delayed by it."""

    def _import() -> None:
        import litellm  # noqa: F401

    threading.Thread(target=_import, name="litellm-warm-up", daemon=True).start()


class LLMError(Exception):
    """The model could not produce a valid answer. The message is safe to show users."""


def complete_structured(messages: list[Message], schema: type[T]) -> T:
    if not os.environ.get("OPENROUTER_API_KEY"):
        raise LLMError("The AI assistant isn't configured (OPENROUTER_API_KEY is missing).")

    import litellm  # Imported lazily: it is slow to import and unused by most requests.

    try:
        response: Any = litellm.completion(
            model=MODEL,
            messages=messages,
            response_format=schema,
            extra_body={"provider": PROVIDER},
            reasoning_effort="low",
            timeout=60,
        )
        return schema.model_validate_json(response.choices[0].message.content)
    except Exception as e:  # Network, provider, rate-limit or schema-validation failures.
        log.exception("LLM call failed")
        raise LLMError("The AI assistant is unavailable right now. Please try again.") from e

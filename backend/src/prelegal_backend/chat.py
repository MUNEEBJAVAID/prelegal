"""AI drafting chat for every supported document type.

The frontend sends the conversation, the selected document type (if any) and
that document's current field values. The model replies conversationally,
picks the document type once the user's need is clear, and returns field
updates as Structured Outputs. Updates are filtered to the document's fields.
"""

import json
from datetime import date
from functools import cache
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, create_model

from .auth import CurrentUser
from .documents import DocumentType, FieldDef, Registry, registry
from .llm import LLMError

router = APIRouter(prefix="/api", tags=["chat"])

MAX_MESSAGES = 60


class Strict(BaseModel):
    # additionalProperties: false, as Structured Outputs' strict mode requires.
    model_config = ConfigDict(extra="forbid")


class FieldUpdate(Strict):
    field: str = Field(description="A field key of the current document, e.g. 'provider.company'")
    value: str = Field(description="The new value as text (dates YYYY-MM-DD, numbers as digits)")


@cache
def turn_model(ids: tuple[str, ...]) -> type[Strict]:
    """The model's answer schema. documentType is constrained to the supported ids."""
    return create_model(
        "ChatTurn",
        __base__=Strict,
        reply=(str, Field(description="Your next chat message to the user (plain text, concise)")),
        documentType=(
            Literal[ids] | None,  # type: ignore[valid-type]
            Field(description="The document being drafted, once agreed with the user; otherwise null"),
        ),
        updates=(list[FieldUpdate], Field(description="Only the fields that change in this turn")),
    )


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    documentType: str | None = None
    values: dict[str, str] = Field(default_factory=dict, max_length=200)


class ChatResponse(BaseModel):
    reply: str
    documentType: str | None
    updates: list[FieldUpdate]


SYSTEM_PROMPT = """\
You are Prelegal's drafting assistant. You help the user pick the right legal document and \
fill it in through a friendly, efficient conversation. Documents are based on Common Paper \
standard agreements: the Standard Terms are fixed; you fill in the cover page fields.

Supported documents (id: name - when to use it):
{catalog}

Choosing the document:
- If no document is selected yet, find out what the user needs. When it clearly matches a \
supported document, confirm it briefly and set documentType to its id.
- If the user wants a document that isn't supported (for example an employment contract, a lease \
or a will), explain that Prelegal can't generate that document yet, suggest the closest supported \
document and why it might fit, and set documentType only once they agree. If nothing is close, say so.
- Don't switch away from the current document unless the user asks to.

Filling in fields:
- Ask about missing information a topic or two at a time, starting with the parties. Keep replies \
short; don't list every field at once. Required fields come first; offer optional ones briefly.
- Fill fields only from what the user has said or clearly confirmed, including earlier in the \
conversation. Never invent names, addresses, dates or amounts. If something is ambiguous, ask.
- Use details as soon as the user gives them: a company name they mention is that party's \
company, even if it might not be the full legal name (the user can correct it later). Don't ask \
again for information you just filled in.
- In `updates`, include only fields of the current document that change in this turn, using \
the exact field keys listed below. Dates are YYYY-MM-DD (today is {today}); numbers are digits; \
choice fields take one of the listed options.
- When every required field is filled, say so briefly and tell the user they can review the \
preview and download the document as PDF, Word or Markdown from the top bar.
- You explain what terms mean but don't give legal advice; suggest a lawyer for that.

{current}"""


def describe_field(f: FieldDef, value: str) -> str:
    parts = [f"- {f.key} ({f.label}; {f.kind}{', required' if f.required else ', optional'})"]
    if f.options:
        parts.append(f"options: {' | '.join(f.options)}")
    if f.description:
        parts.append(f.description)
    parts.append(f"current value: {json.dumps(value) if value else '(empty)'}")
    return " - ".join(parts)


JUST_SELECTED = """

This document has just been selected. Before you reply, put every value the user has already \
given anywhere in the conversation into `updates`. For example, if they named the companies, set \
the matching "<party>.company" fields; if they gave a start date, set the date field. Then ask \
only about what is still missing."""


def build_system_prompt(
    reg: Registry, doc: DocumentType | None, values: dict[str, str], just_selected: bool = False
) -> str:
    catalog = "\n".join(f"- {d.id}: {d.name} - {d.description}" for d in reg.documents)
    if doc:
        fields = "\n".join(describe_field(f, values.get(f.key, "")) for f in doc.fields)
        current = f"Current document: {doc.name} ({doc.id}). Its fields:\n{fields}"
        if just_selected:
            current += JUST_SELECTED
    else:
        current = "No document is selected yet."
    return SYSTEM_PROMPT.format(catalog=catalog, today=date.today().isoformat(), current=current)


def valid_updates(doc: DocumentType | None, updates: list[FieldUpdate]) -> list[FieldUpdate]:
    """Drops updates for unknown fields and values that don't fit the field's kind."""
    if not doc:
        return []
    fields = {f.key: f for f in doc.fields}
    result = []
    for u in updates:
        f = fields.get(u.field)
        value = u.value.strip()
        if not f:
            continue
        if f.kind == "choice" and value not in f.options:
            continue
        if f.kind == "number" and not value.isdigit():
            continue
        if f.kind == "date" and value:
            try:
                date.fromisoformat(value)
            except ValueError:
                continue
        result.append(FieldUpdate(field=u.field, value=value))
    return result


@router.post("/chat")
def chat(body: ChatRequest, request: Request, user: CurrentUser) -> ChatResponse:
    reg = registry()
    schema = turn_model(tuple(reg.ids))
    history = [m.model_dump() for m in body.messages]

    def ask(doc: DocumentType | None, values: dict[str, str], just_selected: bool = False) -> Any:
        system = build_system_prompt(reg, doc, values, just_selected)
        return request.app.state.llm([{"role": "system", "content": system}, *history], schema)

    current = reg.get(body.documentType)
    try:
        turn = ask(current, body.values)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    doc = reg.get(turn.documentType) or current
    if doc and doc is not current:
        # The model chose a document without seeing its fields. Ask again with them, so details
        # the user already gave (party names, dates, ...) are filled in this same turn.
        try:
            turn = ask(doc, {}, just_selected=True)
            doc = reg.get(turn.documentType) or doc
        except LLMError:
            pass  # Keep the first answer: the document is chosen, fields fill in next turn.
    return ChatResponse(
        reply=turn.reply,
        documentType=doc.id if doc else None,
        updates=valid_updates(doc, turn.updates),
    )

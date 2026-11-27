"""AI chat that drafts a Mutual NDA.

The frontend sends the conversation plus the document's current field values.
The model replies conversationally and returns field updates as Structured
Outputs; the frontend applies the non-null updates to the draft.
"""

import json
from datetime import date
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from .llm import LLMError

router = APIRouter(prefix="/api/chat", tags=["chat"])

MAX_MESSAGES = 60


class Strict(BaseModel):
    # additionalProperties: false, as Structured Outputs' strict mode requires.
    model_config = ConfigDict(extra="forbid")


class PartyUpdate(Strict):
    company: str | None
    name: str | None = Field(description="Name of the person signing")
    title: str | None = Field(description="Job title of the person signing")
    noticeAddress: str | None = Field(description="Email or postal address for legal notices")


class NdaUpdates(Strict):
    """Every field is required but nullable: null means "leave unchanged"."""

    purpose: str | None = Field(description="How Confidential Information may be used")
    effectiveDate: str | None = Field(description="ISO date, YYYY-MM-DD")
    mndaTermType: Literal["expires", "until-terminated"] | None
    mndaTermYears: int | None = Field(description="1-99; used when mndaTermType is 'expires'")
    confidentialityType: Literal["years", "perpetuity"] | None
    confidentialityYears: int | None = Field(description="1-99; used when confidentialityType is 'years'")
    governingLaw: str | None = Field(description="Governing law, e.g. a US state such as 'Delaware'")
    jurisdiction: str | None = Field(description="Courts with jurisdiction, e.g. 'courts located in New Castle, DE'")
    modifications: str | None = Field(description="Changes to the Standard Terms; empty string for none")
    party1: PartyUpdate | None
    party2: PartyUpdate | None


class NdaChatTurn(Strict):
    reply: str = Field(description="Your next chat message to the user (plain text, concise)")
    updates: NdaUpdates


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class NdaChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    document: dict[str, Any] = Field(description="The draft's current field values (NdaData)")


SYSTEM_PROMPT = """\
You are Prelegal's drafting assistant. You help the user complete a Common Paper \
Mutual Non-Disclosure Agreement (MNDA) through a friendly, efficient conversation.

The MNDA has a Cover Page with these fields (the Standard Terms are fixed and can't be edited):
- party1 / party2: each party's company, signer name, signer title and notice address.
- purpose: how Confidential Information may be used.
- effectiveDate: the date the MNDA starts.
- mndaTermType + mndaTermYears: the MNDA expires after N years, or continues until terminated.
- confidentialityType + confidentialityYears: confidential information is protected for N years \
(trade secrets for as long as they remain trade secrets), or in perpetuity.
- governingLaw (a state) and jurisdiction (which courts).
- modifications: optional changes to the Standard Terms.

How to behave:
- Ask about missing information a topic or two at a time, starting with the parties. \
Keep replies short; don't list every field at once.
- Fill fields only from what the user has said or clearly confirmed. Never invent names, \
addresses or dates. If something is ambiguous, ask.
- In `updates`, set only fields that change in this turn; use null for everything else. \
For party1/party2, use null for the whole party when nothing about it changes.
- Dates are YYYY-MM-DD. Today is {today}. Year counts are whole numbers from 1 to 99.
- Sensible defaults already in the draft (such as 1-year terms) can be confirmed with the user \
rather than asked about from scratch.
- When every required field is filled, say so briefly and tell the user they can review the \
preview and download it as PDF, Word or Markdown from the top bar.
- You explain what terms mean but don't give legal advice; suggest a lawyer for that.
- Only the Mutual NDA is supported for now. If the user asks for another document, say so politely.

The draft's current values (JSON):
{document}
"""


@router.post("/nda")
def nda_chat(body: NdaChatRequest, request: Request) -> NdaChatTurn:
    system = SYSTEM_PROMPT.format(today=date.today().isoformat(), document=json.dumps(body.document, indent=2))
    messages = [{"role": "system", "content": system}, *(m.model_dump() for m in body.messages)]
    try:
        return request.app.state.llm(messages, NdaChatTurn)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

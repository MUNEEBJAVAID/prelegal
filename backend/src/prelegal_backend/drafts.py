"""A user's saved documents: the draft's type, field values and chat, stored per user.

Every route is scoped to the signed-in user; another user's document is a 404.
"""

import json
import sqlite3
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from .auth import CurrentUser
from .db import connect
from .documents import registry

router = APIRouter(prefix="/api/documents", tags=["documents"])


class StoredMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)
    # Field labels the assistant changed in this turn; omitted when there are none.
    updated: list[str] | None = Field(default=None, max_length=200, exclude_if=lambda v: v is None)


class DocumentIn(BaseModel):
    documentType: str | None = None
    values: dict[str, str] = Field(default_factory=dict, max_length=200)
    messages: list[StoredMessage] = Field(default_factory=list, max_length=500)


class DocumentSummary(BaseModel):
    id: int
    documentType: str | None
    title: str
    createdAt: str
    updatedAt: str


class DocumentOut(DocumentSummary):
    values: dict[str, str]
    messages: list[StoredMessage]


def make_title(document_type: str | None, values: dict[str, str]) -> str:
    """E.g. "Cloud Service Agreement · Acme Inc & Beta Corp"."""
    doc = registry().get(document_type)
    if not doc:
        return "Untitled draft"
    companies = [values.get(f.key, "").strip() for f in doc.fields if f.key.endswith(".company")]
    named = " & ".join(c for c in companies if c)
    return f"{doc.name} · {named}" if named else doc.name


def _validated(body: DocumentIn) -> DocumentIn:
    if body.documentType is not None and not registry().get(body.documentType):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unknown document type.")
    return body


SUMMARY_COLUMNS = "id, document_type, title, created_at, updated_at"


def _summary(row: sqlite3.Row) -> DocumentSummary:
    return DocumentSummary(
        id=row["id"],
        documentType=row["document_type"],
        title=row["title"],
        createdAt=row["created_at"],
        updatedAt=row["updated_at"],
    )


def _full(row: sqlite3.Row) -> DocumentOut:
    return DocumentOut(
        **_summary(row).model_dump(),
        values=json.loads(row["values_json"]),
        messages=json.loads(row["messages_json"]),
    )


def _db(request: Request):
    return connect(request.app.state.settings.database_path)


def _dump(body: DocumentIn) -> tuple[str | None, str, str, str]:
    return (
        body.documentType,
        make_title(body.documentType, body.values),
        json.dumps(body.values),
        json.dumps([m.model_dump() for m in body.messages]),
    )


@router.get("")
def list_documents(user: CurrentUser, request: Request) -> list[DocumentSummary]:
    with _db(request) as conn:
        rows = conn.execute(
            f"SELECT {SUMMARY_COLUMNS} FROM documents WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
            (user.id,),
        ).fetchall()
    return [_summary(r) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_document(body: DocumentIn, user: CurrentUser, request: Request) -> DocumentOut:
    with _db(request) as conn:
        row = conn.execute(
            "INSERT INTO documents (user_id, document_type, title, values_json, messages_json) "
            "VALUES (?, ?, ?, ?, ?) RETURNING *",
            (user.id, *_dump(_validated(body))),
        ).fetchone()
    return _full(row)


@router.get("/{doc_id}")
def get_document(doc_id: int, user: CurrentUser, request: Request) -> DocumentOut:
    with _db(request) as conn:
        row = conn.execute("SELECT * FROM documents WHERE id = ? AND user_id = ?", (doc_id, user.id)).fetchone()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return _full(row)


@router.put("/{doc_id}")
def update_document(doc_id: int, body: DocumentIn, user: CurrentUser, request: Request) -> DocumentOut:
    with _db(request) as conn:
        row = conn.execute(
            "UPDATE documents SET document_type = ?, title = ?, values_json = ?, messages_json = ?, "
            "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND user_id = ? RETURNING *",
            (*_dump(_validated(body)), doc_id, user.id),
        ).fetchone()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return _full(row)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(doc_id: int, user: CurrentUser, request: Request) -> Response:
    with _db(request) as conn:
        deleted = conn.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (doc_id, user.id)).rowcount
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

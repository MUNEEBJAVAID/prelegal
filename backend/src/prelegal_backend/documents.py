"""The registry of supported document types (`documents.json` at the repo root).

The frontend reads the same file at build time; keep `expand_fields` in sync
with `frontend/src/lib/registry.ts`.
"""

import json
import os
from functools import cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from .config import REPO_DIR

FieldKind = Literal["text", "longtext", "date", "number", "choice"]

PARTY_FIELDS = (
    ("company", "company", "Legal name of the company"),
    ("name", "signer name", "Name of the person signing"),
    ("title", "signer title", "Job title of the person signing"),
    ("noticeAddress", "notice address", "Email or postal address for legal notices"),
)


class FieldDef(BaseModel):
    key: str
    label: str
    kind: FieldKind = "text"
    required: bool = False
    description: str = ""
    options: list[str] = []
    refs: list[str] = []


class DocumentType(BaseModel):
    id: str
    name: str
    shortName: str
    description: str
    template: str
    kind: Literal["nda", "generic"] = "generic"
    coverTitle: str = "Key Terms"
    parties: list[str] = []
    fields: list[FieldDef]


class Registry(BaseModel):
    documents: list[DocumentType]

    def get(self, doc_id: str | None) -> DocumentType | None:
        return next((d for d in self.documents if d.id == doc_id), None)

    @property
    def ids(self) -> list[str]:
        return [d.id for d in self.documents]


def party_key(role: str) -> str:
    return role[:1].lower() + role[1:].replace(" ", "")


def expand_fields(raw: dict, common: dict[str, dict]) -> list[dict]:
    """Party fields first, then the document's fields (string entries name common fields)."""
    fields = [
        {
            "key": f"{party_key(role)}.{key}",
            "label": f"{role} {label}",
            "kind": "text",
            "required": True,
            "description": desc,
        }
        for role in raw.get("parties", [])
        for key, label, desc in PARTY_FIELDS
    ]
    for f in raw["fields"]:
        fields.append({"key": f, **common[f]} if isinstance(f, str) else f)
    return fields


def load_registry(path: Path) -> Registry:
    data = json.loads(path.read_text(encoding="utf-8"))
    common = data.get("commonFields", {})
    return Registry(documents=[{**d, "fields": expand_fields(d, common)} for d in data["documents"]])


@cache
def registry() -> Registry:
    return load_registry(Path(os.environ.get("DOCUMENTS_PATH", REPO_DIR / "documents.json")))

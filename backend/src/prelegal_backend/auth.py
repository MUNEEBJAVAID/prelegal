"""Placeholder sign-in for the V1 foundation.

There is no real authentication yet: any email and password are accepted.
The user is recorded in the users table so the frontend, API and database
are wired together end to end.
"""

from typing import Annotated

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field, StringConstraints

from .db import connect

router = APIRouter(prefix="/api/auth", tags=["auth"])

Email = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, max_length=254, pattern=r"^[^@\s]+@[^@\s]+$"),
]


class LoginRequest(BaseModel):
    email: Email
    # Required so the form behaves like a real one, but never checked.
    password: str = Field(min_length=1)


class User(BaseModel):
    id: int
    email: str


@router.post("/login")
def login(body: LoginRequest, request: Request) -> User:
    with connect(request.app.state.settings.database_path) as conn:
        row = conn.execute(
            "INSERT INTO users (email) VALUES (?) "
            "ON CONFLICT (email) DO UPDATE SET email = excluded.email "
            "RETURNING id, email",
            (body.email,),
        ).fetchone()
    return User(id=row["id"], email=row["email"])

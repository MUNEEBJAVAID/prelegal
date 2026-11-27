"""Sign up, sign in and sessions.

Passwords are hashed with scrypt. A sign-in creates a random session token,
stored in the sessions table and sent to the browser as an HttpOnly cookie.
The database is rebuilt on every start, so restarting signs everyone out.
"""

import hashlib
import hmac
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field, StringConstraints

from .db import connect

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE = "prelegal_session"
SESSION_DAYS = 30
MIN_PASSWORD = 8

Email = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
]


class SignupRequest(BaseModel):
    email: Email
    password: str = Field(min_length=MIN_PASSWORD, max_length=200)


class LoginRequest(BaseModel):
    email: Email
    password: str = Field(min_length=1, max_length=200)


class User(BaseModel):
    id: int
    email: str


# scrypt parameters (n=2**14, r=8, p=1: about 16 MB and a few tens of ms per hash).
_N, _R, _P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt, digest = stored.split("$")
    except ValueError:
        return False
    if scheme != "scrypt":
        return False
    candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=_N, r=_R, p=_P)
    return hmac.compare_digest(candidate.hex(), digest)


# Compared against when the email is unknown, so both failures take the same time.
_DUMMY_HASH = hash_password(secrets.token_urlsafe())


def _start_session(request: Request, response: Response, user_id: int) -> None:
    token = secrets.token_urlsafe(32)
    with connect(request.app.state.settings.database_path) as conn:
        conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    response.set_cookie(
        COOKIE,
        token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
        path="/",
    )


def current_user(request: Request) -> User:
    """Dependency: the signed-in user, or 401."""
    token = request.cookies.get(COOKIE)
    if token:
        with connect(request.app.state.settings.database_path) as conn:
            row = conn.execute(
                "SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id "
                "WHERE sessions.token = ? AND sessions.created_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now', ?)",
                (token, f"-{SESSION_DAYS} days"),
            ).fetchone()
        if row:
            return User(id=row["id"], email=row["email"])
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Please sign in.")


CurrentUser = Annotated[User, Depends(current_user)]


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, request: Request, response: Response) -> User:
    with connect(request.app.state.settings.database_path) as conn:
        row = conn.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?) ON CONFLICT (email) DO NOTHING RETURNING id, email",
            (body.email, hash_password(body.password)),
        ).fetchone()
    if not row:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="An account with this email already exists. Sign in instead.")
    _start_session(request, response, row["id"])
    return User(id=row["id"], email=row["email"])


@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response) -> User:
    with connect(request.app.state.settings.database_path) as conn:
        row = conn.execute("SELECT id, email, password_hash FROM users WHERE email = ?", (body.email,)).fetchone()
    if not verify_password(body.password, row["password_hash"] if row else _DUMMY_HASH) or not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password.")
    _start_session(request, response, row["id"])
    return User(id=row["id"], email=row["email"])


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response) -> None:
    token = request.cookies.get(COOKIE)
    if token:
        with connect(request.app.state.settings.database_path) as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    response.delete_cookie(COOKIE, path="/")


@router.get("/me")
def me(user: CurrentUser) -> User:
    return user

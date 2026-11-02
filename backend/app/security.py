from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.config import get_settings

SESSION_COOKIE = "session"
_ALGORITHM = "HS256"
_hasher = PasswordHash.recommended()
# Verified against when the email is unknown, so login timing doesn't reveal accounts.
_DUMMY_HASH = _hasher.hash("timing-equaliser")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    return _hasher.verify(password, password_hash or _DUMMY_HASH) and password_hash is not None


def create_token(user_id: int) -> str:
    settings = get_settings()
    expires = datetime.now(UTC) + timedelta(minutes=settings.jwt_ttl_minutes)
    return jwt.encode({"sub": str(user_id), "exp": expires}, settings.jwt_secret, _ALGORITHM)


def decode_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=[_ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None

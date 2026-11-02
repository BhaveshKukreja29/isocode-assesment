from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import User
from app.models.enums import Role
from app.security import SESSION_COOKIE, decode_token

Session = Annotated[AsyncSession, Depends(get_session)]


async def optional_user(request: Request, session: Session) -> User | None:
    token = request.cookies.get(SESSION_COOKIE)
    user_id = decode_token(token) if token else None
    if user_id is None:
        return None
    user = await session.get(User, user_id)
    return user if user and user.is_active else None


async def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in")
    return user


def require_role(*roles: Role):
    async def dependency(user: Annotated[User, Depends(current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have access to this")
        return user

    return dependency


OptionalUser = Annotated[User | None, Depends(optional_user)]
CurrentUser = Annotated[User, Depends(current_user)]
StaffUser = Annotated[User, Depends(require_role(Role.CONSULTANT, Role.ADMIN))]
AdminUser = Annotated[User, Depends(require_role(Role.ADMIN))]


def not_found(what: str = "Not found") -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, what)

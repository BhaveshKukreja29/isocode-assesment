from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import func, select

from app.config import get_settings
from app.deps import OptionalUser, Session
from app.models import User
from app.models.enums import Role
from app.schemas.auth import LoginIn, RegisterIn, UserOut
from app.security import SESSION_COOKIE, create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def start_session(response: Response, user: User) -> None:
    settings = get_settings()
    response.set_cookie(
        SESSION_COOKIE,
        create_token(user.id),
        max_age=settings.jwt_ttl_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )


@router.post("/register", status_code=201, response_model=UserOut)
async def register(body: RegisterIn, session: Session, response: Response):
    email = body.email.lower()
    if await session.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(
        name=body.name,
        email=email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        role=Role.BUYER,
    )
    session.add(user)
    await session.commit()
    start_session(response, user)
    return user


@router.post("/login", response_model=UserOut)
async def login(body: LoginIn, session: Session, response: Response):
    user = await session.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    if not verify_password(body.password, user.password_hash if user else None) or not (
        user and user.is_active
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong email or password")
    start_session(response, user)
    return user


@router.post("/logout", status_code=204)
async def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE)


@router.get("/me", response_model=UserOut | None)
async def me(user: OptionalUser):
    return user

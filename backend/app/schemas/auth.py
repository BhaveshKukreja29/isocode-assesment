from typing import Annotated

from pydantic import BaseModel, EmailStr, StringConstraints

from app.models.enums import Role
from app.schemas.common import Name, Out, Phone

Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class RegisterIn(BaseModel):
    name: Name
    email: EmailStr
    phone: Phone
    password: Password


class LoginIn(BaseModel):
    email: EmailStr
    password: Annotated[str, StringConstraints(max_length=128)]


class UserOut(Out):
    id: int
    name: str
    email: str
    phone: str | None
    role: Role
    showroom_id: int | None
    marketing_opt_out: bool

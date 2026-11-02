from sqlalchemy import Column, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, Timestamped
from app.models.catalog import CarModel, Showroom
from app.models.enums import Role, db_enum

consultant_models = Table(
    "consultant_models",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("model_id", ForeignKey("car_models.id", ondelete="CASCADE"), primary_key=True),
)


class User(Timestamped, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(10))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(db_enum(Role), default=Role.BUYER)
    showroom_id: Mapped[int | None] = mapped_column(ForeignKey("showrooms.id"))
    is_active: Mapped[bool] = mapped_column(default=True)
    marketing_opt_out: Mapped[bool] = mapped_column(default=False)

    showroom: Mapped[Showroom | None] = relationship()
    # Models a consultant specialises in; empty means "sells everything".
    models: Mapped[list[CarModel]] = relationship(secondary=consultant_models)

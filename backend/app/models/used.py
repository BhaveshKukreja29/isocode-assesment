from typing import Any

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, Timestamped
from app.models.catalog import Showroom
from app.models.enums import Fuel, StockStatus, Transmission, db_enum


class UsedCar(Timestamped, Base):
    __tablename__ = "used_cars"
    __table_args__ = (
        Index("ix_used_cars_status_price", "status", "price"),
        Index("ix_used_cars_status_created", "status", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_id: Mapped[str] = mapped_column(String(20), unique=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    make: Mapped[str] = mapped_column(String(40))
    model: Mapped[str] = mapped_column(String(60), index=True)
    variant: Mapped[str] = mapped_column(String(60))
    fuel: Mapped[Fuel] = mapped_column(db_enum(Fuel))
    transmission: Mapped[Transmission] = mapped_column(db_enum(Transmission))
    year: Mapped[int]
    km: Mapped[int]
    owners: Mapped[int]
    colour: Mapped[str] = mapped_column(String(40))
    price: Mapped[int]
    status: Mapped[StockStatus] = mapped_column(db_enum(StockStatus), default=StockStatus.AVAILABLE)
    registration_no: Mapped[str] = mapped_column(String(12))  # never returned unmasked publicly
    showroom_id: Mapped[int] = mapped_column(ForeignKey("showrooms.id"))
    images: Mapped[list[Any]] = mapped_column(default=list)
    inspection: Mapped[dict[str, Any]] = mapped_column(default=dict)
    description: Mapped[str] = mapped_column(Text, default="")
    is_published: Mapped[bool] = mapped_column(default=True)

    showroom: Mapped[Showroom] = relationship(lazy="joined")

    @property
    def image(self) -> str | None:
        return self.images[0] if self.images else None

    @property
    def location(self) -> str:
        return self.showroom.name

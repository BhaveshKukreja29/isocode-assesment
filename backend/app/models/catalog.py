from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from sqlalchemy import ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, Timestamped
from app.models.enums import Fuel, Transmission, db_enum


class City(Base):
    """A registration city. Its charges and tax slabs feed the on-road price."""

    __tablename__ = "cities"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    registration_fee: Mapped[int]
    fastag_fee: Mapped[int]
    insurance_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))  # % of ex-showroom

    tax_slabs: Mapped[list["RoadTaxSlab"]] = relationship(
        back_populates="city", cascade="all, delete-orphan", order_by="RoadTaxSlab.min_price"
    )


class RoadTaxSlab(Base):
    __tablename__ = "road_tax_slabs"

    id: Mapped[int] = mapped_column(primary_key=True)
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id", ondelete="CASCADE"), index=True)
    fuel: Mapped[Fuel] = mapped_column(db_enum(Fuel))
    min_price: Mapped[int] = mapped_column(default=0)
    max_price: Mapped[int | None]  # exclusive upper bound; None = no limit
    rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))  # % of ex-showroom

    city: Mapped[City] = relationship(back_populates="tax_slabs")


class Showroom(Base):
    __tablename__ = "showrooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id"))
    address: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(15))
    opens_at: Mapped[time]
    closes_at: Mapped[time]

    city: Mapped[City] = relationship(lazy="joined")


class CarModel(Timestamped, Base):
    __tablename__ = "car_models"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(60))
    body_type: Mapped[str] = mapped_column(String(30))
    tagline: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    images: Mapped[list[Any]] = mapped_column(default=list)
    highlights: Mapped[list[Any]] = mapped_column(default=list)
    is_published: Mapped[bool] = mapped_column(default=True)
    sort_order: Mapped[int] = mapped_column(default=0)

    variants: Mapped[list["Variant"]] = relationship(
        back_populates="model", cascade="all, delete-orphan", order_by="Variant.sort_order"
    )
    colours: Mapped[list["Colour"]] = relationship(cascade="all, delete-orphan")
    accessory_packs: Mapped[list["AccessoryPack"]] = relationship(
        cascade="all, delete-orphan", order_by="AccessoryPack.price"
    )


class Variant(Base):
    __tablename__ = "variants"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("car_models.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    fuel: Mapped[Fuel] = mapped_column(db_enum(Fuel))
    transmission: Mapped[Transmission] = mapped_column(db_enum(Transmission))
    specs: Mapped[dict[str, Any]] = mapped_column(default=dict)
    sort_order: Mapped[int] = mapped_column(default=0)
    is_active: Mapped[bool] = mapped_column(default=True)

    model: Mapped[CarModel] = relationship(back_populates="variants")
    prices: Mapped[list["VariantPrice"]] = relationship(cascade="all, delete-orphan")


class Colour(Base):
    __tablename__ = "colours"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("car_models.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(40))
    hex: Mapped[str] = mapped_column(String(7))


class AccessoryPack(Base):
    __tablename__ = "accessory_packs"

    id: Mapped[int] = mapped_column(primary_key=True)
    model_id: Mapped[int] = mapped_column(ForeignKey("car_models.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(60))
    items: Mapped[list[Any]] = mapped_column(default=list)
    price: Mapped[int]


class VariantPrice(Base):
    """Admin price table: one ex-showroom price per variant per city, with validity."""

    __tablename__ = "variant_prices"
    __table_args__ = (UniqueConstraint("variant_id", "city_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("variants.id", ondelete="CASCADE"))
    city_id: Mapped[int] = mapped_column(ForeignKey("cities.id", ondelete="CASCADE"), index=True)
    ex_showroom: Mapped[int]
    valid_until: Mapped[date]
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

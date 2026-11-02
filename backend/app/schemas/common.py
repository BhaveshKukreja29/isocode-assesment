import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints

_PHONE_RE = re.compile(r"^[6-9]\d{9}$")


def normalise_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if not _PHONE_RE.match(digits):
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return digits


Phone = Annotated[str, AfterValidator(normalise_phone)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]
Slug = Annotated[str, StringConstraints(pattern=r"^[a-z0-9-]{1,80}$")]
Rupees = Annotated[int, Field(gt=0, lt=10_00_00_000)]


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int

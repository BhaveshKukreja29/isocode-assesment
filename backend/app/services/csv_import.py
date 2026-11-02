"""Parse and validate car-portal lead exports (CSV)."""

import csv
import io
from datetime import UTC, datetime
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, EmailStr, ValidationError

from app.schemas.common import Name, Phone, Text
from app.schemas.leads import RowError

MAX_ROWS = 2_000
COLUMNS = ("name", "phone", "email", "model", "message", "portal", "ref", "received_at")


def _blank_to_none(value: str | None) -> str | None:
    return value.strip() or None if isinstance(value, str) else value


Optional = Annotated[str | None, BeforeValidator(_blank_to_none)]


class PortalRow(BaseModel):
    name: Name
    phone: Phone
    email: Annotated[EmailStr | None, BeforeValidator(_blank_to_none)] = None
    model: Optional = None
    message: Text = ""
    portal: Name = "Portal"
    ref: Optional = None
    received_at: Annotated[datetime | None, BeforeValidator(_blank_to_none)] = None

    def received(self) -> datetime | None:
        if self.received_at is None:
            return None
        at = self.received_at if self.received_at.tzinfo else self.received_at.replace(tzinfo=UTC)
        return min(at, datetime.now(UTC))


def parse_csv(content: bytes) -> tuple[list[tuple[int, PortalRow]], list[RowError]]:
    """Returns (valid rows with their line numbers, per-row errors). Never raises on bad rows."""
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return [], [RowError(row=0, error="File must be UTF-8 encoded CSV")]

    reader = csv.DictReader(io.StringIO(text))
    headers = {h.strip().lower() for h in reader.fieldnames or []}
    missing = {"name", "phone"} - headers
    if missing:
        return [], [RowError(row=1, error=f"Missing column(s): {', '.join(sorted(missing))}")]

    rows, errors = [], []
    for line, raw in enumerate(reader, start=2):
        if line - 1 > MAX_ROWS:
            errors.append(RowError(row=line, error=f"Only the first {MAX_ROWS} rows are imported"))
            break
        data = {k.strip().lower(): v for k, v in raw.items() if k and k.strip().lower() in COLUMNS}
        try:
            rows.append((line, PortalRow.model_validate(data)))
        except ValidationError as exc:
            first = exc.errors()[0]
            field = ".".join(str(p) for p in first["loc"]) or "row"
            errors.append(RowError(row=line, error=f"{field}: {first['msg']}"))
    return rows, errors

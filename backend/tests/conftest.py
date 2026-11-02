import os

os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production-use-0123456789")
os.environ["GROQ_API_KEY"] = ""
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://dealer:dealer@localhost:5433/dealer_test"
)

import asyncpg  # noqa: E402
import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402


async def ensure_database(url: str) -> None:
    dsn = url.replace("+asyncpg", "")
    base, name = dsn.rsplit("/", 1)
    conn = await asyncpg.connect(f"{base}/postgres")
    try:
        if not await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", name):
            await conn.execute(f'CREATE DATABASE "{name}"')
    finally:
        await conn.close()


@pytest.fixture(scope="session")
async def seeded():
    """A freshly migrated database filled with the demo seed, shared by API tests."""
    await ensure_database(os.environ["DATABASE_URL"])
    from app.db import Base, engine
    from app.seed import seed

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await seed(reset=False)
    yield
    await engine.dispose()


@pytest.fixture
async def client(seeded):
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app), base_url="http://test/api") as c:
        yield c


@pytest.fixture
def login(client):
    async def _login(email: str, password: str = "Demo@1234") -> AsyncClient:
        response = await client.post("/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        return client

    return _login

import logging
from xml.sax.saxutils import escape

from fastapi import APIRouter, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import select, text

from app.config import get_settings
from app.deps import Session
from app.models import CarModel, UsedCar
from app.models.enums import StockStatus
from app.routers import account, admin, auth, catalog, enquiries, staff, used

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

settings = get_settings()
app = FastAPI(
    title="Company A Dealership API", docs_url="/api/docs", openapi_url="/api/openapi.json"
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")
for module in (auth, account, catalog, used, enquiries, staff, admin):
    api.include_router(module.router)


@api.get("/health", tags=["ops"])
async def health(session: Session):
    await session.execute(text("select 1"))
    return {"status": "ok"}


@api.get("/sitemap.xml", tags=["seo"], include_in_schema=False)
async def sitemap(session: Session):
    base = settings.public_site_url.rstrip("/")
    model_slugs = await session.scalars(select(CarModel.slug).where(CarModel.is_published))
    car_slugs = await session.scalars(
        select(UsedCar.slug).where(UsedCar.is_published, UsedCar.status != StockStatus.SOLD)
    )
    paths = ["/", "/cars", "/used-cars", "/test-drive"]
    paths += [f"/cars/{slug}" for slug in model_slugs]
    paths += [f"/used-cars/{slug}" for slug in car_slugs]
    urls = "".join(f"<url><loc>{escape(base + p)}</loc></url>" for p in paths)
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>'
    )
    return Response(body, media_type="application/xml")


app.include_router(api)

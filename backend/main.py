from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import CORS_ORIGINS

# ✅ new routers
from api import neighborhoods_new, risk_new, predict, reports

app = FastAPI(
    title="Crime Analysis API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https://crime-analysis-.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/hello")
async def hello():
    return {"message": "Crime Analysis backend is alive"}

# ✅ include new scope routers
app.include_router(neighborhoods_new.router)
app.include_router(risk_new.router)
app.include_router(predict.router)
app.include_router(reports.router)
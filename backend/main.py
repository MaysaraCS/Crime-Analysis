from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import CORS_ORIGINS
from api import auth, users, neighbourhoods, crimes, reports

app = FastAPI(
    title="Crime Analysis API",
    version="0.1.0",
)

# CORS for frontend dev (Vite on localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Used by you or your hosting provider to check that the API is alive."""
    return {"status": "ok"}


@app.get("/api/hello")
async def hello():
    """Simple test route to verify that FastAPI is running and reachable."""
    return {"message": "Crime Analysis backend is alive"}


# Include all routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(neighbourhoods.router)
app.include_router(crimes.router)
app.include_router(reports.router)
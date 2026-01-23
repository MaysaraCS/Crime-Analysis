from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import CORS_ORIGINS
from api import auth, users, neighbourhoods, crimes, reports

# Creates the main application instance with title and version
app = FastAPI(
    title="Crime Analysis API",
    version="0.1.0",
)

# CORS for frontend dev (Vite on localhost:5173) and Vercel deployments
# Allows frontend (localhost:5173 and Vercel) to make API requests
# allow_credentials=True enables sending cookies/auth headers
# allow_methods=["*"] allows all HTTP methods (GET, POST, PUT, DELETE)
# Regex pattern matches all Vercel preview deployments

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https://crime-analysis-.*\.vercel\.app",  # Matches all Vercel preview & branch deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GET /health - Simple endpoint to verify API is running
# Used by hosting platforms to monitor service status

@app.get("/health")
async def health_check():
    """Used by you or your hosting provider to check that the API is alive."""
    return {"status": "ok"}

# GET /api/hello - Verifies FastAPI is serving correctly

@app.get("/api/hello")
async def hello():
    """Simple test route to verify that FastAPI is running and reachable."""
    return {"message": "Crime Analysis backend is alive"}


# Include all routers
# Connects all route modules (auth, users, neighbourhoods, crimes, reports)
# Each router handles its own set of endpoints
# Organizes code into logical modules

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(neighbourhoods.router)
app.include_router(crimes.router)
app.include_router(reports.router)
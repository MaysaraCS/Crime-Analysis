import os
import sys
import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import CORS_ORIGINS

# Routers
from api import neighborhoods_new, risk_new, predict, reports
from api import auth, users


# ─────────────────────────────────────────────────────────────────────────────
# Safety-net: if risk_model.joblib is missing at Python startup, train it.
# On Render the start.sh script handles this BEFORE uvicorn starts, but this
# lifespan hook catches edge cases (e.g. manual uvicorn invocation locally).
# ─────────────────────────────────────────────────────────────────────────────
def _ensure_model_exists():
    model_path = os.path.join(os.path.dirname(__file__), "risk_model.joblib")
    if not os.path.exists(model_path):
        print("[startup] risk_model.joblib not found — running training script...")
        script_path = os.path.join(os.path.dirname(__file__), "train_risk_model.py")
        try:
            result = subprocess.run(
                [sys.executable, script_path],
                check=True,
                capture_output=True,
                text=True,
                timeout=600,
            )
            print("[startup] Training complete.")
            if result.stdout:
                print(result.stdout[-3000:])
        except subprocess.CalledProcessError as e:
            print(f"[startup] Training FAILED:\n{e.stderr}")
        except Exception as ex:
            print(f"[startup] Training ERROR: {ex}")
    else:
        print("[startup] risk_model.joblib found — ready.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _ensure_model_exists()
    yield


# ─────────────────────────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Crime Analysis API",
    version="2.0.0",
    lifespan=lifespan,
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


# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(neighborhoods_new.router)  # GET + POST /api/neighborhoods, POST /api/retrain
app.include_router(risk_new.router)           # GET /api/risk
app.include_router(predict.router)            # GET /api/predict
app.include_router(reports.router)            # GET /api/reports/season, /api/reports/export
app.include_router(auth.router)               # POST /auth/login, GET /auth/me
app.include_router(users.router)              # GET /api/users
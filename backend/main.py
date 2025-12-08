from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import get_db
from models import User
from auth import get_current_user

app = FastAPI(
    title="Crime Analysis API",
    version="0.1.0",
)

# CORS for frontend dev (Vite on localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Used by you or your hosting provider to check that the API is alive."""
    return {"status": "ok"}


@app.get("/debug/auth")
async def debug_auth(request: Request):
    """Temporary endpoint to inspect the Authorization header from the frontend."""
    return {"authorization": request.headers.get("authorization")}


@app.get("/api/hello")
async def hello():
    """Simple test route to verify that FastAPI is running and reachable."""
    return {"message": "Crime Analysis backend is alive"}


@app.get("/api/dashboard-summary")
async def dashboard_summary():
    """Placeholder data for the Dashboard page (Sprint 2 charts later)."""
    return {
        "total_neighbourhoods": 0,
        "total_crimes": 0,
        "last_updated": None,
    }


@app.get("/api/reports/summary")
async def reports_summary():
    """Placeholder data for the Report page (Admin + Ministry of Interior)."""
    return {
        "by_neighbourhood": [],
        "by_category": [],
    }


@app.post("/api/users/test-create")
async def create_test_user(db: Session = Depends(get_db)):
    """Temporary route to verify that Neon + the users table are working.

    Creates a dummy user row; call it once from /docs, then check in Neon.
    Remove this route later in production.
    """
    user = User(
        clerk_id="test_clerk_id",
        email="test@example.com",
        role="administrator",
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to insert test user")

    return {"id": user.id, "email": user.email, "role": user.role}


@app.get("/api/users")
async def list_users(db: Session = Depends(get_db)):
    """List all users in the users table (for debugging only)."""
    users = db.query(User).all()
    return [
        {"id": u.id, "clerk_id": u.clerk_id, "email": u.email, "role": u.role}
        for u in users
    ]


@app.get("/api/me")
async def read_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's info from the database.

    This is what the frontend will call to populate the role-aware profile page.
    """
    return {
        "id": current_user.id,
        "clerk_id": current_user.clerk_id,
        "email": current_user.email,
        "role": current_user.role,
    }

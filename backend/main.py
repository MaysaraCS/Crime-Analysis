from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User

app = FastAPI(
    title="Crime Analysis API",
    version="0.1.0",
)


# Dependency to get a DB session per request

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/health")
async def health_check():
    """Used by you or your hosting provider to check that the API is alive."""
    return {"status": "ok"}


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

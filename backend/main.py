from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime

from database import get_db
from models import User, Neighbourhood, CrimeCategory, CrimeWeight, CrimeFormData
from auth import get_current_user, create_access_token, authenticate_user

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


@app.get("/api/hello")
async def hello():
    """Simple test route to verify that FastAPI is running and reachable."""
    return {"message": "Crime Analysis backend is alive"}


@app.get("/api/dashboard-summary")
async def dashboard_summary(db: Session = Depends(get_db)):
    """Basic summary for the dashboard based on neighbourhood data."""
    total_neighbourhoods = db.query(Neighbourhood).count()
    total_population = sum(float(n.population) for n in db.query(Neighbourhood).all())

    return {
        "total_neighbourhoods": total_neighbourhoods,
        "total_population": total_population,
    }


@app.get("/api/neighbourhoods")
async def list_neighbourhoods(db: Session = Depends(get_db)):
    """Return all neighbourhood rows for use in dashboard charts."""
    rows = db.query(Neighbourhood).order_by(Neighbourhood.name).all()
    return [
        {
            "id": n.id,
            "name": n.name,
            "population": float(n.population) if n.population is not None else None,
            "income_level": n.income_level,
            "university_education_percent": float(n.university_education_percent) if n.university_education_percent is not None else None,
            "unemployment_percent": float(n.unemployment_percent) if n.unemployment_percent is not None else None,
            "unmarried_over_30_percent": float(n.unmarried_over_30_percent) if n.unmarried_over_30_percent is not None else None,
        }
        for n in rows
    ]


@app.get("/api/reports/summary")
async def reports_summary():
    """Placeholder data for the Report page (Admin + Ministry of Interior)."""
    return {
        "by_neighbourhood": [],
        "by_category": [],
    }


@app.get("/api/users")
async def list_users(db: Session = Depends(get_db)):
    """List all users in the users table (for debugging only)."""
    users = db.query(User).all()
    return [
        {"id": u.id, "email": u.email, "role": u.role}
        for u in users
    ]


@app.get("/api/crime/meta")
async def get_crime_meta(db: Session = Depends(get_db)):
    """Return main categories, their weights, and subcategories.

    This is used by the Insert page to populate dropdowns and checkboxes.
    """
    weights = db.query(CrimeWeight).all()
    categories = db.query(CrimeCategory).all()

    subs_by_main: dict[str, list[str]] = {}
    for c in categories:
        subs_by_main.setdefault(c.main_category, []).append(c.subcategory)

    result = []
    for w in weights:
        result.append({
            "main_category": w.main_category,
            "weight": w.weight,
            "subcategories": subs_by_main.get(w.main_category, []),
        })
    return result


class CrimeFormCreate(BaseModel):
    main_category: str
    subcategories: list[str]
    neighbourhood_name: str
    date: str  # ISO date string (YYYY-MM-DD)
    offender_income_level: str
    climate: str
    time_of_year: str


@app.post("/api/crime-form", status_code=201)
async def create_crime_form(
    payload: CrimeFormCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only General Statistic user can insert
    if current_user.role != "general_statistic":
        raise HTTPException(status_code=403, detail="Not authorized to insert crime data")

    weight_row = db.query(CrimeWeight).filter_by(main_category=payload.main_category).first()
    if not weight_row:
        raise Exception("Invalid main category: no weight defined")

    try:
        crime_date = datetime.fromisoformat(payload.date).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format; expected YYYY-MM-DD")

    record = CrimeFormData(
        main_category=payload.main_category,
        crime_weight=weight_row.weight,
        subcategories=", ".join(payload.subcategories),
        neighbourhood_name=payload.neighbourhood_name,
        date=crime_date,
        offender_income_level=payload.offender_income_level,
        climate=payload.climate,
        time_of_year=payload.time_of_year,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {"id": record.id, "message": "Data saved successfully"}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@app.post("/auth/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Basic email/password login for the 6 predefined users."""
    user = authenticate_user(db, req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # subject of the token is the user id
    token = create_access_token({"sub": str(user.id)})

    return {
        "token": token,
        "user": {"id": user.id, "email": user.email, "role": user.role},
        "message": "Login successful",
    }


@app.get("/api/me")
async def read_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's info from the database."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
    }

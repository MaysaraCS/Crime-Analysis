from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
from datetime import datetime
from io import BytesIO
from reportlab.pdfgen import canvas

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


@app.get("/api/reports/crime")
async def crime_report(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Crime report data per neighbourhood (for charts and tables)."""
    rows = db.execute(text("""
        SELECT
          n.name AS neighbourhood_name,
          n.population,
          n.university_education_percent,
          n.unmarried_over_30_percent,
          n.income_level,
          n.unemployment_percent,
          mc.main_category AS main_crime_category
        FROM neighbourhood n
        LEFT JOIN LATERAL (
          SELECT c.main_category, COUNT(*) AS cnt
          FROM crime_form_data c
          WHERE c.neighbourhood_name = n.name
          GROUP BY c.main_category
          ORDER BY cnt DESC, c.main_category
          LIMIT 1
        ) mc ON TRUE
    """)).mappings().all()
    return list(rows)


@app.get("/api/reports/general")
async def general_report(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """General analysis report data per neighbourhood."""
    rows = db.execute(text("""
        SELECT
          n.name AS neighbourhood_name,
          n.population,
          n.income_level,
          n.unemployment_percent,
          mc.main_category AS main_crime_category,
          cw.avg_weight AS avg_crime_weight
        FROM neighbourhood n
        LEFT JOIN LATERAL (
          SELECT c.main_category, COUNT(*) AS cnt
          FROM crime_form_data c
          WHERE c.neighbourhood_name = n.name
          GROUP BY c.main_category
          ORDER BY cnt DESC, c.main_category
          LIMIT 1
        ) mc ON TRUE
        LEFT JOIN LATERAL (
          SELECT AVG(c.crime_weight) AS avg_weight
          FROM crime_form_data c
          WHERE c.neighbourhood_name = n.name
        ) cw ON TRUE
    """)).mappings().all()
    return list(rows)


@app.get("/api/reports/export")
async def export_report(type: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Export a simple PDF report for crime or general analysis."""
    if type not in {"crime", "general"}:
        raise HTTPException(status_code=400, detail="Invalid report type")

    if current_user.role not in {"administrator", "ministry_of_interior"}:
        raise HTTPException(status_code=403, detail="Not authorized to export reports")

    if type == "crime":
        rows = await crime_report(db, current_user)  # reuse logic
        title = "Crime Report"
    else:
        rows = await general_report(db, current_user)
        title = "General Analysis Report"

    buffer = BytesIO()
    p = canvas.Canvas(buffer)
    y = 800
    p.setFont("Helvetica-Bold", 14)
    p.drawString(50, y, title)
    y -= 30
    p.setFont("Helvetica", 9)

    for row in rows:
        line = ", ".join(f"{k}: {v}" for k, v in row.items())
        p.drawString(50, y, line[:200])  # truncate long lines
        y -= 14
        if y < 50:
            p.showPage()
            y = 800
            p.setFont("Helvetica", 9)

    p.save()
    buffer.seek(0)

    return StreamingResponse(buffer, media_type="application/pdf", headers={
        "Content-Disposition": f"inline; filename={type}_report.pdf",
    })


@app.get("/api/users")
async def list_users(db: Session = Depends(get_db)):
    """List all users in the users table (for debugging only)."""
    users = db.query(User).all()
    return [
        {"id": u.id, "email": u.email, "role": u.role}
        for u in users
    ]


@app.get("/api/crime-forms")
async def list_crime_forms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List crime form records.

    All authenticated roles can view; Update and Delete are enforced on specific endpoints.
    """
    rows = db.query(CrimeFormData).order_by(CrimeFormData.id.desc()).all()
    return [
        {
            "id": r.id,
            "main_category": r.main_category,
            "crime_weight": r.crime_weight,
            "subcategories": r.subcategories,
            "neighbourhood_name": r.neighbourhood_name,
            "date": r.date.isoformat(),
            "offender_income_level": r.offender_income_level,
            "climate": r.climate,
            "time_of_year": r.time_of_year,
        }
        for r in rows
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


class CrimeFormUpdate(BaseModel):
    main_category: str
    subcategories: list[str]
    neighbourhood_name: str
    date: str  # ISO date string (YYYY-MM-DD)
    offender_income_level: str
    climate: str
    time_of_year: str


@app.put("/api/crime-form/{crime_id}")
async def update_crime_form(
    crime_id: int,
    payload: CrimeFormUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_roles = {"general_statistic", "hr", "civil_status", "ministry_of_justice", "administrator"}
    if current_user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized to update crime data")

    record = db.query(CrimeFormData).filter_by(id=crime_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    weight_row = db.query(CrimeWeight).filter_by(main_category=payload.main_category).first()
    if not weight_row:
        raise HTTPException(status_code=400, detail="Invalid main category: no weight defined")

    try:
        crime_date = datetime.fromisoformat(payload.date).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format; expected YYYY-MM-DD")

    record.main_category = payload.main_category
    record.crime_weight = weight_row.weight
    record.subcategories = ", ".join(payload.subcategories)
    record.neighbourhood_name = payload.neighbourhood_name
    record.date = crime_date
    record.offender_income_level = payload.offender_income_level
    record.climate = payload.climate
    record.time_of_year = payload.time_of_year

    db.commit()
    db.refresh(record)

    return {"id": record.id, "message": "Data updated successfully"}


@app.delete("/api/crime-form/{crime_id}", status_code=204)
async def delete_crime_form(
    crime_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "administrator":
        raise HTTPException(status_code=403, detail="Not authorized to delete crime data")

    record = db.query(CrimeFormData).filter_by(id=crime_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    db.delete(record)
    db.commit()
    return


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

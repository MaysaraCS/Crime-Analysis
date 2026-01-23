from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from models import User, CrimeCategory, CrimeWeight, CrimeFormData
from auth import get_current_user

router = APIRouter(prefix="/api", tags=["Crimes"])

# GET /api/crime-forms - Returns all crime records from database
# Ordered by ID descending (newest first)
# Requires authentication via get_current_user dependency

@router.get("/crime-forms")
async def list_crime_forms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List crime form records."""
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

# GET /api/crime/meta - Returns available crime categories and their weights
# Also includes subcategories for each main category
# Used to populate dropdown menus in the frontend form

@router.get("/crime/meta")
async def get_crime_meta(db: Session = Depends(get_db)):
    """Return main categories, their weights, and subcategories."""
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
    date: str
    offender_income_level: str
    climate: str
    time_of_year: str

# POST /api/crime-form - Inserts new crime record
# Only general_statistic and administrator roles can insert
# Validates main_category has a weight defined
# Converts date string to Python date object before saving

@router.post("/crime-form", status_code=201)
async def create_crime_form(
    payload: CrimeFormCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Allow both general_statistic and administrator to insert
    if current_user.role not in ["general_statistic", "administrator"]:
        raise HTTPException(status_code=403, detail="Not authorized to insert crime data")

    weight_row = db.query(CrimeWeight).filter_by(main_category=payload.main_category).first()
    if not weight_row:
        raise HTTPException(status_code=400, detail="Invalid main category: no weight defined")

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
    date: str
    offender_income_level: str
    climate: str
    time_of_year: str

# PUT /api/crime-form/{crime_id} - Updates existing crime record
# Multiple roles can update (general_statistic, hr, civil_status, ministry_of_justice, administrator)
# Validates the record exists and updates all fields

@router.put("/crime-form/{crime_id}")
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

# DELETE /api/crime-form/{crime_id} - Deletes a crime record
# Only administrator role can delete
# Returns 204 No Content on success

@router.delete("/crime-form/{crime_id}", status_code=204)
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
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from typing import Optional
import subprocess
import sys
import os

from database import get_db, engine
from models import Neighborhood, CrimeMonthlyCount, CrimeClassification

router = APIRouter(prefix="/api", tags=["neighborhoods"])


# ─────────────────────────────────────────────
# GET /api/neighborhoods  – list all
# ─────────────────────────────────────────────
@router.get("/neighborhoods")
def list_neighborhoods(db: Session = Depends(get_db)):
    rows = db.query(Neighborhood).order_by(Neighborhood.name).all()
    return [
        {
            "id": n.id,
            "name": n.name,
            "lat": float(n.latitude),
            "lng": float(n.longitude),
            "is_core": getattr(n, "is_core", True),
            "scores": {
                "population_density": n.population_density_score,
                "divorce_ratio": n.divorce_ratio_score,
                "unmarried_over_30": n.unmarried_over_30_score,
                "university_education": n.university_education_score,
                "unemployment": n.unemployment_score,
                "income": n.income_score,
                "vitality": n.vitality_score,
            },
        }
        for n in rows
    ]


# ─────────────────────────────────────────────
# POST /api/neighborhoods  – insert new
# ─────────────────────────────────────────────
class NeighborhoodCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    population_density_score: int = Field(..., description="1, 3, or 5")
    divorce_ratio_score: int = Field(..., description="1, 3, or 5")
    unmarried_over_30_score: int = Field(..., description="1, 3, or 5")
    university_education_score: int = Field(..., description="1, 3, or 5")
    unemployment_score: int = Field(..., description="1, 3, or 5")
    income_score: int = Field(..., description="1, 3, or 5")
    vitality_score: int = Field(..., description="1, 3, or 5")

    def validate_scores(self):
        fields = [
            self.population_density_score,
            self.divorce_ratio_score,
            self.unmarried_over_30_score,
            self.university_education_score,
            self.unemployment_score,
            self.income_score,
            self.vitality_score,
        ]
        for v in fields:
            if v not in (1, 3, 5):
                raise ValueError(f"Score {v} is invalid. Must be 1, 3, or 5.")


def _seed_city_average_counts(db: Session, neighborhood_id: int, year: int = 2025):
    """
    Seed the new neighborhood's monthly crime counts using the city-wide
    average per (classification_id, month).
    """
    classifications = db.query(CrimeClassification).all()
    class_ids = [c.id for c in classifications]

    rows_to_insert = []
    for cid in class_ids:
        for month in range(1, 13):
            result = db.execute(
                text("""
                    SELECT AVG(crime_count)::int AS avg_count
                    FROM crime_monthly_counts
                    WHERE classification_id = :cid
                      AND month = :month
                      AND year = :year
                """),
                {"cid": cid, "month": month, "year": year},
            ).fetchone()

            avg_count = int(result[0]) if result and result[0] else 0

            rows_to_insert.append(
                CrimeMonthlyCount(
                    neighborhood_id=neighborhood_id,
                    classification_id=cid,
                    year=year,
                    month=month,
                    crime_count=max(avg_count, 0),
                )
            )

    db.bulk_save_objects(rows_to_insert)
    db.commit()


def _run_retrain():
    """
    Run the training script in the background.
    Works both locally and on Railway (same Python env).
    """
    script_path = os.path.join(os.path.dirname(__file__), "..", "train_risk_model.py")
    script_path = os.path.abspath(script_path)
    try:
        subprocess.run(
            [sys.executable, script_path],
            check=True,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minutes max
        )
    except subprocess.CalledProcessError as e:
        print(f"[retrain] FAILED: {e.stderr}")
    except Exception as ex:
        print(f"[retrain] ERROR: {ex}")


@router.post("/neighborhoods", status_code=201)
def create_neighborhood(
    payload: NeighborhoodCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Validate score values
    try:
        payload.validate_scores()
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Check duplicate name
    existing = db.query(Neighborhood).filter_by(name=payload.name).first()
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Neighbourhood '{payload.name}' already exists."
        )

    # Insert neighborhood
    new_n = Neighborhood(
        name=payload.name,
        latitude=payload.latitude,
        longitude=payload.longitude,
        population_density_score=payload.population_density_score,
        divorce_ratio_score=payload.divorce_ratio_score,
        unmarried_over_30_score=payload.unmarried_over_30_score,
        university_education_score=payload.university_education_score,
        unemployment_score=payload.unemployment_score,
        income_score=payload.income_score,
        vitality_score=payload.vitality_score,
    )
    db.add(new_n)
    db.commit()
    db.refresh(new_n)

    # Seed monthly counts from city average
    _seed_city_average_counts(db, new_n.id)

    # Trigger retrain in background (non-blocking)
    background_tasks.add_task(_run_retrain)

    return {
        "id": new_n.id,
        "name": new_n.name,
        "message": f"Neighbourhood '{new_n.name}' inserted successfully. Model retraining started in background.",
    }


# ─────────────────────────────────────────────
# POST /api/retrain  – manual retrain trigger
# ─────────────────────────────────────────────
@router.post("/retrain")
def trigger_retrain(background_tasks: BackgroundTasks):
    background_tasks.add_task(_run_retrain)
    return {"message": "Model retraining started in background."}
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Neighborhood

router = APIRouter(prefix="/api", tags=["neighborhoods"])

@router.get("/neighborhoods")
def list_neighborhoods(db: Session = Depends(get_db)):
    rows = db.query(Neighborhood).order_by(Neighborhood.name).all()
    return [
        {
            "id": n.id,
            "name": n.name,
            "lat": float(n.latitude),
            "lng": float(n.longitude),
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
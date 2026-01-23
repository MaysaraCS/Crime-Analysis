from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db
from models import Neighbourhood

router = APIRouter(prefix="/api", tags=["Neighbourhoods"])

# Calculates total number of neighbourhoods and total population
# Sums population across all neighbourhoods for overview stats

@router.get("/dashboard-summary")
async def dashboard_summary(db: Session = Depends(get_db)):
    """Basic summary for the dashboard based on neighbourhood data."""
    total_neighbourhoods = db.query(Neighbourhood).count()
    total_population = sum(float(n.population) for n in db.query(Neighbourhood).all())

    return {
        "total_neighbourhoods": total_neighbourhoods,
        "total_population": total_population,
    }

# Returns all neighbourhood data for charts and tables
# Converts Numeric database types to float for JSON serialization

@router.get("/neighbourhoods")
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

# Returns neighbourhoods with their GPS coordinates
# Used specifically for the map visualization page

@router.get("/neighbourhoods-with-coords")
async def list_neighbourhoods_with_coords(db: Session = Depends(get_db)):
    """Return all neighbourhoods with their coordinates for map display."""
    rows = db.query(Neighbourhood).order_by(Neighbourhood.name).all()
    return [
        {
            "id": n.id,
            "name": n.name,
            "latitude": float(n.latitude) if n.latitude is not None else None,
            "longitude": float(n.longitude) if n.longitude is not None else None,
            "population": float(n.population) if n.population is not None else None,
        }
        for n in rows
    ]

# Calculates average crime weight for a specific neighbourhood
# Finds the most common crime category in that area
# Uses raw SQL query to join crime_form_data with crime_weights
# Returns neutral weight (5) if no crime data exists for the neighbourhood

@router.get("/neighbourhood/{neighbourhood_name}/crime-weight")
async def get_neighbourhood_crime_weight(
    neighbourhood_name: str,
    db: Session = Depends(get_db)
):
    """
    Calculate the average crime weight for a specific neighbourhood.
    
    This is computed by finding the most common crime category in this neighbourhood
    and returning its weight.
    """
    # Get the most common crime category in this neighbourhood
    result = db.execute(text("""
        SELECT c.main_category, cw.weight, COUNT(*) as cnt
        FROM crime_form_data c
        JOIN crime_weights cw ON cw.main_category = c.main_category
        WHERE c.neighbourhood_name = :neighbourhood_name
        GROUP BY c.main_category, cw.weight
        ORDER BY cnt DESC, c.main_category
        LIMIT 1
    """), {"neighbourhood_name": neighbourhood_name}).mappings().first()
    
    if not result:
        # No crime data for this neighbourhood, return neutral weight
        return {
            "neighbourhood_name": neighbourhood_name,
            "crime_weight": 5,  # Neutral/medium weight
            "main_category": None,
            "crime_count": 0
        }
    
    return {
        "neighbourhood_name": neighbourhood_name,
        "crime_weight": int(result["weight"]),
        "main_category": result["main_category"],
        "crime_count": int(result["cnt"])
    }
import joblib
import pandas as pd
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db, engine

router = APIRouter(prefix="/api", tags=["predict"])

MODEL_PATH = "risk_model.joblib"

def load_bundle():
    bundle = joblib.load(MODEL_PATH)
    return bundle["model"], bundle["feature_cols"], bundle.get("year", 2025)

@router.get("/predict")
def predict(
    neighborhood_id: int = Query(..., description="Neighborhood ID to predict"),
    year: int = Query(2025, description="Year to use for crime totals (default 2025)"),
    db: Session = Depends(get_db),
):
    model, feature_cols, trained_year = load_bundle()

    # 1) Fetch neighborhood demographics
    n = db.execute(
        text("""
        SELECT
          id AS neighborhood_id,
          population_density_score,
          divorce_ratio_score,
          unmarried_over_30_score,
          university_education_score,
          unemployment_score,
          income_score,
          vitality_score
        FROM neighborhoods
        WHERE id = :nid
        """),
        {"nid": neighborhood_id},
    ).fetchone()

    if not n:
        return {"error": f"Neighborhood id={neighborhood_id} not found"}

    # 2) Fetch yearly crime totals per classification for this neighborhood
    cdf = pd.read_sql(
        text("""
        SELECT classification_id, SUM(crime_count) AS yearly_count
        FROM crime_monthly_counts
        WHERE year = :year AND neighborhood_id = :nid
        GROUP BY classification_id
        """),
        engine,
        params={"year": year, "nid": neighborhood_id},
    )

    # Make a dict like {"crime_c1": 123, ...}
    crime_features = {f"crime_c{int(cid)}": int(cnt) for cid, cnt in zip(cdf["classification_id"], cdf["yearly_count"])}

    # 3) Build one-row dataframe with all expected feature columns
    row = {
        "population_density_score": n.population_density_score,
        "divorce_ratio_score": n.divorce_ratio_score,
        "unmarried_over_30_score": n.unmarried_over_30_score,
        "university_education_score": n.university_education_score,
        "unemployment_score": n.unemployment_score,
        "income_score": n.income_score,
        "vitality_score": n.vitality_score,
        **crime_features,
    }

    X = pd.DataFrame([row])

    # Ensure missing crime columns exist as 0
    for col in feature_cols:
        if col not in X.columns:
            X[col] = 0

    X = X[feature_cols]

    # 4) Predict + confidence
    pred = model.predict(X)[0]

    proba = None
    confidence = None
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)[0]
        classes = list(model.classes_)
        proba = {classes[i]: float(probs[i]) for i in range(len(classes))}
        confidence = float(max(probs))

    return {
        "neighborhood_id": neighborhood_id,
        "year": year,
        "predicted_label": pred,
        "confidence": confidence,
        "probabilities": proba,
    }
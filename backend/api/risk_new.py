import joblib
import pandas as pd
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Neighborhood, CrimeMonthlyCount, CrimeClassification

router = APIRouter(prefix="/api", tags=["risk"])

MODEL_PATH = "risk_model.joblib"
LABEL_ORDER = ["safe", "moderate", "dangerous", "very_dangerous"]


def label_quantiles(values: pd.Series) -> pd.Series:
    if values is None or len(values) == 0:
        return pd.Series([], dtype=str)

    if values.nunique(dropna=True) <= 1:
        return pd.Series(["moderate"] * len(values), index=values.index)

    q1 = values.quantile(0.25)
    q2 = values.quantile(0.50)
    q3 = values.quantile(0.75)

    def f(v: float) -> str:
        if v >= q3:
            return "very_dangerous"
        if v >= q2:
            return "dangerous"
        if v >= q1:
            return "moderate"
        return "safe"

    return values.apply(f)


@router.get("/risk")
def get_risk(year: int = Query(2025), db: Session = Depends(get_db)):
    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    feature_cols = bundle["feature_cols"]

    # Total crimes citywide for normalization
    total_city_crimes = (
        db.query(CrimeMonthlyCount.crime_count)
        .filter(CrimeMonthlyCount.year == year)
        .all()
    )
    total_city_crimes = sum(x[0] for x in total_city_crimes) or 1

    classifications = db.query(CrimeClassification).all()
    weight_map = {c.id: c.weight for c in classifications}

    neighborhoods = db.query(Neighborhood).all()

    # First pass: compute formula r1/r2/r and build ML feature rows
    temp = []
    feature_rows = []
    for n in neighborhoods:
        rows = (
            db.query(CrimeMonthlyCount)
            .filter(
                CrimeMonthlyCount.year == year,
                CrimeMonthlyCount.neighborhood_id == n.id
            )
            .all()
        )

        weighted_sum = 0
        crime_by_class = {}
        for r in rows:
            w = weight_map.get(r.classification_id, 1)
            weighted_sum += (r.crime_count * w)
            crime_by_class[r.classification_id] = crime_by_class.get(r.classification_id, 0) + r.crime_count

        r1 = (weighted_sum / total_city_crimes) * 20.0

        demo_avg = (
            n.population_density_score
            + n.divorce_ratio_score
            + n.unmarried_over_30_score
            + n.university_education_score
            + n.unemployment_score
            + n.income_score
            + n.vitality_score
        ) / 7.0
        r2 = demo_avg * 20.0
        r_final = (r1 + r2) / 2.0

        temp.append({
            "n": n,
            "r1": r1,
            "r2": r2,
            "r": r_final,
            "crime_by_class": crime_by_class
        })

        row = {
            "population_density_score": n.population_density_score,
            "divorce_ratio_score": n.divorce_ratio_score,
            "unmarried_over_30_score": n.unmarried_over_30_score,
            "university_education_score": n.university_education_score,
            "unemployment_score": n.unemployment_score,
            "income_score": n.income_score,
            "vitality_score": n.vitality_score,
        }
        for cid in weight_map.keys():
            row[f"crime_c{cid}"] = int(crime_by_class.get(cid, 0))
        feature_rows.append(row)

    # Formula labels based on R quantiles (like before)
    r_series = pd.Series([x["r"] for x in temp])
    formula_labels = label_quantiles(r_series)

    # ML: use predict_proba -> severity score -> quantile labels (prevents collapse)
    X = pd.DataFrame(feature_rows)
    for col in feature_cols:
        if col not in X.columns:
            X[col] = 0
    X = X[feature_cols]

    predicted_labels = []
    confidences = []
    prob_maps = []

    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)
        classes = list(model.classes_)

        for i in range(len(probs)):
            p = probs[i]
            pmap = {classes[j]: float(p[j]) for j in range(len(classes))}
            prob_maps.append(pmap)
            confidences.append(float(max(p)))

        severity_index = {"safe": 0, "moderate": 1, "dangerous": 2, "very_dangerous": 3}
        severity_scores = pd.Series([
            sum(float(pmap.get(k, 0.0)) * v for k, v in severity_index.items())
            for pmap in prob_maps
        ])

        predicted_labels = label_quantiles(severity_scores).tolist()

    else:
        preds = model.predict(X)
        predicted_labels = [str(p) for p in preds]
        confidences = [None] * len(predicted_labels)
        prob_maps = [None] * len(predicted_labels)

    # Output
    out = []
    for idx, x in enumerate(temp):
        n = x["n"]
        out.append({
            "id": n.id,
            "name": n.name,
            "lat": float(n.latitude),
            "lng": float(n.longitude),

            "r1": round(x["r1"], 2),
            "r2": round(x["r2"], 2),
            "r": round(x["r"], 2),
            "formula_label": str(formula_labels.iloc[idx]),

            "predicted_label": predicted_labels[idx],
            "confidence": confidences[idx],
            "probabilities": prob_maps[idx],
        })

    return out
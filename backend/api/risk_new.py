import joblib
import pandas as pd
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Neighborhood, CrimeMonthlyCount, CrimeClassification

router = APIRouter(prefix="/api", tags=["risk"])

MODEL_PATH = "risk_model.joblib"
LABEL_ORDER = ["safe", "moderate", "dangerous", "very_dangerous"]


def label_by_threshold(r_value: float) -> str:
    """Fixed threshold labels matching the project specification."""
    if r_value > 80:
        return "very_dangerous"
    if r_value >= 60:
        return "dangerous"
    if r_value >= 40:
        return "moderate"
    return "safe"


def label_quantiles(values: pd.Series) -> pd.Series:
    """Kept for ML severity-score quantile split (not for formula labels)."""
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

    classifications = db.query(CrimeClassification).all()
    weight_map = {c.id: c.weight for c in classifications}

    neighborhoods = db.query(Neighborhood).all()

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
            weighted_sum += r.crime_count * w
            crime_by_class[r.classification_id] = crime_by_class.get(r.classification_id, 0) + r.crime_count

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

        temp.append({
            "n": n,
            "weighted_sum": weighted_sum,
            "r2": r2,
            "crime_by_class": crime_by_class,
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

    # ── R1: normalize against the neighborhood with the max weighted crimes
    max_ws = max((x["weighted_sum"] for x in temp), default=1) or 1
    for x in temp:
        x["r1"] = (x["weighted_sum"] / max_ws) * 100.0
        x["r"] = (x["r1"] + x["r2"]) / 2.0

    # ── Formula label: fixed thresholds
    formula_labels = [label_by_threshold(x["r"]) for x in temp]

    # ── ML predictions
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
            "r":  round(x["r"],  2),
            "formula_label": formula_labels[idx],
            "predicted_label": predicted_labels[idx],
            "confidence": confidences[idx],
            "probabilities": prob_maps[idx],
            "scores": {
                "population_density":    n.population_density_score,
                "divorce_ratio":         n.divorce_ratio_score,
                "unmarried_over_30":     n.unmarried_over_30_score,
                "university_education":  n.university_education_score,
                "unemployment":          n.unemployment_score,
                "income":                n.income_score,
                "vitality":              n.vitality_score,
            },
        })

    return out
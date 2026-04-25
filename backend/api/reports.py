from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from io import BytesIO
import pandas as pd
import joblib

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
)
from reportlab.lib.units import inch

from database import get_db, engine

router = APIRouter(prefix="/api/reports", tags=["Reports"])

MODEL_PATH = "risk_model.joblib"

# ✅ Month-granular seasons (DB is month based)
SEASONS = {
    "ramadan": [2, 3],                 # Feb–Mar
    "hajj": [5, 6],                    # May–Jun (mid-month not possible with month-only data)
    "summer": [6, 7, 8],               # Jun–Aug
    "school": [9, 10, 11, 12, 1, 4],   # Sep–Jan + Apr
}

# ✅ Fixed label order for charts/tables
LABEL_ORDER = ["safe", "moderate", "dangerous", "very_dangerous"]


def _label_quantiles(values: pd.Series) -> pd.Series:
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


def _make_pie(labels, values, title: str) -> BytesIO:
    buf = BytesIO()
    fig = plt.figure(figsize=(6, 4))
    plt.title(title)
    plt.pie(values, labels=labels, autopct="%1.0f%%", startangle=90)
    plt.tight_layout()
    fig.savefig(buf, format="png", dpi=150)
    plt.close(fig)
    buf.seek(0)
    return buf


def _make_bar(x_labels, y_values, title: str, y_label: str) -> BytesIO:
    buf = BytesIO()
    fig = plt.figure(figsize=(8, 4))
    plt.title(title)
    plt.bar(x_labels, y_values)
    plt.ylabel(y_label)
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    fig.savefig(buf, format="png", dpi=150)
    plt.close(fig)
    buf.seek(0)
    return buf


def _make_line(x_labels, y_values, title: str, y_label: str) -> BytesIO:
    buf = BytesIO()
    fig = plt.figure(figsize=(8, 4))
    plt.title(title)
    plt.plot(x_labels, y_values, marker="o")
    plt.ylabel(y_label)
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()
    fig.savefig(buf, format="png", dpi=150)
    plt.close(fig)
    buf.seek(0)
    return buf


def _load_model_bundle():
    bundle = joblib.load(MODEL_PATH)
    return bundle["model"], bundle["feature_cols"], bundle


def _build_season_df(db: Session, year: int, season: str) -> pd.DataFrame:
    if season not in SEASONS:
        raise HTTPException(status_code=400, detail=f"Invalid season. Use one of: {list(SEASONS.keys())}")

    months = SEASONS[season]

    # 1) Neighborhood demographics
    with engine.connect() as conn:
        r = conn.execute(text("""
            SELECT
              id AS neighborhood_id,
              name,
              latitude,
              longitude,
              population_density_score,
              divorce_ratio_score,
              unmarried_over_30_score,
              university_education_score,
              unemployment_score,
              income_score,
              vitality_score
            FROM neighborhoods
            ORDER BY id
        """))
        ndf = pd.DataFrame(r.fetchall(), columns=r.keys())

    # 2) Seasonal crime totals per neighborhood + classification
    with engine.connect() as conn:
        r = conn.execute(
            text("""
                SELECT
                  neighborhood_id,
                  classification_id,
                  SUM(crime_count) AS season_count
                FROM crime_monthly_counts
                WHERE year = :year AND month = ANY(:months)
                GROUP BY neighborhood_id, classification_id
                ORDER BY neighborhood_id, classification_id
            """),
            {"year": year, "months": months},
        )
        cdf = pd.DataFrame(r.fetchall(), columns=r.keys())

    # 3) Classification weights
    with engine.connect() as conn:
        r = conn.execute(text("SELECT id AS classification_id, weight FROM crime_classifications ORDER BY id"))
        wdf = pd.DataFrame(r.fetchall(), columns=r.keys())
    wmap = dict(zip(wdf["classification_id"], wdf["weight"]))

    # Pivot to crime_cX columns
    pivot = cdf.pivot_table(
        index="neighborhood_id",
        columns="classification_id",
        values="season_count",
        fill_value=0
    )
    pivot.columns = [f"crime_c{int(c)}" for c in pivot.columns]
    pivot = pivot.reset_index()

    df = ndf.merge(pivot, on="neighborhood_id", how="left").fillna(0)

    total_city_crimes = float(cdf["season_count"].sum()) if len(cdf) else 1.0

    def weighted_sum(row) -> float:
        s = 0.0
        for cid, w in wmap.items():
            col = f"crime_c{int(cid)}"
            s += float(row.get(col, 0.0)) * float(w)
        return s

    df["weighted_sum"] = df.apply(weighted_sum, axis=1)
    df["r1"] = (df["weighted_sum"] / total_city_crimes) * 20.0

    demo_cols = [
        "population_density_score",
        "divorce_ratio_score",
        "unmarried_over_30_score",
        "university_education_score",
        "unemployment_score",
        "income_score",
        "vitality_score",
    ]
    df["r2"] = df[demo_cols].mean(axis=1) * 20.0
    df["r"] = (df["r1"] + df["r2"]) / 2.0

    df["formula_label"] = _label_quantiles(df["r"])

    return df


def _apply_ml_predictions(df: pd.DataFrame) -> pd.DataFrame:
    model, feature_cols, bundle = _load_model_bundle()

    for col in feature_cols:
        if col not in df.columns:
            df[col] = 0

    X = df[feature_cols]

    df["predicted_label"] = None
    df["confidence"] = None
    df["probabilities"] = None
    df["ml_score"] = None

    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)
        classes = list(model.classes_)

        pred_idx = probs.argmax(axis=1)
        df["predicted_label"] = [classes[i] for i in pred_idx]
        df["confidence"] = probs.max(axis=1)
        df["probabilities"] = [
            {classes[i]: float(p[i]) for i in range(len(classes))}
            for p in probs
        ]

        severity_index = {"safe": 0, "moderate": 1, "dangerous": 2, "very_dangerous": 3}
        df["ml_score"] = df["probabilities"].apply(
            lambda pmap: sum(float(pmap.get(k, 0.0)) * v for k, v in severity_index.items())
        )

    else:
        preds = model.predict(X)
        df["predicted_label"] = [str(p) for p in preds]
        df["confidence"] = None
        df["probabilities"] = None

    return df


def _counts_in_order(labels_series: pd.Series) -> dict:
    vc = labels_series.value_counts().to_dict() if labels_series is not None else {}
    return {k: int(vc.get(k, 0)) for k in LABEL_ORDER}


@router.get("/season")
def season_report(
    year: int = Query(2025),
    season: str = Query("ramadan"),
    mode: str = Query("ml", description="ml or formula"),
    db: Session = Depends(get_db),
):
    df = _build_season_df(db, year, season)

    if mode not in {"ml", "formula"}:
        raise HTTPException(status_code=400, detail="mode must be 'ml' or 'formula'")

    if mode == "ml":
        df = _apply_ml_predictions(df)
        label_col = "predicted_label"
    else:
        label_col = "formula_label"

    label_counts = _counts_in_order(df[label_col])

    top = df.sort_values("r", ascending=False).head(10)[["name", "r"]]

    table_cols = [
        "name", "r1", "r2", "r", "formula_label",
        "population_density_score", "divorce_ratio_score", "unmarried_over_30_score",
        "university_education_score", "unemployment_score", "income_score", "vitality_score",
        "latitude", "longitude"
    ]
    table = df[table_cols].copy()

    if mode == "ml":
        table["predicted_label"] = df["predicted_label"]
        table["confidence"] = df["confidence"]
        table["probabilities"] = df["probabilities"]

    return {
        "year": year,
        "season": season,
        "months": SEASONS[season],
        "mode": mode,
        "label_counts": label_counts,
        "avg_r": float(df["r"].mean()) if len(df) else 0.0,
        "top_risk": [{"name": r["name"], "r": float(r["r"])} for _, r in top.iterrows()],
        "rows": table.round(3).to_dict(orient="records"),
    }


@router.get("/export")
def export_season_pdf(
    year: int = Query(2025),
    season: str = Query("ramadan"),
    mode: str = Query("ml", description="ml or formula"),
    db: Session = Depends(get_db),
):
    df = _build_season_df(db, year, season)

    if mode not in {"ml", "formula"}:
        raise HTTPException(status_code=400, detail="mode must be 'ml' or 'formula'")

    title_mode = "Formula"
    label_col = "formula_label"

    if mode == "ml":
        df = _apply_ml_predictions(df)
        title_mode = "ML"
        label_col = "predicted_label"

    label_counts_dict = _counts_in_order(df[label_col])

    pie_buf = _make_pie(
        labels=list(label_counts_dict.keys()),
        values=[int(x) for x in label_counts_dict.values()],
        title=f"{title_mode} Label Distribution"
    )

    top = df.sort_values("r", ascending=False).head(10)
    bar_buf = _make_bar(
        x_labels=list(top["name"]),
        y_values=[float(x) for x in top["r"]],
        title="Top 10 Neighborhoods by Risk (R)",
        y_label="Risk (R)"
    )

    sorted_df = df.sort_values("r", ascending=True)
    line_buf = _make_line(
        x_labels=list(sorted_df["name"]),
        y_values=[float(x) for x in sorted_df["r"]],
        title="Risk Score Trend (sorted low → high)",
        y_label="Risk (R)"
    )

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    story = []
    styles = getSampleStyleSheet()

    story.append(Paragraph("<b>Seasonal Risk Report</b>", styles["Title"]))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(f"<b>Year:</b> {year}", styles["Normal"]))
    story.append(Paragraph(f"<b>Season:</b> {season} (months: {', '.join(map(str, SEASONS[season]))})", styles["Normal"]))
    story.append(Paragraph(f"<b>Mode:</b> {title_mode}", styles["Normal"]))
    story.append(Spacer(1, 0.25 * inch))

    story.append(Paragraph("<b>1) Label Distribution</b>", styles["Heading2"]))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Image(pie_buf, width=5.5 * inch, height=3.5 * inch))

    story.append(PageBreak())
    story.append(Paragraph("<b>2) Top Risk Neighborhoods</b>", styles["Heading2"]))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Image(bar_buf, width=6.5 * inch, height=3.5 * inch))

    story.append(PageBreak())
    story.append(Paragraph("<b>3) Risk Trend</b>", styles["Heading2"]))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Image(line_buf, width=6.5 * inch, height=3.5 * inch))

    story.append(PageBreak())
    story.append(Paragraph("<b>4) Report Table (Top 20 by Risk)</b>", styles["Heading2"]))
    story.append(Spacer(1, 0.1 * inch))

    show = df.sort_values("r", ascending=False).head(20).copy()

    cols = ["name", "r1", "r2", "r", "formula_label"]
    if mode == "ml":
        cols += ["predicted_label", "confidence"]

    header = [c.replace("_", " ").title() for c in cols]
    table_data = [header]

    for _, r in show.iterrows():
        row = []
        for c in cols:
            v = r.get(c)
            if c in {"r1", "r2", "r"}:
                row.append(f"{float(v):.2f}")
            elif c == "confidence" and v is not None:
                row.append(f"{float(v) * 100:.1f}%")
            else:
                row.append(str(v))
        table_data.append(row)

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
    ]))
    story.append(table)

    doc.build(story)
    buffer.seek(0)

    filename = f"season_{season}_{year}_{mode}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )
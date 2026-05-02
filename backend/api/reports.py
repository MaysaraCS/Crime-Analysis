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

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
)
from reportlab.lib.units import inch

from database import get_db, engine

router = APIRouter(prefix="/api/reports", tags=["Reports"])

MODEL_PATH = "risk_model.joblib"

SEASONS = {
    "ramadan": [2, 3],
    "hajj":    [5, 6],
    "summer":  [6, 7, 8],
    "school":  [9, 10, 11, 12, 1, 4],
}

LABEL_ORDER = ["safe", "moderate", "dangerous", "very_dangerous"]

# ── Fixed threshold labelling (matching the images) ───────────────────────────
def label_by_threshold(r_value: float) -> str:
    if r_value > 80:
        return "very_dangerous"
    if r_value >= 60:
        return "dangerous"
    if r_value >= 40:
        return "moderate"
    return "safe"


def _label_series_by_threshold(values: pd.Series) -> pd.Series:
    return values.apply(label_by_threshold)


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

    with engine.connect() as conn:
        r = conn.execute(text("SELECT id AS classification_id, weight FROM crime_classifications ORDER BY id"))
        wdf = pd.DataFrame(r.fetchall(), columns=r.keys())
    wmap = dict(zip(wdf["classification_id"], wdf["weight"]))

    pivot = cdf.pivot_table(
        index="neighborhood_id",
        columns="classification_id",
        values="season_count",
        fill_value=0
    )
    pivot.columns = [f"crime_c{int(c)}" for c in pivot.columns]
    pivot = pivot.reset_index()

    df = ndf.merge(pivot, on="neighborhood_id", how="left").fillna(0)

    demo_cols = [
        "population_density_score",
        "divorce_ratio_score",
        "unmarried_over_30_score",
        "university_education_score",
        "unemployment_score",
        "income_score",
        "vitality_score",
    ]

    def weighted_sum(row) -> float:
        s = 0.0
        for cid, w in wmap.items():
            col = f"crime_c{int(cid)}"
            s += float(row.get(col, 0.0)) * float(w)
        return s

    df["weighted_sum"] = df.apply(weighted_sum, axis=1)

    # ── R1: normalize against the neighborhood with the highest weighted crime
    #        sum so that R1 ∈ [0, 100]
    max_ws = df["weighted_sum"].max()
    if max_ws > 0:
        df["r1"] = (df["weighted_sum"] / max_ws) * 100.0
    else:
        df["r1"] = 0.0

    # ── R2: mean of 7 demographic scores (each 1/3/5) scaled so that
    #        score=1 → 20, score=3 → 60, score=5 → 100  (i.e. × 20)
    df["r2"] = df[demo_cols].mean(axis=1) * 20.0

    # ── R: simple average of R1 and R2
    df["r"] = (df["r1"] + df["r2"]) / 2.0

    # ── Formula label uses fixed thresholds from the project spec
    df["formula_label"] = _label_series_by_threshold(df["r"])

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
    neighbourhoods: str = Query("", description="Comma-separated neighbourhood names to include; empty = all"),
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

    # ── Apply neighbourhood filter (mirrors what the frontend does) ───────────
    if neighbourhoods.strip():
        selected = [n.strip() for n in neighbourhoods.split(",") if n.strip()]
        df = df[df["name"].isin(selected)].copy()

    if df.empty:
        raise HTTPException(status_code=404, detail="No data found for the given filters.")

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

    # ── Build PDF (landscape for wide table) ─────────────────────────────────
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
        leftMargin=0.4 * inch,
        rightMargin=0.4 * inch,
    )
    story = []
    styles = getSampleStyleSheet()

    story.append(Paragraph("<b>Seasonal Risk Report</b>", styles["Title"]))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(f"<b>Year:</b> {year}", styles["Normal"]))
    story.append(Paragraph(f"<b>Season:</b> {season} (months: {', '.join(map(str, SEASONS[season]))})", styles["Normal"]))
    story.append(Paragraph(f"<b>Mode:</b> {title_mode}", styles["Normal"]))
    story.append(Paragraph(f"<b>Neighbourhoods shown:</b> {len(df)}", styles["Normal"]))
    story.append(Spacer(1, 0.25 * inch))

    story.append(Paragraph("<b>1) Label Distribution</b>", styles["Heading2"]))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Image(pie_buf, width=5.5 * inch, height=3.5 * inch))

    story.append(PageBreak())
    story.append(Paragraph("<b>2) Top Risk Neighborhoods</b>", styles["Heading2"]))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Image(bar_buf, width=7.5 * inch, height=3.5 * inch))

    story.append(PageBreak())
    story.append(Paragraph("<b>3) Risk Trend</b>", styles["Heading2"]))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Image(line_buf, width=7.5 * inch, height=3.5 * inch))

    story.append(PageBreak())
    story.append(Paragraph(f"<b>4) Full Report Table ({len(df)} neighbourhoods)</b>", styles["Heading2"]))
    story.append(Spacer(1, 0.1 * inch))

    # ALL rows, sorted by R descending (same as frontend table)
    show = df.sort_values("r", ascending=False).copy()

    cols = ["name", "r1", "r2", "r", "formula_label"]
    if mode == "ml":
        cols += ["predicted_label", "confidence"]
    cols += ["unemployment_score", "income_score", "vitality_score"]

    header = [c.replace("_", " ").title() for c in cols]
    table_data = [header]

    LABEL_BG = {
        "very_dangerous": colors.HexColor("#ef4444"),
        "dangerous":      colors.HexColor("#f97316"),
        "moderate":       colors.HexColor("#eab308"),
        "safe":           colors.HexColor("#22c55e"),
    }

    label_cell_indices = []  # (row_idx, col_idx) for coloured cells
    for row_i, (_, r) in enumerate(show.iterrows(), start=1):
        row = []
        for col_i, c in enumerate(cols):
            v = r.get(c)
            if c in {"r1", "r2", "r"}:
                row.append(f"{float(v):.2f}")
            elif c == "confidence" and v is not None:
                row.append(f"{float(v) * 100:.1f}%")
            elif c in {"formula_label", "predicted_label"}:
                row.append(str(v) if v is not None else "—")
                label_cell_indices.append((row_i, col_i))
            else:
                row.append(str(v) if v is not None else "—")
        table_data.append(row)

    # Column widths — distribute across landscape A4 width (~10.27 inch usable)
    usable = 10.27
    n_cols = len(cols)
    base_w = usable / n_cols
    col_widths = [base_w * inch] * n_cols

    tbl = Table(table_data, repeatRows=1, colWidths=col_widths)
    tbl_style = TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0),  colors.HexColor("#374151")),
        ("TEXTCOLOR",    (0, 0), (-1, 0),  colors.whitesmoke),
        ("FONTNAME",     (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, 0),  8),
        ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("GRID",         (0, 0), (-1, -1), 0.4, colors.HexColor("#d1d5db")),
        ("FONTSIZE",     (0, 1), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        ("TOPPADDING",   (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 3),
    ])

    # Colour label cells
    for (ri, ci) in label_cell_indices:
        raw_label = table_data[ri][ci]
        bg = LABEL_BG.get(raw_label, colors.HexColor("#94a3b8"))
        tbl_style.add("BACKGROUND", (ci, ri), (ci, ri), bg)
        tbl_style.add("TEXTCOLOR",  (ci, ri), (ci, ri), colors.white)
        tbl_style.add("FONTNAME",   (ci, ri), (ci, ri), "Helvetica-Bold")

    tbl.setStyle(tbl_style)
    story.append(tbl)

    doc.build(story)
    buffer.seek(0)

    filename = f"season_{season}_{year}_{mode}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )
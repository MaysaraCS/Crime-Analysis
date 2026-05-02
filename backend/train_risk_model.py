import joblib
import pandas as pd
from sqlalchemy import text
from dotenv import load_dotenv
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.ensemble import RandomForestClassifier
from database import engine

load_dotenv()

YEAR = 2025
MODEL_OUT = "risk_model.joblib"
CLASS_ORDER = ["safe", "moderate", "dangerous", "very_dangerous"]


def label_by_threshold(r_value: float) -> str:
    if r_value > 80:
        return "very_dangerous"
    if r_value >= 60:
        return "dangerous"
    if r_value >= 40:
        return "moderate"
    return "safe"


def build_monthly_dataset(year):
    with engine.connect() as conn:
        r = conn.execute(text(
            "SELECT id AS neighborhood_id, population_density_score, divorce_ratio_score, "
            "unmarried_over_30_score, university_education_score, unemployment_score, "
            "income_score, vitality_score FROM neighborhoods ORDER BY id"
        ))
        ndf = pd.DataFrame(r.fetchall(), columns=r.keys())

    with engine.connect() as conn:
        r = conn.execute(text("SELECT id AS classification_id, weight FROM crime_classifications ORDER BY id"))
        wdf = pd.DataFrame(r.fetchall(), columns=r.keys())
    wmap = dict(zip(wdf["classification_id"], wdf["weight"]))

    rows_out = []
    for month in range(1, 13):
        with engine.connect() as conn:
            result = conn.execute(
                text(
                    "SELECT neighborhood_id, classification_id, SUM(crime_count) AS m_count "
                    "FROM crime_monthly_counts "
                    "WHERE year = :year AND month = :month "
                    "GROUP BY neighborhood_id, classification_id "
                    "ORDER BY neighborhood_id, classification_id"
                ),
                {"year": year, "month": month},
            )
            cdf = pd.DataFrame(result.fetchall(), columns=result.keys())

        if len(cdf) == 0:
            continue

        pivot = cdf.pivot_table(
            index="neighborhood_id",
            columns="classification_id",
            values="m_count",
            fill_value=0,
        )
        pivot.columns = [f"crime_c{int(c)}" for c in pivot.columns]
        pivot = pivot.reset_index()

        df = ndf.merge(pivot, on="neighborhood_id", how="left").fillna(0)

        demo_cols = [
            "population_density_score", "divorce_ratio_score", "unmarried_over_30_score",
            "university_education_score", "unemployment_score", "income_score", "vitality_score",
        ]

        def weighted_sum(row):
            s = 0.0
            for cid, w in wmap.items():
                col = f"crime_c{int(cid)}"
                s += float(row.get(col, 0.0)) * float(w)
            return s

        df["weighted_sum"] = df.apply(weighted_sum, axis=1)

        # ── R1 normalised to [0, 100] against the month's max weighted sum
        max_ws = df["weighted_sum"].max()
        df["r1"] = (df["weighted_sum"] / max_ws * 100.0) if max_ws > 0 else 0.0

        df["r2"] = df[demo_cols].mean(axis=1) * 20.0
        df["r"]  = (df["r1"] + df["r2"]) / 2.0

        df["label"] = df["r"].apply(label_by_threshold)
        df["month"] = month
        rows_out.append(df)

    out = pd.concat(rows_out, ignore_index=True)
    out["label"] = pd.Categorical(out["label"], categories=CLASS_ORDER, ordered=True)

    print("✅ Monthly dataset size:", len(out))
    print("✅ Label distribution:")
    print(out["label"].value_counts(dropna=False))
    print("✅ R stats:")
    print(out["r"].describe())
    return out


def main():
    df = build_monthly_dataset(YEAR)

    crime_cols = [c for c in df.columns if c.startswith("crime_c")]
    feature_cols = [
        "month",
        "population_density_score", "divorce_ratio_score", "unmarried_over_30_score",
        "university_education_score", "unemployment_score", "income_score", "vitality_score",
    ] + crime_cols

    X = df[feature_cols]
    y = df["label"].astype(str)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=1337, stratify=y
    )

    rf = RandomForestClassifier(
        n_estimators=700, random_state=1337, class_weight="balanced", min_samples_leaf=2
    )
    rf.fit(X_train, y_train)

    pred = rf.predict(X_test)
    acc = accuracy_score(y_test, pred)

    print("\n=== Random Forest (monthly trained) ===")
    print("Accuracy:", round(acc, 4))
    print("Confusion matrix:\n", confusion_matrix(y_test, pred, labels=CLASS_ORDER))
    print(classification_report(y_test, pred, labels=CLASS_ORDER))

    joblib.dump(
        {
            "model_name": "RandomForest_monthly",
            "model": rf,
            "feature_cols": feature_cols,
            "classes": list(rf.classes_),
            "class_order_expected": CLASS_ORDER,
            "year": YEAR,
        },
        MODEL_OUT,
    )

    print(f"\n✅ Saved model -> {MODEL_OUT}")
    print("✅ Model classes_:", list(rf.classes_))


if __name__ == "__main__":
    main()
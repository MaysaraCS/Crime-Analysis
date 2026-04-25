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

def label_quantile_from_series(r_series, r_value):
    q1 = r_series.quantile(0.25)
    q2 = r_series.quantile(0.50)
    q3 = r_series.quantile(0.75)
    if r_value >= q3:
        return "very_dangerous"
    if r_value >= q2:
        return "dangerous"
    if r_value >= q1:
        return "moderate"
    return "safe"

def build_monthly_dataset(year):
    with engine.connect() as conn:
        ndf = pd.DataFrame(conn.execute(text("SELECT id AS neighborhood_id, population_density_score, divorce_ratio_score, unmarried_over_30_score, university_education_score, unemployment_score, income_score, vitality_score FROM neighborhoods ORDER BY id")).fetchall()).rename(columns=dict(enumerate(["neighborhood_id","population_density_score","divorce_ratio_score","unmarried_over_30_score","university_education_score","unemployment_score","income_score","vitality_score"])))
        r = conn.execute(text("SELECT id AS neighborhood_id, population_density_score, divorce_ratio_score, unmarried_over_30_score, university_education_score, unemployment_score, income_score, vitality_score FROM neighborhoods ORDER BY id"))
        ndf = pd.DataFrame(r.fetchall(), columns=r.keys())

    with engine.connect() as conn:
        r = conn.execute(text("SELECT id AS classification_id, weight FROM crime_classifications ORDER BY id"))
        wdf = pd.DataFrame(r.fetchall(), columns=r.keys())
    wmap = dict(zip(wdf["classification_id"], wdf["weight"]))

    rows_out = []
    for month in range(1, 13):
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT neighborhood_id, classification_id, SUM(crime_count) AS m_count FROM crime_monthly_counts WHERE year = :year AND month = :month GROUP BY neighborhood_id, classification_id ORDER BY neighborhood_id, classification_id"),
                {"year": year, "month": month},
            )
            cdf = pd.DataFrame(result.fetchall(), columns=result.keys())

        if len(cdf) == 0:
            continue

        pivot = cdf.pivot_table(index="neighborhood_id", columns="classification_id", values="m_count", fill_value=0)
        pivot.columns = [f"crime_c{int(c)}" for c in pivot.columns]
        pivot = pivot.reset_index()

        df = ndf.merge(pivot, on="neighborhood_id", how="left").fillna(0)

        total_city_crimes = float(cdf["m_count"].sum()) if len(cdf) else 1.0

        def weighted_sum(row):
            s = 0.0
            for cid, w in wmap.items():
                col = f"crime_c{int(cid)}"
                s += float(row.get(col, 0.0)) * float(w)
            return s

        df["weighted_sum"] = df.apply(weighted_sum, axis=1)
        df["r1"] = (df["weighted_sum"] / total_city_crimes) * 20.0

        demo_cols = ["population_density_score","divorce_ratio_score","unmarried_over_30_score","university_education_score","unemployment_score","income_score","vitality_score"]
        df["r2"] = df[demo_cols].mean(axis=1) * 20.0
        df["r"] = (df["r1"] + df["r2"]) / 2.0

        r_series = df["r"]
        df["label"] = df["r"].apply(lambda rv: label_quantile_from_series(r_series, rv))
        df["month"] = month
        rows_out.append(df)

    out = pd.concat(rows_out, ignore_index=True)
    out["label"] = pd.Categorical(out["label"], categories=CLASS_ORDER, ordered=True)

    print("✅ Monthly dataset size:", len(out))
    print("✅ Label distribution:")
    print(out["label"].value_counts(dropna=False))
    return out

def main():
    df = build_monthly_dataset(YEAR)

    crime_cols = [c for c in df.columns if c.startswith("crime_c")]
    feature_cols = ["month","population_density_score","divorce_ratio_score","unmarried_over_30_score","university_education_score","unemployment_score","income_score","vitality_score"] + crime_cols

    X = df[feature_cols]
    y = df["label"].astype(str)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=1337, stratify=y)

    rf = RandomForestClassifier(n_estimators=700, random_state=1337, class_weight="balanced", min_samples_leaf=2)
    rf.fit(X_train, y_train)

    pred = rf.predict(X_test)
    acc = accuracy_score(y_test, pred)

    print("\n=== Random Forest (monthly trained) ===")
    print("Accuracy:", round(acc, 4))
    print("Confusion matrix:\n", confusion_matrix(y_test, pred, labels=CLASS_ORDER))
    print(classification_report(y_test, pred, labels=CLASS_ORDER))

    joblib.dump({"model_name": "RandomForest_monthly", "model": rf, "feature_cols": feature_cols, "classes": list(rf.classes_), "class_order_expected": CLASS_ORDER, "year": YEAR}, MODEL_OUT)

    print(f"\n✅ Saved model -> {MODEL_OUT}")
    print("✅ Model classes_:", list(rf.classes_))

if __name__ == "__main__":
    main()

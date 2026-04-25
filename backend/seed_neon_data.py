import os
import random
from dataclasses import dataclass
from typing import List, Dict, Tuple

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import engine

load_dotenv()

# -----------------------------
# Config
# -----------------------------
YEAR = 2025
NEIGHBORHOOD_TOTAL = 40
CORE_COUNT = 24

# "Seasonality" multipliers (simple + explainable)
# Ramadan: Feb-Mar -> higher
# Hajj: May-Jun -> slightly higher
# Summer: Jun-Aug -> mixed
# School: Sep-Jan + Apr -> baseline/slightly higher
MONTH_MULTIPLIER: Dict[int, float] = {
    1: 1.05,   # Jan (school season)
    2: 1.18,   # Feb (Ramadan)
    3: 1.18,   # Mar (Ramadan)
    4: 1.05,   # Apr (school season)
    5: 1.10,   # May (Hajj)
    6: 1.10,   # Jun (Hajj + start of summer)
    7: 1.08,   # Jul (summer)
    8: 1.08,   # Aug (summer)
    9: 1.06,   # Sep (school season)
    10: 1.06,  # Oct
    11: 1.06,  # Nov
    12: 1.06,  # Dec
}

# Keep results reproducible
RANDOM_SEED = 1337
random.seed(RANDOM_SEED)


@dataclass
class NeighborhoodRow:
    name: str
    lat: float
    lng: float
    scores: Tuple[int, int, int, int, int, int, int]  # 7 scores
    is_core: bool


# -----------------------------
# Helpers
# -----------------------------
def weighted_choice(choices: List[Tuple[int, float]]) -> int:
    """choices: [(value, weight), ...]"""
    r = random.random() * sum(w for _, w in choices)
    upto = 0.0
    for val, w in choices:
        upto += w
        if upto >= r:
            return val
    return choices[-1][0]


def gen_scores() -> Tuple[int, int, int, int, int, int, int]:
    """
    Generate demographic scores 1/3/5.
    We'll bias towards 3 (middle) so it's realistic, with some 1 and 5.
    """
    dist = [(1, 0.25), (3, 0.50), (5, 0.25)]
    return tuple(weighted_choice(dist) for _ in range(7))  # 7 fields


def make_neighborhoods(n_total: int, n_core: int) -> List[NeighborhoodRow]:
    """
    Generate neighborhoods around Dammam center with jitter.
    Dammam approx center: 26.4207, 50.0888
    """
    base_lat, base_lng = 26.4207, 50.0888
    rows: List[NeighborhoodRow] = []

    # Generate names like "Dammam Area 01..40"
    for i in range(1, n_total + 1):
        # jitter within ~ 0.07 degrees (~7-8km), enough spread for a map
        lat = base_lat + random.uniform(-0.07, 0.07)
        lng = base_lng + random.uniform(-0.07, 0.07)
        scores = gen_scores()
        is_core = i <= n_core
        rows.append(
            NeighborhoodRow(
                name=f"Dammam Area {i:02d}",
                lat=lat,
                lng=lng,
                scores=scores,
                is_core=is_core,
            )
        )
    return rows


def ensure_classifications_exist(db: Session) -> Dict[int, int]:
    """
    Ensure 10 crime classifications exist.
    Returns {classification_id: weight}.
    If you already inserted your Table-4 classifications, this won't break anything.
    """
    existing = db.execute(text("SELECT id, weight FROM crime_classifications ORDER BY id")).fetchall()
    if len(existing) >= 10:
        return {row[0]: row[1] for row in existing}

    # Insert a simple default set (you can rename later)
    defaults = [
        (1, "Assault", "Physical assault cases", 5),
        (2, "Theft", "General theft incidents", 4),
        (3, "Robbery", "Robbery incidents", 5),
        (4, "Burglary", "House/shop burglary", 4),
        (5, "Drugs", "Drug-related crimes", 5),
        (6, "Vandalism", "Property vandalism", 3),
        (7, "Fraud", "Fraud/scams", 3),
        (8, "Harassment", "Harassment/abuse", 3),
        (9, "Traffic", "Traffic-related violations", 2),
        (10, "Other", "Other crimes", 1),
    ]
    db.execute(
        text("""
        INSERT INTO crime_classifications (code, name, description, weight)
        VALUES (:code, :name, :desc, :weight)
        ON CONFLICT (code) DO NOTHING
        """),
        [{"code": c, "name": n, "desc": d, "weight": w} for (c, n, d, w) in defaults],
    )
    db.commit()

    existing = db.execute(text("SELECT id, weight FROM crime_classifications ORDER BY id")).fetchall()
    return {row[0]: row[1] for row in existing}


def wipe_existing(db: Session) -> None:
    """Optional: wipe old generated data (safe order due to FKs)."""
    db.execute(text("DELETE FROM risk_scores"))
    db.execute(text("DELETE FROM crime_monthly_counts"))
    db.execute(text("DELETE FROM neighborhoods"))
    # Don't delete classifications by default (you might have custom ones)
    db.commit()


def insert_neighborhoods(db: Session, neighborhoods: List[NeighborhoodRow]) -> List[int]:
    """
    Insert neighborhoods, return inserted ids ordered by insertion.
    """
    inserted_ids: List[int] = []
    for n in neighborhoods:
        pop, div, un30, uni, unemp, inc, vit = n.scores
        row = db.execute(
            text("""
            INSERT INTO neighborhoods (
              name, latitude, longitude,
              population_density_score, divorce_ratio_score, unmarried_over_30_score,
              university_education_score, unemployment_score, income_score, vitality_score,
              is_core
            )
            VALUES (
              :name, :lat, :lng,
              :pop, :div, :un30,
              :uni, :unemp, :inc, :vit,
              :is_core
            )
            RETURNING id
            """),
            {
                "name": n.name,
                "lat": n.lat,
                "lng": n.lng,
                "pop": pop,
                "div": div,
                "un30": un30,
                "uni": uni,
                "unemp": unemp,
                "inc": inc,
                "vit": vit,
                "is_core": n.is_core,
            },
        ).fetchone()
        inserted_ids.append(int(row[0]))
    db.commit()
    return inserted_ids


def generate_monthly_counts(
    neighborhood_ids: List[int],
    classification_weights: Dict[int, int],
) -> List[Dict]:
    """
    Generate synthetic monthly counts for each neighborhood x classification x month.
    We will:
    - base crime intensity depends on demographic 'riskiness' implicitly via is_core not here.
    - apply month multipliers
    - apply crime severity weights to shape counts a bit
    """
    class_ids = list(classification_weights.keys())

    rows: List[Dict] = []

    for nid in neighborhood_ids:
        # neighborhood baseline: some neighborhoods more active than others
        baseline = random.randint(20, 70)  # total monthly magnitude-ish

        for cid in class_ids:
            w = classification_weights[cid]

            # classification baseline: serious crimes usually lower counts but still weighted
            class_base = max(1, int(baseline * (0.25 + (6 - w) * 0.08)))  # weight 5 -> smaller base

            for month in range(1, 13):
                mult = MONTH_MULTIPLIER[month]

                # add randomness (Poisson-like feel without numpy)
                jitter = random.uniform(0.75, 1.25)

                # final count, keep non-negative
                count = int(class_base * mult * jitter)

                rows.append(
                    {
                        "neighborhood_id": nid,
                        "classification_id": cid,
                        "year": YEAR,
                        "month": month,
                        "crime_count": count,
                    }
                )
    return rows


def insert_monthly_counts(db: Session, rows: List[Dict]) -> None:
    # Bulk insert using executemany
    db.execute(
        text("""
        INSERT INTO crime_monthly_counts (neighborhood_id, classification_id, year, month, crime_count)
        VALUES (:neighborhood_id, :classification_id, :year, :month, :crime_count)
        ON CONFLICT (neighborhood_id, classification_id, year, month)
        DO UPDATE SET crime_count = EXCLUDED.crime_count
        """),
        rows,
    )
    db.commit()


def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set in .env")

    print("✅ Using DATABASE_URL from .env")

    with Session(engine) as db:
        # OPTIONAL: wipe previous generated data
        # If you want to keep old, comment this out.
        print("🧹 Wiping existing neighborhoods + counts (risk_scores/counts/neighborhoods)...")
        wipe_existing(db)

        # Ensure classifications exist
        print("📌 Ensuring 10 crime classifications exist...")
        class_weights = ensure_classifications_exist(db)
        print(f"✅ Classifications found: {len(class_weights)}")

        # Create neighborhoods
        print(f"🏘️ Generating {NEIGHBORHOOD_TOTAL} neighborhoods ({CORE_COUNT} core)...")
        neighborhoods = make_neighborhoods(NEIGHBORHOOD_TOTAL, CORE_COUNT)
        n_ids = insert_neighborhoods(db, neighborhoods)
        print(f"✅ Inserted neighborhoods: {len(n_ids)}")

        # Create monthly counts
        print("📅 Generating monthly crime counts for 2025...")
        count_rows = generate_monthly_counts(n_ids, class_weights)
        print(f"➡️ Rows to insert/update: {len(count_rows)}")
        insert_monthly_counts(db, count_rows)

        # Quick sanity stats
        stats = db.execute(text("""
            SELECT
              (SELECT COUNT(*) FROM crime_classifications) AS classifications,
              (SELECT COUNT(*) FROM neighborhoods) AS neighborhoods,
              (SELECT COUNT(*) FROM crime_monthly_counts) AS monthly_rows
        """)).fetchone()

        print("✅ Done.")
        print(f"Classifications: {stats[0]}")
        print(f"Neighborhoods:   {stats[1]}")
        print(f"Monthly rows:    {stats[2]}")
        print("Next: open /docs and call GET /api/neighborhoods and GET /api/risk?year=2025")


if __name__ == "__main__":
    main()
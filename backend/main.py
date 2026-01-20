from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
from datetime import datetime
from io import BytesIO
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib.units import inch
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from collections import Counter

from database import get_db
from models import User, Neighbourhood, CrimeCategory, CrimeWeight, CrimeFormData
from auth import get_current_user, create_access_token, authenticate_user

app = FastAPI(
    title="Crime Analysis API",
    version="0.1.0",
)

# CORS for frontend dev (Vite on localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Used by you or your hosting provider to check that the API is alive."""
    return {"status": "ok"}


@app.get("/api/hello")
async def hello():
    """Simple test route to verify that FastAPI is running and reachable."""
    return {"message": "Crime Analysis backend is alive"}


@app.get("/api/dashboard-summary")
async def dashboard_summary(db: Session = Depends(get_db)):
    """Basic summary for the dashboard based on neighbourhood data."""
    total_neighbourhoods = db.query(Neighbourhood).count()
    total_population = sum(float(n.population) for n in db.query(Neighbourhood).all())

    return {
        "total_neighbourhoods": total_neighbourhoods,
        "total_population": total_population,
    }


@app.get("/api/neighbourhoods")
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


@app.get("/api/reports/crime")
async def crime_report(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Crime report data per neighbourhood (for charts and tables)."""
    rows = db.execute(text("""
        SELECT
          n.name AS neighbourhood_name,
          n.population,
          n.university_education_percent,
          n.unmarried_over_30_percent,
          n.income_level,
          n.unemployment_percent,
          mc.main_category AS main_crime_category
        FROM neighbourhood n
        LEFT JOIN LATERAL (
          SELECT c.main_category, COUNT(*) AS cnt
          FROM crime_form_data c
          WHERE c.neighbourhood_name = n.name
          GROUP BY c.main_category
          ORDER BY cnt DESC, c.main_category
          LIMIT 1
        ) mc ON TRUE
    """)).mappings().all()
    return list(rows)


@app.get("/api/reports/general")
async def general_report(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """General analysis report data per neighbourhood."""
    rows = db.execute(text("""
        SELECT
          n.name AS neighbourhood_name,
          n.population,
          n.income_level,
          n.unemployment_percent,
          mc.main_category AS main_crime_category,
          COALESCE(mc.weight, 0) AS avg_crime_weight
        FROM neighbourhood n
        LEFT JOIN LATERAL (
          SELECT c.main_category, cw.weight, COUNT(*) AS cnt
          FROM crime_form_data c
          JOIN crime_weights cw ON cw.main_category = c.main_category
          WHERE c.neighbourhood_name = n.name
          GROUP BY c.main_category, cw.weight
          ORDER BY cnt DESC, c.main_category
          LIMIT 1
        ) mc ON TRUE
    """)).mappings().all()
    return list(rows)


def create_pie_chart(data_rows):
    """Create a pie chart for crime categories distribution."""
    crime_counts = Counter()
    for row in data_rows:
        category = row.get('main_crime_category') or 'None'
        crime_counts[category] += 1
    
    labels = list(crime_counts.keys())
    sizes = list(crime_counts.values())
    colors_list = ['#1d4ed8', '#f97316', '#22c55e', '#ef4444', '#0ea5e9', '#a855f7']
    
    fig, ax = plt.subplots(figsize=(8, 6))
    wedges, texts, autotexts = ax.pie(sizes, labels=None, autopct='%1.1f%%',
                                        colors=colors_list[:len(labels)], startangle=90)
    
    # Create legend on the left side
    ax.legend(wedges, labels, title="Crime Categories", loc="center left", bbox_to_anchor=(1, 0, 0.5, 1))
    ax.axis('equal')
    
    buf = BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
    buf.seek(0)
    plt.close()
    return buf


def create_bar_chart(data_rows, report_type):
    """Create a bar chart for population or avg crime weight."""
    labels = [row.get('neighbourhood_name', '') for row in data_rows]
    
    if report_type == 'crime':
        values = [float(row.get('population', 0)) for row in data_rows]
        ylabel = 'Population (thousands)'
        title = 'Population per Neighbourhood'
    else:
        values = [float(row.get('avg_crime_weight', 0)) for row in data_rows]
        ylabel = 'Avg Crime Weight'
        title = 'Avg Crime Weight per Neighbourhood'
    
    colors_list = ['#4f46e5', '#f59e0b', '#f97373', '#22c55e', '#0ea5e9', '#a855f7']
    bar_colors = [colors_list[i % len(colors_list)] for i in range(len(labels))]
    
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.bar(labels, values, color=bar_colors)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    
    buf = BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
    buf.seek(0)
    plt.close()
    return buf


def create_line_chart(data_rows, report_type):
    """Create a line chart for unemployment or avg crime weight trend."""
    labels = [row.get('neighbourhood_name', '') for row in data_rows]
    
    if report_type == 'crime':
        values = [float(row.get('unemployment_percent', 0)) for row in data_rows]
        ylabel = 'Unemployment %'
        title = 'Unemployment vs Neighbourhood'
        color = '#10b981'
    else:
        values = [float(row.get('avg_crime_weight', 0)) for row in data_rows]
        ylabel = 'Avg Crime Weight'
        title = 'Avg Crime Weight Trend'
        color = '#ef4444'
    
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(labels, values, marker='o', color=color, linewidth=2)
    ax.set_ylabel(ylabel)
    ax.set_title(title)
    plt.xticks(rotation=45, ha='right')
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    buf = BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
    buf.seek(0)
    plt.close()
    return buf


@app.get("/api/reports/export")
async def export_report(type: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Export a comprehensive PDF report with charts and tables."""
    if type not in {"crime", "general"}:
        raise HTTPException(status_code=400, detail="Invalid report type")

    if current_user.role not in {"administrator", "ministry_of_interior"}:
        raise HTTPException(status_code=403, detail="Not authorized to export reports")

    if type == "crime":
        rows = await crime_report(db, current_user)
        title = "Crime Report"
    else:
        rows = await general_report(db, current_user)
        title = "General Analysis Report"

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    story = []
    styles = getSampleStyleSheet()
    
    # Title
    title_para = Paragraph(f"<b>{title}</b>", styles['Title'])
    story.append(title_para)
    story.append(Spacer(1, 0.3*inch))
    
    # Generate charts
    pie_chart_buf = create_pie_chart(rows)
    bar_chart_buf = create_bar_chart(rows, type)
    line_chart_buf = create_line_chart(rows, type)
    
    # Add Pie Chart
    story.append(Paragraph("<b>Crime Categories Distribution</b>", styles['Heading2']))
    story.append(Spacer(1, 0.1*inch))
    pie_img = Image(pie_chart_buf, width=5*inch, height=3.5*inch)
    story.append(pie_img)
    story.append(Spacer(1, 0.2*inch))
    
    # Add Bar Chart
    story.append(PageBreak())
    if type == 'crime':
        story.append(Paragraph("<b>Population per Neighbourhood</b>", styles['Heading2']))
    else:
        story.append(Paragraph("<b>Avg Crime Weight per Neighbourhood</b>", styles['Heading2']))
    story.append(Spacer(1, 0.1*inch))
    bar_img = Image(bar_chart_buf, width=6*inch, height=3.5*inch)
    story.append(bar_img)
    story.append(Spacer(1, 0.2*inch))
    
    # Add Line Chart
    story.append(PageBreak())
    if type == 'crime':
        story.append(Paragraph("<b>Unemployment vs Neighbourhood</b>", styles['Heading2']))
    else:
        story.append(Paragraph("<b>Avg Crime Weight Trend</b>", styles['Heading2']))
    story.append(Spacer(1, 0.1*inch))
    line_img = Image(line_chart_buf, width=6*inch, height=3.5*inch)
    story.append(line_img)
    story.append(Spacer(1, 0.3*inch))
    
    # Add Table
    story.append(PageBreak())
    story.append(Paragraph("<b>Report Table</b>", styles['Heading2']))
    story.append(Spacer(1, 0.1*inch))
    
    if type == 'crime':
        table_data = [['Neighbourhood', 'Population', 'Income', 'Unemp %', 'Crime Cat', 'Univ Edu %', 'Unmarried 30+ %']]
        for row in rows:
            table_data.append([
                str(row.get('neighbourhood_name', '')),
                f"{float(row.get('population', 0)):.2f}",
                str(row.get('income_level', '')),
                f"{float(row.get('unemployment_percent', 0)):.1f}",
                str(row.get('main_crime_category', 'N/A')),
                f"{float(row.get('university_education_percent', 0)):.1f}",
                f"{float(row.get('unmarried_over_30_percent', 0)):.1f}",
            ])
    else:
        table_data = [['Neighbourhood', 'Population', 'Income', 'Unemp %', 'Crime Cat', 'Avg Weight']]
        for row in rows:
            table_data.append([
                str(row.get('neighbourhood_name', '')),
                f"{float(row.get('population', 0)):.2f}",
                str(row.get('income_level', '')),
                f"{float(row.get('unemployment_percent', 0)):.1f}",
                str(row.get('main_crime_category', 'N/A')),
                f"{float(row.get('avg_crime_weight', 0)):.2f}",
            ])
    
    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
    ]))
    story.append(table)
    
    doc.build(story)
    buffer.seek(0)

    return StreamingResponse(buffer, media_type="application/pdf", headers={
        "Content-Disposition": f"inline; filename={type}_report.pdf",
    })


@app.get("/api/users")
async def list_users(db: Session = Depends(get_db)):
    """List all users in the users table (for debugging only)."""
    users = db.query(User).all()
    return [
        {"id": u.id, "email": u.email, "role": u.role}
        for u in users
    ]


@app.get("/api/crime-forms")
async def list_crime_forms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List crime form records."""
    rows = db.query(CrimeFormData).order_by(CrimeFormData.id.desc()).all()
    return [
        {
            "id": r.id,
            "main_category": r.main_category,
            "crime_weight": r.crime_weight,
            "subcategories": r.subcategories,
            "neighbourhood_name": r.neighbourhood_name,
            "date": r.date.isoformat(),
            "offender_income_level": r.offender_income_level,
            "climate": r.climate,
            "time_of_year": r.time_of_year,
        }
        for r in rows
    ]


@app.get("/api/crime/meta")
async def get_crime_meta(db: Session = Depends(get_db)):
    """Return main categories, their weights, and subcategories."""
    weights = db.query(CrimeWeight).all()
    categories = db.query(CrimeCategory).all()

    subs_by_main: dict[str, list[str]] = {}
    for c in categories:
        subs_by_main.setdefault(c.main_category, []).append(c.subcategory)

    result = []
    for w in weights:
        result.append({
            "main_category": w.main_category,
            "weight": w.weight,
            "subcategories": subs_by_main.get(w.main_category, []),
        })
    return result


class CrimeFormCreate(BaseModel):
    main_category: str
    subcategories: list[str]
    neighbourhood_name: str
    date: str
    offender_income_level: str
    climate: str
    time_of_year: str


@app.post("/api/crime-form", status_code=201)
async def create_crime_form(
    payload: CrimeFormCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Allow both general_statistic and administrator to insert
    if current_user.role not in ["general_statistic", "administrator"]:
        raise HTTPException(status_code=403, detail="Not authorized to insert crime data")

    weight_row = db.query(CrimeWeight).filter_by(main_category=payload.main_category).first()
    if not weight_row:
        raise HTTPException(status_code=400, detail="Invalid main category: no weight defined")

    try:
        crime_date = datetime.fromisoformat(payload.date).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format; expected YYYY-MM-DD")

    record = CrimeFormData(
        main_category=payload.main_category,
        crime_weight=weight_row.weight,
        subcategories=", ".join(payload.subcategories),
        neighbourhood_name=payload.neighbourhood_name,
        date=crime_date,
        offender_income_level=payload.offender_income_level,
        climate=payload.climate,
        time_of_year=payload.time_of_year,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {"id": record.id, "message": "Data saved successfully"}


class CrimeFormUpdate(BaseModel):
    main_category: str
    subcategories: list[str]
    neighbourhood_name: str
    date: str
    offender_income_level: str
    climate: str
    time_of_year: str


@app.put("/api/crime-form/{crime_id}")
async def update_crime_form(
    crime_id: int,
    payload: CrimeFormUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_roles = {"general_statistic", "hr", "civil_status", "ministry_of_justice", "administrator"}
    if current_user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized to update crime data")

    record = db.query(CrimeFormData).filter_by(id=crime_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    weight_row = db.query(CrimeWeight).filter_by(main_category=payload.main_category).first()
    if not weight_row:
        raise HTTPException(status_code=400, detail="Invalid main category: no weight defined")

    try:
        crime_date = datetime.fromisoformat(payload.date).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format; expected YYYY-MM-DD")

    record.main_category = payload.main_category
    record.crime_weight = weight_row.weight
    record.subcategories = ", ".join(payload.subcategories)
    record.neighbourhood_name = payload.neighbourhood_name
    record.date = crime_date
    record.offender_income_level = payload.offender_income_level
    record.climate = payload.climate
    record.time_of_year = payload.time_of_year

    db.commit()
    db.refresh(record)

    return {"id": record.id, "message": "Data updated successfully"}


@app.delete("/api/crime-form/{crime_id}", status_code=204)
async def delete_crime_form(
    crime_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "administrator":
        raise HTTPException(status_code=403, detail="Not authorized to delete crime data")

    record = db.query(CrimeFormData).filter_by(id=crime_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    db.delete(record)
    db.commit()
    return


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@app.post("/auth/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Basic email/password login for the 6 predefined users."""
    user = authenticate_user(db, req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id)})

    return {
        "token": token,
        "user": {"id": user.id, "email": user.email, "role": user.role},
        "message": "Login successful",
    }


@app.get("/api/me")
async def read_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's info from the database."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
    }

@app.get("/api/neighbourhoods-with-coords")
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


@app.get("/api/neighbourhood/{neighbourhood_name}/crime-weight")
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
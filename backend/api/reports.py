from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib.units import inch

from database import get_db
from models import User
from auth import get_current_user
from utils.chart_generator import create_pie_chart, create_bar_chart, create_line_chart

router = APIRouter(prefix="/api/reports", tags=["Reports"])

# Returns crime data per neighbourhood for report generation
# Uses LATERAL join to find the most common crime category per neighbourhood
# LATERAL allows the subquery to reference the outer query (n.name)

@router.get("/crime")
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

# Similar to crime_report but includes average crime weight
# Joins with crime_weights table to get weight values

@router.get("/general")
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

# Generates a PDF report with charts and tables
# Only administrator and ministry_of_interior can export
# Uses ReportLab library to create professional PDF documents
# Includes pie chart, bar chart, line chart, and data table
# Returns PDF as streaming response for download or view

@router.get("/export")
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
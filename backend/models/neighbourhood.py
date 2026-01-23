from sqlalchemy import Column, Integer, String, Numeric
from database import Base

# Stores demographic information about each neighbourhood
# population: stored as thousands (e.g., 64.326 = 64,326 people)
# income_level: categorical (High/Medium/Low)
# Percentages: university education, unemployment, unmarried over 30
# latitude/longitude: GPS coordinates for map display

class Neighbourhood(Base):
    """Neighbourhood demographic and crime-related attributes.

    Matches the existing `neighbourhood` table in the database.
    """

    __tablename__ = "neighbourhood"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    # Values like 64.326 (thousand people)
    population = Column(Numeric(10, 3), nullable=False)
    # Income level: High / Medium / Low
    income_level = Column(String, nullable=False)
    # Percentages (0-100)
    university_education_percent = Column(Numeric(5, 2), nullable=False)
    unemployment_percent = Column(Numeric(5, 2), nullable=False)
    unmarried_over_30_percent = Column(Numeric(5, 2), nullable=False)
    # Geographic coordinates for mapping
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
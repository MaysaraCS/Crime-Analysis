from sqlalchemy import Column, Integer, String, Numeric, Date
from database import Base

class User(Base):
    """Application user.

    In this simplified version we manage users ourselves (no Clerk):
    - email: one of the 6 fixed addresses you defined
    - password: stored in plain text in the DB (demo only!)
    - role: application role used for authorization on the frontend/backend
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False)


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


class CrimeCategory(Base):
    """Main crime categories and their subcategories."""

    __tablename__ = "crime_categories"

    id = Column(Integer, primary_key=True, index=True)
    main_category = Column(String, nullable=False)
    subcategory = Column(String, nullable=False)


class CrimeWeight(Base):
    """Weight per main crime category (1-10)."""

    __tablename__ = "crime_weights"

    id = Column(Integer, primary_key=True, index=True)
    main_category = Column(String, unique=True, nullable=False)
    weight = Column(Integer, nullable=False)


class CrimeFormData(Base):
    """Data entered on the crime information form (Insert page)."""

    __tablename__ = "crime_form_data"

    id = Column(Integer, primary_key=True, index=True)
    main_category = Column(String, nullable=False)
    crime_weight = Column(Integer, nullable=False)
    # Comma-separated list of selected subcategories for this record
    subcategories = Column(String, nullable=False)
    neighbourhood_name = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    # Offender income level: low / middle / high
    offender_income_level = Column(String, nullable=False)
    # Climate at time of crime: hot / cold / moderate
    climate = Column(String, nullable=False)
    # Time of year: summer / winter / spring / autumn
    time_of_year = Column(String, nullable=False)

from sqlalchemy import Column, Integer, String, Date
from database import Base


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
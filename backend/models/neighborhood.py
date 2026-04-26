from sqlalchemy import Column, Integer, String, Numeric, Boolean
from database import Base


class Neighborhood(Base):
    __tablename__ = "neighborhoods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    latitude = Column(Numeric(10, 7), nullable=False)
    longitude = Column(Numeric(10, 7), nullable=False)

    population_density_score = Column(Integer, nullable=False)
    divorce_ratio_score = Column(Integer, nullable=False)
    unmarried_over_30_score = Column(Integer, nullable=False)
    university_education_score = Column(Integer, nullable=False)
    unemployment_score = Column(Integer, nullable=False)
    income_score = Column(Integer, nullable=False)
    vitality_score = Column(Integer, nullable=False)

    # Added in Query03 migration
    is_core = Column(Boolean, nullable=False, default=True, server_default="true")
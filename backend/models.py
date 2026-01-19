from sqlalchemy import Column, Integer, String, Numeric
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
    """Neighbourhood demographic and socio-economic indicators.

    Backed by the "neighbourhood" table in PostgreSQL.
    """

    __tablename__ = "neighbourhood"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    # Values like 64.326 etc. (can represent thousands of residents)
    population = Column(Numeric(10, 3), nullable=False)
    # "High" | "Medium" | "Low"
    income_level = Column(String, nullable=False)
    # Percentages like 85 -> 85.0
    university_education_percent = Column(Numeric(5, 2), nullable=False)
    unemployment_percent = Column(Numeric(5, 2), nullable=False)
    unmarried_over_30_percent = Column(Numeric(5, 2), nullable=False)

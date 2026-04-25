from sqlalchemy import Column, Integer, String, Text
from database import Base

class CrimeClassification(Base):
    __tablename__ = "crime_classifications"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(Integer, unique=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    weight = Column(Integer, nullable=False)
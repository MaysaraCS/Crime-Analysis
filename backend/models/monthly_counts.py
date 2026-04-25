from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from database import Base

class CrimeMonthlyCount(Base):
    __tablename__ = "crime_monthly_counts"
    __table_args__ = (
        UniqueConstraint("neighborhood_id", "classification_id", "year", "month", name="uq_monthly"),
    )

    id = Column(Integer, primary_key=True, index=True)
    neighborhood_id = Column(Integer, ForeignKey("neighborhoods.id", ondelete="CASCADE"), nullable=False)
    classification_id = Column(Integer, ForeignKey("crime_classifications.id", ondelete="CASCADE"), nullable=False)

    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    crime_count = Column(Integer, nullable=False)
from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, UniqueConstraint
from database import Base

class RiskScore(Base):
    __tablename__ = "risk_scores"
    __table_args__ = (
        UniqueConstraint("neighborhood_id", "year", name="uq_risk_year"),
    )

    id = Column(Integer, primary_key=True, index=True)
    neighborhood_id = Column(Integer, ForeignKey("neighborhoods.id", ondelete="CASCADE"), nullable=False)
    year = Column(Integer, nullable=False)

    r1 = Column(Numeric(6, 2), nullable=False)
    r2 = Column(Numeric(6, 2), nullable=False)
    r = Column(Numeric(6, 2), nullable=False)
    label = Column(String, nullable=False)
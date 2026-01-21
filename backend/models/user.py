from sqlalchemy import Column, Integer, String
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
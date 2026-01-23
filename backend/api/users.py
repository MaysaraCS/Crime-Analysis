from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import User

router = APIRouter(prefix="/api/users", tags=["Users"])

# Represents the users table in the database
# Stores email, password (plain text - demo only), and role
# role field determines what pages/actions user can access
# Uses SQLAlchemy ORM to map Python class to database table

@router.get("")
async def list_users(db: Session = Depends(get_db)):
    """List all users in the users table (for debugging only)."""
    users = db.query(User).all()
    return [
        {"id": u.id, "email": u.email, "role": u.role}
        for u in users
    ]
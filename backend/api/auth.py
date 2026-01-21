from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from database import get_db
from models import User
from auth import authenticate_user, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Basic email/password login for the 6 predefined users."""
    user = authenticate_user(db, req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id)})

    return {
        "token": token,
        "user": {"id": user.id, "email": user.email, "role": user.role},
        "message": "Login successful",
    }


@router.get("/me")
async def read_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's info from the database."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
    }
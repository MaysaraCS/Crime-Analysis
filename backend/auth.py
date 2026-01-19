import os
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from jose import JWTError, jwt

from database import get_db
from models import User

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")  # set a strong key in .env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# HTTP Bearer auth scheme to read the Authorization header
http_bearer = HTTPBearer(auto_error=False)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT for the given payload."""
    to_encode = data.copy()
    if expires_delta is None:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Return the user if email/password match, else None.

    For this project we compare plain-text passwords as stored in Neon.
    In a real app you must hash passwords instead.
    """
    user = db.query(User).filter_by(email=email).first()
    if not user:
        return None
    if user.password != password:
        return None
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency that returns the current DB user.

    - Reads Bearer token from the Authorization header.
    - Decodes it using a shared SECRET_KEY.
    - Loads the user from the `users` table.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from exc

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token missing subject")

    user = db.query(User).filter_by(id=int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user
import os
from functools import lru_cache

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from database import get_db
from models import User

load_dotenv()

CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL")
if not CLERK_JWKS_URL:
    raise RuntimeError("CLERK_JWKS_URL is not set in the environment")

# HTTP Bearer auth scheme to read the Authorization header
http_bearer = HTTPBearer(auto_error=False)


@lru_cache
def get_jwks_client() -> PyJWKClient:
    """Return a cached PyJWKClient for Clerk's JWKS endpoint."""
    return PyJWKClient(CLERK_JWKS_URL)


def verify_clerk_token(token: str) -> dict:
    """Verify a Clerk-issued JWT and return its payload.

    We verify the signature and expiration using Clerk's JWKS.
    Audience / issuer checks are skipped for simplicity; you can
    tighten this later by adding `audience` and `issuer` parameters.
    """
    try:
        signing_key = get_jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return payload
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency that returns the current DB user.

    - Reads Bearer token from the Authorization header.
    - Verifies it against Clerk's JWKS.
    - Upserts a row in the local `users` table based on Clerk user id.
    """
    # Debug: show what we received in the auth header
    print("get_current_user credentials:", credentials)

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )

    token = credentials.credentials
    payload = verify_clerk_token(token)

    clerk_id = payload.get("sub")
    if not clerk_id:
        raise HTTPException(status_code=401, detail="Token missing subject")

    # Try to get email from standard Clerk claims
    email = payload.get("email")
    if not email:
        emails = payload.get("email_addresses") or []
        if isinstance(emails, list) and emails:
            email = emails[0].get("email_address")

    # Role is exposed as a simple claim from the JWT template
    role = payload.get("role")

    # Look up user in local DB
    user = db.query(User).filter_by(clerk_id=clerk_id).first()

    if not user:
        # Create a new user record
        user = User(
            clerk_id=clerk_id,
            email=email or "",
            role=role or "unknown",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Keep email / role in sync if they change in Clerk
        updated = False
        if email and user.email != email:
            user.email = email
            updated = True
        if role and user.role != role:
            user.role = role
            updated = True
        if updated:
            db.commit()
            db.refresh(user)

    return user

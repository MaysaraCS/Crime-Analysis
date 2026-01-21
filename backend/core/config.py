import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# CORS settings
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    # Add your Vercel domain here after deployment
    "https://your-app-name.vercel.app",  # Replace with your actual Vercel URL
    "https://*.vercel.app",  # Allow all Vercel preview deployments
]
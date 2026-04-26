#!/usr/bin/env bash
set -e

echo "=== Crime Analysis API - Render Startup ==="

# Train model if it doesn't exist (Render free tier has ephemeral disk,
# so this runs on every cold start / redeploy)
if [ ! -f "risk_model.joblib" ]; then
    echo ">>> risk_model.joblib not found - training now (this takes ~30-90 seconds)..."
    python train_risk_model.py
    echo ">>> Model training complete."
else
    echo ">>> risk_model.joblib found - skipping training."
fi

echo ">>> Starting FastAPI server..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
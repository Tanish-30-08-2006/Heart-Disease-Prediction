# =============================================================================
# backend/main.py
# CardioRisk — Clinical Heart Disease Assessment API
# FastAPI backend deployed on Render (Python 3.11)
#
# What this file does step by step:
#   1. Loads 3 joblib artifacts from /models at server startup (once only)
#   2. Defines a Pydantic schema to validate every incoming request field
#   3. Reconstructs the exact feature DataFrame the model was trained on
#   4. Applies StandardScaler (transform only — never fit again)
#   5. Runs Random Forest predict_proba
#   6. Applies 35% medical safety threshold to get binary prediction
#   7. Returns: prediction, probability %, feature importances dict
# =============================================================================

import os
import joblib
import numpy as np
import pandas as pd

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# -----------------------------------------------------------------------------
# ARTIFACT LOADING
# Runs once at startup. If any file is missing, the server refuses to start.
# This is intentional — we want Render to mark the deploy as failed rather
# than silently serving broken predictions.
# -----------------------------------------------------------------------------

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

try:
    rf_model       = joblib.load(os.path.join(MODELS_DIR, "random_forest_model.joblib"))
    scaler         = joblib.load(os.path.join(MODELS_DIR, "standard_scaler.joblib"))
    model_features = joblib.load(os.path.join(MODELS_DIR, "model_features.joblib"))
    print("✓ All 3 model artifacts loaded successfully.")
    print(f"  └─ Feature count: {len(model_features)}")
    print(f"  └─ Feature list:  {model_features}")
except FileNotFoundError as e:
    raise RuntimeError(f"FATAL — missing model artifact: {e}")


# -----------------------------------------------------------------------------
# CORS SETUP
#
# FRONTEND_URL environment variable controls which origin is allowed.
# On Render: set FRONTEND_URL = https://your-app.vercel.app
# Locally:   falls back to http://localhost:5500 (VS Code Live Server default)
#            OR http://127.0.0.1:5500 (alternate localhost form)
#
# We allow both localhost variants so you can test locally without
# changing the env variable every time.
# -----------------------------------------------------------------------------

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5500")

# Build the allowed origins list
# In production FRONTEND_URL will be the single Vercel URL.
# Locally we also allow the alternate 127.0.0.1 form.
ALLOWED_ORIGINS = [FRONTEND_URL]
if "localhost" in FRONTEND_URL or "127.0.0.1" in FRONTEND_URL:
    ALLOWED_ORIGINS += [
        "https://cardiorisk-prediction.vercel.app"
    ]

print(f"✓ CORS configured. Allowed origins: {ALLOWED_ORIGINS}")

app = FastAPI(
    title="CardioRisk Clinical Assessment API",
    description=(
        "Academic portfolio project. Accepts structured patient clinical data "
        "and returns a cardiac risk classification using a trained Random Forest model. "
        "NOT a licensed medical device. Not for clinical use."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


# -----------------------------------------------------------------------------
# REQUEST SCHEMA (Pydantic)
#
# Pydantic validates every field BEFORE our prediction logic runs.
# If a field is missing or the wrong type, FastAPI automatically returns
# a 422 Unprocessable Entity with a detailed error message.
# We never need to write manual validation checks for type or presence.
# -----------------------------------------------------------------------------

class PatientData(BaseModel):
    Age:            int   = Field(..., ge=1,   le=120, description="Age in years")
    Sex:            int   = Field(..., ge=0,   le=1,   description="0=Female, 1=Male")
    ChestPainType:  str   = Field(...,                 description="ATA | NAP | ASY | TA")
    RestingBP:      int   = Field(..., ge=60,  le=250, description="Resting BP in mmHg")
    Cholesterol:    int   = Field(..., ge=0,   le=700, description="Serum cholesterol mg/dL")
    FastingBS:      int   = Field(..., ge=0,   le=1,   description="Fasting BS >120: 0 or 1")
    RestingECG:     str   = Field(...,                 description="Normal | ST | LVH")
    MaxHR:          int   = Field(..., ge=50,  le=250, description="Max HR in bpm")
    ExerciseAngina: int   = Field(..., ge=0,   le=1,   description="0=No, 1=Yes")
    Oldpeak:        float = Field(..., ge=-5,  le=10,  description="ST depression value")
    ST_Slope:       str   = Field(...,                 description="Up | Flat | Down")

    # Validate the string fields to prevent garbage input
    def validate_categoricals(self):
        valid = {
            'ChestPainType': ['ATA', 'NAP', 'ASY', 'TA'],
            'RestingECG':    ['Normal', 'ST', 'LVH'],
            'ST_Slope':      ['Up', 'Flat', 'Down'],
        }
        for field, options in valid.items():
            val = getattr(self, field)
            if val not in options:
                raise ValueError(f"Invalid value for {field}: '{val}'. Must be one of {options}.")


# -----------------------------------------------------------------------------
# FEATURE ENGINEERING FUNCTION
#
# This EXACTLY replicates what notebook 03 did to build X_train_final.csv.
# The order and names of output columns must match model_features.joblib.
#
# Steps:
#   1. Start with raw numeric/binary fields (already correct type from Pydantic)
#   2. One-hot encode ChestPainType (drop_first=True dropped 'TA' during training)
#   3. One-hot encode RestingECG    (drop_first=True dropped 'LVH')
#   4. One-hot encode ST_Slope      (drop_first=True dropped 'Down')
#   5. Create 4 engineered features
#   6. Reorder columns to match model_features.joblib exactly
# -----------------------------------------------------------------------------

# Columns the StandardScaler was fitted on during training.
# MUST match exactly what was passed to scaler.fit() in notebook 03.
COLUMNS_TO_SCALE = ['Age', 'RestingBP', 'MaxHR', 'Oldpeak', 'BP_Chol_Risk']


def build_feature_row(data: PatientData) -> pd.DataFrame:
    """
    Transform raw PatientData → feature DataFrame that matches the trained model's
    expected input schema exactly.
    """

    # ── Step 1: Core numeric / binary fields ──────────────────────────────────
    row = {
        'Age':            data.Age,
        'RestingBP':      data.RestingBP,
        'Cholesterol':    data.Cholesterol,
        'FastingBS':      data.FastingBS,
        'MaxHR':          data.MaxHR,
        'Oldpeak':        data.Oldpeak,
        'Sex':            data.Sex,
        'ExerciseAngina': data.ExerciseAngina,
    }

    # ── Step 2: One-hot encode ChestPainType ──────────────────────────────────
    # Training used pd.get_dummies(drop_first=True) which dropped 'TA'.
    # So we only create the ATA, NAP, ASY columns. When all three are 0, it
    # means the patient has Typical Angina (the dropped baseline).
    row['ChestPainType_ATA'] = 1 if data.ChestPainType == 'ATA' else 0
    row['ChestPainType_NAP'] = 1 if data.ChestPainType == 'NAP' else 0
    row['ChestPainType_ASY'] = 1 if data.ChestPainType == 'ASY' else 0

    # ── Step 3: One-hot encode RestingECG ────────────────────────────────────
    # drop_first=True dropped 'LVH'. When both Normal and ST are 0, it means LVH.
    row['RestingECG_Normal'] = 1 if data.RestingECG == 'Normal' else 0
    row['RestingECG_ST']     = 1 if data.RestingECG == 'ST'     else 0

    # ── Step 4: One-hot encode ST_Slope ──────────────────────────────────────
    # drop_first=True dropped 'Down'. When both Flat and Up are 0, it means Down.
    row['ST_Slope_Flat'] = 1 if data.ST_Slope == 'Flat' else 0
    row['ST_Slope_Up']   = 1 if data.ST_Slope == 'Up'   else 0

    # ── Step 5: Engineered features (MUST mirror notebook 03 exactly) ─────────

    # MaxHR_Deficit: how far below age-predicted max HR is the patient?
    # Clinical basis: 220 - Age = theoretical maximum HR for a healthy person.
    # Higher deficit = worse cardiac reserve = more disease risk.
    row['MaxHR_Deficit'] = (220 - data.Age) - data.MaxHR

    # BP_Chol_Risk: interaction of two compounding risk factors.
    # A patient with BOTH high BP and high cholesterol has compounded arterial risk.
    row['BP_Chol_Risk'] = data.RestingBP * data.Cholesterol

    # Is_Senior: binary flag for age >= 60 (substantially elevated baseline risk)
    row['Is_Senior'] = 1 if data.Age >= 60 else 0

    # Is_Hypertensive: binary flag for Stage 2 hypertension (BP >= 140 mmHg)
    row['Is_Hypertensive'] = 1 if data.RestingBP >= 140 else 0

    # ── Step 6: Build DataFrame and reorder to match model_features ───────────
    # model_features.joblib contains the exact ordered list saved from notebook 03.
    # If we send columns in the wrong order, the model maps feature values to
    # wrong positions and produces garbage predictions.
    df_row = pd.DataFrame([row])

    # This line will raise a KeyError if any expected column is missing.
    # That's intentional — it immediately flags a training/serving mismatch.
    df_row = df_row[model_features]

    return df_row


# -----------------------------------------------------------------------------
# PREDICTION THRESHOLD
# 35% instead of 50% — clinical safety decision.
# See methodology.html for full justification.
# -----------------------------------------------------------------------------
PREDICTION_THRESHOLD = 0.35


# -----------------------------------------------------------------------------
# PREDICTION ENDPOINT
# POST /predict
# -----------------------------------------------------------------------------

@app.post("/predict")
async def predict(patient: PatientData):
    """
    Accepts raw patient data. Runs the full preprocessing pipeline.
    Returns binary prediction, probability %, and feature importances.

    Response shape:
    {
        "prediction":          0 or 1,
        "probability_pct":     float (0-100),
        "threshold_applied":   0.35,
        "feature_importances": [ { "feature": str, "importance": float }, ... ]
    }
    """

    # Validate categorical string values
    try:
        patient.validate_categoricals()
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    try:
        # ── Step 1: Build feature row (encode + engineer) ──────────────────────
        df_input = build_feature_row(patient)

        # ── Step 2: Apply StandardScaler to quantitative columns only ──────────
        # CRITICAL: We call .transform() NEVER .fit() here.
        # The scaler's mean and std are locked to the training data.
        # Fitting on new data would be data leakage.
        df_input[COLUMNS_TO_SCALE] = scaler.transform(df_input[COLUMNS_TO_SCALE])

        # ── Step 3: Get probability from Random Forest ─────────────────────────
        # predict_proba returns shape (1, 2): [[prob_class_0, prob_class_1]]
        # Index [0][1] = probability that this patient has heart disease (class 1)
        probability = float(rf_model.predict_proba(df_input)[0][1])

        # ── Step 4: Apply 35% threshold ────────────────────────────────────────
        # >= threshold → classify as high risk (1)
        # <  threshold → classify as low risk  (0)
        prediction = 1 if probability >= PREDICTION_THRESHOLD else 0

        # ── Step 5: Package feature importances ───────────────────────────────
        # rf_model.feature_importances_ is a numpy array of shape (n_features,)
        # Each value is the mean Gini impurity reduction for that feature
        # across all 100 trees, normalised so they sum to 1.0.
        importances = rf_model.feature_importances_

        feature_importance_list = [
            {
                "feature":    feat_name,
                "importance": round(float(imp), 6)
            }
            for feat_name, imp in zip(model_features, importances)
        ]

        # Sort descending so frontend can display top-N without sorting itself
        feature_importance_list.sort(key=lambda x: x["importance"], reverse=True)

        return {
            "prediction":          int(prediction),
            "probability_pct":     round(probability * 100, 2),
            "threshold_applied":   PREDICTION_THRESHOLD,
            "feature_importances": feature_importance_list,
        }

    except KeyError as e:
        # Column mismatch — training / serving schema mismatch
        raise HTTPException(
            status_code=422,
            detail=f"Feature schema mismatch: {e}. Check model_features.joblib matches notebook 03 output."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")


# -----------------------------------------------------------------------------
# HEALTH CHECK
# GET /health
# Render pings this to verify the service is alive.
# Settings page also pings this to display live API status.
# -----------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status":            "operational",
        "model":             "Random Forest (baseline, n_estimators=100)",
        "feature_count":     len(model_features),
        "threshold":         PREDICTION_THRESHOLD,
        "python_version":    "3.11",
        "scikit_learn":      "1.4.2",
    }


# -----------------------------------------------------------------------------
# ROOT
# GET /
# Returns a brief description. FastAPI auto-docs at /docs.
# -----------------------------------------------------------------------------

@app.get("/")
async def root():
    return {
        "api":     "CardioRisk Clinical Assessment API",
        "version": "1.0.0",
        "docs":    "/docs",
        "health":  "/health",
        "note":    "Academic portfolio project. Not a licensed medical device.",
    }
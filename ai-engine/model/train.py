import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os

DATA_PATH    = os.path.join(os.path.dirname(__file__), "..", "data", "vulnerabilities.csv")
MODEL_DIR    = os.path.join(os.path.dirname(__file__), "..", "saved_model")
MODEL_PATH   = os.path.join(MODEL_DIR, "bounty_model.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "label_encoders.pkl")
FEATURE_PATH = os.path.join(MODEL_DIR, "feature_names.pkl")

SEVERITY_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}

def train():
    os.makedirs(MODEL_DIR, exist_ok=True)
    df = pd.read_csv(DATA_PATH)
    print(f"[INFO] Loaded {len(df)} training samples.")

    df["severity_enc"]  = df["severity"].str.lower().map(SEVERITY_ORDER)
    le = LabelEncoder()
    df["vuln_type_enc"] = le.fit_transform(df["vuln_type"])

    features = ["vuln_type_enc","severity_enc","cvss_score","has_poc","public_exploit","affected_users","asset_criticality"]
    X = df[features]
    y = df["bounty"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = GradientBoostingRegressor(n_estimators=200, learning_rate=0.1, max_depth=4, random_state=42)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    print(f"[RESULT] MAE : ${mean_absolute_error(y_test, preds):.2f}")
    print(f"[RESULT] R²  : {r2_score(y_test, preds):.4f}")

    joblib.dump(model, MODEL_PATH)
    joblib.dump(le,    ENCODER_PATH)
    joblib.dump(features, FEATURE_PATH)
    print("\n✅ Training complete! Now run: uvicorn main:app --reload")

if __name__ == "__main__":
    train()
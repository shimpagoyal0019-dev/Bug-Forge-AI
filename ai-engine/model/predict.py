import os
import numpy as np
import joblib

MODEL_DIR    = os.path.join(os.path.dirname(__file__), "..", "saved_model")
MODEL_PATH   = os.path.join(MODEL_DIR, "bounty_model.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "label_encoders.pkl")

SEVERITY_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}

def _load():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError("Model not found! Please run: python model/train.py")
    return joblib.load(MODEL_PATH), joblib.load(ENCODER_PATH)

_model, _label_encoder = _load()

def predict_bounty(vuln_type, severity, cvss_score, has_poc, public_exploit, affected_users, asset_criticality):
    known_types = list(_label_encoder.classes_)
    if vuln_type in known_types:
        vuln_type_enc = int(_label_encoder.transform([vuln_type])[0])
    else:
        vuln_type_enc = len(known_types) // 2
    severity_enc = SEVERITY_ORDER.get(severity.lower(), 1)

    features = np.array([[vuln_type_enc, severity_enc, cvss_score, int(has_poc), int(public_exploit), affected_users, asset_criticality]])
    raw = float(_model.predict(features)[0])
    minimum_bounty = max(50, int(round(raw, -1)))

    if cvss_score >= 9.0:
        risk = "CRITICAL"
    elif cvss_score >= 7.0:
        risk = "HIGH"
    elif cvss_score >= 4.0:
        risk = "MEDIUM"
    else:
        risk = "LOW"

    return {
        "minimum_bounty": minimum_bounty,
        "confidence_band": {"low": int(minimum_bounty * 0.85), "high": int(minimum_bounty * 1.15)},
        "risk_label": risk,
        "cvss_score": cvss_score,
    }
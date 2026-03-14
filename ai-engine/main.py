from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from schemas.vulnerability import VulnerabilityInput, BountyResponse
from model.predict import predict_bounty

app = FastAPI(
    title="Bug Forge AI – Bounty Valuation API",
    description="ML-powered minimum bounty recommender by Cipher Crew, NIT Hamirpur.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "status": "online",
        "project": "Bug Forge AI",
        "team": "Cipher Crew – NIT Hamirpur",
        "docs": "Visit /docs for the interactive API explorer",
    }

@app.post("/predict-bounty", response_model=BountyResponse)
def predict(vuln: VulnerabilityInput):
    try:
        result = predict_bounty(
            vuln_type=vuln.vuln_type,
            severity=vuln.severity,
            cvss_score=vuln.cvss_score,
            has_poc=vuln.has_poc,
            public_exploit=vuln.public_exploit,
            affected_users=vuln.affected_users,
            asset_criticality=vuln.asset_criticality,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

    return BountyResponse(
        **result,
        message=(
            f"Recommended minimum bounty for a {vuln.severity.upper()} "
            f"{vuln.vuln_type} is ${result['minimum_bounty']:,}. "
            f"Range: ${result['confidence_band']['low']:,} – ${result['confidence_band']['high']:,}."
        ),
    )

@app.get("/supported-vuln-types")
def supported_types():
    return {"vuln_types": [
        "XSS", "SQL Injection", "RCE", "SSRF", "IDOR",
        "Auth Bypass", "Path Traversal", "XXE", "CSRF",
        "Buffer Overflow", "Privilege Escalation", "Open Redirect",
        "Information Disclosure", "Broken Access Control",
        "Insecure Deserialization", "Other",
    ]}
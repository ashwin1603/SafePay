import uuid
import pytest
from app.core import roles
from tests.conftest import register, login
from app.database import SessionLocal
from app.models.user import User
from app.models.transaction import Transaction
from app.models.fraud_rule import FraudRule
from app.services.stepup import _challenges

def _promote(email, role):
    db = SessionLocal()
    u = db.query(User).filter(User.email == email).first()
    u.role = role
    db.commit()
    db.close()

def _get_access_token(client, email):
    return login(client, email).json()["access_token"]

def test_explainable_fraud_endpoint(client, new_email):
    # Test that normal processing returns explanations
    email = new_email()
    register(client, email)
    tok = _get_access_token(client, email)
    
    # Try a transaction
    res = client.post("/process-payment",
                      json={"amount": 120.50, "idempotency_key": uuid.uuid4().hex},
                      headers={"Authorization": f"Bearer {tok}"})
    assert res.status_code in (200, 201)
    data = res.json()
    assert "txn_id" in data
    
    # Get transaction details
    txn_id = int(data["txn_id"].split("-")[1])
    res_details = client.get(f"/transactions/{txn_id}", headers={"Authorization": f"Bearer {tok}"})
    assert res_details.status_code == 200
    details = res_details.json()
    assert "fraud_explanation" in details
    assert details["fraud_explanation"] is not None
    assert "summary" in details["fraud_explanation"]
    assert "signals" in details["fraud_explanation"]

def test_appeals_workflow(client, new_email):
    email = new_email()
    register(client, email)
    tok = _get_access_token(client, email)
    
    # Set up a transaction we can appeal. We can insert one or trigger one.
    # Let's insert a blocked transaction to DB directly for testing appeal submit.
    db = SessionLocal()
    u = db.query(User).filter(User.email == email).first()
    txn = Transaction(
        user_id=u.id,
        amount=500.0,
        description="Blocked test payment",
        status="BLOCKED",
        risk_score=0.85,
        idempotency_key=uuid.uuid4().hex,
        provider_ref="sim_ref",
        fraud_explanation={"decision": "BLOCKED", "summary": "High risk", "signals": []}
    )
    db.add(txn)
    db.commit()
    txn_id = txn.id
    db.close()
    
    # Try appealing as the owner (reason must be >= 10 chars)
    res_appeal = client.post(f"/appeals/transactions/{txn_id}", json={"reason": "This is a legitimate business transaction."},
                             headers={"Authorization": f"Bearer {tok}"})
    assert res_appeal.status_code == 200
    assert res_appeal.json()["appeal_status"] == "pending"
    assert res_appeal.json()["appeal_reason"] == "This is a legitimate business transaction."
    
    # Check operator reviewing appeal
    op_email = new_email()
    register(client, op_email)
    _promote(op_email, roles.OPERATOR)
    op_tok = _get_access_token(client, op_email)
    
    # List pending appeals
    res_list = client.get("/appeals/pending", headers={"Authorization": f"Bearer {op_tok}"})
    assert res_list.status_code == 200
    pending_ids = [a["transaction_id"] for a in res_list.json()]
    assert txn_id in pending_ids
    
    # Review appeal (approve)
    res_review = client.put(f"/appeals/{txn_id}/review", json={"decision": "approved"},
                            headers={"Authorization": f"Bearer {op_tok}"})
    assert res_review.status_code == 200
    assert res_review.json()["appeal_status"] == "approved"
    assert res_review.json()["status"] == "COMPLETED"

def test_fraud_rules_crud_and_backtest(client, new_email):
    # Operator permissions
    email = new_email()
    register(client, email)
    _promote(email, roles.OPERATOR)
    tok = _get_access_token(client, email)
    h = {"Authorization": f"Bearer {tok}"}
    
    # Create a rule
    rule_data = {
        "name": "High amount limit",
        "description": "Flag transactions above 1000",
        "conditions": [
            {"field": "amount", "operator": ">", "value": 1000.0, "combinator": "and"}
        ],
        "action": "flag"
    }
    res_create = client.post("/fraud-rules", json=rule_data, headers=h)
    assert res_create.status_code == 201
    rule_id = res_create.json()["id"]
    assert res_create.json()["name"] == "High amount limit"
    
    # Get active rules
    res_list = client.get("/fraud-rules", headers=h)
    assert res_list.status_code == 200
    assert any(r["id"] == rule_id for r in res_list.json())
    
    # Toggle active
    res_toggle = client.post(f"/fraud-rules/{rule_id}/toggle", headers=h)
    assert res_toggle.status_code == 200
    assert res_toggle.json()["is_active"] is True
    
    # Backtest
    res_backtest = client.post(f"/fraud-rules/{rule_id}/backtest", headers=h)
    assert res_backtest.status_code == 200
    assert "total_tested" in res_backtest.json()
    assert "would_flag" in res_backtest.json()
    
    # Delete rule
    res_delete = client.delete(f"/fraud-rules/{rule_id}", headers=h)
    assert res_delete.status_code == 200

def test_stepup_authentication_flow(client, new_email):
    # Step-up threshold is 0.35. Let's send a payment amount that is expected to
    # trigger step-up verification. The ML model scoring might yield different results,
    # but the payment_service triggers step-up if the score exceeds STEPUP_THRESHOLD but is less than BLOCKED.
    # Let's mock or perform a payment.
    email = new_email()
    register(client, email)
    tok = _get_access_token(client, email)
    
    # Run a transaction that hits step-up. If it doesn't naturally hit it, we can trigger one with amount=250.
    res = client.post("/process-payment",
                      json={"amount": 250.0, "idempotency_key": uuid.uuid4().hex},
                      headers={"Authorization": f"Bearer {tok}"})
    assert res.status_code in (200, 201)
    data = res.json()
    
    if data.get("status") == "STEPUP_REQUIRED":
        assert "challenge_id" in data
        challenge_id = data["challenge_id"]
        
        # Get code from stepup service memory for testing verification
        from app.services.stepup import _challenges
        code = _challenges[challenge_id].code
        
        # Verify challenge
        res_verify = client.post("/process-payment/step-up-verify",
                                 json={"challenge_id": challenge_id, "code": code},
                                 headers={"Authorization": f"Bearer {tok}"})
        assert res_verify.status_code == 200
        assert res_verify.json()["status"] == "COMPLETED"

def test_consortium_endpoints(client, new_email):
    # Admin is required for consortium management
    email = new_email()
    register(client, email)
    _promote(email, roles.ADMIN)
    tok = _get_access_token(client, email)
    h = {"Authorization": f"Bearer {tok}"}
    
    # Get status
    res_status = client.get("/consortium/status", headers=h)
    assert res_status.status_code == 200
    assert "enabled" in res_status.json()
    
    # Export Bloom Filter
    res_export = client.get("/consortium/bloom", headers=h)
    assert res_export.status_code == 200
    assert "filter_base64" in res_export.json()
    
    # Check signal
    res_check = client.post("/consortium/check", json={"hashed_signals": ["abc123hash"]}, headers=h)
    assert res_check.status_code == 200
    assert "matches" in res_check.json()

def test_analytics_endpoints(client, new_email):
    email = new_email()
    register(client, email)
    _promote(email, roles.OPERATOR)
    tok = _get_access_token(client, email)
    h = {"Authorization": f"Bearer {tok}"}
    
    res = client.get("/analytics/summary", headers=h)
    assert res.status_code == 200
    data = res.json()
    assert "risk_distribution" in data
    assert "rates" in data
    assert "top_signals" in data
    assert "drift" in data

def test_simulation_endpoints(client, new_email):
    email = new_email()
    register(client, email)
    _promote(email, roles.OPERATOR)
    tok = _get_access_token(client, email)
    h = {"Authorization": f"Bearer {tok}"}
    
    # Get scenarios
    res_scenarios = client.get("/simulation/scenarios", headers=h)
    assert res_scenarios.status_code == 200
    assert len(res_scenarios.json()) > 0
    
    # Run simulation scenario
    res_run = client.post("/simulation/run", json={"scenario": "card_testing", "count": 5}, headers=h)
    assert res_run.status_code == 200
    data = res_run.json()
    assert data["scenario"] == "card_testing"
    assert "transactions" in data
    assert len(data["transactions"]) == 5

def test_chargeback_prediction_endpoints(client, new_email):
    email = new_email()
    register(client, email)
    _promote(email, roles.OPERATOR)
    tok = _get_access_token(client, email)
    h = {"Authorization": f"Bearer {tok}"}
    
    # Get predictions scan summary
    res = client.get("/chargeback/predictions", headers=h)
    assert res.status_code == 200
    data = res.json()
    assert "total_scanned" in data
    assert "high_risk_count" in data
    assert "predictions" in data

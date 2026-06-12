import uuid

from tests.conftest import register


def _auth(client, email):
    return {"Authorization": f"Bearer {register(client, email).json()['access_token']}"}


def test_payment_is_bound_to_authenticated_user(client, new_email):
    """IDOR guard: there is no user_id field; payment belongs to the caller."""
    h = _auth(client, new_email())
    r = client.post("/process-payment",
                    json={"amount": 50, "description": "coffee",
                          "idempotency_key": uuid.uuid4().hex}, headers=h)
    assert r.status_code == 200
    assert r.json()["status"] in ("COMPLETED", "FLAGGED")


def test_idempotency_replay(client, new_email):
    h = _auth(client, new_email())
    key = uuid.uuid4().hex
    body = {"amount": 25, "idempotency_key": key}
    first = client.post("/process-payment", json=body, headers=h).json()
    second = client.post("/process-payment", json=body, headers=h).json()
    assert second["is_duplicate"] is True
    assert first["txn_id"] == second["txn_id"]


def test_idempotency_key_not_reusable_across_users(client, new_email):
    h1 = _auth(client, new_email())
    h2 = _auth(client, new_email())
    key = uuid.uuid4().hex
    client.post("/process-payment", json={"amount": 10, "idempotency_key": key}, headers=h1)
    r = client.post("/process-payment", json={"amount": 10, "idempotency_key": key}, headers=h2)
    assert r.status_code == 409


def test_negative_amount_rejected(client, new_email):
    h = _auth(client, new_email())
    r = client.post("/process-payment",
                    json={"amount": -5, "idempotency_key": uuid.uuid4().hex}, headers=h)
    assert r.status_code == 422


def test_large_anomalous_amount_flagged_or_blocked(client, new_email):
    h = _auth(client, new_email())
    r = client.post("/process-payment",
                    json={"amount": 45000, "idempotency_key": uuid.uuid4().hex}, headers=h)
    assert r.json()["status"] in ("FLAGGED", "BLOCKED")

import uuid

from tests.conftest import register


def test_user_cannot_access_admin(client, new_email):
    tok = register(client, new_email()).json()["access_token"]
    r = client.get("/admin/users", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 403


def test_security_headers_present(client):
    r = client.get("/health")
    h = r.headers
    assert h["X-Content-Type-Options"] == "nosniff"
    assert h["X-Frame-Options"] == "DENY"
    assert "Content-Security-Policy" in h
    assert h["Cache-Control"] == "no-store"


def test_chatbot_offline(client):
    r = client.post("/chat", json={"message": "is safepay secure?"})
    assert r.status_code == 200
    assert "secur" in r.json()["reply"].lower()


def test_chatbot_status_meaning(client):
    r = client.post("/chat", json={"message": "what does flagged mean"})
    assert r.json()["intent"] in ("status_meaning", "fraud")

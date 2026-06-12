from tests.conftest import login, register


def test_register_and_login(client, new_email):
    email = new_email()
    r = register(client, email)
    assert r.status_code == 201
    body = r.json()
    assert body["role"] == "user"
    assert body["access_token"] and body["refresh_token"]


def test_privilege_escalation_blocked(client, new_email):
    """Self-registration must NEVER let a caller become admin."""
    email = new_email()
    r = client.post("/auth/register",
                    json={"email": email, "password": "Str0ng#Pass1", "role": "admin"})
    assert r.status_code == 201
    assert r.json()["role"] == "user"   # 'role' field ignored


def test_weak_password_rejected(client, new_email):
    r = client.post("/auth/register",
                    json={"email": new_email(), "password": "password"})
    assert r.status_code == 422


def test_account_lockout(client, new_email):
    email = new_email()
    register(client, email)
    for _ in range(5):
        login(client, email, "wrongwrong#9")
    # next attempt should be locked even with correct password
    r = login(client, email)
    assert r.status_code == 429


def test_token_required_for_protected_routes(client):
    assert client.get("/transactions").status_code in (401, 403)


def test_refresh_flow(client, new_email):
    email = new_email()
    tokens = register(client, email).json()
    r = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200
    # an access token cannot be used as a refresh token
    bad = client.post("/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert bad.status_code == 401

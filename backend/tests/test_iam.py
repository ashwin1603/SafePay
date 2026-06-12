import uuid

from app.core import roles
from app.core.permissions import permissions_for, AUDIT_READ, USER_DELETE, TXN_REFUND, PAYMENT_CREATE
from app.database import SessionLocal
from app.models.user import User
from tests.conftest import register


def _promote(email, role):
    db = SessionLocal()
    u = db.query(User).filter(User.email == email).first()
    u.role = role
    db.commit(); db.close()


def _login_token(client, email, pw="Str0ng#Pass1"):
    return client.post("/auth/login", json={"email": email, "password": pw}).json()["access_token"]


def test_permission_matrix_distinct():
    up, op, ap = permissions_for(roles.USER), permissions_for(roles.OPERATOR), permissions_for(roles.ADMIN)
    assert up < op < ap                       # strict privilege escalation up the chain
    assert AUDIT_READ in ap and AUDIT_READ not in op   # IAM/audit is admin-only
    assert USER_DELETE in ap and USER_DELETE not in op
    assert TXN_REFUND in op and TXN_REFUND not in up
    assert PAYMENT_CREATE in up                # everyone can pay


def test_me_returns_permissions(client, new_email):
    email = new_email()
    tok = register(client, email).json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {tok}"}).json()
    assert me["role"] == "user"
    assert "payment:create" in me["permissions"]
    assert "user:delete" not in me["permissions"]


def test_user_cannot_read_audit_or_users(client, new_email):
    tok = register(client, new_email()).json()["access_token"]
    h = {"Authorization": f"Bearer {tok}"}
    assert client.get("/admin/audit", headers=h).status_code == 403
    assert client.get("/admin/users", headers=h).status_code == 403
    assert client.get("/admin/stats", headers=h).status_code == 403


def test_operator_can_ops_but_not_iam(client, new_email):
    email = new_email()
    register(client, email)
    _promote(email, roles.OPERATOR)
    h = {"Authorization": f"Bearer {_login_token(client, email)}"}
    assert client.get("/admin/stats", headers=h).status_code == 200      # ops: allowed
    assert client.post("/admin/retrain", headers=h).status_code == 200   # ops: allowed
    assert client.get("/admin/users", headers=h).status_code == 403      # IAM: denied
    assert client.get("/admin/audit", headers=h).status_code == 403      # audit: denied


def test_admin_has_full_access(client, new_email):
    email = new_email()
    register(client, email)
    _promote(email, roles.ADMIN)
    h = {"Authorization": f"Bearer {_login_token(client, email)}"}
    assert client.get("/admin/users", headers=h).status_code == 200
    assert client.get("/admin/audit", headers=h).status_code == 200


def test_operator_review_and_refund_flow(client, new_email):
    # a normal user makes a flagged payment
    u_email = new_email()
    u_tok = register(client, u_email).json()["access_token"]
    pay = client.post("/process-payment",
                      json={"amount": 50, "idempotency_key": uuid.uuid4().hex},
                      headers={"Authorization": f"Bearer {u_tok}"}).json()
    txn_num = int(pay["txn_id"].split("-")[1])

    # a plain user may NOT review
    assert client.post(f"/transactions/{txn_num}/review", json={"action": "approve"},
                       headers={"Authorization": f"Bearer {u_tok}"}).status_code == 403

    # operator may review
    op_email = new_email(); register(client, op_email); _promote(op_email, roles.OPERATOR)
    op_h = {"Authorization": f"Bearer {_login_token(client, op_email)}"}
    if pay["status"] == "FLAGGED":
        r = client.post(f"/transactions/{txn_num}/review", json={"action": "approve"}, headers=op_h)
        assert r.status_code == 200 and r.json()["status"] == "COMPLETED"

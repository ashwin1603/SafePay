import os
import tempfile

os.environ.setdefault("ENVIRONMENT", "development")
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.gettempdir()}/safepay_test.db"
os.environ["RATE_LIMIT_PER_MINUTE"] = "500"   # don't trip limiter during tests

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session", autouse=True)
def _fresh_db():
    path = os.environ["DATABASE_URL"].replace("sqlite:///", "")
    for p in (path, path + "-wal", path + "-shm"):
        if os.path.exists(p):
            os.remove(p)
    from app.database import create_tables
    create_tables()
    yield


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


_n = {"i": 0}


@pytest.fixture
def new_email():
    def _make():
        _n["i"] += 1
        return f"user{_n['i']}@example.com"
    return _make


def register(client, email, password="Str0ng#Pass1"):
    return client.post("/auth/register", json={"email": email, "password": password})


def login(client, email, password="Str0ng#Pass1"):
    return client.post("/auth/login", json={"email": email, "password": password})

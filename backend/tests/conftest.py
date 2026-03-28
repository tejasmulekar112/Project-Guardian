from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(autouse=True)
def mock_firebase_init():
    with patch("app.firebase_init.init_firebase"):
        yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)

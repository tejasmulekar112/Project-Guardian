from fastapi.testclient import TestClient


def test_trigger_sos(client: TestClient) -> None:
    response = client.post(
        "/sos/trigger",
        json={
            "user_id": "test-user-001",
            "location": {
                "latitude": 28.6139,
                "longitude": 77.2090,
                "accuracy_meters": 10.0,
            },
            "trigger_type": "manual",
            "message": "Test SOS event",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "event_id" in data
    assert data["status"] == "dispatched"


def test_trigger_sos_minimal(client: TestClient) -> None:
    response = client.post(
        "/sos/trigger",
        json={
            "user_id": "test-user-002",
            "location": {"latitude": 0.0, "longitude": 0.0},
        },
    )
    assert response.status_code == 200
    assert response.json()["status"] == "dispatched"


def test_trigger_sos_invalid_payload(client: TestClient) -> None:
    response = client.post("/sos/trigger", json={})
    assert response.status_code == 422


def test_health_check(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


MOCK_USER = {"uid": "test-user-001", "email": "test@example.com"}


def test_trigger_sos(client: TestClient) -> None:
    with (
        patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER),
        patch(
            "app.services.firebase_service.FirebaseService.create_sos_event",
            new_callable=AsyncMock,
            return_value="mock-event-id",
        ),
        patch(
            "app.services.location_service.LocationService.get_maps_url",
            new_callable=AsyncMock,
            return_value="https://www.google.com/maps?q=28.6139,77.209",
        ),
    ):
        response = client.post(
            "/sos/trigger",
            headers={"Authorization": "Bearer fake-token"},
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
    with (
        patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER),
        patch(
            "app.services.firebase_service.FirebaseService.create_sos_event",
            new_callable=AsyncMock,
            return_value="mock-event-id",
        ),
        patch(
            "app.services.location_service.LocationService.get_maps_url",
            new_callable=AsyncMock,
            return_value="https://www.google.com/maps?q=0.0,0.0",
        ),
    ):
        response = client.post(
            "/sos/trigger",
            headers={"Authorization": "Bearer fake-token"},
            json={
                "user_id": "test-user-002",
                "location": {"latitude": 0.0, "longitude": 0.0},
            },
        )
    assert response.status_code == 200
    assert response.json()["status"] == "dispatched"


def test_trigger_sos_invalid_payload(client: TestClient) -> None:
    with patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER):
        response = client.post(
            "/sos/trigger",
            headers={"Authorization": "Bearer fake-token"},
            json={},
        )
    assert response.status_code == 422


def test_trigger_sos_no_auth(client: TestClient) -> None:
    response = client.post(
        "/sos/trigger",
        json={
            "user_id": "test-user-001",
            "location": {"latitude": 28.6139, "longitude": 77.2090},
        },
    )
    assert response.status_code == 401

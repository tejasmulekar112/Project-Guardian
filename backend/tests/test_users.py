from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

MOCK_USER = {"uid": "test-user-001", "email": "test@example.com"}


def test_get_profile_empty(client: TestClient) -> None:
    with (
        patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER),
        patch(
            "app.services.firebase_service.FirebaseService.get_user_profile",
            new_callable=AsyncMock,
            return_value=None,
        ),
    ):
        response = client.get(
            "/users/me",
            headers={"Authorization": "Bearer fake-token"},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["uid"] == "test-user-001"
    assert data["emergency_contacts"] == []


def test_update_profile(client: TestClient) -> None:
    with (
        patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER),
        patch(
            "app.services.firebase_service.FirebaseService.upsert_user_profile",
            new_callable=AsyncMock,
        ) as mock_upsert,
    ):
        response = client.put(
            "/users/me",
            headers={"Authorization": "Bearer fake-token"},
            json={"display_name": "Test User", "phone": "+1234567890"},
        )
    assert response.status_code == 200
    mock_upsert.assert_called_once_with("test-user-001", "Test User", "+1234567890")


def test_set_contacts(client: TestClient) -> None:
    with (
        patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER),
        patch(
            "app.services.firebase_service.FirebaseService.set_emergency_contacts",
            new_callable=AsyncMock,
        ) as mock_set,
    ):
        response = client.put(
            "/users/me/contacts",
            headers={"Authorization": "Bearer fake-token"},
            json={
                "contacts": [
                    {"name": "Mom", "phone": "+1111111111", "relationship": "Mother"},
                ]
            },
        )
    assert response.status_code == 200
    mock_set.assert_called_once()


def test_get_contacts(client: TestClient) -> None:
    with (
        patch("app.middleware.auth.auth.verify_id_token", return_value=MOCK_USER),
        patch(
            "app.services.firebase_service.FirebaseService.get_user_contacts",
            new_callable=AsyncMock,
            return_value=[{"name": "Mom", "phone": "+1111111111", "relationship": "Mother"}],
        ),
    ):
        response = client.get(
            "/users/me/contacts",
            headers={"Authorization": "Bearer fake-token"},
        )
    assert response.status_code == 200
    data = response.json()
    assert len(data["contacts"]) == 1
    assert data["contacts"][0]["name"] == "Mom"

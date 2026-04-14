from unittest.mock import MagicMock, patch

import pytest

from app.services.twilio_service import TwilioService
from app.models.sos_event import GeoLocation, SOSTriggerRequest


@pytest.fixture
def sos_payload() -> SOSTriggerRequest:
    return SOSTriggerRequest(
        userId="test-user",
        location=GeoLocation(latitude=28.6139, longitude=77.2090),
        message="Help!",
    )


@pytest.fixture
def contacts() -> list[dict]:
    return [
        {"name": "Mom", "phone": "+1111111111", "relationship": "Mother"},
        {"name": "Dad", "phone": "+2222222222", "relationship": "Father"},
    ]


@pytest.mark.asyncio
async def test_send_sms_to_contacts(sos_payload: SOSTriggerRequest, contacts: list[dict]) -> None:
    mock_client = MagicMock()
    with (
        patch.object(TwilioService, "_client", return_value=mock_client),
        patch("app.services.twilio_service.settings") as mock_settings,
    ):
        mock_settings.twilio_account_sid = "test-sid"
        mock_settings.twilio_auth_token = "test-token"
        mock_settings.twilio_from_phone = "+0000000000"

        sent = await TwilioService.send_emergency_sms(sos_payload, contacts)

    assert sent == 2
    assert mock_client.messages.create.call_count == 2


@pytest.mark.asyncio
async def test_send_sms_skips_missing_phone(sos_payload: SOSTriggerRequest) -> None:
    contacts = [{"name": "No Phone", "relationship": "Friend"}]
    mock_client = MagicMock()
    with (
        patch.object(TwilioService, "_client", return_value=mock_client),
        patch("app.services.twilio_service.settings") as mock_settings,
    ):
        mock_settings.twilio_account_sid = "test-sid"
        mock_settings.twilio_auth_token = "test-token"
        mock_settings.twilio_from_phone = "+0000000000"

        sent = await TwilioService.send_emergency_sms(sos_payload, contacts)

    assert sent == 0
    mock_client.messages.create.assert_not_called()

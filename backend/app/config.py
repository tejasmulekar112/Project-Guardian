from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    debug: bool = False

    # Firebase
    firebase_project_id: str = ""
    firebase_service_account_path: str = "./firebase-service-account.json"

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_phone: str = ""

    # Google Maps
    google_maps_api_key: str = ""

    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    cors_origins: str = "http://localhost:19006"

    model_config = {"env_file": ".env"}


settings = Settings()

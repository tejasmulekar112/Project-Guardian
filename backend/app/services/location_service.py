class LocationService:
    """Stub for Google Maps API integration."""

    @staticmethod
    async def reverse_geocode(latitude: float, longitude: float) -> str:
        """Convert coordinates to a human-readable address."""
        # TODO: Call Google Maps Geocoding API
        # async with httpx.AsyncClient() as client:
        #     response = await client.get(
        #         "https://maps.googleapis.com/maps/api/geocode/json",
        #         params={"latlng": f"{latitude},{longitude}", "key": api_key},
        #     )
        return f"{latitude}, {longitude}"

    @staticmethod
    async def get_maps_url(latitude: float, longitude: float) -> str:
        """Generate a Google Maps URL for the given coordinates."""
        return f"https://www.google.com/maps?q={latitude},{longitude}"

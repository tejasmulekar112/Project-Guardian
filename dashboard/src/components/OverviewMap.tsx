import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { SOSEvent } from '@guardian/shared-schemas';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const activeIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="#DC2626"/>
      <circle cx="12.5" cy="12.5" r="6" fill="white"/>
    </svg>
  `),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const resolvedIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="#6B7280"/>
      <circle cx="12.5" cy="12.5" r="6" fill="white"/>
    </svg>
  `),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface OverviewMapProps {
  events: SOSEvent[];
  userEmails: Map<string, string | undefined>;
}

function isActive(status: string): boolean {
  return status === 'triggered' || status === 'dispatched' || status === 'acknowledged';
}

export function OverviewMap({ events, userEmails }: OverviewMapProps) {
  const eventsWithLocation = events.filter(
    (e) => e.location.latitude !== 0 || e.location.longitude !== 0,
  );

  if (eventsWithLocation.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-3">Live Map</h2>
        <p className="text-gray-400 text-sm">No events with location data.</p>
      </div>
    );
  }

  // Center on the most recent active event, or first event
  const activeEvents = eventsWithLocation.filter((e) => isActive(e.status));
  const centerEvent = activeEvents[0] ?? eventsWithLocation[0];

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Live Map</h2>
        {activeEvents.length > 0 && (
          <span className="text-xs font-medium text-red-400 bg-red-900/30 px-2 py-1 rounded-full">
            {activeEvents.length} active
          </span>
        )}
      </div>
      <div className="h-80 w-full rounded-lg overflow-hidden">
        <MapContainer
          center={[centerEvent.location.latitude, centerEvent.location.longitude]}
          zoom={activeEvents.length === 1 ? 14 : 4}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {eventsWithLocation.map((event) => (
            <Marker
              key={event.id}
              position={[event.location.latitude, event.location.longitude]}
              icon={isActive(event.status) ? activeIcon : resolvedIcon}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{userEmails.get(event.userId) ?? event.userId}</p>
                  <p className="text-gray-600">
                    {event.triggerType} — {event.status}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {new Date(event.createdAt).toLocaleString()}
                  </p>
                  <a
                    href={`/events/${event.id}`}
                    className="text-blue-600 text-xs hover:underline"
                  >
                    View details
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

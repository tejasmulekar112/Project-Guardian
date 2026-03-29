import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GeoLocation } from '@guardian/shared-schemas';

type AppStackParamList = {
  Home: undefined;
  Status: undefined;
  Contacts: undefined;
  Tracking: { initialLocation: GeoLocation; eventId: string };
};

type TrackingScreenProps = NativeStackScreenProps<AppStackParamList, 'Tracking'>;

export const TrackingScreen: React.FC<TrackingScreenProps> = ({ route }) => {
  const { initialLocation, eventId } = route.params;
  const [currentLocation, setCurrentLocation] = useState<GeoLocation>(initialLocation);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const startTracking = async (): Promise<void> => {
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (position) => {
          const updated: GeoLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy ?? undefined,
          };
          setCurrentLocation(updated);

          mapRef.current?.animateToRegion({
            latitude: updated.latitude,
            longitude: updated.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        },
      );
    };

    void startTracking();

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
      >
        <Marker
          coordinate={{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          }}
          title="Your Location"
          pinColor="#DC2626"
        />
      </MapView>
      <View style={styles.overlay}>
        <Text style={styles.eventId}>Event: {eventId}</Text>
        <Text style={styles.coords}>
          {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    borderRadius: 12,
    padding: 16,
  },
  eventId: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  coords: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
});

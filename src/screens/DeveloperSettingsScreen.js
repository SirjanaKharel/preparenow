import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { setDeveloperMode, getDeveloperMode, locationService } from '../services/locationService';
import { useApp } from '../context/AppContext';

export default function DeveloperSettingsScreen({ navigation }) {
  const { setCurrentLocation } = useApp();
  const [devMode, setDevMode] = useState(false);
  const [testLat, setTestLat] = useState('52.9225');
  const [testLon, setTestLon] = useState('-1.4746');
  const [checking, setChecking] = useState(false);

  // Restore state if dev mode was already active
  useEffect(() => {
    const current = getDeveloperMode();
    if (current.enabled && current.location) {
      setDevMode(true);
      setTestLat(current.location.latitude.toString());
      setTestLon(current.location.longitude.toString());
    }
  }, []);

  const applyLocation = async (lat, lon) => {
    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      Alert.alert('Invalid Coordinates', 'Please enter valid numbers for latitude and longitude.');
      return false;
    }
    if (parsedLat < -90 || parsedLat > 90) {
      Alert.alert('Invalid Latitude', 'Latitude must be between -90 and 90.');
      return false;
    }
    if (parsedLon < -180 || parsedLon > 180) {
      Alert.alert('Invalid Longitude', 'Longitude must be between -180 and 180.');
      return false;
    }

    setChecking(true);

    // This now triggers immediate zone check + notifies HomeScreen
    await setDeveloperMode(true, { latitude: parsedLat, longitude: parsedLon });

    setChecking(false);
    return true;
  };

  const handleToggle = async () => {
    const enabling = !devMode;
    if (enabling) {
      const ok = await applyLocation(testLat, testLon);
      if (ok) setDevMode(true);
    } else {
      setDevMode(false);
      await setDeveloperMode(false);
      // Automatically set user's real location when dev mode is turned off
      try {
        const result = await locationService.getCurrentLocation();
        if (result.success && result.location && result.location.coords) {
          setCurrentLocation(result.location.coords);
        }
      } catch (e) {
        console.warn('Failed to get real location after disabling dev mode:', e);
      }
      Alert.alert('Developer Mode Off', 'Using real GPS location.');
    }
  };

  const handleUpdateLocation = async () => {
    await applyLocation(testLat, testLon);
  };

  const handleUseNearestZone = async () => {
    setChecking(true);
    try {
      const allZones = locationService.getAllZones();
      if (allZones.length === 0) {
        Alert.alert('No Zones', 'No disaster zones in Firebase. Run the GDACS sync script first.');
        setChecking(false);
        return;
      }

      // Sort by distance from current test location
      const lat = parseFloat(testLat) || 0;
      const lon = parseFloat(testLon) || 0;

      const sorted = allZones
        .map(z => ({
          ...z,
          dist: locationService.calculateDistance(lat, lon, z.latitude, z.longitude),
        }))
        .sort((a, b) => a.dist - b.dist);

      const nearest = sorted[0];

      Alert.alert(
        '📍 Nearest Zone',
        `${nearest.title || nearest.id}\nType: ${nearest.disasterType} (${nearest.severity})\nDistance: ${(nearest.dist / 1000).toFixed(1)}km away\n\nLat: ${nearest.latitude}\nLon: ${nearest.longitude}\n\nUse these coordinates?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Use These Coords',
            onPress: async () => {
              const newLat = nearest.latitude.toString();
              const newLon = nearest.longitude.toString();
              setTestLat(newLat);
              setTestLon(newLon);
              setDevMode(true);
              await applyLocation(newLat, newLon);
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setChecking(false);
  };

  // Cleaned up Developer Settings page: only essential controls, clear layout, and concise quick test zones
  const TEST_ZONES = [
    { name: 'Lewotobi (Indonesia, Fire)', lat: -8.542, lon: 122.775 },
    { name: 'Fuego (Guatemala, Fire)', lat: 14.473, lon: -90.88 },
    { name: 'Kanlaon (Philippines, Fire)', lat: 10.412, lon: 123.132 },
    { name: 'JUDE-25 (Mozambique/Madagascar, Storm)', lat: -26.04, lon: 51.93 },
    { name: 'ERICK-25 (Mexico, Storm)', lat: 18, lon: -100.8 },
    { name: 'South America-2023 (Brazil, Flood)', lat: -6.88, lon: -50.349 },
    { name: 'WF Event (Greece, Fire)', lat: 35.037926159239646, lon: 25.86402035475441 },
    { name: 'WF Event (Albania, Fire)', lat: 40.249995058168885, lon: 19.58966211499156 },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Developer Settings</Text>
        </View>
      </View>

      {/* Toggle */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowLabel}>Test Location Mode</Text>
            <Text style={styles.rowSubLabel}>Simulate a GPS position</Text>
          </View>
          <Switch value={devMode} onValueChange={handleToggle} />
        </View>
      </View>

      {/* Coordinates Input */}
      {devMode && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Test Coordinates</Text>
          <Text style={styles.inputLabel}>Latitude</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 18.2"
            value={testLat}
            onChangeText={setTestLat}
            keyboardType="numeric"
          />
          <Text style={styles.inputLabel}>Longitude</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 106.2"
            value={testLon}
            onChangeText={setTestLon}
            keyboardType="numeric"
          />
          <Text style={styles.inputLabel}>Quick Test Zones</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
            {TEST_ZONES.map(zone => (
              <TouchableOpacity
                key={zone.name}
                style={{ backgroundColor: '#eee', padding: 8, borderRadius: 8, margin: 4 }}
                onPress={() => {
                  setTestLat(zone.lat.toString());
                  setTestLon(zone.lon.toString());
                  handleUpdateLocation();
                }}
              >
                <Text style={{ color: '#333', fontWeight: '600' }}>{zone.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleUpdateLocation}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Apply Location</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      // ...existing code...
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  backButton: {
    marginRight: 10,
    padding: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginRight: 34, // offset for back button width
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  primaryButton: {
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 15,
    fontWeight: '600',
  },
  coordsText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 12,
    fontFamily: 'monospace',
  },
  insideAlert: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  insideAlertText: {
    color: '#991B1B',
    fontWeight: '700',
    fontSize: 15,
  },
  safeAlert: {
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
  },
  safeAlertText: {
    color: '#15803D',
    fontWeight: '600',
    fontSize: 14,
  },
  zoneItem: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
    marginTop: 10,
  },
  zoneTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  zoneMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  jumpLink: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 6,
    fontWeight: '600',
  },
  hintText: {
    fontSize: 12,
    color: '#16A34A',
    marginTop: 12,
    fontStyle: 'italic',
  },
  instrText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
  },
});
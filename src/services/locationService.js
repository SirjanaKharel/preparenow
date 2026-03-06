import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { DISASTER_TYPES, SEVERITY_LEVELS } from '../constants/disasters';

const LOCATION_TASK_NAME   = 'background-location-task';
const GEOFENCING_TASK_NAME = 'geofencing-task';
const NOTIFICATION_COOLDOWN = 10 * 60 * 1000; // 10 minutes

// Track if app has just started to prevent exit notifications on initial load
let isInitialAppLoad = true;

// Store disaster zones dynamically from Firebase
let DISASTER_ZONES = [];
let zonesListener  = null;

// Developer mode for testing
let DEVELOPER_MODE = false;
let TEST_LOCATION  = null;

// Last checked location — only blocks the automatic 10s poll from re-running.
// The manual apply path uses force:true and never consults this.
let lastCheckedLocation = null;

// ─── Location change listeners ────────────────────────────────────────────────
let locationChangeListeners = [];

export const subscribeToLocationChanges = (callback) => {
  locationChangeListeners.push(callback);
  return () => {
    locationChangeListeners = locationChangeListeners.filter(cb => cb !== callback);
  };
};

const notifyLocationListeners = (coords) => {
  locationChangeListeners.forEach(cb => {
    try { cb(coords); } catch (e) { console.error('Location listener error:', e); }
  });
};

// ─── Event change listeners ───────────────────────────────────────────────────
// AlertsScreen subscribes here so it updates immediately when a new event
// is stored — no need to wait for the 10s poll.
let eventChangeListeners = [];

export const subscribeToEventChanges = (callback) => {
  eventChangeListeners.push(callback);
  return () => {
    eventChangeListeners = eventChangeListeners.filter(cb => cb !== callback);
  };
};

const notifyEventListeners = () => {
  eventChangeListeners.forEach(cb => {
    try { cb(); } catch (e) { console.error('Event listener error:', e); }
  });
};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const severity = notification.request.content.data?.severity || 'info';
    return {
      shouldShowAlert: true,
      shouldPlaySound: severity === 'critical' || severity === 'high',
      shouldSetBadge:  true,
      priority: severity === 'critical' ? 'high' : 'default',
    };
  },
});

// Subscribe to real-time disaster zones from Firebase
export const subscribeToDisasterZones = (callback) => {
  try {
    const zonesRef = collection(db, 'disaster_zones');
    const q = query(zonesRef, where('isActive', '==', true));

    zonesListener = onSnapshot(q, (snapshot) => {
      DISASTER_ZONES = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`✅ Loaded ${DISASTER_ZONES.length} active disaster zones from Firebase`);
      if (callback) callback(DISASTER_ZONES);
    }, (error) => {
      console.error('❌ Error subscribing to disaster zones:', error);
      DISASTER_ZONES = [];
      if (callback) callback(DISASTER_ZONES);
    });

    return zonesListener;
  } catch (error) {
    console.error('❌ Error setting up Firebase listener:', error);
    DISASTER_ZONES = [];
    if (callback) callback(DISASTER_ZONES);
    return null;
  }
};

export const unsubscribeFromDisasterZones = () => {
  if (zonesListener) {
    zonesListener();
    zonesListener = null;
    console.log('📡 Unsubscribed from disaster zones');
  }
};

const loadDisasterZonesOnce = async () => {
  try {
    const zonesRef = collection(db, 'disaster_zones');
    const q = query(zonesRef, where('isActive', '==', true));
    const snapshot = await getDocs(q);
    DISASTER_ZONES = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`✅ Loaded ${DISASTER_ZONES.length} disaster zones from Firebase`);
    if (DISASTER_ZONES.length === 0) {
      console.warn('⚠️ No disaster zones found. Run the GDACS sync script.');
    }
  } catch (error) {
    console.error('❌ Error loading disaster zones:', error);
    DISASTER_ZONES = [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DEVELOPER MODE
// Always passes force:true to manualCheckZones so the location-unchanged guard
// is bypassed regardless of what lastCheckedLocation holds.
// ─────────────────────────────────────────────────────────────────────────────
export const setDeveloperMode = async (enabled, testLocation = null) => {
  DEVELOPER_MODE = enabled;
  TEST_LOCATION  = testLocation;
  console.log('🛠️ Developer mode:', enabled ? 'ENABLED' : 'DISABLED', testLocation);

  if (!enabled) {
    lastCheckedLocation = null;
    return;
  }

  if (testLocation) {
    notifyLocationListeners(testLocation);
    try {
      // force:true — always run zone checks, never skip due to location guard
      await locationService.manualCheckZones({ force: true });
    } catch (e) {
      console.warn('⚠️ Zone check after dev mode update failed:', e.message);
    }
  }
};

export const getDeveloperMode = () => ({ enabled: DEVELOPER_MODE, location: TEST_LOCATION });

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL EXIT DETECTION (dev mode)
// ─────────────────────────────────────────────────────────────────────────────
const manualCheckExits = async (currentCoords) => {
  try {
    const eventsJson = await AsyncStorage.getItem('disaster_events');
    const events = eventsJson ? JSON.parse(eventsJson) : [];

    // Build zone → most recent event type (oldest→newest so last write wins)
    const zoneStatuses = {};
    [...events].reverse().forEach(e => {
      if (e.zone && !zoneStatuses[e.zone]) zoneStatuses[e.zone] = e.type;
    });

    const activeZoneIds = Object.entries(zoneStatuses)
      .filter(([, type]) => type === 'enter')
      .map(([id]) => id);

    console.log(`🔍 Dev exit check — ${activeZoneIds.length} active zone(s):`, activeZoneIds);

    for (const zoneId of activeZoneIds) {
      const zone = DISASTER_ZONES.find(z => z.id === zoneId);
      if (!zone) {
        console.warn(`⚠️ Zone ${zoneId} in history but not in DISASTER_ZONES`);
        continue;
      }

      const dist = locationService.calculateDistance(
        currentCoords.latitude,
        currentCoords.longitude,
        zone.latitude,
        zone.longitude
      );

      if (dist > zone.radius) {
        console.log(`✅ Dev mode exit detected: ${zone.id} (dist: ${Math.round(dist)}m, radius: ${zone.radius}m)`);
        await handleZoneExit({ identifier: zone.id });
      } else {
        console.log(`📍 Still inside: ${zone.id} (dist: ${Math.round(dist)}m)`);
      }
    }
  } catch (error) {
    console.error('❌ manualCheckExits error:', error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STORE EVENT
// Notifies event listeners immediately so AlertsScreen updates without waiting.
// ─────────────────────────────────────────────────────────────────────────────
const storeEvent = async (event) => {
  try {
    const eventsJson = await AsyncStorage.getItem('disaster_events');
    const events = eventsJson ? JSON.parse(eventsJson) : [];

    // Only apply cooldown to enter events — exits are always stored
    if (event.type === 'enter') {
      const isDuplicate = events.some(e =>
        e.zone === event.zone &&
        e.type === 'enter' &&
        (Date.now() - new Date(e.timestamp).getTime()) < NOTIFICATION_COOLDOWN
      );
      if (isDuplicate) {
        console.log(`⏭️ Skipping duplicate enter for ${event.zone} — within cooldown`);
        return false;
      }
    }

    events.unshift(event);
    await AsyncStorage.setItem('disaster_events', JSON.stringify(events.slice(0, 100)));
    console.log(`✅ Event stored: ${event.type} → ${event.zone}`);

    // Notify AlertsScreen and any other subscribers immediately
    notifyEventListeners();

    return true;
  } catch (error) {
    console.error('❌ Error storing event:', error);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION COOLDOWN CHECK
// Exits use entry/exit pairing — no time-based cooldown for exits.
// ─────────────────────────────────────────────────────────────────────────────
const shouldSendNotification = async (zoneId, eventType) => {
  try {
    const eventsJson = await AsyncStorage.getItem('disaster_events');
    const events = eventsJson ? JSON.parse(eventsJson) : [];

    if (eventType === 'exit') {
      const lastEntry = events.find(e => e.zone === zoneId && e.type === 'enter');
      if (!lastEntry) {
        console.log(`⏭️ Skipping exit for ${zoneId} — no entry recorded`);
        return false;
      }
      const alreadyExited = events.some(e =>
        e.zone === zoneId &&
        e.type === 'exit' &&
        new Date(e.timestamp) > new Date(lastEntry.timestamp)
      );
      if (alreadyExited) {
        console.log(`⏭️ Already have exit for ${zoneId} after last entry`);
        return false;
      }
      return true;
    }

    // Enter events — apply cooldown
    const recentEnter = events.find(e => e.zone === zoneId && e.type === 'enter');
    if (!recentEnter) return true;

    const elapsed = Date.now() - new Date(recentEnter.timestamp).getTime();
    if (elapsed < NOTIFICATION_COOLDOWN) {
      console.log(`⏭️ Cooldown active for ${zoneId} — ${Math.round(elapsed / 1000)}s elapsed`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error checking cooldown:', error);
    return true;
  }
};

// Geofencing background task
TaskManager.defineTask(GEOFENCING_TASK_NAME, async ({ data, error }) => {
  if (error) { console.error('❌ Geofencing task error:', error); return; }

  if (data.eventType === Location.GeofencingEventType.Enter) {
    const shouldNotify = await shouldSendNotification(data.region.identifier, 'enter');
    if (shouldNotify) await handleZoneEntry(data.region);

  } else if (data.eventType === Location.GeofencingEventType.Exit) {
    if (isInitialAppLoad) {
      console.log('⏭️ Skipping exit on initial load:', data.region.identifier);
      return;
    }
    const shouldNotify = await shouldSendNotification(data.region.identifier, 'exit');
    if (shouldNotify) await handleZoneExit(data.region);
  }
});

// Handle zone entry
const handleZoneEntry = async (region) => {
  const zone = DISASTER_ZONES.find(z => z.id === region.identifier);
  if (!zone) { console.warn('⚠️ Zone not found:', region.identifier); return; }

  console.log('🚨 Entered zone:', zone.id, zone.title);

  const stored = await storeEvent({
    type:         'enter',
    zone:         zone.id,
    title:        zone.title,
    description:  zone.description,
    timestamp:    new Date().toISOString(),
    severity:     zone.severity,
    disasterType: zone.disasterType,
  });

  if (stored) await sendDisasterAlert(zone, 'enter');
};

// Handle zone exit
const handleZoneExit = async (region) => {
  const zone = DISASTER_ZONES.find(z => z.id === region.identifier);
  if (!zone) { console.warn('⚠️ Zone not found:', region.identifier); return; }

  console.log('✅ Exited zone:', zone.id, zone.title);

  const shouldNotify = await shouldSendNotification(zone.id, 'exit');
  if (!shouldNotify) return;

  const stored = await storeEvent({
    type:         'exit',
    zone:         zone.id,
    title:        zone.title,
    description:  zone.description,
    timestamp:    new Date().toISOString(),
    severity:     zone.severity,
    disasterType: zone.disasterType,
  });

  if (stored) await sendDisasterAlert(zone, 'exit');
};

// Send push notification
const sendDisasterAlert = async (zone, eventType) => {
  try {
    const messages = getAlertMessage(zone, eventType);
    console.log('📢 Sending notification:', messages.title);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: messages.title,
        body:  messages.body,
        data: {
          zoneId:       zone.id,
          severity:     zone.severity,
          disasterType: zone.disasterType,
          eventType,
          source: zone.source || 'gdacs',
        },
        sound:    zone.severity === 'critical' || zone.severity === 'high',
        priority: zone.severity === 'critical' ? 'high' : 'default',
      },
      trigger: null,
    });

    console.log('✅ Notification sent');
    if (eventType === 'enter') await saveAlertToFirestore(zone);
  } catch (error) {
    console.error('❌ Error sending alert:', error);
  }
};

const saveAlertToFirestore = async (zone) => {
  try {
    await addDoc(collection(db, 'alerts'), {
      title:        zone.title,
      description:  zone.description,
      severity:     zone.severity,
      disasterType: zone.disasterType,
      zoneId:       zone.id,
      timestamp:    Timestamp.now(),
      latitude:     zone.latitude,
      longitude:    zone.longitude,
      radius:       zone.radius,
      source:       zone.source || 'gdacs',
    });
    console.log('✅ Alert saved to Firestore');
  } catch (error) {
    console.warn('⚠️ Error saving to Firestore:', error);
  }
};

const getAlertMessage = (zone, eventType) => {
  const isEntry  = eventType === 'enter';
  const severity = zone.severity?.toUpperCase() || 'ALERT';

  const enterMessages = {
    flood: {
      critical: { title: '🚨 CRITICAL FLOOD ALERT', body: `You have entered a CRITICAL flood zone: ${zone.title || zone.description}. Seek higher ground immediately. Call 999 if in danger.` },
      high:     { title: '⚠️ HIGH FLOOD ALERT',     body: `You are in a high-risk flood area: ${zone.title || zone.description}. Move to higher ground and avoid water.` },
      warning:  { title: '⚠️ Flood Warning',         body: `You have entered a flood warning area: ${zone.title || zone.description}. Stay alert and avoid low-lying areas.` },
      info:     { title: 'ℹ️ Flood Information',      body: `You are in an area with potential flood risk: ${zone.title || zone.description}. Monitor conditions.` },
    },
    fire: {
      critical: { title: '🚨 CRITICAL FIRE ALERT', body: `IMMEDIATE DANGER: ${zone.title || zone.description}. Evacuate immediately. Call 999.` },
      high:     { title: '🔥 HIGH FIRE ALERT',     body: `You are near an active fire: ${zone.title || zone.description}. Follow evacuation orders.` },
      warning:  { title: '🔥 Fire Warning',         body: `Fire risk in this area: ${zone.title || zone.description}. Be ready to evacuate.` },
      info:     { title: 'ℹ️ Fire Information',      body: `Elevated fire risk: ${zone.title || zone.description}. Avoid ignition sources.` },
    },
    storm: {
      critical: { title: '🚨 SEVERE STORM WARNING', body: `Dangerous storm conditions: ${zone.title || zone.description}. Seek shelter immediately.` },
      high:     { title: '⛈️ HIGH STORM ALERT',     body: `Severe storm approaching: ${zone.title || zone.description}. Take shelter.` },
      warning:  { title: '⛈️ Storm Warning',         body: `Storm warning active: ${zone.title || zone.description}. Stay indoors.` },
      info:     { title: 'ℹ️ Storm Information',      body: `Stormy weather expected: ${zone.title || zone.description}. Stay alert.` },
    },
    evacuation: {
      critical: { title: '🚨 MANDATORY EVACUATION', body: `You are in a mandatory evacuation zone: ${zone.title || zone.description}. Leave immediately.` },
      high:     { title: '⚠️ EVACUATION ALERT',      body: `Evacuation recommended: ${zone.title || zone.description}. Prepare to leave.` },
      warning:  { title: '⚠️ Evacuation Warning',    body: `Be prepared to evacuate: ${zone.title || zone.description}. Monitor official channels.` },
      info:     { title: 'ℹ️ Evacuation Information', body: `Potential evacuation area: ${zone.title || zone.description}. Stay informed.` },
    },
    earthquake: {
      critical: { title: '🚨 CRITICAL EARTHQUAKE ALERT', body: `Major earthquake detected: ${zone.title || zone.description}. Drop, Cover, Hold On.` },
      high:     { title: '⚠️ EARTHQUAKE ALERT',           body: `Earthquake activity: ${zone.title || zone.description}. Stay away from buildings.` },
      warning:  { title: '⚠️ Earthquake Warning',         body: `Seismic activity in area: ${zone.title || zone.description}. Prepare for aftershocks.` },
      info:     { title: 'ℹ️ Earthquake Information',      body: `Earthquake zone: ${zone.title || zone.description}. Stay alert.` },
    },
  };

  const exitMessages = {
    flood:      { title: '✓ Left Flood Zone',      body: `You have exited the flood zone: ${zone.title || zone.description}. Stay alert.` },
    fire:       { title: '✓ Left Fire Zone',       body: `You have exited the fire risk area: ${zone.title || zone.description}.` },
    storm:      { title: '✓ Left Storm Zone',      body: `You have exited the storm warning area: ${zone.title || zone.description}.` },
    evacuation: { title: '✓ Left Evacuation Zone', body: `You have exited the evacuation zone: ${zone.title || zone.description}.` },
    earthquake: { title: '✓ Left Earthquake Zone', body: `You have exited the earthquake zone: ${zone.title || zone.description}.` },
  };

  if (isEntry) {
    return enterMessages[zone.disasterType]?.[zone.severity] || {
      title: `${severity} ALERT`,
      body:  `You have entered a ${zone.severity} ${zone.disasterType} zone: ${zone.title || zone.description}`,
    };
  } else {
    return exitMessages[zone.disasterType] || {
      title: '✓ Zone Exited',
      body:  `You have left the ${zone.disasterType} zone: ${zone.title || zone.description}`,
    };
  }
};

export const locationService = {
  requestPermissions: async () => {
    try {
      const { status: fg } = await Location.requestForegroundPermissionsAsync();
      if (fg !== 'granted') return { success: false, error: 'Location permission denied.' };

      const { status: bg } = await Location.requestBackgroundPermissionsAsync();
      if (bg !== 'granted') return { success: false, error: 'Background location permission denied.' };

      const { status: notif } = await Notifications.requestPermissionsAsync();
      if (notif !== 'granted') return { success: false, error: 'Notification permission denied.' };

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  getCurrentLocation: async () => {
    if (DEVELOPER_MODE && TEST_LOCATION) {
      return { success: true, location: { coords: TEST_LOCATION } };
    }
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000 });
      return { success: true, location: loc };
    } catch { /* fall through */ }
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
      return { success: true, location: loc };
    } catch { /* fall through */ }
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last) return { success: true, location: last };
    } catch { /* fall through */ }
    return { success: false, isSimulatorError: true, error: 'Could not get location.' };
  },

  startMonitoring: async () => {
    try {
      const already = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK_NAME);
      if (already) {
        console.log('✅ Geofencing already registered — skipping restart');
        return { success: true };
      }

      if (DISASTER_ZONES.length === 0) await loadDisasterZonesOnce();
      if (DISASTER_ZONES.length === 0) return { success: false, error: 'No disaster zones available.' };

      const regions = DISASTER_ZONES.map(zone => ({
        identifier:    zone.id,
        latitude:      zone.latitude,
        longitude:     zone.longitude,
        radius:        zone.radius,
        notifyOnEnter: true,
        notifyOnExit:  true,
      }));

      await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, regions);
      console.log(`✅ Geofencing started with ${regions.length} zones`);

      const loc = await locationService.getCurrentLocation();
      if (loc.success) await checkInitialZones(loc.location.coords);

      return { success: true };
    } catch (error) {
      console.error('❌ startMonitoring error:', error);
      return { success: false, error: error.message };
    }
  },

  restartGeofencing: async () => {
    try {
      const registered = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK_NAME);
      if (registered) await Location.stopGeofencingAsync(GEOFENCING_TASK_NAME);
      if (DISASTER_ZONES.length === 0) return { success: false, error: 'No zones available' };

      const regions = DISASTER_ZONES.map(zone => ({
        identifier:    zone.id,
        latitude:      zone.latitude,
        longitude:     zone.longitude,
        radius:        zone.radius,
        notifyOnEnter: true,
        notifyOnExit:  true,
      }));

      await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, regions);
      console.log(`✅ Geofencing restarted with ${regions.length} zones`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  stopMonitoring: async () => {
    try {
      const registered = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK_NAME);
      if (registered) await Location.stopGeofencingAsync(GEOFENCING_TASK_NAME);
      unsubscribeFromDisasterZones();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  getEventHistory: async () => {
    try {
      const json = await AsyncStorage.getItem('disaster_events');
      const events = json ? JSON.parse(json) : [];
      return { success: true, events };
    } catch (error) {
      return { success: false, error: error.message, events: [] };
    }
  },

  getCriticalEvents: async () => {
    try {
      const json = await AsyncStorage.getItem('disaster_events');
      const events = json ? JSON.parse(json) : [];
      return {
        success: true,
        events: events.filter(e => e.type === 'enter' && (e.severity === 'high' || e.severity === 'critical')),
      };
    } catch (error) {
      return { success: false, error: error.message, events: [] };
    }
  },

  clearEventHistory: async () => {
    try {
      await AsyncStorage.removeItem('disaster_events');
      notifyEventListeners();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  calculateDistance: (lat1, lon1, lat2, lon2) => {
    const R  = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a  = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  isInZone: (userLat, userLon, zone) => {
    return locationService.calculateDistance(userLat, userLon, zone.latitude, zone.longitude) <= zone.radius;
  },

  getNearbyZones: async (userLocation) => {
    return DISASTER_ZONES.map(zone => {
      const distance = locationService.calculateDistance(
        userLocation.latitude, userLocation.longitude, zone.latitude, zone.longitude
      );
      return { ...zone, distance: Math.round(distance), isInside: distance <= zone.radius };
    }).sort((a, b) => a.distance - b.distance);
  },

  getActiveZones: async () => {
    try {
      const loc = await locationService.getCurrentLocation();
      if (!loc.success) return { success: false, error: loc.error, zones: [] };
      const { latitude, longitude } = loc.location.coords;
      const active = DISASTER_ZONES
        .filter(zone => locationService.calculateDistance(latitude, longitude, zone.latitude, zone.longitude) <= zone.radius)
        .map(zone => ({
          ...zone,
          distance: Math.round(locationService.calculateDistance(latitude, longitude, zone.latitude, zone.longitude)),
        }));
      return { success: true, zones: active };
    } catch (error) {
      return { success: false, error: error.message, zones: [] };
    }
  },

  getLiveAlerts: async () => {
    try {
      const ago24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const snap = await getDocs(query(collection(db, 'alerts'), where('timestamp', '>=', Timestamp.fromDate(ago24h))));
      return {
        success: true,
        alerts: snap.docs.map(doc => ({
          id: doc.id, ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp),
        })),
      };
    } catch (error) {
      return { success: false, error: error.message, alerts: [] };
    }
  },

  getCriticalAlerts: async () => {
    try {
      const ago24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const snap = await getDocs(query(
        collection(db, 'alerts'),
        where('severity',  '==', 'critical'),
        where('timestamp', '>=', Timestamp.fromDate(ago24h))
      ));
      return {
        success: true,
        alerts: snap.docs.map(doc => ({
          id: doc.id, ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp),
        })),
      };
    } catch (error) {
      return { success: false, error: error.message, alerts: [] };
    }
  },

  // ── manualCheckZones ───────────────────────────────────────────────────────
  // Accepts an optional { force } option.
  // force:true  → always run (used by setDeveloperMode / manual apply)
  // force:false → skip if location hasn't changed (used by 10s poll)
  manualCheckZones: async ({ force = false } = {}) => {
    try {
      const loc = await locationService.getCurrentLocation();
      if (!loc.success) return { success: false, error: loc.error, zonesTriggered: [] };

      const { latitude, longitude } = loc.location.coords;

      // Only apply the location-unchanged guard when NOT forced
      if (!force && DEVELOPER_MODE) {
        const unchanged =
          lastCheckedLocation &&
          lastCheckedLocation.latitude  === latitude &&
          lastCheckedLocation.longitude === longitude;
        if (unchanged) {
          console.log('📍 Dev mode — location unchanged, skipping zone check');
          return { success: true, zonesTriggered: [] };
        }
      }

      // Update last checked location for future poll comparisons
      lastCheckedLocation = { latitude, longitude };

      const triggered = [];

      for (const zone of DISASTER_ZONES) {
        const dist = locationService.calculateDistance(latitude, longitude, zone.latitude, zone.longitude);
        if (dist <= zone.radius) {
          const shouldNotify = await shouldSendNotification(zone.id, 'enter');
          if (shouldNotify) {
            await handleZoneEntry({ identifier: zone.id });
            triggered.push(zone.id);
          }
        }
      }

      await manualCheckExits({ latitude, longitude });

      return { success: true, zonesTriggered: triggered };
    } catch (error) {
      return { success: false, error: error.message, zonesTriggered: [] };
    }
  },

  getAllZones:  () => DISASTER_ZONES,
  getZoneCount: () => DISASTER_ZONES.length,
};

// Silently record zones on startup — no notifications, just sets the cooldown
const checkInitialZones = async (coords) => {
  const { latitude, longitude } = coords;
  console.log('🔍 Checking initial zones (silent):', latitude, longitude);
  let found = 0;

  for (const zone of DISASTER_ZONES) {
    const dist = locationService.calculateDistance(latitude, longitude, zone.latitude, zone.longitude);
    if (dist <= zone.radius) {
      found++;
      console.log(`📍 Already inside on startup (silent): ${zone.id}`);
      await storeEvent({
        type:         'enter',
        zone:         zone.id,
        title:        zone.title,
        description:  zone.description,
        timestamp:    new Date().toISOString(),
        severity:     zone.severity,
        disasterType: zone.disasterType,
      });
    }
  }

  console.log(found === 0
    ? '✅ Not in any zones on startup'
    : `📍 Recorded ${found} startup zones silently`
  );

  setTimeout(() => {
    isInitialAppLoad = false;
    console.log('✅ Initial load complete — exit notifications enabled');
  }, 5000);
};
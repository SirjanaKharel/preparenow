import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { DISASTER_TYPES, SEVERITY_LEVELS } from '../constants/disasters';

const LOCATION_TASK_NAME = 'background-location-task';
const GEOFENCING_TASK_NAME = 'geofencing-task';
const NOTIFICATION_COOLDOWN = 10 * 60 * 1000; // 10 minutes in milliseconds

// Track if app has just started to prevent exit notifications on initial load
let isInitialAppLoad = true;

// Store disaster zones dynamically from Firebase
let DISASTER_ZONES = [];
let zonesListener = null;

// Developer mode for testing
let DEVELOPER_MODE = false;
let TEST_LOCATION = null;

// Location change listeners
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

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const severity = notification.request.content.data?.severity || 'info';
    return {
      shouldShowAlert: true,
      shouldPlaySound: severity === 'critical' || severity === 'high',
      shouldSetBadge: true,
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
      DISASTER_ZONES = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log(`✅ Loaded ${DISASTER_ZONES.length} active disaster zones from Firebase (GDACS)`);
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

// Unsubscribe from disaster zones
export const unsubscribeFromDisasterZones = () => {
  if (zonesListener) {
    zonesListener();
    zonesListener = null;
    console.log('📡 Unsubscribed from disaster zones');
  }
};

// Load disaster zones once without subscription
const loadDisasterZonesOnce = async () => {
  try {
    const zonesRef = collection(db, 'disaster_zones');
    const q = query(zonesRef, where('isActive', '==', true));
    const snapshot = await getDocs(q);

    DISASTER_ZONES = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`✅ Loaded ${DISASTER_ZONES.length} disaster zones from Firebase (GDACS)`);

    if (DISASTER_ZONES.length === 0) {
      console.warn('⚠️ No disaster zones found in Firebase. Run the GDACS sync script to populate zones.');
    }
  } catch (error) {
    console.error('❌ Error loading disaster zones from Firebase:', error);
    DISASTER_ZONES = [];
  }
};

// Developer mode functions
export const setDeveloperMode = async (enabled, testLocation = null) => {
  DEVELOPER_MODE = enabled;
  TEST_LOCATION = testLocation;
  console.log('🛠️ Developer mode:', enabled ? 'ENABLED' : 'DISABLED', testLocation);

  if (enabled && testLocation) {
    console.log('🔄 Test location updated — triggering immediate zone check...');
    notifyLocationListeners(testLocation);
    try {
      await locationService.manualCheckZones();
    } catch (e) {
      console.warn('⚠️ Zone check after dev mode update failed:', e.message);
    }
  }
};

export const getDeveloperMode = () => {
  return { enabled: DEVELOPER_MODE, location: TEST_LOCATION };
};

// Check if notification should be sent (duplicate prevention)
const shouldSendNotification = async (zoneId, eventType) => {
  try {
    const eventsJson = await AsyncStorage.getItem('disaster_events');
    const events = eventsJson ? JSON.parse(eventsJson) : [];

    if (eventType === 'exit') {
      const hasEntryEvent = events.some(event =>
        event.zone === zoneId && event.type === 'enter'
      );
      if (!hasEntryEvent) {
        console.log(`⏭️ Skipping exit notification for ${zoneId} - no entry event found`);
        return false;
      }
    }

    const recentEvent = events.find(event =>
      event.zone === zoneId && event.type === eventType
    );

    if (!recentEvent) return true;

    const lastEventTime = new Date(recentEvent.timestamp);
    const timeSinceLastEvent = Date.now() - lastEventTime.getTime();

    if (timeSinceLastEvent < NOTIFICATION_COOLDOWN) {
      console.log(`⏭️ Skipping ${eventType} notification for ${zoneId} - notified ${Math.round(timeSinceLastEvent / 1000)}s ago`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error checking notification cooldown:', error);
    return true;
  }
};

// Define the geofencing task
TaskManager.defineTask(GEOFENCING_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('❌ Geofencing task error:', error);
    return;
  }

  if (data.eventType === Location.GeofencingEventType.Enter) {
    const { region } = data;
    const shouldNotify = await shouldSendNotification(region.identifier, 'enter');
    if (shouldNotify) {
      await handleZoneEntry(region);
    }
  } else if (data.eventType === Location.GeofencingEventType.Exit) {
    const { region } = data;

    if (isInitialAppLoad) {
      console.log('⏭️ Skipping exit notification on initial load for:', region.identifier);
      return;
    }

    const shouldNotify = await shouldSendNotification(region.identifier, 'exit');
    if (shouldNotify) {
      await handleZoneExit(region);
    }
  }
});

// Handle zone entry
const handleZoneEntry = async (region) => {
  const zone = DISASTER_ZONES.find(z => z.id === region.identifier);
  if (!zone) {
    console.warn('⚠️ Zone not found for identifier:', region.identifier);
    return;
  }

  console.log('🚨 Entered zone:', zone.id, zone.title);

  await storeEvent({
    type: 'enter',
    zone: zone.id,
    title: zone.title,
    description: zone.description,
    timestamp: new Date().toISOString(),
    severity: zone.severity,
    disasterType: zone.disasterType,
  });

  await sendDisasterAlert(zone, 'enter');
};

// Handle zone exit
const handleZoneExit = async (region) => {
  const zone = DISASTER_ZONES.find(z => z.id === region.identifier);
  if (!zone) {
    console.warn('⚠️ Zone not found for identifier:', region.identifier);
    return;
  }

  console.log('✅ Exited zone:', zone.id, zone.title);

  await storeEvent({
    type: 'exit',
    zone: zone.id,
    title: zone.title,
    description: zone.description,
    timestamp: new Date().toISOString(),
    severity: zone.severity,
    disasterType: zone.disasterType,
  });

  await sendDisasterAlert(zone, 'exit');
};

// Store event in AsyncStorage with deduplication.
// Prevents the same zone+type from being stored multiple times within the cooldown window,
// which was causing "Entered Lewotobi" to appear 3x in Recent Alerts.
const storeEvent = async (event) => {
  try {
    console.log('💾 Storing event:', event.type, event.zone);
    const eventsJson = await AsyncStorage.getItem('disaster_events');
    const events = eventsJson ? JSON.parse(eventsJson) : [];

    // Deduplicate: skip if identical zone+type event already stored within cooldown window
    const isDuplicate = events.some(e =>
      e.zone === event.zone &&
      e.type === event.type &&
      (Date.now() - new Date(e.timestamp).getTime()) < NOTIFICATION_COOLDOWN
    );

    if (isDuplicate) {
      console.log(`⏭️ Skipping duplicate event storage for ${event.zone} (${event.type})`);
      return;
    }

    events.unshift(event);
    const trimmedEvents = events.slice(0, 100);
    await AsyncStorage.setItem('disaster_events', JSON.stringify(trimmedEvents));
    console.log('✅ Event stored successfully. Total events:', trimmedEvents.length);
  } catch (error) {
    console.error('❌ Error storing event:', error);
  }
};

// Send disaster alert notification
const sendDisasterAlert = async (zone, eventType) => {
  try {
    const messages = getAlertMessage(zone, eventType);
    console.log('📢 Sending notification:', messages.title);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: messages.title,
        body: messages.body,
        data: {
          zoneId: zone.id,
          severity: zone.severity,
          disasterType: zone.disasterType,
          eventType,
          source: zone.source || 'gdacs',
        },
        sound: zone.severity === 'critical' || zone.severity === 'high',
        priority: zone.severity === 'critical' ? 'high' : 'default',
      },
      trigger: null,
    });

    console.log('✅ Notification sent successfully');

    if (eventType === 'enter') {
      await saveAlertToFirestore(zone);
    }
  } catch (error) {
    console.error('❌ Error sending disaster alert:', error);
  }
};

// Save alert to Firestore
const saveAlertToFirestore = async (zone) => {
  try {
    const alertsRef = collection(db, 'alerts');
    await addDoc(alertsRef, {
      title: zone.title,
      description: zone.description,
      severity: zone.severity,
      disasterType: zone.disasterType,
      zoneId: zone.id,
      timestamp: Timestamp.now(),
      latitude: zone.latitude,
      longitude: zone.longitude,
      radius: zone.radius,
      source: zone.source || 'gdacs',
    });
    console.log('✅ Alert saved to Firestore');
  } catch (error) {
    console.warn('⚠️ Error saving alert to Firestore:', error);
  }
};

// Get alert message based on zone and event type
const getAlertMessage = (zone, eventType) => {
  const isEntry = eventType === 'enter';
  const severity = zone.severity.toUpperCase();

  const messages = {
    enter: {
      flood: {
        critical: {
          title: '🚨 CRITICAL FLOOD ALERT',
          body: `You have entered a CRITICAL flood zone: ${zone.title || zone.description}. Seek higher ground immediately. Call 999 if in danger.`,
        },
        high: {
          title: '⚠️ HIGH FLOOD ALERT',
          body: `You are in a high-risk flood area: ${zone.title || zone.description}. Move to higher ground and avoid water.`,
        },
        warning: {
          title: '⚠️ Flood Warning',
          body: `You have entered a flood warning area: ${zone.title || zone.description}. Stay alert and avoid low-lying areas.`,
        },
        info: {
          title: 'ℹ️ Flood Information',
          body: `You are in an area with potential flood risk: ${zone.title || zone.description}. Monitor conditions.`,
        },
      },
      fire: {
        critical: {
          title: '🚨 CRITICAL FIRE ALERT',
          body: `IMMEDIATE DANGER: ${zone.title || zone.description}. Evacuate immediately. Call 999.`,
        },
        high: {
          title: '🔥 HIGH FIRE ALERT',
          body: `You are near an active fire: ${zone.title || zone.description}. Follow evacuation orders and stay alert.`,
        },
        warning: {
          title: '🔥 Fire Warning',
          body: `Fire risk in this area: ${zone.title || zone.description}. Stay informed and be ready to evacuate.`,
        },
        info: {
          title: 'ℹ️ Fire Information',
          body: `Elevated fire risk: ${zone.title || zone.description}. Avoid ignition sources.`,
        },
      },
      storm: {
        critical: {
          title: '🚨 SEVERE STORM WARNING',
          body: `Dangerous storm conditions: ${zone.title || zone.description}. Seek shelter immediately.`,
        },
        high: {
          title: '⛈️ HIGH STORM ALERT',
          body: `Severe storm approaching: ${zone.title || zone.description}. Take shelter and secure loose objects.`,
        },
        warning: {
          title: '⛈️ Storm Warning',
          body: `Storm warning active: ${zone.title || zone.description}. Stay indoors and monitor conditions.`,
        },
        info: {
          title: 'ℹ️ Storm Information',
          body: `Stormy weather expected: ${zone.title || zone.description}. Stay alert.`,
        },
      },
      evacuation: {
        critical: {
          title: '🚨 MANDATORY EVACUATION',
          body: `You are in a mandatory evacuation zone: ${zone.title || zone.description}. Leave immediately. Follow official routes.`,
        },
        high: {
          title: '⚠️ EVACUATION ALERT',
          body: `Evacuation recommended: ${zone.title || zone.description}. Prepare to leave and follow official guidance.`,
        },
        warning: {
          title: '⚠️ Evacuation Warning',
          body: `Be prepared to evacuate: ${zone.title || zone.description}. Monitor official channels.`,
        },
        info: {
          title: 'ℹ️ Evacuation Information',
          body: `Potential evacuation area: ${zone.title || zone.description}. Stay informed.`,
        },
      },
      earthquake: {
        critical: {
          title: '🚨 CRITICAL EARTHQUAKE ALERT',
          body: `Major earthquake detected: ${zone.title || zone.description}. Drop, Cover, and Hold On. Seek safe shelter.`,
        },
        high: {
          title: '⚠️ EARTHQUAKE ALERT',
          body: `Earthquake activity detected: ${zone.title || zone.description}. Stay away from buildings and windows.`,
        },
        warning: {
          title: '⚠️ Earthquake Warning',
          body: `Seismic activity in area: ${zone.title || zone.description}. Be prepared for aftershocks.`,
        },
        info: {
          title: 'ℹ️ Earthquake Information',
          body: `Earthquake zone: ${zone.title || zone.description}. Stay alert for seismic activity.`,
        },
      },
    },
    exit: {
      flood:      { title: '✓ Left Flood Zone',      body: `You have exited the flood zone: ${zone.title || zone.description}. Stay alert.` },
      fire:       { title: '✓ Left Fire Zone',       body: `You have exited the fire risk area: ${zone.title || zone.description}.` },
      storm:      { title: '✓ Left Storm Zone',      body: `You have exited the storm warning area: ${zone.title || zone.description}.` },
      evacuation: { title: '✓ Left Evacuation Zone', body: `You have exited the evacuation zone: ${zone.title || zone.description}.` },
      earthquake: { title: '✓ Left Earthquake Zone', body: `You have exited the earthquake zone: ${zone.title || zone.description}.` },
    },
  };

  if (isEntry) {
    return messages.enter[zone.disasterType]?.[zone.severity] || {
      title: `${severity} ALERT`,
      body: `You have entered a ${zone.severity} ${zone.disasterType} zone: ${zone.title || zone.description}`,
    };
  } else {
    return messages.exit[zone.disasterType] || {
      title: 'Zone Exited',
      body: `You have left the ${zone.disasterType} zone: ${zone.title || zone.description}`,
    };
  }
};

export const locationService = {
  // Request permissions
  requestPermissions: async () => {
    try {
      console.log('📍 Requesting location permissions...');

      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        return { success: false, error: 'Location permission denied. PrepareNow needs location access to send emergency alerts.' };
      }
      console.log('✅ Foreground location permission granted');

      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        return { success: false, error: 'Background location permission denied. PrepareNow needs background access to monitor disaster zones.' };
      }
      console.log('✅ Background location permission granted');

      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      if (notificationStatus !== 'granted') {
        return { success: false, error: 'Notification permission denied. PrepareNow needs notification access to send alerts.' };
      }
      console.log('✅ All permissions granted successfully');

      return { success: true };
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return { success: false, error: error.message };
    }
  },

  // Get current location (with developer mode support)
  getCurrentLocation: async () => {
    if (DEVELOPER_MODE && TEST_LOCATION) {
      console.log('🛠️ Using test location (Developer Mode):', TEST_LOCATION);
      return { success: true, location: { coords: TEST_LOCATION } };
    }

    console.log('📍 Getting current location...');

    try {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000 });
      console.log('✅ Location obtained (high accuracy):', location.coords.latitude, location.coords.longitude);
      return { success: true, location };
    } catch (e1) {
      console.warn('⚠️ High accuracy failed, trying low accuracy...');
    }

    try {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
      console.log('✅ Location obtained (low accuracy):', location.coords.latitude, location.coords.longitude);
      return { success: true, location };
    } catch (e2) {
      console.warn('⚠️ Low accuracy failed, trying last known position...');
    }

    try {
      const lastLocation = await Location.getLastKnownPositionAsync();
      if (lastLocation) {
        console.log('✅ Using last known location:', lastLocation.coords.latitude, lastLocation.coords.longitude);
        return { success: true, location: lastLocation };
      }
    } catch (e3) {
      console.warn('⚠️ No last known position available');
    }

    console.error('❌ All location methods failed.');
    return {
      success: false,
      isSimulatorError: true,
      error: 'Could not get location. If testing on Simulator, go to Developer Settings and enable "Test Location".',
    };
  },

  // Start monitoring
  startMonitoring: async () => {
    try {
      console.log('🚀 Starting disaster zone monitoring...');

      // Guard: if already registered, skip — prevents duplicate entry notifications on re-mount
      const isAlreadyRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK_NAME);
      if (isAlreadyRegistered) {
        console.log('✅ Geofencing already registered — skipping restart to prevent duplicate notifications');
        return { success: true };
      }

      if (DISASTER_ZONES.length === 0) {
        await loadDisasterZonesOnce();
      }

      if (DISASTER_ZONES.length === 0) {
        return { success: false, error: 'No disaster zones available. Please run the GDACS sync script to populate zones.' };
      }

      const regions = DISASTER_ZONES.map(zone => ({
        identifier: zone.id,
        latitude: zone.latitude,
        longitude: zone.longitude,
        radius: zone.radius,
        notifyOnEnter: true,
        notifyOnExit: true,
      }));

      console.log(`📍 Starting geofencing with ${regions.length} GDACS regions`);
      await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, regions);
      console.log('✅ Geofencing started successfully');

      const currentLocation = await locationService.getCurrentLocation();
      if (currentLocation.success) {
        await checkInitialZones(currentLocation.location.coords);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Start monitoring error:', error);
      return { success: false, error: error.message };
    }
  },

  // Restart geofencing with updated zones
  restartGeofencing: async () => {
    try {
      console.log('🔄 Restarting geofencing with updated zones...');

      const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK_NAME);
      if (isRegistered) {
        await Location.stopGeofencingAsync(GEOFENCING_TASK_NAME);
      }

      if (DISASTER_ZONES.length === 0) {
        console.warn('⚠️ No zones to restart geofencing with');
        return { success: false, error: 'No zones available' };
      }

      const regions = DISASTER_ZONES.map(zone => ({
        identifier: zone.id,
        latitude: zone.latitude,
        longitude: zone.longitude,
        radius: zone.radius,
        notifyOnEnter: true,
        notifyOnExit: true,
      }));

      await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, regions);
      console.log(`✅ Geofencing restarted with ${regions.length} GDACS zones`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error restarting geofencing:', error);
      return { success: false, error: error.message };
    }
  },

  // Stop monitoring
  stopMonitoring: async () => {
    try {
      console.log('🛑 Stopping disaster zone monitoring...');

      const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK_NAME);
      if (isRegistered) {
        await Location.stopGeofencingAsync(GEOFENCING_TASK_NAME);
        console.log('✅ Geofencing stopped');
      }

      unsubscribeFromDisasterZones();
      console.log('✅ Monitoring stopped successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Error stopping monitoring:', error);
      return { success: false, error: error.message };
    }
  },

  // Get event history
  getEventHistory: async () => {
    try {
      const eventsJson = await AsyncStorage.getItem('disaster_events');
      const events = eventsJson ? JSON.parse(eventsJson) : [];
      console.log(`📋 Retrieved ${events.length} events from history`);
      return { success: true, events };
    } catch (error) {
      console.error('❌ Error getting event history:', error);
      return { success: false, error: error.message, events: [] };
    }
  },

  // Get critical events from local history
  getCriticalEvents: async () => {
    try {
      const eventsJson = await AsyncStorage.getItem('disaster_events');
      const events = eventsJson ? JSON.parse(eventsJson) : [];
      const criticalEvents = events.filter(event =>
        event.type === 'enter' && (event.severity === 'high' || event.severity === 'critical')
      );
      console.log(`🚨 Found ${criticalEvents.length} critical events`);
      return { success: true, events: criticalEvents };
    } catch (error) {
      console.error('❌ Error getting critical events:', error);
      return { success: false, error: error.message, events: [] };
    }
  },

  // Clear event history
  clearEventHistory: async () => {
    try {
      await AsyncStorage.removeItem('disaster_events');
      console.log('🗑️ Event history cleared');
      return { success: true };
    } catch (error) {
      console.error('❌ Error clearing event history:', error);
      return { success: false, error: error.message };
    }
  },

  // Calculate distance between two points (Haversine formula)
  calculateDistance: (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  // Check if user is in any zone
  isInZone: (userLat, userLon, zone) => {
    const distance = locationService.calculateDistance(userLat, userLon, zone.latitude, zone.longitude);
    return distance <= zone.radius;
  },

  // Get nearby zones
  getNearbyZones: async (userLocation) => {
    const zones = DISASTER_ZONES.map(zone => {
      const distance = locationService.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        zone.latitude,
        zone.longitude
      );
      return { ...zone, distance: Math.round(distance), isInside: distance <= zone.radius };
    }).sort((a, b) => a.distance - b.distance);

    console.log(`📍 Found ${zones.length} nearby GDACS zones`);
    return zones;
  },

  // Get currently active zones (zones user is inside)
  getActiveZones: async () => {
    try {
      const currentLocation = await locationService.getCurrentLocation();
      if (!currentLocation.success) {
        return { success: false, error: currentLocation.error, zones: [] };
      }

      const { latitude, longitude } = currentLocation.location.coords;
      const activeZones = [];

      for (const zone of DISASTER_ZONES) {
        const distance = locationService.calculateDistance(latitude, longitude, zone.latitude, zone.longitude);
        if (distance <= zone.radius) {
          activeZones.push({ ...zone, distance: Math.round(distance) });
        }
      }

      console.log(`🚨 Currently in ${activeZones.length} active zones`);
      return { success: true, zones: activeZones };
    } catch (error) {
      console.error('❌ Error getting active zones:', error);
      return { success: false, error: error.message, zones: [] };
    }
  },

  // Get live alerts from Firestore
  getLiveAlerts: async () => {
    try {
      const alertsRef = collection(db, 'alerts');
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const q = query(alertsRef, where('timestamp', '>=', Timestamp.fromDate(twentyFourHoursAgo)));
      const querySnapshot = await getDocs(q);
      const alerts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp),
      }));
      console.log(`📡 Retrieved ${alerts.length} live alerts from Firestore`);
      return { success: true, alerts };
    } catch (error) {
      console.warn('⚠️ Error fetching live alerts from Firestore:', error);
      return { success: false, error: error.message, alerts: [] };
    }
  },

  // Get critical alerts only
  getCriticalAlerts: async () => {
    try {
      const alertsRef = collection(db, 'alerts');
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const q = query(
        alertsRef,
        where('severity', '==', 'critical'),
        where('timestamp', '>=', Timestamp.fromDate(twentyFourHoursAgo))
      );
      const querySnapshot = await getDocs(q);
      const alerts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp),
      }));
      console.log(`🚨 Retrieved ${alerts.length} critical alerts from Firestore`);
      return { success: true, alerts };
    } catch (error) {
      console.warn('⚠️ Error fetching critical alerts from Firestore:', error);
      return { success: false, error: error.message, alerts: [] };
    }
  },

  // Manually check zones and trigger alerts
  manualCheckZones: async () => {
    try {
      console.log('🔍 Manually checking zones...');
      const currentLocation = await locationService.getCurrentLocation();

      if (!currentLocation.success) {
        return { success: false, error: currentLocation.error, zonesTriggered: [] };
      }

      const { latitude, longitude } = currentLocation.location.coords;
      console.log('📍 Current location:', latitude, longitude);

      let zonesTriggered = [];

      for (const zone of DISASTER_ZONES) {
        const distance = locationService.calculateDistance(latitude, longitude, zone.latitude, zone.longitude);
        console.log(`📏 Distance to ${zone.id}: ${Math.round(distance)}m (radius: ${zone.radius}m)`);

        if (distance <= zone.radius) {
          console.log('🚨 User is in zone:', zone.id);
          const shouldNotify = await shouldSendNotification(zone.id, 'enter');
          if (shouldNotify) {
            await handleZoneEntry({ identifier: zone.id });
            zonesTriggered.push(zone.id);
          } else {
            console.log(`⏭️ Skipping notification for ${zone.id} - already notified recently`);
          }
        }
      }

      console.log(`✅ Manual check complete. Triggered ${zonesTriggered.length} zones`);
      return { success: true, zonesTriggered };
    } catch (error) {
      console.error('❌ Error in manual zone check:', error);
      return { success: false, error: error.message, zonesTriggered: [] };
    }
  },

  // Get all disaster zones (for display)
  getAllZones: () => {
    console.log(`📋 Returning ${DISASTER_ZONES.length} total GDACS zones`);
    return DISASTER_ZONES;
  },

  // Get zone count
  getZoneCount: () => {
    return DISASTER_ZONES.length;
  },
};

// Check if user is already in any zones on app start.
// IMPORTANT: Records zones SILENTLY — no notifications sent on startup.
// Notifications only fire when the user genuinely moves into a new zone after app start.
const checkInitialZones = async (coords) => {
  const { latitude, longitude } = coords;
  console.log('🔍 Checking initial zones (silent — no notifications on startup):', latitude, longitude);

  let zonesFound = 0;

  for (const zone of DISASTER_ZONES) {
    const distance = locationService.calculateDistance(latitude, longitude, zone.latitude, zone.longitude);
    console.log(`📏 Distance to ${zone.id}: ${Math.round(distance)}m (radius: ${zone.radius}m)`);

    if (distance <= zone.radius) {
      zonesFound++;
      console.log(`📍 Already in zone on startup (recording silently, no notification): ${zone.id}`);

      // storeEvent (not handleZoneEntry) — records the event to activate cooldown
      // without sending a push notification
      await storeEvent({
        type: 'enter',
        zone: zone.id,
        title: zone.title,
        description: zone.description,
        timestamp: new Date().toISOString(),
        severity: zone.severity,
        disasterType: zone.disasterType,
      });
    }
  }

  if (zonesFound === 0) {
    console.log('✅ Not in any disaster zones on startup');
  } else {
    console.log(`📍 Recorded ${zonesFound} pre-existing zones silently on startup`);
  }

  // Enable exit notifications after initial geofencing events settle
  setTimeout(() => {
    isInitialAppLoad = false;
    console.log('✅ Initial app load complete — exit notifications now enabled');
  }, 5000);
};
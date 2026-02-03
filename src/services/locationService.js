import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DISASTER_TYPES, SEVERITY_LEVELS } from '../constants/disasters';

const LOCATION_TASK_NAME = 'background-location-task';
const GEOFENCING_TASK_NAME = 'geofencing-task';
const NOTIFICATION_COOLDOWN = 10 * 60 * 1000; // 10 minutes in milliseconds

// Track if app has just started to prevent exit notifications on initial load
let isInitialAppLoad = true;

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

// Test disaster zones (Derby, UK)
export const DISASTER_ZONES = [
  {
    id: 'flood-derby-center',
  latitude: 37.785834,
  longitude: -122.406417,
    radius: 500,
    disasterType: DISASTER_TYPES.FLOOD,
    severity: SEVERITY_LEVELS.HIGH,
    title: 'Flood Zone - Derby City Centre',
    description: 'River Derwent flooding risk',
  },
  {
    id: 'evacuation-north-derby',
    latitude: 52.9425,
    longitude: -1.4746,
    radius: 300,
    disasterType: DISASTER_TYPES.EVACUATION,
    severity: SEVERITY_LEVELS.CRITICAL,
    title: 'Evacuation Zone - North Derby',
    description: 'Immediate evacuation required',
  },
  {
    id: 'fire-west-derby',
    latitude: 52.9225,
    longitude: -1.5046,
    radius: 400,
    disasterType: DISASTER_TYPES.FIRE,
    severity: SEVERITY_LEVELS.WARNING,
    title: 'Fire Risk - West Derby',
    description: 'Industrial fire hazard',
  },
  {
    id: 'storm-east-derby',
    latitude: 52.9225,
    longitude: -1.4446,
    radius: 600,
    disasterType: DISASTER_TYPES.STORM,
    severity: SEVERITY_LEVELS.WARNING,
    title: 'Storm Warning - East Derby',
    description: 'Severe weather approaching',
  },
];

// Check if notification should be sent (duplicate prevention)
const shouldSendNotification = async (zoneId, eventType) => {
  try {
    const eventsJson = await AsyncStorage.getItem('disaster_events');
    const events = eventsJson ? JSON.parse(eventsJson) : [];
    
    // For exit events, only allow if user has a previous entry event
    if (eventType === 'exit') {
      const hasEntryEvent = events.some(event => 
        event.zone === zoneId && event.type === 'enter'
      );
      
      if (!hasEntryEvent) {
        console.log(`Skipping exit notification for ${zoneId} - no entry event found`);
        return false;
      }
    }
    
    // Find the most recent event for this zone with the same event type
    const recentEvent = events.find(event => 
      event.zone === zoneId && event.type === eventType
    );
    
    if (!recentEvent) {
      return true; // No previous event, send notification
    }
    
    // Check if enough time has passed since last notification
    const lastEventTime = new Date(recentEvent.timestamp);
    const timeSinceLastEvent = Date.now() - lastEventTime.getTime();
    
    if (timeSinceLastEvent < NOTIFICATION_COOLDOWN) {
      console.log(`Skipping ${eventType} notification for ${zoneId} - notified ${Math.round(timeSinceLastEvent / 1000)}s ago`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking notification cooldown:', error);
    return true; // On error, allow notification
  }
};

// Define the geofencing task
TaskManager.defineTask(GEOFENCING_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Geofencing task error:', error);
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
    
    // Skip exit notifications if this is the initial app load
    if (isInitialAppLoad) {
      console.log('Skipping exit notification on initial load for:', region.identifier);
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
    console.warn('Zone not found for identifier:', region.identifier);
    return;
  }

  console.log('Entered zone:', zone.id, zone.title);

  // Store event with full zone information
  await storeEvent({
    type: 'enter',
    zone: zone.id,
    title: zone.title,
    description: zone.description,
    timestamp: new Date().toISOString(),
    severity: zone.severity,
    disasterType: zone.disasterType,
  });

  // Send notification
  await sendDisasterAlert(zone, 'enter');
};

// Handle zone exit
const handleZoneExit = async (region) => {
  const zone = DISASTER_ZONES.find(z => z.id === region.identifier);
  if (!zone) {
    console.warn('Zone not found for identifier:', region.identifier);
    return;
  }

  console.log('Exited zone:', zone.id, zone.title);

  // Store event with full zone information
  await storeEvent({
    type: 'exit',
    zone: zone.id,
    title: zone.title,
    description: zone.description,
    timestamp: new Date().toISOString(),
    severity: zone.severity,
    disasterType: zone.disasterType,
  });

  // Send notification
  await sendDisasterAlert(zone, 'exit');
};

// Store event in AsyncStorage
const storeEvent = async (event) => {
  try {
    console.log('Storing event:', event);
    const eventsJson = await AsyncStorage.getItem('disaster_events');
    const events = eventsJson ? JSON.parse(eventsJson) : [];
    events.unshift(event);
    
    // Keep only last 100 events
    const trimmedEvents = events.slice(0, 100);
    await AsyncStorage.setItem('disaster_events', JSON.stringify(trimmedEvents));
    console.log('Event stored successfully. Total events:', trimmedEvents.length);
  } catch (error) {
    console.error('Error storing event:', error);
  }
};

// Send disaster alert notification
const sendDisasterAlert = async (zone, eventType) => {
  try {
    const messages = getAlertMessage(zone, eventType);
    
    console.log('Sending notification:', messages.title);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: messages.title,
        body: messages.body,
        data: {
          zoneId: zone.id,
          severity: zone.severity,
          disasterType: zone.disasterType,
          eventType,
        },
        sound: zone.severity === 'critical' || zone.severity === 'high',
        priority: zone.severity === 'critical' ? 'high' : 'default',
      },
      trigger: null, // Send immediately
    });
    
    console.log('Notification sent successfully');
    
    // Also save to Firestore if this is an entry event
    if (eventType === 'enter') {
      await saveAlertToFirestore(zone);
    }
  } catch (error) {
    console.error('Error sending disaster alert:', error);
  }
};

// Save alert to Firestore
const saveAlertToFirestore = async (zone) => {
  try {
    const { db } = require('../config/firebase');
    const { collection, addDoc, Timestamp } = require('firebase/firestore');
    
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
    });
    
    console.log('Alert saved to Firestore');
  } catch (error) {
    console.warn('Error saving alert to Firestore:', error);
    // Don't fail if Firestore save fails, local notification is still shown
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
          title: 'CRITICAL FLOOD ALERT',
          body: 'You have entered a CRITICAL flood zone. Seek higher ground immediately. Call 999 if in danger.',
        },
        high: {
          title: 'HIGH FLOOD ALERT',
          body: 'You are in a high-risk flood area. Move to higher ground and avoid water.',
        },
        warning: {
          title: 'Flood Warning',
          body: 'You have entered a flood warning area. Stay alert and avoid low-lying areas.',
        },
        info: {
          title: 'Flood Information',
          body: 'You are in an area with potential flood risk. Monitor conditions.',
        },
      },
      fire: {
        critical: {
          title: 'CRITICAL FIRE ALERT',
          body: 'IMMEDIATE DANGER: Active fire zone. Evacuate immediately. Call 999.',
        },
        high: {
          title: 'HIGH FIRE ALERT',
          body: 'You are near an active fire. Follow evacuation orders and stay alert.',
        },
        warning: {
          title: 'Fire Warning',
          body: 'Fire risk in this area. Stay informed and be ready to evacuate.',
        },
        info: {
          title: 'Fire Information',
          body: 'Elevated fire risk. Avoid ignition sources.',
        },
      },
      storm: {
        critical: {
          title: 'SEVERE STORM WARNING',
          body: 'Dangerous storm conditions. Seek shelter immediately.',
        },
        high: {
          title: 'HIGH STORM ALERT',
          body: 'Severe storm approaching. Take shelter and secure loose objects.',
        },
        warning: {
          title: 'Storm Warning',
          body: 'Storm warning active. Stay indoors and monitor conditions.',
        },
        info: {
          title: 'Storm Information',
          body: 'Stormy weather expected. Stay alert.',
        },
      },
      evacuation: {
        critical: {
          title: 'MANDATORY EVACUATION',
          body: 'You are in a mandatory evacuation zone. Leave immediately. Follow official routes.',
        },
        high: {
          title: 'EVACUATION ALERT',
          body: 'Evacuation recommended. Prepare to leave and follow official guidance.',
        },
        warning: {
          title: 'Evacuation Warning',
          body: 'Be prepared to evacuate. Monitor official channels.',
        },
        info: {
          title: 'Evacuation Information',
          body: 'Potential evacuation area. Stay informed.',
        },
      },
    },
    exit: {
      flood: {
        title: 'Left Flood Zone',
        body: 'You have exited the flood zone. Stay alert.',
      },
      fire: {
        title: 'Left Fire Zone',
        body: 'You have exited the fire risk area.',
      },
      storm: {
        title: 'Left Storm Zone',
        body: 'You have exited the storm warning area.',
      },
      evacuation: {
        title: 'Left Evacuation Zone',
        body: 'You have exited the evacuation zone.',
      },
    },
  };

  if (isEntry) {
    return messages.enter[zone.disasterType]?.[zone.severity] || {
      title: `${severity} ALERT`,
      body: `You have entered a ${zone.severity} ${zone.disasterType} zone.`,
    };
  } else {
    return messages.exit[zone.disasterType] || {
      title: 'Zone Exited',
      body: `You have left the ${zone.disasterType} zone.`,
    };
  }
};

export const locationService = {
  // Request permissions
  requestPermissions: async () => {
    try {
      // Request foreground permission first
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        return {
          success: false,
          error: 'Location permission denied. PrepareNow needs location access to send emergency alerts.',
        };
      }

      // Request background permission
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus !== 'granted') {
        return {
          success: false,
          error: 'Background location permission denied. PrepareNow needs background access to monitor disaster zones.',
        };
      }

      // Request notification permission
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      
      if (notificationStatus !== 'granted') {
        return {
          success: false,
          error: 'Notification permission denied. PrepareNow needs notification access to send alerts.',
        };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get current location
  getCurrentLocation: async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return { success: true, location };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Start monitoring
  startMonitoring: async () => {
    try {
      console.log('Starting disaster zone monitoring...');
      
      // Check if already monitoring
      const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK_NAME);
      
      if (isRegistered) {
        console.log('Geofencing already registered, stopping first...');
        await Location.stopGeofencingAsync(GEOFENCING_TASK_NAME);
      }

      // Start geofencing
      const regions = DISASTER_ZONES.map(zone => ({
        identifier: zone.id,
        latitude: zone.latitude,
        longitude: zone.longitude,
        radius: zone.radius,
        notifyOnEnter: true,
        notifyOnExit: true,
      }));

      console.log('Starting geofencing with', regions.length, 'regions');
      await Location.startGeofencingAsync(GEOFENCING_TASK_NAME, regions);
      console.log('Geofencing started successfully');

      // Check if user is already in any zone (with duplicate prevention)
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      console.log('Current location:', currentLocation.coords.latitude, currentLocation.coords.longitude);
      await checkInitialZones(currentLocation.coords);

      return { success: true };
    } catch (error) {
      console.error('Start monitoring error:', error);
      return { success: false, error: error.message };
    }
  },

  // Stop monitoring
  stopMonitoring: async () => {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCING_TASK_NAME);
      
      if (isRegistered) {
        await Location.stopGeofencingAsync(GEOFENCING_TASK_NAME);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get event history
  getEventHistory: async () => {
    try {
      const eventsJson = await AsyncStorage.getItem('disaster_events');
      const events = eventsJson ? JSON.parse(eventsJson) : [];
      return { success: true, events };
    } catch (error) {
      return { success: false, error: error.message, events: [] };
    }
  },

  // Get critical events from local history
  getCriticalEvents: async () => {
    try {
      const eventsJson = await AsyncStorage.getItem('disaster_events');
      const events = eventsJson ? JSON.parse(eventsJson) : [];
      
      // Filter for entry events with high or critical severity
      const criticalEvents = events.filter(event => 
        event.type === 'enter' && (event.severity === 'high' || event.severity === 'critical')
      );
      
      return { success: true, events: criticalEvents };
    } catch (error) {
      return { success: false, error: error.message, events: [] };
    }
  },

  // Clear event history
  clearEventHistory: async () => {
    try {
      await AsyncStorage.removeItem('disaster_events');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Calculate distance between two points
  calculateDistance: (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  },

  // Check if user is in any zone
  isInZone: (userLat, userLon, zone) => {
    const distance = locationService.calculateDistance(
      userLat,
      userLon,
      zone.latitude,
      zone.longitude
    );
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
      
      const isInside = distance <= zone.radius;
      
      return {
        ...zone,
        distance: Math.round(distance),
        isInside,
      };
    }).sort((a, b) => a.distance - b.distance);

    return zones;
  },

  // Get currently active zones (zones user is inside)
  getActiveZones: async () => {
    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const { latitude, longitude } = currentLocation.coords;
      const activeZones = [];
      
      for (const zone of DISASTER_ZONES) {
        const distance = locationService.calculateDistance(
          latitude,
          longitude,
          zone.latitude,
          zone.longitude
        );
        
        if (distance <= zone.radius) {
          activeZones.push({
            ...zone,
            distance: Math.round(distance),
          });
        }
      }
      
      return { success: true, zones: activeZones };
    } catch (error) {
      console.error('Error getting active zones:', error);
      return { success: false, error: error.message, zones: [] };
    }
  },

  // Get live alerts from Firestore
  getLiveAlerts: async () => {
    try {
      const { db } = require('../config/firebase');
      const { collection, query, where, getDocs, Timestamp } = require('firebase/firestore');

      // Query for active/recent alerts (from the last 24 hours)
      const alertsRef = collection(db, 'alerts');
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const q = query(
        alertsRef,
        where('timestamp', '>=', Timestamp.fromDate(twentyFourHoursAgo))
      );
      
      const querySnapshot = await getDocs(q);
      const alerts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp),
      }));

      return { success: true, alerts };
    } catch (error) {
      console.warn('Error fetching live alerts from Firestore:', error);
      return { success: false, error: error.message, alerts: [] };
    }
  },

  // Get critical alerts only
  getCriticalAlerts: async () => {
    try {
      const { db } = require('../config/firebase');
      const { collection, query, where, getDocs, Timestamp } = require('firebase/firestore');

      // Query for critical alerts from the last 24 hours
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

      return { success: true, alerts };
    } catch (error) {
      console.warn('Error fetching critical alerts from Firestore:', error);
      return { success: false, error: error.message, alerts: [] };
    }
  },

  // Manually check zones and trigger alerts (for testing/debugging)
  // NOW WITH PROPER DUPLICATE PREVENTION
  manualCheckZones: async () => {
    try {
      console.log('Manually checking zones...');
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const { latitude, longitude } = currentLocation.coords;
      console.log('Current location:', latitude, longitude);
      
      let zonesTriggered = [];
      
      for (const zone of DISASTER_ZONES) {
        const distance = locationService.calculateDistance(
          latitude,
          longitude,
          zone.latitude,
          zone.longitude
        );
        
        console.log(`Distance to ${zone.id}: ${Math.round(distance)}m (radius: ${zone.radius}m)`);
        
        if (distance <= zone.radius) {
          console.log('User is in zone:', zone.id);
          
          // Check if we should send notification (duplicate prevention)
          const shouldNotify = await shouldSendNotification(zone.id, 'enter');
          
          if (shouldNotify) {
            await handleZoneEntry({ identifier: zone.id });
            zonesTriggered.push(zone.id);
          } else {
            console.log(`Skipping notification for ${zone.id} - already notified recently`);
          }
        }
      }
      
      return { success: true, zonesTriggered };
    } catch (error) {
      console.error('Error in manual zone check:', error);
      return { success: false, error: error.message, zonesTriggered: [] };
    }
  },
};

// Check if user is already in any zones on app start (with duplicate prevention)
const checkInitialZones = async (coords) => {
  const { latitude, longitude } = coords;
  console.log('Checking initial zones for location:', latitude, longitude);
  
  for (const zone of DISASTER_ZONES) {
    const distance = locationService.calculateDistance(
      latitude,
      longitude,
      zone.latitude,
      zone.longitude
    );
    
    console.log(`Distance to ${zone.id}: ${Math.round(distance)}m (radius: ${zone.radius}m)`);
    
    if (distance <= zone.radius) {
      // User is already in this zone
      console.log('User is in zone:', zone.id);
      
      // Check if we should send notification (duplicate prevention)
      const shouldNotify = await shouldSendNotification(zone.id, 'enter');
      
      if (shouldNotify) {
        await handleZoneEntry({ identifier: zone.id });
      } else {
        console.log(`Skipping initial notification for ${zone.id} - already notified recently`);
      }
    }
  }
  
  // After checking initial zones, set flag to false to allow exit notifications
  setTimeout(() => {
    isInitialAppLoad = false;
    console.log('Initial app load complete - exit notifications now enabled');
  }, 5000); // Wait 5 seconds to ensure all initial geofencing events are processed
};
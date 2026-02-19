const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();
const db = admin.firestore();

// Fetch disaster data every hour
exports.syncDisasterData = functions.pubsub
  .schedule('every 60 minutes')
  .onRun(async (context) => {
    try {
      console.log('Fetching disaster data from GDACS...');
      
      // Fetch from GDACS API
      const response = await axios.get(
        'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH',
        {
          params: {
            fromDate: getDateDaysAgo(7), // Last 7 days
            toDate: new Date().toISOString().split('T')[0],
            alertlevel: 'Orange;Red', // Only significant alerts
          }
        }
      );

      const disasters = parseGDACSData(response.data);
      
      // Update Firestore
      const batch = db.batch();
      
      disasters.forEach(disaster => {
        const docRef = db.collection('disaster_zones').doc(disaster.id);
        batch.set(docRef, {
          ...disaster,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });

      await batch.commit();
      console.log(`Updated ${disasters.length} disaster zones`);
      
      return null;
    } catch (error) {
      console.error('Error syncing disaster data:', error);
      return null;
    }
});

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function parseGDACSData(data) {
  // Parse GDACS XML/JSON response
  // Transform to your app's format
  const disasters = [];
  
  // Example transformation (adjust based on actual API response)
  if (data.item) {
    data.item.forEach(event => {
      disasters.push({
        id: `gdacs-${event.eventid}`,
        latitude: parseFloat(event.latitude),
        longitude: parseFloat(event.longitude),
        radius: calculateRadius(event.severity), // Define based on severity
        disasterType: mapDisasterType(event.eventtype),
        severity: mapSeverity(event.alertlevel),
        title: event.title,
        description: event.description,
        source: 'GDACS',
        eventDate: event.fromdate,
        isActive: true,
      });
    });
  }
  
  return disasters;
}

function mapDisasterType(gdacsType) {
  const typeMap = {
    'EQ': 'earthquake',
    'FL': 'flood',
    'TC': 'storm',
    'DR': 'drought',
    'WF': 'fire',
    'VO': 'volcano',
  };
  return typeMap[gdacsType] || 'other';
}

function mapSeverity(alertLevel) {
  const severityMap = {
    'Red': 'critical',
    'Orange': 'high',
    'Green': 'warning',
  };
  return severityMap[alertLevel] || 'info';
}

function calculateRadius(severity) {
  // Define geofence radius based on disaster severity
  const radiusMap = {
    'critical': 5000, // 5km
    'high': 3000,     // 3km
    'warning': 1000,  // 1km
    'info': 500,      // 500m
  };
  return radiusMap[severity] || 1000;
}
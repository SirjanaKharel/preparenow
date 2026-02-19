// Script to fetch disaster data from GDACS and upload to Firestore
// Run this with: node syncGdacsToFirestore.js

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Map GDACS event types to your app's disaster types
const DISASTER_TYPE_MAP = {
  FL: 'flood',
  EQ: 'earthquake',
  TC: 'storm',   // Tropical Cyclone
  VO: 'fire',    // Volcano (closest match)
  DR: 'flood',   // Drought
  WF: 'fire',    // Wildfire
};

// Map GDACS alert levels to your app's severity levels
const SEVERITY_MAP = {
  Red: 'critical',
  Orange: 'high',
  Green: 'warning',
};

async function syncGdacsToFirestore() {
  console.log('🌍 Fetching disaster data from GDACS...');

  let res;
  try {
    // Updated endpoint - GDACS uses lowercase 'events' and SEARCH format
    res = await fetch(
      'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH',
      {
        headers: {
          // GDACS requires a proper User-Agent and Accept header
          'User-Agent': 'PrepareNow-DisasterApp/1.0 (contact@example.com)',
          'Accept': 'application/json, text/plain, */*',
        },
        // Timeout after 15 seconds
        signal: AbortSignal.timeout(15000),
      }
    );
  } catch (networkError) {
    console.error('❌ Network error reaching GDACS:', networkError.message);
    console.log('💡 Try the RSS feed fallback instead (see bottom of this file)');
    throw networkError;
  }

  console.log(`📡 GDACS response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `GDACS API returned HTTP ${res.status}. Body: ${errorText.substring(0, 200)}`
    );
  }

  const text = await res.text();

  if (!text || text.trim().length === 0) {
    throw new Error(
      'GDACS returned an empty response. The API may be temporarily down or blocking requests.'
    );
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (parseError) {
    // Log first 500 chars so you can see what was actually returned
    console.error(
      '❌ Failed to parse GDACS response as JSON.\n' +
      `First 500 chars of response: ${text.substring(0, 500)}`
    );
    throw parseError;
  }

  if (!data.features || !Array.isArray(data.features)) {
    console.error('❌ Unexpected GDACS response shape:', JSON.stringify(data).substring(0, 300));
    throw new Error('No "features" array found in GDACS response');
  }

  console.log(`✅ Received ${data.features.length} events from GDACS`);

  // Use a batch write for efficiency
  const BATCH_SIZE = 500; // Firestore max
  let batch = db.batch();
  let count = 0;
  let batchCount = 0;

  for (const event of data.features) {
    const props = event.properties;
    const geom = event.geometry;

    // Skip events with missing essential data
    if (!props?.eventid || !geom?.coordinates) {
      console.warn('⚠️ Skipping malformed event:', JSON.stringify(props).substring(0, 100));
      continue;
    }

    const coords = geom.coordinates;
    const disasterType = DISASTER_TYPE_MAP[props.eventtype] || 'flood';
    const severity = SEVERITY_MAP[props.alertlevel] || 'warning';

    const docRef = db.collection('disaster_zones').doc(props.eventid.toString());
    batch.set(docRef, {
      id: props.eventid.toString(),
      latitude: coords[1],
      longitude: coords[0],
      radius: getRadiusByType(props.eventtype),
      disasterType,
      severity,
      title: props.eventname || `${props.eventtype} Event`,
      description: props.country || 'No description',
      isActive: true,
      source: 'gdacs',
      gdacsAlertLevel: props.alertlevel,
      gdacsEventType: props.eventtype,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    count++;
    batchCount++;
    console.log(`  📌 Queued: [${props.eventid}] ${props.eventname} (${severity} ${disasterType})`);

    // Commit batch when it hits the size limit
    if (batchCount === BATCH_SIZE) {
      await batch.commit();
      console.log(`💾 Committed batch of ${BATCH_SIZE} events`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit any remaining events
  if (batchCount > 0) {
    await batch.commit();
    console.log(`💾 Committed final batch of ${batchCount} events`);
  }

  console.log(`\n✅ GDACS sync complete. Uploaded ${count} disaster zones to Firestore.`);
}

// Assign a reasonable default radius (meters) based on event type
function getRadiusByType(eventType) {
  const radii = {
    FL: 15000,  // Flood: 15km
    EQ: 50000,  // Earthquake: 50km
    TC: 100000, // Tropical Cyclone: 100km
    VO: 20000,  // Volcano: 20km
    DR: 30000,  // Drought: 30km
    WF: 10000,  // Wildfire: 10km
  };
  return radii[eventType] || 10000;
}

syncGdacsToFirestore().catch((err) => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});

/* 
 * ALTERNATIVE: RSS FEED FALLBACK
 * 
 * If the JSON API continues to fail, you can use GDACS RSS feeds instead.
 * The RSS feed is more stable: https://www.gdacs.org/xml/rss.xml
 * 
 * You'll need to:
 * 1. Install an XML parser: npm install xml2js
 * 2. Parse the RSS feed instead of JSON
 * 3. Extract event data from RSS <item> elements
 * 
 * Example RSS endpoint:
 * https://www.gdacs.org/xml/rss.xml
 * https://www.gdacs.org/xml/rss_7d.xml (last 7 days)
 */
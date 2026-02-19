// Script to fetch disaster data from GDACS and upload to Firestore
// Run locally:  node scripts/syncGdacsToFirestore.js
// Runs automatically every 6 hours via GitHub Actions

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));
const admin = require('firebase-admin');

// ─────────────────────────────────────────────────────────────────────────────
// Firebase initialisation
// Supports two environments:
//   1. GitHub Actions — reads credentials from FIREBASE_SERVICE_ACCOUNT secret
//   2. Local development — reads from serviceAccountKey.json
// ─────────────────────────────────────────────────────────────────────────────
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Running in GitHub Actions — credentials come from the repository secret
  console.log('🔐 Using Firebase credentials from environment variable (GitHub Actions)');
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // Running locally — credentials come from the local key file
  console.log('🔐 Using Firebase credentials from serviceAccountKey.json (local)');
  serviceAccount = require('../serviceAccountKey.json');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// Mapping tables
// ─────────────────────────────────────────────────────────────────────────────

// Map GDACS event type codes to app disaster types
const DISASTER_TYPE_MAP = {
  FL: 'flood',
  EQ: 'earthquake',
  TC: 'storm',      // Tropical Cyclone
  VO: 'fire',       // Volcano (closest match in app)
  DR: 'flood',      // Drought
  WF: 'fire',       // Wildfire
};

// Map GDACS alert levels to app severity levels
const SEVERITY_MAP = {
  Red:    'critical',
  Orange: 'high',
  Green:  'warning',
};

// Default radius in metres based on event type
function getRadiusByType(eventType) {
  const radii = {
    FL: 15000,   // Flood: 15km
    EQ: 50000,   // Earthquake: 50km
    TC: 100000,  // Tropical Cyclone: 100km
    VO: 20000,   // Volcano: 20km
    DR: 30000,   // Drought: 30km
    WF: 10000,   // Wildfire: 10km
  };
  return radii[eventType] || 10000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main sync function
// ─────────────────────────────────────────────────────────────────────────────
async function syncGdacsToFirestore() {
  console.log('🌍 Fetching disaster data from GDACS...');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  let res;
  try {
    res = await fetch(
      'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH',
      {
        headers: {
          'User-Agent': 'PrepareNow-DisasterApp/1.0 (contact@example.com)',
          'Accept': 'application/json, text/plain, */*',
        },
        signal: AbortSignal.timeout(15000),
      }
    );
  } catch (networkError) {
    console.error('❌ Network error reaching GDACS:', networkError.message);
    console.log('💡 Consider using the RSS feed fallback (see bottom of this file)');
    throw networkError;
  }

  console.log(`📡 GDACS response status: ${res.status} ${res.statusText}`);

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(
      `GDACS API returned HTTP ${res.status}. Body: ${errorText.substring(0, 200)}`
    );
  }

  // ── Parse ──────────────────────────────────────────────────────────────────
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

  // ── Write to Firestore ─────────────────────────────────────────────────────
  // Use batched writes for efficiency (Firestore max batch size is 500)
  const BATCH_SIZE = 500;
  let batch = db.batch();
  let count = 0;
  let batchCount = 0;

  for (const event of data.features) {
    const props = event.properties;
    const geom  = event.geometry;

    // Skip events with missing essential data
    if (!props?.eventid || !geom?.coordinates) {
      console.warn('⚠️ Skipping malformed event:', JSON.stringify(props).substring(0, 100));
      continue;
    }

    const coords      = geom.coordinates;
    const disasterType = DISASTER_TYPE_MAP[props.eventtype] || 'flood';
    const severity     = SEVERITY_MAP[props.alertlevel]     || 'warning';

    const docRef = db.collection('disaster_zones').doc(props.eventid.toString());

    batch.set(docRef, {
      id:               props.eventid.toString(),
      latitude:         coords[1],
      longitude:        coords[0],
      radius:           getRadiusByType(props.eventtype),
      disasterType,
      severity,
      title:            props.eventname || `${props.eventtype} Event`,
      description:      props.country   || 'No description',
      isActive:         true,
      source:           'gdacs',
      gdacsAlertLevel:  props.alertlevel,
      gdacsEventType:   props.eventtype,
      updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
    });

    count++;
    batchCount++;
    console.log(`  📌 Queued: [${props.eventid}] ${props.eventname} (${severity} ${disasterType})`);

    // Commit and start a new batch when the size limit is reached
    if (batchCount === BATCH_SIZE) {
      await batch.commit();
      console.log(`💾 Committed batch of ${BATCH_SIZE} events`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit any remaining events that didn't fill a full batch
  if (batchCount > 0) {
    await batch.commit();
    console.log(`💾 Committed final batch of ${batchCount} events`);
  }

  console.log(`\n✅ GDACS sync complete. Uploaded ${count} disaster zones to Firestore.`);
  console.log(`🕐 Sync ran at: ${new Date().toUTCString()}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
syncGdacsToFirestore().catch((err) => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * ALTERNATIVE: RSS FEED FALLBACK
 *
 * If the JSON API continues to fail, use the GDACS RSS feed instead.
 * It is more stable and less likely to block automated requests.
 *
 * Install an XML parser first:
 *   npm install xml2js
 *
 * RSS endpoints:
 *   https://www.gdacs.org/xml/rss.xml        (latest events)
 *   https://www.gdacs.org/xml/rss_7d.xml     (last 7 days)
 *
 * Then replace the fetch + parse block above with:
 *
 *   const xml2js = require('xml2js');
 *   const rssRes = await fetch('https://www.gdacs.org/xml/rss.xml');
 *   const rssText = await rssRes.text();
 *   const parsed = await xml2js.parseStringPromise(rssText);
 *   const items = parsed.rss.channel[0].item;
 *   // Then map `items` to Firestore documents the same way as above.
 * ─────────────────────────────────────────────────────────────────────────────
 */
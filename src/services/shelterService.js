/**
 * shelterService.js
 *
 * Fetches officially designated emergency / disaster shelter locations
 * worldwide using the OpenStreetMap Overpass API (free, no key required),
 * then caches results in Firebase Firestore for offline use.
 *
 * Fixes applied:
 *   - In-flight deduplication: concurrent calls for the same location share
 *     one Overpass request instead of firing N identical ones.
 *   - Exponential backoff with jitter on 429 / 5xx responses (3 attempts).
 *   - Alternate Overpass mirrors tried in round-robin on failure.
 *   - Minimum 2-second gap between successive Overpass requests.
 *   - HTML response detection: rotates mirror instead of crashing JSON parser.
 *   - Firestore permission errors silently fall through to live Overpass fetch.
 */

import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Constants ─────────────────────────────────────────────────────────────

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const CACHE_TTL_HOURS      = 24;
const SEARCH_RADIUS_M      = 20000;
const MAX_RESULTS          = 100;
const FIRESTORE_COLLECTION = 'shelters';
const MIN_REQUEST_GAP_MS   = 2000;
const MAX_RETRIES          = 3;

const COVERAGE_GOOD_THRESHOLD    = 5;
const COVERAGE_LIMITED_THRESHOLD = 1;

// ─── Rate-limit state ──────────────────────────────────────────────────────

let lastRequestTime = 0;
let endpointIndex   = 0;

// In-flight request cache: cellKey → Promise
const inFlightRequests = new Map();

// ─── OSM filter definitions ────────────────────────────────────────────────

const SHELTER_FILTERS = [
  {
    key: 'amenity', value: 'social_facility',
    extra: { key: 'social_facility', value: 'shelter' },
  },
  { key: 'emergency:social_facility', value: 'shelter'          },
  { key: 'emergency:social_facility', value: 'displaced_people' },
  { key: 'disaster',  value: 'shelter' },
  { key: 'emergency', value: 'shelter' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

const getCoverage = (count) => {
  if (count >= COVERAGE_GOOD_THRESHOLD)    return 'good';
  if (count >= COVERAGE_LIMITED_THRESHOLD) return 'limited';
  return 'none';
};

const sleep  = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const jitter = (ms) => ms + Math.random() * ms * 0.3;

const cellKey = (lat, lon) =>
  `${Math.round(lat * 100) / 100}_${Math.round(lon * 100) / 100}`;

// ─── Overpass query builder ────────────────────────────────────────────────

const buildOverpassQuery = (lat, lon, radiusM) => {
  const around = `(around:${radiusM},${lat},${lon})`;
  const lines = SHELTER_FILTERS.flatMap(({ key, value, extra }) => {
    const selector = extra
      ? `["${key}"="${value}"]["${extra.key}"="${extra.value}"]${around}`
      : `["${key}"="${value}"]${around}`;
    return [`node${selector};`, `way${selector};`];
  });
  return `
[out:json][timeout:30];
(
${lines.join('\n')}
);
out center ${MAX_RESULTS};
  `.trim();
};

// ─── Element parser ────────────────────────────────────────────────────────

const parseElement = (el) => {
  const tags      = el.tags || {};
  const latitude  = el.lat  ?? el.center?.lat;
  const longitude = el.lon  ?? el.center?.lon;
  if (!latitude || !longitude) return null;

  const disasterTypes = [
    tags['emergency:shelter:flood']      === 'yes' && 'Flood',
    tags['emergency:shelter:earthquake'] === 'yes' && 'Earthquake',
    tags['emergency:shelter:tsunami']    === 'yes' && 'Tsunami',
    tags['emergency:shelter:fire']       === 'yes' && 'Fire',
    tags['emergency:shelter:landslide']  === 'yes' && 'Landslide',
    tags['emergency:shelter:storm']      === 'yes' && 'Storm',
  ].filter(Boolean);

  const addrParts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
    tags['addr:postcode'],
    tags['addr:country'],
  ].filter(Boolean);

  const capacityRaw = tags['emergency:capacity'] || tags.capacity;

  return {
    id:            `osm_${el.type}_${el.id}`,
    osmId:         el.id,
    osmType:       el.type,
    name:          tags.name || tags['name:en'] || null,
    type:          null,
    address:       addrParts.length > 0 ? addrParts.join(', ') : null,
    latitude,
    longitude,
    phone:         tags.phone        || tags['contact:phone']   || null,
    website:       tags.website      || tags['contact:website'] || null,
    openingHours:  tags.opening_hours                           || null,
    wheelchair:    tags.wheelchair                              || null,
    capacity:      capacityRaw ? parseInt(capacityRaw, 10) : null,
    disasterTypes: disasterTypes.length > 0 ? disasterTypes : null,
    source:        'openstreetmap',
  };
};

// ─── Firestore cache ───────────────────────────────────────────────────────

const getCachedShelters = async (lat, lon) => {
  try {
    const key    = cellKey(lat, lon);
    const cutoff = Timestamp.fromDate(
      new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000)
    );
    const snap = await getDocs(
      query(
        collection(db, FIRESTORE_COLLECTION),
        where('cacheKey', '==', key),
        where('cachedAt', '>=', cutoff)
      )
    );
    if (snap.empty) {
      console.log('🔄 Shelter cache miss/stale for:', key);
      return null;
    }
    const shelters = snap.docs.map((d) => ({ firestoreId: d.id, ...d.data() }));
    console.log(`✅ Cache hit: ${shelters.length} disaster shelters`);
    return shelters;
  } catch (err) {
    // Permissions error or offline — skip cache silently, go straight to Overpass
    console.warn('⚠️ Firestore cache unavailable, fetching live:', err.message);
    return null;
  }
};

const cacheShelters = async (lat, lon, shelters) => {
  try {
    const key = cellKey(lat, lon);
    const col = collection(db, FIRESTORE_COLLECTION);

    const oldSnap  = await getDocs(query(col, where('cacheKey', '==', key)));
    const delBatch = writeBatch(db);
    oldSnap.docs.forEach((d) => delBatch.delete(d.ref));
    await delBatch.commit();

    const now = Timestamp.now();
    for (let i = 0; i < shelters.length; i += 499) {
      const batch = writeBatch(db);
      shelters.slice(i, i + 499).forEach((s) => {
        batch.set(doc(col), { ...s, cacheKey: key, cachedAt: now });
      });
      await batch.commit();
    }
    console.log(`✅ Cached ${shelters.length} disaster shelters (key: ${key})`);
  } catch (err) {
    // Don't let cache failures block the UI — shelters already returned to caller
    console.warn('⚠️ Firestore cache write skipped:', err.message);
  }
};

// ─── Overpass fetch with backoff, endpoint rotation, HTML detection ────────

const fetchFromOverpass = async (lat, lon) => {
  const queryStr = buildOverpassQuery(lat, lon, SEARCH_RADIUS_M);
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Enforce minimum gap between requests
    const gap = Date.now() - lastRequestTime;
    if (gap < MIN_REQUEST_GAP_MS) {
      await sleep(MIN_REQUEST_GAP_MS - gap);
    }

    const endpoint = OVERPASS_ENDPOINTS[endpointIndex % OVERPASS_ENDPOINTS.length];
    const url = `${endpoint}?data=${encodeURIComponent(queryStr)}`;

    console.log(
      `🌐 Overpass attempt ${attempt + 1}/${MAX_RETRIES} via ${endpoint} ` +
      `(${lat.toFixed(4)}, ${lon.toFixed(4)})…`
    );

    try {
      lastRequestTime = Date.now();
      const response = await fetch(url, { headers: { Accept: 'application/json' } });

      // Rate-limited or server error — backoff and rotate mirror
      if (response.status === 429 || response.status >= 500) {
        const backoff = jitter(1000 * 2 ** attempt);
        console.warn(`⚠️ Overpass ${response.status} — retrying in ${Math.round(backoff)}ms`);
        endpointIndex++;
        lastError = new Error(`Overpass API error: ${response.status}`);
        await sleep(backoff);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      }

      // Detect HTML error pages before attempting JSON parse
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json') && !contentType.includes('text/json')) {
        const backoff = jitter(1000 * 2 ** attempt);
        console.warn(`⚠️ Overpass returned non-JSON (${contentType}) — rotating mirror, retrying in ${Math.round(backoff)}ms`);
        endpointIndex++;
        lastError = new Error('Overpass returned non-JSON response');
        await sleep(backoff);
        continue;
      }

      const elements = (await response.json()).elements || [];
      console.log(`📦 Overpass returned ${elements.length} raw elements`);

      const seen     = new Set();
      const shelters = [];
      for (const el of elements) {
        const parsed = parseElement(el);
        if (
          !parsed             ||
          seen.has(parsed.id) ||
          !parsed.latitude    ||
          !parsed.longitude   ||
          !parsed.name        ||
          !parsed.address
        ) continue;
        seen.add(parsed.id);
        shelters.push(parsed);
      }

      console.log(`✅ Parsed ${shelters.length} unique disaster shelters`);
      return shelters;

    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        const backoff = jitter(1000 * 2 ** attempt);
        console.warn(`⚠️ Overpass fetch error — retrying in ${Math.round(backoff)}ms:`, err.message);
        endpointIndex++;
        await sleep(backoff);
      }
    }
  }

  throw lastError || new Error('Overpass fetch failed after retries');
};

// ─── Public API ────────────────────────────────────────────────────────────

export const shelterService = {
  /**
   * Get officially designated disaster/emergency shelters near (lat, lon).
   * Concurrent calls for the same location share a single in-flight request.
   * Firestore permission errors are handled gracefully — falls back to Overpass.
   */
  getNearbyShelters: async (lat, lon, { forceRefresh = false } = {}) => {
    try {
      // Check Firestore cache first (unless force-refreshing)
      if (!forceRefresh) {
        const cached = await getCachedShelters(lat, lon);
        if (cached) {
          return { shelters: cached, coverage: getCoverage(cached.length), fromCache: true };
        }
      }

      // Deduplicate in-flight requests for the same cell
      const key = cellKey(lat, lon);
      if (inFlightRequests.has(key)) {
        console.log(`⏳ Reusing in-flight Overpass request for ${key}`);
        const shelters = await inFlightRequests.get(key);
        return { shelters, coverage: getCoverage(shelters.length), fromCache: false };
      }

      const promise = fetchFromOverpass(lat, lon).finally(() => {
        inFlightRequests.delete(key);
      });
      inFlightRequests.set(key, promise);

      const shelters = await promise;
      cacheShelters(lat, lon, shelters).catch(() => {});
      return { shelters, coverage: getCoverage(shelters.length), fromCache: false };

    } catch (err) {
      console.error('❌ shelterService.getNearbyShelters error:', err);
      return { shelters: [], coverage: 'none', fromCache: false };
    }
  },

  /** Force a live re-fetch from Overpass, replacing the cache. */
  refreshShelters: async (lat, lon) =>
    shelterService.getNearbyShelters(lat, lon, { forceRefresh: true }),

  /** Delete all cached shelter documents from Firestore. */
  clearCache: async () => {
    try {
      const snap  = await getDocs(collection(db, FIRESTORE_COLLECTION));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      console.log(`🗑️ Cleared ${snap.size} cached shelter documents`);
    } catch (err) {
      console.error('❌ shelterService.clearCache error:', err);
    }
  },
};
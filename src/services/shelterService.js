/**
 * shelterService.js
 *
 * Fetches officially designated emergency / disaster shelter locations
 * worldwide using the OpenStreetMap Overpass API (free, no key required),
 * then caches results in Firebase Firestore for offline use.
 *
 * Tag strategy — only OSM tags that explicitly indicate a building is
 * designated or used as an emergency/disaster shelter:
 *
 *   PRIMARY (dedicated emergency shelters):
 *   • amenity=social_facility + social_facility=shelter
 *       – Facilities whose PRIMARY purpose is sheltering people in need.
 *         The canonical OSM tag for permanent emergency shelters.
 *
 *   • emergency:social_facility=shelter
 *       – Used across Japan, Taiwan & Philippines to tag buildings
 *         (schools, community centres, etc.) officially designated by
 *         government as evacuation/disaster shelters.
 *
 *   • emergency:social_facility=displaced_people
 *       – Philippine / Taiwan import tag for shelters specifically for
 *         displaced people after disasters.
 *
 *   ASSEMBLY & EVACUATION (internationally recognised):
 *   • amenity=assembly_point / emergency=assembly_point
 *       – Officially designated safe assembly/muster points.
 *
 *   EXPLICITLY TAGGED DISASTER SHELTERS:
 *   • disaster=shelter
 *   • emergency=shelter
 *
 * What is intentionally EXCLUDED:
 *   – Generic schools, churches, sports centres, community centres, stadiums
 *     (unless they carry one of the specific emergency tags above)
 *   – amenity=shelter alone (covers bus shelters, picnic shelters, etc.)
 *
 * Coverage note:
 *   These specific tags are densest in Japan, Taiwan, Philippines, parts of
 *   the US, and some European countries. For sparse areas the service returns
 *   coverage='limited' or 'none' and the UI prompts users to contact local
 *   emergency services.
 *
 * Return value:
 *   { shelters: Array, coverage: 'good'|'limited'|'none', fromCache: boolean }
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

const OVERPASS_ENDPOINT    = 'https://overpass-api.de/api/interpreter';
const CACHE_TTL_HOURS      = 24;    // re-fetch from OSM every 24 hours
const SEARCH_RADIUS_M      = 20000; // 20 km radius
const MAX_RESULTS          = 100;   // higher cap — official shelters are sparse
const FIRESTORE_COLLECTION = 'shelters';

// Coverage quality thresholds (lower bar than before — these are official shelters)
const COVERAGE_GOOD_THRESHOLD    = 5; // >=5 official shelters → 'good'
const COVERAGE_LIMITED_THRESHOLD = 1; // 1–4 → 'limited', 0 → 'none'

// ─── OSM filter definitions ─────────────────────────────────────────────────
//
// Each entry is either:
//   { key, value }         → single tag (node/way has key=value)
//   { key, value, extra }  → two-tag match (node/way must also have extra.key=extra.value)

const SHELTER_FILTERS = [
  // Dedicated emergency shelter — primary purpose
  {
    key: 'amenity', value: 'social_facility',
    extra: { key: 'social_facility', value: 'shelter' },
  },
  // Japan / Taiwan / Philippines government-designated evacuation shelters
  { key: 'emergency:social_facility', value: 'shelter' },
  { key: 'emergency:social_facility', value: 'displaced_people' },
  // Explicit disaster / emergency shelter tags
  { key: 'disaster',  value: 'shelter' },
  { key: 'emergency', value: 'shelter' },
];

// No type labels shown in the shelter list
const TYPE_LABELS = {};

// ─── Coverage classifier ───────────────────────────────────────────────────

const getCoverage = (count) => {
  if (count >= COVERAGE_GOOD_THRESHOLD)    return 'good';
  if (count >= COVERAGE_LIMITED_THRESHOLD) return 'limited';
  return 'none';
};

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

  // Determine best type label (most specific tag wins)
  // Remove all type labels
  let typeLabel = null;

  // Disaster-specific capacity tags (used in Japanese / Taiwanese datasets)
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
    name:          tags.name || tags['name:en'] || typeLabel,
    type:          typeLabel,
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

const cellKey = (lat, lon) =>
  `${Math.round(lat * 100) / 100}_${Math.round(lon * 100) / 100}`;

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
    console.warn('⚠️ Firestore cache read failed:', err.message);
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
    console.warn('⚠️ Firestore cache write failed:', err.message);
  }
};

// ─── Overpass live fetch ───────────────────────────────────────────────────

const fetchFromOverpass = async (lat, lon) => {
  const url = `${OVERPASS_ENDPOINT}?data=${encodeURIComponent(
    buildOverpassQuery(lat, lon, SEARCH_RADIUS_M)
  )}`;

  console.log(`🌐 Querying Overpass for disaster shelters near (${lat.toFixed(4)}, ${lon.toFixed(4)})…`);

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  const elements = (await response.json()).elements || [];
  console.log(`📦 Overpass returned ${elements.length} raw elements`);

  const seen     = new Set();
  const shelters = [];
  for (const el of elements) {
    const parsed = parseElement(el);
    // Only keep shelters with complete and correct data
    if (
      !parsed ||
      seen.has(parsed.id) ||
      !parsed.latitude ||
      !parsed.longitude ||
      !parsed.name ||
      !parsed.address
    ) continue;
    seen.add(parsed.id);
    shelters.push(parsed);
  }

  console.log(`✅ Parsed ${shelters.length} unique disaster shelters`);
  return shelters;
};

// ─── Public API ────────────────────────────────────────────────────────────

export const shelterService = {
  /**
   * Get officially designated disaster/emergency shelters near (lat, lon).
   * Works globally. Checks Firestore cache first; falls back to Overpass.
   *
   * @param {number} lat
   * @param {number} lon
   * @param {{ forceRefresh?: boolean }} options
   * @returns {Promise<{ shelters: Array, coverage: 'good'|'limited'|'none', fromCache: boolean }>}
   */
  getNearbyShelters: async (lat, lon, { forceRefresh = false } = {}) => {
    try {
      if (!forceRefresh) {
        const cached = await getCachedShelters(lat, lon);
        if (cached) {
          return { shelters: cached, coverage: getCoverage(cached.length), fromCache: true };
        }
      }
      const shelters = await fetchFromOverpass(lat, lon);
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
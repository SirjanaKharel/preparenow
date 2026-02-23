import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Linking,
  Animated,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { storageService } from '../services/storageServices';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { shelterService } from '../services/shelterService';
import { locationService, subscribeToLocationChanges, getDeveloperMode } from '../services/locationService';

// ─── Small reusable components ────────────────────────────────────────────────

const SectionLabel = ({ children }) => (
  <Text style={styles.sectionLabel}>{children}</Text>
);

const Chip = ({ label, color = '#374151', bg = '#F3F4F6' }) => (
  <View style={[styles.chip, { backgroundColor: bg }]}>
    <Text style={[styles.chipText, { color }]}>{label}</Text>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PlanScreen({ navigation }) {
  const mapRef = useRef(null);

  // Plan data
  const [familyMembers, setFamilyMembers]       = useState([]);
  const [primaryMeeting, setPrimaryMeeting]     = useState('Home');
  const [secondaryMeeting, setSecondaryMeeting] = useState('');
  const [uploadedDocs, setUploadedDocs]         = useState([]);

  // Modal visibility
  const [modal, setModal] = useState(null); // 'addMember' | 'editMember' | 'contacts' | 'docs' | 'primaryPt' | 'secondaryPt'
  const [newMember, setNewMember]   = useState({ name: '', relationship: '' });
  const [editMember, setEditMember] = useState(null);
  const [tempLocation, setTempLocation] = useState('');

  // Shelter / map state
  const [userLocation, setUserLocation]       = useState(null);
  const [nearbyShelters, setNearbyShelters]   = useState([]);
  const [selectedShelterId, setSelectedShelterId] = useState(null);
  const [locationError, setLocationError]     = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [shelterSource, setShelterSource]     = useState(null);
  const [shelterCoverage, setShelterCoverage] = useState(null);
  const [isRefreshing, setIsRefreshing]       = useState(false);

  // Pulse animation for user dot
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ─── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadData();
    fetchLocationAndShelters();
  }, []);

  useEffect(() => {
    const unsub = subscribeToLocationChanges(async (coords) => {
      setUserLocation(coords);
      setSelectedShelterId(null);
      await loadSheltersForCoords(coords.latitude, coords.longitude);
      mapRef.current?.animateToRegion(
        { ...coords, latitudeDelta: 0.8, longitudeDelta: 0.8 }, 600
      );
    });
    return () => unsub();
  }, []);

  // ─── Shelter helpers ──────────────────────────────────────────────────────

  const applyShelters = (shelters, lat, lon, coverage, fromCache) => {
    const sorted = shelters
      .map(s => ({ ...s, distance: locationService.calculateDistance(lat, lon, s.latitude, s.longitude) }))
      .sort((a, b) => a.distance - b.distance);
    setNearbyShelters(sorted);
    setShelterSource(fromCache ? 'cache' : 'live');
    setShelterCoverage(coverage);
  };

  const loadSheltersForCoords = async (lat, lon, forceRefresh = false) => {
    try {
      const { shelters, coverage, fromCache } = await shelterService.getNearbyShelters(lat, lon, { forceRefresh });
      applyShelters(shelters, lat, lon, coverage, fromCache);
    } catch {
      setShelterSource('error');
      setShelterCoverage('none');
    }
  };

  const fetchLocationAndShelters = async () => {
    setLocationError(null);
    setIsLoadingLocation(true);
    const devState = getDeveloperMode();
    if (devState.enabled && devState.location) {
      const { latitude, longitude } = devState.location;
      setUserLocation({ latitude, longitude });
      await loadSheltersForCoords(latitude, longitude);
      setIsLoadingLocation(false);
      return;
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Enable in settings to find shelters.');
        setIsLoadingLocation(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setUserLocation({ latitude, longitude });
      await loadSheltersForCoords(latitude, longitude);
    } catch {
      setLocationError('Unable to get current location.');
      setShelterSource('error');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleRefreshShelters = async () => {
    if (!userLocation || isRefreshing) return;
    setIsRefreshing(true);
    setSelectedShelterId(null);
    await loadSheltersForCoords(userLocation.latitude, userLocation.longitude, true);
    setIsRefreshing(false);
  };

  const getMapRegion = () => {
    if (selectedShelterId) {
      const s = nearbyShelters.find(x => x.id === selectedShelterId);
      if (s) return { latitude: s.latitude, longitude: s.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    }
    const points = userLocation ? [userLocation] : [];
    nearbyShelters.slice(0, 5).forEach(s => points.push({ latitude: s.latitude, longitude: s.longitude }));
    if (!points.length) return { latitude: 20, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };
    const lats = points.map(p => p.latitude);
    const lngs = points.map(p => p.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const latPad = Math.max((maxLat - minLat) * 0.4, 0.05);
    const lngPad = Math.max((maxLng - minLng) * 0.4, 0.05);
    return {
      latitude:  (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta:  maxLat - minLat + latPad * 2,
      longitudeDelta: maxLng - minLng + lngPad * 2,
    };
  };

  const handleSelectShelter = (shelter) => {
    const newId = selectedShelterId === shelter.id ? null : shelter.id;
    setSelectedShelterId(newId);
    if (newId && mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude: shelter.latitude, longitude: shelter.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 600
      );
    }
  };

  const handleGetDirections = (shelter) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${shelter.latitude},${shelter.longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open maps.'));
  };

  const formatDistance = (m) => m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;

  // ─── Data helpers ─────────────────────────────────────────────────────────

  const loadData = async () => {
    const [members, primary, secondary, docs] = await Promise.all([
      storageService.get('family_members'),
      storageService.get('primary_meeting_point'),
      storageService.get('secondary_meeting_point'),
      storageService.get('uploaded_docs'),
    ]);
    if (members?.data)  setFamilyMembers(JSON.parse(members.data));
    if (primary?.data)  setPrimaryMeeting(primary.data);
    if (secondary?.data) setSecondaryMeeting(secondary.data);
    if (docs?.data)     setUploadedDocs(JSON.parse(docs.data));
  };

  const addFamilyMember = async () => {
    if (!newMember.name) return Alert.alert('Error', 'Please enter a name');
    const updated = [...familyMembers, { ...newMember, id: Date.now().toString() }];
    setFamilyMembers(updated);
    setNewMember({ name: '', relationship: '' });
    setModal(null);
    await storageService.set('family_members', JSON.stringify(updated));
  };

  const saveEditMember = async () => {
    if (!editMember?.name) return Alert.alert('Error', 'Please enter a name');
    const updated = familyMembers.map(m => m.id === editMember.id ? editMember : m);
    setFamilyMembers(updated);
    setEditMember(null);
    setModal(null);
    await storageService.set('family_members', JSON.stringify(updated));
  };

  const deleteFamilyMember = (id) => {
    Alert.alert('Remove Member', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = familyMembers.filter(m => m.id !== id);
        setFamilyMembers(updated);
        await storageService.set('family_members', JSON.stringify(updated));
      }},
    ]);
  };

  const saveMeetingPoint = async (isPrimary) => {
    const trimmed = tempLocation.trim();
    if (!trimmed) return setModal(null);
    if (isPrimary) {
      setPrimaryMeeting(trimmed);
    } else {
      setSecondaryMeeting(trimmed);
    }
    setTempLocation('');
    setModal(null);
    if (isPrimary) {
      await storageService.set('primary_meeting_point', trimmed);
    } else {
      await storageService.set('secondary_meeting_point', trimmed);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true, copyToCacheDirectory: true });
      if (!result.canceled && result.assets) {
        const updated = [...uploadedDocs, ...result.assets];
        setUploadedDocs(updated);
        await storageService.set('uploaded_docs', JSON.stringify(updated));
      }
    } catch { Alert.alert('Error', 'Could not pick document.'); }
  };

  const removeDocument = (index) => {
    Alert.alert('Remove Document', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = uploadedDocs.filter((_, i) => i !== index);
        setUploadedDocs(updated);
        await storageService.set('uploaded_docs', JSON.stringify(updated));
      }},
    ]);
  };

  // ─── Derived ─────────────────────────────────────────────────────────────

  const selectedShelter = nearbyShelters.find(s => s.id === selectedShelterId);



  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.appLabel}>PREPARENOW</Text>
          <Text style={styles.pageTitle}>Safety Plan</Text>
        </View>

        {/* ── Meeting Points ── */}
        <View style={styles.card}>
          <SectionLabel>MEETING POINTS</SectionLabel>
          <View style={styles.meetingGrid}>
            {/* Primary */}
            <TouchableOpacity
              style={[styles.meetingPoint, styles.meetingPointPrimary]}
              onPress={() => { setTempLocation(primaryMeeting); setModal('primaryPt'); }}
              activeOpacity={0.8}
            >
              <Text style={styles.meetingPointTag}>PRIMARY</Text>
              <Text style={styles.meetingPointLocation}>{primaryMeeting}</Text>
              <Text style={styles.meetingPointEdit}>Tap to edit</Text>
            </TouchableOpacity>

            {/* Secondary */}
            <TouchableOpacity
              style={[styles.meetingPoint, secondaryMeeting ? styles.meetingPointPrimary : styles.meetingPointEmpty]}
              onPress={() => { setTempLocation(secondaryMeeting); setModal('secondaryPt'); }}
              activeOpacity={0.8}
            >
              <Text style={styles.meetingPointTag}>SECONDARY</Text>
              <Text style={[styles.meetingPointLocation, !secondaryMeeting && styles.meetingPointPlaceholder]}>
                {secondaryMeeting || 'Not set'}
              </Text>
              {!secondaryMeeting && <Text style={styles.meetingPointEditEmpty}>Tap to set</Text>}
              {secondaryMeeting && <Text style={styles.meetingPointEdit}>Tap to edit</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Family Members ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <SectionLabel>FAMILY MEMBERS</SectionLabel>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { setNewMember({ name: '', relationship: '' }); setModal('addMember'); }}
            >
              <Text style={styles.addBtnText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {familyMembers.length === 0 ? (
            <Text style={styles.emptyHint}>Add family members so everyone knows the plan.</Text>
          ) : (
            familyMembers.map(member => (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.avatarText}>{member.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  {member.relationship ? <Text style={styles.memberRole}>{member.relationship}</Text> : null}
                </View>
                <View style={styles.memberActions}>
                  <TouchableOpacity onPress={() => { setEditMember(member); setModal('editMember'); }} style={styles.memberActionBtn}>
                    <Text style={styles.memberActionEdit}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteFamilyMember(member.id)} style={styles.memberActionBtn}>
                    <Text style={styles.memberActionDelete}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Emergency Shelters ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <SectionLabel>NEAREST SHELTERS</SectionLabel>
            <TouchableOpacity
              style={[styles.refreshBtn, isRefreshing && styles.refreshBtnDisabled]}
              onPress={handleRefreshShelters}
              disabled={isRefreshing || !userLocation}
            >
              <Text style={styles.refreshBtnText}>{isRefreshing ? 'Refreshing…' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>

          {locationError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{locationError}</Text>
              <TouchableOpacity onPress={fetchLocationAndShelters}>
                <Text style={styles.errorBannerRetry}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {isLoadingLocation ? (
            <View style={styles.loadingRow}>
              <Text style={styles.loadingText}>Finding shelters near you…</Text>
            </View>
          ) : (
            <>
              <MapView
                ref={mapRef}
                style={styles.map}
                region={getMapRegion()}
                showsUserLocation={false}
                mapType="standard"
              >
                {userLocation && (
                  <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }} zIndex={999}>
                    <View style={styles.userDotOuter}>
                      <View style={styles.userDotInner} />
                    </View>
                  </Marker>
                )}
                {nearbyShelters.map((shelter, i) => {
                  const sel = shelter.id === selectedShelterId;
                  const nearest = i === 0 && !!userLocation;
                  return (
                    <Marker
                      key={shelter.id}
                      coordinate={{ latitude: shelter.latitude, longitude: shelter.longitude }}
                      onPress={() => handleSelectShelter(shelter)}
                      zIndex={sel ? 100 : nearest ? 50 : 1}
                    >
                      <View style={[styles.shelterDot, sel && styles.shelterDotSelected, nearest && !sel && styles.shelterDotNearest]}>
                        <Text style={styles.shelterDotText}>{nearest ? '★' : i + 1}</Text>
                      </View>
                    </Marker>
                  );
                })}
              </MapView>

              {/* Shelter rows */}
              {nearbyShelters.length === 0 && shelterCoverage !== null && (
                <Text style={styles.emptyHint}>No shelters found nearby. Try refreshing or contact local emergency services.</Text>
              )}

              {nearbyShelters.map((shelter, i) => {
                const sel = shelter.id === selectedShelterId;
                const nearest = i === 0 && !!userLocation;
                return (
                  <TouchableOpacity
                    key={shelter.id}
                    style={[styles.shelterRow, sel && styles.shelterRowSelected]}
                    onPress={() => handleSelectShelter(shelter)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.shelterRank, sel && styles.shelterRankSelected, nearest && !sel && styles.shelterRankNearest]}>
                      <Text style={[styles.shelterRankText, (sel || nearest) && { color: '#fff' }]}>
                        {nearest ? '★' : i + 1}
                      </Text>
                    </View>
                    <View style={styles.shelterInfo}>
                      <View style={styles.shelterNameRow}>
                        <Text style={[styles.shelterName, sel && styles.shelterNameSelected]} numberOfLines={1}>
                          {shelter.name}
                        </Text>
                        {nearest && <Chip label="Nearest" color="#92400E" bg="#FEF3C7" />}
                      </View>
                      <Text style={styles.shelterAddress} numberOfLines={1}>
                        {shelter.address || 'Address not available'}
                      </Text>
                      {shelter.type ? (
                        <Chip label={shelter.type} color="#1D4ED8" bg="#EFF6FF" />
                      ) : null}
                    </View>
                    <View style={styles.shelterRight}>
                      {userLocation && (
                        <Text style={[styles.shelterDist, nearest && styles.shelterDistNearest]}>
                          {formatDistance(shelter.distance)}
                        </Text>
                      )}
                      <Text style={[styles.shelterChevron, sel && { color: '#2563EB' }]}>
                        {sel ? '▼' : '›'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Inline directions */}
              {selectedShelter && (
                <TouchableOpacity style={styles.directionsBtn} onPress={() => handleGetDirections(selectedShelter)}>
                  <Text style={styles.directionsBtnText}>Get Directions to {selectedShelter.name}</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.osmNote}>© OpenStreetMap contributors · Data may not reflect official emergency rest centres</Text>
            </>
          )}
        </View>

        {/* ── Important Docs ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <SectionLabel>IMPORTANT DOCUMENTS</SectionLabel>
            <TouchableOpacity style={styles.addBtn} onPress={handlePickDocument}>
              <Text style={styles.addBtnText}>+ Upload</Text>
            </TouchableOpacity>
          </View>

          {uploadedDocs.length === 0 ? (
            <Text style={styles.emptyHint}>Upload IDs, insurance, and medical records for quick access.</Text>
          ) : (
            uploadedDocs.map((doc, i) => (
              <View key={i} style={styles.docRow}>
                <View style={styles.docIcon}>
                  <Text style={styles.docIconText}>DOC</Text>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                  {doc.size ? <Text style={styles.docSize}>{(doc.size / 1024).toFixed(1)} KB</Text> : null}
                </View>
                <TouchableOpacity onPress={() => removeDocument(i)} style={styles.memberActionBtn}>
                  <Text style={styles.memberActionDelete}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        {['Home', 'Alerts', 'Prepare', 'Plan', 'Profile'].map(screen => (
          <TouchableOpacity key={screen} style={styles.footerBtn} onPress={() => navigation.navigate(screen)}>
            <Text style={[styles.footerBtnText, screen === 'Plan' && styles.footerBtnActive]}>{screen}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Modals ── */}

      {/* Add member */}
      <Modal visible={modal === 'addMember'} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Family Member</Text>
            <TextInput style={styles.input} placeholder="Name *" value={newMember.name} onChangeText={t => setNewMember({ ...newMember, name: t })} />
            <TextInput style={styles.input} placeholder="Relationship (optional)" value={newMember.relationship} onChangeText={t => setNewMember({ ...newMember, relationship: t })} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setNewMember({ name: '', relationship: '' }); setModal(null); }}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={addFamilyMember}>
                <Text style={styles.modalBtnConfirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit member */}
      <Modal visible={modal === 'editMember'} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit Member</Text>
            <TextInput style={styles.input} placeholder="Name *" value={editMember?.name || ''} onChangeText={t => setEditMember({ ...editMember, name: t })} />
            <TextInput style={styles.input} placeholder="Relationship" value={editMember?.relationship || ''} onChangeText={t => setEditMember({ ...editMember, relationship: t })} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setEditMember(null); setModal(null); }}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={saveEditMember}>
                <Text style={styles.modalBtnConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Primary meeting point */}
      <Modal visible={modal === 'primaryPt'} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Primary Meeting Point</Text>
            <TextInput style={styles.input} placeholder="e.g. Home, Town Hall" value={tempLocation} onChangeText={setTempLocation} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setTempLocation(''); setModal(null); }}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={() => saveMeetingPoint(true)}>
                <Text style={styles.modalBtnConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Secondary meeting point */}
      <Modal visible={modal === 'secondaryPt'} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Secondary Meeting Point</Text>
            <TextInput style={styles.input} placeholder="e.g. Library, Community Centre" value={tempLocation} onChangeText={setTempLocation} />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setTempLocation(''); setModal(null); }}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirm} onPress={() => saveMeetingPoint(false)}>
                <Text style={styles.modalBtnConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F0' },
  scroll:    { paddingBottom: 20 },

  // Header
  header: {
    backgroundColor: '#111827',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl + 24,
    paddingBottom: SPACING.lg,
  },
  appLabel:  { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 2, marginBottom: 4 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },

  // Generic card
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 1.5,
  },
  emptyHint: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },

  // Meeting points
  meetingGrid: { flexDirection: 'row', gap: SPACING.sm },
  meetingPoint: {
    flex: 1,
    borderRadius: 10,
    padding: SPACING.md,
    borderWidth: 1.5,
  },
  meetingPointPrimary:   { backgroundColor: '#111827', borderColor: '#111827' },
  meetingPointEmpty:     { backgroundColor: '#F9FAFB', borderColor: '#D1D5DB', borderStyle: 'dashed' },
  meetingPointTag:       { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6, color: '#9CA3AF' },
  meetingPointLocation:  { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  meetingPointPlaceholder: { color: '#9CA3AF', fontStyle: 'italic' },
  meetingPointEdit:      { fontSize: 10, color: 'rgba(255,255,255,0.45)' },
  meetingPointEditEmpty: { fontSize: 10, color: '#9CA3AF' },

  // Add / refresh buttons
  addBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  refreshBtn: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  refreshBtnDisabled: { opacity: 0.4 },
  refreshBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },

  // Error / loading
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  errorBannerText:  { fontSize: 12, color: '#DC2626', flex: 1 },
  errorBannerRetry: { fontSize: 12, fontWeight: '700', color: '#DC2626', marginLeft: 8 },
  loadingRow:       { paddingVertical: SPACING.lg, alignItems: 'center' },
  loadingText:      { fontSize: 13, color: '#9CA3AF' },

  // Map
  map: { width: '100%', height: 240, borderRadius: 10, marginBottom: SPACING.sm },

  // User location dot
  userDotOuter: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(37,99,235,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(37,99,235,0.4)',
  },
  userDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563EB', borderWidth: 2, borderColor: '#fff' },

  // Shelter markers
  shelterDot: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#6B7280', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  shelterDotNearest:  { backgroundColor: '#D97706', width: 30, height: 30, borderRadius: 15 },
  shelterDotSelected: { backgroundColor: '#DC2626', width: 32, height: 32, borderRadius: 16 },
  shelterDotText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Shelter rows
  shelterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  shelterRowSelected: { backgroundColor: '#F0F9FF', marginHorizontal: -SPACING.md, paddingHorizontal: SPACING.md, borderRadius: 8 },
  shelterRank: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm, flexShrink: 0,
  },
  shelterRankNearest:  { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  shelterRankSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  shelterRankText: { fontSize: 10, fontWeight: '700', color: '#374151' },
  shelterInfo:    { flex: 1, marginRight: SPACING.sm },
  shelterNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  shelterName:    { fontSize: 13, fontWeight: '600', color: '#111827', flexShrink: 1 },
  shelterNameSelected: { color: '#1D4ED8' },
  shelterAddress: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
  shelterRight:   { alignItems: 'flex-end' },
  shelterDist:    { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  shelterDistNearest: { color: '#D97706' },
  shelterChevron: { fontSize: 16, color: '#9CA3AF', marginTop: 2 },

  // Directions
  directionsBtn: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  directionsBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  osmNote: { fontSize: 10, color: '#D1D5DB', textAlign: 'center', marginTop: SPACING.sm },

  // Chip
  chip: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  chipText: { fontSize: 9, fontWeight: '700' },

  // Family members
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  memberAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm,
  },
  avatarText:   { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  memberInfo:   { flex: 1 },
  memberName:   { fontSize: 15, fontWeight: '600', color: '#111827' },
  memberRole:   { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  memberActions:   { flexDirection: 'row', gap: 8 },
  memberActionBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  memberActionEdit:   { fontSize: 12, fontWeight: '600', color: '#2563EB' },
  memberActionDelete: { fontSize: 12, fontWeight: '600', color: '#DC2626' },

  // Docs
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  docIcon: {
    width: 36, height: 36, borderRadius: 6,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm,
  },
  docIconText: { fontSize: 8, fontWeight: '800', color: '#6B7280', letterSpacing: 0.5 },
  docInfo:     { flex: 1 },
  docName:     { fontSize: 13, fontWeight: '600', color: '#111827' },
  docSize:     { fontSize: 11, color: '#9CA3AF', marginTop: 1 },

  // Footer
  footer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: '#111827',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  footerBtn:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm },
  footerBtnText:   { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  footerBtnActive: { color: '#111827', fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.lg,
    width: '88%',
    maxWidth: 400,
  },
  modalTitle:    { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: SPACING.sm },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: SPACING.md,
    fontSize: 15,
    marginBottom: SPACING.sm,
    color: '#111827',
  },
  modalBtns:          { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  modalBtnCancel:     { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalBtnConfirm:    { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#111827' },
  modalBtnConfirmText:{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Contacts
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactRowPriority: { backgroundColor: '#FFF1F2', marginHorizontal: -SPACING.lg, paddingHorizontal: SPACING.lg },
  contactLabel:       { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  contactNumber:      { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  contactNumberEmpty: { color: '#D1D5DB', fontStyle: 'italic', fontWeight: '400', fontSize: 13 },
});
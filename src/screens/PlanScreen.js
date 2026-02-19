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
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import { storageService } from '../services/storageServices';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { shelterService } from '../services/shelterService';
import { locationService, subscribeToLocationChanges, getDeveloperMode } from '../services/locationService';

export default function PlanScreen({ navigation }) {
  const mapRef = useRef(null);

  const [familyMembers, setFamilyMembers] = useState([]);
  const [primaryMeeting, setPrimaryMeeting] = useState('Home');
  const [secondaryMeeting, setSecondaryMeeting] = useState('[Set Location]');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditPrimaryModal, setShowEditPrimaryModal] = useState(false);
  const [showEditSecondaryModal, setShowEditSecondaryModal] = useState(false);
  const [showEmergencyContactsModal, setShowEmergencyContactsModal] = useState(false);
  const [showImportantDocsModal, setShowImportantDocsModal] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', relationship: '' });
  const [editMember, setEditMember] = useState(null);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [tempLocation, setTempLocation] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState([]);

  // Shelter map state
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyShelters, setNearbyShelters] = useState([]);    // live OSM data, sorted by distance
  const [selectedShelterId, setSelectedShelterId] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [shelterSource, setShelterSource] = useState(null);      // 'cache' | 'live' | 'error'
  const [shelterCoverage, setShelterCoverage] = useState(null);  // 'good' | 'limited' | 'none'
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Animated pulse for user-location dot
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const EMERGENCY_CONTACTS = [
    { label: 'Emergency Services', number: '999' },
    { label: 'Police Department', number: '999' },
    { label: 'Fire Department', number: '999' },
    { label: 'NHS 111', number: '111' },
    { label: 'Local Hospital', number: '' },
    { label: 'Family Doctor', number: '' },
    { label: 'Insurance Provider', number: '' },
  ];

  const handleCall = (number) => {
    if (number) Linking.openURL(`tel:${number}`);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets) {
        const newDocs = [...uploadedDocs, ...result.assets];
        setUploadedDocs(newDocs);
        await storageService.set('uploaded_docs', JSON.stringify(newDocs));
      }
    } catch (e) {
      Alert.alert('Error', 'Could not pick document.');
    }
  };

  const removeDocument = async (index) => {
    Alert.alert('Remove Document', 'Are you sure you want to remove this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const newDocs = uploadedDocs.filter((_, i) => i !== index);
          setUploadedDocs(newDocs);
          await storageService.set('uploaded_docs', JSON.stringify(newDocs));
        },
      },
    ]);
  };

  useEffect(() => {
    loadData();
    fetchLocationAndShelters();
  }, []);

  // Keep shelters in sync when DeveloperSettingsScreen updates the test location
  useEffect(() => {
    const unsubscribe = subscribeToLocationChanges(async (newCoords) => {
      console.log('📍 PlanScreen: dev location updated', newCoords);
      setUserLocation(newCoords);
      setSelectedShelterId(null);
      await loadSheltersForCoords(newCoords.latitude, newCoords.longitude);

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          { latitude: newCoords.latitude, longitude: newCoords.longitude, latitudeDelta: 0.8, longitudeDelta: 0.8 },
          600
        );
      }
    });
    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Shelter helpers ───────────────────────────────────────────────────────

  /**
   * Attach haversine distances, sort nearest-first, and persist to state.
   */
  const applyShelters = (shelters, lat, lon, coverage, fromCache) => {
    const withDist = shelters
      .map((s) => ({
        ...s,
        distance: locationService.calculateDistance(lat, lon, s.latitude, s.longitude),
      }))
      .sort((a, b) => a.distance - b.distance);

    setNearbyShelters(withDist);
    setShelterSource(fromCache ? 'cache' : 'live');
    setShelterCoverage(coverage);
  };

  /**
   * Fetch shelters for a given lat/lon from the service (Firestore cache → Overpass).
   * Works for any location in the world.
   */
  const loadSheltersForCoords = async (lat, lon, forceRefresh = false) => {
    try {
      const { shelters, coverage, fromCache } = await shelterService.getNearbyShelters(
        lat, lon, { forceRefresh }
      );
      applyShelters(shelters, lat, lon, coverage, fromCache);
    } catch (err) {
      console.error('❌ loadSheltersForCoords error:', err);
      setShelterSource('error');
      setShelterCoverage('none');
    }
  };

  // ─── Location fetch ────────────────────────────────────────────────────────

  const fetchLocationAndShelters = async () => {
    setLocationError(null);
    setIsLoadingLocation(true);

    // ── Developer mode: use test location immediately ──────────────────────
    const devState = getDeveloperMode();
    if (devState.enabled && devState.location) {
      console.log('🛠️ PlanScreen: using dev test location', devState.location);
      const { latitude, longitude } = devState.location;
      setUserLocation({ latitude, longitude });
      await loadSheltersForCoords(latitude, longitude);
      setIsLoadingLocation(false);
      return;
    }

    // ── Real GPS ───────────────────────────────────────────────────────────
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocationError('Location permission denied. Enable location in settings to find nearby shelters.');
        setIsLoadingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });
      await loadSheltersForCoords(latitude, longitude);
    } catch (error) {
      console.error('Location error:', error);
      setLocationError('Unable to get current location.');
      setShelterSource('error');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const retryLocation = () => fetchLocationAndShelters();

  const handleRefreshShelters = async () => {
    if (!userLocation || isRefreshing) return;
    setIsRefreshing(true);
    setSelectedShelterId(null);
    await loadSheltersForCoords(userLocation.latitude, userLocation.longitude, true);
    setIsRefreshing(false);
  };

  // ─── Map region ────────────────────────────────────────────────────────────

  const getMapRegion = () => {
    // If a shelter is selected, centre on it with zoom
    if (selectedShelterId) {
      const s = nearbyShelters.find((x) => x.id === selectedShelterId);
      if (s) {
        return {
          latitude: s.latitude,
          longitude: s.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
      }
    }

    // Default: fit user + nearest 5 shelters (works globally — no bounds check)
    const points = [];
    if (userLocation) {
      points.push(userLocation);
    }

    const sheltersToFit = nearbyShelters.slice(0, 5);
    sheltersToFit.forEach((s) => points.push({ latitude: s.latitude, longitude: s.longitude }));

    if (points.length === 0) {
      // World centre fallback when no location or shelters available
      return { latitude: 20, longitude: 0, latitudeDelta: 60, longitudeDelta: 60 };
    }

    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latPad = Math.max((maxLat - minLat) * 0.4, 0.05);
    const lngPad = Math.max((maxLng - minLng) * 0.4, 0.05);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: maxLat - minLat + latPad * 2,
      longitudeDelta: maxLng - minLng + lngPad * 2,
    };
  };

  // ─── Shelter selection ─────────────────────────────────────────────────────

  const handleSelectShelter = (shelter) => {
    const newId = selectedShelterId === shelter.id ? null : shelter.id;
    setSelectedShelterId(newId);

    if (newId && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: shelter.latitude,
          longitude: shelter.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        600
      );
    }
  };

  const handleGetDirections = (shelter) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${shelter.latitude},${shelter.longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open maps. Please check if a maps app is installed.')
    );
  };

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadData = async () => {
    const membersResult = await storageService.get('family_members');
    if (membersResult?.data) setFamilyMembers(JSON.parse(membersResult.data));

    const primaryResult = await storageService.get('primary_meeting_point');
    if (primaryResult?.data) setPrimaryMeeting(primaryResult.data);

    const secondaryResult = await storageService.get('secondary_meeting_point');
    if (secondaryResult?.data) setSecondaryMeeting(secondaryResult.data);

    const docsResult = await storageService.get('uploaded_docs');
    if (docsResult?.data) setUploadedDocs(JSON.parse(docsResult.data));
  };

  const addFamilyMember = async () => {
    setShowAddMemberModal(false);
    if (!newMember.name) {
      Alert.alert('Error', 'Please enter a name');
      setShowAddMemberModal(true);
      return;
    }
    const updatedMembers = [...familyMembers, { ...newMember, id: Date.now().toString() }];
    setFamilyMembers(updatedMembers);
    await storageService.set('family_members', JSON.stringify(updatedMembers));
    setNewMember({ name: '', relationship: '' });
  };

  const startEditMember = (member) => {
    setEditMember(member);
    setShowEditMemberModal(true);
  };

  const saveEditMember = async () => {
    if (!editMember.name) { Alert.alert('Error', 'Please enter a name'); return; }
    const updatedMembers = familyMembers.map((m) => (m.id === editMember.id ? editMember : m));
    setFamilyMembers(updatedMembers);
    await storageService.set('family_members', JSON.stringify(updatedMembers));
    setEditMember(null);
    setShowEditMemberModal(false);
  };

  const deleteFamilyMember = async (id) => {
    Alert.alert('Delete Member', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updatedMembers = familyMembers.filter((m) => m.id !== id);
          setFamilyMembers(updatedMembers);
          await storageService.set('family_members', JSON.stringify(updatedMembers));
        },
      },
    ]);
  };

  const updatePrimaryMeeting = async () => {
    const trimmed = tempLocation.trim();
    setShowEditPrimaryModal(false);
    setTempLocation('');
    if (trimmed) {
      setPrimaryMeeting(trimmed);
      await storageService.set('primary_meeting_point', trimmed);
    }
  };

  const updateSecondaryMeeting = async () => {
    const trimmed = tempLocation.trim();
    setShowEditSecondaryModal(false);
    setTempLocation('');
    if (trimmed) {
      setSecondaryMeeting(trimmed);
      await storageService.set('secondary_meeting_point', trimmed);
    }
  };

  // ─── Render helpers ────────────────────────────────────────────────────────

  const formatDistance = (metres) => {
    if (metres < 1000) return `${Math.round(metres)} m`;
    return `${(metres / 1000).toFixed(1)} km`;
  };

  const selectedShelter = nearbyShelters.find((s) => s.id === selectedShelterId);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Plan your Safety</Text>
          <Text style={styles.subtitle}>Manage your family safety plan</Text>
        </View>

        <View style={styles.content}>
          {/* ── Shelter Map Section ── */}
          <View style={styles.sectionCard}>
            {/* Section heading + location status */}
            <View style={styles.shelterHeader}>
              <View>
                <Text style={styles.sectionTitle}>EMERGENCY SHELTERS</Text>
                {userLocation ? (
                  getDeveloperMode().enabled ? (
                    <View style={styles.devBadge}>
                      <Text style={styles.devBadgeText}>🛠 Test location active</Text>
                    </View>
                  ) : (
                    <View style={styles.locationBadge}>
                      <View style={styles.locationDot} />
                      <Text style={styles.locationBadgeText}>
                        {shelterSource === 'live' ? 'Live data · OpenStreetMap' : 'Using your location'}
                      </Text>
                    </View>
                  )
                ) : (
                  <Text style={styles.locationBadgeText}>Location unavailable</Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.refreshBtn, isRefreshing && styles.refreshBtnDisabled]}
                onPress={handleRefreshShelters}
                disabled={isRefreshing || !userLocation}
              >
                <Text style={styles.refreshBtnText}>{isRefreshing ? '…' : '↻ Refresh'}</Text>
              </TouchableOpacity>
            </View>

            {/* Error banner */}
            {locationError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{locationError}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={retryLocation}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {isLoadingLocation ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>
                  {isRefreshing ? '🔄 Fetching live shelter data…' : '📍 Finding shelters near you…'}
                </Text>
              </View>
            ) : (
              <>
                {/* ── Map ── */}
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  region={getMapRegion()}
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                  mapType="standard"
                >
                  {/* User location marker */}
                  {userLocation && (
                    <Marker
                      coordinate={userLocation}
                      anchor={{ x: 0.5, y: 0.5 }}
                      zIndex={999}
                    >
                      <View style={styles.userMarkerOuter}>
                        <View style={styles.userMarkerInner} />
                      </View>
                    </Marker>
                  )}

                  {/* Shelter markers */}
                  {nearbyShelters.map((shelter, index) => {
                    const isSelected = shelter.id === selectedShelterId;
                    const isNearest = index === 0 && userLocation;
                    return (
                      <Marker
                        key={shelter.id}
                        coordinate={{ latitude: shelter.latitude, longitude: shelter.longitude }}
                        title={shelter.name}
                        description={
                          userLocation
                            ? `${shelter.address} · ${formatDistance(shelter.distance)}`
                            : shelter.address
                        }
                        onPress={() => handleSelectShelter(shelter)}
                        zIndex={isSelected ? 100 : isNearest ? 50 : 1}
                      >
                        <View style={[
                          styles.shelterMarker,
                          isSelected && styles.shelterMarkerSelected,
                          isNearest && !isSelected && styles.shelterMarkerNearest,
                        ]}>
                          <Text style={styles.shelterMarkerText}>
                            {isNearest ? '★' : index + 1}
                          </Text>
                        </View>
                      </Marker>
                    );
                  })}
                </MapView>

                {/* ── Selected shelter info bar ── */}
                {selectedShelter && (
                  <View style={styles.selectedBanner}>
                    <View style={styles.selectedBannerInfo}>
                      <Text style={styles.selectedBannerName} numberOfLines={1}>
                        {selectedShelter.name}
                      </Text>
                      <Text style={styles.selectedBannerType}>
                        {selectedShelter.type || 'Emergency Shelter'}
                      </Text>
                      {selectedShelter.address ? (
                        <Text style={styles.selectedBannerAddress} numberOfLines={1}>
                          {selectedShelter.address}
                        </Text>
                      ) : null}
                      {selectedShelter.disasterTypes && selectedShelter.disasterTypes.length > 0 && (
                        <Text style={styles.selectedBannerDisasters} numberOfLines={1}>
                          {selectedShelter.disasterTypes.join(' · ')}
                        </Text>
                      )}
                      {userLocation && (
                        <Text style={styles.selectedBannerDist}>
                          📍 {formatDistance(selectedShelter.distance)} away
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.directionsBtn}
                      onPress={() => handleGetDirections(selectedShelter)}
                    >
                      <Text style={styles.directionsBtnText}>Directions</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ── Nearby shelter list ── */}
                <View style={styles.shelterListContainer}>
                  <Text style={styles.shelterListTitle}>
                    {nearbyShelters.length > 0
                      ? `${nearbyShelters.length} shelter${nearbyShelters.length !== 1 ? 's' : ''} nearby`
                      : 'Shelters'}
                    {shelterSource === 'live' ? ' · Live · OpenStreetMap' : shelterSource === 'cache' ? ' · Cached' : ''}
                  </Text>

                  {/* Coverage: none */}
                  {shelterCoverage === 'none' && (
                    <View style={styles.coverageBox}>
                      <Text style={styles.coverageIcon}>🌐</Text>
                      <View style={styles.coverageTextBlock}>
                        <Text style={styles.coverageTitle}>No shelters found nearby</Text>
                        <Text style={styles.coverageBody}>
                          OpenStreetMap data may be limited in this area. Tap{' '}
                          <Text style={styles.coverageBold}>↻ Refresh</Text> to re-query, or
                          contact your local emergency services for official shelter locations.
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Coverage: limited */}
                  {shelterCoverage === 'limited' && (
                    <View style={[styles.coverageBox, styles.coverageBoxWarning]}>
                      <Text style={styles.coverageIcon}>⚠️</Text>
                      <View style={styles.coverageTextBlock}>
                        <Text style={[styles.coverageTitle, styles.coverageTitleWarning]}>
                          Limited data in this area
                        </Text>
                        <Text style={styles.coverageBody}>
                          Only a few locations were found. Coverage varies by region —
                          always verify with local emergency services.
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Shelter rows */}
                  {nearbyShelters.map((shelter, index) => {
                    const isSelected = shelter.id === selectedShelterId;
                    const isNearest  = index === 0 && userLocation;

                    return (
                      <TouchableOpacity
                        key={shelter.id}
                        style={[
                          styles.shelterListItem,
                          isSelected && styles.shelterListItemSelected,
                        ]}
                        onPress={() => handleSelectShelter(shelter)}
                        activeOpacity={0.7}
                      >
                        {/* Rank badge */}
                        <View style={[
                          styles.rankBadge,
                          isSelected && styles.rankBadgeSelected,
                          isNearest && !isSelected && styles.rankBadgeNearest,
                        ]}>
                          <Text style={[
                            styles.rankBadgeText,
                            (isSelected || isNearest) && styles.rankBadgeTextLight,
                          ]}>
                            {isNearest ? '★' : index + 1}
                          </Text>
                        </View>

                        {/* Info */}
                        <View style={styles.shelterListInfo}>
                          <View style={styles.shelterListNameRow}>
                            <Text style={[
                              styles.shelterListName,
                              isSelected && styles.shelterListNameSelected,
                            ]} numberOfLines={1}>
                              {shelter.name}
                            </Text>
                            {isNearest && (
                              <View style={styles.nearestTag}>
                                <Text style={styles.nearestTagText}>Nearest</Text>
                              </View>
                            )}
                          </View>
                          {/* Type tag */}
                          <View style={styles.shelterTypePill}>
                            <Text style={styles.shelterTypePillText}>
                              🏚 {shelter.type || 'Emergency Shelter'}
                            </Text>
                          </View>
                          {/* Address */}
                          <Text style={styles.shelterListAddress} numberOfLines={1}>
                            {shelter.address || 'Address not available'}
                          </Text>
                          {/* Disaster types (e.g. Flood, Earthquake) */}
                          {shelter.disasterTypes && shelter.disasterTypes.length > 0 && (
                            <Text style={styles.shelterDisasterTypes} numberOfLines={1}>
                              🌊🌍 {shelter.disasterTypes.join(' · ')}
                            </Text>
                          )}
                        </View>

                        {/* Distance + chevron */}
                        <View style={styles.shelterListRight}>
                          {userLocation && (
                            <Text style={[
                              styles.shelterListDist,
                              isNearest && styles.shelterListDistNearest,
                            ]}>
                              {formatDistance(shelter.distance)}
                            </Text>
                          )}
                          <Text style={[
                            styles.shelterListChevron,
                            isSelected && styles.shelterListChevronSelected,
                          ]}>
                            {isSelected ? '▼' : '›'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Directions button shown below selected item */}
                  {selectedShelter && (
                    <TouchableOpacity
                      style={styles.inlineDirectionsBtn}
                      onPress={() => handleGetDirections(selectedShelter)}
                    >
                      <Text style={styles.inlineDirectionsBtnText}>
                        🗺 Get Directions to {selectedShelter.name}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* OSM attribution — required by ODbL licence */}
                  <Text style={styles.osmAttribution}>
                    © OpenStreetMap contributors · Data may not reflect official emergency rest centres
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* ── Family Members Section ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>FAMILY MEMBERS</Text>
              <TouchableOpacity
                style={styles.addCircleButton}
                onPress={() => {
                  setNewMember({ name: '', relationship: '' });
                  setShowAddMemberModal(true);
                }}
                accessibilityLabel="Add family member"
              >
                <View style={styles.circle}>
                  <Text style={styles.circleText}>+</Text>
                </View>
              </TouchableOpacity>
            </View>
            {familyMembers.length === 0 ? (
              <Text style={styles.emptyText}>No family members added yet.</Text>
            ) : (
              familyMembers.map((member) => (
                <View key={member.id} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.avatarText}>
                      {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    {member.relationship ? <Text style={styles.memberRelation}>{member.relationship}</Text> : null}
                  </View>
                  <View style={styles.memberActions}>
                    <TouchableOpacity onPress={() => startEditMember(member)} style={styles.editIconButton}>
                      <Text style={styles.editIcon}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteFamilyMember(member.id)} style={styles.deleteButton}>
                      <Text style={styles.deleteText}>×</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* ── Meeting Points Section ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>MEETING POINTS</Text>
            <View style={styles.meetingCard}>
              <View style={styles.meetingRow}>
                <View style={styles.meetingInfo}>
                  <Text style={styles.meetingLabel}>Primary</Text>
                  <Text style={styles.meetingLocation}>{primaryMeeting}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => { setTempLocation(primaryMeeting); setShowEditPrimaryModal(true); }}
                >
                  <Text style={styles.editButton}>Edit</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.meetingRow, styles.meetingRowLast]}>
                <View style={styles.meetingInfo}>
                  <Text style={styles.meetingLabel}>Secondary</Text>
                  <Text style={[styles.meetingLocation, secondaryMeeting === '[Set Location]' && styles.placeholderText]}>
                    {secondaryMeeting}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setTempLocation(secondaryMeeting === '[Set Location]' ? '' : secondaryMeeting);
                    setShowEditSecondaryModal(true);
                  }}
                >
                  <Text style={styles.editButton}>{secondaryMeeting === '[Set Location]' ? 'Set' : 'Edit'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Resources Section ── */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>RESOURCES</Text>
            <View style={styles.resourcesCard}>
              <TouchableOpacity style={styles.resourceRow} onPress={() => setShowEmergencyContactsModal(true)}>
                <Text style={styles.resourceText}>Emergency Contacts</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.resourceRow} onPress={() => setShowImportantDocsModal(true)}>
                <Text style={styles.resourceText}>Important Docs</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        {['Home', 'Alerts', 'Prepare', 'Plan', 'Profile'].map((screen) => (
          <TouchableOpacity
            key={screen}
            style={styles.footerButton}
            onPress={() => navigation.navigate(screen)}
          >
            <Text style={[styles.footerButtonText, screen === 'Plan' && styles.footerButtonActive]}>
              {screen}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Emergency Contacts Modal ── */}
      <Modal visible={showEmergencyContactsModal} transparent animationType="slide" onRequestClose={() => setShowEmergencyContactsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Emergency Contacts</Text>
            <Text style={styles.subtitle}>Tap to call.</Text>
            <ScrollView style={{ marginBottom: 16 }}>
              {EMERGENCY_CONTACTS.map((contact, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.contactCard}
                  onPress={() => handleCall(contact.number)}
                  disabled={!contact.number}
                >
                  <Text style={styles.contactLabel}>{contact.label}</Text>
                  <Text style={styles.contactNumber}>{contact.number || 'Add number'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.tip}>Tip: Add your own important contacts here for quick access.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setShowEmergencyContactsModal(false)}>
                <Text style={styles.modalButtonTextCancel}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Important Docs Modal ── */}
      <Modal visible={showImportantDocsModal} transparent animationType="slide" onRequestClose={() => setShowImportantDocsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Important Documents</Text>
            <Text style={styles.subtitle}>Upload and keep your important documents handy.</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={handlePickDocument}>
              <Text style={styles.uploadButtonText}>+ Upload File</Text>
            </TouchableOpacity>
            <ScrollView style={{ marginBottom: 16, maxHeight: 300 }}>
              {uploadedDocs.length === 0 ? (
                <Text style={styles.emptyText}>No documents uploaded yet.</Text>
              ) : (
                uploadedDocs.map((doc, idx) => (
                  <View key={idx} style={styles.docCard}>
                    <View style={styles.docInfo}>
                      <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                      <Text style={styles.docSize}>{doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : ''}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeDocument(idx)} style={styles.deleteButton}>
                      <Text style={styles.deleteText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setShowImportantDocsModal(false)}>
                <Text style={styles.modalButtonTextCancel}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add Family Member Modal ── */}
      <Modal visible={showAddMemberModal} transparent animationType="slide" onRequestClose={() => setShowAddMemberModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Family Member</Text>
            <TextInput style={styles.input} placeholder="Name" value={newMember.name} onChangeText={(text) => setNewMember({ ...newMember, name: text })} />
            <TextInput style={styles.input} placeholder="Relationship (optional)" value={newMember.relationship} onChangeText={(text) => setNewMember({ ...newMember, relationship: text })} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => { setNewMember({ name: '', relationship: '' }); setShowAddMemberModal(false); }}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonAdd]} onPress={addFamilyMember}>
                <Text style={styles.modalButtonTextAdd}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Family Member Modal ── */}
      <Modal visible={showEditMemberModal} transparent animationType="slide" onRequestClose={() => setShowEditMemberModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Family Member</Text>
            <TextInput style={styles.input} placeholder="Name" value={editMember?.name || ''} onChangeText={(text) => setEditMember({ ...editMember, name: text })} />
            <TextInput style={styles.input} placeholder="Relationship (optional)" value={editMember?.relationship || ''} onChangeText={(text) => setEditMember({ ...editMember, relationship: text })} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => { setEditMember(null); setShowEditMemberModal(false); }}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonAdd]} onPress={saveEditMember}>
                <Text style={styles.modalButtonTextAdd}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Primary Meeting Point Modal ── */}
      <Modal visible={showEditPrimaryModal} transparent animationType="slide" onRequestClose={() => setShowEditPrimaryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Primary Meeting Point</Text>
            <TextInput style={styles.input} placeholder="Location" value={tempLocation} onChangeText={setTempLocation} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => { setTempLocation(''); setShowEditPrimaryModal(false); }}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonAdd]} onPress={updatePrimaryMeeting}>
                <Text style={styles.modalButtonTextAdd}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Secondary Meeting Point Modal ── */}
      <Modal visible={showEditSecondaryModal} transparent animationType="slide" onRequestClose={() => setShowEditSecondaryModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Secondary Meeting Point</Text>
            <TextInput style={styles.input} placeholder="Location" value={tempLocation} onChangeText={setTempLocation} />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => { setTempLocation(''); setShowEditSecondaryModal(false); }}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonAdd]} onPress={updateSecondaryMeeting}>
                <Text style={styles.modalButtonTextAdd}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },
  header: {
    padding: SPACING.lg,
    paddingTop: SPACING.xxl + 20,
    backgroundColor: '#FFFFFF',
  },
  title: { ...TYPOGRAPHY.h1, color: COLORS.text, fontSize: 28, fontWeight: '700' },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginTop: SPACING.xs, fontSize: 16 },
  content: { padding: SPACING.lg },

  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
    padding: SPACING.md,
    ...SHADOWS.card,
  },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: SPACING.md,
    fontSize: 12,
  },

  // ── Shelter header ──
  shelterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  locationBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  locationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  locationBadgeText: { fontSize: 11, color: COLORS.textSecondary },
  devBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
    alignSelf: 'flex-start',
  },
  devBadgeText: { fontSize: 10, color: '#92400E', fontWeight: '700' },
  refreshBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  refreshBtnText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  refreshBtnDisabled: { opacity: 0.4 },

  // ── Error / loading ──
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  },
  errorText: { color: '#DC2626', textAlign: 'center', marginBottom: SPACING.sm, fontSize: 13 },
  retryButton: { backgroundColor: '#DC2626', paddingVertical: 6, paddingHorizontal: 14, borderRadius: BORDER_RADIUS.sm },
  retryButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  loadingContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  loadingText: { color: COLORS.textSecondary, textAlign: 'center' },

  // ── Map ──
  map: {
    width: '100%',
    height: 300,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },

  // Custom user location marker
  userMarkerOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(37,99,235,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(37,99,235,0.4)',
  },
  userMarkerInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#fff',
  },

  // Shelter map markers
  shelterMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  shelterMarkerNearest: { backgroundColor: '#F59E0B', width: 32, height: 32, borderRadius: 16 },
  shelterMarkerSelected: { backgroundColor: COLORS.primary || '#DC2626', width: 34, height: 34, borderRadius: 17 },
  shelterMarkerText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // ── Selected shelter banner ──
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  selectedBannerInfo: { flex: 1 },
  selectedBannerName: { fontWeight: '700', fontSize: 14, color: COLORS.text },
  selectedBannerType: { fontSize: 11, fontWeight: '600', color: '#2563EB', marginTop: 1 },
  selectedBannerDisasters: { fontSize: 11, color: '#DC2626', fontWeight: '600', marginTop: 1 },
  selectedBannerAddress: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  selectedBannerDist: { fontSize: 12, color: '#2563EB', fontWeight: '600', marginTop: 2 },
  directionsBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.sm,
  },
  directionsBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // ── Shelter list ──
  shelterListContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  shelterListTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    textTransform: 'uppercase',
  },
  shelterListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#fff',
  },
  shelterListItemSelected: {
    backgroundColor: '#EFF6FF',
  },

  // Rank badge
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    flexShrink: 0,
  },
  rankBadgeNearest: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  rankBadgeSelected: { backgroundColor: COLORS.primary || '#2563EB', borderColor: COLORS.primary || '#2563EB' },
  rankBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  rankBadgeTextLight: { color: '#fff' },

  shelterListInfo: { flex: 1, marginRight: SPACING.sm },
  shelterListNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  shelterListName: { fontSize: 13, fontWeight: '600', color: COLORS.text, flexShrink: 1 },
  shelterListNameSelected: { color: '#1D4ED8' },
  shelterListAddress: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  nearestTag: {
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  nearestTagText: { fontSize: 9, fontWeight: '700', color: '#92400E', textTransform: 'uppercase' },

  shelterListRight: { alignItems: 'flex-end' },
  shelterListDist: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  shelterListDistNearest: { color: '#D97706' },
  shelterListChevron: { fontSize: 18, color: COLORS.textSecondary, marginTop: 2 },
  shelterListChevronSelected: { color: '#2563EB' },

  inlineDirectionsBtn: {
    margin: SPACING.md,
    backgroundColor: '#2563EB',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  inlineDirectionsBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // ── Coverage messages ──
  coverageBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F9FF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  coverageBoxWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  coverageIcon: { fontSize: 20, marginTop: 1 },
  coverageTextBlock: { flex: 1 },
  coverageTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 3,
  },
  coverageTitleWarning: { color: '#92400E' },
  coverageBody: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  coverageBold: { fontWeight: '700', color: COLORS.text },

  // ── OSM attribution ──
  // ── Shelter type pill ──
  shelterTypePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  shelterTypePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  shelterDisasterTypes: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 2,
  },

  osmAttribution: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    opacity: 0.7,
  },

  // ── Family members ──
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  addCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  emptyText: { color: COLORS.textSecondary, fontStyle: 'italic', textAlign: 'center', marginVertical: SPACING.md },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  memberInfo: { flex: 1 },
  memberActions: { flexDirection: 'row', alignItems: 'center', marginLeft: SPACING.md },
  editIconButton: { padding: SPACING.sm, marginRight: 2 },
  editIcon: { fontSize: 20, color: COLORS.primary, fontWeight: '700' },
  deleteButton: { padding: SPACING.sm },
  deleteText: { fontSize: 28, color: COLORS.textSecondary, fontWeight: '300' },
  memberName: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '600', fontSize: 16 },
  memberRelation: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 2 },

  // ── Meeting points ──
  meetingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
    padding: SPACING.md,
  },
  meetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  meetingRowLast: { borderBottomWidth: 0 },
  meetingInfo: { flex: 1 },
  meetingLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, fontSize: 14, marginBottom: 4 },
  meetingLocation: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '600', fontSize: 16 },
  placeholderText: { color: COLORS.textSecondary },
  editButton: { ...TYPOGRAPHY.body, color: COLORS.primary, fontWeight: '600', textDecorationLine: 'underline', fontSize: 14 },

  // ── Resources ──
  resourcesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
  },
  resourceRow: { padding: SPACING.md },
  resourceText: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '600', fontSize: 16 },
  divider: { height: 1, backgroundColor: COLORS.border },

  // ── Footer ──
  footer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: COLORS.text,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  footerButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm },
  footerButtonText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, fontWeight: '600', fontSize: 12 },
  footerButtonActive: { color: COLORS.text, fontWeight: '700' },

  // ── Modals ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, width: '85%', maxWidth: 400 },
  modalTitle: { ...TYPOGRAPHY.h3, color: COLORS.text, marginBottom: SPACING.md, textAlign: 'center' },
  input: {
    ...TYPOGRAPHY.body,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    fontSize: 16,
  },
  modalButtons: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  modalButton: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  modalButtonAdd: { backgroundColor: COLORS.primary },
  modalButtonTextCancel: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '600' },
  modalButtonTextAdd: { ...TYPOGRAPHY.body, color: '#FFFFFF', fontWeight: '600' },

  contactCard: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactLabel: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '600', fontSize: 16 },
  contactNumber: { ...TYPOGRAPHY.body, color: COLORS.primary, fontWeight: '700', fontSize: 16 },
  tip: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: SPACING.lg, textAlign: 'center' },

  docCard: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docInfo: { flex: 1, marginRight: SPACING.sm },
  docName: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '600', fontSize: 14 },
  docSize: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 2, fontSize: 12 },

  uploadButton: { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginVertical: SPACING.md },
  uploadButtonText: { ...TYPOGRAPHY.body, color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
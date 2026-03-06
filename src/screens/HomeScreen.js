import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  locationService,
  subscribeToDisasterZones,
  unsubscribeFromDisasterZones,
  subscribeToLocationChanges,
} from '../services/locationService';
import { useApp } from '../context/AppContext';
import { PREPAREDNESS_TASKS, TOTAL_TASKS } from '../constants/tasks';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const EMERGENCY_CONTACTS = [
  { label: 'Emergency Services', number: '999' },
  { label: 'NHS 111',            number: '111' },
  { label: 'Non-Emergency',      number: '101' },
];

const SEVERITY_CONFIG = {
  HIGH:   { color: '#DC2626', label: 'HIGH' },
  MEDIUM: { color: '#F59E0B', label: 'MED'  },
  LOW:    { color: '#10B981', label: 'LOW'  },
};

const ZONE_RADIUS_KM = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getPreparednessLabel = (pct) => {
  if (pct >= 80) return { label: 'Well Prepared',  color: '#10B981' };
  if (pct >= 50) return { label: 'Getting Ready',  color: '#F59E0B' };
  if (pct > 0)   return { label: 'In Progress',    color: '#F59E0B' };
  return               { label: 'Needs Attention', color: '#DC2626' };
};

const buildAlerts = (nearbyZones) => {
  const seenKeys = new Set();
  return nearbyZones
    .filter(zone => zone.distance < ZONE_RADIUS_KM * 1000)
    .map(zone => ({
      id:           zone.id,
      type:         zone.title || zone.disasterType,
      location:     zone.description || zone.title,
      distance:     (zone.distance / 1000).toFixed(1),
      severity:     zone.isInside ? 'HIGH' : zone.distance < 1000 ? 'MEDIUM' : 'LOW',
      disasterType: zone.disasterType,
      isInside:     zone.isInside,
      title:        zone.title,
    }))
    .filter(alert => {
      const key = `${alert.type}-${alert.disasterType}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .sort((a, b) => {
      if (a.isInside !== b.isInside) return a.isInside ? -1 : 1;
      return parseFloat(a.distance) - parseFloat(b.distance);
    });
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const AlertCard = ({ alert }) => {
  const cfg = SEVERITY_CONFIG[alert.severity] || {};
  return (
    <View style={[styles.alertCard, alert.isInside && styles.alertCardInside]}>
      {alert.isInside && (
        <View style={styles.insideStripe}>
          <Text style={styles.insideStripeText}>YOU ARE INSIDE THIS ZONE</Text>
        </View>
      )}
      <View style={styles.alertCardBody}>
        <View style={styles.alertLeft}>
          <View style={styles.alertInfo}>
            <Text style={styles.alertTitle} numberOfLines={1}>{alert.type}</Text>
            <Text style={styles.alertLocation} numberOfLines={1}>{alert.location}</Text>
          </View>
        </View>
        <View style={styles.alertRight}>
          <View style={[styles.severityBadge, { backgroundColor: cfg.color || '#374151' }]}>
            <Text style={styles.severityText}>{cfg.label || alert.severity}</Text>
          </View>
          <Text style={styles.alertDistance}>
            {alert.isInside ? 'INSIDE' : `${alert.distance} km`}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const {
    user,
    monitoringActive, setMonitoringActive,
    currentLocation,  setCurrentLocation,
    completedTasks,
  } = useApp();

  const [nearbyZones, setNearbyZones] = useState([]);
  const [liveAlerts,  setLiveAlerts]  = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);

  const completedCount = completedTasks
    ? completedTasks.filter(id => PREPAREDNESS_TASKS.some(t => t.id === id)).length
    : 0;
  const preparednessLevel = TOTAL_TASKS > 0
    ? Math.round((completedCount / TOTAL_TASKS) * 100)
    : 0;
  const { label: prepLabel, color: prepColor } = getPreparednessLabel(preparednessLevel);

  const updateNearbyZones = useCallback(async (coords) => {
    const zones = await locationService.getNearbyZones(coords);
    setNearbyZones(zones);
  }, []);

  const loadLocation = useCallback(async () => {
    const result = await locationService.getCurrentLocation();
    if (result.success) {
      setCurrentLocation(result.location.coords);
      updateNearbyZones(result.location.coords);
    }
  }, [updateNearbyZones]);

  const checkZonesAndUpdate = useCallback(async () => {
    const result = await locationService.manualCheckZones();
    if (result.success && result.zonesTriggered.length > 0) {
      await loadLocation();
    }
  }, [loadLocation]);

  useEffect(() => {
    setLiveAlerts(buildAlerts(nearbyZones));
  }, [nearbyZones]);

  useEffect(() => {
    const unsubscribe = subscribeToDisasterZones(() => {
      if (currentLocation) updateNearbyZones(currentLocation);
    });
    return () => unsubscribeFromDisasterZones();
  }, [currentLocation]);

  useEffect(() => {
    if (!monitoringActive) return;
    checkZonesAndUpdate();
    const interval = setInterval(checkZonesAndUpdate, 120000);
    return () => clearInterval(interval);
  }, [monitoringActive]);

  useEffect(() => {
    const unsub = subscribeToLocationChanges(async (coords) => {
      setCurrentLocation(coords);
      await updateNearbyZones(coords);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    initializeMonitoring();
  }, []);

  const initializeMonitoring = async () => {
    if (monitoringActive) { await loadLocation(); return; }
    setLoading(true);
    const permResult = await locationService.requestPermissions();
    if (permResult.success) {
      const locResult = await locationService.getCurrentLocation();
      if (!locResult.success && locResult.isSimulatorError) {
        Alert.alert(
          'No Location Available',
          'Simulator has no GPS.\n\nGo to Developer Settings to set a test position.',
          [{ text: 'OK' }, { text: 'Dev Settings', onPress: () => navigation.navigate('Profile') }]
        );
      } else if (locResult.success) {
        setCurrentLocation(locResult.location.coords);
        updateNearbyZones(locResult.location.coords);
      }
      const monResult = await locationService.startMonitoring();
      if (monResult.success) setMonitoringActive(true);
    } else {
      Alert.alert('Permission Required', permResult.error);
    }
    setLoading(false);
  };

  const handleStartMonitoring = async () => {
    const permResult = await locationService.requestPermissions();
    if (!permResult.success) { Alert.alert('Permission Required', permResult.error); return; }
    setLoading(true);
    const result = await locationService.startMonitoring();
    setLoading(false);
    if (result.success) { setMonitoringActive(true); loadLocation(); }
    else Alert.alert('Error', result.error);
  };

  const handleCall = (contact) => {
    Alert.alert(
      `Call ${contact.label}`,
      `Dial ${contact.number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Call ${contact.number}`, style: 'destructive', onPress: () => Linking.openURL(`tel:${contact.number}`) },
      ]
    );
  };

  // ── FIXED: onRefresh now has its proper async function declaration ──
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadLocation(), checkZonesAndUpdate()]);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.appLabel}>PREPARENOW</Text>
          <Text style={styles.pageTitle}>Welcome back{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}</Text>
          <Text style={styles.pageSubtitle}>Stay safe, stay prepared</Text>
        </View>

        {/* ── Emergency Contacts ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>EMERGENCY CONTACTS</Text>
          <View style={styles.contactsRow}>
            {EMERGENCY_CONTACTS.map(c => (
              <TouchableOpacity
                key={c.number}
                style={styles.contactBtn}
                onPress={() => handleCall(c)}
                activeOpacity={0.75}
              >
                <Text style={styles.contactNumber}>{c.number}</Text>
                <Text style={styles.contactLabel}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Preparedness Card ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>PREPAREDNESS STATUS</Text>
          <View style={styles.prepRow}>
            <Text style={styles.prepPct}>{preparednessLevel}%</Text>
            <View style={styles.prepMeta}>
              <View style={[styles.prepBadge, { backgroundColor: prepColor }]}>
                <Text style={styles.prepBadgeText}>{prepLabel}</Text>
              </View>
              <Text style={styles.prepCount}>{completedCount} / {TOTAL_TASKS} tasks</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${preparednessLevel}%`, backgroundColor: prepColor }]} />
          </View>
          <TouchableOpacity style={styles.darkBtn} onPress={() => navigation.navigate('Prepare')} activeOpacity={0.85}>
            <Text style={styles.darkBtnText}>
              {preparednessLevel === 0 ? 'Start Preparing' : preparednessLevel === 100 ? 'View All Tasks' : 'Continue Preparing'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Live Alerts ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionLabel}>LIVE ALERTS</Text>
            {liveAlerts.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{liveAlerts.length}</Text>
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="small" color="#111827" style={{ marginVertical: SPACING.lg }} />
          ) : liveAlerts.length > 0 ? (
            liveAlerts.map(alert => <AlertCard key={alert.id} alert={alert} />)
          ) : (
            <Text style={styles.emptyHint}>
              {monitoringActive ? 'No active alerts nearby' : 'Enable monitoring to see alerts'}
            </Text>
          )}

          {!monitoringActive && (
            <View style={styles.monitoringBanner}>
              <View style={styles.monitoringInfo}>
                <Text style={styles.monitoringTitle}>Monitoring Off</Text>
                <Text style={styles.monitoringSubtitle}>Enable to receive disaster alerts</Text>
              </View>
              <TouchableOpacity style={styles.darkBtn} onPress={handleStartMonitoring} disabled={loading}>
                <Text style={styles.darkBtnText}>{loading ? '…' : 'Enable'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
          <View style={styles.actionsGrid}>
            {[
              { label: 'Find Shelter',       screen: 'Plan'    },
              { label: 'View Alerts',        screen: 'Alerts'  },
              { label: 'Meeting Points',     screen: 'Plan'    },
              { label: 'My Tasks',           screen: 'Prepare' },
            ].map(item => (
              <TouchableOpacity
                key={item.label}
                style={styles.actionBtn}
                onPress={() => navigation.navigate(item.screen)}
                activeOpacity={0.75}
              >
                <Text style={styles.actionBtnText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        {['Home', 'Alerts', 'Prepare', 'Plan', 'Profile'].map(screen => (
          <TouchableOpacity key={screen} style={styles.footerBtn} onPress={() => navigation.navigate(screen)}>
            <Text style={[styles.footerBtnText, screen === 'Home' && styles.footerBtnActive]}>{screen}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
    borderBottomWidth: 3,
    borderBottomColor: '#DC2626',
  },
  appLabel:     { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 2, marginBottom: 6 },
  pageTitle:    { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
  pageSubtitle: { fontSize: 13, color: '#6B7280' },

  // Card
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
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
  sectionLabel:  { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 1.5, marginBottom: SPACING.md },
  emptyHint:     { fontSize: 13, color: '#9CA3AF', paddingVertical: SPACING.sm },

  // Preparedness
  prepRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  prepPct:       { fontSize: 44, fontWeight: '800', color: '#111827', lineHeight: 48 },
  prepMeta:      { alignItems: 'flex-end', gap: 6 },
  prepBadge:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  prepBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  prepCount:     { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  progressTrack: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginBottom: SPACING.md },
  progressFill:  { height: '100%', borderRadius: 3 },

  // Dark button
  darkBtn:     { backgroundColor: '#111827', padding: SPACING.md, borderRadius: 10, alignItems: 'center' },
  darkBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Count badge
  countBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginBottom: SPACING.md,
  },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Alert cards
  alertCard:        { borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: SPACING.sm, overflow: 'hidden', backgroundColor: '#fff' },
  alertCardInside:  { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  insideStripe:     { backgroundColor: '#DC2626', paddingVertical: 5, paddingHorizontal: SPACING.md },
  insideStripeText: { color: '#fff', fontWeight: '700', fontSize: 10, letterSpacing: 0.5 },
  alertCardBody:    { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  alertLeft:        { flex: 1 },
  alertInfo:        {},
  alertTitle:       { fontSize: 14, fontWeight: '700', color: '#111827' },
  alertLocation:    { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  alertRight:       { alignItems: 'flex-end', gap: 4 },
  severityBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  severityText:     { color: '#fff', fontSize: 10, fontWeight: '700' },
  alertDistance:    { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },

  // Monitoring banner
  monitoringBanner:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', padding: SPACING.md, marginTop: SPACING.sm, gap: SPACING.md },
  monitoringInfo:      { flex: 1 },
  monitoringTitle:     { fontSize: 14, fontWeight: '700', color: '#111827' },
  monitoringSubtitle:  { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // Emergency contacts
  contactsRow:   { flexDirection: 'row', gap: SPACING.sm },
  contactBtn:    { flex: 1, backgroundColor: '#111827', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  contactNumber: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  contactLabel:  { fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: '600', letterSpacing: 0.5 },

  // Quick actions grid
  actionsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  actionBtn:     { width: '48%', backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', padding: SPACING.md, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'center' },

  // Footer
  footer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: '#111827',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  footerBtn:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm },
  footerBtnText:   { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  footerBtnActive: { color: '#111827', fontWeight: '700' },
});
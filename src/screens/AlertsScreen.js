import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { locationService } from '../services/locationService';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants/theme';
import { SAFETY_GUIDES } from '../constants/resources';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: { color: '#DC2626', label: 'CRITICAL' },
  high:     { color: '#EA580C', label: 'HIGH'     },
  warning:  { color: '#D97706', label: 'WARNING'  },
  info:     { color: '#2563EB', label: 'INFO'     },
};

const DISASTER_KEYWORDS = {
  fire:       ['fire', 'wildfire', 'blaze'],
  flood:      ['flood', 'flooding', 'flash flood'],
  storm:      ['storm', 'hurricane', 'tornado', 'cyclone'],
  earthquake: ['earthquake', 'seismic', 'eq', 'tremor'],
  evacuation: ['evacuation', 'evacuate'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const resolveDisasterType = (item) => {
  if (item.disasterType) return item.disasterType.toLowerCase();
  const search = `${item.type || ''} ${item.title || ''}`.toLowerCase();
  for (const [type, keywords] of Object.entries(DISASTER_KEYWORDS)) {
    if (keywords.some(k => search.includes(k))) return type;
  }
  return null;
};

const getTimeAgo = (timestamp) => {
  const diffMins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (diffMins < 1)  return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
};

const getSafetySteps = (type) => {
  if (!type) return [];
  const guide = SAFETY_GUIDES?.find(g => g.type === type);
  return guide ? guide.sections.flatMap(s => s.steps) : [];
};

const FALLBACK_STEPS = [
  'Follow official guidance from local authorities.',
  'Stay calm and keep others informed.',
  'Contact emergency services (999) if in immediate danger.',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const CriticalCard = ({ alert, onViewSteps }) => {
  const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.high;
  return (
    <View style={[styles.criticalCard, { borderColor: cfg.color }]}>
      <View style={[styles.criticalStripe, { backgroundColor: cfg.color }]}>
        <Text style={styles.criticalStripeText}>ACTIVE ZONE ALERT · {cfg.label}</Text>
        <Text style={styles.criticalStripeTime}>{alert.time}</Text>
      </View>
      <View style={styles.criticalBody}>
        <Text style={styles.criticalTitle} numberOfLines={2}>{alert.title}</Text>
        {!!alert.description && (
          <Text style={styles.criticalDesc}>{alert.description}</Text>
        )}
        <TouchableOpacity
          style={[styles.stepsBtn, { backgroundColor: cfg.color }]}
          onPress={() => onViewSteps(alert)}
          activeOpacity={0.85}
        >
          <Text style={styles.stepsBtnText}>View Safety Steps</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const RecentRow = ({ alert }) => (
  <View style={[styles.recentRow, alert.isExit && styles.recentRowExit]}>
    <View style={[styles.recentDot, alert.isExit && styles.recentDotExit]} />
    <Text style={[styles.recentTitle, alert.isExit && styles.recentTitleExit]} numberOfLines={1}>
      {alert.title}
    </Text>
    <Text style={styles.recentTime}>{alert.time}</Text>
  </View>
);

const SafetyModal = ({ visible, title, steps, onClose }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalSheet}>
        <View style={styles.modalHandle} />
        <Text style={styles.modalTitle}>{title}</Text>
        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </ScrollView>
        <Pressable style={styles.modalCloseBtn} onPress={onClose}>
          <Text style={styles.modalCloseBtnText}>Close</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AlertsScreen({ navigation }) {
  const [events,         setEvents]         = useState([]);
  const [criticalAlerts, setCriticalAlerts] = useState([]);
  const [activeZones,    setActiveZones]    = useState([]);
  const [refreshing,     setRefreshing]     = useState(false);
  const [safetyModal,    setSafetyModal]    = useState({ visible: false, title: '', steps: [] });
  const [showAllRecent,  setShowAllRecent]  = useState(false);

  const loadData = useCallback(async () => {
    const [zonesRes, eventsRes, criticalRes] = await Promise.all([
      locationService.getActiveZones(),
      locationService.getEventHistory(),
      locationService.getCriticalAlerts(),
    ]);
    if (zonesRes.success)    setActiveZones(zonesRes.zones);
    if (eventsRes.success)   setEvents(eventsRes.events);
    if (criticalRes.success) setCriticalAlerts(criticalRes.alerts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      const interval = setInterval(loadData, 10000);
      return () => clearInterval(interval);
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Computed lists ────────────────────────────────────────────────────────

  const activeZoneIds = new Set(activeZones.map(z => z.id));

  const displayCritical = (() => {
    const seenTitles = new Set();
    const fromEvents = events
      .filter(e => e.type === 'enter' && ['critical', 'high'].includes(e.severity) && activeZoneIds.has(e.zone))
      .map(e => ({ id: `event-${e.timestamp}`, severity: e.severity, title: e.title || 'Alert', description: e.description || '', time: getTimeAgo(e.timestamp), timestamp: e.timestamp, disasterType: e.disasterType }));
    const fromFirestore = criticalAlerts
      .filter(a => activeZoneIds.has(a.zoneId))
      .map(a => ({ id: a.id, severity: a.severity, title: a.title, description: a.description || '', time: getTimeAgo(a.timestamp), timestamp: a.timestamp, disasterType: a.disasterType }));
    return [...fromEvents, ...fromFirestore]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .filter(a => { if (seenTitles.has(a.title)) return false; seenTitles.add(a.title); return true; });
  })();

  const displayRecent = (() => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const seenKeys = new Set();
    return events
      .filter(e => {
        if (new Date(e.timestamp).getTime() < fiveMinAgo) return false;
        return e.type === 'enter' ? activeZoneIds.has(e.zone) : e.type === 'exit';
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .filter(e => { const k = `${e.type}-${e.zone}`; if (seenKeys.has(k)) return false; seenKeys.add(k); return true; })
      .slice(0, 5)
      .map(e => ({ id: `event-${e.timestamp}`, title: e.type === 'exit' ? `Left ${e.title}` : `Entered ${e.title}`, time: getTimeAgo(e.timestamp), isExit: e.type === 'exit' }));
  })();

  const openSafetyModal = (alert) => {
    const type  = resolveDisasterType(alert);
    const steps = type ? getSafetySteps(type) : [];
    setSafetyModal({
      visible: true,
      title: type ? `${type.charAt(0).toUpperCase() + type.slice(1)} Safety Steps` : 'Safety Steps',
      steps: steps.length > 0 ? steps : FALLBACK_STEPS,
    });
  };

  const visibleRecent = showAllRecent ? displayRecent : displayRecent.slice(0, 3);

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.appLabel}>PREPARENOW</Text>
        <Text style={styles.pageTitle}>Alerts</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Critical Alerts ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionLabel}>CRITICAL ALERTS</Text>
            {displayCritical.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{displayCritical.length}</Text>
              </View>
            )}
          </View>

          {displayCritical.length > 0 ? (
            displayCritical.slice(0, 3).map((alert, i) => (
              <CriticalCard key={alert.id || i} alert={alert} onViewSteps={openSafetyModal} />
            ))
          ) : (
            <Text style={styles.emptyHint}>No active zone alerts</Text>
          )}

          {displayCritical.length > 3 && (
            <Text style={styles.moreText}>+{displayCritical.length - 3} more active alerts</Text>
          )}
        </View>

        {/* ── Recent Activity ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
          </View>

          {displayRecent.length > 0 ? (
            <>
              {visibleRecent.map((alert, i) => (
                <RecentRow key={alert.id || i} alert={alert} />
              ))}
              {displayRecent.length > 3 && (
                <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllRecent(v => !v)}>
                  <Text style={styles.showMoreText}>
                    {showAllRecent ? 'Show less' : `Show all ${displayRecent.length} events`}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={styles.emptyHint}>No zone activity</Text>
          )}
        </View>

        {/* ── Info banner ── */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Alerts update frequently based on your location
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <SafetyModal
        visible={safetyModal.visible}
        title={safetyModal.title}
        steps={safetyModal.steps}
        onClose={() => setSafetyModal(p => ({ ...p, visible: false }))}
      />

      {/* ── Footer ── */}
      <View style={styles.footer}>
        {['Home', 'Alerts', 'Prepare', 'Plan', 'Profile'].map(screen => (
          <TouchableOpacity key={screen} style={styles.footerBtn} onPress={() => navigation.navigate(screen)}>
            <Text style={[styles.footerBtnText, screen === 'Alerts' && styles.footerBtnActive]}>{screen}</Text>
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
  },
  appLabel:  { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 2, marginBottom: 6 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },

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
  sectionLabel:  { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 1.5, flex: 1 },
  sectionSub:    { fontSize: 11, color: '#9CA3AF' },
  emptyHint:     { fontSize: 13, color: '#9CA3AF', paddingVertical: SPACING.sm },

  // Count badge
  countBadge: { backgroundColor: '#DC2626', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Critical cards
  criticalCard: {
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  criticalStripe:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: 7 },
  criticalStripeText: { color: '#fff', fontWeight: '700', fontSize: 10, letterSpacing: 0.5 },
  criticalStripeTime: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  criticalBody:       { padding: SPACING.md },
  criticalTitle:      { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  criticalDesc:       { fontSize: 13, color: '#6B7280', marginBottom: SPACING.md, lineHeight: 18 },
  stepsBtn:           { paddingVertical: 10, paddingHorizontal: SPACING.md, borderRadius: 8, alignItems: 'center' },
  stepsBtnText:       { color: '#fff', fontWeight: '700', fontSize: 13 },
  moreText:           { fontSize: 12, color: '#EA580C', fontWeight: '600', paddingVertical: 4 },

  // Recent rows
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: SPACING.sm,
  },
  recentRowExit:   {},
  recentDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626', flexShrink: 0 },
  recentDotExit:   { backgroundColor: '#10B981' },
  recentTitle:     { fontSize: 13, fontWeight: '600', color: '#111827', flex: 1 },
  recentTitleExit: { color: '#059669' },
  recentTime:      { fontSize: 11, color: '#9CA3AF' },

  showMoreBtn:  { paddingVertical: SPACING.sm, alignItems: 'center' },
  showMoreText: { color: '#2563EB', fontWeight: '600', fontSize: 13 },

  // Info banner
  infoBanner: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: SPACING.md,
  },
  infoBannerText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },

  // Safety modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
    maxHeight: '75%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  modalTitle:  { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: SPACING.md },
  modalScroll: { marginBottom: SPACING.md },
  stepRow:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md, gap: SPACING.sm },
  stepNum:     { width: 24, height: 24, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepText:    { fontSize: 14, color: '#111827', flex: 1, lineHeight: 20 },
  modalCloseBtn:     { backgroundColor: '#111827', padding: SPACING.md, borderRadius: 10, alignItems: 'center' },
  modalCloseBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

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
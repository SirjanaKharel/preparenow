import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, Pressable } from 'react-native';
import { DISASTER_CONFIG } from '../constants/disasters';
import { locationService } from '../services/locationService';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { useFocusEffect } from '@react-navigation/native';
import { SAFETY_GUIDES } from '../constants/resources';

export default function AlertsScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [criticalAlerts, setCriticalAlerts] = useState([]);
  const [allAlerts, setAllAlerts] = useState([]);
  const [activeZones, setActiveZones] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);
  const [safetySteps, setSafetySteps] = useState([]);
  const [safetyTitle, setSafetyTitle] = useState('');
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [detailsContent, setDetailsContent] = useState({ title: '', description: '', steps: [] });
  const [showAllRecentAlerts, setShowAllRecentAlerts] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
      const refreshInterval = setInterval(() => {
        loadData();
      }, 10000);
      return () => clearInterval(refreshInterval);
    }, [])
  );

  const loadData = async () => {
    await loadActiveZones();
    await loadEvents();
    await loadLiveAlerts();
  };

  const loadActiveZones = async () => {
    const result = await locationService.getActiveZones();
    if (result.success) {
      setActiveZones(result.zones);
    }
  };

  const loadEvents = async () => {
    const result = await locationService.getEventHistory();
    if (result.success) {
      setEvents(result.events);
    }
  };

  const loadLiveAlerts = async () => {
    const allAlertsResult = await locationService.getLiveAlerts();
    if (allAlertsResult.success) {
      setAllAlerts(allAlertsResult.alerts);
    }
    const criticalResult = await locationService.getCriticalAlerts();
    if (criticalResult.success) {
      setCriticalAlerts(criticalResult.alerts);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: COLORS.critical,
      high: COLORS.high,
      warning: COLORS.warning,
      info: COLORS.info,
    };
    return colors[severity] || COLORS.textSecondary;
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const getSafetyStepsForType = (type) => {
    const guide = SAFETY_GUIDES.find(g => g.type === type);
    if (!guide) return [];
    return guide.sections.flatMap(section => section.steps);
  };

  const resolveDisasterType = (item) => {
    if (item.disasterType) return item.disasterType.toLowerCase();
    const searchStr = `${item.type || ''} ${item.title || ''}`.toLowerCase();
    if (searchStr.includes('fire'))                         return 'fire';
    if (searchStr.includes('flood'))                        return 'flood';
    if (searchStr.includes('storm'))                        return 'storm';
    if (searchStr.includes('earthquake') || searchStr.includes('eq')) return 'earthquake';
    if (searchStr.includes('evacuation'))                   return 'evacuation';
    return null;
  };

  const handleViewSafetySteps = (alert) => {
    const safetyType = resolveDisasterType(alert);
    const steps = safetyType ? getSafetyStepsForType(safetyType) : [];
    const title = safetyType
      ? `${safetyType.charAt(0).toUpperCase() + safetyType.slice(1)} Safety Steps`
      : 'Safety Steps';
    setSafetyTitle(title);
    setSafetySteps(
      steps.length > 0
        ? steps
        : [
            'Follow official guidance from local authorities.',
            'Stay calm and keep others informed.',
            'Contact emergency services if in immediate danger.',
          ]
    );
    setSafetyModalVisible(true);
  };

  // Critical Alerts — only zones user is currently inside, deduplicated by title
  const displayCriticalAlerts = (() => {
    const activeZoneIds = new Set(activeZones.map(z => z.id));

    const fromEvents = events
      .filter(event =>
        event.type === 'enter' &&
        (event.severity === 'critical' || event.severity === 'high') &&
        activeZoneIds.has(event.zone)
      )
      .map(event => ({
        id: `event-${event.timestamp}`,
        severity: event.severity,
        title: event.title || 'Alert',
        description: event.description || 'Disaster zone alert',
        time: getTimeAgo(event.timestamp),
        timestamp: event.timestamp,
        disasterType: event.disasterType,
      }));

    const fromFirestore = criticalAlerts
      .filter(alert => activeZoneIds.has(alert.zoneId))
      .map(alert => ({
        id: alert.id,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        time: getTimeAgo(alert.timestamp),
        timestamp: alert.timestamp,
        disasterType: alert.disasterType,
      }));

    const merged = [...fromEvents, ...fromFirestore]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Deduplicate by title — one card per real-world zone
    const seenTitles = new Set();
    return merged.filter(alert => {
      if (seenTitles.has(alert.title)) return false;
      seenTitles.add(alert.title);
      return true;
    });
  })();

  // Recent Alerts — entry AND exit events within 5 minutes.
  // Deduplicated by zone+eventType key so the same zone can only appear
  // once per event type (one "Entered X", one "Left X").
  const displayRecentAlerts = (() => {
    const activeZoneIds = new Set(activeZones.map(z => z.id));
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const filtered = events
      .filter(event => {
        if (new Date(event.timestamp) < fiveMinutesAgo) return false;
        if (event.type === 'enter') return activeZoneIds.has(event.zone);
        if (event.type === 'exit')  return true; // always show exits
        return false;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // One row per unique zone+eventType — collapses any remaining duplicates
    const seenKeys = new Set();
    return filtered
      .filter(event => {
        const key = `${event.type}-${event.zone}`;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      })
      .slice(0, 5)
      .map(event => ({
        id: `event-${event.timestamp}`,
        severity: event.severity || 'info',
        title: event.type === 'exit' ? `Left ${event.title}` : `Entered ${event.title}`,
        time: getTimeAgo(event.timestamp),
        timestamp: event.timestamp,
        isExit: event.type === 'exit',
      }));
  })();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PrepareNow</Text>
        <Text style={styles.title}>Alerts & Notifications</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Critical Alerts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CRITICAL ALERTS</Text>

          {displayCriticalAlerts.length > 0 ? (
            displayCriticalAlerts.slice(0, 3).map((alert, index) => (
              <View
                key={alert.id || `critical-${index}`}
                style={[styles.alertCard, styles.criticalCard]}
              >
                <View style={styles.alertHeader}>
                  <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(alert.severity) }]}>
                    <Text style={styles.severityText}>{alert.severity.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.alertTime}>{alert.time}</Text>
                </View>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertDescription}>{alert.description}</Text>
                <TouchableOpacity
                  onPress={() => handleViewSafetySteps(alert)}
                  style={styles.safetyButton}
                >
                  <Text style={styles.safetyButtonText}>View Safety Steps</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.noAlertsText}>No critical alerts at this time</Text>
          )}
          {displayCriticalAlerts.length > 3 && (
            <Text style={styles.moreAlertsText}>+{displayCriticalAlerts.length - 3} more alerts</Text>
          )}
        </View>

        {/* Recent Alerts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECENT ALERTS</Text>

          {displayRecentAlerts.length > 0 ? (
            <>
              {(showAllRecentAlerts ? displayRecentAlerts : displayRecentAlerts.slice(0, 3)).map((alert, index) => (
                <View
                  key={alert.id || `info-${index}`}
                  style={[
                    styles.recentAlertCard,
                    alert.isExit && styles.recentAlertCardExit,
                  ]}
                >
                  <View style={styles.recentAlertLeft}>
                    <Text style={styles.recentAlertIndicator}>
                      {alert.isExit ? '↗' : '↙'}
                    </Text>
                    <Text style={[
                      styles.recentAlertTitle,
                      alert.isExit && styles.recentAlertTitleExit,
                    ]}>
                      {alert.title}
                    </Text>
                  </View>
                  <Text style={styles.recentAlertTime}>{alert.time}</Text>
                </View>
              ))}
              {displayRecentAlerts.length > 3 && (
                <TouchableOpacity
                  style={{ alignSelf: 'center', marginTop: 8, padding: 8 }}
                  onPress={() => setShowAllRecentAlerts(!showAllRecentAlerts)}
                >
                  <Text style={{ color: '#007AFF', fontWeight: '600' }}>
                    {showAllRecentAlerts ? 'Show Less' : 'View All Recent Alerts'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={styles.noAlertsText}>No recent alerts in the last 5 minutes</Text>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Safety Steps Modal */}
      <Modal
        visible={safetyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSafetyModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400 }}>
            <Text style={{ fontWeight: '700', fontSize: 20, marginBottom: 12 }}>{safetyTitle}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {safetySteps.map((step, idx) => (
                <Text key={idx} style={{ marginBottom: 8, fontSize: 16 }}>• {step}</Text>
              ))}
            </ScrollView>
            <Pressable
              style={{ marginTop: 18, alignSelf: 'flex-end', padding: 10 }}
              onPress={() => setSafetyModalVisible(false)}
            >
              <Text style={{ color: '#007AFF', fontWeight: '600', fontSize: 16 }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Warning Details Modal */}
      <Modal
        visible={detailsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '85%', maxWidth: 400 }}>
            <Text style={{ fontWeight: '700', fontSize: 20, marginBottom: 12 }}>{detailsContent.title}</Text>
            <Text style={{ marginBottom: 12, fontSize: 16 }}>{detailsContent.description}</Text>
            {detailsContent.steps && detailsContent.steps.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: '600', marginBottom: 6 }}>Safety Steps:</Text>
                {detailsContent.steps.map((step, idx) => (
                  <Text key={idx} style={{ marginBottom: 6, fontSize: 15 }}>• {step}</Text>
                ))}
              </View>
            )}
            <Pressable
              style={{ marginTop: 18, alignSelf: 'flex-end', padding: 10 }}
              onPress={() => setDetailsModalVisible(false)}
            >
              <Text style={{ color: '#007AFF', fontWeight: '600', fontSize: 16 }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.footerButtonText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Alerts')}>
          <Text style={[styles.footerButtonText, styles.footerButtonActive]}>Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Prepare')}>
          <Text style={styles.footerButtonText}>Prepare</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Plan')}>
          <Text style={styles.footerButtonText}>Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.footerButtonText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.lg,
    paddingTop: SPACING.xxl + 20,
    backgroundColor: COLORS.background,
  },
  backButton: {
    marginBottom: SPACING.sm,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 16,
  },
  headerTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.text,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  criticalCard: {
    borderColor: COLORS.critical,
    backgroundColor: '#FEF2F2',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  severityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  severityText: {
    ...TYPOGRAPHY.small,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  alertTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  alertTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  alertDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  safetyButton: {
    backgroundColor: COLORS.text,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  safetyButtonText: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  detailsButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: COLORS.text,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  detailsButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  recentAlertCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  recentAlertCardExit: {
    backgroundColor: '#F0FFF4',
    borderColor: '#10B981',
  },
  recentAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  recentAlertIndicator: {
    fontSize: 16,
    marginRight: 8,
    color: COLORS.textSecondary,
  },
  recentAlertTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  recentAlertTitleExit: {
    color: '#059669',
  },
  recentAlertTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  bottomPadding: {
    height: SPACING.md,
  },
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
  footerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  footerButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  footerButtonActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  noAlertsText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    padding: SPACING.md,
    textAlign: 'center',
  },
  moreAlertsText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.warning,
    fontWeight: '600',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
});
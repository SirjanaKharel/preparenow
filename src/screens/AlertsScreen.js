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

  // Load data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
      
      // Set up auto-refresh every 10 seconds while on this screen
      const refreshInterval = setInterval(() => {
        loadData();
      }, 10000);
      
      // Clean up interval when component unmounts or loses focus
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
      console.log('Active zones:', result.zones.length);
      setActiveZones(result.zones);
    }
  };

  const loadEvents = async () => {
    const result = await locationService.getEventHistory();
    if (result.success) {
      console.log('Loaded events:', result.events.length);
      setEvents(result.events);
    }
  };

  const loadLiveAlerts = async () => {
    // Fetch all live alerts
    const allAlertsResult = await locationService.getLiveAlerts();
    if (allAlertsResult.success) {
      setAllAlerts(allAlertsResult.alerts);
    }

    // Fetch critical alerts specifically
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
    // Flatten all steps from all sections
    return guide.sections.flatMap(section => section.steps);
  };

  // Display critical events from local history (zone entries with high/critical severity) - ONLY FOR ACTIVE ZONES
  const displayCriticalAlerts = (() => {
    const activeZoneIds = activeZones.map(z => z.id);
    const alerts = events
      .filter(event => 
        event.type === 'enter' && 
        (event.severity === 'critical' || event.severity === 'high') &&
        activeZoneIds.includes(event.zone)
      )
      .map(event => ({
        id: `event-${event.timestamp}`,
        severity: event.severity,
        title: event.title || 'Alert',
        description: event.description || 'Disaster zone alert',
        time: getTimeAgo(event.timestamp),
        timestamp: event.timestamp,
      }))
      .concat(
        criticalAlerts
          .filter(alert => activeZoneIds.includes(alert.zoneId))
          .map(alert => ({
            id: alert.id,
            severity: alert.severity,
            title: alert.title,
            description: alert.description,
            time: getTimeAgo(alert.timestamp),
            timestamp: alert.timestamp,
          }))
      )
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Deduplicate by title - only show the most recent event for each zone
    const uniqueAlerts = [];
    const seenZones = new Set();
    for (const alert of alerts) {
      if (!seenZones.has(alert.title)) {
        uniqueAlerts.push(alert);
        seenZones.add(alert.title);
      }
    }
    return uniqueAlerts;
  })();

  // Display recent zone entry/exit events (only within the last 5 minutes)
  const displayRecentAlerts = (() => {
    const activeZoneIds = activeZones.map(z => z.id);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    return events
      .filter(event => {
        // Only include events within the last 5 minutes
        if (new Date(event.timestamp) < fiveMinutesAgo) return false;

        if (event.type === 'enter') {
          return activeZoneIds.includes(event.zone);
        } else if (event.type === 'exit') {
          return true; // Always show exit events (within 5 min window)
        }
        return false;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5) // Only show last 5 recent alerts
      .map(event => ({
        id: `event-${event.timestamp}`,
        severity: event.severity || 'info',
        title: event.type === 'exit' ? `Left ${event.title}` : `Entered ${event.title}`,
        time: getTimeAgo(event.timestamp),
        timestamp: event.timestamp,
      }));
  })();

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
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
                  onPress={() => {
                    const alertType = alert.type ? alert.type.toLowerCase() : '';
                    let safetyType = null;
                    if (alertType.includes('fire')) safetyType = 'fire';
                    else if (alertType.includes('flood')) safetyType = 'flood';
                    // Add more types as needed
                    if (safetyType) {
                      setSafetySteps(getSafetyStepsForType(safetyType));
                      setSafetyModalVisible(true);
                    } else {
                      // Optionally show a message or default steps
                    }
                  }}
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
                  style={styles.recentAlertCard}
                >
                  <Text style={styles.recentAlertTitle}>{alert.title}</Text>
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
            {safetySteps.map((step, idx) => (
              <Text key={idx} style={{ marginBottom: 8, fontSize: 16 }}>• {step}</Text>
            ))}
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
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.footerButtonText}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate('Alerts')}
        >
          <Text style={[styles.footerButtonText, styles.footerButtonActive]}>Alerts</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate('Prepare')}
        >
          <Text style={styles.footerButtonText}>Prepare</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate('Plan')}
        >
          <Text style={styles.footerButtonText}>Plan</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate('Profile')}
        >
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
  recentAlertTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  recentAlertTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  eventBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  eventBadgeText: {
    ...TYPOGRAPHY.small,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  eventTime: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  eventTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  eventDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs / 2,
    fontSize: 13,
  },
  eventSeverity: {
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
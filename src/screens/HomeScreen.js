import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { locationService, subscribeToDisasterZones, unsubscribeFromDisasterZones, subscribeToLocationChanges } from '../services/locationService';
import { useApp } from '../context/AppContext';
import { PREPAREDNESS_TASKS, TOTAL_TASKS } from '../constants/tasks';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants/theme';

export default function HomeScreen({ navigation }) {
  const { user, monitoringActive, setMonitoringActive, currentLocation, setCurrentLocation, completedTasks } = useApp();
  const [nearbyZones, setNearbyZones] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [zoneCount, setZoneCount] = useState(0);

  // ✅ Preparedness % = completed tasks (that exist in our 14-task list) / 14
  const completedCount = completedTasks
    ? completedTasks.filter(id => PREPAREDNESS_TASKS.some(task => task.id === id)).length
    : 0;
  const preparednessLevel = TOTAL_TASKS > 0 ? Math.round((completedCount / TOTAL_TASKS) * 100) : 0;

  useEffect(() => {
    initializeMonitoring();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToDisasterZones((zones) => {
      setZoneCount(zones.length);
      if (currentLocation) {
        updateNearbyZones(currentLocation);
      }
    });
    return () => {
      unsubscribeFromDisasterZones();
    };
  }, [monitoringActive, currentLocation]);

  useEffect(() => {
    if (currentLocation) {
      checkForLiveAlerts(currentLocation);
    }
  }, [currentLocation, nearbyZones]);

  useEffect(() => {
    if (monitoringActive) {
      checkZonesAndUpdateAlerts();
      const interval = setInterval(() => {
        checkZonesAndUpdateAlerts();
      }, 120000); // 2 minutes
      return () => clearInterval(interval);
    }
  }, [monitoringActive]);

  useEffect(() => {
    const unsubscribeLocation = subscribeToLocationChanges(async (newCoords) => {
      console.log('📍 Location changed via Developer Settings:', newCoords);
      setCurrentLocation(newCoords);
      await updateNearbyZones(newCoords);
    });
    return () => unsubscribeLocation();
  }, []);

  const initializeMonitoring = async () => {
    if (monitoringActive) {
      console.log('✅ Already monitoring — skipping restart, refreshing location only');
      await loadLocation();
      return;
    }

    setLoading(true);
    const permResult = await locationService.requestPermissions();
    if (permResult.success) {
      const locationResult = await locationService.getCurrentLocation();
      if (!locationResult.success && locationResult.isSimulatorError) {
        Alert.alert(
          '📍 No Location Available',
          'Looks like the Simulator has no GPS.\n\nGo to Developer Settings and enable "Test Location" to set a test position.',
          [
            { text: 'OK' },
            { text: 'Go to Dev Settings', onPress: () => navigation.navigate('Profile') },
          ]
        );
      } else if (locationResult.success) {
        setCurrentLocation(locationResult.location.coords);
        updateNearbyZones(locationResult.location.coords);
      }
      const monitorResult = await locationService.startMonitoring();
      if (monitorResult.success) {
        setMonitoringActive(true);
        setZoneCount(locationService.getZoneCount());
      }
    } else {
      Alert.alert('Permission Required', permResult.error);
    }
    setLoading(false);
  };

  const checkZonesAndUpdateAlerts = async () => {
    const result = await locationService.manualCheckZones();
    if (result.success && result.zonesTriggered.length > 0) {
      await loadLocation();
    }
  };

  const loadLocation = async () => {
    const result = await locationService.getCurrentLocation();
    if (result.success) {
      setCurrentLocation(result.location.coords);
      updateNearbyZones(result.location.coords);
    }
  };

  const updateNearbyZones = async (coords) => {
    const zones = await locationService.getNearbyZones(coords);
    setNearbyZones(zones);
  };

  const checkForLiveAlerts = (coords) => {
    const seenKeys = new Set();

    const activeAlerts = nearbyZones
      .filter(zone => zone.distance < 5000)
      .map(zone => ({
        id: zone.id,
        type: zone.title || zone.disasterType,
        location: zone.description || zone.title,
        distance: (zone.distance / 1000).toFixed(1),
        severity: zone.isInside ? 'HIGH' : zone.distance < 1000 ? 'MEDIUM' : 'LOW',
        disasterType: zone.disasterType,
        isInside: zone.isInside,
        title: zone.title,
      }))
      .filter(alert => {
        const dedupeKey = `${alert.type}-${alert.disasterType}`;
        if (seenKeys.has(dedupeKey)) return false;
        seenKeys.add(dedupeKey);
        return true;
      })
      .sort((a, b) => {
        if (a.isInside && !b.isInside) return -1;
        if (!a.isInside && b.isInside) return 1;
        return parseFloat(a.distance) - parseFloat(b.distance);
      });

    setLiveAlerts(activeAlerts);
  };

  const handleStartMonitoring = async () => {
    const permResult = await locationService.requestPermissions();
    if (!permResult.success) {
      Alert.alert('Permission Required', permResult.error);
      return;
    }
    setLoading(true);
    const result = await locationService.startMonitoring();
    setLoading(false);
    if (result.success) {
      setMonitoringActive(true);
      setZoneCount(locationService.getZoneCount());
      Alert.alert('Monitoring Active', 'PrepareNow is now monitoring disaster zones.');
      loadLocation();
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleStopMonitoring = async () => {
    Alert.alert(
      'Stop Monitoring?',
      'Are you sure you want to stop disaster zone monitoring? You will not receive emergency alerts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const result = await locationService.stopMonitoring();
            setLoading(false);
            if (result.success) {
              setMonitoringActive(false);
              Alert.alert('Monitoring Stopped', 'Disaster zone monitoring has been stopped.');
            } else {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  const handleManualZoneCheck = async () => {
    setLoading(true);
    const result = await locationService.manualCheckZones();
    setLoading(false);
    if (result.success) {
      if (result.zonesTriggered.length > 0) {
        Alert.alert(
          'Zones Detected',
          `You are currently in the following disaster zones:\n\n${result.zonesTriggered.join('\n')}`
        );
        loadLocation();
      } else {
        Alert.alert('No Active Zones', 'You are not currently in any disaster zones. Stay safe!');
      }
    } else {
      Alert.alert('Error', result.error || 'Could not check zones');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLocation();
    await checkZonesAndUpdateAlerts();
    setRefreshing(false);
  };

  const getPreparednessLabel = () => {
    if (preparednessLevel >= 80) return 'Well Prepared';
    if (preparednessLevel >= 50) return 'Getting Ready';
    return 'Needs Attention';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'HIGH':   return '#DC2626';
      case 'MEDIUM': return '#F59E0B';
      case 'LOW':    return '#10B981';
      default:       return COLORS.text;
    }
  };

  const getDisasterIcon = (type) => {
    switch (type) {
      case 'flood':      return '🌊';
      case 'fire':       return '🔥';
      case 'earthquake': return '🌍';
      case 'storm':      return '⛈️';
      case 'evacuation': return '🚨';
      default:           return '⚠️';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PREPARENOW</Text>
          <Text style={styles.welcomeText}>
            Welcome back, {user?.displayName || 'User'}
          </Text>
          <Text style={styles.subtitle}>Stay Safe, Stay Prepared</Text>
        </View>

        {/* Preparedness Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PREPAREDNESS STATUS</Text>
          <View style={styles.progressContainer}>
            <Text style={styles.progressPercentage}>{preparednessLevel}%</Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${preparednessLevel}%` }]} />
            </View>
            <Text style={styles.levelText}>{getPreparednessLabel()}</Text>
          </View>
          {/* Show tasks completed count beneath the bar */}
          <Text style={styles.tasksCompletedText}>
            {completedCount} of {TOTAL_TASKS} tasks completed
          </Text>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => navigation.navigate('Prepare')}
          >
            <Text style={styles.continueButtonText}>
              {preparednessLevel === 0 ? 'START PREPARING' : preparednessLevel === 100 ? 'VIEW TASKS' : 'CONTINUE PREPARING'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Alerts Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>LIVE ALERTS</Text>

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : liveAlerts.length > 0 ? (
            liveAlerts.map((alert) => (
              <View
                key={alert.id}
                style={[
                  styles.alertItem,
                  alert.isInside && {
                    backgroundColor: '#FEF2F2',
                    borderLeftColor: '#DC2626',
                    borderWidth: 2,
                    borderColor: '#DC2626',
                  },
                ]}
              >
                {alert.isInside && (
                  <View style={{
                    backgroundColor: '#DC2626',
                    marginHorizontal: -SPACING.md,
                    marginTop: -SPACING.md,
                    marginBottom: SPACING.sm,
                    padding: SPACING.sm,
                    borderTopLeftRadius: BORDER_RADIUS.md,
                    borderTopRightRadius: BORDER_RADIUS.md,
                  }}>
                    <Text style={{ color: '#FFF', fontWeight: '700', textAlign: 'center', fontSize: 11 }}>
                      YOU ARE INSIDE THIS ZONE
                    </Text>
                  </View>
                )}
                <View style={styles.alertHeader}>
                  <View style={styles.alertTitleRow}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeText}>{inferAlertType(alert)}</Text>
                    </View>
                    <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(alert.severity) }]}>
                      <Text style={styles.severityText}>{alert.severity}</Text>
                    </View>
                  </View>
                  <Text style={styles.alertDistance}>
                    {alert.isInside ? 'INSIDE' : `${alert.distance} km away`}
                  </Text>
                </View>
                <Text style={styles.alertType}>{alert.type}</Text>
                <Text style={styles.alertLocation}>{alert.location}</Text>
              </View>
            ))
          ) : (
            <Text style={{ textAlign: 'center', color: '#888', marginVertical: 16 }}>
              No current alerts
            </Text>
          )}

          {!monitoringActive && (
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartMonitoring}
              disabled={loading}
            >
              <Text style={styles.startButtonText}>
                {loading ? 'Starting...' : 'Start Monitoring'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Plan')}
            >
              <Text style={styles.actionButtonText}>Find Shelter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.actionButtonText}>Emergency Contacts</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Home')}>
          <Text style={[styles.footerButtonText, styles.footerButtonActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Alerts')}>
          <Text style={styles.footerButtonText}>Alerts</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.md,
  },
  header: {
    padding: SPACING.lg,
    paddingTop: SPACING.xxl + 20,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  welcomeText: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  card: {
    margin: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  cardTitle: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressPercentage: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.borderLight,
    borderRadius: BORDER_RADIUS.full,
    marginVertical: SPACING.md,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.text,
    borderRadius: BORDER_RADIUS.full,
  },
  levelText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  tasksCompletedText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontSize: 12,
  },
  continueButton: {
    backgroundColor: COLORS.text,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  continueButtonText: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  alertItem: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  typeBadge: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  typeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 10,
  },
  severityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs / 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  severityText: {
    ...TYPOGRAPHY.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 10,
  },
  alertDistance: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  alertType: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  alertLocation: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  startButton: {
    backgroundColor: COLORS.text,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  startButtonText: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  quickActions: {
    padding: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.text,
    alignItems: 'center',
  },
  actionButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 13,
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
});

const inferAlertType = (alert) => {
  if (alert.disasterType) return alert.disasterType.charAt(0).toUpperCase() + alert.disasterType.slice(1);
  if (alert.type) return alert.type.charAt(0).toUpperCase() + alert.type.slice(1);
  if (alert.title) {
    const lowerTitle = alert.title.toLowerCase();
    if (lowerTitle.includes('fire'))       return 'Fire';
    if (lowerTitle.includes('flood'))      return 'Flood';
    if (lowerTitle.includes('storm'))      return 'Storm';
    if (lowerTitle.includes('earthquake')) return 'Earthquake';
    if (lowerTitle.includes('evacuation')) return 'Evacuation';
  }
  return 'Alert';
};
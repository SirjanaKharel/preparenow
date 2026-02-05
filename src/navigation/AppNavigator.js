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
import { locationService, DISASTER_ZONES } from '../services/locationService';
import { useApp } from '../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import EmergencyContactsScreen from '../screens/EmergencyContactsScreen';

export default function HomeScreen({ navigation }) {
  const { user, monitoringActive, setMonitoringActive, currentLocation, setCurrentLocation } = useApp();
  const [nearbyZones, setNearbyZones] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [preparednessLevel, setPreparednessLevel] = useState(0);
  const [completedTasks, setCompletedTasks] = useState([]);

  useEffect(() => {
    loadLocation();
    calculatePreparedness();
  }, []);

  useEffect(() => {
    if (currentLocation) {
      checkForLiveAlerts(currentLocation);
    }
  }, [currentLocation, nearbyZones]);

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
    // Check if user is near any disaster zones
    const activeAlerts = nearbyZones
      .filter(zone => zone.distance < 5000) // Show zones within 5km
      .map(zone => {
        const distanceKm = (zone.distance / 1000).toFixed(1);
        
        return {
          id: zone.id,
          type: zone.title || zone.disasterType,
          location: zone.description || zone.title,
          distance: distanceKm,
          severity: zone.isInside ? 'HIGH' : distanceKm < 1 ? 'MEDIUM' : 'LOW',
          disasterType: zone.disasterType,
        };
      });

    setLiveAlerts(activeAlerts);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    // Haversine formula to calculate distance in km
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const calculatePreparedness = () => {
    // Calculate based on completed tasks
    // This would typically fetch from app context or storage
    // For now, calculating based on mock data
    const totalTasks = 20; // Total preparation tasks
    const completed = completedTasks.length;
    const percentage = Math.round((completed / totalTasks) * 100);
    setPreparednessLevel(percentage);
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
      Alert.alert('Monitoring Active', 'PrepareNow is now monitoring disaster zones in the background.');
      loadLocation();
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLocation();
    setRefreshing(false);
  };

  const getMonitoredLocations = () => {
    return ['Home', 'Work', 'School'];
  };

  const getPreparednessLevel = () => {
    if (preparednessLevel === 0) return 'NOT STARTED';
    if (preparednessLevel < 25) return 'LEVEL 1 - BEGINNING';
    if (preparednessLevel < 50) return 'LEVEL 2 - IN PROGRESS';
    if (preparednessLevel < 75) return 'LEVEL 3 - WELL PREPARED';
    if (preparednessLevel < 100) return 'LEVEL 4 - ALMOST READY';
    return 'LEVEL 5 - FULLY PREPARED';
  };

  const getSeverityColor = (severity) => {
    switch(severity) {
      case 'HIGH': return '#DC2626';
      case 'MEDIUM': return '#F59E0B';
      case 'LOW': return '#10B981';
      default: return COLORS.text;
    }
  };

  const getDisasterIcon = (type) => {
    const typeMap = {
      flood: '🌊',
      fire: '🔥',
      storm: '⛈️',
      evacuation: '🚨',
      earthquake: '🏚️',
      tornado: '🌪️',
    };
    return typeMap[type] || '⚠️';
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
            <Text style={styles.levelText}>{getPreparednessLevel()}</Text>
          </View>
          <TouchableOpacity 
            style={styles.continueButton}
            onPress={() => navigation.navigate('Prepare')}
          >
            <Text style={styles.continueButtonText}>
              {preparednessLevel === 0 ? 'START PREPARING' : 'CONTINUE PREPARING'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Alerts Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>LIVE ALERTS</Text>
          
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : liveAlerts.length > 0 ? (
            <>
              {liveAlerts.map((alert) => (
                <View key={alert.id} style={styles.alertItem}>
                  <View style={styles.alertHeader}>
                    <View style={styles.alertTitleRow}>
                      <Text style={styles.alertIcon}>{getDisasterIcon(alert.disasterType)}</Text>
                      <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(alert.severity) }]}>
                        <Text style={styles.severityText}>{alert.severity}</Text>
                      </View>
                    </View>
                    <Text style={styles.alertDistance}>{alert.distance} km away</Text>
                  </View>
                  <Text style={styles.alertType}>{alert.type}</Text>
                  <Text style={styles.alertLocation}>{alert.location}</Text>
                </View>
              ))}
              <Text style={styles.monitoringText}>
                Monitoring {getMonitoredLocations().length} locations: {getMonitoredLocations().join(', ')}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.noAlertsText}>
                {monitoringActive 
                  ? 'No active alerts in your area' 
                  : 'Start monitoring to receive live alerts'}
              </Text>
              <Text style={styles.monitoringText}>
                Will monitor: {getMonitoredLocations().join(', ')}
              </Text>
            </>
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
              onPress={() => Alert.alert('Find Shelter', 'Shelter finder feature coming soon')}
            >
              <Text style={styles.actionButtonText}>Find Shelter</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('EmergencyContacts')}
            >
              <Text style={styles.actionButtonText}>Emergency Contacts</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={[styles.footerButtonText, styles.footerButtonActive]}>Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate('Alerts')}
        >
          <Text style={styles.footerButtonText}>Alerts</Text>
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
  alertIcon: {
    fontSize: 20,
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
  noAlertsText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  monitoringText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    fontSize: 11,
  },
  startButton: {
    backgroundColor: COLORS.primary,
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
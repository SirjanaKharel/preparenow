import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Image, Alert, Dimensions } from 'react-native';
// import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../constants/theme';
// import { SHELTERS } from '../constants/shelters';
// import { locationService } from '../services/locationService';
import { useApp } from '../context/AppContext';
import { storageService } from '../services/storageServices';

export default function ProfileScreen({ navigation }) {
  const { user, setUser, userPoints, completedTasks } = useApp();
  // Shelter/map state removed

  // Shelter/map effect removed
  // Profile state (name, image)
  const [profileName, setProfileName] = useState(user?.displayName || user?.email || 'User');
  const [profileImage, setProfileImage] = useState(user?.photoURL || null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [nameInput, setNameInput] = useState(profileName);
  const [imageInput, setImageInput] = useState(profileImage);

  // Level and XP
  const level = Math.floor(userPoints / 100);
  const currentXP = userPoints % 100;
  const maxXP = 100;
  const xpToNextLevel = maxXP - currentXP;
  const progressPercentage = (currentXP / maxXP) * 100;

  // Stats
  const tasksCompleted = completedTasks.length;
  // Assume quizzes have 'quiz' in their id or use a better filter if available
  const quizzesPassed = completedTasks.filter(id => typeof id === 'string' ? id.includes('quiz') : false).length;

  // Edit profile handlers
  const openEditModal = () => {
    setNameInput(profileName);
    setImageInput(profileImage);
    setEditModalVisible(true);
  };
  const closeEditModal = () => setEditModalVisible(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      allowsEditing: true, 
      aspect: [1, 1], 
      quality: 0.5 
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageInput(result.assets[0].uri);
    }
  };

  const handleSaveProfile = async () => {
    setProfileName(nameInput);
    setProfileImage(imageInput);
    // Optionally update user context if using Firebase Auth
    if (setUser && user) {
      setUser({ ...user, displayName: nameInput, photoURL: imageInput });
    }
    // Save to local storage for persistence
    await storageService.savePreferences({ name: nameInput, image: imageInput });
    setEditModalVisible(false);
    Alert.alert('Profile updated');
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PrepareNow</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.content}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profileName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.userName}>{profileName}</Text>
            <TouchableOpacity onPress={openEditModal}>
              <Text style={styles.editProfile}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Level Progress */}
          <View style={styles.levelSection}>
            <View style={styles.levelHeader}>
              <Text style={styles.levelText}>Level {level}</Text>
              <Text style={styles.xpText}>{currentXP} / {maxXP} XP</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${progressPercentage}%` }]} />
            </View>
            <Text style={styles.xpToNext}>{xpToNextLevel} XP to Level {level + 1}</Text>
          </View>

          {/* Stats Section */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>YOUR STATS</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{tasksCompleted}</Text>
                <Text style={styles.statLabel}>Tasks Completed</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{quizzesPassed}</Text>
                <Text style={styles.statLabel}>Quizzes Passed</Text>
              </View>
            </View>
          </View>

          {/* Map Section removed */}

          {/* Menu Section */}
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>MENU</Text>
            <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('DeveloperSettings')}>
              <Text style={styles.menuItemText}>Developer Settings</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
              <Text style={styles.menuItemText}>Achievements</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.menuItem} onPress={() => {}}>
              <Text style={styles.menuItemText}>Help & Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handlePickImage} style={styles.avatarEditBtn}>
              {imageInput ? (
                <Image source={{ uri: imageInput }} style={styles.avatarImgLarge} />
              ) : (
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarTextLarge}>{nameInput.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.avatarEditText}>Change Photo</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Enter your name"
              autoCapitalize="words"
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalBtn} onPress={closeEditModal}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSaveProfile}>
                <Text style={[styles.modalBtnText, styles.modalBtnSaveText]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Home')} accessibilityLabel="Go to Home">
          <Text style={styles.footerButtonText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Alerts')} accessibilityLabel="Go to Alerts">
          <Text style={styles.footerButtonText}>Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Prepare')} accessibilityLabel="Go to Prepare">
          <Text style={styles.footerButtonText}>Prepare</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Plan')} accessibilityLabel="Go to Plan">
          <Text style={styles.footerButtonText}>Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Profile')} accessibilityLabel="Go to Profile">
          <Text style={[styles.footerButtonText, styles.footerButtonActive]}>Profile</Text>
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
  mapSection: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  map: {
    width: Dimensions.get('window').width - 32,
    height: 250,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  header: {
    padding: SPACING.lg,
    paddingTop: SPACING.xxl + 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    fontWeight: '700',
    color: COLORS.text,
    fontSize: 20,
  },
  content: {
    padding: SPACING.lg,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.xl,
    ...SHADOWS.card,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  avatarImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: SPACING.md,
  },
  userName: {
    ...TYPOGRAPHY.h2,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  editProfile: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    textDecorationLine: 'underline',
    fontSize: 14,
  },
  levelSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.card,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  levelText: {
    ...TYPOGRAPHY.h3,
    fontWeight: '700',
    color: COLORS.text,
  },
  xpText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.text,
    borderRadius: 6,
  },
  xpToNext: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  statsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.card,
  },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: SPACING.md,
    fontSize: 11,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  statNumber: {
    ...TYPOGRAPHY.h1,
    fontWeight: '700',
    color: COLORS.text,
    fontSize: 36,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: 12,
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  menuItem: {
    paddingVertical: SPACING.md,
  },
  menuItemText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
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
  avatarImgLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 8,
    alignSelf: 'center',
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    alignSelf: 'center',
  },
  avatarTextLarge: {
    fontSize: 48,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'stretch',
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  avatarEditBtn: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarEditText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#fafbfc',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    marginLeft: 8,
  },
  modalBtnText: {
    fontSize: 16,
    color: COLORS.text,
  },
  modalBtnSave: {
    backgroundColor: COLORS.text,
  },
  modalBtnSaveText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

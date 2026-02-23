import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, TextInput, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { useApp } from '../context/AppContext';
import { storageService } from '../services/storageServices';

export default function ProfileScreen({ navigation }) {
    const [helpModalVisible, setHelpModalVisible] = useState(false);
  const { user, setUser, userPoints, completedTasks } = useApp();

  const [profileName, setProfileName]   = useState(user?.displayName || user?.email || 'User');
  const [profileImage, setProfileImage] = useState(user?.photoURL || null);
  const [editVisible, setEditVisible]   = useState(false);
  const [nameInput, setNameInput]       = useState(profileName);
  const [imageInput, setImageInput]     = useState(profileImage);

  // Level / XP
  const level      = Math.floor(userPoints / 100);
  const currentXP  = userPoints % 100;
  const xpProgress = (currentXP / 100) * 100;

  // Stats
  const tasksCompleted = completedTasks.length;
  const totalPoints    = userPoints;

  const handleLogout = async () => {
    try {
      const { auth } = await import('../config/firebase');
      await auth.signOut();
      setUser(null);
      navigation.replace('SignIn');
    } catch (err) {
      Alert.alert('Logout Failed', err.message);
    }
  };

  const openEdit = () => {
    setNameInput(profileName);
    setImageInput(profileImage);
    setEditVisible(true);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImageInput(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setProfileName(nameInput);
    setProfileImage(imageInput);
    if (setUser && user) setUser({ ...user, displayName: nameInput, photoURL: imageInput });
    await storageService.savePreferences({ name: nameInput, image: imageInput });
    setEditVisible(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Identity banner ── */}
        <View style={styles.banner}>
          <Text style={styles.appLabel}>PREPARENOW</Text>

          <View style={styles.identityRow}>
            {/* Avatar */}
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{profileName.charAt(0).toUpperCase()}</Text>
              </View>
            )}

            {/* Name + edit */}
            <View style={styles.identityInfo}>
              <Text style={styles.profileName}>{profileName}</Text>
              <Text style={styles.profileEmail}>{user?.email || ''}</Text>
              <TouchableOpacity style={styles.editBtn} onPress={openEdit}>
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Level bar */}
          <View style={styles.levelRow}>
            <Text style={styles.levelLabel}>LEVEL {level}</Text>
            <Text style={styles.xpLabel}>{currentXP} / 100 XP</Text>
          </View>
          <View style={styles.xpBarTrack}>
            <View style={[styles.xpBarFill, { width: `${xpProgress}%` }]} />
          </View>
          <Text style={styles.xpNext}>{100 - currentXP} XP to Level {level + 1}</Text>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statNumber}>{tasksCompleted}</Text>
            <Text style={styles.statLabel}>Tasks Done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNumber}>{totalPoints.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Points</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNumber}>{level}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
        </View>

        {/* ── Menu ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>MENU</Text>

          {[
            { label: 'Achievements',         onPress: () => {} },
            { label: 'Help & Support',        onPress: () => setHelpModalVisible(true) },
            { label: 'Developer Settings',    onPress: () => navigation.navigate('DeveloperSettings') },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity style={styles.menuItem} onPress={item.onPress} activeOpacity={0.6}>
                <Text style={styles.menuItemText}>{item.label}</Text>
                <Text style={styles.menuChevron}>›</Text>
              </TouchableOpacity>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
      {/* Help & Support Modal */}
      <Modal
        visible={helpModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 28, width: '80%', alignItems: 'center' }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>Help & Support</Text>
            <Text style={{ fontSize: 15, color: '#374151', textAlign: 'center', marginBottom: 18 }}>
              For assistance, contact us at
              <Text style={{ color: '#2563EB', fontWeight: '600' }}> support@preparenow.com </Text>
              or visit our FAQ in the app settings.
            </Text>
            <TouchableOpacity onPress={() => setHelpModalVisible(false)} style={{ marginTop: 8, backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 24 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

          <View style={styles.divider} />
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.6}>
            <Text style={styles.menuItemLogout}>Log Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        {['Home', 'Alerts', 'Prepare', 'Plan', 'Profile'].map(screen => (
          <TouchableOpacity key={screen} style={styles.footerBtn} onPress={() => navigation.navigate(screen)}>
            <Text style={[styles.footerBtnText, screen === 'Profile' && styles.footerBtnActive]}>
              {screen}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <TouchableOpacity style={styles.avatarEditArea} onPress={handlePickImage}>
              {imageInput ? (
                <Image source={{ uri: imageInput }} style={styles.modalAvatar} />
              ) : (
                <View style={styles.modalAvatarPlaceholder}>
                  <Text style={styles.modalAvatarInitial}>{nameInput.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Your name"
              autoCapitalize="words"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setEditVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleSave}>
                <Text style={styles.modalBtnSaveText}>Save</Text>
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

  // ── Banner
  banner: {
    backgroundColor: '#111827',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl + 24,
    paddingBottom: SPACING.lg,
  },
  appLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280', letterSpacing: 2, marginBottom: SPACING.md },

  identityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, marginRight: SPACING.md, borderWidth: 2, borderColor: '#374151' },
  avatarPlaceholder: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.md, borderWidth: 2, borderColor: '#374151',
  },
  avatarInitial: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },

  identityInfo:  { flex: 1 },
  profileName:   { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 2 },
  profileEmail:  { fontSize: 12, color: '#6B7280', marginBottom: SPACING.sm },
  editBtn:       { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#374151', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  editBtnText:   { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },

  levelRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  levelLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1 },
  xpLabel:    { fontSize: 11, color: '#6B7280' },
  xpBarTrack: { height: 4, backgroundColor: '#1F2937', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  xpBarFill:  { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 2 },
  xpNext:     { fontSize: 11, color: '#4B5563' },

  // ── Stats row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: 14,
    paddingVertical: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statCell:    { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#E5E7EB' },
  statNumber:  { fontSize: 30, fontWeight: '800', color: '#111827', marginBottom: 2 },
  statLabel:   { fontSize: 11, color: '#9CA3AF', fontWeight: '600', letterSpacing: 0.5 },

  // ── Card
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
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.5, marginBottom: SPACING.sm },

  menuItem:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  menuItemText:  { fontSize: 15, fontWeight: '600', color: '#111827' },
  menuItemLogout:{ fontSize: 15, fontWeight: '600', color: '#DC2626' },
  menuChevron:   { fontSize: 18, color: '#D1D5DB' },
  divider:       { height: 1, backgroundColor: '#F3F4F6' },

  // ── Footer
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

  // ── Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.lg,
    width: '88%',
    maxWidth: 400,
  },
  modalTitle:   { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: SPACING.lg },

  avatarEditArea:         { alignItems: 'center', marginBottom: SPACING.lg },
  modalAvatar:            { width: 88, height: 88, borderRadius: 44, marginBottom: 8 },
  modalAvatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  modalAvatarInitial:     { fontSize: 36, fontWeight: '800', color: '#FFFFFF' },
  changePhotoText:        { fontSize: 13, color: '#6B7280', fontWeight: '600' },

  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: SPACING.md,
    fontSize: 15,
    marginBottom: SPACING.md,
    color: '#111827',
  },
  modalBtns:          { flexDirection: 'row', gap: SPACING.sm },
  modalBtnCancel:     { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalBtnSave:       { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#111827' },
  modalBtnSaveText:   { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { storageService } from '../services/storageServices';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../constants/theme';

export default function PlanScreen({ navigation }) {
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

  const EMERGENCY_CONTACTS = [
    { label: 'Emergency Services', number: '911' },
    { label: 'Police Department', number: '911' },
    { label: 'Fire Department', number: '911' },
    { label: 'Poison Control', number: '1-800-222-1222' },
    { label: 'Local Hospital', number: '' },
    { label: 'Family Doctor', number: '' },
    { label: 'Insurance Provider', number: '' },
  ];

  const handleCall = (number) => {
    if (number) {
      Linking.openURL(`tel:${number}`);
    }
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
    Alert.alert(
      'Remove Document',
      'Are you sure you want to remove this document?',
      [
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
      ]
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Load family members
    const membersResult = await storageService.get('family_members');
    if (membersResult && membersResult.data) {
      setFamilyMembers(JSON.parse(membersResult.data));
    }

    // Load meeting points
    const primaryResult = await storageService.get('primary_meeting_point');
    if (primaryResult && primaryResult.data) {
      setPrimaryMeeting(primaryResult.data);
    }

    const secondaryResult = await storageService.get('secondary_meeting_point');
    if (secondaryResult && secondaryResult.data) {
      setSecondaryMeeting(secondaryResult.data);
    }

    // Load uploaded documents
    const docsResult = await storageService.get('uploaded_docs');
    if (docsResult && docsResult.data) {
      setUploadedDocs(JSON.parse(docsResult.data));
    }
  };

  const addFamilyMember = async () => {
    setShowAddMemberModal(false);
    if (!newMember.name) {
      Alert.alert('Error', 'Please enter a name');
      setShowAddMemberModal(true);
      return;
    }
    const updatedMembers = [
      ...familyMembers,
      { ...newMember, id: Date.now().toString() }
    ];
    setFamilyMembers(updatedMembers);
    await storageService.set('family_members', JSON.stringify(updatedMembers));
    setNewMember({ name: '', relationship: '' });
  };

  const startEditMember = (member) => {
    setEditMember(member);
    setShowEditMemberModal(true);
  };

  const saveEditMember = async () => {
    if (!editMember.name) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    const updatedMembers = familyMembers.map(m => m.id === editMember.id ? editMember : m);
    setFamilyMembers(updatedMembers);
    await storageService.set('family_members', JSON.stringify(updatedMembers));
    setEditMember(null);
    setShowEditMemberModal(false);
  };

  const deleteFamilyMember = async (id) => {
    Alert.alert(
      'Delete Member',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedMembers = familyMembers.filter(m => m.id !== id);
            setFamilyMembers(updatedMembers);
            await storageService.set('family_members', JSON.stringify(updatedMembers));
          },
        },
      ]
    );
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

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Plan your Safety</Text>
          <Text style={styles.subtitle}>Manage your family safety plan</Text>
        </View>

        <View style={styles.content}>
          {/* Family Members Section */}
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
                    <Text style={styles.avatarText} accessibilityLabel={`Avatar for ${member.name}`}>
                      {member.name ? member.name.charAt(0).toUpperCase() : '?'}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    {member.relationship ? (
                      <Text style={styles.memberRelation}>{member.relationship}</Text>
                    ) : null}
                  </View>
                  <View style={styles.memberActions}>
                    <TouchableOpacity
                      onPress={() => startEditMember(member)}
                      style={styles.editIconButton}
                      accessibilityLabel={`Edit ${member.name}`}
                    >
                      <Text style={styles.editIcon}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteFamilyMember(member.id)}
                      style={styles.deleteButton}
                      accessibilityLabel={`Delete ${member.name}`}
                    >
                      <Text style={styles.deleteText}>×</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Meeting Points Section */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>MEETING POINTS</Text>
            <View style={styles.meetingCard}>
              <View style={styles.meetingRow}>
                <View style={styles.meetingInfo}>
                  <Text style={styles.meetingLabel}>Primary</Text>
                  <Text style={styles.meetingLocation}>{primaryMeeting}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setTempLocation(primaryMeeting);
                    setShowEditPrimaryModal(true);
                  }}
                  accessibilityLabel="Edit primary meeting point"
                >
                  <Text style={styles.editButton}>Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.meetingRow, styles.meetingRowLast]}>
                <View style={styles.meetingInfo}>
                  <Text style={styles.meetingLabel}>Secondary</Text>
                  <Text style={[
                    styles.meetingLocation,
                    secondaryMeeting === '[Set Location]' && styles.placeholderText
                  ]}>
                    {secondaryMeeting}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setTempLocation(secondaryMeeting === '[Set Location]' ? '' : secondaryMeeting);
                    setShowEditSecondaryModal(true);
                  }}
                  accessibilityLabel="Edit secondary meeting point"
                >
                  <Text style={styles.editButton}>
                    {secondaryMeeting === '[Set Location]' ? 'Set' : 'Edit'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Resources Section */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>RESOURCES</Text>
            <View style={styles.resourcesCard}>
              <TouchableOpacity
                style={styles.resourceRow}
                onPress={() => setShowEmergencyContactsModal(true)}
                accessibilityLabel="Show Emergency Contacts"
              >
                <Text style={styles.resourceText}>Emergency Contacts</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.resourceRow}
                onPress={() => setShowImportantDocsModal(true)}
                accessibilityLabel="Show Important Docs"
              >
                <Text style={styles.resourceText}>Important Docs</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate('Home')}
          accessibilityLabel="Go to Home"
        >
          <Text style={styles.footerButtonText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate('Alerts')}
          accessibilityLabel="Go to Alerts"
        >
          <Text style={styles.footerButtonText}>Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate('Prepare')}
          accessibilityLabel="Go to Prepare"
        >
          <Text style={styles.footerButtonText}>Prepare</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate('Plan')}
          accessibilityLabel="Go to Plan"
        >
          <Text style={[styles.footerButtonText, styles.footerButtonActive]}>Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.footerButton}
          onPress={() => navigation.navigate('Profile')}
          accessibilityLabel="Go to Profile"
        >
          <Text style={styles.footerButtonText}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Emergency Contacts Modal */}
      <Modal
        visible={showEmergencyContactsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEmergencyContactsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}> 
            <Text style={styles.modalTitle}>Emergency Contacts</Text>
            <Text style={styles.subtitle}>
              Keep these numbers handy for quick access in case of an emergency. Tap to call.
            </Text>
            <ScrollView style={{ marginBottom: 16 }}>
              {EMERGENCY_CONTACTS.map((contact, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.contactCard}
                  onPress={() => handleCall(contact.number)}
                  disabled={!contact.number}
                  accessibilityLabel={`Call ${contact.label}`}
                >
                  <Text style={styles.contactLabel}>{contact.label}</Text>
                  <Text style={styles.contactNumber}>
                    {contact.number ? contact.number : 'Add number'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.tip}>
              Tip: You can add your own important contacts here for quick access.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowEmergencyContactsModal(false)}
                accessibilityLabel="Close emergency contacts"
              >
                <Text style={styles.modalButtonTextCancel}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Important Docs Modal */}
      <Modal
        visible={showImportantDocsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowImportantDocsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}> 
            <Text style={styles.modalTitle}>Important Documents</Text>
            <Text style={styles.subtitle}>
              Upload and keep your important documents handy for emergencies.
            </Text>
            
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={handlePickDocument}
              accessibilityLabel="Upload File"
            >
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
                      <Text style={styles.docSize}>
                        {doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeDocument(idx)}
                      style={styles.deleteButton}
                      accessibilityLabel={`Remove ${doc.name}`}
                    >
                      <Text style={styles.deleteText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowImportantDocsModal(false)}
                accessibilityLabel="Close important docs"
              >
                <Text style={styles.modalButtonTextCancel}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Family Member Modal */}
      <Modal
        visible={showAddMemberModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Family Member</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={newMember.name}
              onChangeText={(text) => setNewMember({ ...newMember, name: text })}
              accessibilityLabel="Family member name"
            />
            <TextInput
              style={styles.input}
              placeholder="Relationship (optional)"
              value={newMember.relationship}
              onChangeText={(text) => setNewMember({ ...newMember, relationship: text })}
              accessibilityLabel="Family member relationship"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setNewMember({ name: '', relationship: '' });
                  setShowAddMemberModal(false);
                }}
                accessibilityLabel="Cancel add family member"
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAdd]}
                onPress={addFamilyMember}
                accessibilityLabel="Add family member"
              >
                <Text style={styles.modalButtonTextAdd}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Family Member Modal */}
      <Modal
        visible={showEditMemberModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Family Member</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={editMember?.name || ''}
              onChangeText={(text) => setEditMember({ ...editMember, name: text })}
              accessibilityLabel="Edit family member name"
            />
            <TextInput
              style={styles.input}
              placeholder="Relationship (optional)"
              value={editMember?.relationship || ''}
              onChangeText={(text) => setEditMember({ ...editMember, relationship: text })}
              accessibilityLabel="Edit family member relationship"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setEditMember(null);
                  setShowEditMemberModal(false);
                }}
                accessibilityLabel="Cancel edit family member"
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAdd]}
                onPress={saveEditMember}
                accessibilityLabel="Save family member changes"
              >
                <Text style={styles.modalButtonTextAdd}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Primary Meeting Point Modal */}
      <Modal
        visible={showEditPrimaryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditPrimaryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Primary Meeting Point</Text>
            <TextInput
              style={styles.input}
              placeholder="Location"
              value={tempLocation}
              onChangeText={setTempLocation}
              accessibilityLabel="Edit primary meeting point"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setTempLocation('');
                  setShowEditPrimaryModal(false);
                }}
                accessibilityLabel="Cancel edit primary meeting point"
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAdd]}
                onPress={updatePrimaryMeeting}
                accessibilityLabel="Save primary meeting point"
              >
                <Text style={styles.modalButtonTextAdd}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Secondary Meeting Point Modal */}
      <Modal
        visible={showEditSecondaryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditSecondaryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Secondary Meeting Point</Text>
            <TextInput
              style={styles.input}
              placeholder="Location"
              value={tempLocation}
              onChangeText={setTempLocation}
              accessibilityLabel="Edit secondary meeting point"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setTempLocation('');
                  setShowEditSecondaryModal(false);
                }}
                accessibilityLabel="Cancel edit secondary meeting point"
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonAdd]}
                onPress={updateSecondaryMeeting}
                accessibilityLabel="Save secondary meeting point"
              >
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: SPACING.lg,
    paddingTop: SPACING.xxl + 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontSize: 16,
  },
  content: {
    padding: SPACING.lg,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
    padding: SPACING.md,
    ...SHADOWS.card,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  addCircleButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
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
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  memberInfo: {
    flex: 1,
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SPACING.md,
  },
  editIconButton: {
    padding: SPACING.sm,
    marginRight: 2,
  },
  editIcon: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: '700',
  },
  deleteButton: {
    padding: SPACING.sm,
  },
  deleteText: {
    fontSize: 28,
    color: COLORS.textSecondary,
    fontWeight: '300',
  },
  memberName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 16,
  },
  memberRelation: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
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
  contactLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 16,
  },
  contactNumber: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 16,
  },
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
  docInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  docName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 14,
  },
  docSize: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontSize: 12,
  },
  tip: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: SPACING.md,
    fontSize: 12,
  },
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
  meetingRowLast: {
    borderBottomWidth: 0,
  },
  meetingInfo: {
    flex: 1,
  },
  meetingLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  meetingLocation: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 16,
  },
  placeholderText: {
    color: COLORS.textSecondary,
  },
  editButton: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
    fontSize: 14,
  },
  resourcesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xl,
  },
  resourceRow: {
    padding: SPACING.md,
  },
  resourceText: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
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
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  modalButton: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtonAdd: {
    backgroundColor: COLORS.primary,
  },
  modalButtonTextCancel: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  modalButtonTextAdd: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  uploadButtonText: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
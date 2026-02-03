import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useApp } from '../context/AppContext';

export default function PrepareScreen({ navigation }) {
  const { userPoints, completedTasks } = useApp();
  const [activeTab, setActiveTab] = useState('All');
  
  // Calculate user level based on points (every 100 points = 1 level)
  const userLevel = Math.floor(userPoints / 100);

  // Quiz and skills data (keeping the same structure)
  const quizData = {
    1: {
      questions: [
        { question: "What should you do if you encounter a flooded road?", options: ["Drive through slowly", "Turn around and find another route", "Wait in your car", "Test the depth first"], correct: 1 },
        { question: "How much water can sweep a vehicle away?", options: ["6 inches", "12 inches", "24 inches", "36 inches"], correct: 1 },
        { question: "What is the safest place during a flood?", options: ["Basement", "Ground floor", "Higher ground/upper floors", "Outside"], correct: 2 },
        { question: "When should you evacuate during a flood warning?", options: ["Wait until water enters home", "Immediately when ordered", "After securing belongings", "When neighbors leave"], correct: 1 },
        { question: "What should be in your flood emergency kit?", options: ["Only food and water", "Important documents in waterproof container", "Electronics", "Heavy furniture"], correct: 1 },
        { question: "How long can flash floods take to develop?", options: ["Several days", "12 hours", "6 minutes or less", "1 hour"], correct: 2 },
        { question: "What does a flood watch mean?", options: ["Flooding is occurring", "Flooding is possible", "Flooding has ended", "No flood risk"], correct: 1 },
        { question: "Should you walk through moving water?", options: ["Yes, if below knee level", "No, 6 inches can knock you down", "Yes, with a stick", "Only in emergencies"], correct: 1 },
        { question: "What should you do after a flood?", options: ["Return home immediately", "Wait for official all-clear", "Check damage right away", "Start cleanup"], correct: 1 },
        { question: "Why should you avoid floodwater?", options: ["It's cold", "Contains sewage and chemicals", "Too deep", "Moves too fast"], correct: 1 }
      ]
    },
    2: {
      questions: [
        { question: "What is the first step in any first aid situation?", options: ["Start CPR", "Check for dangers", "Call emergency services", "Move the person"], correct: 1 },
        { question: "How should you treat a severe bleeding wound?", options: ["Apply ice", "Apply direct pressure", "Elevate only", "Use a tourniquet first"], correct: 1 },
        { question: "What is the recovery position used for?", options: ["Broken bones", "Unconscious but breathing persons", "Heart attacks", "Choking"], correct: 1 },
        { question: "How do you treat a minor burn?", options: ["Apply butter", "Cool with running water for 10+ minutes", "Pop blisters", "Use ice"], correct: 1 },
        { question: "What are signs of shock?", options: ["Warm skin, alertness", "Pale, cold, rapid pulse", "Fever and sweating", "Slow breathing"], correct: 1 },
        { question: "How should you help a choking adult?", options: ["Give water", "Back blows and abdominal thrusts", "Finger sweep", "Have them lie down"], correct: 1 },
        { question: "What should a basic first aid kit contain?", options: ["Prescription medications only", "Bandages, gloves, antiseptic", "Surgical tools", "Heavy equipment"], correct: 1 },
        { question: "How long should you wash a wound with clean water?", options: ["10 seconds", "5 minutes", "30 seconds", "Until bleeding stops"], correct: 1 },
        { question: "What is the emergency number in the UK?", options: ["911", "999", "000", "112"], correct: 1 },
        { question: "How should you treat a suspected spinal injury?", options: ["Move them to safety", "Keep them still and call 999", "Sit them up", "Give them water"], correct: 1 }
      ]
    },
    6: {
      questions: [
        { question: "What should you do during an earthquake indoors?", options: ["Run outside", "Drop, Cover, Hold On", "Stand in doorway", "Use stairs"], correct: 1 },
        { question: "What is the safest place during an earthquake?", options: ["Under a sturdy table", "In a doorway", "By a window", "On stairs"], correct: 0 },
        { question: "What should you do if driving during an earthquake?", options: ["Speed up", "Stop safely away from buildings", "Exit vehicle", "Drive home quickly"], correct: 1 },
        { question: "What causes most earthquake injuries?", options: ["Ground shaking", "Falling objects", "Building collapse", "Fire"], correct: 1 },
        { question: "How long should you stay in safe position after shaking stops?", options: ["Leave immediately", "Wait for aftershocks, then move carefully", "Wait 10 minutes", "Wait 1 hour"], correct: 1 },
        { question: "What should you secure in your home before an earthquake?", options: ["Small items only", "Heavy furniture and water heaters", "Nothing needed", "Electronics only"], correct: 1 },
        { question: "What should you NOT do during an earthquake?", options: ["Drop and cover", "Use elevators", "Hold on", "Stay calm"], correct: 1 },
        { question: "What is an aftershock?", options: ["Initial earthquake", "Smaller earthquake following main one", "Warning before earthquake", "Sound during earthquake"], correct: 1 }
      ]
    },
    9: {
      questions: [
        { question: "When should you evacuate for a hurricane?", options: ["When you feel like it", "When authorities order evacuation", "After storm arrives", "Never evacuate"], correct: 1 },
        { question: "What is a hurricane watch?", options: ["Hurricane is happening", "Hurricane possible within 48 hours", "Hurricane has passed", "No danger"], correct: 1 },
        { question: "What is the safest room during a hurricane?", options: ["Room with windows", "Interior room away from windows", "Attic", "Garage"], correct: 1 },
        { question: "How much water per person should you store?", options: ["1 gallon per day for 3 days", "1 liter per week", "5 gallons total", "No need to store water"], correct: 0 },
        { question: "What should you do to prepare windows?", options: ["Open them", "Board up or use shutters", "Break them", "Nothing needed"], correct: 1 },
        { question: "What is storm surge?", options: ["Heavy rain", "Rising water pushed by hurricane", "Wind damage", "Lightning"], correct: 1 },
        { question: "When is it safe to go outside after a hurricane?", options: ["When wind stops", "When authorities give all-clear", "Immediately", "After 1 hour"], correct: 1 },
        { question: "What category hurricane has winds 111-129 mph?", options: ["Category 1", "Category 2", "Category 3", "Category 5"], correct: 2 }
      ]
    },
    10: {
      questions: [
        { question: "What should you do if trapped in a wildfire?", options: ["Run uphill", "Stay in clearing, lie flat", "Climb a tree", "Run toward fire"], correct: 1 },
        { question: "What is defensible space?", options: ["Bunker", "Buffer zone around home cleared of flammables", "Fire shelter", "Underground room"], correct: 1 },
        { question: "How far should defensible space extend?", options: ["10 feet", "30 feet minimum", "5 feet", "100 feet"], correct: 1 },
        { question: "What should you do if evacuation is ordered?", options: ["Stay and defend home", "Leave immediately", "Wait and see", "Ignore the order"], correct: 1 },
        { question: "Which way does wildfire spread fastest?", options: ["Downhill", "Uphill", "Across flat ground", "Against wind"], correct: 1 },
        { question: "What should be in your wildfire go-bag?", options: ["Garden hose", "Documents, medications, water", "Furniture", "Heavy clothing"], correct: 1 },
        { question: "When should you prepare for wildfire season?", options: ["When fire starts", "Before season begins", "During fire", "After fire passes"], correct: 1 },
        { question: "What should you wear if evacuating through smoke?", options: ["Nothing special", "Mask/cloth over face, long sleeves", "Tank top", "No protection needed"], correct: 1 }
      ]
    },
    11: {
      questions: [
        { question: "Where is the safest place during a tornado?", options: ["Upper floor", "Basement or interior room", "Near windows", "Outside"], correct: 1 },
        { question: "What is a tornado watch?", options: ["Tornado spotted", "Conditions favorable for tornadoes", "Tornado has passed", "No danger"], correct: 1 },
        { question: "What should you do if in a vehicle during a tornado?", options: ["Keep driving", "Abandon car, lie flat in ditch", "Stay in car", "Drive faster"], correct: 1 },
        { question: "What position should you take during a tornado?", options: ["Standing", "Curled up, head protected", "Lying flat", "Sitting upright"], correct: 1 },
        { question: "What does a tornado warning mean?", options: ["Tornado possible", "Tornado spotted, take shelter now", "Tornado passed", "All clear"], correct: 1 },
        { question: "Which direction do tornadoes usually move?", options: ["North to South", "Southwest to Northeast", "East to West", "Random"], correct: 1 },
        { question: "What should you avoid during a tornado?", options: ["Basement", "Windows, doors, outside walls", "Interior rooms", "Taking cover"], correct: 1 },
        { question: "How fast can tornado winds reach?", options: ["50 mph", "100 mph", "Over 300 mph", "25 mph"], correct: 2 }
      ]
    }
  };

  const skillsData = {
    3: {
      steps: ["Check the scene for safety and the person for responsiveness", "Call 999 or ask someone else to call", "Place person on firm, flat surface", "Kneel beside the person's chest", "Place heel of one hand on center of chest, other hand on top", "Position shoulders directly over hands, keep arms straight", "Push hard and fast - at least 2 inches deep", "Compress at rate of 100-120 per minute", "Allow chest to fully recoil between compressions", "Continue until help arrives or person recovers"],
      tips: ["Push to the beat of 'Stayin' Alive' by Bee Gees", "Don't stop compressions unless absolutely necessary", "If trained, give 2 breaths after every 30 compressions"]
    },
    7: {
      steps: ["Install smoke alarms on every level of your home", "Test smoke alarms monthly", "Create and practice a fire escape plan", "Identify two exits from every room", "Choose a meeting place outside", "Keep fire extinguisher accessible", "Learn PASS technique: Pull, Aim, Squeeze, Sweep", "Never go back inside a burning building", "Stop, Drop, and Roll if clothes catch fire", "Crawl low under smoke to escape"],
      tips: ["Replace smoke alarm batteries yearly", "Practice escape plan twice a year", "Keep bedroom doors closed at night"]
    },
    12: {
      steps: ["Ask 'Are you choking?' - if they can't speak, they need help", "Stand behind the person", "Make a fist with one hand", "Place fist just above their navel", "Grasp fist with other hand", "Give quick upward thrusts (abdominal thrusts)", "Repeat 5 times", "Alternate with 5 back blows between shoulder blades", "Continue until object is expelled or person becomes unconscious", "If unconscious, begin CPR and call 999"],
      tips: ["For infants, use back blows and chest thrusts only", "Never perform on someone who can cough or speak", "Take a first aid course to practice properly"]
    },
    13: {
      steps: ["Ensure scene is safe before approaching", "Put on gloves if available", "Have person lie down if possible", "Remove any obvious debris (don't probe wound)", "Apply direct pressure with clean cloth", "Maintain pressure for at least 10 minutes", "Add more cloth if blood soaks through (don't remove first cloth)", "Elevate injured area above heart if possible", "Apply pressure to arterial pressure point if needed", "Call 999 for severe bleeding"],
      tips: ["Don't use tourniquet unless trained and bleeding is life-threatening", "Don't remove embedded objects", "Watch for signs of shock"]
    },
    14: {
      steps: ["Remove person from heat source safely", "Remove jewelry and tight clothing before swelling starts", "Cool burn with running water for 10-20 minutes", "Do NOT use ice", "Cover with sterile, non-stick dressing", "Do NOT pop blisters", "Give over-the-counter pain reliever if needed", "Seek medical help for: large burns, deep burns, burns on face/hands/joints", "Watch for signs of infection", "Keep burn clean and covered"],
      tips: ["Never use butter, oils, or ointments on burns", "Third-degree burns require immediate emergency care", "Chemical burns require 20+ minutes of flushing"]
    }
  };

  // Base tasks - merge with completion status from context
  const tasks = [
    { id: 1, title: 'Flood Safety Quiz', type: 'quiz', questions: 10, duration: 5, points: 30, featured: true, data: quizData[1] },
    { id: 2, title: 'First Aid Essentials', type: 'quiz', questions: 10, duration: 7, points: 50, data: quizData[2] },
    { id: 3, title: 'CPR Skills', type: 'skill', duration: 15, points: 75, interactive: true, data: skillsData[3] },
    { id: 4, title: 'Emergency Kit Check', type: 'task', duration: 10, points: 40 },
    { id: 5, title: 'Evacuation Route Planning', type: 'task', duration: 12, points: 45 },
    { id: 6, title: 'Earthquake Preparedness', type: 'quiz', questions: 8, duration: 6, points: 35, data: quizData[6] },
    { id: 7, title: 'Fire Safety Basics', type: 'skill', duration: 10, points: 60, interactive: true, data: skillsData[7] },
    { id: 8, title: 'Storm Preparation', type: 'task', duration: 8, points: 35 },
    { id: 9, title: 'Hurricane Preparedness', type: 'quiz', questions: 8, duration: 6, points: 40, data: quizData[9] },
    { id: 10, title: 'Wildfire Safety', type: 'quiz', questions: 8, duration: 6, points: 40, data: quizData[10] },
    { id: 11, title: 'Tornado Safety', type: 'quiz', questions: 8, duration: 5, points: 35, data: quizData[11] },
    { id: 12, title: 'Choking Response', type: 'skill', duration: 12, points: 70, interactive: true, data: skillsData[12] },
    { id: 13, title: 'Severe Bleeding Control', type: 'skill', duration: 15, points: 70, interactive: true, data: skillsData[13] },
    { id: 14, title: 'Burn Treatment', type: 'skill', duration: 10, points: 65, interactive: true, data: skillsData[14] }
  ].map(task => ({ ...task, completed: completedTasks.includes(task.id) }));

  const filterTasks = () => {
    if (activeTab === 'All') return tasks;
    if (activeTab === 'Quizzes') return tasks.filter(t => t.type === 'quiz');
    if (activeTab === 'Skills') return tasks.filter(t => t.type === 'skill');
    if (activeTab === 'Completed') return tasks.filter(t => t.completed);
    return tasks;
  };

  const filteredTasks = filterTasks();
  const progressPercentage = userPoints > 0 ? ((userPoints % 100) / 100) * 100 : 0;

  const handleTaskClick = (task) => {
    if (task.type === 'quiz' && task.data) {
      navigation.navigate('Quiz', { taskId: task.id, title: task.title, questions: task.data.questions, points: task.points });
    } else if (task.type === 'skill' && task.data) {
      navigation.navigate('Skill', { taskId: task.id, title: task.title, steps: task.data.steps, tips: task.data.tips, points: task.points });
    } else if (task.type === 'task') {
      navigation.navigate('Task', { taskId: task.id, title: task.title, duration: task.duration, points: task.points });
    }
  };

  const renderTaskCard = (task) => (
    <TouchableOpacity key={task.id} style={styles.taskCard} onPress={() => handleTaskClick(task)} activeOpacity={0.7}>
      <View style={styles.taskHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          {task.featured && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredBadgeText}>FEATURED</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.taskMeta}>
        {task.questions && (<><Text style={styles.taskMetaText}>{task.questions} questions</Text><Text style={styles.taskMetaSeparator}>•</Text></>)}
        <Text style={styles.taskMetaText}>{task.duration} mins</Text>
        <Text style={styles.taskMetaSeparator}>•</Text>
        <Text style={styles.taskMetaPoints}>+{task.points} pts</Text>
        {task.interactive && (<><Text style={styles.taskMetaSeparator}>•</Text><View style={styles.interactiveBadge}><Text style={styles.interactiveBadgeText}>INTERACTIVE</Text></View></>)}
      </View>
      {task.completed && (<View style={styles.completedBadge}><Text style={styles.completedBadgeText}>✓ Completed</Text></View>)}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PrepareNow</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.points}>{userPoints.toLocaleString()}</Text>
              <Text style={styles.pointsLabel}>Total Points</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Level {userLevel}</Text>
            </View>
          </View>
          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabelText}>Progress to Level {userLevel + 1}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
            </View>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer} contentContainerStyle={styles.tabsContent}>
          {['All', 'Quizzes', 'Skills', 'Completed'].map((tab) => (
            <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && styles.tabActive]} activeOpacity={0.7}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.tasksSection}>
          <Text style={styles.sectionHeader}>PREPAREDNESS TASKS</Text>
          {filteredTasks.length > 0 ? filteredTasks.map(renderTaskCard) : (
            <View style={styles.emptyState}><Text style={styles.emptyStateText}>No tasks in this category yet</Text></View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.footerButtonText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Alerts')}>
          <Text style={styles.footerButtonText}>Alerts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('Prepare')}>
          <Text style={[styles.footerButtonText, styles.footerButtonActive]}>Prepare</Text>
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
  header: { padding: SPACING.lg, paddingTop: SPACING.xxl + 20, backgroundColor: COLORS.background },
  backButton: { marginBottom: SPACING.sm, alignSelf: 'flex-start' },
  backButtonText: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '600', fontSize: 16 },
  headerTitle: { ...TYPOGRAPHY.h1, color: COLORS.text, fontWeight: '700', fontSize: 24 },
  scrollView: { flex: 1 },
  progressCard: { backgroundColor: '#000', borderRadius: 24, padding: 24, margin: SPACING.md, marginTop: SPACING.sm },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  points: { fontSize: 48, fontWeight: '700', color: '#FFFFFF', lineHeight: 52 },
  pointsLabel: { fontSize: 16, color: '#9CA3AF', marginTop: 4 },
  levelBadge: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  levelBadgeText: { fontSize: 16, fontWeight: '700', color: '#000' },
  progressSection: { marginTop: 16 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabelText: { fontSize: 14, color: '#9CA3AF' },
  progressBar: { backgroundColor: '#374151', height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { backgroundColor: '#FFFFFF', height: '100%', borderRadius: 4 },
  tabsContainer: { paddingHorizontal: SPACING.md, marginVertical: SPACING.md },
  tabsContent: { paddingRight: SPACING.md },
  tab: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, marginRight: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  tabActive: { backgroundColor: '#000', borderColor: '#000' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  tabTextActive: { color: '#FFFFFF' },
  tasksSection: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.lg },
  sectionHeader: { fontSize: 12, fontWeight: '600', color: '#6B7280', letterSpacing: 0.5, marginBottom: 12 },
  taskCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  taskTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  featuredBadge: { backgroundColor: '#000', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 4 },
  featuredBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  taskMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 12 },
  taskMetaText: { fontSize: 14, color: '#6B7280', marginRight: 8 },
  taskMetaSeparator: { fontSize: 14, color: '#D1D5DB', marginRight: 8 },
  taskMetaPoints: { fontSize: 14, fontWeight: '700', color: '#10B981', marginRight: 8 },
  interactiveBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  interactiveBadgeText: { fontSize: 11, fontWeight: '600', color: '#1D4ED8' },
  completedBadge: { backgroundColor: '#F0FDF4', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginTop: 12 },
  completedBadgeText: { fontSize: 14, fontWeight: '600', color: '#15803D', textAlign: 'center' },
  emptyState: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 48, paddingHorizontal: 32, alignItems: 'center' },
  emptyStateText: { fontSize: 16, color: '#9CA3AF', textAlign: 'center' },
  footer: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderTopWidth: 2, borderTopColor: COLORS.text, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xs, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 3, position: 'absolute', bottom: 0, left: 0, right: 0 },
  footerButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.sm },
  footerButtonText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, fontWeight: '600', fontSize: 12 },
  footerButtonActive: { color: COLORS.text, fontWeight: '700' }
});
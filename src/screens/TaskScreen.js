import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { useApp } from '../context/AppContext';

export default function TaskScreen({ route, navigation }) {
  const { taskId, title, duration, points } = route.params;
  const { updatePoints, markTaskComplete } = useApp();
  const [taskCompleted, setTaskCompleted] = useState(false);

  // Task descriptions for each task type
  const taskDescriptions = {
    4: {
      title: 'Emergency Kit Check',
      description: 'Create and verify your emergency preparedness kit contains all essential items',
      checklist: [
        'Water (1 gallon per person per day, 3-day supply)',
        'Non-perishable food for 3 days',
        'Battery-powered or hand crank radio',
        'Flashlight and extra batteries',
        'First aid kit',
        'Prescription medications and medical equipment',
        'Infant formula and diapers',
        'Pet food and water',
        'Important documents in waterproof container',
        'Cash and credit cards',
        'Whistle for signaling help',
        'Dust mask or N95 respirator',
        'Plastic sheeting and duct tape',
        'Moist towelettes and garbage bags',
        'Wrench or pliers to turn off utilities',
      ]
    },
    5: {
      title: 'Evacuation Route Planning',
      description: 'Plan multiple evacuation routes from your home and practice with family',
      checklist: [
        'Identify 2-3 evacuation routes from your home',
        'Map out primary and alternate routes to safety',
        'Locate nearest emergency shelters',
        'Identify out-of-state contact person',
        'Choose a family meeting place outside your neighborhood',
        'Practice evacuation drill with family',
        'Practice with children to ensure they understand',
        'Know how to turn off gas, water, and electricity',
        'Create a household emergency contact list',
        'Share plan with family members and neighbors',
      ]
    },
    8: {
      title: 'Storm Preparation',
      description: 'Prepare your home and family for severe weather events',
      checklist: [
        'Know your area\'s weather risks (hurricanes, tornadoes, etc.)',
        'Sign up for weather alerts on your phone',
        'Identify safe room in your home',
        'Trim trees and secure outdoor items',
        'Check roof and gutters for damage',
        'Have plywood or storm shutters ready',
        'Know how to turn off utilities',
        'Stock supplies: water, food, first aid, medications',
        'Have battery-powered flashlights and radio ready',
        'Keep important documents accessible and protected',
      ]
    }
  };

  const task = taskDescriptions[taskId] || {
    title,
    description: `Complete this important preparedness task: ${title}`,
    checklist: ['Review and complete all items for this task']
  };

  const handleCompleteTask = async () => {
    const earnedPoints = points;
    await updatePoints(earnedPoints);
    await markTaskComplete(taskId);
    setTaskCompleted(true);
  };

  const handleBackToHome = () => {
    navigation.navigate('Prepare');
  };

  if (taskCompleted) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBackToHome}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Task Completed</Text>
          </View>

          {/* Results Card */}
          <View style={styles.resultsContainer}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreText}>✓</Text>
            </View>
            
            <Text style={styles.resultTitle}>Great Work! 🎉</Text>
            
            <Text style={styles.resultSubtitle}>You've completed {title}</Text>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Points Earned</Text>
                <Text style={styles.statValue}>+{points}</Text>
              </View>
            </View>

            <View style={styles.feedbackContainer}>
              <Text style={styles.feedbackText}>
                Excellent work! You've completed an important preparedness task. Stay ready and stay safe!
              </Text>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleBackToHome}>
              <Text style={styles.primaryButtonText}>Back to Prepare</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackToHome}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{task.title}</Text>
        </View>

        {/* Task Description */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionText}>{task.description}</Text>
        </View>

        {/* Checklist */}
        <View style={styles.checklistCard}>
          <Text style={styles.checklistTitle}>Checklist:</Text>
          {task.checklist.map((item, index) => (
            <View key={index} style={styles.checklistItem}>
              <Text style={styles.checklistDot}>✓</Text>
              <Text style={styles.checklistItemText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Information */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Duration</Text>
          <Text style={styles.infoValue}>{duration} minutes</Text>
          <Text style={[styles.infoLabel, { marginTop: SPACING.md }]}>Points Available</Text>
          <Text style={styles.infoValue}>+{points} pts</Text>
        </View>

        {/* Completion Button */}
        <TouchableOpacity style={styles.completeButton} onPress={handleCompleteTask}>
          <Text style={styles.completeButtonText}>Mark Task Complete</Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingBottom: SPACING.lg,
  },
  header: {
    paddingTop: SPACING.xxl + 20,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  backButton: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    fontWeight: '700',
  },
  descriptionCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.text,
    ...SHADOWS.md,
  },
  descriptionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    lineHeight: 22,
  },
  checklistCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.text,
    ...SHADOWS.md,
  },
  checklistTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  checklistItem: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  checklistDot: {
    fontSize: 16,
    color: COLORS.success,
    marginRight: SPACING.md,
    fontWeight: 'bold',
  },
  checklistItemText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    flex: 1,
    lineHeight: 20,
  },
  infoCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
  },
  infoLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  infoValue: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    fontWeight: '700',
  },
  completeButton: {
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.text,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  completeButtonText: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  resultsContainer: {
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  scoreCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.success,
    ...SHADOWS.lg,
  },
  scoreText: {
    fontSize: 80,
    fontWeight: '700',
    color: '#000000',
  },
  resultTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  resultSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.text,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  statValue: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    fontWeight: '700',
  },
  feedbackContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
  },
  feedbackText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.text,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

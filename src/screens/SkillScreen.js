import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { useApp } from '../context/AppContext';

export default function SkillScreen({ route, navigation }) {
  const { taskId, title, steps, tips, points } = route.params;
  const { updatePoints, markTaskComplete } = useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [skillCompleted, setSkillCompleted] = useState(false);

  const handleStepComplete = (stepIndex) => {
    if (!completedSteps.includes(stepIndex)) {
      const updated = [...completedSteps, stepIndex];
      setCompletedSteps(updated);
    }
  };

  const handleCompleteSkill = async () => {
    // Award full points for completing the skill
    await updatePoints(points);
    await markTaskComplete(taskId);
    setSkillCompleted(true);
  };

  const handleBackToHome = () => {
    navigation.navigate('Prepare');
  };

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleRetakeSkill = () => {
    setCurrentStep(0);
    setCompletedSteps([]);
    setSkillCompleted(false);
  };

  const isLastStep = currentStep === steps.length - 1;
  const earnedPoints = points;

  if (skillCompleted) {
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBackToHome}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Skill Completed</Text>
          </View>

          {/* Results Card */}
          <View style={styles.resultsContainer}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreText}>✓</Text>
            </View>
            
            <Text style={styles.resultTitle}>Congratulations! 🎉</Text>
            
            <Text style={styles.resultSubtitle}>You've completed the {title} skill training</Text>

            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Steps Reviewed</Text>
                <Text style={styles.statValue}>{steps.length}/{steps.length}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Points Earned</Text>
                <Text style={styles.statValue}>+{earnedPoints}</Text>
              </View>
            </View>

            <View style={styles.feedbackContainer}>
              <Text style={styles.feedbackText}>
                You've successfully learned this critical skill. Practice regularly to maintain your proficiency!
              </Text>
            </View>

            <TouchableOpacity style={styles.reviewButton} onPress={handleRetakeSkill}>
              <Text style={styles.reviewButtonText}>Review Again</Text>
            </TouchableOpacity>
            
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
          <Text style={styles.headerTitle}>{title}</Text>
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${((currentStep + 1) / steps.length) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            Step {currentStep + 1} of {steps.length}
          </Text>
        </View>

        {/* Step Card */}
        <View style={styles.stepCard}>
          <View style={styles.stepNumberContainer}>
            <Text style={styles.stepNumber}>{currentStep + 1}</Text>
          </View>
          
          <Text style={styles.stepText}>{steps[currentStep]}</Text>

          {!completedSteps.includes(currentStep) && (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => handleStepComplete(currentStep)}
            >
              <Text style={styles.completeButtonText}>Mark as Done</Text>
            </TouchableOpacity>
          )}
          
          {completedSteps.includes(currentStep) && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedBadgeText}>✓ Completed</Text>
            </View>
          )}
        </View>

        {/* Tips Section */}
        {tips && tips.length > 0 && (
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>💡 Tips</Text>
            {tips.map((tip, index) => (
              <View key={index} style={styles.tipItem}>
                <Text style={styles.tipDot}>•</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* All Steps Overview */}
        <View style={styles.stepsOverviewCard}>
          <Text style={styles.overviewTitle}>Progress</Text>
          <View style={styles.stepsOverview}>
            {steps.map((_, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.stepCircle,
                  {
                    backgroundColor: index === currentStep 
                      ? COLORS.text 
                      : completedSteps.includes(index) 
                      ? COLORS.success 
                      : COLORS.surface,
                    borderColor: index === currentStep ? COLORS.text : COLORS.borderLight,
                  }
                ]}
                onPress={() => setCurrentStep(index)}
              >
                <Text style={[
                  styles.stepCircleText,
                  {
                    color: (index === currentStep || completedSteps.includes(index)) 
                      ? '#FFFFFF' 
                      : COLORS.text,
                    fontWeight: completedSteps.includes(index) ? 'bold' : '500',
                  }
                ]}>
                  {completedSteps.includes(index) ? '✓' : index + 1}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Navigation Buttons */}
        <View style={styles.navigationContainer}>
          {!isLastStep ? (
            <>
              <TouchableOpacity
                style={[styles.navButton, currentStep === 0 && styles.navButtonDisabled]}
                onPress={handlePreviousStep}
                disabled={currentStep === 0}
              >
                <Text style={styles.navButtonText}>← Previous</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.navButton}
                onPress={handleNextStep}
              >
                <Text style={styles.navButtonText}>Next →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.completeSkillButton}
              onPress={handleCompleteSkill}
            >
              <Text style={styles.completeSkillButtonText}>Complete Skill</Text>
            </TouchableOpacity>
          )}
        </View>
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
  progressSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.borderLight,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.text,
    borderRadius: BORDER_RADIUS.full,
  },
  progressText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  stepCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.text,
    ...SHADOWS.md,
  },
  stepNumberContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.text,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  stepNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: SPACING.lg,
    lineHeight: 24,
  },
  completeButton: {
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.success,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  completeButtonText: {
    ...TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  completedBadge: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#E8F5E9',
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  completedBadgeText: {
    ...TYPOGRAPHY.body,
    color: COLORS.success,
    fontWeight: '600',
  },
  tipsCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: '#FFF8E1',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: '#FFD54F',
  },
  tipsTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  tipDot: {
    fontSize: 18,
    color: COLORS.text,
    marginRight: SPACING.sm,
    fontWeight: 'bold',
  },
  tipText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    flex: 1,
    lineHeight: 20,
  },
  stepsOverviewCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  overviewTitle: {
    ...TYPOGRAPHY.h4,
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  stepsOverview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  stepCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  stepCircleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  navigationContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  navButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.text,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  completeSkillButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.text,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  completeSkillButtonText: {
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
  },
  statItem: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  statDivider: {
    width: 2,
    backgroundColor: COLORS.borderLight,
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
  reviewButton: {
    paddingVertical: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.text,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  reviewButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
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
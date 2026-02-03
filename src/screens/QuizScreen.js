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

export default function QuizScreen({ route, navigation }) {
  const { taskId, title, questions, points } = route.params;
  const { updatePoints, markTaskComplete } = useApp();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [completedQuiz, setCompletedQuiz] = useState(false);

  const handleAnswerSelect = (index) => {
    if (answered) return;
    
    setSelectedAnswer(index);
    const isCorrect = index === questions[currentQuestion].correct;
    
    if (isCorrect) {
      setScore(score + 1);
    }
    
    setAnswered(true);
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    } else {
      setCompletedQuiz(true);
    }
  };

  const handleRetakeQuiz = () => {
    setCurrentQuestion(0);
    setScore(0);
    setAnswered(false);
    setSelectedAnswer(null);
    setCompletedQuiz(false);
  };

  const handleBackToHome = async () => {
    if (completedQuiz) {
      const scorePercentage = Math.round((score / questions.length) * 100);
      const earnedPoints = Math.round((scorePercentage / 100) * points);
      if (scorePercentage >= 70) {
        await updatePoints(earnedPoints);
        await markTaskComplete(taskId);
      }
    }
    navigation.navigate('Prepare');
  };

  const question = questions[currentQuestion];
  const correctAnswer = question.correct;
  const scorePercentage = Math.round((score / questions.length) * 100);
  const earnedPoints = Math.round((scorePercentage / 100) * points);

  if (completedQuiz) {
    const passed = scorePercentage >= 70;
    
    return (
      <View style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBackToHome}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Quiz Complete</Text>
          </View>

          {/* Results Card */}
          <View style={styles.resultsContainer}>
            <View style={[styles.scoreCircle, { backgroundColor: passed ? COLORS.success : COLORS.danger }]}>
              <Text style={styles.scoreText}>{scorePercentage}%</Text>
            </View>
            
            <Text style={styles.resultTitle}>{passed ? 'Great Job! 🎉' : 'Keep Practicing'}</Text>
            
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Correct</Text>
                <Text style={styles.statValue}>{score}/{questions.length}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Points Earned</Text>
                <Text style={styles.statValue}>+{earnedPoints}</Text>
              </View>
            </View>

            <View style={styles.feedbackContainer}>
              <Text style={styles.feedbackText}>
                {passed 
                  ? 'Excellent work! You\'ve mastered this topic. Move on to the next challenge.'
                  : 'Good effort! Review the material and try again to improve your score.'
                }
              </Text>
            </View>

            {!passed && (
              <TouchableOpacity style={styles.retakeButton} onPress={handleRetakeQuiz}>
                <Text style={styles.retakeButtonText}>Retake Quiz</Text>
              </TouchableOpacity>
            )}
            
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
                { width: `${((currentQuestion + 1) / questions.length) * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            Question {currentQuestion + 1} of {questions.length}
          </Text>
        </View>

        {/* Question Card */}
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{question.question}</Text>

          {/* Answer Options */}
          <View style={styles.optionsContainer}>
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrect = index === correctAnswer;
              let backgroundColor = COLORS.surface;
              let borderColor = COLORS.borderLight;

              if (answered) {
                if (isCorrect) {
                  backgroundColor = '#E8F5E9';
                  borderColor = COLORS.success;
                } else if (isSelected && !isCorrect) {
                  backgroundColor = '#FFEBEE';
                  borderColor = COLORS.danger;
                }
              } else if (isSelected) {
                backgroundColor = COLORS.surfaceActive;
                borderColor = COLORS.text;
              }

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor,
                      borderColor,
                    }
                  ]}
                  onPress={() => handleAnswerSelect(index)}
                  disabled={answered}
                >
                  <Text style={[
                    styles.optionText,
                    isSelected && answered && { fontWeight: '600' }
                  ]}>
                    {option}
                  </Text>
                  {answered && isCorrect && <Text style={styles.checkmark}>✓</Text>}
                  {answered && isSelected && !isCorrect && <Text style={styles.xmark}>✗</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Feedback */}
          {answered && (
            <View style={[
              styles.feedbackBox,
              { backgroundColor: selectedAnswer === correctAnswer ? '#E8F5E9' : '#FFEBEE' }
            ]}>
              <Text style={[
                styles.feedbackBoxText,
                { color: selectedAnswer === correctAnswer ? COLORS.success : COLORS.danger }
              ]}>
                {selectedAnswer === correctAnswer ? '✓ Correct!' : '✗ Incorrect'}
              </Text>
            </View>
          )}
        </View>

        {/* Next Button */}
        {answered && (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNextQuestion}
          >
            <Text style={styles.nextButtonText}>
              {currentQuestion === questions.length - 1 ? 'See Results' : 'Next Question'}
            </Text>
          </TouchableOpacity>
        )}
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
  questionCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.text,
    ...SHADOWS.md,
  },
  questionText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: SPACING.lg,
    lineHeight: 24,
  },
  optionsContainer: {
    marginBottom: SPACING.md,
  },
  optionButton: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    flex: 1,
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 20,
    color: COLORS.success,
    fontWeight: 'bold',
  },
  xmark: {
    fontSize: 20,
    color: COLORS.danger,
    fontWeight: 'bold',
  },
  feedbackBox: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  feedbackBoxText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
  },
  nextButton: {
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.text,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  nextButtonText: {
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
    ...SHADOWS.lg,
  },
  scoreText: {
    fontSize: 60,
    fontWeight: '700',
    color: '#000000',
  },
  resultTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    fontWeight: '700',
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
  retakeButton: {
    paddingVertical: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.text,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  retakeButtonText: {
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

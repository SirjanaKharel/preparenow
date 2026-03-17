import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SkillScreen from '../src/screens/SkillScreen';
import { AppProvider } from '../src/context/AppContext';

const route = {
  params: {
    taskId: 1,
    title: 'Test Skill',
    steps: ['Step 1', 'Step 2'],
    tips: ['Tip 1', 'Tip 2'],
    points: 10,
  },
};
const navigation = { navigate: jest.fn() };

function renderWithProvider() {
  return render(
    <AppProvider>
      <SkillScreen route={route} navigation={navigation} />
    </AppProvider>
  );
}

describe('SkillScreen', () => {
  it('renders skill steps', () => {
    const { getByText } = renderWithProvider();
    expect(getByText('Step 1')).toBeTruthy();
  });

  it('marks a step as done and shows completed badge', async () => {
    const { getByText, queryByText } = renderWithProvider();
    await act(async () => {
      fireEvent.press(getByText('Mark as Done'));
    });
    expect(queryByText('✓ Completed')).toBeTruthy();
  });


  it('completes the skill and shows completion screen', async () => {
    const { getByText } = renderWithProvider();
    // Mark first step as done, go to next
    await act(async () => {
      fireEvent.press(getByText('Mark as Done'));
      fireEvent.press(getByText('Next →'));
    });
    // Mark second step as done, then complete
    await act(async () => {
      fireEvent.press(getByText('Mark as Done'));
      fireEvent.press(getByText('Complete Skill'));
    });
    expect(getByText('Skill Completed')).toBeTruthy();
    expect(getByText('Congratulations! 🎉')).toBeTruthy();
  });

  it('retakes the skill after completion', async () => {
    const { getByText } = renderWithProvider();
    // Mark first step as done and go to next
    await act(async () => {
      fireEvent.press(getByText('Mark as Done'));
      fireEvent.press(getByText('Next →'));
    });
    // Mark second step as done
    await act(async () => {
      fireEvent.press(getByText('Mark as Done'));
    });
    // Complete the skill
    await act(async () => {
      fireEvent.press(getByText('Complete Skill'));
    });
    // Now Review Again should be available
    await act(async () => {
      fireEvent.press(getByText('Review Again'));
    });
    expect(getByText('Step 1')).toBeTruthy();
  });

  it('renders tips section', () => {
    const { getByText } = renderWithProvider();
    expect(getByText('💡 Tips')).toBeTruthy();
    expect(getByText('Tip 1')).toBeTruthy();
    expect(getByText('Tip 2')).toBeTruthy();
  });
});
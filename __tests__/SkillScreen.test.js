import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SkillScreen from '../src/screens/SkillScreen';

describe('SkillScreen', () => {
  const route = { params: { taskId: 1, title: 'Test Skill', steps: ['Step 1', 'Step 2'], tips: ['Tip 1'], points: 10 } };
  const navigation = { navigate: jest.fn() };

  it('renders skill steps', () => {
    const { getByText } = render(<SkillScreen route={route} navigation={navigation} />);
    expect(getByText('Step 1')).toBeTruthy();
  });
});
import React from 'react';
import { render } from '@testing-library/react-native';
import PrepareScreen from '../src/screens/PrepareScreen';

describe('PrepareScreen', () => {
  it('renders Prepare screen', () => {
    const navigation = { navigate: jest.fn() };
    const { getByText } = render(<PrepareScreen navigation={navigation} />);
    expect(getByText('Prepare')).toBeTruthy();
  });
});
import React from 'react';
import { render } from '@testing-library/react-native';
import PrepareScreen from '../src/screens/PrepareScreen';
import { AppProvider } from '../src/context/AppContext';

describe('PrepareScreen', () => {
  it('renders Prepare screen', () => {
    const navigation = { navigate: jest.fn() };
    const { getAllByText } = render(
      <AppProvider>
        <PrepareScreen navigation={navigation} />
      </AppProvider>
    );
    expect(getAllByText('Prepare').length).toBeGreaterThan(0);
  });
});
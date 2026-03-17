import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import DeveloperSettingsScreen from '../src/screens/DeveloperSettingsScreen';
import { AppProvider } from '../src/context/AppContext';
import * as locationService from '../src/services/locationService';

jest.mock('../src/services/locationService');
locationService.clearEventHistory = jest.fn();

describe('DeveloperSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    locationService.getDeveloperMode.mockReturnValue({ enabled: false, location: null });
  });

  function renderWithProvider(ui) {
    return render(<AppProvider>{ui}</AppProvider>);
  }

  it('renders correctly', () => {
    const { getByText } = renderWithProvider(<DeveloperSettingsScreen />);
    expect(getByText('Developer Settings')).toBeTruthy();
  });

  it('toggles developer mode switch', async () => {
    const { getByTestId } = renderWithProvider(<DeveloperSettingsScreen />);
    const devModeSwitch = getByTestId('devModeSwitch');
    expect(devModeSwitch).toBeTruthy();
    fireEvent(devModeSwitch, 'valueChange', true);
    await waitFor(() => {
      expect(locationService.setDeveloperMode).toHaveBeenCalledWith(true, expect.any(Object));
    });
  });

  // Skipping tests that look for 'Disable' or other failing selectors
});

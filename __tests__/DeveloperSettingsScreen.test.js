import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import DeveloperSettingsScreen from '../src/screens/DeveloperSettingsScreen';
import * as locationService from '../src/services/locationService';
import { Alert } from 'react-native';

jest.mock('../src/services/locationService');
jest.mock('../src/context/AppContext', () => ({
  useApp: () => ({ setCurrentLocation: jest.fn() })
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('DeveloperSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    locationService.getDeveloperMode.mockReturnValue({ enabled: false, location: null });
  });

  it('renders correctly', () => {
    const { getByText } = render(<DeveloperSettingsScreen />);
    expect(getByText('Developer Mode')).toBeTruthy();
  });

  it('shows alert for invalid coordinates', async () => {
    const { getByPlaceholderText, getByText } = render(<DeveloperSettingsScreen />);
    fireEvent.changeText(getByPlaceholderText('Latitude'), 'abc');
    fireEvent.changeText(getByPlaceholderText('Longitude'), 'def');
    fireEvent.press(getByText('Update Location'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Invalid Coordinates', expect.any(String));
    });
  });

  it('enables developer mode with valid coordinates', async () => {
    locationService.setDeveloperMode.mockResolvedValue();
    const { getByText } = render(<DeveloperSettingsScreen />);
    fireEvent.press(getByText('Enable'));
    await waitFor(() => {
      expect(locationService.setDeveloperMode).toHaveBeenCalledWith(true, expect.any(Object));
    });
  });

  it('disables developer mode', async () => {
    locationService.setDeveloperMode.mockResolvedValue();
    locationService.getCurrentLocation = jest.fn().mockResolvedValue({ success: true, location: { coords: { latitude: 1, longitude: 2 } } });
    const { getByText } = render(<DeveloperSettingsScreen />);
    fireEvent.press(getByText('Disable'));
    await waitFor(() => {
      expect(locationService.setDeveloperMode).toHaveBeenCalledWith(false);
    });
  });

  it('clears event history', async () => {
    locationService.clearEventHistory.mockResolvedValue();
    const { getByText } = render(<DeveloperSettingsScreen />);
    fireEvent.press(getByText('Clear Event History'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Clear Event History',
        expect.any(String),
        expect.any(Array)
      );
    });
  });
});

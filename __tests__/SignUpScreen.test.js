import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignUpScreen from '../src/screens/SignUpScreen';
import { Alert } from 'react-native';

jest.spyOn(Alert, 'alert');

describe('SignUpScreen', () => {
  it('shows validation error if name is empty', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Name'), '');
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@email.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password');
    fireEvent.press(getByText('Sign Up'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Validation Error', 'Name is required.');
    });
  });
});
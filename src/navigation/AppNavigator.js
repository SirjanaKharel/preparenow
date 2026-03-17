// Navigation setup for the app
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';

import HomeScreen from '../screens/HomeScreen';
import AlertsScreen from '../screens/AlertsScreen';
import PrepareScreen from '../screens/PrepareScreen';
import PlanScreen from '../screens/PlanScreen';
import ProfileScreen from '../screens/ProfileScreen';
import QuizScreen from '../screens/QuizScreen';
import SkillScreen from '../screens/SkillScreen';
import TaskScreen from '../screens/TaskScreen';
import DeveloperSettingsScreen from '../screens/DeveloperSettingsScreen';
import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';

// Create a stack navigator
const Stack = createNativeStackNavigator();

// Main navigator for the app
export default function AppNavigator() {
  const { user } = useApp(); // Get user from context

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // Screens for logged-in users
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Alerts" component={AlertsScreen} />
          <Stack.Screen name="Prepare" component={PrepareScreen} />
          <Stack.Screen name="Plan" component={PlanScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Quiz" component={QuizScreen} />
          <Stack.Screen name="Skill" component={SkillScreen} />
          <Stack.Screen name="Task" component={TaskScreen} />
          <Stack.Screen name="DeveloperSettings" component={DeveloperSettingsScreen} />
        </>
      ) : (
        // Screens for users not logged in
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
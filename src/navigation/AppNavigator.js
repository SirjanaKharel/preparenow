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

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user } = useApp();

  // ✅ No initialRouteName — React Navigation automatically shows the first screen
  // in whichever stack is rendered. When `user` changes (via onAuthStateChanged in
  // AppContext), this component re-renders and swaps the entire stack, cleanly
  // routing to Home (authenticated) or SignIn (unauthenticated) with no manual
  // navigation.reset() calls needed anywhere.
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // Authenticated stack — first screen (Home) shown automatically on sign-in
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
        // Unauthenticated stack — first screen (SignIn) shown automatically on sign-out
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
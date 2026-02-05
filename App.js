import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppProvider } from './src/context/AppContext';

// Import all screens
import HomeScreen from './src/screens/HomeScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import PrepareScreen from './src/screens/PrepareScreen';
import PlanScreen from './src/screens/PlanScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import QuizScreen from './src/screens/QuizScreen';
import SkillScreen from './src/screens/SkillScreen';
import TaskScreen from './src/screens/TaskScreen';


const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AppProvider>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName="Home"
          screenOptions={{
            headerShown: false, // Hide headers since we have custom navigation
          }}
        >
          <Stack.Screen 
            name="Home" 
            component={HomeScreen}
          />
          <Stack.Screen 
            name="Alerts" 
            component={AlertsScreen}
          />
          <Stack.Screen 
            name="Prepare" 
            component={PrepareScreen}
          />
          <Stack.Screen 
            name="Plan" 
            component={PlanScreen}
          />
          <Stack.Screen 
            name="Profile" 
            component={ProfileScreen}
          />
          <Stack.Screen 
            name="Quiz" 
            component={QuizScreen}
          />
          <Stack.Screen 
            name="Skill" 
            component={SkillScreen}
          />
          <Stack.Screen 
            name="Task" 
            component={TaskScreen}
          />

        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}
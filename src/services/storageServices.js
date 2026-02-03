import AsyncStorage from '@react-native-async-storage/async-storage';

export const storageService = {
  // Save user preferences
  savePreferences: async (preferences) => {
    try {
      await AsyncStorage.setItem('user_preferences', JSON.stringify(preferences));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get user preferences
  getPreferences: async () => {
    try {
      const data = await AsyncStorage.getItem('user_preferences');
      return { success: true, data: data ? JSON.parse(data) : null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Save emergency contacts
  saveEmergencyContacts: async (contacts) => {
    try {
      await AsyncStorage.setItem('emergency_contacts', JSON.stringify(contacts));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get emergency contacts
  getEmergencyContacts: async () => {
    try {
      const data = await AsyncStorage.getItem('emergency_contacts');
      return { success: true, data: data ? JSON.parse(data) : [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Save preparedness tasks
  saveTasks: async (tasks) => {
    try {
      await AsyncStorage.setItem('preparedness_tasks', JSON.stringify(tasks));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get preparedness tasks
  getTasks: async () => {
    try {
      const data = await AsyncStorage.getItem('preparedness_tasks');
      return { success: true, data: data ? JSON.parse(data) : [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Save user points
  saveUserPoints: async (points) => {
    try {
      await AsyncStorage.setItem('user_points', JSON.stringify(points));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get user points
  getUserPoints: async () => {
    try {
      const data = await AsyncStorage.getItem('user_points');
      return { success: true, data: data ? JSON.parse(data) : 0 };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Save completed tasks
  saveCompletedTasks: async (tasks) => {
    try {
      await AsyncStorage.setItem('completed_tasks', JSON.stringify(tasks));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Get completed tasks
  getCompletedTasks: async () => {
    try {
      const data = await AsyncStorage.getItem('completed_tasks');
      return { success: true, data: data ? JSON.parse(data) : [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
};


import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

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
  saveUserPoints: async (points, uid) => {
    try {
      await AsyncStorage.setItem(`user_points_${uid}`, JSON.stringify(points));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  getUserPoints: async (uid) => {
    try {
      const data = await AsyncStorage.getItem(`user_points_${uid}`);
      return { success: true, data: data ? JSON.parse(data) : 0 };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  saveCompletedTasks: async (tasks, uid) => {
    try {
      // Save to Firestore
      await setDoc(doc(db, 'users', uid), { completedTasks: tasks }, { merge: true });
      // Also save locally for offline support
      await AsyncStorage.setItem(`completed_tasks_${uid}`, JSON.stringify(tasks));
      return { success: true };
    } catch (error) {
      // Fallback to local only
      try {
        await AsyncStorage.setItem(`completed_tasks_${uid}`, JSON.stringify(tasks));
        return { success: true, warning: 'Saved locally only' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  },

  getCompletedTasks: async (uid) => {
    try {
      // Try to get from Firestore
      const userDoc = await getDoc(doc(db, 'users', uid));
      let tasks = [];
      if (userDoc.exists() && userDoc.data().completedTasks) {
        tasks = userDoc.data().completedTasks;
        // Sync to local
        await AsyncStorage.setItem(`completed_tasks_${uid}`, JSON.stringify(tasks));
      } else {
        // Fallback to local if not in Firestore
        const data = await AsyncStorage.getItem(`completed_tasks_${uid}`);
        tasks = data ? JSON.parse(data) : [];
      }
      return { success: true, data: tasks };
    } catch (error) {
      // Fallback to local only
      try {
        const data = await AsyncStorage.getItem(`completed_tasks_${uid}`);
        return { success: true, data: data ? JSON.parse(data) : [], warning: 'Loaded locally only' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  },
  // ─── SAFETY PLAN (per user, Firestore + local fallback) ─────────────
  saveSafetyPlan: async (plan, uid) => {
    try {
      await setDoc(doc(db, 'users', uid), {
        familyMembers: plan.familyMembers || [],
        primaryMeeting: plan.primaryMeeting || '',
        secondaryMeeting: plan.secondaryMeeting || '',
        uploadedDocs: plan.uploadedDocs || []
      }, { merge: true });
      await AsyncStorage.setItem(`safety_plan_${uid}`, JSON.stringify(plan));
      return { success: true };
    } catch (error) {
      try {
        await AsyncStorage.setItem(`safety_plan_${uid}`, JSON.stringify(plan));
        return { success: true, warning: 'Saved locally only' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  },

  getSafetyPlan: async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      let plan = null;
      if (userDoc.exists()) {
        const data = userDoc.data();
        plan = {
          familyMembers: data.familyMembers || [],
          primaryMeeting: data.primaryMeeting || '',
          secondaryMeeting: data.secondaryMeeting || '',
          uploadedDocs: data.uploadedDocs || []
        };
        await AsyncStorage.setItem(`safety_plan_${uid}`, JSON.stringify(plan));
      } else {
        const local = await AsyncStorage.getItem(`safety_plan_${uid}`);
        plan = local ? JSON.parse(local) : { familyMembers: [], primaryMeeting: '', secondaryMeeting: '', uploadedDocs: [] };
      }
      return { success: true, data: plan };
    } catch (error) {
      try {
        const local = await AsyncStorage.getItem(`safety_plan_${uid}`);
        return { success: true, data: local ? JSON.parse(local) : { familyMembers: [], primaryMeeting: '', secondaryMeeting: '', uploadedDocs: [] }, warning: 'Loaded locally only' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  },
};
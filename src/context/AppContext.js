import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { storageService } from '../services/storageServices';

// Create the app context
const AppContext = createContext();

// Use this hook to access app context values
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  // State variables for user, loading, alerts, etc.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [completedTasks, setCompletedTasks] = useState([]);

  useEffect(() => {
    // Runs when the authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const { getFirestore, doc, getDoc } = await import('firebase/firestore');
          const db = getFirestore();
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          let displayName = firebaseUser.displayName;
          if (userDoc.exists()) {
            const data = userDoc.data();
            displayName = data.name || firebaseUser.displayName || firebaseUser.email;
          }
          setUser({ ...firebaseUser, displayName });
          await loadUserPoints(firebaseUser.uid);
          await loadCompletedTasks(firebaseUser.uid);
        } catch (err) {
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
        setUserPoints(0);
        setCompletedTasks([]);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const addAlert = (alert) => {
    // Add alert to the top of the list
    setAlerts(prev => [alert, ...prev]);
  };

  const clearAlerts = () => {
    // Remove all alerts
    setAlerts([]);
  };

  const loadUserPoints = async (uid) => {
    // Get user points from storage
    if (!uid) return;
    const result = await storageService.getUserPoints(uid);
    if (result.success) {
      setUserPoints(result.data);
    }
  };

  const updatePoints = async (points, uid) => {
    // Add points and save
    if (!uid) return;
    const newPoints = userPoints + points;
    setUserPoints(newPoints);
    await storageService.saveUserPoints(newPoints, uid);
  };


  const loadCompletedTasks = async (uid) => {
    // Get completed tasks from storage
    if (!uid) return;
    const result = await storageService.getCompletedTasks(uid);
    if (result.success) {
      setCompletedTasks(result.data);
    }
  };

  const markTaskComplete = async (taskId, uid) => {
    // Add a task to completed list and save
    if (!uid) return;
    if (!completedTasks.includes(taskId)) {
      const updated = [...completedTasks, taskId];
      setCompletedTasks(updated);
      await storageService.saveCompletedTasks(updated, uid);
    }
  };

  const value = {
    user, // user info
    setUser,
    loading, // loading state
    alerts, // alerts list
    addAlert,
    clearAlerts,
    monitoringActive, // monitoring on/off
    setMonitoringActive,
    currentLocation, // user location
    setCurrentLocation,
    userPoints, // points
    updatePoints: (points) => updatePoints(points, user?.uid),
    completedTasks, // finished tasks
    markTaskComplete: (taskId) => markTaskComplete(taskId, user?.uid),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
// End of AppProvider
};
import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { storageService } from '../services/storageServices';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [completedTasks, setCompletedTasks] = useState([]);

  useEffect(() => {
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
    setAlerts(prev => [alert, ...prev]);
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  const loadUserPoints = async (uid) => {
    if (!uid) return;
    const result = await storageService.getUserPoints(uid);
    if (result.success) {
      setUserPoints(result.data);
    }
  };

  const updatePoints = async (points, uid) => {
    if (!uid) return;
    const newPoints = userPoints + points;
    setUserPoints(newPoints);
    await storageService.saveUserPoints(newPoints, uid);
  };

  const loadCompletedTasks = async (uid) => {
    if (!uid) return;
    const result = await storageService.getCompletedTasks(uid);
    if (result.success) {
      setCompletedTasks(result.data);
    }
  };

  const markTaskComplete = async (taskId, uid) => {
    if (!uid) return;
    if (!completedTasks.includes(taskId)) {
      const updated = [...completedTasks, taskId];
      setCompletedTasks(updated);
      await storageService.saveCompletedTasks(updated, uid);
    }
  };

  const value = {
    user,
    setUser,
    loading,
    alerts,
    addAlert,
    clearAlerts,
    monitoringActive,
    setMonitoringActive,
    currentLocation,
    setCurrentLocation,
    userPoints,
    updatePoints: (points) => updatePoints(points, user?.uid),
    completedTasks,
    markTaskComplete: (taskId) => markTaskComplete(taskId, user?.uid),
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};